# gym531 helper usage

DB: `gym531.db`
Script: `gym531.py`

## Show workout for a day

```bash
python3 gym531.py today --date 2026-02-16
# --date optional (defaults to today)
```

## Log workout (easy mode: reps only)

If weights were as prescribed, log only reps:

```bash
python3 gym531.py log \
  --date 2026-02-16 \
  --main-reps 5,5,4 \
  --supp-completed \
  --bodyweight 78.4 \
  --readiness 8 \
  --notes "Missed 1 rep on top set"
```

If everything was completed as prescribed, you can omit both `--main` and `--main-reps` and it will auto-log prescribed reps/weights.

## Log workout (full mode with exact weights)

```bash
python3 gym531.py log \
  --date 2026-02-16 \
  --main 72.5x5,82.5x5,92.5x5 \
  --supp 55x10,55x10,55x10,55x10,55x10 \
  --bodyweight 78.4 \
  --readiness 8 \
  --notes "Felt good"
```

- `--main` expects exactly 3 sets.
- `--main-reps` expects exactly 3 reps.
- `--supp` is optional; use CSV with `weightxreps` format.
- `--supp-completed` auto-logs all prescribed supplemental sets.
