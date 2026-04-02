/**
 * Analysis API — unit tests (Vitest)
 *
 * Contract tests for Phase 2a analysis endpoints (EJM-27).
 * Tests all 4 GET routes: frequency, hot-cold, pairs, distribution.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

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

async function fetchRoute(path: string) {
  const { default: app } = await import('../index');
  const req = new Request(`http://localhost${path}`, { method: 'GET' });
  return app.fetch(req, mockEnv as unknown as Env);
}

const sampleDraws = [
  { numbers: '[5,12,23,34,41,7]' },
  { numbers: '[3,9,17,28,36,44]' },
  { numbers: '[5,12,18,25,33,41]' },
];

beforeEach(() => {
  vi.resetAllMocks();
  mockDB.prepare.mockReturnThis();
  mockDB.bind.mockReturnThis();
});

// ─── GET /api/analysis/:lotteryId/frequency ───────────────────────────────────
describe('GET /api/analysis/:lotteryId/frequency', () => {
  it('returns 200 with frequency array and totalDraws', async () => {
    mockDB.all.mockResolvedValueOnce({ results: sampleDraws });

    const res = await fetchRoute('/api/analysis/1/frequency');
    expect(res.status).toBe(200);
    const body = await res.json() as { frequency: { number: number; count: number; percentage: number }[]; totalDraws: number };
    expect(body.totalDraws).toBe(3);
    expect(Array.isArray(body.frequency)).toBe(true);
    expect(body.frequency.length).toBeGreaterThan(0);
  });

  it('each frequency entry has number, count, percentage', async () => {
    mockDB.all.mockResolvedValueOnce({ results: sampleDraws });

    const res = await fetchRoute('/api/analysis/1/frequency');
    const body = await res.json() as { frequency: Record<string, unknown>[] };
    const entry = body.frequency[0];
    expect(entry).toHaveProperty('number');
    expect(entry).toHaveProperty('count');
    expect(entry).toHaveProperty('percentage');
  });

  it('returns 200 with empty frequency when no draws exist', async () => {
    mockDB.all.mockResolvedValueOnce({ results: [] });

    const res = await fetchRoute('/api/analysis/1/frequency');
    expect(res.status).toBe(200);
    const body = await res.json() as { frequency: unknown[]; totalDraws: number };
    expect(body.frequency).toHaveLength(0);
    expect(body.totalDraws).toBe(0);
  });

  it('returns 400 for non-integer lotteryId', async () => {
    const res = await fetchRoute('/api/analysis/abc/frequency');
    expect(res.status).toBe(400);
  });

  it('results are sorted descending by count (most frequent first)', async () => {
    // number 5 and 12 appear in 2 of 3 draws — they should rank above others
    mockDB.all.mockResolvedValueOnce({ results: sampleDraws });

    const res = await fetchRoute('/api/analysis/1/frequency');
    const body = await res.json() as { frequency: { number: number; count: number }[] };
    for (let i = 1; i < body.frequency.length; i++) {
      expect(body.frequency[i - 1].count).toBeGreaterThanOrEqual(body.frequency[i].count);
    }
  });
});

// ─── GET /api/analysis/:lotteryId/hot-cold ────────────────────────────────────
describe('GET /api/analysis/:lotteryId/hot-cold', () => {
  it('returns 200 with hot, cold, neutral arrays', async () => {
    mockDB.all.mockResolvedValueOnce({ results: sampleDraws });

    const res = await fetchRoute('/api/analysis/1/hot-cold');
    expect(res.status).toBe(200);
    const body = await res.json() as { hot: unknown[]; cold: unknown[]; neutral: unknown[]; totalDraws: number };
    expect(Array.isArray(body.hot)).toBe(true);
    expect(Array.isArray(body.cold)).toBe(true);
    expect(Array.isArray(body.neutral)).toBe(true);
    expect(body.totalDraws).toBe(3);
  });

  it('each hot/cold entry has number, recentCount, historicalCount', async () => {
    mockDB.all.mockResolvedValueOnce({ results: sampleDraws });

    const res = await fetchRoute('/api/analysis/1/hot-cold');
    const body = await res.json() as { hot: Record<string, unknown>[] };
    if (body.hot.length > 0) {
      expect(body.hot[0]).toHaveProperty('number');
      expect(body.hot[0]).toHaveProperty('recentCount');
      expect(body.hot[0]).toHaveProperty('historicalCount');
    }
  });

  it('returns empty arrays when no draws exist', async () => {
    mockDB.all.mockResolvedValueOnce({ results: [] });

    const res = await fetchRoute('/api/analysis/1/hot-cold');
    expect(res.status).toBe(200);
    const body = await res.json() as { hot: unknown[]; cold: unknown[] };
    expect(body.hot).toHaveLength(0);
    expect(body.cold).toHaveLength(0);
  });

  it('returns 400 for non-integer lotteryId', async () => {
    const res = await fetchRoute('/api/analysis/abc/hot-cold');
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/analysis/:lotteryId/pairs ──────────────────────────────────────
describe('GET /api/analysis/:lotteryId/pairs', () => {
  it('returns 200 with pairs and triplets arrays', async () => {
    mockDB.all.mockResolvedValueOnce({ results: sampleDraws });

    const res = await fetchRoute('/api/analysis/1/pairs');
    expect(res.status).toBe(200);
    const body = await res.json() as { pairs: unknown[]; triplets: unknown[]; totalDraws: number };
    expect(Array.isArray(body.pairs)).toBe(true);
    expect(Array.isArray(body.triplets)).toBe(true);
    expect(body.totalDraws).toBe(3);
  });

  it('each pair entry has numbers (array), count, percentage', async () => {
    mockDB.all.mockResolvedValueOnce({ results: sampleDraws });

    const res = await fetchRoute('/api/analysis/1/pairs');
    const body = await res.json() as { pairs: Record<string, unknown>[] };
    expect(body.pairs.length).toBeGreaterThan(0);
    const pair = body.pairs[0];
    expect(Array.isArray(pair.numbers)).toBe(true);
    expect((pair.numbers as number[]).length).toBe(2);
    expect(pair).toHaveProperty('count');
    expect(pair).toHaveProperty('percentage');
  });

  it('returns 200 with empty arrays when no draws exist', async () => {
    mockDB.all.mockResolvedValueOnce({ results: [] });

    const res = await fetchRoute('/api/analysis/1/pairs');
    expect(res.status).toBe(200);
    const body = await res.json() as { pairs: unknown[] };
    expect(body.pairs).toHaveLength(0);
  });

  it('returns 400 for non-integer lotteryId', async () => {
    const res = await fetchRoute('/api/analysis/abc/pairs');
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/analysis/:lotteryId/distribution ───────────────────────────────
describe('GET /api/analysis/:lotteryId/distribution', () => {
  it('returns 200 with positions array and pickCount', async () => {
    mockDB.first.mockResolvedValueOnce({ pick_count: 6, max_number: 45, min_number: 1 });
    mockDB.all.mockResolvedValueOnce({ results: sampleDraws });

    const res = await fetchRoute('/api/analysis/1/distribution');
    expect(res.status).toBe(200);
    const body = await res.json() as { positions: unknown[]; totalDraws: number; pickCount: number };
    expect(body.pickCount).toBe(6);
    expect(body.positions).toHaveLength(6);
    expect(body.totalDraws).toBe(3);
  });

  it('each position entry has position number and topNumbers array', async () => {
    mockDB.first.mockResolvedValueOnce({ pick_count: 6, max_number: 45, min_number: 1 });
    mockDB.all.mockResolvedValueOnce({ results: sampleDraws });

    const res = await fetchRoute('/api/analysis/1/distribution');
    const body = await res.json() as { positions: Record<string, unknown>[] };
    const pos = body.positions[0];
    expect(pos).toHaveProperty('position');
    expect(Array.isArray(pos.topNumbers)).toBe(true);
  });

  it('returns 404 when lottery does not exist', async () => {
    mockDB.first.mockResolvedValueOnce(null);

    const res = await fetchRoute('/api/analysis/9999/distribution');
    expect(res.status).toBe(404);
  });

  it('returns 200 with empty positions when no draws', async () => {
    mockDB.first.mockResolvedValueOnce({ pick_count: 6, max_number: 45, min_number: 1 });
    mockDB.all.mockResolvedValueOnce({ results: [] });

    const res = await fetchRoute('/api/analysis/1/distribution');
    expect(res.status).toBe(200);
    const body = await res.json() as { positions: unknown[] };
    expect(body.positions).toHaveLength(0);
  });

  it('returns 400 for non-integer lotteryId', async () => {
    const res = await fetchRoute('/api/analysis/abc/distribution');
    expect(res.status).toBe(400);
  });
});
