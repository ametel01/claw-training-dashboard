PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lifts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS training_max_history (
  id INTEGER PRIMARY KEY,
  lift_id INTEGER NOT NULL REFERENCES lifts(id),
  effective_date TEXT NOT NULL,
  tm_kg REAL NOT NULL,
  cycle_label TEXT,
  UNIQUE(lift_id, effective_date)
);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  main_scheme TEXT NOT NULL,
  supplemental_scheme TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS program_blocks (
  id INTEGER PRIMARY KEY,
  block_no INTEGER NOT NULL,
  block_type TEXT NOT NULL CHECK (block_type IN ('Leader','Anchor')),
  start_date TEXT NOT NULL,
  end_date TEXT,
  template_id INTEGER NOT NULL REFERENCES templates(id),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS training_days (
  id INTEGER PRIMARY KEY,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7), -- 1=Mon
  day_name TEXT NOT NULL,
  main_lift_id INTEGER NOT NULL REFERENCES lifts(id),
  supplemental_lift_id INTEGER NOT NULL REFERENCES lifts(id),
  supplemental_sets INTEGER NOT NULL,
  supplemental_reps INTEGER NOT NULL,
  UNIQUE(weekday)
);

CREATE TABLE IF NOT EXISTS sessions (
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

CREATE TABLE IF NOT EXISTS set_logs (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS assistance_logs (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  sets INTEGER,
  reps INTEGER,
  load_kg REAL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS prs (
  id INTEGER PRIMARY KEY,
  lift_id INTEGER NOT NULL REFERENCES lifts(id),
  pr_date TEXT NOT NULL,
  pr_type TEXT NOT NULL,
  value REAL NOT NULL,
  note TEXT
);

CREATE VIEW IF NOT EXISTS v_current_tm AS
SELECT l.name AS lift, t.tm_kg, t.effective_date, t.cycle_label
FROM training_max_history t
JOIN lifts l ON l.id = t.lift_id
WHERE t.id IN (
  SELECT t2.id
  FROM training_max_history t2
  WHERE t2.lift_id = t.lift_id
  ORDER BY t2.effective_date DESC, t2.id DESC
  LIMIT 1
);

CREATE VIEW IF NOT EXISTS v_weekly_volume AS
SELECT
  s.session_date,
  l.name AS lift,
  SUM(COALESCE(sl.actual_weight_kg,0) * COALESCE(sl.actual_reps,0)) AS volume_kg_reps
FROM set_logs sl
JOIN sessions s ON s.id = sl.session_id
JOIN lifts l ON l.id = sl.lift_id
GROUP BY s.session_date, l.name;

INSERT OR IGNORE INTO lifts(name) VALUES ('Squat'),('Bench'),('Deadlift'),('Press');

INSERT OR REPLACE INTO config(key,value) VALUES
('units','kg'),
('rounding_increment_kg','2.5'),
('main_scheme','5s Pro'),
('leader_supplemental','BBS 5x10'),
('anchor_supplemental','FSL 5x5');

INSERT OR IGNORE INTO templates(name,main_scheme,supplemental_scheme) VALUES
('Leader BBS 5s Pro','5s Pro','BBS 5x10'),
('Anchor FSL 5s Pro','5s Pro','FSL 5x5');

-- Program blocks starting Monday 2026-02-16
INSERT OR IGNORE INTO program_blocks(block_no, block_type, start_date, template_id, notes)
SELECT 1, 'Leader', '2026-02-16', id, 'Leader 1' FROM templates WHERE name='Leader BBS 5s Pro';

INSERT OR IGNORE INTO program_blocks(block_no, block_type, start_date, template_id, notes)
SELECT 2, 'Leader', '2026-03-09', id, 'Leader 2' FROM templates WHERE name='Leader BBS 5s Pro';

INSERT OR IGNORE INTO program_blocks(block_no, block_type, start_date, template_id, notes)
SELECT 3, 'Anchor', '2026-03-30', id, 'Anchor 1' FROM templates WHERE name='Anchor FSL 5s Pro';

-- Training maxes effective from cycle start
INSERT OR IGNORE INTO training_max_history(lift_id,effective_date,tm_kg,cycle_label)
SELECT id,'2026-02-16',110.0,'Cycle start' FROM lifts WHERE name='Squat';
INSERT OR IGNORE INTO training_max_history(lift_id,effective_date,tm_kg,cycle_label)
SELECT id,'2026-02-16',85.0,'Cycle start' FROM lifts WHERE name='Bench';
INSERT OR IGNORE INTO training_max_history(lift_id,effective_date,tm_kg,cycle_label)
SELECT id,'2026-02-16',125.0,'Cycle start' FROM lifts WHERE name='Deadlift';
INSERT OR IGNORE INTO training_max_history(lift_id,effective_date,tm_kg,cycle_label)
SELECT id,'2026-02-16',57.5,'Cycle start' FROM lifts WHERE name='Press';

-- Weekday split
INSERT OR REPLACE INTO training_days(weekday,day_name,main_lift_id,supplemental_lift_id,supplemental_sets,supplemental_reps)
SELECT 1,'Monday',lm.id,ls.id,5,10 FROM lifts lm, lifts ls WHERE lm.name='Squat' AND ls.name='Bench';
INSERT OR REPLACE INTO training_days(weekday,day_name,main_lift_id,supplemental_lift_id,supplemental_sets,supplemental_reps)
SELECT 2,'Tuesday',lm.id,ls.id,5,10 FROM lifts lm, lifts ls WHERE lm.name='Press' AND ls.name='Deadlift';
INSERT OR REPLACE INTO training_days(weekday,day_name,main_lift_id,supplemental_lift_id,supplemental_sets,supplemental_reps)
SELECT 4,'Thursday',lm.id,ls.id,5,10 FROM lifts lm, lifts ls WHERE lm.name='Bench' AND ls.name='Squat';
INSERT OR REPLACE INTO training_days(weekday,day_name,main_lift_id,supplemental_lift_id,supplemental_sets,supplemental_reps)
SELECT 5,'Friday',lm.id,ls.id,5,10 FROM lifts lm, lifts ls WHERE lm.name='Deadlift' AND ls.name='Press';
