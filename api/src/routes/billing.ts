/**
 * Billing routes — Phase 3 (EJM-29)
 *
 * GET  /api/billing/plans           — list Free and Pro plan definitions
 * GET  /api/billing/subscription    — current user's subscription status
 * POST /api/billing/checkout        — create Stripe Checkout session (→ redirect URL)
 * POST /api/billing/portal          — create Stripe Customer Portal session (manage/cancel)
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { JwtPayload } from '../services/auth';
import {
  PLANS,
  getOrCreateCustomer,
  createCheckoutSession,
  createBillingPortalSession,
} from '../services/stripe';

export const billingRouter = new Hono<{ Bindings: Env; Variables: { user: JwtPayload } }>();

// All billing endpoints require authentication
billingRouter.use('*', requireAuth);

// GET /api/billing/plans
billingRouter.get('/plans', (c) => {
  return c.json({ plans: Object.values(PLANS) });
});

// GET /api/billing/subscription
billingRouter.get('/subscription', async (c) => {
  const jwtUser = c.get('user');
  const row = await c.env.DB
    .prepare('SELECT plan, stripe_customer_id, stripe_subscription_id, plan_expires_at FROM users WHERE id = ?')
    .bind(jwtUser.sub)
    .first<{
      plan: string;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      plan_expires_at: string | null;
    }>();

  if (!row) return c.json({ error: 'User not found' }, 404);

  return c.json({
    plan: row.plan,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    planExpiresAt: row.plan_expires_at,
  });
});

// POST /api/billing/checkout
// Body: { priceId: string }  — Stripe price ID for the Pro plan
billingRouter.post('/checkout', async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: 'Stripe not configured' }, 503);
  }

  const jwtUser = c.get('user');
  let body: { priceId: string };
  try {
    body = await c.req.json<{ priceId: string }>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.priceId) {
    return c.json({ error: 'priceId is required' }, 400);
  }

  const userRow = await c.env.DB
    .prepare('SELECT email, name, stripe_customer_id FROM users WHERE id = ?')
    .bind(jwtUser.sub)
    .first<{ email: string; name: string; stripe_customer_id: string | null }>();

  if (!userRow) return c.json({ error: 'User not found' }, 404);

  const customer = await getOrCreateCustomer(
    c.env.STRIPE_SECRET_KEY,
    userRow.email,
    userRow.stripe_customer_id
  );

  // Persist the Stripe customer ID if new
  if (!userRow.stripe_customer_id) {
    await c.env.DB
      .prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?')
      .bind(customer.id, jwtUser.sub)
      .run();
  }

  const appUrl = c.env.APP_URL || 'http://localhost:4200';
  const session = await createCheckoutSession(
    c.env.STRIPE_SECRET_KEY,
    customer.id,
    body.priceId,
    `${appUrl}/dashboard?checkout=success`,
    `${appUrl}/pricing?checkout=cancelled`
  );

  return c.json({ checkoutUrl: session.url });
});

// POST /api/billing/portal
// Opens the Stripe Customer Portal (manage/cancel subscription)
billingRouter.post('/portal', async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: 'Stripe not configured' }, 503);
  }

  const jwtUser = c.get('user');
  const row = await c.env.DB
    .prepare('SELECT stripe_customer_id FROM users WHERE id = ?')
    .bind(jwtUser.sub)
    .first<{ stripe_customer_id: string | null }>();

  if (!row?.stripe_customer_id) {
    return c.json({ error: 'No active subscription found' }, 404);
  }

  const appUrl = c.env.APP_URL || 'http://localhost:4200';
  const session = await createBillingPortalSession(
    c.env.STRIPE_SECRET_KEY,
    row.stripe_customer_id,
    `${appUrl}/dashboard`
  );

  return c.json({ portalUrl: session.url });
});
