/**
 * OpenAI integration for contextual lottery pattern analysis.
 * Phase 2b: Motor de predicción AI
 *
 * Cost controls:
 * - Results are cached in D1 with a configurable TTL
 * - Uses gpt-4o-mini for cost efficiency
 * - Input token limits enforced by limiting history sent
 */

import { DrawResult } from './statistics';

export interface OpenAIPrediction {
  suggestedNumbers: number[];
  reasoning: string;
  patterns: string[];
  confidence: number;
  method: 'openai';
  cachedAt?: string;
}

const CACHE_TTL_HOURS = 6; // Refresh AI analysis every 6 hours max

/**
 * Check D1 cache for existing AI prediction for this lottery.
 */
async function getCachedPrediction(
  db: D1Database,
  lotteryId: number,
  userId: string | null
): Promise<OpenAIPrediction | null> {
  const cacheKey = userId
    ? `ai_pred_${lotteryId}_user_${userId}`
    : `ai_pred_${lotteryId}_global`;

  const row = await db
    .prepare('SELECT response_json, created_at FROM predictions_cache WHERE cache_key = ? AND lottery_id = ?')
    .bind(cacheKey, lotteryId)
    .first<{ response_json: string; created_at: string }>();

  if (!row) return null;

  const age = (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60);
  if (age > CACHE_TTL_HOURS) return null;

  try {
    const cached = JSON.parse(row.response_json) as OpenAIPrediction;
    cached.cachedAt = row.created_at;
    return cached;
  } catch {
    return null;
  }
}

/**
 * Store AI prediction in D1 cache.
 */
async function cachePrediction(
  db: D1Database,
  lotteryId: number,
  userId: string | null,
  prediction: OpenAIPrediction
): Promise<void> {
  const cacheKey = userId
    ? `ai_pred_${lotteryId}_user_${userId}`
    : `ai_pred_${lotteryId}_global`;

  await db
    .prepare(`
      INSERT INTO predictions_cache (cache_key, lottery_id, user_id, response_json, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(cache_key) DO UPDATE SET
        response_json = excluded.response_json,
        created_at = excluded.created_at
    `)
    .bind(cacheKey, lotteryId, userId, JSON.stringify(prediction))
    .run();
}

/**
 * Build the analysis prompt for OpenAI.
 * We send last 30 draws max to keep tokens manageable.
 */
function buildPrompt(
  lotteryName: string,
  draws: DrawResult[],
  pickCount: number,
  maxNum: number
): string {
  const recent = draws.slice(-30);
  const drawLines = recent
    .map((d) => `${d.drawDate}: [${d.numbers.join(', ')}]`)
    .join('\n');

  return `You are a statistical lottery analyst. Analyze the following historical draw data for the "${lotteryName}" lottery and suggest ${pickCount} numbers from 1 to ${maxNum} for the next draw.

Historical draws (most recent last):
${drawLines}

Identify:
1. Recurring patterns or cycles
2. Numbers that are statistically overdue
3. Any seasonal or periodic trends
4. Unusual gaps in the distribution

Respond ONLY with a JSON object in this exact format (no markdown):
{
  "suggestedNumbers": [<${pickCount} numbers sorted ascending>],
  "reasoning": "<2-3 sentence explanation>",
  "patterns": ["<pattern 1>", "<pattern 2>", "<pattern 3>"],
  "confidence": <integer 1-100>
}

Important: This is a statistical analysis tool. Do not make guarantees. Numbers are 1-${maxNum}.`;
}

/**
 * Call OpenAI API and parse the structured response.
 */
export async function getOpenAIPrediction(
  openAIKey: string,
  db: D1Database,
  lotteryId: number,
  lotteryName: string,
  draws: DrawResult[],
  pickCount: number,
  maxNum: number,
  userId: string | null = null
): Promise<OpenAIPrediction> {
  // Check cache first
  const cached = await getCachedPrediction(db, lotteryId, userId);
  if (cached) return cached;

  if (draws.length < 5) {
    throw new Error('Insufficient draw history for AI analysis (minimum 5 draws required)');
  }

  const prompt = buildPrompt(lotteryName, draws, pickCount, maxNum);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${err}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenAI');

  let parsed: { suggestedNumbers: number[]; reasoning: string; patterns: string[]; confidence: number };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Failed to parse OpenAI response as JSON');
  }

  // Validate and clamp
  const validNumbers = (parsed.suggestedNumbers ?? [])
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= maxNum)
    .slice(0, pickCount);

  if (validNumbers.length < pickCount) {
    throw new Error(`OpenAI returned insufficient valid numbers: ${validNumbers.length}/${pickCount}`);
  }

  const prediction: OpenAIPrediction = {
    suggestedNumbers: validNumbers.sort((a, b) => a - b),
    reasoning: (parsed.reasoning ?? '').slice(0, 500),
    patterns: (parsed.patterns ?? []).slice(0, 5).map((p: string) => String(p).slice(0, 200)),
    confidence: Math.max(1, Math.min(100, Number(parsed.confidence) || 50)),
    method: 'openai',
  };

  // Cache in D1
  await cachePrediction(db, lotteryId, userId, prediction);

  return prediction;
}
