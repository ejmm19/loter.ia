"""
Backfill prize_name and prize_value from loteriasdehoy.co for existing draws.

Generates UPDATE SQL for both mayor (prize value) and secos (prize name + value).

Usage:
  cd api
  python scripts/backfill-prizes.py
  npx wrangler d1 execute loter-ia-db --remote --file=scripts/backfill_prizes.sql
"""

import re
import json
import subprocess
import urllib.request
import time
import html as html_module
from datetime import datetime

SITE = "https://loteriasdehoy.co"
OUTPUT = "scripts/backfill_prizes.sql"

LOTTERIES = [
    {"site_slug": "loteria-de-bogota", "db_id": 1},
    {"site_slug": "loteria-de-medellin", "db_id": 2},
    {"site_slug": "loteria-de-boyaca", "db_id": 3},
    {"site_slug": "loteria-del-cauca", "db_id": 4},
    {"site_slug": "loteria-de-cundinamarca", "db_id": 5},
    {"site_slug": "loteria-de-manizales", "db_id": 6},
    {"site_slug": "loteria-del-meta", "db_id": 7},
    {"site_slug": "loteria-de-santander", "db_id": 8},
    {"site_slug": "loteria-del-tolima", "db_id": 9},
    {"site_slug": "loteria-del-valle", "db_id": 10},
    {"site_slug": "loteria-del-quindio", "db_id": 11},
    {"site_slug": "loteria-de-risaralda", "db_id": 12},
    {"site_slug": "loteria-del-huila", "db_id": 13},
    {"site_slug": "loteria-de-la-cruz-roja", "db_id": 15},
]

MONTHS_ES = {
    1: "enero", 2: "febrero", 3: "marzo", 4: "abril",
    5: "mayo", 6: "junio", 7: "julio", 8: "agosto",
    9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre",
}


def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except:
        return None


def build_urls(site_slug, date_str):
    """Build both URL variants for a date"""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    day = dt.day
    month = MONTHS_ES[dt.month]
    year = dt.year
    base = f"{SITE}/{site_slug}-{day}-de-{month}"
    return [f"{base}-del-{year}", f"{base}-{year}"]


def strip_html(s):
    s = re.sub(r'<[^>]+>', '', s)
    s = html_module.unescape(s)
    return s.strip()


def parse_prize(raw):
    """Parse 'Casa Para Siempre 270 millones' -> (name, value_in_millions)"""
    match = re.match(r'^(.+?)\s+([\d.,]+)\s*(?:millones|mill|M)\s*$', raw, re.IGNORECASE)
    if match:
        name = match.group(1).strip()
        num_str = match.group(2).replace('.', '').replace(',', '.')
        try:
            value = round(float(num_str))
            return name, value
        except:
            pass
    return raw.strip(), None


def get_dates_to_backfill(db_id):
    """Get draw dates that need prize info (where secos exist but prize_name is NULL)"""
    cmd = (
        f'npx wrangler d1 execute loter-ia-db --remote --json '
        f'--command="SELECT DISTINCT draw_date FROM draws '
        f"WHERE lottery_id = {db_id} AND prize_name IS NULL "
        f"AND draw_date >= '2025-04-01' "
        f'ORDER BY draw_date DESC"'
    )
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, shell=True)
    try:
        data = json.loads(result.stdout)
        return [r["draw_date"] for r in data[0]["results"]]
    except:
        return []


def sql_escape(s):
    return s.replace("'", "''") if s else s


def main():
    all_updates = []
    total_found = 0
    total_missing = 0

    for lot in LOTTERIES:
        print(f"\n=== {lot['site_slug']} (db_id={lot['db_id']}) ===")

        dates = get_dates_to_backfill(lot["db_id"])
        print(f"  {len(dates)} dates need prize info")

        for date_str in dates:
            urls = build_urls(lot["site_slug"], date_str)

            page_html = None
            for url in urls:
                page_html = fetch(url)
                if page_html:
                    break
                time.sleep(0.2)

            if not page_html:
                total_missing += 1
                time.sleep(0.2)
                continue

            # --- Mayor prize value ---
            mayor_match = re.search(r'\$([\d.,]+)\s*Millones', page_html, re.IGNORECASE)
            if mayor_match:
                num_str = mayor_match.group(1).replace('.', '').replace(',', '.')
                try:
                    mayor_value = round(float(num_str))
                    all_updates.append(
                        f"UPDATE draws SET prize_name = 'Premio Mayor', prize_value = {mayor_value} "
                        f"WHERE lottery_id = {lot['db_id']} AND draw_date = '{date_str}' "
                        f"AND prize_type = 'mayor';"
                    )
                except:
                    pass

            # --- Secos ---
            rows = re.findall(
                r'<tr[^>]*>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*</tr>',
                page_html, re.DOTALL
            )
            secos_updated = 0
            for premio_raw, numero_raw, serie_raw in rows:
                premio = strip_html(premio_raw)
                numero = strip_html(numero_raw)
                serie = strip_html(serie_raw)

                if premio.lower() in ('premio', '') or 'mero' in premio.lower():
                    continue
                if not re.match(r'^\d{4}$', numero):
                    continue

                name, value = parse_prize(premio)
                name_esc = sql_escape(name)
                value_sql = str(value) if value else 'NULL'
                serie_cond = f"AND series = '{sql_escape(serie)}'" if serie else "AND series IS NULL"

                all_updates.append(
                    f"UPDATE draws SET prize_name = '{name_esc}', prize_value = {value_sql} "
                    f"WHERE lottery_id = {lot['db_id']} AND draw_date = '{date_str}' "
                    f"AND number = '{numero}' {serie_cond} AND prize_type = 'seco';"
                )
                secos_updated += 1

            if secos_updated > 0 or mayor_match:
                print(f"  {date_str}: mayor={'yes' if mayor_match else 'no'} secos={secos_updated}")
                total_found += 1
            else:
                total_missing += 1

            time.sleep(0.3)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write("\n".join(all_updates))

    print(f"\n=== Done! ===")
    print(f"Pages scraped: {total_found}, Missing: {total_missing}")
    print(f"Generated {len(all_updates)} UPDATE statements in {OUTPUT}")
    print(f"Run: npx wrangler d1 execute loter-ia-db --remote --file={OUTPUT}")


if __name__ == "__main__":
    main()
