#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { XMLParser } from 'fast-xml-parser'

type JsonMap = Record<string, unknown>
type OutputBucket =
  | 'workouts'
  | 'hr_samples'
  | 'daily_recovery'
  | 'sleep_sessions'
  | 'daily_activity'
  | 'workout_metrics'

type Outputs = Record<OutputBucket, JsonMap[]>
type Config = {
  timezone: string
  sex: string
  hr_max_default: number
  hr_max_override: number | null
  hr_rest_fallback: number
}
type Context = Config & { user_id: string }

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true
})

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`missing value for --${key}`)
    }
    out[key] = value
    index += 1
  }
  return out
}

function requiredArg(args: Record<string, string>, key: string): string {
  const value = args[key]
  if (!value) throw new Error(`--${key} is required`)
  return value
}

function loadConfig(configPath?: string): Config {
  const defaults: Config = {
    timezone: 'Asia/Manila',
    sex: 'male',
    hr_max_default: 190,
    hr_max_override: null,
    hr_rest_fallback: 55
  }
  if (!configPath) return defaults
  const raw = JSON.parse(readFileSync(resolve(configPath), 'utf8')) as Partial<Config>
  return {
    timezone: raw.timezone ?? defaults.timezone,
    sex: raw.sex ?? defaults.sex,
    hr_max_default: Number(raw.hr_max_default ?? defaults.hr_max_default),
    hr_max_override:
      raw.hr_max_override == null ? null : Number(raw.hr_max_override ?? defaults.hr_max_override),
    hr_rest_fallback: Number(raw.hr_rest_fallback ?? defaults.hr_rest_fallback)
  }
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function dtParse(value: string): Date {
  const trimmed = value.trim().replace(' +0000', '+00:00')
  const candidates = [
    trimmed,
    trimmed.replace(' ', 'T'),
    trimmed.replace(' ', 'T') + 'Z',
    trimmed.replace(/ [A-Z]+$/, 'Z')
  ]

  for (const candidate of candidates) {
    const date = new Date(candidate)
    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }

  throw new Error(`unsupported datetime: ${value}`)
}

function toUtcIso(date: Date): string {
  return date.toISOString().replace('.000Z', 'Z')
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    )
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sha(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`
}

function walkFiles(root: string): string[] {
  if (!statExists(root)) return []
  const out: string[] = []
  const queue = [resolve(root)]
  while (queue.length) {
    const current = queue.pop()!
    const entries = readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(fullPath)
      } else if (entry.isFile()) {
        out.push(fullPath)
      }
    }
  }
  return out
}

function statExists(path: string): boolean {
  try {
    return statSync(path).isDirectory() || statSync(path).isFile()
  } catch {
    return false
  }
}

function dayIso(date: Date): string {
  return toUtcIso(date).slice(0, 10)
}

function numeric(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function parseAppleXml(xmlText: string, ctx: Context, out: Outputs, anomalies: string[]): void {
  const root = (parser.parse(xmlText) as { HealthData?: Record<string, unknown> }).HealthData
  if (!root) throw new Error('HealthData root missing')

  const dailyActivity = new Map<string, Record<string, number>>()
  const dailyRecovery = new Map<string, Record<string, number>>()
  const recoveryMap: Record<string, [string, (value: string) => number]> = {
    HKQuantityTypeIdentifierRestingHeartRate: ['resting_hr_bpm', (value) => Number(value)],
    HKQuantityTypeIdentifierHeartRateVariabilitySDNN: ['hrv_sdnn_ms', (value) => Number(value)],
    HKQuantityTypeIdentifierRespiratoryRate: ['respiratory_rate_brpm', (value) => Number(value)],
    HKQuantityTypeIdentifierOxygenSaturation: [
      'spo2_pct',
      (value) => {
        const numericValue = Number(value)
        return numericValue <= 1 ? numericValue * 100 : numericValue
      }
    ],
    HKQuantityTypeIdentifierAppleSleepingWristTemperature: [
      'wrist_temp_delta_c',
      (value) => Number(value)
    ],
    HKQuantityTypeIdentifierVO2Max: ['vo2max_ml_kg_min', (value) => Number(value)],
    HKQuantityTypeIdentifierBodyMass: ['body_mass_kg', (value) => Number(value)]
  }

  for (const record of asArray(root.Record as Record<string, string> | Record<string, string>[])) {
    const type = record.type ?? ''
    const startDate = record.startDate
    const endDate = record.endDate
    const value = record.value
    if (!startDate) continue

    let dateKey: string
    try {
      dateKey = dayIso(dtParse(startDate))
    } catch {
      continue
    }

    const activityRow =
      dailyActivity.get(dateKey) ??
      {
        steps: 0,
        distance_m: 0,
        active_energy_kcal: 0,
        basal_energy_kcal: 0,
        exercise_time_min: 0,
        stand_time_min: 0,
        flights_climbed: 0
      }
    const recoveryRow = dailyRecovery.get(dateKey) ?? {}

    if (type === 'HKQuantityTypeIdentifierStepCount') activityRow.steps += Number(value ?? 0)
    else if (type === 'HKQuantityTypeIdentifierDistanceWalkingRunning') {
      activityRow.distance_m += Number(value ?? 0)
    } else if (type === 'HKQuantityTypeIdentifierActiveEnergyBurned') {
      activityRow.active_energy_kcal += Number(value ?? 0)
    } else if (type === 'HKQuantityTypeIdentifierBasalEnergyBurned') {
      activityRow.basal_energy_kcal += Number(value ?? 0)
    } else if (type === 'HKQuantityTypeIdentifierAppleExerciseTime') {
      activityRow.exercise_time_min += Number(value ?? 0)
    } else if (type === 'HKQuantityTypeIdentifierAppleStandTime') {
      activityRow.stand_time_min += Number(value ?? 0)
    } else if (type === 'HKQuantityTypeIdentifierFlightsClimbed') {
      activityRow.flights_climbed += Number(value ?? 0)
    } else if (type === 'HKCategoryTypeIdentifierSleepAnalysis' && endDate) {
      try {
        const start = dtParse(startDate)
        const end = dtParse(endDate)
        const durationSeconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000))
        out.sleep_sessions.push({
          user_id: ctx.user_id,
          source: 'apple_health_xml',
          source_sleep_id: `apple_sleep:${toUtcIso(start)}`,
          started_at: toUtcIso(start),
          ended_at: toUtcIso(end),
          duration_s: durationSeconds,
          in_bed_s: durationSeconds,
          asleep_s: durationSeconds,
          awake_s: 0,
          rem_s: null,
          core_s: null,
          deep_s: null,
          raw_hash: sha(record)
        })
      } catch {
        anomalies.push('sleep_parse_error')
      }
    } else if (type in recoveryMap) {
      const [key, converter] = recoveryMap[type]
      try {
        recoveryRow[key] = converter(String(value ?? ''))
      } catch {
        anomalies.push(`invalid_${key}`)
      }
    }

    dailyActivity.set(dateKey, activityRow)
    dailyRecovery.set(dateKey, recoveryRow)
  }

  for (const [activityDate, row] of dailyActivity.entries()) {
    const payload: JsonMap = {
      user_id: ctx.user_id,
      activity_date: activityDate,
      source: 'apple_health_xml',
      ...row
    }
    payload.raw_hash = sha(payload)
    out.daily_activity.push(payload)
  }

  for (const [recoveryDate, row] of dailyRecovery.entries()) {
    const payload: JsonMap = {
      user_id: ctx.user_id,
      recovery_date: recoveryDate,
      source: 'apple_health_xml',
      ...row
    }
    payload.raw_hash = sha(payload)
    out.daily_recovery.push(payload)
  }

  for (const workout of asArray(root.Workout as Record<string, string> | Record<string, string>[])) {
    try {
      const start = dtParse(String(workout.startDate))
      const end = dtParse(String(workout.endDate))
      const durationSeconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000))
      const distance = numeric(workout.totalDistance)
      const calories = numeric(workout.totalEnergyBurned)
      const sport = String(workout.workoutActivityType ?? 'other')
        .replace('HKWorkoutActivityType', '')
        .toLowerCase()

      out.workouts.push({
        user_id: ctx.user_id,
        source: 'apple_watch_workout',
        source_workout_id: `apple:${toUtcIso(start)}:${sport}`,
        sport,
        started_at: toUtcIso(start),
        ended_at: toUtcIso(end),
        timezone: ctx.timezone,
        duration_s: durationSeconds,
        distance_m: distance,
        calories_kcal: calories,
        avg_hr_bpm: null,
        max_hr_bpm: null,
        avg_speed_mps: distance != null && durationSeconds > 0 ? distance / durationSeconds : null,
        avg_pace_s_per_km:
          distance != null && distance > 0 ? durationSeconds / (distance / 1000) : null,
        indoor: null,
        has_route: false,
        route_geojson: null,
        vendor_vo2max_ml_kg_min: null,
        raw_hash: sha(workout)
      })
    } catch {
      anomalies.push('workout_parse_error')
    }
  }
}

function extractAppleXmlFromZip(zipPath: string): string {
  const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.toLowerCase().endsWith('export.xml'))
    .sort((left, right) => left.length - right.length)

  const candidate = listing[0]
  if (!candidate) {
    throw new Error(`apple_zip_missing_export_xml:${basename(zipPath)}`)
  }
  return execFileSync('unzip', ['-p', zipPath, candidate], { encoding: 'utf8' })
}

function parsePolarTcx(xmlText: string, ctx: Context, out: Outputs): void {
  const root = parser.parse(xmlText) as { TrainingCenterDatabase?: Record<string, unknown> }
  const activities = asArray(
    root.TrainingCenterDatabase?.Activities
      ? (root.TrainingCenterDatabase.Activities as Record<string, unknown>).Activity
      : undefined
  ) as Array<Record<string, unknown>>

  for (const activity of activities) {
    const sport = String(activity.Sport ?? 'other').toLowerCase()
    for (const lap of asArray(activity.Lap) as Array<Record<string, unknown>>) {
      const startTime = String(lap.StartTime ?? '')
      if (!startTime) continue
      const startedAt = dtParse(startTime)
      const duration = numeric(lap.TotalTimeSeconds) ?? 0
      const distance = numeric(lap.DistanceMeters) ?? 0
      const calories = numeric(lap.Calories) ?? 0
      const sourceWorkoutId = `polar:${toUtcIso(startedAt)}:${sport}`

      const tracks = asArray(lap.Track) as Array<Record<string, unknown>>
      const hrValues: number[] = []

      for (const track of tracks) {
        for (const trackpoint of asArray(track.Trackpoint) as Array<Record<string, unknown>>) {
          const time = String(trackpoint.Time ?? '')
          const heartRateValue =
            typeof trackpoint.HeartRateBpm === 'object' && trackpoint.HeartRateBpm
              ? numeric((trackpoint.HeartRateBpm as Record<string, unknown>).Value)
              : null
          if (!time || heartRateValue == null) continue
          hrValues.push(heartRateValue)
          out.hr_samples.push({
            source: 'polar_h10',
            source_workout_id: sourceWorkoutId,
            ts: toUtcIso(dtParse(time)),
            hr_bpm: heartRateValue,
            rr_ms: null,
            quality: 100,
            is_interpolated: false
          })
        }
      }

      const endedAt = new Date(startedAt.getTime() + duration * 1000)
      const avgHr =
        hrValues.length > 0 ? hrValues.reduce((sum, value) => sum + value, 0) / hrValues.length : null

      const payload: JsonMap = {
        user_id: ctx.user_id,
        source: 'polar_h10',
        source_workout_id: sourceWorkoutId,
        sport,
        started_at: toUtcIso(startedAt),
        ended_at: toUtcIso(endedAt),
        timezone: ctx.timezone,
        duration_s: Math.round(duration),
        distance_m: distance,
        calories_kcal: calories,
        avg_hr_bpm: avgHr,
        max_hr_bpm: hrValues.length ? Math.max(...hrValues) : null,
        avg_speed_mps: duration > 0 ? distance / duration : null,
        avg_pace_s_per_km: distance > 0 ? duration / (distance / 1000) : null,
        indoor: null,
        has_route: false,
        route_geojson: null,
        vendor_vo2max_ml_kg_min: null
      }
      payload.raw_hash = sha(payload)
      out.workouts.push(payload)
    }
  }
}

function parsePolarCsv(text: string, out: Outputs): void {
  const [headerLine, ...rows] = text.split(/\r?\n/).filter(Boolean)
  if (!headerLine) return
  const headers = headerLine.split(',').map((value) => value.trim().toLowerCase())
  for (const row of rows) {
    const cols = row.split(',')
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      record[header] = cols[index]?.trim() ?? ''
    })
    const ts = record.timestamp || record.time
    const hr = record.hr || record.heart_rate || record['heart rate']
    const sourceWorkoutId = record.source_workout_id || record.workout_id
    if (!ts || !hr || !sourceWorkoutId) continue
    const hrNumber = Number(hr)
    if (!Number.isFinite(hrNumber)) continue
    out.hr_samples.push({
      source: 'polar_h10',
      source_workout_id: sourceWorkoutId,
      ts: toUtcIso(dtParse(ts)),
      hr_bpm: hrNumber,
      rr_ms: record.rr_ms ? Number(record.rr_ms) : null,
      quality: 100,
      is_interpolated: false
    })
  }
}

function computeMetrics(ctx: Context, out: Outputs): void {
  const hrByWorkout = new Map<string, JsonMap[]>()
  for (const sample of out.hr_samples) {
    const key = String(sample.source_workout_id)
    if (!hrByWorkout.has(key)) hrByWorkout.set(key, [])
    hrByWorkout.get(key)!.push(sample)
  }

  const resting = out.daily_recovery
    .map((row) => numeric(row.resting_hr_bpm))
    .filter((value): value is number => value != null)
    .sort((left, right) => left - right)

  const hrRest =
    resting.length > 0
      ? median(resting.slice(Math.max(0, resting.length - 14)))
      : ctx.hr_rest_fallback
  const observedMax = Math.max(
    0,
    ...out.workouts.map((row) => numeric(row.max_hr_bpm) ?? 0),
    ...out.hr_samples.map((row) => numeric(row.hr_bpm) ?? 0)
  )
  const hrMax = ctx.hr_max_override ?? observedMax ?? ctx.hr_max_default
  const hrr = Math.max(1, hrMax - hrRest)

  for (const workout of out.workouts) {
    const samples = (hrByWorkout.get(String(workout.source_workout_id)) ?? []).sort((left, right) =>
      String(left.ts).localeCompare(String(right.ts))
    )
    if (!samples.length) continue

    const zones = [0, 0, 0, 0, 0]
    const heartRates = samples.map((sample) => Number(sample.hr_bpm))

    for (let index = 0; index < samples.length - 1; index += 1) {
      const current = dtParse(String(samples[index].ts))
      const next = dtParse(String(samples[index + 1].ts))
      const durationSeconds = Math.max(1, Math.round((next.getTime() - current.getTime()) / 1000))
      const pct = (Number(samples[index].hr_bpm) - hrRest) / hrr
      const zoneIndex =
        pct < 0.6 ? 0 : pct < 0.7 ? 1 : pct < 0.8 ? 2 : pct < 0.9 ? 3 : 4
      zones[zoneIndex] += durationSeconds
    }

    const avgHr = heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length
    const dhr = (avgHr - hrRest) / hrr
    const durationMinutes = Number(workout.duration_s) / 60
    const trimp =
      ctx.sex.toLowerCase() === 'female'
        ? durationMinutes * dhr * 0.86 * Math.exp(1.67 * dhr)
        : durationMinutes * dhr * 0.64 * Math.exp(1.92 * dhr)
    const edwards =
      zones[0] / 60 + (zones[1] / 60) * 2 + (zones[2] / 60) * 3 + (zones[3] / 60) * 4 + (zones[4] / 60) * 5
    const avgSpeed = numeric(workout.avg_speed_mps)
    const aerobicEfficiency =
      avgSpeed != null ? avgSpeed / Math.max(1e-6, avgHr - hrRest) : null

    out.workout_metrics.push({
      source_workout_id: workout.source_workout_id,
      user_id: workout.user_id,
      trimp_bannister: round(trimp, 2),
      trimp_edwards: round(edwards, 2),
      time_in_z1_s: zones[0],
      time_in_z2_s: zones[1],
      time_in_z3_s: zones[2],
      time_in_z4_s: zones[3],
      time_in_z5_s: zones[4],
      aerobic_efficiency: aerobicEfficiency == null ? null : round(aerobicEfficiency, 4),
      decoupling_pct: null,
      recovery_hr_60s: null,
      avg_rr_ms: null,
      rmssd_ms: null,
      artifact_pct: 0
    })
  }
}

function median(values: number[]): number {
  if (!values.length) return 0
  const middle = Math.floor(values.length / 2)
  if (values.length % 2 === 1) return values[middle]
  return (values[middle - 1] + values[middle]) / 2
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function sqlLiteral(value: unknown): string {
  if (value == null) return 'null'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null'
  if (typeof value === 'boolean') return value ? '1' : '0'
  return `'${String(value).replaceAll("'", "''")}'`
}

function writeNdjson(outputRoot: string, out: Outputs): void {
  const normalizedRoot = resolve(outputRoot, 'normalized')
  mkdirSync(normalizedRoot, { recursive: true })
  for (const key of Object.keys(out) as OutputBucket[]) {
    writeFileSync(
      resolve(normalizedRoot, `${key}.ndjson`),
      out[key].map((row) => JSON.stringify(row)).join('\n') + (out[key].length ? '\n' : ''),
      'utf8'
    )
  }
}

function writeSql(outputRoot: string, out: Outputs): void {
  const sqlRoot = resolve(outputRoot, 'sql')
  mkdirSync(sqlRoot, { recursive: true })
  const lines = ['-- generated upserts']
  for (const workout of out.workouts) {
    lines.push(`
insert into workouts (
  user_id, source_id, source_workout_id, sport, started_at, ended_at, timezone,
  duration_s, distance_m, calories_kcal, avg_hr_bpm, max_hr_bpm,
  avg_speed_mps, avg_pace_s_per_km, indoor, has_route, route_geojson,
  vendor_vo2max_ml_kg_min, raw_hash
) values (
  ${sqlLiteral(workout.user_id)},
  (select id from data_sources where source_code=${sqlLiteral(workout.source)}),
  ${sqlLiteral(workout.source_workout_id)},
  ${sqlLiteral(workout.sport)},
  ${sqlLiteral(workout.started_at)},
  ${sqlLiteral(workout.ended_at)},
  ${sqlLiteral(workout.timezone)},
  ${sqlLiteral(workout.duration_s)}, ${sqlLiteral(workout.distance_m)}, ${sqlLiteral(workout.calories_kcal)}, ${sqlLiteral(workout.avg_hr_bpm)}, ${sqlLiteral(workout.max_hr_bpm)},
  ${sqlLiteral(workout.avg_speed_mps)}, ${sqlLiteral(workout.avg_pace_s_per_km)}, ${sqlLiteral(workout.indoor)}, ${sqlLiteral(workout.has_route)}, ${sqlLiteral(workout.route_geojson)},
  ${sqlLiteral(workout.vendor_vo2max_ml_kg_min)}, ${sqlLiteral(workout.raw_hash)}
)
on conflict (user_id, source_id, source_workout_id)
do update set
  duration_s=excluded.duration_s,
  distance_m=excluded.distance_m,
  calories_kcal=excluded.calories_kcal,
  avg_hr_bpm=excluded.avg_hr_bpm,
  max_hr_bpm=excluded.max_hr_bpm,
  updated_at=now();
`.trim())
  }
  writeFileSync(resolve(sqlRoot, 'upserts.sql'), `${lines.join('\n')}\n`, 'utf8')
}

function writeLog(outputRoot: string, anomalies: string[], out: Outputs): void {
  const logRoot = resolve(outputRoot, 'logs')
  mkdirSync(logRoot, { recursive: true })
  const today = new Date().toISOString().slice(0, 10)
  const lines = [
    `# Ingestion ${today}`,
    `- workouts: ${out.workouts.length}`,
    `- hr_samples: ${out.hr_samples.length}`,
    `- daily_recovery: ${out.daily_recovery.length}`,
    `- daily_activity: ${out.daily_activity.length}`,
    `- sleep_sessions: ${out.sleep_sessions.length}`,
    `- workout_metrics: ${out.workout_metrics.length}`,
    '',
    '## anomalies',
    ...(anomalies.length ? [...new Set(anomalies)].sort().map((entry) => `- ${entry}`) : ['- none'])
  ]
  writeFileSync(resolve(logRoot, `ingestion-${today}.md`), `${lines.join('\n')}\n`, 'utf8')
}

function dedupeWorkouts(out: Outputs): void {
  const byKey = new Map<string, JsonMap>()
  for (const workout of out.workouts) {
    const key = [workout.user_id, workout.source, workout.source_workout_id].join('|')
    byKey.set(key, workout)
  }
  out.workouts = [...byKey.values()]
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const ctx: Context = {
    user_id: requiredArg(args, 'user-id'),
    ...loadConfig(args.config)
  }
  const inputRoot = resolve(args['input-root'] ?? 'imports/raw')
  const outputRoot = resolve(args['output-root'] ?? 'imports')
  const outputs: Outputs = {
    workouts: [],
    hr_samples: [],
    daily_recovery: [],
    sleep_sessions: [],
    daily_activity: [],
    workout_metrics: []
  }
  const anomalies: string[] = []

  const files = walkFiles(inputRoot)
  for (const file of files) {
    const lowerPath = file.toLowerCase()
    if (lowerPath.endsWith('/export.xml') && lowerPath.includes('/apple/')) {
      parseAppleXml(readFileSync(file, 'utf8'), ctx, outputs, anomalies)
    } else if (lowerPath.endsWith('.zip') && lowerPath.includes('/apple/')) {
      try {
        parseAppleXml(extractAppleXmlFromZip(file), ctx, outputs, anomalies)
      } catch (error) {
        anomalies.push(error instanceof Error ? error.message : String(error))
      }
    } else if (lowerPath.endsWith('.tcx') && lowerPath.includes('/polar/')) {
      parsePolarTcx(readFileSync(file, 'utf8'), ctx, outputs)
    } else if (lowerPath.endsWith('.csv') && lowerPath.includes('/polar/')) {
      parsePolarCsv(readFileSync(file, 'utf8'), outputs)
    } else if (lowerPath.endsWith('.fit') && lowerPath.includes('/polar/')) {
      anomalies.push(`fit_not_parsed:${basename(file)}`)
    }
  }

  dedupeWorkouts(outputs)
  computeMetrics(ctx, outputs)
  writeNdjson(outputRoot, outputs)
  writeSql(outputRoot, outputs)
  writeLog(outputRoot, anomalies, outputs)
  console.log('ok')
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
