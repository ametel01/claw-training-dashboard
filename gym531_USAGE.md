# gym531 helper usage

DB: `gym531.db`
Script: `gym531.py`

## Barbell (AM) - show workout

```bash
python3 gym531.py today --date 2026-02-16
# --date optional (defaults to today)
```

## Barbell (AM) - log (easy mode: reps only)

```bash
python3 gym531.py log \
  --date 2026-02-16 \
  --main-reps 5,5,4 \
  --supp-completed \
  --bodyweight 78.4 \
  --readiness 8 \
  --notes "Missed 1 rep on top set"
```

If everything was completed as prescribed, you can omit both `--main` and `--main-reps`.

## Rings (PM) - show template

```bash
python3 gym531.py rings-today --date 2026-02-16
# Auto-rotates A->B->C->D based on last logged rings session.
# Or force template:
python3 gym531.py rings-today --date 2026-02-16 --template B
```

## Rings (PM) - log session

Completed as planned:

```bash
python3 gym531.py rings-log --date 2026-02-16 --template A --completed --notes "solid"
```

Completed with changes/missed reps:

```bash
python3 gym531.py rings-log \
  --date 2026-02-16 \
  --template A \
  --missed "Assisted Ring Dips: last set 4 instead of 5" \
  --notes "rings shaky, regressed"
```
