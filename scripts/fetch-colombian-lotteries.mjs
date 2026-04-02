/**
 * fetch-colombian-lotteries.mjs
 *
 * Fetches historical Colombian lottery draws from the datos.gov.co SODA API
 * (dataset i3kx-3zps) and generates SQL INSERT statements for the loter.ia D1 database.
 *
 * Usage:
 *   node scripts/fetch-colombian-lotteries.mjs
 *
 * Output:
 *   scripts/output/historical_draws.sql   — INSERT OR IGNORE statements ready for wrangler d1 execute
 *   scripts/output/coverage-report.json   — Per-lottery coverage summary
 *   scripts/output/coverage-report.md     — Human-readable coverage report
 *
 * Apply to local D1:
 *   cd api && npx wrangler d1 execute loter-ia-db --local --file=../scripts/output/historical_draws.sql
 *
 * Apply to remote D1:
 *   cd api && npx wrangler d1 execute loter-ia-db --remote --file=../scripts/output/historical_draws.sql
 */

import { createWriteStream } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, 'output');

// datos.gov.co SODA API endpoint for Colombian lottery results
const SODA_BASE = 'https://www.datos.gov.co/resource/i3kx-3zps.json';
const PAGE_SIZE = 10000;

// Mapping from SODA API lottery names to catalog names in the D1 lotteries table.
// Unmapped names (e.g. "Sorteo Extraordinario - Asociado") are skipped with a note.
const LOTTERY_NAME_MAP = {
  'Loteria de Bogota':              'Lotería de Bogotá',
  'Loteria de Medellin':            'Lotería de Medellín',
  'Loteria de Boyaca':              'Lotería de Boyacá',
  'Loteria del Cauca':              'Lotería del Cauca',
  'Loteria de Cundinamarca':        'Lotería de Cundinamarca',
  'Loteria de Manizales':           'Lotería de Manizales',
  'Loteria del Meta':               'Lotería del Meta',
  'Loteria Santander':              'Lotería de Santander',
  'Loteria del Tolima':             'Lotería del Tolima',
  'Loteria del Valle':              'Lotería del Valle',
  'Loteria del Quindio':            'Lotería del Quindío',
  'Loteria del Risaralda':          'Lotería del Risaralda',
  'Sorteo Extra de Colombia':       'Extra de Colombia',
  'Loteria de la Cruz Roja':        'Cruz Roja',
  'Loteria del Huila':              'Lotería del Huila',
  // Skipped intentionally — extraordinary draws not part of regular catalog
  'Sorteo Extraordinario - Asociado': null,
};

/** Parse DD/MM/YYYY → YYYY-MM-DD */
function parseDate(raw) {
  if (!raw) return null;
  const parts = raw.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return null;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/** Fetch a single page from SODA API */
async function fetchPage(offset) {
  const url = `${SODA_BASE}?$limit=${PAGE_SIZE}&$offset=${offset}&$order=fecha_del_sorteo ASC`;
  const resp = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'loter-ia-importer/1.0' },
  });
  if (!resp.ok) {
    throw new Error(`SODA API returned HTTP ${resp.status} at offset ${offset}`);
  }
  return resp.json();
}

