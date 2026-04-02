/**
 * Lotteries API — unit tests (Vitest)
 *
 * Contract tests for Phase 2a (EJM-27).
 * Tests the lotteries routes: GET /, GET /:id, GET /:id/draws,
 * GET /:id/draws/latest, POST /:id/draws (admin)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signJwt } from '../services/auth';

const JWT_SECRET = 'test-secret-32-chars-long-enough!!';

// ─── Mock DB ──────────────────────────────────────────────────────────────────
const mockDB = {
  prepare: vi.fn(),
  bind: vi.fn(),
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

async function makeAdminToken() {
  return signJwt({ sub: 'admin-1', email: 'admin@test.com', role: 'admin', type: 'access' }, JWT_SECRET);
}

async function makeUserToken() {
  return signJwt({ sub: 'user-1', email: 'user@test.com', role: 'user', type: 'access' }, JWT_SECRET);
}

beforeEach(() => {
  vi.resetAllMocks();
  mockDB.prepare.mockReturnThis();
  mockDB.bind.mockReturnThis();
});

// ─── GET /api/lotteries ───────────────────────────────────────────────────────
describe('GET /api/lotteries', () => {
  it('returns 200 with list of lotteries', async () => {
    mockDB.all.mockResolvedValueOnce({
      results: [
        { id: 1, name: 'Baloto', country: 'CO', pick_count: 6, max_number: 45, draw_schedule: 'Wed,Sat' },
        { id: 2, name: 'Chance', country: 'CO', pick_count: 4, max_number: 9999, draw_schedule: 'Daily' },
      ],
    });

    const res = await fetchRoute('GET', '/api/lotteries');
    expect(res.status).toBe(200);

    const body = await res.json() as { lotteries: { id: number; name: string; country: string }[] };
    expect(body.lotteries).toHaveLength(2);
    expect(body.lotteries[0]).toMatchObject({ id: 1, name: 'Baloto', country: 'CO' });
  });

  it('response includes id, name, country, pick_count, max_number, draw_schedule fields', async () => {
    mockDB.all.mockResolvedValueOnce({
      results: [
        { id: 1, name: 'Baloto', country: 'CO', pick_count: 6, max_number: 45, draw_schedule: 'Wed,Sat' },
      ],
    });

    const res = await fetchRoute('GET', '/api/lotteries');
    const body = await res.json() as { lotteries: Record<string, unknown>[] };
    const lottery = body.lotteries[0];
    expect(lottery).toHaveProperty('id');
    expect(lottery).toHaveProperty('name');
    expect(lottery).toHaveProperty('country');
    expect(lottery).toHaveProperty('pick_count');
    expect(lottery).toHaveProperty('max_number');
    expect(lottery).toHaveProperty('draw_schedule');
  });

  it('returns an empty list when no lotteries exist', async () => {
    mockDB.all.mockResolvedValueOnce({ results: [] });

    const res = await fetchRoute('GET', '/api/lotteries');
    expect(res.status).toBe(200);
    const body = await res.json() as { lotteries: unknown[] };
    expect(body.lotteries).toHaveLength(0);
  });
});

// ─── GET /api/lotteries/:id ───────────────────────────────────────────────────
describe('GET /api/lotteries/:id', () => {
  it('returns 200 with lottery data for a valid id', async () => {
    mockDB.first.mockResolvedValueOnce({
      id: 1, name: 'Baloto', country: 'CO', pick_count: 6, max_number: 45, draw_schedule: 'Wed,Sat', active: 1,
    });

    const res = await fetchRoute('GET', '/api/lotteries/1');
    expect(res.status).toBe(200);
    const body = await res.json() as { lottery: { id: number; name: string } };
    expect(body.lottery.id).toBe(1);
    expect(body.lottery.name).toBe('Baloto');
  });

  it('returns 404 for unknown lotteryId', async () => {
    mockDB.first.mockResolvedValueOnce(null);

    const res = await fetchRoute('GET', '/api/lotteries/9999');
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBeTruthy();
  });

  it('returns 400 for a non-integer id', async () => {
    const res = await fetchRoute('GET', '/api/lotteries/not-a-number');
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/lotteries/:id/draws ─────────────────────────────────────────────
describe('GET /api/lotteries/:id/draws', () => {
  it('returns paginated draws sorted by drawDate desc', async () => {
    mockDB.all.mockResolvedValueOnce({
      results: [
        { id: 10, lottery_id: 1, draw_date: '2024-06-08', numbers: '[5,12,23,34,41,7]', special_numbers: null, jackpot_amount: 50000 },
        { id: 9,  lottery_id: 1, draw_date: '2024-06-05', numbers: '[1,2,3,4,5,6]',     special_numbers: null, jackpot_amount: null },
      ],
    });

    const res = await fetchRoute('GET', '/api/lotteries/1/draws');
    expect(res.status).toBe(200);
    const body = await res.json() as { draws: { id: number; numbers: number[] }[] };
    expect(body.draws).toHaveLength(2);
    expect(Array.isArray(body.draws[0].numbers)).toBe(true);
    expect(body.draws[0].numbers).toEqual([5, 12, 23, 34, 41, 7]);
  });

  it('supports ?limit and ?offset query params', async () => {
    mockDB.all.mockResolvedValueOnce({ results: [] });

    const res = await fetchRoute('GET', '/api/lotteries/1/draws?limit=5&offset=10');
    expect(res.status).toBe(200);
    const body = await res.json() as { limit: number; offset: number };
    expect(body.limit).toBe(5);
    expect(body.offset).toBe(10);
  });

  it('each draw has draw_date, numbers, jackpot_amount fields', async () => {
    mockDB.all.mockResolvedValueOnce({
      results: [
        { id: 1, lottery_id: 1, draw_date: '2024-06-08', numbers: '[5,12,23]', special_numbers: null, jackpot_amount: 1000 },
      ],
    });

    const res = await fetchRoute('GET', '/api/lotteries/1/draws');
    const body = await res.json() as { draws: Record<string, unknown>[] };
    const draw = body.draws[0];
    expect(draw).toHaveProperty('draw_date');
    expect(draw).toHaveProperty('numbers');
    expect(draw).toHaveProperty('jackpot_amount');
  });
});

// ─── GET /api/lotteries/:id/draws/latest ─────────────────────────────────────
describe('GET /api/lotteries/:id/draws/latest', () => {
  it('returns the most recent draw', async () => {
    mockDB.first.mockResolvedValueOnce({
      id: 10, lottery_id: 1, draw_date: '2024-06-08', numbers: '[5,12,23,34,41,7]', special_numbers: null, jackpot_amount: 50000,
    });

    const res = await fetchRoute('GET', '/api/lotteries/1/draws/latest');
    expect(res.status).toBe(200);
    const body = await res.json() as { draw: { numbers: number[] } };
    expect(body.draw.numbers).toEqual([5, 12, 23, 34, 41, 7]);
  });

  it('returns 404 when no draws exist for that lottery', async () => {
    mockDB.first.mockResolvedValueOnce(null);

    const res = await fetchRoute('GET', '/api/lotteries/1/draws/latest');
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/lotteries/:id/draws ───────────────────────────────────────────
describe('POST /api/lotteries/:id/draws', () => {
  it('returns 401 when no JWT is provided', async () => {
    const res = await fetchRoute('POST', '/api/lotteries/1/draws', { draw_date: '2024-06-10', numbers: [1, 2, 3] });
    expect(res.status).toBe(401);
  });

  it('returns 403 when called with a non-admin JWT', async () => {
    const token = await makeUserToken();
    const res = await fetchRoute(
      'POST',
      '/api/lotteries/1/draws',
      { draw_date: '2024-06-10', numbers: [1, 2, 3] },
      token
    );
    expect(res.status).toBe(403);
  });

  it('creates a draw and returns 201 when called with admin JWT', async () => {
    const token = await makeAdminToken();
    mockDB.first.mockResolvedValueOnce({ id: 1 });
    mockDB.run.mockResolvedValueOnce({ meta: { last_row_id: 42 } });

    const res = await fetchRoute(
      'POST',
      '/api/lotteries/1/draws',
      { draw_date: '2024-06-10', numbers: [5, 12, 23, 34, 41, 7] },
      token
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { draw: { id: number; numbers: number[] } };
    expect(body.draw.numbers).toEqual([5, 12, 23, 34, 41, 7]);
  });

  it('returns 400 when draw_date is missing', async () => {
    const token = await makeAdminToken();
    const res = await fetchRoute('POST', '/api/lotteries/1/draws', { numbers: [1, 2, 3] }, token);
    expect(res.status).toBe(400);
  });

  it('returns 400 when numbers array is missing', async () => {
    const token = await makeAdminToken();
    const res = await fetchRoute('POST', '/api/lotteries/1/draws', { draw_date: '2024-06-10' }, token);
    expect(res.status).toBe(400);
  });

  it('returns 404 when lottery does not exist', async () => {
    const token = await makeAdminToken();
    mockDB.first.mockResolvedValueOnce(null);

    const res = await fetchRoute(
      'POST',
      '/api/lotteries/9999/draws',
      { draw_date: '2024-06-10', numbers: [1, 2, 3] },
      token
    );
    expect(res.status).toBe(404);
  });
});

// ─── SQL injection prevention ──────────────────────────────────────────────────
describe('D1 query safety', () => {
  it('lotteryId path param is validated to integer before DB query', async () => {
    const res = await fetchRoute('GET', '/api/lotteries/1%20OR%201%3D1');
    expect(res.status).toBe(400);
    expect(mockDB.first).not.toHaveBeenCalled();
  });

  it('uses prepared statements (bind for params, not interpolation)', async () => {
    mockDB.all.mockResolvedValueOnce({ results: [] });

    await fetchRoute('GET', '/api/lotteries/1/draws');

    const prepareCall = mockDB.prepare.mock.calls[0]?.[0] as string;
    expect(prepareCall).toMatch(/\?/);
    expect(prepareCall).not.toMatch(/WHERE lottery_id = 1/);
  });
});
