/**
 * User API — unit tests (Vitest)
 *
 * Tests for user profile routes (EJM-29).
 * All routes require authentication.
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
  mockDB.run.mockResolvedValue({ success: true });
});

// ─── GET /api/user/history ────────────────────────────────────────────────────
describe('GET /api/user/history', () => {
  it('returns 200 with predictions array', async () => {
    const token = await makeToken();
    mockDB.all.mockResolvedValueOnce({
      results: [{
        id: 1, lottery_id: 1, lottery_name: 'Baloto',
        predicted_numbers: '[5,12,23,34,41,7]', actual_numbers: null,
        matched_count: null, confidence_score: 65, draw_date: null,
        created_at: '2024-06-01T10:00:00Z',
      }],
    });

    const res = await fetchRoute('GET', '/api/user/history', undefined, token);
    expect(res.status).toBe(200);
    const body = await res.json() as { predictions: unknown[] };
    expect(Array.isArray(body.predictions)).toBe(true);
    expect(body.predictions).toHaveLength(1);
  });

  it('returns empty list when user has no history', async () => {
    const token = await makeToken();
    mockDB.all.mockResolvedValueOnce({ results: [] });

    const res = await fetchRoute('GET', '/api/user/history', undefined, token);
    expect(res.status).toBe(200);
    const body = await res.json() as { predictions: unknown[] };
    expect(body.predictions).toHaveLength(0);
  });

  it('returns 401 without authentication', async () => {
    const res = await fetchRoute('GET', '/api/user/history');
    expect(res.status).toBe(401);
  });

  it('response includes limit and offset fields', async () => {
    const token = await makeToken();
    mockDB.all.mockResolvedValueOnce({ results: [] });

    const res = await fetchRoute('GET', '/api/user/history', undefined, token);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('limit');
    expect(body).toHaveProperty('offset');
  });

  it('uses JWT sub for DB query, not a caller-supplied userId', async () => {
    const token = await makeToken('my-user-id');
    mockDB.all.mockResolvedValueOnce({ results: [] });

    await fetchRoute('GET', '/api/user/history', undefined, token);

    const bindArgs = mockDB.bind.mock.calls.flat() as string[];
    expect(bindArgs).toContain('my-user-id');
  });
});

// ─── GET /api/user/stats ──────────────────────────────────────────────────────
describe('GET /api/user/stats', () => {
  it('returns 200 with stats object', async () => {
    const token = await makeToken();
    mockDB.first
      .mockResolvedValueOnce({ total: 10 })
      .mockResolvedValueOnce({ resolved: 5, with_hits: 3, avg_matched: 1.2, best_match: 4 })
      .mockResolvedValueOnce({ name: 'Baloto', cnt: 7 });

    const res = await fetchRoute('GET', '/api/user/stats', undefined, token);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('totalPredictions');
    expect(body).toHaveProperty('resolvedPredictions');
  });

  it('returns 401 without authentication', async () => {
    const res = await fetchRoute('GET', '/api/user/stats');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/user/favorites ──────────────────────────────────────────────────
describe('GET /api/user/favorites', () => {
  it('returns 200 with favorites list', async () => {
    const token = await makeToken();
    mockDB.all.mockResolvedValueOnce({
      results: [{ id: 1, label: 'My lucky', numbers: '[5,12,23]', created_at: '2024-01-01' }],
    });

    const res = await fetchRoute('GET', '/api/user/favorites', undefined, token);
    expect(res.status).toBe(200);
    const body = await res.json() as { favorites: unknown[] };
    expect(Array.isArray(body.favorites)).toBe(true);
  });

  it('returns 401 without authentication', async () => {
    const res = await fetchRoute('GET', '/api/user/favorites');
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/user/favorites ─────────────────────────────────────────────────
describe('POST /api/user/favorites', () => {
  it('returns 201 when saving a valid favorite (pro user)', async () => {
    const token = await makeToken();
    // plan check: pro → no limit applied
    mockDB.first.mockResolvedValueOnce({ plan: 'pro' });
    mockDB.run.mockResolvedValueOnce({ meta: { last_row_id: 5 }, success: true });

    const res = await fetchRoute('POST', '/api/user/favorites', {
      lotteryId: 1,
      numbers: [5, 12, 23, 34, 41, 7],
      label: 'Lucky set',
    }, token);
    expect(res.status).toBe(201);
  });

  it('returns 400 when numbers array is missing', async () => {
    const token = await makeToken();
    // plan check
    mockDB.first.mockResolvedValueOnce({ plan: 'pro' });
    const res = await fetchRoute('POST', '/api/user/favorites', { lotteryId: 1, label: 'No numbers' }, token);
    expect(res.status).toBe(400);
  });

  it('returns 403 when free user exceeds 5 favorites', async () => {
    const token = await makeToken();
    // plan check: free
    mockDB.first.mockResolvedValueOnce({ plan: 'free' });
    // count check: already at 5
    mockDB.first.mockResolvedValueOnce({ cnt: 5 });

    const res = await fetchRoute('POST', '/api/user/favorites', {
      lotteryId: 1,
      numbers: [1, 2, 3, 4, 5, 6],
    }, token);
    expect(res.status).toBe(403);
  });

  it('returns 401 without authentication', async () => {
    const res = await fetchRoute('POST', '/api/user/favorites', { numbers: [1, 2, 3] });
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/user/favorites/:id ──────────────────────────────────────────
describe('DELETE /api/user/favorites/:id', () => {
  it('returns 200 when deleting an existing favorite', async () => {
    const token = await makeToken('user-1');
    // DELETE route uses run() and checks meta.changes
    mockDB.run.mockResolvedValueOnce({ meta: { changes: 1 }, success: true });

    const res = await fetchRoute('DELETE', '/api/user/favorites/1', undefined, token);
    expect(res.status).toBe(200);
  });

  it('returns 404 when favorite does not exist', async () => {
    const token = await makeToken('user-1');
    mockDB.run.mockResolvedValueOnce({ meta: { changes: 0 }, success: true });

    const res = await fetchRoute('DELETE', '/api/user/favorites/999', undefined, token);
    expect(res.status).toBe(404);
  });

  it('returns 401 without authentication', async () => {
    const res = await fetchRoute('DELETE', '/api/user/favorites/1');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/user/notifications ─────────────────────────────────────────────
describe('GET /api/user/notifications', () => {
  it('returns 200 with subscriptions list', async () => {
    const token = await makeToken();
    mockDB.all.mockResolvedValueOnce({ results: [] });

    const res = await fetchRoute('GET', '/api/user/notifications', undefined, token);
    expect(res.status).toBe(200);
    const body = await res.json() as { subscriptions: unknown[] };
    expect(Array.isArray(body.subscriptions)).toBe(true);
  });

  it('returns 401 without authentication', async () => {
    const res = await fetchRoute('GET', '/api/user/notifications');
    expect(res.status).toBe(401);
  });
});

// ─── PUT /api/user/notifications/:lotteryId ───────────────────────────────────
describe('PUT /api/user/notifications/:lotteryId', () => {
  it('returns 200 when updating notification preference (pro user)', async () => {
    const token = await makeToken();
    // plan check: must be pro
    mockDB.first.mockResolvedValueOnce({ plan: 'pro' });
    mockDB.run.mockResolvedValueOnce({ success: true });

    const res = await fetchRoute('PUT', '/api/user/notifications/1', { notifyResults: true, notifyPredictionHit: false }, token);
    expect(res.status).toBe(200);
  });

  it('returns 403 for free users trying to set notifications', async () => {
    const token = await makeToken();
    mockDB.first.mockResolvedValueOnce({ plan: 'free' });

    const res = await fetchRoute('PUT', '/api/user/notifications/1', { notifyResults: true }, token);
    expect(res.status).toBe(403);
  });

  it('returns 401 without authentication', async () => {
    const res = await fetchRoute('PUT', '/api/user/notifications/1', { enabled: true });
    expect(res.status).toBe(401);
  });
});
