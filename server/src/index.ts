#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import express from 'express'
import multer from 'multer'
import { allRows, getRow, openDatabase, runStatement, transact } from './lib/db'
import { ensureCycleTables } from './lib/cycle'
import { dashboardDataPath, distRoot, repoRoot, serverDistRoot } from './lib/paths'
import { todayIsoLocal } from './lib/time'

type JsonRecord = Record<string, unknown>

const port = Number(process.env.PORT ?? '8080')
const db = openDatabase()
const upload = multer({ storage: multer.memoryStorage() })
const app = express()

app.use(express.json({ limit: '10mb' }))
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  next()
})

function shiftIsoDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function sendJson(res: express.Response, status: number, payload: JsonRecord | JsonRecord[]): void {
  res.status(status).json(payload)
}

function requireBuiltScript(name: 'export-data' | 'health-pipeline'): string {
  const relativePath =
    name === 'export-data'
      ? 'dashboard/src/export-data.js'
      : 'server/src/cli/health-pipeline.js'
  const scriptPath = resolve(serverDistRoot, relativePath)
  if (!existsSync(scriptPath)) {
    throw new Error(`missing built server artifact: ${scriptPath}`)
  }
  return scriptPath
}

function runNodeScript(name: 'export-data' | 'health-pipeline', args: string[] = []): string {
  return execFileSync(process.execPath, [requireBuiltScript(name), ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, NODE_NO_WARNINGS: '1' }
  }).trim()
}

function refreshDashboardData(): string {
  return runNodeScript('export-data')
}

function runHealthPipeline(): string {
  const userId = process.env.HEALTH_PIPELINE_USER_ID ?? '00000000-0000-0000-0000-000000000001'
  const inputRoot = process.env.HEALTH_PIPELINE_INPUT_ROOT ?? 'imports/raw'
  const outputRoot = process.env.HEALTH_PIPELINE_OUTPUT_ROOT ?? 'imports'
  const configPath = process.env.HEALTH_PIPELINE_CONFIG

  const args = ['--user-id', userId, '--input-root', inputRoot, '--output-root', outputRoot]
  if (configPath) {
    args.push('--config', configPath)
  }

  const stdout = runNodeScript('health-pipeline', args)
  const outputBase = resolve(repoRoot, outputRoot)
  const required = [
    'normalized/workouts.ndjson',
    'normalized/hr_samples.ndjson',
    'normalized/daily_recovery.ndjson',
    'normalized/sleep_sessions.ndjson',
    'normalized/daily_activity.ndjson',
    'normalized/workout_metrics.ndjson',
    'sql/upserts.sql'
  ].map((relativePath) => resolve(outputBase, relativePath))

  const missing = required.filter((path) => !existsSync(path))
  if (missing.length) {
    throw new Error(`health pipeline missing artifacts: ${missing.join(', ')}`)
  }

  const logsDir = resolve(outputBase, 'logs')
  if (!existsSync(logsDir)) {
    throw new Error('health pipeline missing anomaly log')
  }

  return stdout
}

function saveUpload(filename: string, content: Buffer, destDir: string): string {
  mkdirSync(destDir, { recursive: true })
  const outPath = resolve(destDir, filename || 'upload.bin')
  writeFileSync(outPath, content)
  return outPath
}

function resolveTemplateId(blockType: 'Leader' | 'Anchor'): number {
  const mainScheme =
    getRow<{ value: string }>(db, "SELECT value FROM config WHERE key = 'main_scheme'")?.value ?? '5s Pro'
  const suppKey = blockType === 'Leader' ? 'leader_supplemental' : 'anchor_supplemental'
  const desiredSupp = getRow<{ value: string }>(db, 'SELECT value FROM config WHERE key = ?', suppKey)?.value ?? ''
  const candidates = [
    desiredSupp,
    desiredSupp.split(' ', 1)[0],
    blockType === 'Leader' ? 'BBS 5x10' : 'FSL 5x5',
    blockType === 'Leader' ? 'BBS' : 'FSL'
  ]
    .map((value) => value.trim())
    .filter(Boolean)

  const rows = allRows<{ id: number; supplemental_scheme: string }>(
    db,
    'SELECT id, supplemental_scheme FROM templates WHERE main_scheme = ? ORDER BY id',
    mainScheme
  )
  for (const candidate of candidates) {
    const match = rows.find(
      (row) => String(row.supplemental_scheme || '').toLowerCase() === candidate.toLowerCase()
    )
    if (match) return Number(match.id)
  }

  const fallback = getRow<{ id: number }>(
    db,
    'SELECT id FROM templates WHERE name LIKE ? ORDER BY id LIMIT 1',
    `${blockType}%`
  )
  if (!fallback) {
    throw new Error(`No template found for block type ${blockType}`)
  }
  return Number(fallback.id)
}