/** Escape a SQL string value */
function sqlStr(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  console.log('Fetching Colombian lottery data from datos.gov.co SODA API...');

  // Collect all records
  let allRecords = [];
  let offset = 0;
  while (true) {
    process.stdout.write(`  Fetching offset ${offset}...`);
    const page = await fetchPage(offset);
    if (!Array.isArray(page) || page.length === 0) {
      console.log(' done.');
      break;
    }
    allRecords = allRecords.concat(page);
    console.log(` got ${page.length} records (total: ${allRecords.length})`);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`\nTotal raw records fetched: ${allRecords.length}`);

  // Group records by (catalog_lottery_name, draw_date) — keep only "Mayor" prize (jackpot number)
  // For a given draw date, datos.gov.co may have multiple rows (Mayor, Serie, etc.).
  // We only want the "Mayor" row which carries the winning ticket number.
  const drawMap = new Map(); // key: `${lotteryName}|${drawDate}` → { lotteryName, drawDate, number, series }
  const skippedNames = new Set();
  const unmappedNames = new Set();

  for (const rec of allRecords) {
    const rawName = rec['loter_a'];
    const rawDate = rec['fecha_del_sorteo'];
    const rawNumber = rec['numero_billete_ganador'];
    const rawSeries = rec['numero_serie_ganadora'];
    const prizeType = rec['tipo_de_premio'];

    if (!rawName || !rawDate) continue;

    const catalogName = LOTTERY_NAME_MAP[rawName];
    if (catalogName === undefined) {
      unmappedNames.add(rawName);
      continue;
    }
    if (catalogName === null) {
      skippedNames.add(rawName);
      continue;
    }

    // Only process "Mayor" prize rows — this gives us the main winning number
    if (prizeType && prizeType.trim() !== 'Mayor') continue;

    const drawDate = parseDate(rawDate);
    if (!drawDate) continue;

    const winNum = parseInt(rawNumber, 10);
    if (isNaN(winNum) || winNum < 0 || winNum > 9999) continue;

    const seriesNum = rawSeries ? parseInt(rawSeries, 10) : null;

    const key = `${catalogName}|${drawDate}`;
    if (!drawMap.has(key)) {
      drawMap.set(key, { lotteryName: catalogName, drawDate, numbers: [winNum], series: seriesNum });
    }
  }

  if (unmappedNames.size > 0) {
    console.log(`\nWarning: unrecognized lottery names in source data (not mapped):`);
    for (const n of unmappedNames) console.log(`  - ${n}`);
  }
  if (skippedNames.size > 0) {
    console.log(`\nSkipped (intentionally not in catalog):`);
    for (const n of skippedNames) console.log(`  - ${n}`);
  }

  const draws = Array.from(drawMap.values());
  console.log(`\nUnique (lottery, date) draws to insert: ${draws.length}`);

  // Build SQL file
  const sqlLines = [
    '-- Historical Colombian lottery draws — generated by scripts/fetch-colombian-lotteries.mjs',
    `-- Source: datos.gov.co dataset i3kx-3zps`,
    `-- Generated: ${new Date().toISOString()}`,
    `-- Total rows: ${draws.length}`,
    '',
  ];

  for (const d of draws) {
    const numbersJson = sqlStr(JSON.stringify(d.numbers));
    const seriesJson = d.series !== null ? sqlStr(JSON.stringify([d.series])) : 'NULL';
    const lotteryNameSql = sqlStr(d.lotteryName);
    const drawDateSql = sqlStr(d.drawDate);

    sqlLines.push(
      `INSERT OR IGNORE INTO draws (lottery_id, draw_date, numbers, special_numbers) ` +
      `SELECT id, ${drawDateSql}, ${numbersJson}, ${seriesJson} ` +
      `FROM lotteries WHERE name = ${lotteryNameSql} AND country = 'Colombia' LIMIT 1;`
    );
  }

  const sqlPath = resolve(OUTPUT_DIR, 'historical_draws.sql');
  await writeFile(sqlPath, sqlLines.join('\n') + '\n', 'utf8');
  console.log(`\nSQL file written: ${sqlPath}`);

  // Build coverage report
  const coverageByLottery = {};
  for (const d of draws) {
    if (!coverageByLottery[d.lotteryName]) {
      coverageByLottery[d.lotteryName] = { count: 0, minDate: d.drawDate, maxDate: d.drawDate };
    }
    const entry = coverageByLottery[d.lotteryName];
    entry.count++;
    if (d.drawDate < entry.minDate) entry.minDate = d.drawDate;
    if (d.drawDate > entry.maxDate) entry.maxDate = d.drawDate;
  }

  // Document lotteries from task that are NOT in datos.gov.co
  const missingFromSource = [
    {
      name: 'Baloto',
      reason: 'Not in datos.gov.co dataset. Available on Kaggle (jaforero/baloto-colombia) or via web scraping from baloto.com. Requires manual download.',
    },
    {
      name: 'Baloto Revancha',
      reason: 'Not in datos.gov.co dataset. Same source as Baloto (same draw event, secondary prize pool). Requires Kaggle download or web scraping.',
    },
  ];

  const coverageReport = {
    generatedAt: new Date().toISOString(),
    source: 'datos.gov.co SODA API — dataset i3kx-3zps',
    totalDrawsInserted: draws.length,
    lotteries: coverageByLottery,
    notAvailableInSource: missingFromSource,
  };

  const jsonPath = resolve(OUTPUT_DIR, 'coverage-report.json');
  await writeFile(jsonPath, JSON.stringify(coverageReport, null, 2), 'utf8');

  // Build markdown report
  const mdLines = [
    '# Coverage Report — Colombian Lottery Historical Data',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Source:** datos.gov.co SODA API (dataset \`i3kx-3zps\`)`,
    `**Total draws imported:** ${draws.length}`,
    '',
    '## Coverage by Lottery',
    '',
    '| Lottery | Draws | From | To |',
    '|---------|-------|------|----|',
  ];

  for (const [name, info] of Object.entries(coverageByLottery).sort((a, b) => a[0].localeCompare(b[0]))) {
    mdLines.push(`| ${name} | ${info.count} | ${info.minDate} | ${info.maxDate} |`);
  }

  mdLines.push('');
  mdLines.push('## Not Available in datos.gov.co');
  mdLines.push('');

  for (const entry of missingFromSource) {
    mdLines.push(`### ${entry.name}`);
    mdLines.push(`**Reason:** ${entry.reason}`);
    mdLines.push('');
  }

  mdLines.push('## How to Apply');
  mdLines.push('');
  mdLines.push('```bash');
  mdLines.push('# Apply migration for missing lotteries first:');
  mdLines.push('cd api && npx wrangler d1 migrations apply loter-ia-db --local');
  mdLines.push('');
  mdLines.push('# Then import historical data:');
  mdLines.push('cd api && npx wrangler d1 execute loter-ia-db --local --file=../scripts/output/historical_draws.sql');
  mdLines.push('');
  mdLines.push('# For production (remote):');
  mdLines.push('cd api && npx wrangler d1 migrations apply loter-ia-db --remote');
  mdLines.push('cd api && npx wrangler d1 execute loter-ia-db --remote --file=../scripts/output/historical_draws.sql');
  mdLines.push('```');

  const mdPath = resolve(OUTPUT_DIR, 'coverage-report.md');
  await writeFile(mdPath, mdLines.join('\n') + '\n', 'utf8');
  console.log(`Coverage JSON:  ${jsonPath}`);
  console.log(`Coverage MD:    ${mdPath}`);

  console.log('\nDone! Next steps:');
  console.log('  cd api && npx wrangler d1 migrations apply loter-ia-db --local');
  console.log('  cd api && npx wrangler d1 execute loter-ia-db --local --file=../scripts/output/historical_draws.sql');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
