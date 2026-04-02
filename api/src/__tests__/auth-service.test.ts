/**
 * Auth Service — unit tests (Vitest)
 *
 * Tests the pure auth utility functions: JWT sign/verify, password hash/verify,
 * and refresh token hashing. These run in Node.js and use the Web Crypto API
 * built into Node 18+.
 */

import { describe, it, expect } from 'vitest';
import {
  signJwt,
  verifyJwt,
  hashPassword,
  verifyPassword,
  hashRefreshToken,
} from '../services/auth';

const SECRET = 'test-secret-that-is-long-enough-32chars';

// ─── signJwt / verifyJwt ──────────────────────────────────────────────────────

describe('signJwt', () => {
  it('returns a three-part JWT string', async () => {
    const token = await signJwt({ sub: 'u1', email: 'a@b.com', role: 'user', type: 'access' }, SECRET);
    expect(token.split('.')).toHaveLength(3);
  });

  it('uses HS256 algorithm (header alg field)', async () => {
    const token = await signJwt({ sub: 'u1', email: 'a@b.com', role: 'user', type: 'access' }, SECRET);
    const header = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
    expect(header.alg).toBe('HS256');
  });

  it('encodes sub, email, role, type in payload', async () => {
    const token = await signJwt({ sub: 'user-id', email: 'x@y.com', role: 'admin', type: 'refresh' }, SECRET);
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(token.split('.')[1].length + (4 - token.split('.')[1].length % 4) % 4, '=')));
    expect(payload.sub).toBe('user-id');
    expect(payload.email).toBe('x@y.com');
    expect(payload.role).toBe('admin');
    expect(payload.type).toBe('refresh');
  });

  it('access token expires in ~15 minutes', async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await signJwt({ sub: 'u1', email: 'a@b.com', role: 'user', type: 'access' }, SECRET);
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(token.split('.')[1].length + (4 - token.split('.')[1].length % 4) % 4, '=')));
    expect(payload.exp - before).toBeGreaterThanOrEqual(14 * 60);
    expect(payload.exp - before).toBeLessThanOrEqual(16 * 60);
  });

  it('refresh token expires in ~7 days', async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await signJwt({ sub: 'u1', email: 'a@b.com', role: 'user', type: 'refresh' }, SECRET);
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(token.split('.')[1].length + (4 - token.split('.')[1].length % 4) % 4, '=')));
    const sevenDays = 7 * 24 * 3600;
    expect(payload.exp - before).toBeGreaterThanOrEqual(sevenDays - 60);
    expect(payload.exp - before).toBeLessThanOrEqual(sevenDays + 60);
  });
});

describe('verifyJwt', () => {
  it('returns the payload for a valid token', async () => {
    const token = await signJwt({ sub: 'u1', email: 'a@b.com', role: 'user', type: 'access' }, SECRET);
    const payload = await verifyJwt(token, SECRET);
    expect(payload.sub).toBe('u1');
    expect(payload.email).toBe('a@b.com');
  });

  it('throws for a tampered signature', async () => {
    const token = await signJwt({ sub: 'u1', email: 'a@b.com', role: 'user', type: 'access' }, SECRET);
    const tampered = token.slice(0, -4) + 'XXXX';
    await expect(verifyJwt(tampered, SECRET)).rejects.toThrow();
  });

  it('throws for a wrong secret', async () => {
    const token = await signJwt({ sub: 'u1', email: 'a@b.com', role: 'user', type: 'access' }, SECRET);
    await expect(verifyJwt(token, 'wrong-secret-here-wrong-secret!!!')).rejects.toThrow();
  });

  it('throws for a malformed token (missing parts)', async () => {
    await expect(verifyJwt('notavalidtoken', SECRET)).rejects.toThrow('Invalid token format');
  });

  it('throws for a token with incorrect part count', async () => {
    await expect(verifyJwt('a.b', SECRET)).rejects.toThrow('Invalid token format');
  });
});

// ─── hashPassword / verifyPassword ────────────────────────────────────────────

describe('hashPassword', () => {
  it('produces a string in salt:hash format', async () => {
    const hash = await hashPassword('myPassword123');
    expect(hash).toContain(':');
    expect(hash.split(':')).toHaveLength(2);
  });

  it('never stores the plaintext password in the hash', async () => {
    const hash = await hashPassword('secret-password');
    expect(hash).not.toContain('secret-password');
  });

  it('produces different hashes for the same password (random salt)', async () => {
    const [h1, h2] = await Promise.all([
      hashPassword('samePassword'),
      hashPassword('samePassword'),
    ]);
    expect(h1).not.toBe(h2);
  });
});

describe('verifyPassword', () => {
  it('returns true for correct password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(await verifyPassword('correct-horse-battery', hash)).toBe(true);
  });

  it('returns false for wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('returns false for empty string vs non-empty hash', async () => {
    const hash = await hashPassword('my-password');
    expect(await verifyPassword('', hash)).toBe(false);
  });
});

// ─── hashRefreshToken ─────────────────────────────────────────────────────────

describe('hashRefreshToken', () => {
  it('returns a non-empty string', async () => {
    const h = await hashRefreshToken('some.refresh.token');
    expect(h.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same input', async () => {
    const [h1, h2] = await Promise.all([
      hashRefreshToken('token-value'),
      hashRefreshToken('token-value'),
    ]);
    expect(h1).toBe(h2);
  });

  it('produces different hashes for different tokens', async () => {
    const [h1, h2] = await Promise.all([
      hashRefreshToken('token-a'),
      hashRefreshToken('token-b'),
    ]);
    expect(h1).not.toBe(h2);
  });
});
