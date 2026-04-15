# Pendientes — Loterías de Hoy

## Datos

- [ ] **Insertar 20,018 secos scrapeados** — archivo listo en `api/scripts/scraped_secos_complete.sql`. Ejecutar:
  ```bash
  cd api && npx wrangler d1 execute loter-ia-db --remote --file=scripts/scraped_secos_complete.sql
  ```
- [ ] **Gap de datos 2023-2025** — No hay fuente para premios mayor entre oct 2023 y abr 2025. datos.gov.co llega hasta sep 2023, el feed actual empieza en abr 2025.
- [ ] **Secos en ingesta diaria** — El feed `api-resultadosloterias.com` solo trae premio mayor. Evaluar agregar scraping automático de secos desde loteriasdehoy.co al cron diario.
- [ ] **Logo Cruz Roja** — El servidor bloqueó la descarga. Descargar manualmente y poner en `frontend/public/logos/cruz-roja/logo.png`.
- [ ] **Logo Cauca** — Mismo problema, descargar manualmente a `frontend/public/logos/loteria-del-cauca/logo.png`.

## Frontend

- [ ] **Deploy frontend** — Hubo un error de `_redirects` en Cloudflare Pages al intentar deploy. Revisar configuración.
- [ ] **Página interna de lotería** — Conectar el `<app-checker>` dentro de la vista de detalle.
- [ ] **Item "Iniciar Sesión"** — No tiene funcionalidad. Definir si se mantiene o se quita.
- [ ] **Extra de Colombia** — No tiene secos ni `draw_day`. Evaluar si se muestra diferente.
- [ ] **Responsive del slider** — En tablet algunos logos con taglines largos se solapan con las bolitas.

## API

- [ ] **Deploy API** — Último deploy exitoso con endpoints: hot-numbers, check, secos, slug lookup.
- [ ] **Ingesta de secos en cron** — Considerar agregar scraping de secos post-ingesta de mayor en el scheduled handler.

## Ideas futuras

- [ ] Crear páginas internas para cada lotería (template ya existe en `/loteria/:slug`).
- [ ] Sección de horarios de sorteos.
- [ ] SEO: meta tags dinámicos por lotería.
- [ ] PWA / notificaciones push de resultados.
