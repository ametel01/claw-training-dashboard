// Raw data.json shape as produced by the Flask/Python backend

export interface DashboardData {
  generatedAt: string
  weekHeader: WeekHeader | null
  dailyTiles: DailyTile[]
  weekProgress: WeekProgressRow[]
  totals: Totals
  details: Details
  cycleControl: CycleControl
  est1RM: Est1RMRow[]
  currentCyclePlan: CyclePlanRow[]
  cardioAnalytics: CardioAnalytics
  auditLog: AuditRow[]
  aerobicTests: AerobicTest[]
}

export interface WeekHeader {
  block_type: string
  week_in_block: number
  main_pct: string
  supp_pct: string
  deload_code?: string
  deload_name?: string
}

export interface DailyTile {
  session_date: string
  day_name?: string
  pain_level?: 'green' | 'yellow' | 'red'
  planned_barbell_main?: string
  planned_barbell_supp?: string
  planned_cardio?: string
  planned_rings?: string
  planned_supp_sets?: number | string
  planned_supp_reps?: number | string
  has_cardio?: boolean | number
  has_rings?: boolean | number
  barbell_lift?: string
  cardio_protocol?: string
  rings_template?: string
}

export interface WeekProgressRow {
  session_date: string
  day_name: string
  main_lift?: string
  cardio_plan?: string
  rings_plan?: string
  barbell_done?: boolean | number
  cardio_done?: boolean | number
  rings_done?: boolean | number
  pain_level?: string
}

export interface Totals {
  barbell_sessions?: number
  cardio_sessions?: number
  rings_sessions?: number
  total_training_days?: number
  active_days_last_14?: number
}

export interface Details {
  barbellByDate?: Record<string, BarbellRow[]>
  cardioByDate?: Record<string, CardioRow[]>
  ringsByDate?: Record<string, RingsRow[]>
  plannedBarbellByDate?: Record<string, PlannedBarbellRow[]>
  plannedCardioByDate?: Record<string, PlannedCardioRow[]>
  plannedRingsByDate?: Record<string, PlannedRingsRow[]>
}

export interface BarbellRow {
  session_date: string
  lift: string
  category: 'main' | 'supplemental'
  set_no?: number
  actual_weight_kg?: number
  actual_reps?: number
  planned_weight_kg?: number
  prescribed_reps?: number
  prescribed_pct?: number
  note?: string
}

export interface PlannedBarbellRow {
  session_date: string
  lift: string
  category: 'main' | 'supplemental'
  set_no?: number
  planned_weight_kg?: number
  prescribed_reps?: number
  prescribed_pct?: number
  note?: string
}

export interface CardioRow {
  session_date: string
  protocol: string
  duration_min?: number
  avg_hr?: number
  max_hr?: number
  speed_kmh?: number
  notes?: string
  interval_no?: number
  work_min?: number
  easy_min?: number
  target_speed_kmh?: number
  achieved_hr?: number
  rest_min?: number
  interval_note?: string
}

export interface RingsRow {
  session_date: string
  template?: string
  template_code?: string
  completed_as_prescribed?: boolean | number
  notes?: string
  item_no?: number
  exercise?: string
  result_text?: string
}

export interface PlannedCardioRow {
  session_date: string
  session_type?: string
  duration_min?: number
  warmup_min?: number
  cooldown_min?: number
  vo2_intervals_min?: number
  vo2_intervals_max?: number
  vo2_work_min?: number
  vo2_easy_min?: number
  speed_low_kmh?: number
  speed_high_kmh?: number
  target_hr_min?: number
  target_hr_max?: number
  notes?: string
  protocol?: string
}

export interface PlannedRingsRow {
  session_date: string
  template_code?: string
  item_no?: number
  exercise?: string
  sets_text?: string
  reps_or_time?: string
}

export interface CycleControl {
  latestBlock?: {
    block_no?: number
    block_type?: string
    start_date?: string
  }
  activeDeload?: {
    deload_code?: string
    name?: string
    start_date?: string
    end_date?: string
  } | null
  profiles?: DeloadProfile[]
  recentEvents?: CycleEvent[]
  currentTM?: TMRow[]
}

export interface DeloadProfile {
  code: string
  name: string
  default_days?: number
}

export interface CycleEvent {
  event_date: string
  event_type: string
  deload_code?: string
}

export interface TMRow {
  lift: string
  tm_kg: number
  effective_date?: string
}

export interface Est1RMRow {
  lift: string
  est_1rm_kg: number
  strength_level: string
  bw_ratio: number
  delta_4w_kg?: number
  delta_cycle_kg?: number
  next_level?: string
  next_level_kg?: number
  bodyweight_kg?: number
  source_weight_kg?: number
  source_reps?: number
  source_set_no?: number
  source_date?: string
  progress_to_next_pct?: number
  trend_points?: TrendPoint[] | string
}

export interface TrendPoint {
  e1rm: number
  session_date?: string
}

export interface CyclePlanRow {
  session_date: string
  category: 'main' | 'supplemental'
  lift: string
  planned_weight_kg?: number
  prescribed_reps?: number
}

export interface CardioAnalytics {
  total_z2: number
  z2_in_cap: number
  z2_compliance_pct: number
  z2_points: string | Z2Point[]
  z2_scatter_points: string | Z2ScatterPoint[]
  z2_efficiency_points: string | Z2EfficiencyPoint[]
  z2_decoupling_points: string | Z2DecouplingPoint[]
  vo2_points: string | VO2Point[]
}

export interface Z2Point {
  session_date: string
  duration_min: number
  avg_hr: number | null
  max_hr: number | null
  z2_cap_respected: number
  speed_kmh: number | null
  end_hr: number | null
  efficiency: number | null
  speed_at_120: number | null
  speed_at_140: number | null
  decoupling_pct: number | null
}

export interface Z2ScatterPoint {
  session_date: string
  avg_hr: number
  speed_kmh: number
  z2_cap_respected: number
}

export interface Z2EfficiencyPoint {
  session_date: string
  efficiency: number
  speed_at_120?: number
  speed_at_140?: number
}

export interface Z2DecouplingPoint {
  session_date: string
  decoupling_pct: number
}

export interface VO2Point {
  id: number
  session_date: string
  protocol: string
  avg_speed_kmh: number
  avg_hr: number
  max_speed_kmh: number
  max_hr: number
  work_min: number
  easy_min: number
  n_intervals: number
}

export interface AuditRow {
  event_time?: string
  domain: string
  action: string
  key_name?: string
  old_value?: string
  new_value?: string
  note?: string
}

export interface AerobicTest {
  date: string
  test_type: 'FIXED_SPEED' | 'FIXED_HR' | 'ZONE2_SESSION'
  avg_hr?: number
  max_hr?: number
  avg_speed?: number
  decoupling_percent?: number
}
