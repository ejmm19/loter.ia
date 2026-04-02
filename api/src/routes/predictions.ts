/**
 * Predictions API router
 * POST /api/predictions          — generate predictions for a lottery (optionally authenticated)
 * GET  /api/predictions          — list user's prediction history (requires auth)
 *
 * Phase 2b: Motor de predicción AI (EJM-28)
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { planGate } from '../middleware/plan-gate';
import { JwtPayload } from '../services/auth';
import { generateStatisticalPrediction, DrawResult } from '../services/statistics';
import { getOpenAIPrediction } from '../services/openai';

interface PredictionRequest {
  lotteryId: number;
  useAI?: boolean;
}

interface CombinedPrediction {
  lotteryId: number;
  lotteryName: string;
  pickCount: number;
  maxNumber: number;
  statistical: Awaited<ReturnType<typeof generateStatisticalPrediction>>;
  ai?: Awaited<ReturnType<typeof getOpenAIPrediction>>;
  combined: {
    suggestedNumbers: number[];
    confidence: number;
    explanation: string;
  };
  disclaimer: string;
  generatedAt: string;
}

export const predictionsRouter = new Hono<{ Bindings: Env; Variables: { user?: JwtPayload } }>();

/**
 * Try to extract userId from JWT without requiring auth.
 * Returns null if not authenticated (anonymous predictions are allowed).
 */
