import type { DatabaseSync } from 'node:sqlite'

export const cycleBootstrapSql = `
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
('CLASSIC_40_50_60','Classic 5/3/1 Deload','Week 4 style deload', '[{"pct":0.40,"reps":5},{"pct":0.50,"reps":5},{"pct":0.60,"reps":5}]','reduced','light','light',7),
('WEEK7_LIGHT','7th Week Deload','Modern 7th week deload', '[{"pct":0.40,"reps":5},{"pct":0.50,"reps":5},{"pct":0.60,"reps":5}]','reduced','light','light',7),
('TM_TEST','Training Max Test Week','70/80/90/100 TM test', '[{"pct":0.70,"reps":5},{"pct":0.80,"reps":5},{"pct":0.90,"reps":3},{"pct":1.00,"reps":3}]','normal','normal','normal',7),
('FULL_BODY_TECH','Full-body Technique Deload','Low fatigue technique week', '[{"pct":0.40,"reps":5},{"pct":0.50,"reps":5},{"pct":0.60,"reps":5}]','reduced','light','light',7),
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
`

export function ensureCycleTables(db: DatabaseSync): void {
  db.exec(cycleBootstrapSql)
}
