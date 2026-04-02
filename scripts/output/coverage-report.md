# Coverage Report — Colombian Lottery Historical Data

**Generated:** 2026-04-02T20:10:18.377Z
**Source:** datos.gov.co SODA API (dataset `i3kx-3zps`)
**Total draws imported:** 2608

## Coverage by Lottery

| Lottery | Draws | From | To |
|---------|-------|------|----|
| Cruz Roja | 186 | 2020-01-08 | 2023-09-13 |
| Extra de Colombia | 40 | 2020-02-03 | 2023-08-29 |
| Lotería de Bogotá | 187 | 2020-01-08 | 2023-09-18 |
| Lotería de Boyacá | 187 | 2020-01-08 | 2023-09-18 |
| Lotería de Cundinamarca | 183 | 2020-01-08 | 2023-09-12 |
| Lotería de Manizales | 185 | 2020-01-08 | 2023-09-18 |
| Lotería de Medellín | 182 | 2020-01-08 | 2023-09-18 |
| Lotería de Santander | 182 | 2020-01-08 | 2023-09-18 |
| Lotería del Cauca | 181 | 2020-01-08 | 2023-09-18 |
| Lotería del Huila | 184 | 2020-01-08 | 2023-09-13 |
| Lotería del Meta | 182 | 2020-01-08 | 2023-09-18 |
| Lotería del Quindío | 183 | 2020-01-08 | 2023-09-18 |
| Lotería del Risaralda | 179 | 2020-01-08 | 2023-09-18 |
| Lotería del Tolima | 183 | 2020-01-08 | 2023-09-12 |
| Lotería del Valle | 184 | 2020-01-08 | 2023-09-18 |

## Not Available in datos.gov.co

### Baloto
**Reason:** Not in datos.gov.co dataset. Available on Kaggle (jaforero/baloto-colombia) or via web scraping from baloto.com. Requires manual download.

### Baloto Revancha
**Reason:** Not in datos.gov.co dataset. Same source as Baloto (same draw event, secondary prize pool). Requires Kaggle download or web scraping.

## How to Apply

```bash
# Apply migration for missing lotteries first:
cd api && npx wrangler d1 migrations apply loter-ia-db --local

# Then import historical data:
cd api && npx wrangler d1 execute loter-ia-db --local --file=../scripts/output/historical_draws.sql

# For production (remote):
cd api && npx wrangler d1 migrations apply loter-ia-db --remote
cd api && npx wrangler d1 execute loter-ia-db --remote --file=../scripts/output/historical_draws.sql
```
