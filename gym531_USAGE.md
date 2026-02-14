# gym531 helper usage (separated tracks)

DB: `gym531.db`
Script: `gym531.py`

Tracks are separated in DB:
- Barbell AM: `barbell_sessions`, `barbell_set_logs`
- Rings PM: `rings_sessions`, `rings_logs`
- Cardio: `cardio_sessions`, `cardio_intervals`

## Barbell (AM)

Show workout:
```bash
python3 gym531.py today --date 2026-02-16
```

Log easy mode:
```bash
python3 gym531.py log --date 2026-02-16 --main-reps 5,5,4 --supp-completed --notes "Missed 1 rep top set"
```

## Rings (PM)

Show template:
```bash
python3 gym531.py rings-today --date 2026-02-16
```

Log:
```bash
python3 gym531.py rings-log --date 2026-02-16 --template A --completed --notes "solid"
```

## Cardio

Show daily cardio plan:
```bash
python3 gym531.py cardio-today --date 2026-02-18
```

Log cardio:
```bash
python3 gym531.py cardio-log --date 2026-02-18 --protocol VO2_4x4 --duration 40 --avg-hr 151 --max-hr 170 --notes "good intervals"
```

Track cardio benchmark progress (separate table):
```bash
python3 gym531.py cardio-progress-add --date 2026-02-14 --duration 30 --speed 6.5 --incline 1 --final-bpm 130 --notes "baseline"
python3 gym531.py cardio-progress-show
```
