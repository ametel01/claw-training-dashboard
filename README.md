# Training Dashboard

Standalone training dashboard repository.

## Run

```bash
bun install
bun run build
PORT=8090 ./scripts/start_training_dashboard.sh
# or: PORT=8080 bun run start
```

Open:

- http://127.0.0.1:8080/
- http://127.0.0.1:8080/dashboard/

## Included

- `dashboard/` legacy dashboard UI
- `dashboard/src/` TypeScript sources for the browser app and exporter
- `server/src/` unified TypeScript Node backend + CLI tools
- `health_pipeline/` health pipeline config/docs
- `training_dashboard.db` + SQL/bootstrap helpers
- `gym531_USAGE.md` CLI usage
