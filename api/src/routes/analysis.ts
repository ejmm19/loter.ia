/**
 * Analysis API routes — Phase 2a (EJM-27)
 *
 * GET /api/analysis/:lotteryId/frequency     — raw number frequency
 * GET /api/analysis/:lotteryId/hot-cold      — hot vs cold numbers
 * GET /api/analysis/:lotteryId/pairs         — frequent pairs & triplets
 * GET /api/analysis/:lotteryId/distribution  — distribution by draw position
 */

import { Hono } from 'hono';

export const analysisRouter = new Hono<{ Bindings: Env }>();

// ── helpers ──────────────────────────────────────────────────────────────────

function parseNumbers(raw: string): number[] {
  try {
    return JSON.parse(raw) as number[];
  } catch {
    return [];
  }
}

function buildDateFilter(
  from: string | undefined,
  to: string | undefined,
  params: (number | string)[],
): string {
  let clause = '';
  if (from) { clause += ' AND draw_date >= ?'; params.push(from); }
  if (to)   { clause += ' AND draw_date <= ?'; params.push(to); }
  return clause;
}

// ── GET /api/analysis/:lotteryId/frequency ───────────────────────────────────
analysisRouter.get('/:lotteryId/frequency', async (c) => {
  const lotteryId = Number(c.req.param('lotteryId'));
  if (!Number.isInteger(lotteryId)) return c.json({ error: 'Invalid lotteryId' }, 400);

  const from  = c.req.query('from');
  const to    = c.req.query('to');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '100'), 500);

  const params: (number | string)[] = [lotteryId];
  const dateFilter = buildDateFilter(from, to, params);

  const { results } = await c.env.DB.prepare(
    `SELECT numbers FROM draws WHERE lottery_id = ?${dateFilter} ORDER BY draw_date DESC`
  ).bind(...params).all<{ numbers: string }>();

  if (results.length === 0) return c.json({ frequency: [], totalDraws: 0 });

  const freq: Record<number, number> = {};
  for (const row of results) {
    for (const n of parseNumbers(row.numbers)) {
      freq[n] = (freq[n] ?? 0) + 1;
    }
  }

  const totalDraws = results.length;
  const frequency = Object.entries(freq)
    .map(([num, count]) => ({
      number: parseInt(num),
      count,
      percentage: Math.round((count / totalDraws) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return c.json({ frequency, totalDraws });
});

// ── GET /api/analysis/:lotteryId/hot-cold ────────────────────────────────────
analysisRouter.get('/:lotteryId/hot-cold', async (c) => {
  const lotteryId = Number(c.req.param('lotteryId'));
  if (!Number.isInteger(lotteryId)) return c.json({ error: 'Invalid lotteryId' }, 400);

  const recentN = Math.min(parseInt(c.req.query('recent') ?? '20'), 100);

  const { results: allDraws } = await c.env.DB.prepare(
    'SELECT numbers FROM draws WHERE lottery_id = ? ORDER BY draw_date DESC'
  ).bind(lotteryId).all<{ numbers: string }>();

  if (allDraws.length === 0) return c.json({ hot: [], cold: [], neutral: [], totalDraws: 0, recentDraws: 0 });

  const recentDraws = allDraws.slice(0, recentN);
  const totalDraws  = allDraws.length;

  // Historical and recent frequency maps
  const histFreq:   Record<number, number> = {};
  const recentFreq: Record<number, number> = {};

  for (const row of allDraws) {
    for (const n of parseNumbers(row.numbers)) {
      histFreq[n] = (histFreq[n] ?? 0) + 1;
    }
  }
  for (const row of recentDraws) {
    for (const n of parseNumbers(row.numbers)) {
      recentFreq[n] = (recentFreq[n] ?? 0) + 1;
    }
  }

  const allNumbers = Object.keys(histFreq).map(Number);
  const scored = allNumbers.map(n => {
    const histRate   = (histFreq[n]   ?? 0) / totalDraws;
    const recentRate = (recentFreq[n] ?? 0) / Math.max(recentN, 1);
    // score > 0 means appearing more often recently (hot), < 0 means less (cold)
    const score = recentRate - histRate;
    return {
      number:          n,
      recentCount:     recentFreq[n] ?? 0,
      historicalCount: histFreq[n] ?? 0,
      histRate:        Math.round(histRate * 1000) / 10,
      recentRate:      Math.round(recentRate * 1000) / 10,
      score:           Math.round(score * 1000) / 1000,
    };
  }).sort((a, b) => b.score - a.score);

  const topN    = Math.max(5, Math.ceil(allNumbers.length * 0.15));
  const hot     = scored.slice(0, topN);
  const cold    = [...scored].slice(-topN).reverse();
  const neutral = scored.slice(topN, scored.length - topN);

  return c.json({ hot, cold, neutral, totalDraws, recentDraws: recentN });
});

// ── GET /api/analysis/:lotteryId/pairs ───────────────────────────────────────
analysisRouter.get('/:lotteryId/pairs', async (c) => {
  const lotteryId = Number(c.req.param('lotteryId'));
  if (!Number.isInteger(lotteryId)) return c.json({ error: 'Invalid lotteryId' }, 400);

  const top  = Math.min(parseInt(c.req.query('top') ?? '20'), 100);
  const from = c.req.query('from');
  const to   = c.req.query('to');

  const params: (number | string)[] = [lotteryId];
  const dateFilter = buildDateFilter(from, to, params);

  const { results } = await c.env.DB.prepare(
    `SELECT numbers FROM draws WHERE lottery_id = ?${dateFilter}`
  ).bind(...params).all<{ numbers: string }>();

  if (results.length === 0) return c.json({ pairs: [], triplets: [], totalDraws: 0 });

  const pairFreq:    Record<string, number> = {};
  const tripletFreq: Record<string, number> = {};

  for (const row of results) {
    const nums = parseNumbers(row.numbers).sort((a, b) => a - b);

    for (let i = 0; i < nums.length - 1; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const key = `${nums[i]},${nums[j]}`;
        pairFreq[key] = (pairFreq[key] ?? 0) + 1;
      }
    }

    if (nums.length >= 3) {
      for (let i = 0; i < nums.length - 2; i++) {
        for (let j = i + 1; j < nums.length - 1; j++) {
          for (let k = j + 1; k < nums.length; k++) {
            const key = `${nums[i]},${nums[j]},${nums[k]}`;
            tripletFreq[key] = (tripletFreq[key] ?? 0) + 1;
          }
        }
      }
    }
  }

  const totalDraws = results.length;

  const pairs = Object.entries(pairFreq)
    .map(([key, count]) => ({
      numbers:    key.split(',').map(Number),
      count,
      percentage: Math.round((count / totalDraws) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top);

  const triplets = Object.entries(tripletFreq)
    .map(([key, count]) => ({
      numbers:    key.split(',').map(Number),
      count,
      percentage: Math.round((count / totalDraws) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top);

  return c.json({ pairs, triplets, totalDraws });
});

// ── GET /api/analysis/:lotteryId/distribution ────────────────────────────────
analysisRouter.get('/:lotteryId/distribution', async (c) => {
  const lotteryId = Number(c.req.param('lotteryId'));
  if (!Number.isInteger(lotteryId)) return c.json({ error: 'Invalid lotteryId' }, 400);

  const from = c.req.query('from');
  const to   = c.req.query('to');

  const lottery = await c.env.DB.prepare(
    'SELECT pick_count, max_number, min_number FROM lotteries WHERE id = ?'
  ).bind(lotteryId).first<{ pick_count: number; max_number: number; min_number: number }>();
  if (!lottery) return c.json({ error: 'Lottery not found' }, 404);

  const params: (number | string)[] = [lotteryId];
  const dateFilter = buildDateFilter(from, to, params);

  const { results } = await c.env.DB.prepare(
    `SELECT numbers FROM draws WHERE lottery_id = ?${dateFilter} ORDER BY draw_date DESC`
  ).bind(...params).all<{ numbers: string }>();

  if (results.length === 0) return c.json({ positions: [], totalDraws: 0, pickCount: lottery.pick_count });

  const totalDraws = results.length;
  const positions: Array<{
    position: number;
    topNumbers: Array<{ number: number; count: number; percentage: number }>;
  }> = [];

  for (let pos = 0; pos < lottery.pick_count; pos++) {
    const posFreq: Record<number, number> = {};
    for (const row of results) {
      const nums = parseNumbers(row.numbers);
      if (nums[pos] !== undefined) {
        posFreq[nums[pos]] = (posFreq[nums[pos]] ?? 0) + 1;
      }
    }
    const topNumbers = Object.entries(posFreq)
      .map(([n, count]) => ({
        number:     parseInt(n),
        count,
        percentage: Math.round((count / totalDraws) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    positions.push({ position: pos + 1, topNumbers });
  }

  return c.json({ positions, totalDraws, pickCount: lottery.pick_count });
});
