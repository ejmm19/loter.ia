/**
 * Plan gate middleware — Phase 3 (EJM-29)
 *
 * Enforces per-plan rate limits before the predictions route handler runs.
 *
 * Free plan:  3 AI-assisted predictions per calendar day (UTC)
 * Pro plan:   unlimited
 *
 * Usage:
 *   predictionsRouter.post('/', planGate, async (c) => { ... });
 */

import { Context, Next } from 'hono';
import { JwtPayload } from '../services/auth';

const FREE_DAILY_LIMIT = 3;

export async function planGate(
  c: Context<{ Bindings: Env; Variables: { user?: JwtPayload } }>,
  next: Next
): Promise<Response | void> {
  // Anonymous requests are never limited here (handled at caller)
  const user = c.get('user');
  if (!user) {
    return next();
  }

  const userId = user.sub;

  // Look up user's plan
  const userRow = await c.env.DB
    .prepare('SELECT plan FROM users WHERE id = ?')
    .bind(userId)
    .first<{ plan: string }>();

  if (userRow?.plan === 'pro') {
    return next();
  }

  // Free plan — check daily usage
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD UTC

  const usageRow = await c.env.DB
    .prepare('SELECT count FROM prediction_usage WHERE user_id = ? AND usage_date = ?')
    .bind(userId, today)
    .first<{ count: number }>();

  const currentCount = usageRow?.count ?? 0;

  if (currentCount >= FREE_DAILY_LIMIT) {
    return c.json(
      {
        error: `Plan gratuito: límite de ${FREE_DAILY_LIMIT} predicciones por día alcanzado. Actualiza a Pro para predicciones ilimitadas.`,
        limitReached: true,
        plan: 'free',
        dailyLimit: FREE_DAILY_LIMIT,
        resetAt: `${today}T23:59:59Z`,
      },
      429
    );
  }

  // Increment counter (upsert)
  await c.env.DB
    .prepare(`
      INSERT INTO prediction_usage (user_id, usage_date, count)
      VALUES (?, ?, 1)
      ON CONFLICT(user_id, usage_date) DO UPDATE SET count = count + 1
    `)
    .bind(userId, today)
    .run();

  return next();
}
