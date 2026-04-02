/**
 * Auth API — unit tests (Vitest)
 *
 * These tests define the expected contract for the auth endpoints.
 * They will fail until Phase 1 (EJM-26) implements the actual logic.
 * Marked as .todo so the suite does not block CI until then.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';

// ─── Minimal Env mock ──────────────────────────────────────────────────────────
const mockDB = {
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(),
  run: vi.fn(),
  all: vi.fn(),
};

const mockEnv = {
  DB: mockDB,
  JWT_SECRET: 'test-secret-32-chars-long-enough!!',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
async function fetchRoute(app: Hono, method: string, path: string, body?: unknown) {
  const req = new Request(`http://localhost${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return app.fetch(req, mockEnv as unknown as Env);
}

// ─── Health check ─────────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const { default: app } = await import('../index');
    const res = await fetchRoute(app, 'GET', '/api/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ok');
  });
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it.todo('returns 201 and a JWT token when given valid email + password');

  it.todo('returns 400 when email is missing');

  it.todo('returns 400 when password is shorter than 8 chars');

  it.todo('returns 409 when email is already registered');

  it.todo('stores password as bcrypt hash, never plaintext');
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it.todo('returns 200 and a JWT token for correct credentials');

  it.todo('returns 401 for wrong password');

  it.todo('returns 401 for unknown email');

  it.todo('JWT payload contains userId and email, expiry in 24h');
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
describe('POST /api/auth/refresh', () => {
  it.todo('returns 200 and a new JWT given a valid refresh token');

  it.todo('returns 401 for an expired refresh token');

  it.todo('returns 401 for a tampered token signature');
});

// ─── JWT security ─────────────────────────────────────────────────────────────
describe('JWT security', () => {
  it.todo('uses HS256 algorithm (not HS1 or "none")');

  it.todo('rejects requests with a missing Authorization header on protected routes');

  it.todo('rejects requests with an invalid JWT on protected routes');
});
