/**
 * Stripe / Payments API — unit tests (Vitest)
 *
 * Contract tests for Phase 3 (EJM-29).
 * All cases are .todo until the route is implemented.
 */

import { describe, it } from 'vitest';

// ─── POST /api/stripe/webhook ─────────────────────────────────────────────────
describe('POST /api/stripe/webhook', () => {
  it.todo('returns 200 and upgrades user plan on checkout.session.completed event');

  it.todo('returns 400 when Stripe-Signature header is missing');

  it.todo('returns 400 when webhook signature verification fails');

  it.todo('is idempotent — processing the same event twice does not double-upgrade');
});

// ─── GET /api/billing/plans ───────────────────────────────────────────────────
describe('GET /api/billing/plans', () => {
  it.todo('returns free and pro plan definitions with price and feature list');
});

// ─── Security ─────────────────────────────────────────────────────────────────
describe('Stripe security', () => {
  it.todo('STRIPE_WEBHOOK_SECRET is never exposed in API responses');

  it.todo('plan downgrade cannot be triggered by a user without a valid Stripe event');
});
