/**
 * Stripe webhook handler — Phase 3 (EJM-29)
 *
 * POST /api/stripe/webhook
 *
 * Handles:
 *   - checkout.session.completed     → upgrade user to Pro
 *   - customer.subscription.deleted  → downgrade user to Free
 *   - customer.subscription.updated  → sync plan expiry
 *
 * Security:
 *   - Verifies Stripe-Signature header before processing
 *   - Idempotency: skips events already in stripe_events table
 *   - Never exposes STRIPE_WEBHOOK_SECRET in responses
 */

import { Hono } from 'hono';
import { verifyStripeSignature } from '../services/stripe';

interface StripeCheckoutSession {
  id: string;
  customer: string;
  subscription: string;
  metadata?: Record<string, string>;
}

interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_end: number;
}

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: StripeCheckoutSession | StripeSubscription;
  };
}

export const webhookRouter = new Hono<{ Bindings: Env }>();

// POST /api/stripe/webhook
webhookRouter.post('/', async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: 'Webhook not configured' }, 503);
  }

  const signature = c.req.header('Stripe-Signature');
  if (!signature) {
    return c.json({ error: 'Missing Stripe-Signature header' }, 400);
  }

  const rawBody = await c.req.text();

  const valid = await verifyStripeSignature(rawBody, signature, c.env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return c.json({ error: 'Invalid signature' }, 400);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  // Idempotency check
  const existing = await c.env.DB
    .prepare('SELECT id FROM stripe_events WHERE id = ?')
    .bind(event.id)
    .first();
  if (existing) {
    return c.json({ received: true, skipped: true });
  }

  // Process event
  try {
    await handleStripeEvent(c.env.DB, event);
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    return c.json({ error: 'Handler error' }, 500);
  }

  // Record as processed
  await c.env.DB
    .prepare('INSERT INTO stripe_events (id, type) VALUES (?, ?)')
    .bind(event.id, event.type)
    .run();

  return c.json({ received: true });
});

async function handleStripeEvent(db: D1Database, event: StripeEvent): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as StripeCheckoutSession;
      if (!session.customer || !session.subscription) break;
      // Upgrade user to Pro
      await db
        .prepare(`
          UPDATE users
          SET plan = 'pro',
              stripe_subscription_id = ?,
              plan_expires_at = NULL
          WHERE stripe_customer_id = ?
        `)
        .bind(session.subscription, session.customer)
        .run();
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as StripeSubscription;
      const expiresAt = new Date(sub.current_period_end * 1000).toISOString();
      if (sub.status === 'active' || sub.status === 'trialing') {
        await db
          .prepare(`
            UPDATE users
            SET plan = 'pro',
                plan_expires_at = ?
            WHERE stripe_customer_id = ?
          `)
          .bind(expiresAt, sub.customer)
          .run();
      } else {
        // cancelled, past_due, unpaid → downgrade
        await db
          .prepare(`
            UPDATE users
            SET plan = 'free',
                stripe_subscription_id = NULL,
                plan_expires_at = NULL
            WHERE stripe_customer_id = ?
          `)
          .bind(sub.customer)
          .run();
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as StripeSubscription;
      await db
        .prepare(`
          UPDATE users
          SET plan = 'free',
              stripe_subscription_id = NULL,
              plan_expires_at = NULL
          WHERE stripe_customer_id = ?
        `)
        .bind(sub.customer)
        .run();
      break;
    }

    default:
      // Silently ignore unhandled event types
      break;
  }
}
