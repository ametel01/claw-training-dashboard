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
    ((CAST(strftime('%w', anchor_date) AS INTEGER) + 6) % 7) + 1 AS anchor_weekday,
    date(anchor_date, '-' || (((CAST(strftime('%w', anchor_date) AS INTEGER) + 6) % 7)) || ' day') AS week_start
  FROM latest
),
days AS (
  SELECT
    td.weekday,
    td.day_name,
    date(ww.week_start, '+' || (td.weekday - 1) || ' day') AS session_date
  FROM training_days td
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
JOIN training_days td ON td.weekday = d.weekday
JOIN lifts l ON l.id = td.main_lift_id
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
  SELECT date((SELECT latest_date FROM latest), '-13 day')
  UNION ALL
  SELECT date(day, '+1 day') FROM dates
  WHERE day < (SELECT latest_date FROM latest)
)
SELECT
  d.day AS session_date,
  CASE WHEN bs.id IS NOT NULL THEN 1 ELSE 0 END AS has_barbell,
  CASE WHEN cs.id IS NOT NULL THEN 1 ELSE 0 END AS has_cardio,
  CASE WHEN rs.id IS NOT NULL THEN 1 ELSE 0 END AS has_rings,
  l.name AS barbell_lift,
  cs.protocol AS cardio_protocol,
  rs.template AS rings_template
FROM dates d
LEFT JOIN barbell_sessions bs ON bs.session_date = d.day
LEFT JOIN training_days td ON td.id = bs.day_id
LEFT JOIN lifts l ON l.id = td.main_lift_id
LEFT JOIN cardio_sessions cs ON cs.session_date = d.day
LEFT JOIN rings_sessions rs ON rs.session_date = d.day
ORDER BY d.day
`);

const payload = {
  generatedAt: new Date().toISOString(),
  totals,
  weekProgress,
  dailyTiles
};

writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(`Wrote ${outPath}`);
