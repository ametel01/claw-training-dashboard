# gym531 helper usage (separated tracks)

DB: `training_dashboard.db`
Script: `bun run gym531 --`

Tracks are separated in DB:
- Barbell AM: `barbell_sessions`, `barbell_set_logs`
- Rings PM: `rings_sessions`, `rings_logs`
- Cardio: `cardio_sessions`, `cardio_intervals`

## Barbell (AM)

Show workout:
```bash
bun run gym531 -- today --date 2026-02-16
```

Log easy mode:
```bash
bun run gym531 -- log --date 2026-02-16 --main-reps 5,5,4 --supp-completed --notes "Missed 1 rep top set"
```

## Rings (PM)

Show template:
```bash
bun run gym531 -- rings-today --date 2026-02-16
```

Log:
```bash
bun run gym531 -- rings-log --date 2026-02-16 --template A --completed --notes "solid"
```

## Cardio

Show daily cardio plan:
```bash
bun run gym531 -- cardio-today --date 2026-02-18
```

Log cardio:
```bash
bun run gym531 -- cardio-log --date 2026-02-18 --protocol VO2_4x4 --duration 40 --avg-hr 151 --max-hr 170 --notes "good intervals"
```

Track cardio benchmark progress (separate table):
```bash
bun run gym531 -- cardio-progress-add --date 2026-02-14 --duration 30 --speed 6.5 --incline 1 --final-bpm 130 --notes "baseline"
bun run gym531 -- cardio-progress-show
```