function upsertBarbellSession(date: string, note: string): number {
  runStatement(
    db,
    `
      INSERT INTO barbell_sessions(session_date, weekday, week_in_block, day_id, notes)
      VALUES(?, ((CAST(strftime('%w', ?) AS INTEGER) + 6) % 7) + 1, 1, NULL, ?)
      ON CONFLICT(session_date) DO NOTHING
    `,
    date,
    date,
    note
  )
  const row = getRow<{ id: number }>(db, 'SELECT id FROM barbell_sessions WHERE session_date = ?', date)
  if (!row) throw new Error(`Could not create barbell session for ${date}`)
  return Number(row.id)
}

function refreshAfterMutation(res: express.Response, payload: JsonRecord = { ok: true }): void {
  refreshDashboardData()
  sendJson(res, 200, payload)
}

app.post('/api/upload-health', upload.single('file'), (req, res) => {
  try {
    const kind = String(req.body.kind ?? 'apple').trim().toLowerCase()
    if (!req.file?.originalname) {
      sendJson(res, 400, { ok: false, error: 'file field is required' })
      return
    }
    let dest: string
    let allowed: Set<string>
    if (kind === 'apple') {
      dest = resolve(repoRoot, 'imports', 'raw', 'apple', 'latest')
      allowed = new Set(['.xml', '.zip'])
    } else if (kind === 'polar') {
      dest = resolve(repoRoot, 'imports', 'raw', 'polar', 'latest')
      allowed = new Set(['.tcx', '.csv', '.fit'])
    } else {
      sendJson(res, 400, { ok: false, error: 'kind must be apple or polar' })
      return
    }

    const extension = extname(req.file.originalname).toLowerCase()
    if (!allowed.has(extension)) {
      sendJson(res, 400, { ok: false, error: `unsupported file type ${extension} for ${kind}` })
      return
    }
    const outPath = saveUpload(req.file.originalname, req.file.buffer, dest)
    sendJson(res, 200, {
      ok: true,
      path: outPath.replace(`${repoRoot}/`, ''),
      kind
    })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

app.post('/api/cycle/start', (req, res) => {
  try {
    ensureCycleTables(db)
    const requestedStartDate = String(req.body.startDate ?? '').trim()
    const blockType = (String(req.body.blockType ?? '').trim() || null) as 'Leader' | 'Anchor' | null
    const note = String(req.body.note ?? 'Started from dashboard')
    const startDate = requestedStartDate || shiftIsoDate(todayIsoLocal(), 1)
    if (blockType && !['Leader', 'Anchor'].includes(blockType)) {
      sendJson(res, 400, { ok: false, error: 'blockType must be Leader or Anchor' })
      return
    }

    const last = getRow<{ block_no: number; block_type: string }>(
      db,
      'SELECT COALESCE(MAX(block_no), 0) AS block_no, COALESCE((SELECT block_type FROM program_blocks ORDER BY block_no DESC, id DESC LIMIT 1), \'Leader\') AS block_type FROM program_blocks'
    )
    const nextBlock = Number(last?.block_no ?? 0) + 1
    const chosenType = blockType ?? ((last?.block_type as 'Leader' | 'Anchor') || 'Leader')
    const templateId = resolveTemplateId(chosenType)

    transact(db, () => {
      const overrideBlocks = allRows<{ id: number; block_no: number }>(
        db,
        `
          SELECT pb.id, pb.block_no
          FROM program_blocks pb
          LEFT JOIN barbell_sessions bs ON bs.block_id = pb.id
          WHERE date(pb.start_date) >= date(?)
          GROUP BY pb.id, pb.block_no
          HAVING COUNT(bs.id) = 0
        `,
        startDate
      )
      const blockNos = overrideBlocks.map((row) => Number(row.block_no))
      const blockIds = overrideBlocks.map((row) => Number(row.id))
      if (blockNos.length) {
        for (const blockNo of blockNos) {
          runStatement(db, 'DELETE FROM planned_barbell_sets_snapshot WHERE block_no = ?', blockNo)
          runStatement(
            db,
            "DELETE FROM cycle_events WHERE event_type = 'new_cycle' AND block_no = ?",
            blockNo
          )
        }
      }
      if (blockIds.length) {
        for (const blockId of blockIds) {
          runStatement(db, 'DELETE FROM program_blocks WHERE id = ?', blockId)
        }
      }
      runStatement(
        db,
        `
          INSERT INTO program_blocks(block_no, block_type, start_date, template_id, notes)
          VALUES(?, ?, ?, ?, ?)
        `,
        nextBlock,
        chosenType,
        startDate,
        templateId,
        note
      )
      runStatement(
        db,
        `
          INSERT INTO cycle_events(event_date, event_type, block_no, note, created_by)
          VALUES(?, 'new_cycle', ?, ?, 'dashboard')
        `,
        todayIsoLocal(),
        nextBlock,
        `Start new cycle: ${chosenType} @ ${startDate}`
      )
      runStatement(
        db,
        `
          INSERT OR IGNORE INTO planned_barbell_sets_snapshot(
            session_date, block_no, block_type, week_in_block, day_name, category, lift, set_no,
            prescribed_reps, prescribed_pct, planned_weight_kg, source_tm_kg
          )
          SELECT
            p.session_date, p.block_no, p.block_type, p.week_in_block, p.day_name,
            p.category, p.lift, p.set_no, p.prescribed_reps, p.prescribed_pct, p.planned_weight_kg,
            ROUND(CASE WHEN p.prescribed_pct > 0 THEN p.planned_weight_kg / p.prescribed_pct ELSE NULL END, 2)
          FROM v_planned_barbell_sets p
          WHERE p.block_no = ?
        `,
        nextBlock
      )
    })

    refreshAfterMutation(res, {
      ok: true,
      blockNo: nextBlock,
      blockType: chosenType,
      startDate
    })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

app.post('/api/cycle/deload', (req, res) => {
  try {
    ensureCycleTables(db)
    const deloadCode = String(req.body.deloadCode ?? '').trim().toUpperCase()
    const startDate = String(req.body.startDate ?? '').trim() || todayIsoLocal()
    const durationDays = Math.max(1, Number(req.body.durationDays ?? 7) || 7)
    const note = String(req.body.note ?? 'Deload applied from dashboard')
    if (!deloadCode) {
      sendJson(res, 400, { ok: false, error: 'deloadCode required' })
      return
    }
    const profile = getRow<{ code: string }>(
      db,
      'SELECT code FROM deload_profiles WHERE code = ? LIMIT 1',
      deloadCode
    )
    if (!profile) {
      sendJson(res, 400, { ok: false, error: 'unknown deloadCode' })
      return
    }
    const endDate = shiftIsoDate(startDate, durationDays - 1)
    const blockNo = Number(
      getRow<{ block_no: number }>(db, 'SELECT COALESCE(MAX(block_no), 0) AS block_no FROM program_blocks')
        ?.block_no ?? 0
    )
    transact(db, () => {
      runStatement(
        db,
        'INSERT INTO deload_blocks(start_date, end_date, deload_code, note) VALUES(?, ?, ?, ?)',
        startDate,
        endDate,
        deloadCode,
        note
      )
      runStatement(
        db,
        `
          INSERT INTO cycle_events(event_date, event_type, deload_code, block_no, note, created_by)
          VALUES(?, 'deload_applied', ?, ?, ?, 'dashboard')
        `,
        todayIsoLocal(),
        deloadCode,
        blockNo,
        `Deload ${deloadCode}: ${startDate}..${endDate}`
      )
    })
    refreshAfterMutation(res, { ok: true, deloadCode, startDate, endDate })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

app.post('/api/tm/update', (req, res) => {
  try {
    const lift = String(req.body.lift ?? '').trim()
    const mode = String(req.body.mode ?? 'delta').trim()
    const value = Number(req.body.value)
    const effectiveDate = String(req.body.effectiveDate ?? '').trim() || todayIsoLocal()
    const note = String(req.body.note ?? 'TM update from dashboard')
    if (!lift) {
      sendJson(res, 400, { ok: false, error: 'lift required' })
      return
    }
    if (!['delta', 'set'].includes(mode)) {
      sendJson(res, 400, { ok: false, error: 'mode must be delta or set' })
      return
    }
    if (!Number.isFinite(value)) {
      sendJson(res, 400, { ok: false, error: 'numeric value required' })
      return
    }

    const row = getRow<{ id: number; current_tm: number }>(
      db,
      `
        SELECT
          l.id,
          COALESCE(
            (
              SELECT tm_kg
              FROM training_max_history t
              WHERE t.lift_id = l.id
              ORDER BY effective_date DESC, id DESC
              LIMIT 1
            ),
            0
          ) AS current_tm
        FROM lifts l
        WHERE l.name = ?
      `,
      lift
    )
    if (!row) {
      sendJson(res, 400, { ok: false, error: 'unknown lift' })
      return
    }
    const newTm = mode === 'set' ? value : Number(row.current_tm) + value
    if (newTm <= 0) {
      sendJson(res, 400, { ok: false, error: 'resulting TM must be > 0' })
      return
    }
    runStatement(
      db,
      `
        INSERT INTO training_max_history(lift_id, effective_date, tm_kg, cycle_label)
        VALUES(?, ?, ?, ?)
        ON CONFLICT(lift_id, effective_date)
        DO UPDATE SET tm_kg = excluded.tm_kg, cycle_label = excluded.cycle_label
      `,
      row.id,
      effectiveDate,
      newTm,
      note
    )
    refreshAfterMutation(res, { ok: true, lift, tmKg: newTm, effectiveDate })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

app.post('/api/refresh', (req, res) => {
  try {
    const includeHealth = ['1', 'true', 'yes'].includes(String(req.query.includeHealth ?? '0'))
    const healthStatus = includeHealth ? runHealthPipeline() : null
    refreshDashboardData()
    sendJson(res, 200, { ok: true, healthPipeline: healthStatus })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message.trim() : String(error) })
  }
})

app.post('/api/refresh-health', (_req, res) => {
  try {
    const healthStatus = runHealthPipeline()
    refreshDashboardData()
    sendJson(res, 200, { ok: true, healthPipeline: healthStatus })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message.trim() : String(error) })
  }
})

app.post('/api/set-status', (req, res) => {
  try {
    const date = String(req.query.date ?? '')
    const status = String(req.query.status ?? '')
    if (!date || !['green', 'yellow', 'red'].includes(status)) {
      sendJson(res, 400, { ok: false, error: 'date and valid status required' })
      return
    }
    runStatement(
      db,
      `
        INSERT INTO recovery_status(session_date, pain_level, note)
        VALUES(?, ?, 'Set from dashboard')
        ON CONFLICT(session_date) DO UPDATE SET pain_level = excluded.pain_level
      `,
      date,
      status
    )
    refreshAfterMutation(res)
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

app.post('/api/log-aerobic-test', (req, res) => {
  try {
    const testType = String(req.body.testType ?? '').trim().toUpperCase()
    const date = String(req.body.date ?? '').trim()
    if (!['FIXED_SPEED', 'FIXED_HR', 'ZONE2_SESSION'].includes(testType)) {
      sendJson(res, 400, { ok: false, error: 'invalid testType' })
      return
    }
    if (!date) {
      sendJson(res, 400, { ok: false, error: 'date required' })
      return
    }
    const numeric = (value: unknown) =>
      value == null || value === '' || Number.isNaN(Number(value)) ? null : Number(value)
    const hrFirstHalf = numeric(req.body.hrFirstHalf)
    const hrSecondHalf = numeric(req.body.hrSecondHalf)
    const decoupling =
      testType === 'ZONE2_SESSION' && hrFirstHalf && hrSecondHalf != null
        ? Math.round((((hrSecondHalf - hrFirstHalf) / hrFirstHalf) * 100 + Number.EPSILON) * 100) / 100
        : null
    runStatement(
      db,
      `
        INSERT INTO aerobic_tests(
          date, test_type, speed, distance, duration, avg_hr, max_hr, avg_speed,
          hr_first_half, hr_second_half, speed_first_half, speed_second_half, decoupling_percent, notes
        )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      date,
      testType,
      numeric(req.body.speed),
      numeric(req.body.distance),
      numeric(req.body.duration),
      numeric(req.body.avgHr),
      numeric(req.body.maxHr),
      numeric(req.body.avgSpeed),
      hrFirstHalf,
      hrSecondHalf,
      numeric(req.body.speedFirstHalf),
      numeric(req.body.speedSecondHalf),
      decoupling,
      String(req.body.notes ?? '')
    )
    refreshAfterMutation(res, { ok: true, decouplingPercent: decoupling })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

app.post('/api/log-action', (req, res) => {
  try {
    const action = String(req.body.action ?? '')
    const date = String(req.body.date ?? '')
    if (!action || !date) {
      sendJson(res, 400, { ok: false, error: 'action and date required' })
      return
    }

    switch (action) {
      case 'main_done': {
        const rows = (req.body.plannedBarbellRows ?? []) as JsonRecord[]
        const mainRows = rows.filter((row) => row.category === 'main')
        if (!mainRows.length) {
          sendJson(res, 400, { ok: false, error: 'no planned main rows' })
          return
        }
        transact(db, () => {
          const sessionId = upsertBarbellSession(date, 'Logged from dashboard main_done')
          runStatement(
            db,
            "DELETE FROM barbell_set_logs WHERE session_id = ? AND category = 'main'",
            sessionId
          )
          for (const row of mainRows) {
            runStatement(
              db,
              `
                INSERT INTO barbell_set_logs(
                  session_id, lift_id, category, set_no, prescribed_pct, prescribed_reps,
                  actual_weight_kg, actual_reps, note
                )
                SELECT ?, l.id, 'main', ?, ?, ?, ?, ?, 'Main done from dashboard'
                FROM lifts l
                WHERE l.name = ?
              `,
              sessionId,
              Number(row.set_no ?? 0),
              Number(row.prescribed_pct ?? 0),
              Number(row.prescribed_reps ?? 0),
              Number(row.planned_weight_kg ?? 0),
              Number(row.prescribed_reps ?? 0),
              String(row.lift ?? '')
            )
          }
        })
        break
      }
      case 'supp_done': {
        const rows = (req.body.plannedBarbellRows ?? []) as JsonRecord[]
        const suppRows = rows.filter((row) => row.category === 'supplemental')
        if (!suppRows.length) {
          sendJson(res, 400, { ok: false, error: 'no planned supplemental rows' })
          return
        }
        transact(db, () => {
          const sessionId = upsertBarbellSession(date, 'Logged from dashboard supp_done')
          runStatement(
            db,
            "DELETE FROM barbell_set_logs WHERE session_id = ? AND category = 'supplemental'",
            sessionId
          )
          for (const row of suppRows) {
            runStatement(
              db,
              `
                INSERT INTO barbell_set_logs(
                  session_id, lift_id, category, set_no, prescribed_pct, prescribed_reps,
                  actual_weight_kg, actual_reps, note
                )
                SELECT ?, l.id, 'supplemental', ?, ?, ?, ?, ?, 'Supplemental done from dashboard'
                FROM lifts l
                WHERE l.name = ?
              `,
              sessionId,
              Number(row.set_no ?? 0),
              Number(row.prescribed_pct ?? 0),
              Number(row.prescribed_reps ?? 0),
              Number(row.planned_weight_kg ?? 0),
              Number(row.prescribed_reps ?? 0),
              String(row.lift ?? '')
            )
          }
        })
        break
      }
      case 'supp_modified': {
        const text = String(req.body.suppModifiedText ?? '').trim()
        const rows = (req.body.plannedBarbellRows ?? []) as JsonRecord[]
        const suppRows = rows.filter((row) => row.category === 'supplemental')
        if (!suppRows.length) {
          sendJson(res, 400, { ok: false, error: 'no planned supplemental rows' })
          return
        }
        const match = text.replaceAll('X', 'x').match(/(\d+)\s*x\s*(\d+)\s*@\s*(\d+(?:\.\d+)?)/)
        if (!match) {
          sendJson(res, 400, { ok: false, error: 'format must be like 5x10@60' })
          return
        }
        const [, setsText, repsText, weightText] = match
        const lift = String(suppRows[0].lift ?? '')
        transact(db, () => {
          const sessionId = upsertBarbellSession(date, 'Logged from dashboard supp_modified')
          runStatement(
            db,
            "DELETE FROM barbell_set_logs WHERE session_id = ? AND category = 'supplemental'",
            sessionId
          )
          for (let setNo = 1; setNo <= Number(setsText); setNo += 1) {
            runStatement(
              db,
              `
                INSERT INTO barbell_set_logs(session_id, lift_id, category, set_no, prescribed_reps, actual_weight_kg, actual_reps, note)
                SELECT ?, l.id, 'supplemental', ?, ?, ?, ?, 'Supplemental modified from dashboard'
                FROM lifts l
                WHERE l.name = ?
              `,
              sessionId,
              setNo,
              Number(repsText),
              Number(weightText),
              Number(repsText),
              lift
            )
          }
        })
        break
      }
      case 'cardio_done': {
        const planned = (req.body.plannedCardio ?? {}) as JsonRecord
        const sessionType = String(planned.session_type ?? 'Z2')
        const protocol =
          sessionType === 'Z2_VO2_4x4'
            ? 'VO2_4x4'
            : sessionType === 'Z2_VO2_1min'
              ? 'VO2_1min'
              : ['Z2', 'VO2_4x4', 'VO2_1min'].includes(sessionType)
                ? sessionType
                : 'Z2'
        const duration = Number(planned.duration_min ?? 30) || 30
        const avgHr = Number(req.body.avgHr ?? planned.target_hr_min ?? 120) || 120
        const speedInput =
          req.body.speedKmh == null || req.body.speedKmh === '' ? null : Number(req.body.speedKmh)
        const speedLow =
          planned.speed_low_kmh == null || planned.speed_low_kmh === ''
            ? null
            : Number(planned.speed_low_kmh)
        const speedHigh =
          planned.speed_high_kmh == null || planned.speed_high_kmh === ''
            ? null
            : Number(planned.speed_high_kmh)
        const speedForTrend =
          speedInput != null && Number.isFinite(speedInput)
            ? speedInput
            : speedHigh != null && Number.isFinite(speedHigh)
              ? speedHigh
              : speedLow != null && Number.isFinite(speedLow)
                ? speedLow
                : null
        let note = 'Cardio done from dashboard (avg HR logged)'
        if (speedForTrend != null) note += ` @ ${speedForTrend.toFixed(1)} km/h`

        runStatement(
          db,
          `
            INSERT INTO cardio_sessions(session_date, slot, protocol, duration_min, avg_hr, z2_cap_respected, notes)
            VALUES(?, 'CARDIO', ?, ?, ?, ?, ?)
            ON CONFLICT(session_date, slot) DO UPDATE SET
              protocol = excluded.protocol,
              duration_min = excluded.duration_min,
              avg_hr = excluded.avg_hr,
              z2_cap_respected = excluded.z2_cap_respected,
              notes = excluded.notes
          `,
          date,
          protocol,
          duration,
          avgHr,
          protocol === 'Z2' ? 1 : null,
          note
        )
        if (['VO2_4x4', 'VO2_1min'].includes(protocol) && speedForTrend != null) {
          const session = getRow<{ id: number }>(
            db,
            "SELECT id FROM cardio_sessions WHERE session_date = ? AND slot = 'CARDIO' LIMIT 1",
            date
          )
          if (session) {
            runStatement(db, 'DELETE FROM cardio_intervals WHERE session_id = ?', session.id)
            runStatement(
              db,
              `
                INSERT INTO cardio_intervals(session_id, interval_no, work_min, easy_min, target_speed_kmh, achieved_hr, note)
                VALUES(?, 1, ?, ?, ?, ?, 'Auto summary interval from dashboard cardio_done')
              `,
              session.id,
              req.body.workMin != null ? Number(req.body.workMin) : protocol === 'VO2_4x4' ? 4 : 1,
              req.body.restMin != null ? Number(req.body.restMin) : protocol === 'VO2_4x4' ? 3 : 1,
              speedForTrend,
              avgHr
            )
          }
        }
        break
      }
      case 'z2_fixed_hr_test': {
        const avgHr = Number(req.body.avgHr)
        const speedKmh = Number(req.body.speedKmh)
        if (!Number.isFinite(avgHr) || !Number.isFinite(speedKmh) || avgHr <= 0 || speedKmh <= 0) {
          sendJson(res, 400, { ok: false, error: 'avgHr and speedKmh are required' })
          return
        }
        runStatement(
          db,
          `
            INSERT INTO cardio_sessions(session_date, slot, protocol, duration_min, avg_hr, z2_cap_respected, notes)
            VALUES(?, 'CARDIO', 'Z2', 30, ?, ?, ?)
            ON CONFLICT(session_date, slot) DO UPDATE SET
              protocol = excluded.protocol,
              duration_min = excluded.duration_min,
              avg_hr = excluded.avg_hr,
              z2_cap_respected = excluded.z2_cap_respected,
              notes = excluded.notes
          `,
          date,
          avgHr,
          avgHr <= 125 ? 1 : 0,
          `Z2 fixed HR test 120 bpm @ ${speedKmh.toFixed(1)} km/h, avg HR ${avgHr}`
        )
        break
      }
      case 'rings_done': {
        transact(db, () => {
          runStatement(
            db,
            `
              INSERT INTO rings_sessions(session_date, slot, template, completed_as_prescribed, notes)
              SELECT ?, 'PM',
                COALESCE(
                  (
                    SELECT template_code
                    FROM rings_plan_days
                    WHERE weekday = ((CAST(strftime('%w', ?) AS INTEGER) + 6) % 7) + 1
                  ),
                  'A'
                ),
                1,
                'Rings done from dashboard'
              ON CONFLICT(session_date, slot) DO UPDATE SET
                template = excluded.template,
                completed_as_prescribed = excluded.completed_as_prescribed,
                notes = excluded.notes
            `,
            date,
            date
          )
          const session = getRow<{ id: number }>(
            db,
            "SELECT id FROM rings_sessions WHERE session_date = ? AND slot = 'PM'",
            date
          )
          if (!session) throw new Error('Could not create rings session')
          runStatement(db, 'DELETE FROM rings_logs WHERE session_id = ?', session.id)
          runStatement(
            db,
            `
              INSERT INTO rings_logs(session_id, item_no, exercise, result_text, completed)
              SELECT ?, rti.item_no, rti.exercise, 'completed as prescribed', 1
              FROM rings_sessions rs
              JOIN rings_templates rt ON rt.code = rs.template
              JOIN rings_template_items rti ON rti.template_id = rt.id
              WHERE rs.session_date = ? AND rs.slot = 'PM'
              ORDER BY rti.item_no
            `,
            session.id,
            date
          )
        })
        break
      }
      default:
        sendJson(res, 400, { ok: false, error: 'unknown action' })
        return
    }

    refreshAfterMutation(res)
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

app.get('/data.json', (_req, res) => {
  try {
    if (!existsSync(dashboardDataPath)) {
      refreshDashboardData()
    }
    const raw = readFileSync(dashboardDataPath, 'utf8')
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.type('application/json').send(raw)
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

app.use('/dashboard', express.static(distRoot, { index: 'index.html' }))
app.use(express.static(distRoot))

app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(resolve(distRoot, 'index.html'))
})

app.use('/api', (_req, res) => {
  sendJson(res, 404, { ok: false, error: 'Not found' })
})

export { app }

if (process.env.CLAW_DISABLE_AUTOSTART !== '1') {
  app.listen(port, '127.0.0.1', () => {
    console.log(`Serving dashboard on http://127.0.0.1:${port}`)
  })
}
