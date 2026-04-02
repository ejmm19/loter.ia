/**
 * User profile routes — Phase 3 (EJM-29)
 *
 * GET    /api/user/history           — prediction history with outcomes
 * GET    /api/user/stats             — aggregate stats (hits, accuracy, etc.)
 * GET    /api/user/favorites         — saved favorite numbers
 * POST   /api/user/favorites         — save a favorite number set
 * DELETE /api/user/favorites/:id     — delete a favorite
 * GET    /api/user/notifications     — email subscription preferences per lottery
 * PUT    /api/user/notifications/:lotteryId — update email subscription preferences
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { JwtPayload } from '../services/auth';

export const userRouter = new Hono<{ Bindings: Env; Variables: { user: JwtPayload } }>();

userRouter.use('*', requireAuth);

// ─── History ──────────────────────────────────────────────────────────────────

userRouter.get('/history', async (c) => {
  const jwtUser = c.get('user');
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
  const offset = Number(c.req.query('offset') ?? 0);
  const lotteryIdParam = c.req.query('lotteryId');

  const base = `
    SELECT p.id, p.lottery_id, l.name AS lottery_name,
           p.predicted_numbers, p.actual_numbers, p.matched_count,
           p.confidence_score, p.draw_date, p.created_at
    FROM predictions p
    JOIN lotteries l ON l.id = p.lottery_id
    WHERE p.user_id = ?
  `;

  const rows = lotteryIdParam
    ? await c.env.DB
        .prepare(`${base} AND p.lottery_id = ? ORDER BY p.created_at DESC LIMIT ? OFFSET ?`)
        .bind(jwtUser.sub, Number(lotteryIdParam), limit, offset)
        .all<HistoryRow>()
    : await c.env.DB
        .prepare(`${base} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`)
        .bind(jwtUser.sub, limit, offset)
        .all<HistoryRow>();

  return c.json({
    predictions: (rows.results ?? []).map(mapHistoryRow),
    limit,
    offset,
  });
});

// ─── Stats ────────────────────────────────────────────────────────────────────

userRouter.get('/stats', async (c) => {
  const jwtUser = c.get('user');

  const totalRow = await c.env.DB
    .prepare('SELECT COUNT(*) AS total FROM predictions WHERE user_id = ?')
    .bind(jwtUser.sub)
    .first<{ total: number }>();

  const resolvedRow = await c.env.DB
    .prepare(`
      SELECT COUNT(*) AS resolved,
             SUM(CASE WHEN matched_count > 0 THEN 1 ELSE 0 END) AS with_hits,
             AVG(matched_count) AS avg_matched,
             MAX(matched_count) AS best_match
      FROM predictions
      WHERE user_id = ? AND actual_numbers IS NOT NULL
    `)
    .bind(jwtUser.sub)
    .first<{ resolved: number; with_hits: number; avg_matched: number; best_match: number }>();

  const topLotteryRow = await c.env.DB
    .prepare(`
      SELECT l.name, COUNT(*) AS cnt
      FROM predictions p
      JOIN lotteries l ON l.id = p.lottery_id
      WHERE p.user_id = ?
      GROUP BY p.lottery_id
      ORDER BY cnt DESC
      LIMIT 1
    `)
    .bind(jwtUser.sub)
    .first<{ name: string; cnt: number }>();

  return c.json({
    totalPredictions: totalRow?.total ?? 0,
    resolvedPredictions: resolvedRow?.resolved ?? 0,
    predictionsWithHits: resolvedRow?.with_hits ?? 0,
    avgMatchedNumbers: resolvedRow?.avg_matched ? Math.round(resolvedRow.avg_matched * 100) / 100 : 0,
    bestMatch: resolvedRow?.best_match ?? 0,
    topLottery: topLotteryRow?.name ?? null,
  });
});

// ─── Favorites ────────────────────────────────────────────────────────────────

userRouter.get('/favorites', async (c) => {
  const jwtUser = c.get('user');
  const rows = await c.env.DB
    .prepare(`
      SELECT f.id, f.lottery_id, l.name AS lottery_name, f.numbers, f.label, f.created_at
      FROM user_favorites f
      JOIN lotteries l ON l.id = f.lottery_id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `)
    .bind(jwtUser.sub)
    .all<{ id: number; lottery_id: number; lottery_name: string; numbers: string; label: string | null; created_at: string }>();

  return c.json({
    favorites: (rows.results ?? []).map((r) => ({
      id: r.id,
      lotteryId: r.lottery_id,
      lotteryName: r.lottery_name,
      numbers: JSON.parse(r.numbers) as number[],
      label: r.label,
      createdAt: r.created_at,
    })),
  });
});

userRouter.post('/favorites', async (c) => {
  const jwtUser = c.get('user');

  // Check plan — Free allows up to 5 favorites
  const planRow = await c.env.DB
    .prepare('SELECT plan FROM users WHERE id = ?')
    .bind(jwtUser.sub)
    .first<{ plan: string }>();

  if (planRow?.plan !== 'pro') {
    const countRow = await c.env.DB
      .prepare('SELECT COUNT(*) AS cnt FROM user_favorites WHERE user_id = ?')
      .bind(jwtUser.sub)
      .first<{ cnt: number }>();
    if ((countRow?.cnt ?? 0) >= 5) {
      return c.json({ error: 'Free plan allows up to 5 favorites. Upgrade to Pro for unlimited.' }, 403);
    }
  }

  let body: { lotteryId: number; numbers: number[]; label?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  if (!body.lotteryId || !Array.isArray(body.numbers) || body.numbers.length === 0) {
    return c.json({ error: 'lotteryId and numbers are required' }, 400);
  }

  const result = await c.env.DB
    .prepare(`
      INSERT INTO user_favorites (user_id, lottery_id, numbers, label)
      VALUES (?, ?, ?, ?)
    `)
    .bind(jwtUser.sub, body.lotteryId, JSON.stringify(body.numbers), body.label ?? null)
    .run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

userRouter.delete('/favorites/:id', async (c) => {
  const jwtUser = c.get('user');
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid id' }, 400);

  const result = await c.env.DB
    .prepare('DELETE FROM user_favorites WHERE id = ? AND user_id = ?')
    .bind(id, jwtUser.sub)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Favorite not found' }, 404);
  }

  return c.json({ deleted: true });
});

// ─── Email notification preferences ──────────────────────────────────────────

userRouter.get('/notifications', async (c) => {
  const jwtUser = c.get('user');
  const rows = await c.env.DB
    .prepare(`
      SELECT es.lottery_id, l.name AS lottery_name,
             es.notify_results, es.notify_prediction_hit
      FROM email_subscriptions es
      JOIN lotteries l ON l.id = es.lottery_id
      WHERE es.user_id = ?
    `)
    .bind(jwtUser.sub)
    .all<{ lottery_id: number; lottery_name: string; notify_results: number; notify_prediction_hit: number }>();

  return c.json({
    subscriptions: (rows.results ?? []).map((r) => ({
      lotteryId: r.lottery_id,
      lotteryName: r.lottery_name,
      notifyResults: r.notify_results === 1,
      notifyPredictionHit: r.notify_prediction_hit === 1,
    })),
  });
});

userRouter.put('/notifications/:lotteryId', async (c) => {
  const jwtUser = c.get('user');

  // Email notifications are a Pro feature
  const planRow = await c.env.DB
    .prepare('SELECT plan FROM users WHERE id = ?')
    .bind(jwtUser.sub)
    .first<{ plan: string }>();
  if (planRow?.plan !== 'pro') {
    return c.json({ error: 'Email notifications require a Pro plan.' }, 403);
  }

  const lotteryId = Number(c.req.param('lotteryId'));
  if (!Number.isInteger(lotteryId)) return c.json({ error: 'Invalid lotteryId' }, 400);
  let body: { notifyResults?: boolean; notifyPredictionHit?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  await c.env.DB
    .prepare(`
      INSERT INTO email_subscriptions (user_id, lottery_id, notify_results, notify_prediction_hit)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, lottery_id) DO UPDATE
        SET notify_results = excluded.notify_results,
            notify_prediction_hit = excluded.notify_prediction_hit
    `)
    .bind(
      jwtUser.sub,
      lotteryId,
      body.notifyResults !== false ? 1 : 0,
      body.notifyPredictionHit !== false ? 1 : 0
    )
    .run();

  return c.json({ updated: true });
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryRow {
  id: number;
  lottery_id: number;
  lottery_name: string;
  predicted_numbers: string;
  actual_numbers: string | null;
  matched_count: number | null;
  confidence_score: number | null;
  draw_date: string | null;
  created_at: string;
}

function mapHistoryRow(r: HistoryRow) {
  return {
    id: r.id,
    lotteryId: r.lottery_id,
    lotteryName: r.lottery_name,
    predictedNumbers: JSON.parse(r.predicted_numbers) as number[],
    actualNumbers: r.actual_numbers ? (JSON.parse(r.actual_numbers) as number[]) : null,
    matchedCount: r.matched_count,
    confidenceScore: r.confidence_score,
    drawDate: r.draw_date,
    createdAt: r.created_at,
  };
}
