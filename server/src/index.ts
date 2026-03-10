#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import express from 'express'
import multer from 'multer'
import { allRows, getRow, openDatabase, runStatement, transact } from './lib/db'
import { ensureCycleTables } from './lib/cycle'
import {
  dashboardDataPath,
  dashboardRoot,
  distRoot,
  repoRoot,
  serverDistRoot
} from './lib/paths'
import { todayIsoLocal } from './lib/time'

type JsonRecord = Record<string, unknown>
type FxRow = {
  id?: number
  base_currency: string
  quote_currency: string
  rate_date: string
  rate: number
}

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
  const safeName = basename(filename || 'upload.bin')
  mkdirSync(destDir, { recursive: true })
  const outPath = resolve(destDir, safeName || 'upload.bin')
  writeFileSync(outPath, content)
  return outPath
}

function ensureExpensesSchema(): void {
  const requiredTables = [
    'exp_accounts',
    'exp_categories',
    'exp_transactions',
    'exp_fx_rates',
    'exp_import_batches',
    'exp_import_rows_raw',
    'exp_categorization_rules'
  ]
  for (const table of requiredTables) {
    const row = getRow<{ name: string }>(
      db,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      table
    )
    if (!row) {
      throw new Error(`expenses table missing: ${table}`)
    }
  }

  const columns = allRows<{ name: string }>(db, 'PRAGMA table_info(exp_transactions)')
    .map((row) => row.name)
    .filter(Boolean)

  if (!columns.includes('amount_original')) {
    db.exec('ALTER TABLE exp_transactions ADD COLUMN amount_original REAL')
  }
  if (!columns.includes('amount_home')) {
    db.exec('ALTER TABLE exp_transactions ADD COLUMN amount_home REAL')
  }
  if (!columns.includes('fx_rate_used')) {
    db.exec('ALTER TABLE exp_transactions ADD COLUMN fx_rate_used REAL')
  }
  if (!columns.includes('fx_date')) {
    db.exec('ALTER TABLE exp_transactions ADD COLUMN fx_date TEXT')
  }

  db.exec(`
    UPDATE exp_transactions SET amount_original = COALESCE(amount_original, amount);
    UPDATE exp_transactions SET amount_home = COALESCE(amount_home, amount);
    UPDATE exp_transactions SET fx_rate_used = COALESCE(fx_rate_used, CASE WHEN currency = 'PHP' THEN 1.0 ELSE NULL END);
    UPDATE exp_transactions SET fx_date = COALESCE(fx_date, tx_date);
  `)
  runStatement(
    db,
    `
      INSERT INTO exp_fx_rates(base_currency, quote_currency, rate_date, rate, provider)
      VALUES('PHP', 'PHP', date('now'), 1.0, 'system')
      ON CONFLICT(base_currency, quote_currency, rate_date) DO NOTHING
    `
  )
  runStatement(
    db,
    `
      INSERT INTO exp_fx_rates(base_currency, quote_currency, rate_date, rate, provider)
      VALUES('USD', 'PHP', date('now'), 58.0, 'bootstrap')
      ON CONFLICT(base_currency, quote_currency, rate_date) DO NOTHING
    `
  )
}

function inferCurrency(accountName: string): string {
  return accountName.toLowerCase().includes('usd') ? 'USD' : 'PHP'
}

function getOrCreateAccount(accountName: string): { id: number; currency: string } {
  const name = accountName.trim() || 'Default Account'
  const inferredCurrency = inferCurrency(name)
  const existing = getRow<{ id: number; currency: string }>(
    db,
    'SELECT id, currency FROM exp_accounts WHERE name = ?',
    name
  )
  if (existing) {
    if ((existing.currency || '').toUpperCase() !== inferredCurrency) {
      runStatement(db, 'UPDATE exp_accounts SET currency = ? WHERE id = ?', inferredCurrency, existing.id)
    }
    return { id: Number(existing.id), currency: inferredCurrency }
  }
  const result = runStatement(db, 'INSERT INTO exp_accounts(name, currency) VALUES(?, ?)', name, inferredCurrency)
  return { id: Number(result.lastInsertRowid), currency: inferredCurrency }
}

