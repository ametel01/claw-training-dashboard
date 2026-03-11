-- generated upserts
insert into workouts (
  user_id, source_id, source_workout_id, sport, started_at, ended_at, timezone,
  duration_s, distance_m, calories_kcal, avg_hr_bpm, max_hr_bpm,
  avg_speed_mps, avg_pace_s_per_km, indoor, has_route, route_geojson,
  vendor_vo2max_ml_kg_min, raw_hash
) values (
  '00000000-0000-0000-0000-000000000001',
  (select id from data_sources where source_code='polar_h10'),
  'polar:2026-03-11T00:08:41.164Z:running',
  'running',
  '2026-03-11T00:08:41.164Z',
  '2026-03-11T00:44:05.164Z',
  'Asia/Manila',
  2124, 0, 445, 126.48908918406072, 163,
  0, null, null, 0, null,
  null, 'sha256:baa086c2cb8229332a77059d74997ecc64be56fb12612f19edccae0cfb18c24c'
)
on conflict (user_id, source_id, source_workout_id)
do update set
  duration_s=excluded.duration_s,
  distance_m=excluded.distance_m,
  calories_kcal=excluded.calories_kcal,
  avg_hr_bpm=excluded.avg_hr_bpm,
  max_hr_bpm=excluded.max_hr_bpm,
  updated_at=now();
