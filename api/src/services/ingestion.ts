/**
 * Lottery data ingestion service — Phase 2a (EJM-27)
 *
 * Called by the Cloudflare Workers Cron Trigger (see wrangler.toml).
 * Fetches results from a configurable external source and upserts into D1.
 *
 * Configuration (env secrets / vars):
 *   LOTTERY_FEED_URL  — optional base URL of a JSON feed (see FeedDraw type below)
 *
 * If LOTTERY_FEED_URL is not set the worker logs a warning and exits cleanly —
 * this lets local dev run without a real data source configured.
 */

export interface FeedDraw {
  lotteryExternalId: string;   // maps to lotteries.external_id (or name fallback)
  drawDate:          string;   // YYYY-MM-DD
  numbers:           number[];
  specialNumbers?:   number[];
  jackpotAmount?:    number;   // cents
}

export interface FeedResponse {
  draws: FeedDraw[];
}

export interface IngestionResult {
  fetched:   number;
  inserted:  number;
  skipped:   number;
  errors:    string[];
}

/**
 * Main ingestion entry point.
 * Called from the scheduled handler in index.ts.
 */
export async function ingestLotteryData(env: Env): Promise<IngestionResult> {
  const result: IngestionResult = { fetched: 0, inserted: 0, skipped: 0, errors: [] };

  const feedUrl = (env as unknown as Record<string, string>)['LOTTERY_FEED_URL'];
  if (!feedUrl) {
    console.log('[ingestion] LOTTERY_FEED_URL not configured — skipping scheduled ingestion');
    return result;
  }

  let feed: FeedResponse;
  try {
    const resp = await fetch(feedUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'loter-ia-worker/1.0' },
      cf: { cacheTtl: 300 },
    });
    if (!resp.ok) {
      result.errors.push(`Feed returned HTTP ${resp.status}`);
      return result;
    }
    feed = await resp.json<FeedResponse>();
  } catch (err) {
    result.errors.push(`Failed to fetch feed: ${String(err)}`);
    return result;
  }

  if (!Array.isArray(feed.draws)) {
    result.errors.push('Feed response missing draws array');
    return result;
  }

  result.fetched = feed.draws.length;

  for (const draw of feed.draws) {
    try {
      await upsertDraw(env.DB, draw, result);
    } catch (err) {
      result.errors.push(`Error upserting draw ${draw.lotteryExternalId}/${draw.drawDate}: ${String(err)}`);
    }
  }

  console.log(
    `[ingestion] done — fetched=${result.fetched} inserted=${result.inserted} ` +
    `skipped=${result.skipped} errors=${result.errors.length}`
  );
  return result;
}

async function upsertDraw(
  db: D1Database,
  draw: FeedDraw,
  result: IngestionResult,
): Promise<void> {
  // Validate minimal shape
  if (!draw.drawDate || !Array.isArray(draw.numbers) || draw.numbers.length === 0) {
    result.errors.push(`Invalid draw shape: ${JSON.stringify(draw)}`);
    return;
  }

  // Resolve lottery_id by matching on name or external_id column
  const lottery = await db.prepare(
    `SELECT id FROM lotteries
     WHERE (name = ? OR name LIKE ?) AND active = 1
     LIMIT 1`
  ).bind(draw.lotteryExternalId, `%${draw.lotteryExternalId}%`).first<{ id: number }>();

  if (!lottery) {
    result.errors.push(`Lottery not found for externalId="${draw.lotteryExternalId}"`);
    return;
  }

  // Validate numbers are all non-negative integers
  const nums = draw.numbers;
  if (nums.some(n => !Number.isInteger(n) || n < 0)) {
    result.errors.push(`Invalid numbers for draw ${draw.lotteryExternalId}/${draw.drawDate}`);
    return;
  }

  const numbersJson        = JSON.stringify(nums.sort((a, b) => a - b));
  const specialNumbersJson = draw.specialNumbers?.length
    ? JSON.stringify(draw.specialNumbers.sort((a, b) => a - b))
    : null;

  // INSERT OR IGNORE — skips duplicates (lottery_id, draw_date) UNIQUE constraint
  const res = await db.prepare(
    `INSERT OR IGNORE INTO draws
       (lottery_id, draw_date, numbers, special_numbers, jackpot_amount)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(
    lottery.id,
    draw.drawDate,
    numbersJson,
    specialNumbersJson,
    draw.jackpotAmount ?? null,
  ).run();

  if (res.meta.changes > 0) {
    result.inserted++;
  } else {
    result.skipped++;
  }
}
