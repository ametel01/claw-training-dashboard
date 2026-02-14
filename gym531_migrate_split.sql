PRAGMA foreign_keys = ON;

-- 1) BARBELL dedicated tables
CREATE TABLE IF NOT EXISTS barbell_sessions (
  id INTEGER PRIMARY KEY,
  session_date TEXT NOT NULL UNIQUE,
  weekday INTEGER NOT NULL,
  block_id INTEGER REFERENCES program_blocks(id),
  week_in_block INTEGER NOT NULL,
  day_id INTEGER REFERENCES training_days(id),
  bodyweight_kg REAL,
  readiness INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS barbell_set_logs (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES barbell_sessions(id) ON DELETE CASCADE,
  lift_id INTEGER NOT NULL REFERENCES lifts(id),
  category TEXT NOT NULL CHECK (category IN ('main','supplemental','assistance')),
  set_no INTEGER NOT NULL,
  prescribed_pct REAL,
  prescribed_reps INTEGER,
  actual_weight_kg REAL,
  actual_reps INTEGER,
  rpe REAL,
  note TEXT
);

-- Migrate existing generic barbell data if present
INSERT OR IGNORE INTO barbell_sessions(id, session_date, weekday, block_id, week_in_block, day_id, bodyweight_kg, readiness, notes)
SELECT id, session_date, weekday, block_id, week_in_block, day_id, bodyweight_kg, readiness, notes
FROM sessions;

INSERT OR IGNORE INTO barbell_set_logs(id, session_id, lift_id, category, set_no, prescribed_pct, prescribed_reps, actual_weight_kg, actual_reps, rpe, note)
SELECT id, session_id, lift_id, category, set_no, prescribed_pct, prescribed_reps, actual_weight_kg, actual_reps, rpe, note
FROM set_logs;

-- 2) CARDIO dedicated tables
CREATE TABLE IF NOT EXISTS cardio_sessions (
  id INTEGER PRIMARY KEY,
  session_date TEXT NOT NULL,
  slot TEXT NOT NULL DEFAULT 'CARDIO',
  protocol TEXT NOT NULL CHECK (protocol IN ('Z2','VO2_4x4','VO2_1min')),
  duration_min INTEGER,
  avg_hr INTEGER,
  max_hr INTEGER,
  z2_cap_respected INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_date, slot)
);

CREATE TABLE IF NOT EXISTS cardio_intervals (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES cardio_sessions(id) ON DELETE CASCADE,
  interval_no INTEGER NOT NULL,
  work_min REAL,
  easy_min REAL,
  target_speed_kmh REAL,
  achieved_hr INTEGER,
  note TEXT
);

-- helper view for quick weekly overview
DROP VIEW IF EXISTS v_training_day_summary;
CREATE VIEW v_training_day_summary AS
SELECT d.session_date,
       CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END AS has_barbell,
       CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END AS has_rings,
       CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END AS has_cardio
FROM (
  SELECT session_date FROM barbell_sessions
  UNION
  SELECT session_date FROM rings_sessions
  UNION
  SELECT session_date FROM cardio_sessions
) d
LEFT JOIN barbell_sessions b ON b.session_date = d.session_date
LEFT JOIN rings_sessions r ON r.session_date = d.session_date
LEFT JOIN cardio_sessions c ON c.session_date = d.session_date;
