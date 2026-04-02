/**
 * Lotteries API — unit tests (Vitest)
 *
 * Contract tests for Phase 2a (EJM-27).
 * All cases are .todo until the route is implemented.
 */

import { describe, it } from 'vitest';

// ─── GET /api/lotteries ───────────────────────────────────────────────────────
describe('GET /api/lotteries', () => {
  it.todo('returns 200 with list of supported lotteries (Baloto, Chance, etc.)');

  it.todo('response includes id, name, country, drawDays fields');
});

// ─── GET /api/lotteries/:id/results ──────────────────────────────────────────
describe('GET /api/lotteries/:id/results', () => {
  it.todo('returns paginated results sorted by drawDate desc');

  it.todo('supports ?page and ?limit query params');

  it.todo('returns 404 for unknown lotteryId');

  it.todo('each result has drawDate, numbers[], jackpot fields');
});

// ─── POST /api/lotteries/ingest (Cron Trigger) ───────────────────────────────
describe('POST /api/lotteries/ingest', () => {
  it.todo('deduplicates draws that already exist in D1');

  it.todo('normalises number arrays to ascending order');

  it.todo('rejects draws with duplicate numbers');

  it.todo('is only accessible via Cron Trigger (not exposed publicly)');
});

// ─── SQL Injection prevention ─────────────────────────────────────────────────
describe('D1 query safety', () => {
  it.todo('lotteryId path param is used via prepared statement, not interpolation');

  it.todo('search query param does not allow SQL injection');
});
