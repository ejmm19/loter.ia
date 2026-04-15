"""
Scraper completo — construye URLs a partir de las fechas en la DB
para llenar TODOS los secos faltantes.

Uso:
  cd api
  python scripts/scrape-secos-complete.py
  npx wrangler d1 execute loter-ia-db --remote --file=scripts/scraped_secos_complete.sql
"""

import re
import json
import subprocess
import urllib.request
import time
import html as html_module
from datetime import datetime

SITE = "https://loteriasdehoy.co"
OUTPUT = "scripts/scraped_secos_complete.sql"

LOTTERIES = [
    {"site_slug": "loteria-de-medellin", "db_id": 2},
    {"site_slug": "loteria-de-bogota", "db_id": 1},
    {"site_slug": "loteria-de-boyaca", "db_id": 3, "date_format": "del"},
    {"site_slug": "loteria-del-cauca", "db_id": 4, "date_format": "del"},
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

def date_to_slug(date_str, site_slug, date_format=None):
    """Convert 2026-04-10 to loteria-de-medellin-10-de-abril-2026"""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    day = dt.day
    month = MONTHS_ES[dt.month]
    year = dt.year
    if date_format == "del":
        return f"{site_slug}-{day}-de-{month}-del-{year}"
    return f"{site_slug}-{day}-de-{month}-{year}"

def scrape_secos(url):
    html = fetch(url)
    if not html:
        return []

    tables = re.findall(r'<table[^>]*>(.*?)</table>', html, re.DOTALL)
    secos = []
    for table in tables:
        rows = re.findall(
            r'<tr[^>]*>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*</tr>',
            table, re.DOTALL
        )
        for premio, numero, serie in rows:
            numero_clean = html_module.unescape(re.sub(r'<[^>]+>', '', numero).strip())
            serie_clean = html_module.unescape(re.sub(r'<[^>]+>', '', serie).strip())
            premio_clean = re.sub(r'<[^>]+>', '', premio).strip().lower()

            if 'premio' == premio_clean or 'número' in premio_clean or 'numero' in premio_clean:
                continue
            if not numero_clean or not numero_clean.isdigit() or len(numero_clean) != 4:
                continue

            secos.append({"number": numero_clean, "series": serie_clean})
    return secos

def get_dates_without_secos(db_id):
    """Get draw dates from DB that have mayor but no secos"""
    cmd = f'npx wrangler d1 execute loter-ia-db --remote --json --command="SELECT draw_date FROM draws WHERE lottery_id = {db_id} AND prize_type = \'mayor\' AND draw_date >= \'2024-01-01\' AND draw_date NOT IN (SELECT DISTINCT draw_date FROM draws WHERE lottery_id = {db_id} AND prize_type = \'seco\') ORDER BY draw_date DESC"'
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, shell=True)
    try:
        data = json.loads(result.stdout)
        return [r["draw_date"] for r in data[0]["results"]]
    except:
        return []

def main():
    all_inserts = []

    for lot in LOTTERIES:
        print(f"\n=== {lot['site_slug']} (db_id={lot['db_id']}) ===")

        dates = get_dates_without_secos(lot["db_id"])
        print(f"  {len(dates)} dates missing secos")

        for date_str in dates:
            slug = date_to_slug(date_str, lot["site_slug"], lot.get("date_format"))
            url = f"{SITE}/{slug}"
            secos = scrape_secos(url)

            if secos:
                print(f"  {date_str}: {len(secos)} secos")
                for s in secos:
                    serie_val = f"'{s['series']}'" if s['series'] else "NULL"
                    sql = (
                        f"INSERT OR IGNORE INTO draws (lottery_id, draw_date, number, series, prize_type, source) "
                        f"VALUES ({lot['db_id']}, '{date_str}', '{s['number']}', {serie_val}, 'seco', 'loteriasdehoy.co');"
                    )
                    all_inserts.append(sql)
            else:
                print(f"  {date_str}: no secos found (may not exist on site)")

            time.sleep(0.3)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write("\n".join(all_inserts))

    print(f"\n=== Done! Generated {len(all_inserts)} INSERT statements in {OUTPUT} ===")

if __name__ == "__main__":
    main()
