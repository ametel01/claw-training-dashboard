# gym531 helper usage

DB: `gym531.db`
Script: `gym531.py`

## Show workout for a day

```bash
python3 gym531.py today --date 2026-02-16
# --date optional (defaults to today)
```

## Log a workout

```bash
python3 gym531.py log \
  --date 2026-02-16 \
  --main 72.5x5,82.5x5,92.5x5 \
  --supp 55x10,55x10,55x10,55x10,55x10 \
  --bodyweight 78.4 \
  --readiness 8 \
  --notes "Felt good"
```

- `--main` is required and expects 3 sets.
- `--supp` is optional; use CSV with `weightxreps` format.
