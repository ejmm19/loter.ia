/**
 * Billing API — unit tests (Vitest)
 *
 * Tests for billing routes that don't require live Stripe calls.
 * Checkout and portal routes are skipped (require Stripe API).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signJwt } from '../services/auth';

const JWT_SECRET = 'test-secret-32-chars-long-enough!!';

const mockDB = {
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(),
  run: vi.fn(),
  all: vi.fn(),
};

const mockEnv = {
  DB: mockDB,
  JWT_SECRET,
  STRIPE_SECRET_KEY: 'sk_test_placeholder',
  STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
};

async function fetchRoute(method: string, path: string, body?: unknown, token?: string) {
  const { default: app } = await import('../index');
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const req = new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return app.fetch(req, mockEnv as unknown as Env);
}

async function makeToken(sub = 'user-1', role = 'user') {
  return signJwt({ sub, email: `${sub}@test.com`, role, type: 'access' }, JWT_SECRET);
}

beforeEach(() => {
  vi.resetAllMocks();
  mockDB.prepare.mockReturnThis();
  mockDB.bind.mockReturnThis();
});

// ─── GET /api/billing/plans ───────────────────────────────────────────────────
describe('GET /api/billing/plans', () => {
  it('returns 200 with free and pro plan definitions', async () => {
    const token = await makeToken();
    const res = await fetchRoute('GET', '/api/billing/plans', undefined, token);
    expect(res.status).toBe(200);
    const body = await res.json() as { plans: { id: string; name: string; price: number }[] };
    expect(Array.isArray(body.plans)).toBe(true);
    const ids = body.plans.map(p => p.id);
    expect(ids).toContain('free');
    expect(ids).toContain('pro');
  });

  it('each plan has id, name, price, and features', async () => {
    const token = await makeToken();
    const res = await fetchRoute('GET', '/api/billing/plans', undefined, token);
    const body = await res.json() as { plans: Record<string, unknown>[] };
    for (const plan of body.plans) {
      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('name');
      expect(plan).toHaveProperty('price');
      expect(plan).toHaveProperty('features');
      expect(Array.isArray(plan.features)).toBe(true);
    }
  });

  it('returns 401 without authentication', async () => {
    const res = await fetchRoute('GET', '/api/billing/plans');
    expect(res.status).toBe(401);
  });

  it('free plan has price 0 and a predictionsPerDay limit', async () => {
    const token = await makeToken();
    const res = await fetchRoute('GET', '/api/billing/plans', undefined, token);
    const body = await res.json() as { plans: { id: string; price: number; predictionsPerDay: number | null }[] };
    const free = body.plans.find(p => p.id === 'free');
    expect(free?.price).toBe(0);
    expect(free?.predictionsPerDay).toBeGreaterThan(0);
  });

  it('pro plan has null predictionsPerDay (unlimited)', async () => {
    const token = await makeToken();
    const res = await fetchRoute('GET', '/api/billing/plans', undefined, token);
    const body = await res.json() as { plans: { id: string; predictionsPerDay: number | null }[] };
    const pro = body.plans.find(p => p.id === 'pro');
    expect(pro?.predictionsPerDay).toBeNull();
  });
});

// ─── GET /api/billing/subscription ───────────────────────────────────────────
describe('GET /api/billing/subscription', () => {
  it('returns 200 with subscription info for authenticated user', async () => {
    const token = await makeToken('user-1');
    mockDB.first.mockResolvedValueOnce({
      plan: 'free',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      plan_expires_at: null,
    });

    const res = await fetchRoute('GET', '/api/billing/subscription', undefined, token);
    expect(res.status).toBe(200);
    const body = await res.json() as { plan: string };
    expect(body.plan).toBe('free');
  });

  it('returns subscription with stripeCustomerId and plan fields', async () => {
    const token = await makeToken('user-pro');
    mockDB.first.mockResolvedValueOnce({
      plan: 'pro',
      stripe_customer_id: 'cus_abc123',
      stripe_subscription_id: 'sub_xyz',
      plan_expires_at: '2025-01-01T00:00:00Z',
    });

    const res = await fetchRoute('GET', '/api/billing/subscription', undefined, token);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('plan');
    expect(body).toHaveProperty('stripeCustomerId');
    expect(body).toHaveProperty('stripeSubscriptionId');
    expect(body).toHaveProperty('planExpiresAt');
  });

  it('returns 404 when user record not found', async () => {
    const token = await makeToken('ghost-user');
    mockDB.first.mockResolvedValueOnce(null);

    const res = await fetchRoute('GET', '/api/billing/subscription', undefined, token);
    expect(res.status).toBe(404);
  });

  it('returns 401 without authentication', async () => {
    const res = await fetchRoute('GET', '/api/billing/subscription');
    expect(res.status).toBe(401);
  });
});
