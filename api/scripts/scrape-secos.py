"""
Scraper de premios secos desde loteriasdehoy.co
Genera SQL para insertar en D1.

Uso:
  cd api
  python scripts/scrape-secos.py
  npx wrangler d1 execute loter-ia-db --remote --file=scripts/scraped_secos.sql
"""

import re
import json
import urllib.request
import time
import html as html_module

SITE = "https://loteriasdehoy.co"
OUTPUT = "scripts/scraped_secos.sql"

LOTTERIES = [
    {"slug": "loteria-de-medellin", "id": 2},
    {"slug": "loteria-de-bogota", "id": 1},
    {"slug": "loteria-de-boyaca", "id": 3},
    {"slug": "loteria-del-cauca", "id": 4},
    {"slug": "loteria-de-cundinamarca", "id": 5},
    {"slug": "loteria-de-manizales", "id": 6},
    {"slug": "loteria-del-meta", "id": 7},
    {"slug": "loteria-de-santander", "id": 8},
    {"slug": "loteria-del-tolima", "id": 9},
    {"slug": "loteria-del-valle", "id": 10},
    {"slug": "loteria-del-quindio", "id": 11},
    {"slug": "loteria-del-risaralda", "id": 12},
    {"slug": "loteria-del-huila", "id": 13},
    {"slug": "loteria-de-la-cruz-roja", "id": 15},
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
    """Parse date from slug like 'loteria-de-medellin-10-de-abril-2026'"""
    match = re.search(r'(\d+)-de-(\w+)-(\d{4})$', slug)
    if not match:
        return None
    day, month_name, year = match.groups()
    month = MONTHS_ES.get(month_name.lower())
    if not month:
        return None
    return f"{year}-{month}-{day.zfill(2)}"

def get_draw_links(lottery_slug):
    """Get individual draw page links from lottery main page"""
    url = f"{SITE}/{lottery_slug}/"
    html = fetch(url)
    if not html:
        return []

    pattern = rf'href="/{re.escape(lottery_slug)}-(\d+-de-\w+-\d{{4}})"'
    matches = re.findall(pattern, html)

    links = []
    for m in matches:
        full_slug = f"{lottery_slug}-{m}"
        date = parse_date_from_slug(full_slug)
        if date and date >= "2023-10-01":  # From where datos.gov.co stopped
            links.append((full_slug, date))

    return links

def scrape_secos(draw_slug):
    """Scrape secos from individual draw page"""
    url = f"{SITE}/{draw_slug}"
    html = fetch(url)
    if not html:
        return []

    # Find the secos table
    tables = re.findall(r'<table[^>]*>(.*?)</table>', html, re.DOTALL)

    secos = []
    for table in tables:
        rows = re.findall(
            r'<tr[^>]*>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*</tr>',
            table, re.DOTALL
        )
        for premio, numero, serie in rows:
            premio_clean = re.sub(r'<[^>]+>', '', premio).strip().lower()
            if 'seco' not in premio_clean and 'premio' not in premio_clean:
                continue
            if 'premio' == premio_clean or 'número' in premio_clean:
                continue  # Skip header row

            numero_clean = re.sub(r'<[^>]+>', '', numero).strip()
            serie_clean = re.sub(r'<[^>]+>', '', serie).strip()

            # Decode HTML entities
            numero_clean = html_module.unescape(numero_clean)
            serie_clean = html_module.unescape(serie_clean)

            if numero_clean and numero_clean.isdigit():
                secos.append({"number": numero_clean, "series": serie_clean})

    return secos

def main():
    all_inserts = []

    for lot in LOTTERIES:
        print(f"\n=== {lot['slug']} (id={lot['id']}) ===")

        draw_links = get_draw_links(lot["slug"])
        print(f"  Found {len(draw_links)} draw pages to scrape")

        for draw_slug, draw_date in draw_links:
            secos = scrape_secos(draw_slug)
            if secos:
                print(f"  {draw_date}: {len(secos)} secos")
                for s in secos:
                    serie_val = f"'{s['series']}'" if s['series'] else "NULL"
                    sql = (
                        f"INSERT OR IGNORE INTO draws (lottery_id, draw_date, number, series, prize_type, source) "
                        f"VALUES ({lot['id']}, '{draw_date}', '{s['number']}', {serie_val}, 'seco', 'loteriasdehoy.co');"
                    )
                    all_inserts.append(sql)

            time.sleep(0.5)  # Be respectful

    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write("\n".join(all_inserts))

    print(f"\n=== Done! Generated {len(all_inserts)} INSERT statements in {OUTPUT} ===")

if __name__ == "__main__":
    main()
