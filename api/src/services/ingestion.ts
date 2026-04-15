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

// ── Blu Radio (secondary source for faster secos) ──

const BLU_INDEX = 'https://www.bluradio.com/economia/juegos-de-azar';

/** Map DB slug → keywords to find in Blu Radio article URLs */
const BLU_KEYWORDS: Record<string, string[]> = {
  'loteria-de-bogota': ['loteria-de-bogota', 'loteria-bogota'],
  'loteria-de-medellin': ['loteria-de-medellin', 'loteria-medellin'],
  'loteria-de-boyaca': ['loteria-de-boyaca', 'loteria-boyaca'],
  'loteria-del-cauca': ['loteria-del-cauca'],
  'loteria-de-cundinamarca': ['loteria-de-cundinamarca', 'cundinamarca'],
  'loteria-de-manizales': ['loteria-de-manizales', 'loteria-manizales'],
  'loteria-del-meta': ['loteria-del-meta'],
  'loteria-de-santander': ['loteria-de-santander', 'loteria-santander'],
  'loteria-del-tolima': ['loteria-del-tolima', 'tolima'],
  'loteria-del-valle': ['loteria-del-valle'],
  'loteria-del-quindio': ['loteria-del-quindio', 'loteria-quindio'],
  'loteria-del-risaralda': ['loteria-de-risaralda', 'loteria-risaralda'],
  'loteria-del-huila': ['loteria-del-huila', 'loteria-huila'],
  'cruz-roja': ['cruz-roja'],
};

