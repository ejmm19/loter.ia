"""
Scraper de secos faltantes — slugs corregidos para loteriasdehoy.co
"""

import re
import json
import urllib.request
import time
import html as html_module

SITE = "https://loteriasdehoy.co"
OUTPUT = "scripts/scraped_secos_missing.sql"

# Solo las que faltan, con el slug correcto de loteriasdehoy.co
LOTTERIES = [
    {"site_slug": "loteria-de-boyaca", "db_id": 3},
    {"site_slug": "loteria-del-cauca", "db_id": 4},
    {"site_slug": "loteria-de-risaralda", "db_id": 12},
    {"site_slug": "loteria-del-tolima", "db_id": 9},
]

MONTHS_ES = {
    "enero": "01", "febrero": "02", "marzo": "03", "abril": "04",
    "mayo": "05", "junio": "06", "julio": "07", "agosto": "08",
    "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12",
}

def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  Error fetching {url}: {e}")
        return None

def parse_date_from_slug(slug):
    # Handles both "10-de-abril-2026" and "11-de-abril-del-2026"
    match = re.search(r'(\d+)-de-(\w+)-(?:del-)?(\d{4})$', slug)
    if not match:
        return None
    day, month_name, year = match.groups()
    month = MONTHS_ES.get(month_name.lower())
    if not month:
        return None
    return f"{year}-{month}-{day.zfill(2)}"

def get_draw_links(site_slug):
    url = f"{SITE}/{site_slug}/"
    html = fetch(url)
    if not html:
        return []

    # Match links like /loteria-de-boyaca-11-de-abril-del-2026 or /loteria-del-tolima-6-de-abril-2026
    pattern = rf'href="/({re.escape(site_slug)}-\d+-de-\w+-(?:del-)?\d{{4}})"'
    matches = re.findall(pattern, html)

    links = []
    seen = set()
    for m in matches:
        if m in seen:
            continue
        seen.add(m)
        date = parse_date_from_slug(m)
        if date and date >= "2023-10-01":
            links.append((m, date))

    return links

def scrape_secos(draw_slug):
    url = f"{SITE}/{draw_slug}"
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
            premio_clean = re.sub(r'<[^>]+>', '', premio).strip().lower()
            if 'seco' not in premio_clean:
                continue

            numero_clean = re.sub(r'<[^>]+>', '', numero).strip()
            serie_clean = re.sub(r'<[^>]+>', '', serie).strip()
            numero_clean = html_module.unescape(numero_clean)
            serie_clean = html_module.unescape(serie_clean)

            if numero_clean and numero_clean.isdigit():
                secos.append({"number": numero_clean, "series": serie_clean})

    return secos

def main():
    all_inserts = []

    for lot in LOTTERIES:
        print(f"\n=== {lot['site_slug']} (db_id={lot['db_id']}) ===")

        draw_links = get_draw_links(lot["site_slug"])
        print(f"  Found {len(draw_links)} draw pages to scrape")

        for draw_slug, draw_date in draw_links:
            secos = scrape_secos(draw_slug)
            if secos:
                print(f"  {draw_date}: {len(secos)} secos")
                for s in secos:
                    serie_val = f"'{s['series']}'" if s['series'] else "NULL"
                    sql = (
                        f"INSERT OR IGNORE INTO draws (lottery_id, draw_date, number, series, prize_type, source) "
                        f"VALUES ({lot['db_id']}, '{draw_date}', '{s['number']}', {serie_val}, 'seco', 'loteriasdehoy.co');"
                    )
                    all_inserts.append(sql)

            time.sleep(0.5)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write("\n".join(all_inserts))

    print(f"\n=== Done! Generated {len(all_inserts)} INSERT statements in {OUTPUT} ===")

if __name__ == "__main__":
    main()