async function tryGetUserId(c: { req: { header: (k: string) => string | undefined }; env: Env }): Promise<string | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(c.env.JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sig = Uint8Array.from(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
      (ch) => ch.charCodeAt(0)
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sig,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) return null;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
    if (payload.exp < Date.now() / 1000) return null;
    if (payload.type !== 'access') return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/**
 * Fetch draw history from D1, sorted oldest-first.
 */
async function fetchDrawHistory(db: D1Database, lotteryId: number, limit = 200): Promise<DrawResult[]> {
  const rows = await db
    .prepare(`
      SELECT draw_date, numbers, special_numbers
      FROM draws
      WHERE lottery_id = ?
      ORDER BY draw_date ASC
      LIMIT ?
    `)
    .bind(lotteryId, limit)
    .all<{ draw_date: string; numbers: string; special_numbers: string | null }>();

  return (rows.results ?? []).map((row) => ({
    drawDate: row.draw_date,
    numbers: JSON.parse(row.numbers) as number[],
    specialNumbers: row.special_numbers ? (JSON.parse(row.special_numbers) as number[]) : undefined,
  }));
}

async function fetchLotteryMeta(
  db: D1Database,
  lotteryId: number
): Promise<{ id: number; name: string; pickCount: number; maxNumber: number } | null> {
  const row = await db
    .prepare('SELECT id, name, pick_count, max_number FROM lotteries WHERE id = ?')
    .bind(lotteryId)
    .first<{ id: number; name: string; pick_count: number; max_number: number }>();

  if (!row) return null;
  return { id: row.id, name: row.name, pickCount: row.pick_count, maxNumber: row.max_number };
}

async function savePredictionToHistory(
  db: D1Database,
  userId: string | null,
  lotteryId: number,
  prediction: CombinedPrediction
): Promise<void> {
  if (!userId) return;
  await db
    .prepare(`
      INSERT INTO predictions (user_id, lottery_id, predicted_numbers, confidence_score, ai_reasoning, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
    .bind(
      userId,
      lotteryId,
      JSON.stringify(prediction.combined.suggestedNumbers),
      prediction.combined.confidence,
      prediction.ai?.reasoning ?? null
    )
    .run();
}

function mergeNumberSets(
  statistical: number[],
  ai: number[] | undefined,
  pickCount: number,
  statConfidence: number,
  aiConfidence: number
): { numbers: number[]; confidence: number; explanation: string } {
  if (!ai || ai.length === 0) {
    return {
      numbers: statistical.slice(0, pickCount),
      confidence: statConfidence,
      explanation: 'Basado en análisis de frecuencia ponderada y promedios móviles.',
    };
  }

  const statSet = new Set(statistical);
  const aiSet = new Set(ai);
  const consensus: number[] = [];
  const statOnly: number[] = [];
  const aiOnly: number[] = [];

  for (const n of statistical) {
    if (aiSet.has(n)) consensus.push(n);
    else statOnly.push(n);
  }
  for (const n of ai) {
    if (!statSet.has(n)) aiOnly.push(n);
  }

  const merged: number[] = [...consensus];
  const remaining = pickCount - merged.length;

  if (remaining > 0) {
    const primary = aiConfidence >= statConfidence ? aiOnly : statOnly;
    const secondary = aiConfidence >= statConfidence ? statOnly : aiOnly;
    merged.push(...primary.slice(0, remaining));
    if (merged.length < pickCount) {
      merged.push(...secondary.slice(0, pickCount - merged.length));
    }
  }

  const combinedConfidence = Math.min(
    Math.round((statConfidence + aiConfidence) / 2 + (consensus.length / pickCount) * 10),
    95
  );

  const parts: string[] = [];
  if (consensus.length > 0) {
    parts.push(`${consensus.length} números coincidentes entre modelos estadísticos e IA.`);
  }
  if (aiOnly.length > 0) {
    parts.push('La IA identificó candidatos adicionales por patrones.');
  }

  return {
    numbers: merged.slice(0, pickCount).sort((a, b) => a - b),
    confidence: combinedConfidence,
    explanation: parts.join(' ') || 'Análisis combinado estadístico + IA.',
  };
}

// POST /api/predictions
predictionsRouter.post('/', planGate, async (c) => {
  let body: PredictionRequest;
  try {
    body = await c.req.json<PredictionRequest>();
  } catch {
    return c.json({ error: 'Cuerpo JSON inválido' }, 400);
  }

  const { lotteryId, useAI = true } = body;
  if (!lotteryId || !Number.isInteger(lotteryId)) {
    return c.json({ error: 'lotteryId es requerido y debe ser un entero' }, 400);
  }

  const userId = await tryGetUserId(c);

  const lottery = await fetchLotteryMeta(c.env.DB, lotteryId);
  if (!lottery) {
    return c.json({ error: `Lotería ${lotteryId} no encontrada` }, 404);
  }

  const draws = await fetchDrawHistory(c.env.DB, lotteryId);
  if (draws.length === 0) {
    return c.json({ error: 'No hay historial de sorteos para esta lotería' }, 422);
  }

  const today = new Date().toISOString().split('T')[0];

  // Statistical prediction
  const statistical = generateStatisticalPrediction(draws, lottery.pickCount, lottery.maxNumber, today);

  // AI prediction (cached, cost-controlled)
  let aiPrediction;
  if (useAI && c.env.OPENAI_API_KEY) {
    try {
      aiPrediction = await getOpenAIPrediction(
        c.env.OPENAI_API_KEY,
        c.env.DB,
        lottery.id,
        lottery.name,
        draws,
        lottery.pickCount,
        lottery.maxNumber,
        userId
      );
    } catch (err) {
      console.error('Predicción OpenAI falló, usando solo modelo estadístico:', err);
    }
  }

  const merged = mergeNumberSets(
    statistical.suggestedNumbers,
    aiPrediction?.suggestedNumbers,
    lottery.pickCount,
    statistical.confidence,
    aiPrediction?.confidence ?? 0
  );

  const result: CombinedPrediction = {
    lotteryId: lottery.id,
    lotteryName: lottery.name,
    pickCount: lottery.pickCount,
    maxNumber: lottery.maxNumber,
    statistical,
    ai: aiPrediction,
    combined: {
      suggestedNumbers: merged.numbers,
      confidence: merged.confidence,
      explanation: merged.explanation,
    },
    disclaimer:
      'Este análisis es puramente estadístico y educativo. Las loterías son juegos de azar y ningún análisis garantiza resultados. Juega responsablemente.',
    generatedAt: new Date().toISOString(),
  };

  await savePredictionToHistory(c.env.DB, userId, lotteryId, result);

  return c.json(result);
});

// GET /api/predictions — requires authentication
predictionsRouter.get('/', requireAuth, async (c) => {
  const jwtUser = c.get('user') as JwtPayload;

  const lotteryIdParam = c.req.query('lotteryId');
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);

  const rows = lotteryIdParam
    ? await c.env.DB
        .prepare(
          `SELECT id, lottery_id, predicted_numbers, confidence_score, ai_reasoning, created_at
           FROM predictions WHERE user_id = ? AND lottery_id = ? ORDER BY created_at DESC LIMIT ?`
        )
        .bind(jwtUser.sub, Number(lotteryIdParam), limit)
        .all<{ id: number; lottery_id: number; predicted_numbers: string; confidence_score: number; ai_reasoning: string | null; created_at: string }>()
    : await c.env.DB
        .prepare(
          `SELECT id, lottery_id, predicted_numbers, confidence_score, ai_reasoning, created_at
           FROM predictions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
        )
        .bind(jwtUser.sub, limit)
        .all<{ id: number; lottery_id: number; predicted_numbers: string; confidence_score: number; ai_reasoning: string | null; created_at: string }>();

  const predictions = (rows.results ?? []).map((r) => ({
    id: r.id,
    lotteryId: r.lottery_id,
    numbers: JSON.parse(r.predicted_numbers) as number[],
    confidenceScore: r.confidence_score,
    aiReasoning: r.ai_reasoning,
    createdAt: r.created_at,
  }));

  return c.json({ predictions });
});
