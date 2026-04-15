/**
 * Lottery data ingestion service — scrapes loteriasdehoy.co
 *
 * Called by the Cloudflare Workers Cron Trigger (see wrangler.toml).
 * Determines which lotteries draw today (Colombia TZ), scrapes results
 * (premio mayor + secos with prize names and values) and upserts into D1.
 *
 * No external secrets required.
 */

const SITE = 'https://loteriasdehoy.co';

const MONTHS_ES: Record<number, string> = {
  1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril',
  5: 'mayo', 6: 'junio', 7: 'julio', 8: 'agosto',
  9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre',
};

const DAYS_EN: Record<number, string> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
};

/** Lotteries whose loteriasdehoy.co URL uses "del" before the year */
const USES_DEL = new Set([
  'loteria-de-boyaca', 'loteria-del-cauca', 'loteria-del-tolima',
]);

/** Map DB slug → loteriasdehoy.co slug (only where they differ) */
const SITE_SLUG_OVERRIDES: Record<string, string> = {
  'cruz-roja': 'loteria-de-la-cruz-roja',
};

interface LotteryRow {
  id: number;
  slug: string;
  draw_day: string | null;
}

interface ScrapedDraw {
  number: string;
  series: string | null;
  sorteo: number | null;
  prizeType: 'mayor' | 'seco';
  prizeName: string | null;
  prizeValue: number | null;
}

export interface IngestionResult {
  fetched: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

/** Build loteriasdehoy.co URLs for a given lottery and date (primary + fallback) */
function buildUrls(dbSlug: string, date: Date): string[] {
  const siteSlug = SITE_SLUG_OVERRIDES[dbSlug] ?? dbSlug;
  const day = date.getDate();
  const month = MONTHS_ES[date.getMonth() + 1];
  const year = date.getFullYear();
  const base = `${SITE}/${siteSlug}-${day}-de-${month}`;
  if (USES_DEL.has(dbSlug)) {
    return [`${base}-del-${year}`, `${base}-${year}`];
  }
  return [`${base}-${year}`, `${base}-del-${year}`];
}

/** Get today's date in Colombia (UTC-5) */
function getColombiaNow(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utc - 5 * 3600_000);
}

/** Format date as YYYY-MM-DD */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Strip HTML tags and decode basic entities */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Parse a prize string like "Casa Para Siempre 270 millones" into name + value.
 * Value is stored in millions (integer). E.g. 270 millones → 270.
 */
function parsePrize(raw: string): { name: string; value: number | null } {
  // Match: "Some Name 1.500 millones" or "Seco 270 Millones" or "Name 15M"
  const match = raw.match(/^(.+?)\s+([\d.,]+)\s*(?:millones|mill|M)\s*$/i);
  if (match) {
    const name = match[1].trim();
    const numStr = match[2].replace(/\./g, '').replace(',', '.');
    const value = Math.round(parseFloat(numStr));
    if (!isNaN(value)) {
      return { name, value };
    }
  }
  return { name: raw.trim(), value: null };
}

