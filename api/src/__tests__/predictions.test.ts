/**
 * Predictions API — unit tests (Vitest)
 *
 * Contract tests for Phase 2b (EJM-28).
 * All cases are .todo until the route is implemented.
 */

import { describe, it } from 'vitest';

// ─── GET /api/predictions ─────────────────────────────────────────────────────
describe('GET /api/predictions', () => {
  it.todo('returns 200 with a list of prediction objects for authenticated user');

  it.todo('returns 401 when no JWT is provided');

  it.todo('each prediction has lotteryId, numbers[], generatedAt fields');
});

// ─── POST /api/predictions/generate ──────────────────────────────────────────
describe('POST /api/predictions/generate', () => {
  it.todo('calls OpenAI API and returns generated numbers');

  it.todo('returns 402 when user is on free plan and has exceeded quota');

  it.todo('returns 503 gracefully when OpenAI is unreachable');

  it.todo('does not leak OpenAI API key in the response');
});

// ─── Security ─────────────────────────────────────────────────────────────────
describe('Predictions security', () => {
  it.todo('prediction endpoint is protected — 401 without valid JWT');

  it.todo('user A cannot read predictions of user B');
});
