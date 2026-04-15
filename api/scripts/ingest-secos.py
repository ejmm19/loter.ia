"""
Ingesta de premios secos desde datos.gov.co
Genera SQL para insertar en D1.

Uso:
  cd api
  python scripts/ingest-secos.py
  npx wrangler d1 execute loter-ia-db --remote --file=scripts/secos_inserts.sql
"""

import json
import urllib.request
import urllib.parse

API = "https://www.datos.gov.co/resource/i3kx-3zps.json"
OUTPUT = "scripts/secos_inserts.sql"
BATCH_SIZE = 5000

def fetch_data(offset=0):
    params = urllib.parse.urlencode({
        "$limit": BATCH_SIZE,
        "$offset": offset,
        "$where": "tipo_de_premio='Secos' AND a_o_del_sorteo>='2020'",
        "$order": "fecha_del_sorteo DESC",
    })
    url = f"{API}?{params}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def parse_date(raw):
    parts = raw.strip().split("/")
    if len(parts) != 3:
        return None
    d, m, y = parts
    return f"{y}-{m.zfill(2)}-{d.zfill(2)}"

def main():
    all_inserts = []
    offset = 0

    while True:
        print(f"Fetching offset={offset}...")
        data = fetch_data(offset)
        if not data:
            break

        for row in data:
            loteria = row.get("loter_a", "").strip()
            fecha_raw = row.get("fecha_del_sorteo", "").strip()
            numero = row.get("numero_billete_ganador", "").strip()
            serie = row.get("numero_serie_ganadora", "").strip()
            sorteo_str = row.get("n_mero_del_sorteo", "").strip()

            if not loteria or not fecha_raw or not numero:
                continue

            fecha = parse_date(fecha_raw)
            if not fecha or fecha >= "2025-04-03":
                continue

            loteria_esc = loteria.replace("'", "''")
            numero_esc = numero.replace("'", "''")
            serie_val = f"'{serie}'" if serie else "NULL"
            sorteo_val = sorteo_str if sorteo_str.isdigit() else "NULL"

            sql = (
                f"INSERT OR IGNORE INTO draws (lottery_id, draw_date, number, series, sorteo, prize_type, source) "
                f"SELECT id, '{fecha}', '{numero_esc}', {serie_val}, {sorteo_val}, 'seco', 'datos.gov.co' "
                f"FROM lotteries WHERE source_name = '{loteria_esc}' AND active = 1;"
            )
            all_inserts.append(sql)

        print(f"  Got {len(data)} records, total inserts: {len(all_inserts)}")

        if len(data) < BATCH_SIZE:
            break
        offset += BATCH_SIZE

    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write("\n".join(all_inserts))

    print(f"\nDone! Generated {len(all_inserts)} INSERT statements in {OUTPUT}")
    print(f"Run: npx wrangler d1 execute loter-ia-db --remote --file={OUTPUT}")

if __name__ == "__main__":
    main()