async function fetchFxRateOnline(baseCurrency: string, quoteCurrency: string, rateDate: string): Promise<number> {
  if (baseCurrency === quoteCurrency) return 1
  const response = await fetch(
    `https://api.frankfurter.app/${rateDate}?from=${baseCurrency}&to=${quoteCurrency}`
  )
  if (!response.ok) {
    throw new Error(`FX rate unavailable for ${baseCurrency}/${quoteCurrency} on ${rateDate}`)
  }
  const payload = (await response.json()) as { rates?: Record<string, number> }
  const rate = payload.rates?.[quoteCurrency]
  if (!Number.isFinite(rate)) {
    throw new Error(`FX rate unavailable for ${baseCurrency}/${quoteCurrency} on ${rateDate}`)
  }
  return Number(rate)
}

async function getFxRate(baseCurrency: string, quoteCurrency: string, txDate: string): Promise<number> {
  const base = baseCurrency.toUpperCase()
  const quote = quoteCurrency.toUpperCase()
  if (base === quote) return 1

  const exact = getRow<{ rate: number }>(
    db,
    `
      SELECT rate
      FROM exp_fx_rates
      WHERE base_currency = ? AND quote_currency = ? AND rate_date = ?
      LIMIT 1
    `,
    base,
    quote,
    txDate
  )
  if (exact) return Number(exact.rate)

  try {
    const rate = await fetchFxRateOnline(base, quote, txDate)
    runStatement(
      db,
      `
        INSERT INTO exp_fx_rates(base_currency, quote_currency, rate_date, rate, provider)
        VALUES(?, ?, ?, ?, 'frankfurter')
        ON CONFLICT(base_currency, quote_currency, rate_date)
        DO UPDATE SET rate = excluded.rate, provider = excluded.provider
      `,
      base,
      quote,
      txDate,
      rate
    )
    return rate
  } catch {}

  const fallback = getRow<{ rate: number }>(
    db,
    `
      SELECT rate
      FROM exp_fx_rates
      WHERE base_currency = ? AND quote_currency = ? AND rate_date <= ?
      ORDER BY rate_date DESC
      LIMIT 1
    `,
    base,
    quote,
    txDate
  )
  if (fallback) return Number(fallback.rate)
  if (base === 'USD' && quote === 'PHP') return 58
  return 1
}

function extractPdfText(pdfPath: string): string {
  const output = execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
    cwd: repoRoot,
    encoding: 'utf8'
  }).trim()
  if (!output) {
    throw new Error('failed to extract PDF text')
  }
  return output
}

function parseTransactionLine(line: string): JsonRecord | null {
  const raw = line.trim()
  if (!raw) return null

  const numericDateMatch = raw.match(
    /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\s+(.+?)\s+([+-]?\$?\d[\d,]*\.\d{2})(?:\s+(CR|DR))?$/i
  )
  if (numericDateMatch) {
    const [, rawDate, description, amountRaw, crdr] = numericDateMatch
    let amount = Number(amountRaw.replaceAll(',', '').replace('$', ''))
    if (crdr?.toUpperCase() === 'DR' && amount > 0) amount = -amount
    if (crdr?.toUpperCase() === 'CR' && amount < 0) amount = Math.abs(amount)
    const formats = [
      /^(\d{2})\/(\d{2})\/(\d{4})$/,
      /^(\d{2})-(\d{2})-(\d{4})$/,
      /^(\d{2})\/(\d{2})\/(\d{2})$/,
      /^(\d{2})-(\d{2})-(\d{2})$/
    ]
    let txDate = rawDate
    for (const pattern of formats) {
      const match = rawDate.match(pattern)
      if (!match) continue
      const [, first, second, yearPart] = match
      const year = yearPart.length === 2 ? `20${yearPart}` : yearPart
      txDate = `${year}-${first}-${second}`
      break
    }
    return {
      tx_date: txDate,
      description: description.trim(),
      amount,
      confidence: description.length > 3 ? 0.9 : 0.7
    }
  }

  const revolutMatch = raw.match(
    /^(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+?)\s+\$([\d,]+\.\d{2})(?:\s+\$([\d,]+\.\d{2}))?$/
  )
  if (!revolutMatch) return null
  const [, rawDate, description, amountText] = revolutMatch
  const txDate = new Date(`${rawDate} UTC`).toISOString().slice(0, 10)
  let amount = Number(amountText.replaceAll(',', ''))
  const incomeMarkers = [
    'transfer from',
    'deposit',
    'withdrawing savings',
    'salary',
    'refund',
    'cashback',
    'interest',
    'received'
  ]
  if (!incomeMarkers.some((marker) => description.toLowerCase().includes(marker))) {
    amount = -amount
  }
  return { tx_date: txDate, description: description.trim(), amount, confidence: 0.82 }
}