/** Scrape premio mayor and secos from a loteriasdehoy.co page */
function parseResults(html: string): ScrapedDraw[] {
  const results: ScrapedDraw[] = [];

  // --- Premio Mayor ---
  let mayorNumber: string | null = null;
  let mayorSeries: string | null = null;
  let mayorSorteo: number | null = null;
  let mayorValue: number | null = null;

  // Extract 4 digits from premio1 spans
  const numberDigits = [...html.matchAll(/class="redondo premio1">\s*(\d)\s*<\/span>/gi)];
  if (numberDigits.length >= 4) {
    mayorNumber = numberDigits.slice(0, 4).map(m => m[1]).join('');
  }

  // Extract series digits from serie1 spans
  const seriesDigits = [...html.matchAll(/class="redondo serie1">\s*(\d)\s*<\/span>/gi)];
  if (seriesDigits.length >= 2) {
    mayorSeries = seriesDigits.map(m => m[1]).join('');
  }

  // Sorteo number
  const sorteoMatch = html.match(/Sorteo\s+(\d{3,5})/i);
  if (sorteoMatch) {
    mayorSorteo = parseInt(sorteoMatch[1], 10);
  }

  // Mayor prize value — "$3.500 Millones" or "$14.000 Millones"
  const mayorValueMatch = html.match(/\$([\d.,]+)\s*Millones/i);
  if (mayorValueMatch) {
    const numStr = mayorValueMatch[1].replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(numStr);
    if (!isNaN(parsed)) {
      mayorValue = Math.round(parsed);
    }
  }

  if (mayorNumber && mayorNumber.length === 4) {
    results.push({
      number: mayorNumber,
      series: mayorSeries,
      sorteo: mayorSorteo,
      prizeType: 'mayor',
      prizeName: 'Premio Mayor',
      prizeValue: mayorValue,
    });
  }

  // --- Secos ---
  const tableMatches = html.matchAll(
    /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi
  );

  for (const m of tableMatches) {
    const premioRaw = stripHtml(m[1]);
    const premio = premioRaw.toLowerCase();
    const numero = stripHtml(m[2]);
    const serie = stripHtml(m[3]);

    // Skip header rows
    if (premio === 'premio' || premio.includes('número') || premio.includes('numero')) {
      continue;
    }
    if (!/^\d{4}$/.test(numero)) {
      continue;
    }

    const { name, value } = parsePrize(premioRaw);

    results.push({
      number: numero,
      series: serie || null,
      sorteo: null,
      prizeType: 'seco',
      prizeName: name,
      prizeValue: value,
    });
  }

  return results;
}

/**
 * Main ingestion entry point.
 */
export async function ingestLotteryData(env: Env): Promise<IngestionResult> {
  const result: IngestionResult = { fetched: 0, inserted: 0, skipped: 0, errors: [] };

  const colombiaNow = getColombiaNow();
  const todayStr = formatDate(colombiaNow);
  const dayOfWeek = DAYS_EN[colombiaNow.getDay()];

  console.log(`[ingestion] Starting — date=${todayStr} day=${dayOfWeek}`);

  const lotteries = await env.DB.prepare(
    `SELECT id, slug, draw_day FROM lotteries WHERE active = 1 AND draw_day = ?`
  ).bind(dayOfWeek).all<LotteryRow>();

  if (!lotteries.results.length) {
    console.log(`[ingestion] No lotteries draw on ${dayOfWeek} — done`);
    return result;
  }

  console.log(`[ingestion] ${lotteries.results.length} lotteries draw today: ${lotteries.results.map(l => l.slug).join(', ')}`);

  for (const lottery of lotteries.results) {
    const urls = buildUrls(lottery.slug, colombiaNow);
    console.log(`[ingestion] Scraping ${lottery.slug} → ${urls[0]}`);

    let html: string | null = null;
    try {
      for (const url of urls) {
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html',
          },
        });
        if (resp.ok) {
          html = await resp.text();
          break;
        }
      }

      if (!html) {
        result.errors.push(`${lottery.slug}: all URL variants returned non-200`);
        continue;
      }

      const draws = parseResults(html);
      result.fetched += draws.length;

      if (draws.length === 0) {
        result.errors.push(`${lottery.slug}: no results found on page`);
        continue;
      }

      const mayorCount = draws.filter(d => d.prizeType === 'mayor').length;
      const secoCount = draws.filter(d => d.prizeType === 'seco').length;
      console.log(`[ingestion] ${lottery.slug}: found ${mayorCount} mayor + ${secoCount} secos`);

      for (const draw of draws) {
        try {
          const res = await env.DB.prepare(
            `INSERT OR IGNORE INTO draws
               (lottery_id, draw_date, number, series, sorteo, prize_type, prize_name, prize_value, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'loteriasdehoy.co')`
          ).bind(
            lottery.id,
            todayStr,
            draw.number,
            draw.series,
            draw.sorteo,
            draw.prizeType,
            draw.prizeName,
            draw.prizeValue,
          ).run();

          if (res.meta.changes > 0) {
            result.inserted++;
          } else {
            result.skipped++;
          }
        } catch (err) {
          result.errors.push(`${lottery.slug}/${draw.number}: ${String(err)}`);
        }
      }
    } catch (err) {
      result.errors.push(`${lottery.slug}: fetch failed — ${String(err)}`);
    }
  }

  console.log(
    `[ingestion] done — fetched=${result.fetched} inserted=${result.inserted} ` +
    `skipped=${result.skipped} errors=${result.errors.length}`
  );
  return result;
}
