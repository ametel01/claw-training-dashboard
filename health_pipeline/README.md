# Dual-Source Health Pipeline (Apple Health + Polar)

This pipeline is **additive** and does not touch the existing `gym531` flow.
It is designed for backward compatibility while you keep using the current dashboard.

## What it does

- Ingests raw exports from:
  - `imports/raw/apple/**/export.xml`
  - `imports/raw/polar/**/*.tcx`
  - `imports/raw/polar/**/*.csv`
  - `imports/raw/polar/**/*.fit` (placeholder: metadata + anomaly unless FIT parser added)
- Normalizes into NDJSON files:
  - `normalized/workouts.ndjson`
  - `normalized/hr_samples.ndjson`
  - `normalized/daily_recovery.ndjson`
  - `normalized/sleep_sessions.ndjson`
  - `normalized/daily_activity.ndjson`
  - `normalized/workout_metrics.ndjson`
- Emits SQL upserts:
  - `sql/upserts.sql`
- Emits anomaly + ingestion report:
  - `logs/ingestion-YYYY-MM-DD.md`

## Backward compatibility

- Existing `training_dashboard.db` and dashboard exporter are untouched.
- This pipeline writes to its own output folders only.
- Your backend can choose when to execute generated SQL in Postgres.

## Daily Dropbox Convention (recommended)

Use fixed folders so you never think about dates:

- Apple: `imports/raw/apple/latest/`
  - drop either `export.xml` **or** `export.zip`
- Polar: `imports/raw/polar/latest/`
  - drop `.tcx`, `.csv`, `.fit`

The pipeline scans recursively, so dated folders still work too.

## Run

```bash
bun run health:pipeline -- \
  --user-id 00000000-0000-0000-0000-000000000001 \
  --input-root imports/raw \
  --output-root imports
```

Optional config:

```bash
bun run health:pipeline -- ... --config health_pipeline/config.example.json
```

## Notes

- HR zone model is HRR by default.
- `effective_hr_rest` = 14-day median from Apple resting HR (fallback from config).
- `effective_hr_max` = `hr_max_override` > observed max > `hr_max_default`.
- Polar workout HR has higher quality than watch/manual.
- FIT parsing is scaffolded; add a FIT parser lib later for full second-level extraction.