function parsePdfLines(lines: string[]): JsonRecord[] {
  const entries: JsonRecord[] = []
  let currentDate: string | null = null
  let currentParts: string[] = []
  const datePrefix = /^(\w{3}\s+\d{1,2},\s+\d{4})\s+(.+)$/
  const amountRegex = /(-?\s*PHP\s*[\d,]+\.\d{2}|-?\$[\d,]+\.\d{2}|\$[\d,]+\.\d{2})/i

  for (const line of lines) {
    const raw = line.trim()
    if (!raw) continue
    if (
      raw.toLowerCase().startsWith('page ') ||
      raw.toLowerCase().startsWith('available balance') ||
      raw.toLowerCase().startsWith('account number') ||
      raw.toLowerCase().startsWith('date counterparty')
    ) {
      continue
    }

    const parsed = parseTransactionLine(raw)
    if (parsed) {
      entries.push(parsed)
      currentDate = null
      currentParts = []
      continue
    }

    const dateMatch = raw.match(datePrefix)
    if (dateMatch) {
      currentDate = dateMatch[1]
      currentParts = dateMatch[2] ? [dateMatch[2].trim()] : []
      continue
    }

    if (currentDate && !amountRegex.test(raw)) {
      currentParts.push(raw)
      continue
    }

    if (currentDate && amountRegex.test(raw)) {
      const amountMatch = raw.match(amountRegex)
      if (!amountMatch) continue
      const token = amountMatch[1]
      const value = Number(token.replace(/[^0-9.-]/g, '').replaceAll(',', ''))
      let amount = token.trim().startsWith('-') ? -Math.abs(value) : Math.abs(value)
      const description = `${currentParts.join(' ')} ${raw.slice(0, amountMatch.index).trim()}`
        .replace(/\s+/g, ' ')
        .trim()
      const lower = description.toLowerCase()
      const outflowMarkers = ['pos w/d', 'sent via', 'w/d ', 'withdraw', 'interest withheld']
      const inflowMarkers = ['received from', 'interest pay', 'cashback', 'refund']
      if (lower.includes('pmmf placement') || lower.includes('investment')) {
        amount = Math.abs(amount)
      } else if (amount > 0 && outflowMarkers.some((marker) => lower.includes(marker))) {
        amount = -amount
      } else if (
        amount > 0 &&
        !inflowMarkers.some((marker) => lower.includes(marker)) &&
        lower.includes('transfer') &&
        !lower.includes('from')
      ) {
        amount = -amount
      }

      entries.push({
        tx_date: new Date(`${currentDate} UTC`).toISOString().slice(0, 10),
        description: description || 'Transaction',
        amount,
        confidence: 0.78
      })
      currentDate = null
      currentParts = []
    }
  }

  return entries
}