/** Find article URL for a lottery from Blu Radio index page */
async function findBluArticle(slug: string, dateStr: string): Promise<string | null> {
  const keywords = BLU_KEYWORDS[slug];
  if (!keywords) return null;

  const resp = await fetch(BLU_INDEX, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  if (!resp.ok) return null;

  const html = await resp.text();
  // Extract all article links
  const links = [...html.matchAll(/href="(https:\/\/www\.bluradio\.com\/economia\/juegos-de-azar\/[^"]+)"/g)];

  // Find a link that matches our lottery keyword AND contains the date
  const [year, month, day] = dateStr.split('-');
  const dayNum = parseInt(day, 10).toString();
  const monthName = MONTHS_ES[parseInt(month, 10)];

  for (const [, url] of links) {
    const lower = url.toLowerCase();
    // Must contain date reference
    if (!lower.includes(monthName) || !lower.includes(`-${dayNum}-de-`)) continue;
    // Must match lottery keyword
    if (keywords.some(kw => lower.includes(kw))) return url;
  }

  return null;
}

/** Parse secos from a Blu Radio article page */
function parseBluResults(html: string): ScrapedDraw[] {
  const results: ScrapedDraw[] = [];
  const seen = new Set<string>(); // dedup key: "number-series-type"

  // Premio mayor: look for 4-digit number in bold/heading near "premio mayor" or sorteo
  const mayorMatch = html.match(
    /(?:premio\s+mayor|número\s+ganador)[^]*?(\d{4})[^]*?(?:serie|Serie)\s*:?\s*(\d{2,3})/i
  );
  if (mayorMatch) {
    results.push({
      number: mayorMatch[1],
      series: mayorMatch[2],
      sorteo: null,
      prizeType: 'mayor',
      prizeName: 'Premio Mayor',
      prizeValue: null,
    });
  }

  // Sorteo number
  const sorteoMatch = html.match(/[Ss]orteo[:\s#]*(\d{3,5})/);
  if (sorteoMatch && results.length > 0) {
    results[0].sorteo = parseInt(sorteoMatch[1], 10);
  }

  // Mayor prize value
  const mayorValueMatch = html.match(/\$\s*([\d.,]+)\s*(?:millones|mil\s*millones)/i);
  if (mayorValueMatch && results.length > 0) {
    const raw = mayorValueMatch[0].toLowerCase();
    const numStr = mayorValueMatch[1].replace(/\./g, '').replace(',', '.');
    const num = parseFloat(numStr);
    if (!isNaN(num)) {
      results[0].prizeValue = raw.includes('mil millones') ? Math.round(num * 1000) : Math.round(num);
    }
  }

  // Secos: pattern "$XX millones" followed by numbers like "1234 – Serie 123" or "1234, 5678"
  // Blu Radio uses text blocks with prize tiers
  const secoBlocks = html.matchAll(
    /\$\s*([\d.,]+)\s*(?:millones?|mill)[^]*?(?=\$\s*[\d.,]+\s*(?:millones?|mill)|aproximaciones|<\/div|<\/article|$)/gi
  );

  for (const block of secoBlocks) {
    const blockText = stripHtml(block[0]);
    const numStr = block[1].replace(/\./g, '').replace(',', '.');
    const prizeValue = Math.round(parseFloat(numStr));
    if (isNaN(prizeValue) || prizeValue < 5) continue; // Skip very small amounts (not secos)

    // Find all 4-digit numbers with series in this block
    const secoMatches = blockText.matchAll(/(\d{4})\s*[–—-]\s*[Ss]erie\s*(\d{2,3})/g);
    for (const m of secoMatches) {
      const key = `${m[1]}-${m[2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        number: m[1],
        series: m[2],
        sorteo: null,
        prizeType: 'seco',
        prizeName: `Seco $${prizeValue} millones`,
        prizeValue: prizeValue,
      });
    }
  }

  return results;
}

/** Try scraping from Blu Radio as fallback */
async function scrapeBluRadio(
  slug: string,
  dateStr: string,
): Promise<ScrapedDraw[]> {
  const articleUrl = await findBluArticle(slug, dateStr);
  if (!articleUrl) return [];

  console.log(`[ingestion] Blu Radio fallback: ${articleUrl}`);

  const resp = await fetch(articleUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  if (!resp.ok) return [];

  return parseBluResults(await resp.text());
}

/** Scrape and upsert draws for a specific lottery and date */
async function scrapeAndInsert(
  env: Env,
  lottery: LotteryRow,
  date: Date,
  dateStr: string,
  result: IngestionResult,
): Promise<void> {
  const urls = buildUrls(lottery.slug, date);
  console.log(`[ingestion] Scraping ${lottery.slug} ${dateStr} → ${urls[0]}`);

  let html: string | null = null;
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
    result.errors.push(`${lottery.slug}/${dateStr}: all URL variants returned non-200`);
    return;
  }

  let draws = parseResults(html);

  // If loteriasdehoy.co has mayor but no secos, try Blu Radio as fallback
  const hasSecos = draws.some(d => d.prizeType === 'seco');
  if (!hasSecos) {
    try {
      const bluDraws = await scrapeBluRadio(lottery.slug, dateStr);
      if (bluDraws.length > 0) {
        // Keep mayor from primary source, add secos from Blu Radio
        const mayorFromPrimary = draws.filter(d => d.prizeType === 'mayor');
        const secosFromBlu = bluDraws.filter(d => d.prizeType === 'seco');
        // If primary had no mayor either, use Blu Radio's
        draws = mayorFromPrimary.length > 0
          ? [...mayorFromPrimary, ...secosFromBlu]
          : bluDraws;
        console.log(`[ingestion] ${lottery.slug} ${dateStr}: Blu Radio fallback added ${secosFromBlu.length} secos`);
      }
    } catch (err) {
      console.log(`[ingestion] Blu Radio fallback failed for ${lottery.slug}: ${String(err)}`);
    }
  }

  result.fetched += draws.length;

  if (draws.length === 0) {
    result.errors.push(`${lottery.slug}/${dateStr}: no results found on any source`);
    return;
  }

  const mayorCount = draws.filter(d => d.prizeType === 'mayor').length;
  const secoCount = draws.filter(d => d.prizeType === 'seco').length;
  const source = hasSecos ? 'loteriasdehoy.co' : 'bluradio.com';
  console.log(`[ingestion] ${lottery.slug} ${dateStr}: ${mayorCount} mayor + ${secoCount} secos (${source})`);

  for (const draw of draws) {
    const drawSource = draw.prizeType === 'seco' && !hasSecos ? 'bluradio.com' : 'loteriasdehoy.co';
    try {
      const res = await env.DB.prepare(
        `INSERT OR IGNORE INTO draws
           (lottery_id, draw_date, number, series, sorteo, prize_type, prize_name, prize_value, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        lottery.id, dateStr, draw.number, draw.series, draw.sorteo,
        draw.prizeType, draw.prizeName, draw.prizeValue, drawSource,
      ).run();

      if (res.meta.changes > 0) result.inserted++;
      else result.skipped++;
    } catch (err) {
      result.errors.push(`${lottery.slug}/${draw.number}: ${String(err)}`);
    }
  }
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

  // 1. Scrape today's lotteries
  const todayLotteries = await env.DB.prepare(
    `SELECT id, slug, draw_day FROM lotteries WHERE active = 1 AND draw_day = ?`
  ).bind(dayOfWeek).all<LotteryRow>();

  if (todayLotteries.results.length) {
    console.log(`[ingestion] Today: ${todayLotteries.results.map(l => l.slug).join(', ')}`);
    for (const lottery of todayLotteries.results) {
      try {
        await scrapeAndInsert(env, lottery, colombiaNow, todayStr, result);
      } catch (err) {
        result.errors.push(`${lottery.slug}: ${String(err)}`);
      }
    }
  }

  // 2. Backfill: check yesterday's lotteries for missing secos
  const yesterday = new Date(colombiaNow);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);
  const yesterdayDay = DAYS_EN[yesterday.getDay()];

  const yesterdayLotteries = await env.DB.prepare(
    `SELECT id, slug, draw_day FROM lotteries WHERE active = 1 AND draw_day = ?`
  ).bind(yesterdayDay).all<LotteryRow>();

  for (const lottery of yesterdayLotteries.results) {
    // Check if we already have secos for yesterday
    const secoCount = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM draws WHERE lottery_id = ? AND draw_date = ? AND prize_type = 'seco'`
    ).bind(lottery.id, yesterdayStr).first<{ cnt: number }>();

    if (secoCount && secoCount.cnt > 0) continue; // Already have secos

    console.log(`[ingestion] Backfill: ${lottery.slug} ${yesterdayStr} missing secos`);
    try {
      await scrapeAndInsert(env, lottery, yesterday, yesterdayStr, result);
    } catch (err) {
      result.errors.push(`backfill ${lottery.slug}: ${String(err)}`);
    }
  }

  console.log(
    `[ingestion] done — fetched=${result.fetched} inserted=${result.inserted} ` +
    `skipped=${result.skipped} errors=${result.errors.length}`
  );
  return result;
}
