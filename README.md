# Training Dashboard

Standalone training dashboard repository.

## Run

```bash
./scripts/start_training_dashboard.sh
# or: PORT=8080 python3 dashboard/server.py
```

Open:

- http://127.0.0.1:8080/dashboard/

## Included

- `dashboard/` UI + API server
- `health_pipeline/` data ingestion pipeline
- `training_dashboard.db` + SQL/bootstrap helpers
- `gym531.py` utilities