function pickCategory(description: string, amount: number): number | null {
  const lower = description.toLowerCase()
  const rules = allRows<{
    id: number
    match_type: string
    pattern: string
    category_id: number
  }>(
    db,
    `
      SELECT id, match_type, pattern, category_id
      FROM exp_categorization_rules
      WHERE active = 1
      ORDER BY priority ASC, id ASC
    `
  )
  for (const rule of rules) {
    const pattern = (rule.pattern || '').toLowerCase()
    if (!pattern) continue
    const type = (rule.match_type || 'contains').toLowerCase()
    if (type === 'contains' && lower.includes(pattern)) return Number(rule.category_id)
    if (type === 'exact' && lower === pattern) return Number(rule.category_id)
    if (type === 'regex') {
      try {
        if (new RegExp(rule.pattern, 'i').test(description)) return Number(rule.category_id)
      } catch {}
    }
  }

  const keywordBuckets: Array<[string, string[]]> = [
    ['Transfer', ['withdrawing savings', 'depositing savings']],
    ['Income', ['transfer from', 'salary', 'refund', 'cashback', 'interest', 'received']],
    ['Investment', ['pmmf placement', 'investment', 'money market', 'mutual fund']],
    ['Transfer', ['international transfer', 'bank transfer', 'transfer to', 'to: alessandro metelli']],
    ['Transport', ['grab', 'uber', 'taxi', 'fuel', 'petrol', 'gas station']],
    ['Groceries', ['supermarket', 'shopsm', 'sm supermarket', 'grocery', 'market']],
    ['Dining', ['cafe', 'coffee', 'starbucks', 'restaurant', 'food', 'soft habit']],
    ['Subscriptions', ['netflix', 'spotify', 'metal plan fee', 'subscription', 'claude.ai', 'openai']],
    ['Software/Cloud', ['vercel', 'railway', 'google cloud', 'alchemy']],
    ['Fitness', ['f45', 'fitness', 'gym']],
    ['Travel', ['cebu pacific', 'air', 'hotel', 'booking', 'flight']],
    ['Fees', ['fee', 'atm', 'cash withdrawal', 'non-revolut fee']]
  ]
  for (const [categoryName, markers] of keywordBuckets) {
    if (!markers.some((marker) => lower.includes(marker))) continue
    const row = getRow<{ id: number }>(db, 'SELECT id FROM exp_categories WHERE name = ?', categoryName)
    if (row) return Number(row.id)
  }

  const fallbackName = amount > 0 ? 'Income' : 'Uncategorized'
  const fallback = getRow<{ id: number }>(db, 'SELECT id FROM exp_categories WHERE name = ?', fallbackName)
  return fallback ? Number(fallback.id) : null
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

app.get('/api/expenses/overview', (_req, res) => {
  try {
    ensureExpensesSchema()
    const sums = getRow<{
      income: number
      expenses: number
      tx_count: number
    }>(
      db,
      `
        SELECT
          COALESCE(SUM(CASE WHEN COALESCE(amount_home, amount) > 0 AND COALESCE(c.kind, 'expense') != 'transfer' THEN COALESCE(amount_home, amount) END), 0) AS income,
          COALESCE(SUM(CASE WHEN COALESCE(amount_home, amount) < 0 AND COALESCE(c.kind, 'expense') != 'transfer' THEN COALESCE(amount_home, amount) END), 0) AS expenses,
          COUNT(*) AS tx_count
        FROM exp_transactions t
        LEFT JOIN exp_categories c ON c.id = t.category_id
      `
    )
    sendJson(res, 200, {
      income: Number(sums?.income ?? 0),
      expenses: Number(sums?.expenses ?? 0),
      net: Number(sums?.income ?? 0) + Number(sums?.expenses ?? 0),
      txCount: Number(sums?.tx_count ?? 0)
    })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

app.get('/api/expenses/fx', (_req, res) => {
  try {
    ensureExpensesSchema()
    const rows = allRows<FxRow>(
      db,
      `
        SELECT base_currency, quote_currency, rate_date, rate
        FROM exp_fx_rates
        ORDER BY rate_date DESC, id DESC
        LIMIT 20
      `
    )
    sendJson(res, 200, rows as unknown as JsonRecord[])
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

app.get('/api/expenses/transactions', (req, res) => {
  try {
    ensureExpensesSchema()
    const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50) || 50))
    const rows = allRows<JsonRecord>(
      db,
      `
        SELECT
          t.id,
          t.tx_date,
          t.description,
          t.amount,
          t.amount_original,
          t.amount_home,
          t.currency,
          t.fx_rate_used,
          a.name AS account_name,
          a.currency AS account_currency,
          c.name AS category_name,
          COALESCE(c.kind, 'expense') AS category_kind
        FROM exp_transactions t
        LEFT JOIN exp_accounts a ON a.id = t.account_id
        LEFT JOIN exp_categories c ON c.id = t.category_id
        ORDER BY t.tx_date DESC, t.id DESC
        LIMIT ?
      `,
      limit
    )
    sendJson(res, 200, rows)
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

app.post('/api/expenses/fx-rate', async (req, res) => {
  try {
    ensureExpensesSchema()
    const base = String(req.body.base ?? 'USD').toUpperCase().trim()
    const quote = String(req.body.quote ?? 'PHP').toUpperCase().trim()
    const rateDate = String(req.body.date ?? todayIsoLocal()).trim()
    const rate = Number(req.body.rate)
    if (!Number.isFinite(rate)) {
      sendJson(res, 400, { ok: false, error: 'numeric rate required' })
      return
    }
    transact(db, () => {
      runStatement(
        db,
        `
          INSERT INTO exp_fx_rates(base_currency, quote_currency, rate_date, rate, provider)
          VALUES(?, ?, ?, ?, 'manual')
          ON CONFLICT(base_currency, quote_currency, rate_date)
          DO UPDATE SET rate = excluded.rate, provider = excluded.provider
        `,
        base,
        quote,
        rateDate,
        rate
      )
      runStatement(
        db,
        `
          UPDATE exp_transactions
          SET amount_home = amount_original * ?, fx_rate_used = ?, fx_date = ?
          WHERE currency = ?
        `,
        rate,
        rate,
        rateDate,
        base
      )
    })
    sendJson(res, 200, { ok: true })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

app.post('/api/expenses/fx-backfill', async (_req, res) => {
  try {
    ensureExpensesSchema()
    const rows = allRows<{ id: number; tx_date: string; currency: string; amount_original: number }>(
      db,
      "SELECT id, tx_date, currency, amount_original FROM exp_transactions WHERE currency = 'USD'"
    )
    let updated = 0
    for (const row of rows) {
      const rate = await getFxRate(row.currency, 'PHP', row.tx_date)
      runStatement(
        db,
        `
          UPDATE exp_transactions
          SET amount_home = ?, fx_rate_used = ?, fx_date = ?
          WHERE id = ?
        `,
        Number(row.amount_original ?? 0) * rate,
        rate,
        row.tx_date,
        row.id
      )
      updated += 1
    }
    sendJson(res, 200, { ok: true, updated })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

app.post('/api/expenses/import-pdf', upload.single('file'), async (req, res) => {
  try {
    ensureExpensesSchema()
    if (!req.file?.originalname) {
      sendJson(res, 400, { ok: false, error: 'file field is required' })
      return
    }
    if (extname(req.file.originalname).toLowerCase() !== '.pdf') {
      sendJson(res, 400, { ok: false, error: 'only PDF supported' })
      return
    }
    const accountName = String(req.body.accountName ?? 'Default Account').trim()
    const pdfPath = saveUpload(
      req.file.originalname,
      req.file.buffer,
      resolve(repoRoot, 'imports', 'raw', 'bank', 'latest')
    )
    const lines = extractPdfText(pdfPath)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    const parsedEntries = parsePdfLines(lines)
    const account = getOrCreateAccount(accountName)
    const batchResult = runStatement(
      db,
      `
        INSERT INTO exp_import_batches(source_type, source_filename, account_id, status, total_rows)
        VALUES('pdf', ?, ?, 'parsed', 0)
      `,
      basename(pdfPath),
      account.id
    )
    const batchId = Number(batchResult.lastInsertRowid)
    let parsedRows = 0
    let insertedTransactions = 0
    for (const entry of parsedEntries) {
      parsedRows += 1
      const rawLine = `${entry.tx_date ?? ''} ${entry.description ?? ''} ${entry.amount ?? ''}`.trim()
      runStatement(
        db,
        `
          INSERT INTO exp_import_rows_raw(batch_id, row_no, raw_text, parsed_tx_date, parsed_description, parsed_amount, confidence, status)
          VALUES(?, ?, ?, ?, ?, ?, ?, 'parsed')
        `,
        batchId,
        parsedRows,
        rawLine,
        String(entry.tx_date ?? ''),
        String(entry.description ?? ''),
        Number(entry.amount ?? 0),
        Number(entry.confidence ?? 0)
      )

      const normalizedLine = rawLine.toLowerCase().replace(/\s+/g, ' ')
      const sourceHash = createHash('sha256')
        .update(
          `${entry.tx_date}|${String(entry.description).trim().toLowerCase()}|${Number(entry.amount).toFixed(2)}|${normalizedLine}`
        )
        .digest('hex')

      const duplicateHash = getRow<{ id: number }>(
        db,
        'SELECT id FROM exp_transactions WHERE source_hash = ? LIMIT 1',
        sourceHash
      )
      if (duplicateHash) continue

      const duplicateBusinessKey = getRow<{ id: number }>(
        db,
        `
          SELECT id
          FROM exp_transactions
          WHERE tx_date = ?
            AND lower(trim(description)) = lower(trim(?))
            AND amount = ?
          LIMIT 1
        `,
        String(entry.tx_date),
        String(entry.description),
        Number(entry.amount)
      )
      if (duplicateBusinessKey) continue

      const categoryId = pickCategory(String(entry.description), Number(entry.amount))
      const fxRate = await getFxRate(account.currency, 'PHP', String(entry.tx_date))
      runStatement(
        db,
        `
          INSERT INTO exp_transactions(
            account_id, tx_date, description, amount, currency,
            amount_original, amount_home, fx_rate_used, fx_date, category_id, import_batch_id, source_hash
          )
          VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        account.id,
        String(entry.tx_date),
        String(entry.description),
        Number(entry.amount),
        account.currency,
        Number(entry.amount),
        Number(entry.amount) * fxRate,
        fxRate,
        String(entry.tx_date),
        categoryId,
        batchId,
        sourceHash
      )
      insertedTransactions += 1
    }

    runStatement(
      db,
      'UPDATE exp_import_batches SET total_rows = ?, inserted_rows = ?, status = ? WHERE id = ?',
      parsedRows,
      insertedTransactions,
      'done',
      batchId
    )
    sendJson(res, 200, { ok: true, batchId, parsedRows, insertedTransactions })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

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

const expensesRoot = resolve(repoRoot, 'expenses')

app.use('/dashboard', express.static(distRoot, { index: 'index.html' }))
app.use('/expenses', express.static(expensesRoot, { index: 'index.html' }))
app.use(express.static(distRoot))

app.get(/^(?!\/api\/).*/, (req, res) => {
  if (req.path.startsWith('/expenses')) {
    res.sendFile(resolve(expensesRoot, 'index.html'))
    return
  }
  res.sendFile(resolve(distRoot, 'index.html'))
})

app.use('/api', (_req, res) => {
  sendJson(res, 404, { ok: false, error: 'Not found' })
})

app.listen(port, '127.0.0.1', () => {
  console.log(`Serving dashboard on http://127.0.0.1:${port}`)
})
