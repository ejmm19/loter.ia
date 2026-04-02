/**
 * Auth API — unit tests (Vitest)
 *
 * Contract tests for auth endpoints (EJM-26).
 * Tests POST /api/auth/register, /login, /refresh, /logout, and JWT security.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hashPassword } from '../services/auth';

const JWT_SECRET = 'test-secret-32-chars-long-enough!!';

// ─── Mock DB ──────────────────────────────────────────────────────────────────
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

beforeEach(() => {
  vi.resetAllMocks();
  mockDB.prepare.mockReturnThis();
  mockDB.bind.mockReturnThis();
  mockDB.run.mockResolvedValue({ meta: { last_row_id: 42 }, success: true });
});

// ─── GET /api/health ──────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await fetchRoute('GET', '/api/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ok');
  });
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('returns 201 and access/refresh tokens when given valid email, password, name', async () => {
    mockDB.first.mockResolvedValueOnce(null); // email not taken
    // run() for INSERT user and INSERT refresh_token already mocked in beforeEach

    const res = await fetchRoute('POST', '/api/auth/register', {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { accessToken: string; refreshToken: string; user: { email: string } };
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user.email).toBe('test@example.com');
  });

  it('returns 400 when email is missing', async () => {
    const res = await fetchRoute('POST', '/api/auth/register', { password: 'password123', name: 'Test' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is shorter than 8 chars', async () => {
    const res = await fetchRoute('POST', '/api/auth/register', {
      email: 'test@example.com',
      password: 'short',
      name: 'Test',
    });
    expect(res.status).toBe(400);
  });

  it('returns 409 when email is already registered', async () => {
    mockDB.first.mockResolvedValueOnce({ id: 1 }); // email already exists

    const res = await fetchRoute('POST', '/api/auth/register', {
      email: 'existing@example.com',
      password: 'password123',
      name: 'Existing',
    });
    expect(res.status).toBe(409);
  });

  it('stores password as bcrypt hash (never plaintext)', async () => {
    mockDB.first.mockResolvedValueOnce(null);

    await fetchRoute('POST', '/api/auth/register', {
      email: 'test@example.com',
      password: 'MySecret123',
      name: 'Test',
    });

    // DB bind calls should never include the plaintext password
    const allBindArgs = mockDB.bind.mock.calls.flat() as string[];
    expect(allBindArgs).not.toContain('MySecret123');
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('returns 200 and tokens for correct credentials', async () => {
    const passwordHash = await hashPassword('password123');
    mockDB.first.mockResolvedValueOnce({
      id: 1,
      email: 'test@example.com',
      password_hash: passwordHash,
      name: 'Test User',
      role: 'user',
      is_active: 1,
    });

    const res = await fetchRoute('POST', '/api/auth/login', {
      email: 'test@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { accessToken: string; refreshToken: string };
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
  });

  it('returns 401 for wrong password', async () => {
    const passwordHash = await hashPassword('correct-password');
    mockDB.first.mockResolvedValueOnce({
      id: 1,
      email: 'test@example.com',
      password_hash: passwordHash,
      name: 'Test',
      role: 'user',
      is_active: 1,
    });

    const res = await fetchRoute('POST', '/api/auth/login', {
      email: 'test@example.com',
      password: 'wrong-password',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    mockDB.first.mockResolvedValueOnce(null);

    const res = await fetchRoute('POST', '/api/auth/login', {
      email: 'nobody@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(401);
  });

  it('JWT payload contains sub (userId) and email', async () => {
    const passwordHash = await hashPassword('password123');
    mockDB.first.mockResolvedValueOnce({
      id: 99,
      email: 'jwt@example.com',
      password_hash: passwordHash,
      name: 'JWT User',
      role: 'user',
      is_active: 1,
    });

    const res = await fetchRoute('POST', '/api/auth/login', {
      email: 'jwt@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { accessToken: string };
    // JWT is base64url — decode payload
    const parts = body.accessToken.split('.');
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    expect(payload.sub).toBe('99');
    expect(payload.email).toBe('jwt@example.com');
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
  });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
describe('POST /api/auth/refresh', () => {
  it('returns 200 and a new access token given a valid refresh token', async () => {
    // Generate a real refresh token
    const { signJwt } = await import('../services/auth');
    const refreshToken = await signJwt(
      { sub: '1', email: 'test@example.com', role: 'user', type: 'refresh' },
      JWT_SECRET,
    );

    mockDB.first
      .mockResolvedValueOnce({ id: 10 }) // stored token found
      .mockResolvedValueOnce({ id: 1, email: 'test@example.com', role: 'user' }); // user lookup

    const res = await fetchRoute('POST', '/api/auth/refresh', { refreshToken });
    expect(res.status).toBe(200);
    const body = await res.json() as { accessToken: string };
    expect(body.accessToken).toBeTruthy();
  });

  it('returns 401 for a tampered token signature', async () => {
    const tampered = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwidHlwZSI6InJlZnJlc2gifQ.bad_sig';
    const res = await fetchRoute('POST', '/api/auth/refresh', { refreshToken: tampered });
    expect(res.status).toBe(401);
  });

  it('returns 401 when refresh token is not in DB (revoked)', async () => {
    const { signJwt } = await import('../services/auth');
    const refreshToken = await signJwt(
      { sub: '1', email: 'test@example.com', role: 'user', type: 'refresh' },
      JWT_SECRET,
    );
    mockDB.first.mockResolvedValueOnce(null); // not found in DB

    const res = await fetchRoute('POST', '/api/auth/refresh', { refreshToken });
    expect(res.status).toBe(401);
  });

  it('returns 401 when user is deleted after refresh token was issued', async () => {
    const { signJwt } = await import('../services/auth');
    const refreshToken = await signJwt(
      { sub: '999', email: 'deleted@example.com', role: 'user', type: 'refresh' },
      JWT_SECRET,
    );
    mockDB.first
      .mockResolvedValueOnce({ id: 5 })  // token exists in DB
      .mockResolvedValueOnce(null);       // user no longer found

    const res = await fetchRoute('POST', '/api/auth/refresh', { refreshToken });
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
describe('POST /api/auth/logout', () => {
  it('returns 200 for an authenticated user (no refreshToken)', async () => {
    const { signJwt } = await import('../services/auth');
    const token = await signJwt(
      { sub: '1', email: 'test@example.com', role: 'user', type: 'access' },
      JWT_SECRET,
    );

    const res = await fetchRoute('POST', '/api/auth/logout', {}, token);
    expect(res.status).toBe(200);
    const body = await res.json() as { message: string };
    expect(body.message).toBeTruthy();
  });

  it('revokes the refresh token when provided', async () => {
    const { signJwt } = await import('../services/auth');
    const accessToken = await signJwt(
      { sub: '1', email: 'test@example.com', role: 'user', type: 'access' },
      JWT_SECRET,
    );
    const refreshToken = await signJwt(
      { sub: '1', email: 'test@example.com', role: 'user', type: 'refresh' },
      JWT_SECRET,
    );

    const res = await fetchRoute('POST', '/api/auth/logout', { refreshToken }, accessToken);
    expect(res.status).toBe(200);
    // DB run should be called to revoke the token
    expect(mockDB.run).toHaveBeenCalled();
  });

  it('returns 401 without authentication', async () => {
    const res = await fetchRoute('POST', '/api/auth/logout', {});
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  it('returns 200 with user profile for authenticated user', async () => {
    const { signJwt } = await import('../services/auth');
    const token = await signJwt(
      { sub: '42', email: 'me@example.com', role: 'user', type: 'access' },
      JWT_SECRET,
    );
    mockDB.first.mockResolvedValueOnce({
      id: 42, email: 'me@example.com', name: 'Test User', role: 'user', created_at: '2024-01-01',
    });

    const res = await fetchRoute('GET', '/api/auth/me', undefined, token);
    expect(res.status).toBe(200);
    const body = await res.json() as { user: { email: string; id: string } };
    expect(body.user.email).toBe('me@example.com');
    expect(body.user.id).toBe('42');
  });

  it('returns 404 when user no longer exists', async () => {
    const { signJwt } = await import('../services/auth');
    const token = await signJwt(
      { sub: '99', email: 'gone@example.com', role: 'user', type: 'access' },
      JWT_SECRET,
    );
    mockDB.first.mockResolvedValueOnce(null);

    const res = await fetchRoute('GET', '/api/auth/me', undefined, token);
    expect(res.status).toBe(404);
  });

  it('returns 401 without authentication', async () => {
    const res = await fetchRoute('GET', '/api/auth/me');
    expect(res.status).toBe(401);
  });
});

// ─── JWT security ─────────────────────────────────────────────────────────────
describe('JWT security', () => {
  it('uses HS256 algorithm in token header', async () => {
    const { signJwt } = await import('../services/auth');
    const token = await signJwt(
      { sub: '1', email: 'test@example.com', role: 'user', type: 'access' },
      JWT_SECRET,
    );
    const header = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
    expect(header.alg).toBe('HS256');
  });

  it('rejects requests with a missing Authorization header on protected routes', async () => {
    const res = await fetchRoute('GET', '/api/predictions');
    expect(res.status).toBe(401);
  });

  it('rejects requests with an invalid JWT on protected routes', async () => {
    const res = await fetchRoute('GET', '/api/predictions', undefined, 'not.a.jwt');
    expect(res.status).toBe(401);
  });
});
