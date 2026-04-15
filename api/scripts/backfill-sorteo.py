"""
Backfill sorteo numbers from loteriasdehoy.co for draws that have sorteo IS NULL.

Generates UPDATE SQL statements to fill in the sorteo column.

Usage:
  cd api
  python scripts/backfill-sorteo.py
  npx wrangler d1 execute loter-ia-db --remote --file=scripts/backfill_sorteo.sql
"""

import re
import json
import subprocess
import urllib.request
import time
from datetime import datetime

SITE = "https://loteriasdehoy.co"
OUTPUT = "scripts/backfill_sorteo.sql"

LOTTERIES = [
    {"site_slug": "loteria-de-bogota", "db_id": 1},
    {"site_slug": "loteria-de-medellin", "db_id": 2},
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
    except Exception as e:
        return None


def date_to_slug(date_str, site_slug, date_format=None):
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    day = dt.day
    month = MONTHS_ES[dt.month]
    year = dt.year
    if date_format == "del":
        return f"{site_slug}-{day}-de-{month}-del-{year}"
    return f"{site_slug}-{day}-de-{month}-{year}"


def extract_sorteo(html):
    """Extract sorteo number from page HTML"""
    match = re.search(r'Sorteo\s+(\d{3,5})', html, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None


def get_draws_without_sorteo(db_id):
    """Get draw dates that are missing sorteo numbers"""
    cmd = (
        f'npx wrangler d1 execute loter-ia-db --remote --json '
        f'--command="SELECT draw_date FROM draws WHERE lottery_id = {db_id} '
        f"AND prize_type = 'mayor' AND sorteo IS NULL "
        f'ORDER BY draw_date DESC"'
    )
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, shell=True)
    try:
        data = json.loads(result.stdout)
        return [r["draw_date"] for r in data[0]["results"]]
    except:
        return []


def main():
    all_updates = []
    total_found = 0
    total_missing = 0

    for lot in LOTTERIES:
        print(f"\n=== {lot['site_slug']} (db_id={lot['db_id']}) ===")

        dates = get_draws_without_sorteo(lot["db_id"])
        print(f"  {len(dates)} draws missing sorteo")

        for date_str in dates:
            slug = date_to_slug(date_str, lot["site_slug"], lot.get("date_format"))
            url = f"{SITE}/{slug}"
            html = fetch(url)

            if not html:
                print(f"  {date_str}: fetch failed")
                total_missing += 1
                time.sleep(0.3)
                continue

            sorteo = extract_sorteo(html)
            if sorteo:
                print(f"  {date_str}: sorteo {sorteo}")
                sql = (
                    f"UPDATE draws SET sorteo = {sorteo} "
                    f"WHERE lottery_id = {lot['db_id']} "
                    f"AND draw_date = '{date_str}' "
                    f"AND prize_type = 'mayor';"
                )
                all_updates.append(sql)
                total_found += 1
            else:
                print(f"  {date_str}: sorteo not found on page")
                total_missing += 1

            time.sleep(0.3)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write("\n".join(all_updates))

    print(f"\n=== Done! ===")
    print(f"Found: {total_found}, Missing: {total_missing}")
    print(f"Generated {len(all_updates)} UPDATE statements in {OUTPUT}")
    print(f"Run: npx wrangler d1 execute loter-ia-db --remote --file={OUTPUT}")


if __name__ == "__main__":
    main()
