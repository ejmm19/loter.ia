#!/bin/bash
# Ingesta histórica desde datos.gov.co
# Trae resultados "Mayor" desde 2024-01-01 hasta 2025-04-02 (donde empieza nuestro feed actual)
# Ejecutar desde api/: bash scripts/ingest-historical.sh

set -e

API="https://www.datos.gov.co/resource/i3kx-3zps.json"
DB_NAME="loter-ia-db"
BATCH_SIZE=1000
OFFSET=0
TOTAL_INSERTED=0

echo "=== Ingesta histórica de datos.gov.co ==="
echo "Trayendo resultados 'Mayor' desde 2024..."

while true; do
  echo "Fetching offset=$OFFSET..."

  DATA=$(curl -s "$API?\$limit=$BATCH_SIZE&\$offset=$OFFSET&\$where=tipo_de_premio='Mayor' AND a_o_del_sorteo>='2024'&\$order=fecha_del_sorteo DESC")

  COUNT=$(echo "$DATA" | python -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  if [ "$COUNT" = "0" ]; then
    echo "No more records at offset=$OFFSET"
    break
  fi

  echo "Got $COUNT records, processing..."

  # Convertir cada registro a un INSERT SQL
  INSERTS=$(echo "$DATA" | python -c "
import sys, json
from datetime import datetime

data = json.load(sys.stdin)
for row in data:
    if row.get('tipo_de_premio','').strip() != 'Mayor':
        continue

    loteria = row.get('loter_a','').strip()
    fecha_raw = row.get('fecha_del_sorteo','').strip()
    numero = row.get('numero_billete_ganador','').strip()
    serie = row.get('numero_serie_ganadora','').strip()
    sorteo_str = row.get('n_mero_del_sorteo','').strip()

    if not loteria or not fecha_raw or not numero:
        continue

    # Parsear fecha d/m/yyyy -> yyyy-mm-dd
    try:
        parts = fecha_raw.split('/')
        if len(parts) == 3:
            d, m, y = parts
            fecha = f'{y}-{m.zfill(2)}-{d.zfill(2)}'
        else:
            continue
    except:
        continue

    # Solo desde 2024-01-01 hasta 2025-04-02
    if fecha < '2024-01-01' or fecha >= '2025-04-03':
        continue

    sorteo = int(sorteo_str) if sorteo_str.isdigit() else 'NULL'
    serie_val = serie if serie else 'NULL'

    # Escapar comillas simples
    loteria = loteria.replace(\"'\", \"''\")
    numero = numero.replace(\"'\", \"''\")
    if serie_val != 'NULL':
        serie_val = f\"'{serie_val}'\"

    sorteo_val = sorteo if sorteo != 'NULL' else 'NULL'

    print(f\"INSERT OR IGNORE INTO draws (lottery_id, draw_date, number, series, sorteo, prize_type, source) SELECT id, '{fecha}', '{numero}', {serie_val}, {sorteo_val}, 'mayor', 'datos.gov.co' FROM lotteries WHERE source_name = '{loteria}' AND active = 1;\")
")

  if [ -n "$INSERTS" ]; then
    # Ejecutar en lotes
    echo "$INSERTS" | while IFS= read -r sql; do
      npx wrangler d1 execute "$DB_NAME" --remote --command="$sql" 2>/dev/null
    done

    BATCH_INSERTED=$(echo "$INSERTS" | wc -l)
    TOTAL_INSERTED=$((TOTAL_INSERTED + BATCH_INSERTED))
    echo "Processed $BATCH_INSERTED inserts (total: $TOTAL_INSERTED)"
  fi

  OFFSET=$((OFFSET + BATCH_SIZE))

  if [ "$COUNT" -lt "$BATCH_SIZE" ]; then
    echo "Last batch (got $COUNT < $BATCH_SIZE)"
    break
  fi
done

echo "=== Done! Total SQL inserts attempted: $TOTAL_INSERTED ==="
echo "Run this to verify: npx wrangler d1 execute $DB_NAME --remote --command=\"SELECT MIN(draw_date), MAX(draw_date), COUNT(*) FROM draws\""
