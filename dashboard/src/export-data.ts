#!/usr/bin/env bun
import { execSync } from 'node:child_process'
import { homedir } from 'node:os'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

type JsonRow = Record<string, any>
type JsonRows = JsonRow[]

const repoRoot = resolve(process.env.CLAW_REPO_ROOT ?? process.cwd())
const dbStateRoot = resolve(
  process.env.CLAW_DB_STATE_ROOT ?? resolve(homedir(), '.openclaw', 'state', 'claw-training-dashboard')
)
const dbPath = resolve(process.env.CLAW_DB_PATH ?? resolve(dbStateRoot, 'training_dashboard.db'))
const outPath = resolve(repoRoot, 'dashboard', 'data.json')

function sqlJson(sql: string): JsonRows {
  const escaped = sql.replace(/"/g, '\\"').replace(/\n/g, ' ')
  const cmd = `sqlite3 -json \"${dbPath}\" \"${escaped}\"`
  const raw = execSync(cmd, { encoding: 'utf8' }).trim()
  return raw ? (JSON.parse(raw) as JsonRows) : []
}

function groupByDate(rows: JsonRows, key = 'session_date'): Record<string, JsonRows> {
  return rows.reduce<Record<string, JsonRows>>((acc, row) => {
    const dateKey = String(row[key] ?? '')
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(row)
    return acc
  }, {})
}

execSync(`sqlite3 "${dbPath}" "
CREATE TABLE IF NOT EXISTS deload_profiles (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  main_set_scheme_json TEXT,
  assistance_mode TEXT NOT NULL DEFAULT 'reduced',
  cardio_mode TEXT NOT NULL DEFAULT 'light',
  rings_mode TEXT NOT NULL DEFAULT 'light',
  default_days INTEGER NOT NULL DEFAULT 7,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS cycle_events (
  id INTEGER PRIMARY KEY,
  event_date TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('new_cycle','deload_applied','tm_test')),
  deload_code TEXT,
  block_no INTEGER,
  note TEXT,
  created_by TEXT NOT NULL DEFAULT 'dashboard',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS deload_blocks (
  id INTEGER PRIMARY KEY,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  deload_code TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS planned_barbell_sets_snapshot (
  id INTEGER PRIMARY KEY,
  session_date TEXT NOT NULL,
  block_no INTEGER,
  block_type TEXT,
  week_in_block INTEGER,
  day_name TEXT,
  category TEXT NOT NULL,
  lift TEXT NOT NULL,
  set_no INTEGER NOT NULL,
  prescribed_reps INTEGER,
  prescribed_pct REAL,
  planned_weight_kg REAL,
  source_tm_kg REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_date, category, lift, set_no)
);
INSERT OR IGNORE INTO deload_profiles(code,name,description,main_set_scheme_json,assistance_mode,cardio_mode,rings_mode,default_days) VALUES
('CLASSIC_40_50_60','Classic 5/3/1 Deload','Week 4 style deload', '[{\"pct\":0.40,\"reps\":5},{\"pct\":0.50,\"reps\":5},{\"pct\":0.60,\"reps\":5}]','reduced','light','light',7),
('WEEK7_LIGHT','7th Week Deload','Modern 7th week deload', '[{\"pct\":0.40,\"reps\":5},{\"pct\":0.50,\"reps\":5},{\"pct\":0.60,\"reps\":5}]','reduced','light','light',7),
('TM_TEST','Training Max Test Week','70/80/90/100 TM test', '[{\"pct\":0.70,\"reps\":5},{\"pct\":0.80,\"reps\":5},{\"pct\":0.90,\"reps\":3},{\"pct\":1.00,\"reps\":3}]','normal','normal','normal',7),
('FULL_BODY_TECH','Full-body Technique Deload','Low fatigue technique week', '[{\"pct\":0.40,\"reps\":5},{\"pct\":0.50,\"reps\":5},{\"pct\":0.60,\"reps\":5}]','reduced','light','light',7),
('MINIMAL_WARMUP','Minimal Deload (Warm-up only)','Warm-up sets only', '[]','off','optional','optional',3);
INSERT OR IGNORE INTO planned_barbell_sets_snapshot(
  session_date, block_no, block_type, week_in_block, day_name,
  category, lift, set_no, prescribed_reps, prescribed_pct, planned_weight_kg, source_tm_kg
)
SELECT
  p.session_date, p.block_no, p.block_type, p.week_in_block, p.day_name,
  p.category, p.lift, p.set_no, p.prescribed_reps, p.prescribed_pct, p.planned_weight_kg,
  ROUND(CASE WHEN p.prescribed_pct > 0 THEN p.planned_weight_kg / p.prescribed_pct ELSE NULL END, 2) AS source_tm_kg
FROM v_planned_barbell_sets p;
"`)

const totals =
  sqlJson(`
WITH latest AS (
  SELECT MAX(session_date) AS latest_date
  FROM (
    SELECT session_date FROM barbell_sessions
    UNION ALL SELECT session_date FROM cardio_sessions
    UNION ALL SELECT session_date FROM rings_sessions
  )
),
range_14 AS (
  SELECT date(latest_date, '-13 day') AS start_date, latest_date FROM latest
),
active_days AS (
  SELECT COUNT(*) AS days_trained
  FROM (
    SELECT session_date FROM v_training_day_summary, range_14
    WHERE session_date BETWEEN start_date AND latest_date
  )
)
SELECT
  (SELECT COUNT(*) FROM barbell_sessions) AS barbell_sessions,
  (SELECT COUNT(*) FROM cardio_sessions) AS cardio_sessions,
  (SELECT COUNT(*) FROM rings_sessions) AS rings_sessions,
  (SELECT COUNT(*) FROM v_training_day_summary) AS total_training_days,
  (SELECT days_trained FROM active_days) AS active_days_last_14,
  (SELECT latest_date FROM latest) AS latest_date
`)[0] ?? {}

const weekProgress = sqlJson(`
WITH week_window AS (
  SELECT
    date('now','localtime') AS anchor_date,
    date('now','localtime', '-' || (((CAST(strftime('%w', date('now','localtime')) AS INTEGER) + 6) % 7)) || ' day') AS week_start
),
weekdays AS (
  SELECT 1 AS weekday, 'Monday' AS day_name
  UNION ALL SELECT 2, 'Tuesday'
  UNION ALL SELECT 3, 'Wednesday'
  UNION ALL SELECT 4, 'Thursday'
  UNION ALL SELECT 5, 'Friday'
  UNION ALL SELECT 6, 'Saturday'
  UNION ALL SELECT 7, 'Sunday'
),
days AS (
  SELECT
    wd.weekday,
    wd.day_name,
    date(ww.week_start, '+' || (wd.weekday - 1) || ' day') AS session_date
  FROM weekdays wd
  CROSS JOIN week_window ww
)
SELECT
  d.weekday,
  d.day_name,
  d.session_date,
  COALESCE(ps.pain_level, 'green') AS pain_level,
  l.name AS main_lift,
  td.supplemental_sets,
  cpd.session_type AS cardio_plan,
  CASE
    WHEN rpd.template_code IS NOT NULL AND rpe.extra_templates IS NOT NULL THEN rpd.template_code || '+' || rpe.extra_templates
    WHEN rpd.template_code IS NOT NULL THEN rpd.template_code
    ELSE rpe.extra_templates
  END AS rings_plan,
  CASE WHEN bs.id IS NOT NULL THEN 1 ELSE 0 END AS barbell_done,
  CASE WHEN cs.id IS NOT NULL THEN 1 ELSE 0 END AS cardio_done,
  CASE WHEN rs.id IS NOT NULL THEN 1 ELSE 0 END AS rings_done
FROM days d
LEFT JOIN schedule_overrides so ON so.session_date = d.session_date
LEFT JOIN rings_schedule_overrides ro ON ro.session_date = d.session_date
LEFT JOIN cardio_schedule_overrides co ON co.session_date = d.session_date
LEFT JOIN recovery_status ps ON ps.session_date = d.session_date
LEFT JOIN training_days td ON td.weekday = CASE
  WHEN COALESCE(so.force_off,0)=1 THEN NULL
  WHEN so.source_weekday IS NOT NULL THEN so.source_weekday
  ELSE d.weekday
END
LEFT JOIN lifts l ON l.id = td.main_lift_id
LEFT JOIN cardio_plan_days cpd ON cpd.weekday = CASE
  WHEN COALESCE(co.force_off,0)=1 THEN NULL
  WHEN co.source_weekday IS NOT NULL THEN co.source_weekday
  ELSE d.weekday
END
LEFT JOIN rings_plan_days rpd ON rpd.weekday = CASE
  WHEN COALESCE(ro.force_off,0)=1 THEN NULL
  WHEN ro.source_weekday IS NOT NULL THEN ro.source_weekday
  ELSE d.weekday
END
LEFT JOIN (
  SELECT session_date, group_concat(template_code, '+') AS extra_templates
  FROM rings_plan_extras
  GROUP BY session_date
) rpe ON rpe.session_date = d.session_date
LEFT JOIN barbell_sessions bs ON bs.session_date = d.session_date
LEFT JOIN cardio_sessions cs ON cs.session_date = d.session_date
LEFT JOIN rings_sessions rs ON rs.session_date = d.session_date
ORDER BY d.weekday
`)

const dailyTiles = sqlJson(`
WITH RECURSIVE
bounds AS (
  SELECT
    date('now','localtime','-13 day') AS start_date,
    date('now','localtime') AS end_date
),
dates(day) AS (
  SELECT (SELECT start_date FROM bounds)
  UNION ALL
  SELECT date(day, '+1 day') FROM dates
  WHERE day < (SELECT end_date FROM bounds)
),
base AS (
  SELECT
    d.day AS session_date,
    ((CAST(strftime('%w', d.day) AS INTEGER) + 6) % 7) + 1 AS weekday
  FROM dates d
)
SELECT
  b.session_date,
  COALESCE(ps.pain_level, 'green') AS pain_level,
  ps.note AS pain_note,
  CASE WHEN bs.id IS NOT NULL THEN 1 ELSE 0 END AS has_barbell,
  CASE WHEN cs.id IS NOT NULL THEN 1 ELSE 0 END AS has_cardio,
  CASE WHEN rs.id IS NOT NULL THEN 1 ELSE 0 END AS has_rings,
  l.name AS barbell_lift,
  cs.protocol AS cardio_protocol,
  rs.template AS rings_template,
  pl_main.name AS planned_barbell_main,
  pl_supp.name AS planned_barbell_supp,
  td.supplemental_sets AS planned_supp_sets,
  td.supplemental_reps AS planned_supp_reps,
  cpd.session_type AS planned_cardio,
  CASE
    WHEN rpd.template_code IS NOT NULL AND rpe.extra_templates IS NOT NULL THEN rpd.template_code || '+' || rpe.extra_templates
    WHEN rpd.template_code IS NOT NULL THEN rpd.template_code
    ELSE rpe.extra_templates
  END AS planned_rings
FROM base b
LEFT JOIN schedule_overrides so ON so.session_date = b.session_date
LEFT JOIN rings_schedule_overrides ro ON ro.session_date = b.session_date
LEFT JOIN cardio_schedule_overrides co ON co.session_date = b.session_date
LEFT JOIN recovery_status ps ON ps.session_date = b.session_date
LEFT JOIN barbell_sessions bs ON bs.session_date = b.session_date
LEFT JOIN training_days td_done ON td_done.id = bs.day_id
LEFT JOIN lifts l ON l.id = td_done.main_lift_id
LEFT JOIN cardio_sessions cs ON cs.session_date = b.session_date
LEFT JOIN rings_sessions rs ON rs.session_date = b.session_date
LEFT JOIN training_days td ON td.weekday = CASE
  WHEN COALESCE(so.force_off,0)=1 THEN NULL
  WHEN so.source_weekday IS NOT NULL THEN so.source_weekday
  ELSE b.weekday
END
LEFT JOIN lifts pl_main ON pl_main.id = td.main_lift_id
LEFT JOIN lifts pl_supp ON pl_supp.id = td.supplemental_lift_id
LEFT JOIN cardio_plan_days cpd ON cpd.weekday = CASE
  WHEN COALESCE(co.force_off,0)=1 THEN NULL
  WHEN co.source_weekday IS NOT NULL THEN co.source_weekday
  ELSE b.weekday
END
LEFT JOIN rings_plan_days rpd ON rpd.weekday = CASE
  WHEN COALESCE(ro.force_off,0)=1 THEN NULL
  WHEN ro.source_weekday IS NOT NULL THEN ro.source_weekday
  ELSE b.weekday
END
LEFT JOIN (
  SELECT session_date, group_concat(template_code, '+') AS extra_templates
  FROM rings_plan_extras
  GROUP BY session_date
) rpe ON rpe.session_date = b.session_date
ORDER BY b.session_date
`)

const barbellRows = sqlJson(`
SELECT
  bs.session_date,
  l.name AS lift,
  bsl.category,
  bsl.set_no,
  bsl.actual_weight_kg,
  bsl.actual_reps,
  bsl.note
FROM barbell_set_logs bsl
JOIN barbell_sessions bs ON bs.id = bsl.session_id
JOIN lifts l ON l.id = bsl.lift_id
WHERE bs.session_date >= date('now','localtime','-90 day')
ORDER BY bs.session_date, bsl.category, bsl.set_no
`)

const cardioRows = sqlJson(`
SELECT
  cs.session_date,
  cs.protocol,
  cs.duration_min,
  cs.max_hr,
  cs.notes,
  ci.interval_no,
  ci.work_min,
  ci.easy_min,
  ci.target_speed_kmh,
  ci.achieved_hr,
  ci.note AS interval_note
FROM cardio_sessions cs
LEFT JOIN cardio_intervals ci ON ci.session_id = cs.id
WHERE cs.session_date >= date('now','localtime','-90 day')
ORDER BY cs.session_date, ci.interval_no
`)

const ringsRows = sqlJson(`
SELECT
  rs.session_date,
  rs.template,
  rs.completed_as_prescribed,
  rs.notes,
  rl.item_no,
  rl.exercise,
  rl.result_text
FROM rings_sessions rs
LEFT JOIN rings_logs rl ON rl.session_id = rs.id
WHERE rs.session_date >= date('now','localtime','-90 day')
ORDER BY rs.session_date, rl.item_no
`)

const plannedBarbellRows = sqlJson(`
WITH RECURSIVE dates(day) AS (
  SELECT date('now','localtime','-90 day')
  UNION ALL
  SELECT date(day, '+1 day') FROM dates
  WHERE day < date('now','localtime','+14 day')
),
base AS (
  SELECT
    day AS session_date,
    ((CAST(strftime('%w', day) AS INTEGER) + 6) % 7) + 1 AS weekday,
    date(day, '-' || (((CAST(strftime('%w', day) AS INTEGER) + 6) % 7)) || ' day') AS week_start
  FROM dates
),
map AS (
  SELECT
    b.session_date,
    CASE
      WHEN COALESCE(so.force_off,0)=1 THEN NULL
      WHEN so.source_weekday IS NOT NULL THEN so.source_weekday
      ELSE b.weekday
    END AS plan_weekday,
    b.week_start
  FROM base b
  LEFT JOIN schedule_overrides so ON so.session_date = b.session_date
),
source_dates AS (
  SELECT
    m.session_date,
    CASE WHEN m.plan_weekday IS NULL THEN NULL
         ELSE date(m.week_start, '+' || (m.plan_weekday - 1) || ' day') END AS source_session_date
  FROM map m
)
SELECT
  sd.session_date,
  COALESCE(ps.category, pv.category) AS category,
  COALESCE(ps.lift, pv.lift) AS lift,
  COALESCE(ps.set_no, pv.set_no) AS set_no,
  COALESCE(ps.prescribed_reps, pv.prescribed_reps) AS prescribed_reps,
  COALESCE(ps.planned_weight_kg, pv.planned_weight_kg) AS planned_weight_kg
FROM source_dates sd
LEFT JOIN planned_barbell_sets_snapshot ps ON ps.session_date = sd.source_session_date
LEFT JOIN v_planned_barbell_sets pv ON pv.session_date = sd.source_session_date
  AND ps.id IS NULL
WHERE COALESCE(ps.session_date, pv.session_date) IS NOT NULL
ORDER BY sd.session_date, COALESCE(ps.category, pv.category), COALESCE(ps.set_no, pv.set_no)
`)

const plannedCardioRows = sqlJson(`
WITH RECURSIVE dates(day) AS (
  SELECT date('now','localtime','-90 day')
  UNION ALL
  SELECT date(day, '+1 day') FROM dates
  WHERE day < date('now','localtime','+14 day')
),
base AS (
  SELECT
    day AS session_date,
    ((CAST(strftime('%w', day) AS INTEGER) + 6) % 7) + 1 AS weekday
  FROM dates
)
SELECT
  b.session_date,
  cpd.session_type,
  cpd.duration_min,
  cpd.warmup_min,
  cpd.cooldown_min,
  cpd.vo2_intervals_min,
  cpd.vo2_intervals_max,
  cpd.vo2_work_min,
  cpd.vo2_easy_min,
  cpd.speed_low_kmh,
  cpd.speed_high_kmh,
  cpd.target_hr_min,
  cpd.target_hr_max,
  cpd.notes
FROM base b
LEFT JOIN cardio_schedule_overrides co ON co.session_date = b.session_date
LEFT JOIN cardio_plan_days cpd ON cpd.weekday = CASE
  WHEN COALESCE(co.force_off,0)=1 THEN NULL
  WHEN co.source_weekday IS NOT NULL THEN co.source_weekday
  ELSE b.weekday
END
ORDER BY b.session_date
`)

const plannedRingsRows = sqlJson(`
WITH RECURSIVE dates(day) AS (
  SELECT date('now','localtime','-90 day')
  UNION ALL
  SELECT date(day, '+1 day') FROM dates
  WHERE day < date('now','localtime','+14 day')
),
base AS (
  SELECT
    day AS session_date,
    ((CAST(strftime('%w', day) AS INTEGER) + 6) % 7) + 1 AS weekday
  FROM dates
),
primary_tpl AS (
  SELECT
    b.session_date,
    rpd.template_code
  FROM base b
  LEFT JOIN rings_schedule_overrides ro ON ro.session_date = b.session_date
  LEFT JOIN rings_plan_days rpd ON rpd.weekday = CASE
    WHEN COALESCE(ro.force_off,0)=1 THEN NULL
    WHEN ro.source_weekday IS NOT NULL THEN ro.source_weekday
    ELSE b.weekday
  END
  WHERE rpd.template_code IS NOT NULL
),
all_tpl AS (
  SELECT session_date, template_code FROM primary_tpl
  UNION
  SELECT session_date, template_code FROM rings_plan_extras
)
SELECT
  t.session_date,
  t.template_code,
  rti.item_no,
  rti.exercise,
  rti.sets_text,
  rti.reps_or_time,
  rti.tempo,
  rti.rest_text
FROM all_tpl t
LEFT JOIN rings_templates rt ON rt.code = t.template_code
LEFT JOIN rings_template_items rti ON rti.template_id = rt.id
ORDER BY t.session_date, t.template_code, rti.item_no
`)

const est1RM = sqlJson(`
WITH cfg AS (
  SELECT COALESCE((SELECT CAST(value AS REAL) FROM config WHERE key='athlete_bodyweight_kg'), 85.0) AS bw
),
main_sets AS (
  SELECT
    l.name AS lift,
    bs.session_date,
    bsl.actual_weight_kg AS weight_kg,
    bsl.actual_reps AS reps,
    bsl.set_no,
    (bsl.actual_weight_kg * (1 + (bsl.actual_reps / 30.0))) AS e1rm_kg
  FROM barbell_set_logs bsl
  JOIN barbell_sessions bs ON bs.id = bsl.session_id
  JOIN lifts l ON l.id = bsl.lift_id
  WHERE bsl.category = 'main'
    AND bsl.actual_weight_kg IS NOT NULL
    AND bsl.actual_reps IS NOT NULL
    AND bsl.actual_reps > 0
    AND bs.session_date >= date('now','localtime','-84 day')
),
ranked AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY lift
           ORDER BY e1rm_kg DESC, session_date DESC, set_no DESC
         ) AS rn
  FROM main_sets
)
SELECT
  r.lift,
  ROUND(r.e1rm_kg, 1) AS est_1rm_kg,
  r.session_date AS source_date,
  ROUND(r.weight_kg, 1) AS source_weight_kg,
  r.reps AS source_reps,
  r.set_no AS source_set_no,
  ROUND((r.e1rm_kg / cfg.bw), 2) AS bw_ratio,
  cfg.bw AS bodyweight_kg,
  CASE
    WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 2.75 THEN 'Elite'
    WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 2.25 THEN 'Advanced'
    WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 1.50 THEN 'Intermediate'
    WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 1.25 THEN 'Novice'
    WHEN r.lift='Squat' THEN 'Beginner'

    WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 2.00 THEN 'Elite'
    WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 1.75 THEN 'Advanced'
    WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 1.25 THEN 'Intermediate'
    WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 0.75 THEN 'Novice'
    WHEN r.lift='Bench' THEN 'Beginner'

    WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 3.00 THEN 'Elite'
    WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 2.50 THEN 'Advanced'
    WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 2.00 THEN 'Intermediate'
    WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 1.50 THEN 'Novice'
    WHEN r.lift='Deadlift' THEN 'Beginner'

    WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 1.40 THEN 'Elite'
    WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 1.10 THEN 'Advanced'
    WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 0.80 THEN 'Intermediate'
    WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 0.55 THEN 'Novice'
    WHEN r.lift='Press' THEN 'Beginner'
    ELSE '—'
  END AS strength_level,
  CASE
    WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 2.75 THEN '—'
    WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 2.25 THEN 'Elite'
    WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 1.50 THEN 'Advanced'
    WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 1.25 THEN 'Intermediate'
    WHEN r.lift='Squat' THEN 'Novice'

    WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 2.00 THEN '—'
    WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 1.75 THEN 'Elite'
    WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 1.25 THEN 'Advanced'
    WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 0.75 THEN 'Intermediate'
    WHEN r.lift='Bench' THEN 'Novice'

    WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 3.00 THEN '—'
    WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 2.50 THEN 'Elite'
    WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 2.00 THEN 'Advanced'
    WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 1.50 THEN 'Intermediate'
    WHEN r.lift='Deadlift' THEN 'Novice'

    WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 1.40 THEN '—'
    WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 1.10 THEN 'Elite'
    WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 0.80 THEN 'Advanced'
    WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 0.55 THEN 'Intermediate'
    WHEN r.lift='Press' THEN 'Novice'
    ELSE '—'
  END AS next_level,
  ROUND(cfg.bw * CASE
    WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 2.75 THEN NULL
    WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 2.25 THEN 2.75
    WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 1.50 THEN 2.25
    WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 1.25 THEN 1.50
    WHEN r.lift='Squat' THEN 1.25

    WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 2.00 THEN NULL
    WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 1.75 THEN 2.00
    WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 1.25 THEN 1.75
    WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 0.75 THEN 1.25
    WHEN r.lift='Bench' THEN 0.75

    WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 3.00 THEN NULL
    WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 2.50 THEN 3.00
    WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 2.00 THEN 2.50
    WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 1.50 THEN 2.00
    WHEN r.lift='Deadlift' THEN 1.50

    WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 1.40 THEN NULL
    WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 1.10 THEN 1.40
    WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 0.80 THEN 1.10
    WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 0.55 THEN 0.80
    WHEN r.lift='Press' THEN 0.55
    ELSE NULL
  END, 1) AS next_level_kg,
  ROUND((
    SELECT (MAX(ms.e1rm_kg) - MIN(ms.e1rm_kg))
    FROM main_sets ms
    WHERE ms.lift = r.lift
      AND ms.session_date >= date('now','localtime','-28 day')
  ), 1) AS delta_4w_kg,
  ROUND((
    SELECT (MAX(ms.e1rm_kg) - MIN(ms.e1rm_kg))
    FROM main_sets ms
    WHERE ms.lift = r.lift
  ), 1) AS delta_cycle_kg,
  CASE
    WHEN (
      ROUND(cfg.bw * CASE
        WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 2.75 THEN NULL
        WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 2.25 THEN 2.75
        WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 1.50 THEN 2.25
        WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 1.25 THEN 1.50
        WHEN r.lift='Squat' THEN 1.25
        WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 2.00 THEN NULL
        WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 1.75 THEN 2.00
        WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 1.25 THEN 1.75
        WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 0.75 THEN 1.25
        WHEN r.lift='Bench' THEN 0.75
        WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 3.00 THEN NULL
        WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 2.50 THEN 3.00
        WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 2.00 THEN 2.50
        WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 1.50 THEN 2.00
        WHEN r.lift='Deadlift' THEN 1.50
        WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 1.40 THEN NULL
        WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 1.10 THEN 1.40
        WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 0.80 THEN 1.10
        WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 0.55 THEN 0.80
        WHEN r.lift='Press' THEN 0.55
        ELSE NULL END, 1)
    ) IS NULL THEN 100
    ELSE ROUND((r.e1rm_kg / (
      ROUND(cfg.bw * CASE
        WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 2.75 THEN NULL
        WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 2.25 THEN 2.75
        WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 1.50 THEN 2.25
        WHEN r.lift='Squat' AND (r.e1rm_kg / cfg.bw) >= 1.25 THEN 1.50
        WHEN r.lift='Squat' THEN 1.25
        WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 2.00 THEN NULL
        WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 1.75 THEN 2.00
        WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 1.25 THEN 1.75
        WHEN r.lift='Bench' AND (r.e1rm_kg / cfg.bw) >= 0.75 THEN 1.25
        WHEN r.lift='Bench' THEN 0.75
        WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 3.00 THEN NULL
        WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 2.50 THEN 3.00
        WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 2.00 THEN 2.50
        WHEN r.lift='Deadlift' AND (r.e1rm_kg / cfg.bw) >= 1.50 THEN 2.00
        WHEN r.lift='Deadlift' THEN 1.50
        WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 1.40 THEN NULL
        WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 1.10 THEN 1.40
        WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 0.80 THEN 1.10
        WHEN r.lift='Press' AND (r.e1rm_kg / cfg.bw) >= 0.55 THEN 0.80
        WHEN r.lift='Press' THEN 0.55
        ELSE NULL END, 1)
    )) * 100, 0)
  END AS progress_to_next_pct,
  (
    SELECT json_group_array(json_object('date', t.session_date, 'e1rm', ROUND(t.e1rm_kg,1)))
    FROM (
      SELECT ms.session_date, MAX(ms.e1rm_kg) AS e1rm_kg
      FROM main_sets ms
      WHERE ms.lift = r.lift
      GROUP BY ms.session_date
      ORDER BY ms.session_date DESC
      LIMIT 12
    ) t
  ) AS trend_points
FROM ranked r
CROSS JOIN cfg
WHERE r.rn = 1
ORDER BY CASE r.lift
  WHEN 'Squat' THEN 1
  WHEN 'Bench' THEN 2
  WHEN 'Deadlift' THEN 3
  WHEN 'Press' THEN 4
  ELSE 99 END
`)

const weekHeader =
  sqlJson(`
WITH d AS (
  SELECT date('now','localtime') AS today
),
pc AS (
  SELECT *
  FROM v_program_calendar
  WHERE session_date = (SELECT today FROM d)
  ORDER BY session_date DESC, block_no DESC, block_id DESC
  LIMIT 1
),
active_deload AS (
  SELECT db.deload_code, dp.name
  FROM deload_blocks db
  LEFT JOIN deload_profiles dp ON dp.code = db.deload_code
  WHERE (SELECT today FROM d) BETWEEN db.start_date AND db.end_date
  ORDER BY db.id DESC
  LIMIT 1
),
cfg AS (
  SELECT
    COALESCE((SELECT CAST(value AS REAL) FROM config WHERE key='main_week1_set1_pct'),0.65) AS m_w1_s1,
    COALESCE((SELECT CAST(value AS REAL) FROM config WHERE key='main_week1_set2_pct'),0.75) AS m_w1_s2,
    COALESCE((SELECT CAST(value AS REAL) FROM config WHERE key='main_week1_set3_pct'),0.85) AS m_w1_s3,
    COALESCE((SELECT CAST(value AS REAL) FROM config WHERE key='main_week2_set1_pct'),0.70) AS m_w2_s1,
    COALESCE((SELECT CAST(value AS REAL) FROM config WHERE key='main_week2_set2_pct'),0.80) AS m_w2_s2,
    COALESCE((SELECT CAST(value AS REAL) FROM config WHERE key='main_week2_set3_pct'),0.90) AS m_w2_s3,
    COALESCE((SELECT CAST(value AS REAL) FROM config WHERE key='main_week3_set1_pct'),0.75) AS m_w3_s1,
    COALESCE((SELECT CAST(value AS REAL) FROM config WHERE key='main_week3_set2_pct'),0.85) AS m_w3_s2,
    COALESCE((SELECT CAST(value AS REAL) FROM config WHERE key='main_week3_set3_pct'),0.95) AS m_w3_s3,
    COALESCE((SELECT CAST(value AS REAL) FROM config WHERE key='bbs_week1_pct_tm'),0.65) AS bbs_w1,
    COALESCE((SELECT CAST(value AS REAL) FROM config WHERE key='bbs_week2_pct_tm'),0.70) AS bbs_w2,
    COALESCE((SELECT CAST(value AS REAL) FROM config WHERE key='bbs_week3_pct_tm'),0.75) AS bbs_w3
)
SELECT
  pc.block_type,
  pc.week_in_block,
  ad.deload_code,
  ad.name AS deload_name,
  CASE ((pc.week_in_block - 1) % 3) + 1
    WHEN 1 THEN printf('%.0f/%.0f/%.0f%%', cfg.m_w1_s1*100, cfg.m_w1_s2*100, cfg.m_w1_s3*100)
    WHEN 2 THEN printf('%.0f/%.0f/%.0f%%', cfg.m_w2_s1*100, cfg.m_w2_s2*100, cfg.m_w2_s3*100)
    ELSE printf('%.0f/%.0f/%.0f%%', cfg.m_w3_s1*100, cfg.m_w3_s2*100, cfg.m_w3_s3*100)
  END AS main_pct,
  CASE ((pc.week_in_block - 1) % 3) + 1
    WHEN 1 THEN printf('%.0f%%', cfg.bbs_w1*100)
    WHEN 2 THEN printf('%.0f%%', cfg.bbs_w2*100)
    ELSE printf('%.0f%%', cfg.bbs_w3*100)
  END AS supp_pct
FROM pc CROSS JOIN cfg
LEFT JOIN active_deload ad ON 1=1
`)[0] || null

const aerobicTests = sqlJson(`
SELECT id, date, test_type, speed, distance, duration, avg_hr, max_hr, avg_speed,
       hr_first_half, hr_second_half, speed_first_half, speed_second_half,
       decoupling_percent, notes
FROM aerobic_tests
ORDER BY date ASC, id ASC
`)

const cycleControl = {
  profiles: sqlJson(`
    SELECT code,name,description,default_days,assistance_mode,cardio_mode,rings_mode
    FROM deload_profiles
    ORDER BY code
  `),
  activeDeload:
    sqlJson(`
    SELECT db.start_date, db.end_date, db.deload_code, dp.name, dp.description
    FROM deload_blocks db
    LEFT JOIN deload_profiles dp ON dp.code = db.deload_code
    WHERE date('now','localtime') BETWEEN db.start_date AND db.end_date
    ORDER BY db.id DESC
    LIMIT 1
  `)[0] || null,
  latestBlock:
    sqlJson(`
    SELECT block_no, block_type, start_date, end_date, notes
    FROM program_blocks
    WHERE date(start_date) <= date('now','localtime')
    ORDER BY date(start_date) DESC, block_no DESC, id DESC
    LIMIT 1
  `)[0] || null,
  recentEvents: sqlJson(`
    SELECT event_date,event_type,deload_code,block_no,note,created_at
    FROM cycle_events
    ORDER BY id DESC
    LIMIT 10
  `),
  currentTM: sqlJson(`
    SELECT lift, tm_kg, effective_date, cycle_label
    FROM v_current_tm
    ORDER BY CASE lift WHEN 'Squat' THEN 1 WHEN 'Bench' THEN 2 WHEN 'Deadlift' THEN 3 WHEN 'Press' THEN 4 ELSE 99 END
  `)
}

const cardioAnalytics =
  sqlJson(`
WITH z2 AS (
  SELECT
    COUNT(*) AS total_z2,
    SUM(CASE WHEN z2_cap_respected=1 THEN 1 ELSE 0 END) AS z2_in_cap
  FROM cardio_sessions
  WHERE protocol='Z2'
    AND session_date >= date('now','localtime','-84 day')
),
z2_points AS (
  SELECT
    session_date,
    duration_min,
    avg_hr AS avg_hr,
    max_hr,
    z2_cap_respected,
    notes,
    CASE
      WHEN instr(lower(notes), '@ ') > 0 AND instr(lower(notes), ' km/h') > instr(lower(notes), '@ ')
        THEN CAST(substr(notes, instr(lower(notes), '@ ') + 2, instr(lower(notes), ' km/h') - (instr(lower(notes), '@ ') + 2)) AS REAL)
      WHEN instr(lower(notes), 'speed ') > 0 AND instr(lower(notes), ' km/h') > instr(lower(notes), 'speed ')
        THEN CAST(substr(notes, instr(lower(notes), 'speed ') + 6, instr(lower(notes), ' km/h') - (instr(lower(notes), 'speed ') + 6)) AS REAL)
      ELSE NULL
    END AS speed_kmh,
    CASE
      WHEN instr(lower(notes), 'end bpm ') > 0
        THEN CAST(substr(notes, instr(lower(notes), 'end bpm ') + 8) AS REAL)
      ELSE NULL
    END AS end_hr
  FROM cardio_sessions
  WHERE protocol='Z2'
    AND session_date >= date('now','localtime','-84 day')
  ORDER BY session_date
),
z2_enriched AS (
  SELECT
    session_date,
    duration_min,
    avg_hr,
    max_hr,
    z2_cap_respected,
    speed_kmh,
    end_hr,
    CASE WHEN avg_hr > 0 AND speed_kmh IS NOT NULL THEN ROUND(speed_kmh / avg_hr, 4) ELSE NULL END AS efficiency,
    CASE WHEN avg_hr > 0 AND speed_kmh IS NOT NULL THEN ROUND((speed_kmh * 120.0) / avg_hr, 2) ELSE NULL END AS speed_at_120,
    CASE WHEN avg_hr > 0 AND speed_kmh IS NOT NULL THEN ROUND((speed_kmh * 140.0) / avg_hr, 2) ELSE NULL END AS speed_at_140,
    CASE WHEN avg_hr > 0 AND end_hr IS NOT NULL THEN ROUND(((end_hr - avg_hr) * 100.0) / avg_hr, 2) ELSE NULL END AS decoupling_pct
  FROM z2_points
),
vo2 AS (
  SELECT
    id,
    date AS session_date,
    protocol,
    speed_kmh AS avg_speed_kmh,
    hr AS avg_hr,
    speed_kmh AS max_speed_kmh,
    hr AS max_hr,
    work_interval_time_min AS work_min,
    rest_interval_time_min AS easy_min,
    n_intervals
  FROM v_vo2_sessions
  WHERE date >= date('now','localtime','-84 day')
  ORDER BY date
)
SELECT
  (SELECT total_z2 FROM z2) AS total_z2,
  (SELECT z2_in_cap FROM z2) AS z2_in_cap,
  CASE WHEN (SELECT total_z2 FROM z2) > 0
       THEN ROUND((SELECT z2_in_cap FROM z2) * 100.0 / (SELECT total_z2 FROM z2), 1)
       ELSE NULL END AS z2_compliance_pct,
  json((SELECT json_group_array(json_object(
    'session_date', session_date,
    'duration_min', duration_min,
    'avg_hr', avg_hr,
    'max_hr', max_hr,
    'z2_cap_respected', z2_cap_respected,
    'speed_kmh', speed_kmh,
    'end_hr', end_hr,
    'efficiency', efficiency,
    'speed_at_120', speed_at_120,
    'speed_at_140', speed_at_140,
    'decoupling_pct', decoupling_pct
  )) FROM z2_enriched)) AS z2_points,
  json((SELECT json_group_array(json_object(
    'session_date', session_date,
    'avg_hr', avg_hr,
    'speed_kmh', speed_kmh,
    'z2_cap_respected', z2_cap_respected
  )) FROM z2_enriched WHERE avg_hr IS NOT NULL AND speed_kmh IS NOT NULL)) AS z2_scatter_points,
  json((SELECT json_group_array(json_object(
    'session_date', session_date,
    'efficiency', efficiency,
    'speed_at_140', speed_at_140
  )) FROM z2_enriched WHERE efficiency IS NOT NULL)) AS z2_efficiency_points,
  json((SELECT json_group_array(json_object(
    'session_date', session_date,
    'decoupling_pct', decoupling_pct
  )) FROM z2_enriched WHERE decoupling_pct IS NOT NULL)) AS z2_decoupling_points,
  json((SELECT json_group_array(json_object(
    'id', id,
    'session_date', session_date,
    'protocol', protocol,
    'avg_speed_kmh', avg_speed_kmh,
    'avg_hr', avg_hr,
    'max_speed_kmh', max_speed_kmh,
    'max_hr', max_hr,
    'work_min', work_min,
    'easy_min', easy_min,
    'n_intervals', n_intervals
  )) FROM vo2)) AS vo2_points
`)[0] || {}

const currentCyclePlan = sqlJson(`
WITH cur AS (
  SELECT block_no
  FROM program_blocks
  WHERE start_date <= date('now','localtime')
  ORDER BY start_date DESC, block_no DESC, id DESC
  LIMIT 1
), rows AS (
  SELECT
    p.session_date,
    p.day_name,
    p.category,
    p.lift,
    p.set_no,
    p.prescribed_reps,
    p.planned_weight_kg,
    p.prescribed_pct
  FROM planned_barbell_sets_snapshot p
  WHERE p.block_no = (SELECT block_no FROM cur)
  UNION ALL
  SELECT
    pv.session_date,
    pv.day_name,
    pv.category,
    pv.lift,
    pv.set_no,
    pv.prescribed_reps,
    pv.planned_weight_kg,
    pv.prescribed_pct
  FROM v_planned_barbell_sets pv
  WHERE pv.block_no = (SELECT block_no FROM cur)
    AND NOT EXISTS (
      SELECT 1 FROM planned_barbell_sets_snapshot ps
      WHERE ps.block_no = (SELECT block_no FROM cur)
        AND ps.session_date = pv.session_date
    )
)
SELECT *
FROM rows
ORDER BY session_date, CASE category WHEN 'main' THEN 1 ELSE 2 END, set_no
`)

const auditLog = sqlJson(`
SELECT
  event_time,
  domain,
  action,
  key_name,
  old_value,
  new_value,
  note
FROM audit_log
ORDER BY event_time DESC, id DESC
LIMIT 60
`)

const payload = {
  generatedAt: new Date().toISOString(),
  totals,
  weekHeader,
  weekProgress,
  dailyTiles,
  est1RM,
  cardioAnalytics,
  aerobicTests,
  cycleControl,
  currentCyclePlan,
  auditLog,
  details: {
    barbellByDate: groupByDate(barbellRows),
    cardioByDate: groupByDate(cardioRows),
    ringsByDate: groupByDate(ringsRows),
    plannedBarbellByDate: groupByDate(plannedBarbellRows),
    plannedCardioByDate: groupByDate(plannedCardioRows),
    plannedRingsByDate: groupByDate(plannedRingsRows)
  }
}

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`Wrote ${outPath}`)
