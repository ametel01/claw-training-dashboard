# Gym531 Local Dashboard

Dark-themed static dashboard for the `training_dashboard.db` data.

## Files

- `index.html` – UI shell
- `styles.css` – dashboard styling
- `app.js` – generated Bun build output for the browser
- `src/main.ts` – dashboard frontend source
- `src/export-data.ts` – dashboard data exporter source

## Generate data

From workspace root:

```bash
bun run export:data
```

This writes/refreshes:

- `dashboard/data.json`

## Run locally

From workspace root:

```bash
bun run build
bun run start
```

Then open:

- http://localhost:8080/
- http://localhost:8080/dashboard/

## Notes

- Uses existing schema/tables/views from `training_dashboard.db`.
- Weekly rows are anchored to the latest logged training date.
- Daily tiles show the latest 14-day window ending on latest logged date.

## Refresh APIs

- `POST /api/refresh` → existing dashboard export refresh.
- `POST /api/refresh?includeHealth=1` → run health dual-source pipeline first, then refresh dashboard export.
- `POST /api/refresh-health` → same as above (explicit endpoint).

Environment variables for health pipeline:

- `HEALTH_PIPELINE_USER_ID` (default: `00000000-0000-0000-0000-000000000001`)
- `HEALTH_PIPELINE_INPUT_ROOT` (default: `imports/raw`)
- `HEALTH_PIPELINE_OUTPUT_ROOT` (default: `imports`)
- `HEALTH_PIPELINE_CONFIG` (optional path)
