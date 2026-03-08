# Training Dashboard

Standalone training dashboard repository.

## Run

```bash
bun install
bun run build
bun run export:data
./scripts/start_training_dashboard.sh
# or: PORT=8080 PYTHON_BIN=python3 python3 dashboard/server.py
```

Open:

- http://127.0.0.1:8080/dashboard/

## Included

- `dashboard/` UI + API server
- `dashboard/src/` TypeScript sources for the browser app and exporter
- `health_pipeline/` data ingestion pipeline
- `training_dashboard.db` + SQL/bootstrap helpers
- `gym531.py` utilities
