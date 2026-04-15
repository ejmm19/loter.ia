/**
 * Predictions API — unit tests (Vitest)
 *
 * Tests POST /api/predictions (generate) and GET /api/predictions (history).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signJwt } from '../services/auth';
import { generateStatisticalPrediction } from '../services/statistics';

const JWT_SECRET = 'test-secret-32-chars-long-enough!!';

vi.mock('../services/statistics');

const mockStatisticalResult = {
  suggestedNumbers: [5, 12, 23, 34, 41, 7],
  scores: [],
  hotNumbers: [5, 12],
  coldNumbers: [41],
  movingAverageTop: [5, 12, 23],
  combinationScore: 72,
  confidence: 65,
  method: 'statistical' as const,
};

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

async function makeUserToken(sub = 'user-1', role = 'user') {
  return signJwt({ sub, email: `${sub}@test.com`, role, type: 'access' }, JWT_SECRET);
}

const sampleDraws = [
  { id: 1, lottery_id: 1, draw_date: '2024-05-01', numbers: '[5,12,23,34,41,7]', special_numbers: null },
  { id: 2, lottery_id: 1, draw_date: '2024-05-08', numbers: '[3,9,17,28,36,44]', special_numbers: null },
];

beforeEach(() => {
  vi.resetAllMocks();
  mockDB.prepare.mockReturnThis();
  mockDB.bind.mockReturnThis();
  vi.mocked(generateStatisticalPrediction).mockReturnValue(mockStatisticalResult);
});

// ─── POST /api/predictions ────────────────────────────────────────────────────
describe('POST /api/predictions', () => {
  it('returns 200 with a prediction for a valid lotteryId (anonymous)', async () => {
    mockDB.first.mockResolvedValueOnce({ id: 1, name: 'Baloto', pick_count: 6, max_number: 45 });
    mockDB.all.mockResolvedValueOnce({ results: sampleDraws });

    const res = await fetchRoute('POST', '/api/predictions', { lotteryId: 1 });
    expect(res.status).toBe(200);

    const body = await res.json() as {
      lotteryId: number;
      statistical: { suggestedNumbers: number[] };
      disclaimer: string;
      generatedAt: string;
    };
    expect(body.lotteryId).toBe(1);
    expect(Array.isArray(body.statistical.suggestedNumbers)).toBe(true);
    expect(body.disclaimer).toBeTruthy();
    expect(body.generatedAt).toBeTruthy();
  });

  it('response includes lotteryId, lotteryName, pickCount, maxNumber, statistical, disclaimer', async () => {
    mockDB.first.mockResolvedValueOnce({ id: 1, name: 'Baloto', pick_count: 6, max_number: 45 });
    mockDB.all.mockResolvedValueOnce({ results: sampleDraws });

    const res = await fetchRoute('POST', '/api/predictions', { lotteryId: 1 });
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('lotteryId');
    expect(body).toHaveProperty('lotteryName');
    expect(body).toHaveProperty('pickCount');
    expect(body).toHaveProperty('maxNumber');
    expect(body).toHaveProperty('statistical');
    expect(body).toHaveProperty('disclaimer');
  });

  it('returns 400 for missing lotteryId', async () => {
    const res = await fetchRoute('POST', '/api/predictions', {});
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-integer lotteryId', async () => {
    const res = await fetchRoute('POST', '/api/predictions', { lotteryId: 'abc' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when lotteryId does not exist', async () => {
    mockDB.first.mockResolvedValueOnce(null);
    const res = await fetchRoute('POST', '/api/predictions', { lotteryId: 9999 });
    expect(res.status).toBe(404);
  });

  it('returns 422 when lottery has no draw history', async () => {
    mockDB.first.mockResolvedValueOnce({ id: 1, name: 'Baloto', pick_count: 6, max_number: 45 });
    mockDB.all.mockResolvedValueOnce({ results: [] });
    const res = await fetchRoute('POST', '/api/predictions', { lotteryId: 1 });
    expect(res.status).toBe(422);
  });

  it('saves prediction to history when authenticated', async () => {
    const token = await makeUserToken('user-1', 'user');
    mockDB.first.mockResolvedValueOnce({ id: 1, name: 'Baloto', pick_count: 6, max_number: 45 });
    mockDB.all.mockResolvedValueOnce({ results: sampleDraws });
    mockDB.run.mockResolvedValueOnce({ success: true });

    const res = await fetchRoute('POST', '/api/predictions', { lotteryId: 1 }, token);
    expect(res.status).toBe(200);
    expect(mockDB.run).toHaveBeenCalled();
  });
});

// ─── GET /api/predictions ─────────────────────────────────────────────────────
describe('GET /api/predictions', () => {
  it('returns 200 with a list of prediction objects for authenticated user', async () => {
    const token = await makeUserToken();
    mockDB.all.mockResolvedValueOnce({
      results: [
        { id: 1, lottery_id: 1, predicted_numbers: '[5,12,23]', confidence_score: 65, created_at: '2024-06-01T10:00:00Z' },
      ],
    });

    const res = await fetchRoute('GET', '/api/predictions', undefined, token);
    expect(res.status).toBe(200);
    const body = await res.json() as { predictions: { id: number; numbers: number[] }[] };
    expect(body.predictions).toHaveLength(1);
    expect(Array.isArray(body.predictions[0].numbers)).toBe(true);
  });

  it('returns 401 when no JWT is provided', async () => {
    const res = await fetchRoute('GET', '/api/predictions');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid JWT', async () => {
    const res = await fetchRoute('GET', '/api/predictions', undefined, 'not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('each prediction has lotteryId, numbers, confidenceScore, createdAt fields', async () => {
    const token = await makeUserToken();
    mockDB.all.mockResolvedValueOnce({
      results: [
        { id: 1, lottery_id: 1, predicted_numbers: '[5,12,23]', confidence_score: 65, created_at: '2024-06-01T10:00:00Z' },
      ],
    });

    const res = await fetchRoute('GET', '/api/predictions', undefined, token);
    const body = await res.json() as { predictions: Record<string, unknown>[] };
    const pred = body.predictions[0];
    expect(pred).toHaveProperty('lotteryId');
    expect(pred).toHaveProperty('numbers');
    expect(pred).toHaveProperty('confidenceScore');
    expect(pred).toHaveProperty('createdAt');
  });

  it('returns empty list when user has no prediction history', async () => {
    const token = await makeUserToken();
    mockDB.all.mockResolvedValueOnce({ results: [] });

    const res = await fetchRoute('GET', '/api/predictions', undefined, token);
    expect(res.status).toBe(200);
    const body = await res.json() as { predictions: unknown[] };
    expect(body.predictions).toHaveLength(0);
  });
});

// ─── Security ──────────────────────────────────────────────────────────────────
describe('Predictions security', () => {
  it('GET /api/predictions is protected — 401 without valid JWT', async () => {
    const res = await fetchRoute('GET', '/api/predictions');
    expect(res.status).toBe(401);
  });

  it('GET /api/predictions uses JWT sub for DB query, not a caller-supplied id', async () => {
    const token = await makeUserToken('user-a');
    mockDB.all.mockResolvedValueOnce({ results: [] });

    await fetchRoute('GET', '/api/predictions', undefined, token);

    const bindCalls = mockDB.bind.mock.calls.map((c: unknown[]) => c[0]);
    expect(bindCalls).toContain('user-a');
  });
});
