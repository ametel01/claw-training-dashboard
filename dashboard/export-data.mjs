#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, '..', 'gym531.db');
const outPath = resolve(__dirname, 'data.json');

function sqlJson(sql) {
  const escaped = sql.replace(/"/g, '\\"').replace(/\n/g, ' ');
  const cmd = `sqlite3 -json \"${dbPath}\" \"${escaped}\"`;
  const raw = execSync(cmd, { encoding: 'utf8' }).trim();
  return raw ? JSON.parse(raw) : [];
}

function groupByDate(rows, key = 'session_date') {
  return rows.reduce((acc, row) => {
    const d = row[key];
    if (!acc[d]) acc[d] = [];
    acc[d].push(row);
    return acc;
  }, {});
}

const totals = sqlJson(`
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
`)[0] ?? {};

const weekProgress = sqlJson(`
WITH latest AS (
  SELECT COALESCE(MAX(session_date), date('now','localtime')) AS anchor_date
  FROM (
    SELECT session_date FROM barbell_sessions
    UNION ALL SELECT session_date FROM cardio_sessions
    UNION ALL SELECT session_date FROM rings_sessions
  )
),
week_window AS (
  SELECT
    anchor_date,
    date(anchor_date, '-' || (((CAST(strftime('%w', anchor_date) AS INTEGER) + 6) % 7)) || ' day') AS week_start
  FROM latest
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
  l.name AS main_lift,
  td.supplemental_sets,
  cpd.session_type AS cardio_plan,
  rpd.template_code AS rings_plan,
  CASE WHEN bs.id IS NOT NULL THEN 1 ELSE 0 END AS barbell_done,
  CASE WHEN cs.id IS NOT NULL THEN 1 ELSE 0 END AS cardio_done,
  CASE WHEN rs.id IS NOT NULL THEN 1 ELSE 0 END AS rings_done
FROM days d
LEFT JOIN training_days td ON td.weekday = d.weekday
LEFT JOIN lifts l ON l.id = td.main_lift_id
LEFT JOIN cardio_plan_days cpd ON cpd.weekday = d.weekday
LEFT JOIN rings_plan_days rpd ON rpd.weekday = d.weekday
LEFT JOIN barbell_sessions bs ON bs.session_date = d.session_date
LEFT JOIN cardio_sessions cs ON cs.session_date = d.session_date
LEFT JOIN rings_sessions rs ON rs.session_date = d.session_date
ORDER BY d.weekday
`);

const dailyTiles = sqlJson(`
WITH RECURSIVE
latest AS (
  SELECT COALESCE(MAX(session_date), date('now','localtime')) AS latest_date
  FROM (
    SELECT session_date FROM barbell_sessions
    UNION ALL SELECT session_date FROM cardio_sessions
    UNION ALL SELECT session_date FROM rings_sessions
  )
),
dates(day) AS (
  SELECT date((SELECT latest_date FROM latest), '-20 day')
  UNION ALL
  SELECT date(day, '+1 day') FROM dates
  WHERE day < (SELECT latest_date FROM latest)
),
base AS (
  SELECT
    d.day AS session_date,
    ((CAST(strftime('%w', d.day) AS INTEGER) + 6) % 7) + 1 AS weekday
  FROM dates d
)
SELECT
  b.session_date,
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
  rpd.template_code AS planned_rings
FROM base b
LEFT JOIN barbell_sessions bs ON bs.session_date = b.session_date
LEFT JOIN training_days td_done ON td_done.id = bs.day_id
LEFT JOIN lifts l ON l.id = td_done.main_lift_id
LEFT JOIN cardio_sessions cs ON cs.session_date = b.session_date
LEFT JOIN rings_sessions rs ON rs.session_date = b.session_date
LEFT JOIN training_days td ON td.weekday = b.weekday
LEFT JOIN lifts pl_main ON pl_main.id = td.main_lift_id
LEFT JOIN lifts pl_supp ON pl_supp.id = td.supplemental_lift_id
LEFT JOIN cardio_plan_days cpd ON cpd.weekday = b.weekday
LEFT JOIN rings_plan_days rpd ON rpd.weekday = b.weekday
ORDER BY b.session_date
`);

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
`);

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
`);

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
`);

const plannedBarbellRows = sqlJson(`
SELECT
  session_date,
  category,
  lift,
  set_no,
  prescribed_reps,
  planned_weight_kg
FROM v_planned_barbell_sets
WHERE session_date >= date('now','localtime','-90 day')
ORDER BY session_date, category, set_no
`);

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
LEFT JOIN cardio_plan_days cpd ON cpd.weekday = b.weekday
ORDER BY b.session_date
`);

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
)
SELECT
  b.session_date,
  rpd.template_code,
  rti.item_no,
  rti.exercise,
  rti.sets_text,
  rti.reps_or_time,
  rti.tempo,
  rti.rest_text
FROM base b
LEFT JOIN rings_plan_days rpd ON rpd.weekday = b.weekday
LEFT JOIN rings_templates rt ON rt.code = rpd.template_code
LEFT JOIN rings_template_items rti ON rti.template_id = rt.id
ORDER BY b.session_date, rti.item_no
`);

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
  END AS strength_level
FROM ranked r
CROSS JOIN cfg
WHERE r.rn = 1
ORDER BY CASE r.lift
  WHEN 'Squat' THEN 1
  WHEN 'Bench' THEN 2
  WHEN 'Deadlift' THEN 3
  WHEN 'Press' THEN 4
  ELSE 99 END
`);

const payload = {
  generatedAt: new Date().toISOString(),
  totals,
  weekProgress,
  dailyTiles,
  est1RM,
  details: {
    barbellByDate: groupByDate(barbellRows),
    cardioByDate: groupByDate(cardioRows),
    ringsByDate: groupByDate(ringsRows),
    plannedBarbellByDate: groupByDate(plannedBarbellRows),
    plannedCardioByDate: groupByDate(plannedCardioRows),
    plannedRingsByDate: groupByDate(plannedRingsRows)
  }
};

writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(`Wrote ${outPath}`);
