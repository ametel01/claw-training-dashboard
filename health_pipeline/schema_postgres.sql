create extension if not exists pgcrypto;

create table if not exists data_sources (
  id uuid primary key default gen_random_uuid(),
  source_code text not null unique,
  source_name text not null,
  source_rank int not null,
  created_at timestamptz not null default now()
);

insert into data_sources(source_code, source_name, source_rank) values
('apple_health_xml','Apple Health XML',1),
('apple_watch_workout','Apple Watch Workout',2),
('polar_h10','Polar H10',1),
('polar_flow','Polar Flow',2),
('manual','Manual / Machine',99)
on conflict (source_code) do update set source_name=excluded.source_name, source_rank=excluded.source_rank;

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_id uuid not null references data_sources(id),
  source_workout_id text not null,
  source_device_name text,
  sport text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  timezone text not null,
  duration_s int not null,
  moving_time_s int,
  distance_m numeric(10,2),
  calories_kcal numeric(10,2),
  avg_hr_bpm numeric(6,2),
  max_hr_bpm numeric(6,2),
  avg_speed_mps numeric(8,4),
  max_speed_mps numeric(8,4),
  avg_pace_s_per_km numeric(8,2),
  elevation_gain_m numeric(8,2),
  steps int,
  cadence_spm numeric(6,2),
  stride_length_m numeric(6,3),
  indoor boolean,
  has_route boolean not null default false,
  route_geojson jsonb,
  vendor_training_load numeric(10,2),
  vendor_vo2max_ml_kg_min numeric(6,2),
  vendor_effort_score numeric(10,2),
  notes text,
  raw_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_id, source_workout_id)
);

create index if not exists workouts_user_started_idx on workouts(user_id, started_at desc);

create table if not exists hr_samples (
  id bigserial primary key,
  workout_id uuid not null references workouts(id) on delete cascade,
  user_id uuid not null,
  source_id uuid not null references data_sources(id),
  ts timestamptz not null,
  hr_bpm numeric(6,2) not null,
  rr_ms int,
  quality smallint not null default 100,
  is_interpolated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workout_id, source_id, ts)
);

create index if not exists hr_samples_workout_ts_idx on hr_samples(workout_id, ts);

create table if not exists sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_id uuid not null references data_sources(id),
  source_sleep_id text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_s int not null,
  in_bed_s int,
  asleep_s int,
  awake_s int,
  rem_s int,
  core_s int,
  deep_s int,
  raw_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_id, source_sleep_id)
);

create table if not exists daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  activity_date date not null,
  source_id uuid not null references data_sources(id),
  steps int,
  distance_m numeric(10,2),
  active_energy_kcal numeric(10,2),
  basal_energy_kcal numeric(10,2),
  exercise_time_min numeric(8,2),
  stand_time_min numeric(8,2),
  flights_climbed int,
  raw_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, activity_date, source_id)
);

create table if not exists daily_recovery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  recovery_date date not null,
  source_id uuid not null references data_sources(id),
  resting_hr_bpm numeric(6,2),
  hrv_sdnn_ms numeric(8,2),
  respiratory_rate_brpm numeric(8,2),
  wrist_temp_delta_c numeric(6,3),
  spo2_pct numeric(5,2),
  sleep_duration_s int,
  sleep_efficiency_pct numeric(5,2),
  body_mass_kg numeric(6,2),
  vo2max_ml_kg_min numeric(6,2),
  recovery_score numeric(6,2),
  strain_score numeric(6,2),
  readiness_flag text,
  raw_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, recovery_date, source_id)
);

create table if not exists workout_metrics (
  workout_id uuid primary key references workouts(id) on delete cascade,
  user_id uuid not null,
  trimp_bannister numeric(10,2),
  trimp_edwards numeric(10,2),
  time_in_z1_s int,
  time_in_z2_s int,
  time_in_z3_s int,
  time_in_z4_s int,
  time_in_z5_s int,
  aerobic_efficiency numeric(10,4),
  decoupling_pct numeric(6,2),
  recovery_hr_60s numeric(6,2),
  avg_rr_ms numeric(8,2),
  rmssd_ms numeric(8,2),
  artifact_pct numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
