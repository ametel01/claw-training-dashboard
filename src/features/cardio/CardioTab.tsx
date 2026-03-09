import { useState } from 'react'
import type {
  DashboardData,
  Z2Point,
  Z2ScatterPoint,
  Z2EfficiencyPoint,
  Z2DecouplingPoint,
  VO2Point,
  AerobicTest
} from '@/types/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const Z2_CAP = 125
const CHART_COLORS = {
  axis: 'rgba(148, 163, 184, 0.55)',
  grid: 'rgba(148, 163, 184, 0.28)',
  label: 'rgba(226, 232, 240, 0.88)',
  primary: 'var(--color-primary)',
  primaryDim: 'rgba(0, 212, 255, 0.55)',
  scatter: '#7cc6ff',
  efficiency: '#ff9ed1',
  z2Cap: '#ffd166',
  vo2FourByFour: '#ffb454',
  vo2OneMin: '#8ae6ff'
} as const

function parseJsonArray<T>(val: T[] | string | undefined | null): T[] {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) || []
    } catch {
      return []
    }
  }
  return []
}

// ─── Reusable mini line chart ────────────────────────────────────────────────

function MiniSeriesChart({
  rows,
  getValue,
  formatLabel
}: {
  rows: { date?: string; session_date?: string }[]
  getValue: (row: Record<string, unknown>) => number
  formatLabel: (v: number) => string
}) {
  const values = rows
    .map((r) => getValue(r as Record<string, unknown>))
    .filter((v) => Number.isFinite(v))
  if (values.length < 2)
    return <p className="text-xs text-muted-foreground">Need at least 2 tests.</p>

  const W = 320,
    H = 120,
    L = 30,
    R = 8,
    T = 10,
    B = 18
  const min = Math.min(...values),
    max = Math.max(...values)
  const span = Math.max(1, max - min)
  const pw = W - L - R,
    ph = H - T - B
  const pts = rows.map((r, i) => {
    const v = getValue(r as Record<string, unknown>)
    return {
      key: `${(r as { date?: string; session_date?: string }).date || (r as { date?: string; session_date?: string }).session_date || 'point'}-${v}`,
      x: L + i * (pw / (rows.length - 1)),
      y: T + (1 - (v - min) / span) * ph,
      v,
      date:
        (r as { date?: string; session_date?: string }).date ||
        (r as { date?: string; session_date?: string }).session_date ||
        ''
    }
  })
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
      <title>Mini performance trend chart</title>
      <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke={CHART_COLORS.axis} strokeWidth="0.8" />
      <line x1={L} y1={T} x2={L} y2={H - B} stroke={CHART_COLORS.axis} strokeWidth="0.8" />
      <polyline
        points={polyline}
        fill="none"
        stroke={CHART_COLORS.primary}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {pts.map((p) => (
        <circle key={p.key} cx={p.x} cy={p.y} r={2.6} fill={CHART_COLORS.primary}>
          <title>
            {p.date}: {formatLabel(p.v)}
          </title>
        </circle>
      ))}
    </svg>
  )
}

// ─── Z2 HR Trend chart (with efficiency overlay + Z2 cap) ───────────────────

function Z2HrTrendChart({
  trendPoints,
  speedByDate
}: {
  trendPoints: { date: string; hr: number; estimated: boolean }[]
  speedByDate: Map<string, number>
}) {
  const recent = trendPoints.slice(-8)
  if (recent.length < 2)
    return <p className="text-xs text-muted-foreground">No Z2 HR data in last 12 weeks.</p>

  const W = 320,
    H = 120,
    L = 32,
    R = 10,
    T = 10,
    B = 18
  const hrs = recent.map((p) => p.hr)
  const minHr = Math.floor((Math.min(...hrs) - 3) / 5) * 5
  const maxHr = Math.ceil((Math.max(...hrs) + 3) / 5) * 5
  const span = Math.max(5, maxHr - minHr)
  const pw = W - L - R,
    ph = H - T - B

  const points = recent.map((p, i) => ({
    key: `${p.date}-${p.hr}-${p.estimated ? 'estimated' : 'actual'}`,
    x: L + i * (pw / (recent.length - 1)),
    y: T + (1 - (p.hr - minHr) / span) * ph,
    hr: p.hr,
    date: p.date,
    estimated: p.estimated
  }))

  const z2CapY = T + (1 - (Z2_CAP - minHr) / span) * ph
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((v) => ({
    hr: Math.round(minHr + v * span),
    y: T + (1 - v) * ph
  }))

  // Efficiency overlay
  const effTrend = points
    .map((p) => {
      const spd = speedByDate.get(p.date)
      return spd && spd > 0 && p.hr > 0 ? { x: p.x, eff: spd / p.hr } : null
    })
    .filter(Boolean) as { x: number; eff: number }[]

  let effPolyline = ''
  let effLegend = 'efficiency line: need speed+HR logs'
  if (effTrend.length >= 2) {
    const minE = Math.min(...effTrend.map((e) => e.eff))
    const maxE = Math.max(...effTrend.map((e) => e.eff))
    const spanE = Math.max(0.0001, maxE - minE)
    const ep = effTrend.map((e) => ({
      x: e.x,
      y: T + (1 - (e.eff - minE) / spanE) * ph
    }))
    effPolyline = ep.map((e) => `${e.x},${e.y}`).join(' ')
    const first = effTrend[0].eff
    const last = effTrend[effTrend.length - 1].eff
    const delta = ((last - first) / first) * 100
    effLegend = `efficiency Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`
  }

  const deltaHr = (points[points.length - 1].hr - points[0].hr).toFixed(1)
  const estimatedCount = recent.filter((p) => p.estimated).length

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28">
        <title>Zone 2 heart rate variation trend</title>
        {ticks.map((t) => (
          <g key={`tick-${t.hr}-${t.y}`}>
            <line
              x1={L}
              y1={t.y}
              x2={W - R}
              y2={t.y}
              stroke={CHART_COLORS.grid}
              strokeWidth="0.6"
            />
            <text x={L - 4} y={t.y + 3} fontSize="8" fill={CHART_COLORS.label} textAnchor="end">
              {t.hr}
            </text>
          </g>
        ))}
        <line
          x1={L}
          y1={H - B}
          x2={W - R}
          y2={H - B}
          stroke={CHART_COLORS.axis}
          strokeWidth="0.8"
        />
        <line x1={L} y1={T} x2={L} y2={H - B} stroke={CHART_COLORS.axis} strokeWidth="0.8" />
        {/* Z2 cap line */}
        <line
          x1={L}
          y1={z2CapY}
          x2={W - R}
          y2={z2CapY}
          stroke={CHART_COLORS.z2Cap}
          strokeDasharray="3 2"
          strokeWidth="1.2"
        />
        <text
          x={W - R}
          y={Math.max(8, z2CapY - 3)}
          fontSize="8"
          fill={CHART_COLORS.z2Cap}
          textAnchor="end"
        >
          Z2 cap {Z2_CAP}
        </text>
        {/* HR trend line */}
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={CHART_COLORS.primary}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Efficiency overlay */}
        {effPolyline && (
          <polyline
            points={effPolyline}
            fill="none"
            stroke={CHART_COLORS.efficiency}
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        )}
        {points.map((p) => (
          <circle
            key={p.key}
            cx={p.x}
            cy={p.y}
            r={2.8}
            fill={CHART_COLORS.primary}
            opacity={p.estimated ? 0.65 : 1}
          >
            <title>
              {p.date}: HR {p.hr}
              {p.estimated ? ' (from max HR)' : ''}
            </title>
          </circle>
        ))}
        <text x={L} y={H - 3} fontSize="7" fill={CHART_COLORS.label}>
          {points[0]?.date || ''}
        </text>
        <text x={W - R} y={H - 3} fontSize="7" fill={CHART_COLORS.label} textAnchor="end">
          {points[points.length - 1]?.date || ''}
        </text>
      </svg>
      <p className="text-xs text-muted-foreground mt-1">
        Last {recent.length} Z2 sessions · HR Δ {deltaHr} bpm
        {estimatedCount > 0 && ` · ${estimatedCount} points estimated from max HR`}
        {' · '}
        {effLegend}
      </p>
    </div>
  )
}

// ─── Z2 scatter plot (speed vs HR with trendline) ───────────────────────────

function Z2ScatterChart({
  points
}: {
  points: { date: string; hr: number; speed: number }[]
}) {
  if (points.length < 2) {
    return (
      <div className="rounded border border-border/30 bg-muted/10 p-4 text-center">
        <p className="text-sm font-medium text-foreground">Unlock this chart</p>
        <p className="text-xs text-muted-foreground mt-1">
          Log speed in notes as: <code className="text-primary">@ 6.2 km/h</code>
        </p>
      </div>
    )
  }

  const W = 320,
    H = 180,
    L = 36,
    R = 12,
    T = 12,
    B = 24
  const speeds = points.map((p) => p.speed)
  const hrs = points.map((p) => p.hr)
  const minX = Math.min(...speeds) - 0.2,
    maxX = Math.max(...speeds) + 0.2
  const minY = Math.floor((Math.min(...hrs) - 3) / 5) * 5
  const maxY = Math.ceil((Math.max(...hrs) + 3) / 5) * 5
  const xSpan = Math.max(0.5, maxX - minX),
    ySpan = Math.max(5, maxY - minY)
  const pw = W - L - R,
    ph = H - T - B

  const svgPts = points.map((p, i) => ({
    key: `${p.date}-${p.speed}-${p.hr}`,
    x: L + ((p.speed - minX) / xSpan) * pw,
    y: T + (1 - (p.hr - minY) / ySpan) * ph,
    opacity: (0.35 + (0.65 * (i + 1)) / points.length).toFixed(2),
    ...p
  }))
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((v) => ({
    hr: Math.round(minY + v * ySpan),
    y: T + (1 - v) * ph
  }))

  // Linear regression trendline
  let trendLine: React.ReactNode = null
  let trendNote = 'Need ≥4 sessions for a stable trendline'
  if (points.length >= 4) {
    const meanX = speeds.reduce((s, v) => s + v, 0) / speeds.length
    const meanY = hrs.reduce((s, v) => s + v, 0) / hrs.length
    const cov = points.reduce((s, p) => s + (p.speed - meanX) * (p.hr - meanY), 0)
    const varX = points.reduce((s, p) => s + (p.speed - meanX) ** 2, 0) || 1
    const slope = cov / varX
    const intercept = meanY - slope * meanX
    const toY = (v: number) => T + (1 - (v - minY) / ySpan) * ph
    trendLine = (
      <line
        x1={L}
        y1={toY(slope * minX + intercept)}
        x2={W - R}
        y2={toY(slope * maxX + intercept)}
        stroke={CHART_COLORS.primaryDim}
        strokeWidth="1.2"
        strokeDasharray="4 2"
      />
    )
    trendNote = 'Trendline shown (≥4 sessions)'
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40">
        <title>Zone 2 speed versus heart rate scatter plot</title>
        {yTicks.map((tick) => (
          <g key={`scatter-tick-${tick.hr}-${tick.y}`}>
            <line
              x1={L}
              y1={tick.y}
              x2={W - R}
              y2={tick.y}
              stroke={CHART_COLORS.grid}
              strokeWidth="0.6"
            />
            <text x={L - 4} y={tick.y + 3} fontSize="8" fill={CHART_COLORS.label} textAnchor="end">
              {tick.hr}
            </text>
          </g>
        ))}
        <line
          x1={L}
          y1={H - B}
          x2={W - R}
          y2={H - B}
          stroke={CHART_COLORS.axis}
          strokeWidth="0.8"
        />
        <line x1={L} y1={T} x2={L} y2={H - B} stroke={CHART_COLORS.axis} strokeWidth="0.8" />
        {trendLine}
        {svgPts.map((p) => (
          <circle
            key={p.key}
            cx={p.x}
            cy={p.y}
            r={3.2}
            fill={CHART_COLORS.scatter}
            opacity={Number(p.opacity)}
          >
            <title>
              {p.date}: {p.speed.toFixed(1)} km/h · HR {p.hr}
            </title>
          </circle>
        ))}
        <text x={W / 2} y={H - 4} fontSize="8" fill={CHART_COLORS.label} textAnchor="middle">
          Speed (km/h)
        </text>
        <text
          x={12}
          y={H / 2}
          fontSize="8"
          fill={CHART_COLORS.label}
          textAnchor="middle"
          transform={`rotate(-90 12 ${H / 2})`}
        >
          Avg HR
        </text>
      </svg>
      <p className="text-xs text-muted-foreground mt-1">
        Older = lighter dot · newer = darker dot · {trendNote}
      </p>
    </div>
  )
}

// ─── VO2 protocol chart ─────────────────────────────────────────────────────

function VO2ProtocolChart({
  rows,
  protocol,
  label
}: {
  rows: VO2Point[]
  protocol: string
  label: string
}) {
  const defaultRestByProtocol: Record<string, number> = { VO2_4x4: 3, VO2_1min: 1 }
  const series = rows
    .filter((r) => r.protocol === protocol)
    .map((r) => ({
      ...r,
      speed: Number(r.avg_speed_kmh || r.max_speed_kmh || 0),
      hr: Number(r.avg_hr ?? r.max_hr ?? 0),
      workMin: Number(r.work_min || (protocol === 'VO2_4x4' ? 4 : protocol === 'VO2_1min' ? 1 : 0)),
      restMin: Number(r.easy_min || defaultRestByProtocol[protocol] || 0)
    }))
    .filter((r) => r.hr > 0)
    .sort((a, b) => (a.session_date < b.session_date ? -1 : 1))

  if (!series.length) return <p className="text-xs text-muted-foreground mb-2">{label}: no data.</p>

  const W = 320,
    H = 120,
    L = 32,
    R = 22,
    T = 10,
    B = 18
  const hrs = series.map((r) => r.hr)
  const minHr = Math.floor((Math.min(...hrs) - 3) / 5) * 5
  const maxHr = Math.ceil((Math.max(...hrs) + 3) / 5) * 5
  const span = Math.max(5, maxHr - minHr)
  const pw = W - L - R,
    ph = H - T - B
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((v) => ({
    hr: Math.round(minHr + v * span),
    y: T + (1 - v) * ph
  }))
  const pts = series.map((r, i) => ({
    key: `${r.session_date}-${protocol}-${r.hr}-${r.speed}`,
    x: series.length === 1 ? L + pw / 2 : L + i * (pw / (series.length - 1)),
    y: T + (1 - (r.hr - minHr) / span) * ph,
    ...r
  }))
  const polyline = pts.length >= 2 ? pts.map((p) => `${p.x},${p.y}`).join(' ') : ''
  const strokeColor = protocol === 'VO2_4x4' ? CHART_COLORS.vo2FourByFour : CHART_COLORS.vo2OneMin

  // Efficiency trend
  const effRows = series
    .filter((r) => r.speed > 0 && r.hr > 0)
    .map((r) => {
      const rf = r.workMin > 0 && r.restMin > 0 ? r.workMin / r.restMin : r.workMin > 0 ? 1 : 0
      return { ...r, eff: (r.speed / r.hr) * rf }
    })
  let trendText = `${label}: need ≥2 sessions with speed + HR logged`
  if (effRows.length >= 2) {
    const first = effRows[0],
      last = effRows[effRows.length - 1]
    const delta = ((last.eff - first.eff) / first.eff) * 100
    trendText = `${label} efficiency Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% (${first.eff.toFixed(4)} → ${last.eff.toFixed(4)}, ${effRows.length} sessions, rest-adjusted)`
  }

  return (
    <div className="mb-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
        <title>{label} heart rate trend</title>
        {ticks.map((t) => (
          <g key={`tick-${t.hr}-${t.y}`}>
            <line
              x1={L}
              y1={t.y}
              x2={W - R}
              y2={t.y}
              stroke={CHART_COLORS.grid}
              strokeWidth="0.6"
            />
            <text x={L - 4} y={t.y + 3} fontSize="8" fill={CHART_COLORS.label} textAnchor="end">
              {t.hr}
            </text>
          </g>
        ))}
        <line
          x1={L}
          y1={H - B}
          x2={W - R}
          y2={H - B}
          stroke={CHART_COLORS.axis}
          strokeWidth="0.8"
        />
        <line x1={L} y1={T} x2={L} y2={H - B} stroke={CHART_COLORS.axis} strokeWidth="0.8" />
        {polyline && (
          <polyline
            points={polyline}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}
        {pts.map((p, i) => {
          const dy = i % 2 === 0 ? -6 : 12
          const spd = p.speed > 0 ? `${p.speed}k` : ''
          const workRest = p.workMin > 0 ? `${p.workMin}/${p.restMin}m` : 'n/a'
          return (
            <g key={p.key}>
              <circle cx={p.x} cy={p.y} r={2.8} fill={strokeColor}>
                <title>
                  {p.session_date} {protocol}: {p.speed > 0 ? `${p.speed} km/h` : 'no speed'} · HR{' '}
                  {p.hr} · work/rest {workRest}
                </title>
              </circle>
              {spd && (
                <text
                  x={p.x}
                  y={p.y + dy}
                  fontSize="7"
                  fill={CHART_COLORS.label}
                  textAnchor="middle"
                >
                  {spd}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <p className="text-xs text-muted-foreground">{trendText}</p>
    </div>
  )
}

// ─── Aerobic test log modal ─────────────────────────────────────────────────

function AerobicTestModal({
  open,
  kind,
  today,
  onClose,
  onSaved
}: {
  open: boolean
  kind: 'FIXED_SPEED' | 'FIXED_HR' | 'ZONE2_SESSION' | null
  today: string
  onClose: () => void
  onSaved: () => void
}) {
  const [fields, setFields] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }))
  const num = (k: string) => {
    const v = parseFloat(fields[k] ?? '')
    return Number.isFinite(v) ? v : null
  }

  async function save() {
    setSaving(true)
    let payload: Record<string, unknown> = { date: today }
    if (kind === 'FIXED_SPEED') {
      const avgHr = num('avgHr')
      if (!avgHr) {
        setSaving(false)
        return
      }
      payload = {
        ...payload,
        testType: 'FIXED_SPEED',
        speed: 11,
        distance: 2.4,
        duration: 13,
        avgHr,
        maxHr: num('maxHr'),
        notes: 'Monthly fixed-speed test'
      }
    } else if (kind === 'FIXED_HR') {
      const avgSpeed = num('avgSpeed')
      if (!avgSpeed) {
        setSaving(false)
        return
      }
      payload = {
        ...payload,
        testType: 'FIXED_HR',
        duration: 30,
        avgSpeed,
        avgHr: num('avgHr') || 120,
        notes: 'Monthly fixed-HR test'
      }
    } else if (kind === 'ZONE2_SESSION') {
      const hr1 = num('hr1'),
        hr2 = num('hr2')
      if (!hr1 || !hr2) {
        setSaving(false)
        return
      }
      payload = {
        ...payload,
        testType: 'ZONE2_SESSION',
        duration: 40,
        hrFirstHalf: hr1,
        hrSecondHalf: hr2,
        speedFirstHalf: num('s1'),
        speedSecondHalf: num('s2'),
        notes: 'Monthly decoupling test'
      }
    }
    try {
      await fetch('/api/log-aerobic-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } catch {
      /* best-effort */
    }
    setSaving(false)
    setFields({})
    onSaved()
    onClose()
  }

  const titles: Record<string, string> = {
    FIXED_SPEED: 'Log Fixed-Speed Test (11.0 km/h, 0% incline, 2.4 km)',
    FIXED_HR: 'Log Fixed-HR Test (120 bpm, 30 min, 0% incline)',
    ZONE2_SESSION: 'Log Decoupling Test (steady Z2)'
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">{kind ? titles[kind] : ''}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          {kind === 'FIXED_SPEED' && (
            <>
              <Input
                placeholder="Average HR"
                type="number"
                onChange={set('avgHr')}
                value={fields.avgHr ?? ''}
              />
              <Input
                placeholder="Max HR (optional)"
                type="number"
                onChange={set('maxHr')}
                value={fields.maxHr ?? ''}
              />
            </>
          )}
          {kind === 'FIXED_HR' && (
            <>
              <Input
                placeholder="Average speed (km/h)"
                type="number"
                step="0.1"
                onChange={set('avgSpeed')}
                value={fields.avgSpeed ?? ''}
              />
              <Input
                placeholder="Average HR (default 120)"
                type="number"
                onChange={set('avgHr')}
                value={fields.avgHr ?? ''}
              />
            </>
          )}
          {kind === 'ZONE2_SESSION' && (
            <>
              <Input
                placeholder="HR first half"
                type="number"
                onChange={set('hr1')}
                value={fields.hr1 ?? ''}
              />
              <Input
                placeholder="HR second half"
                type="number"
                onChange={set('hr2')}
                value={fields.hr2 ?? ''}
              />
              <Input
                placeholder="Speed first half (optional)"
                type="number"
                step="0.1"
                onChange={set('s1')}
                value={fields.s1 ?? ''}
              />
              <Input
                placeholder="Speed second half (optional)"
                type="number"
                step="0.1"
                onChange={set('s2')}
                value={fields.s2 ?? ''}
              />
            </>
          )}
          <Button size="sm" disabled={saving} onClick={save} className="w-full">
            {saving ? 'Saving…' : 'Save Test'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main CardioTab ─────────────────────────────────────────────────────────

interface CardioTabProps {
  data: DashboardData
  onRefresh: () => void
}

export function CardioTab({ data, onRefresh }: CardioTabProps) {
  const [modal, setModal] = useState<'FIXED_SPEED' | 'FIXED_HR' | 'ZONE2_SESSION' | null>(null)
  const ca = data.cardioAnalytics
  if (!ca)
    return <p className="text-muted-foreground py-8 text-center">No cardio data available.</p>

  const pct = ca.z2_compliance_pct ?? 0
  const totalZ2 = ca.total_z2 ?? 0
  const inCap = ca.z2_in_cap ?? 0
  const aerobicTests: AerobicTest[] = data.aerobicTests || []

  // Parse JSON-string arrays
  const z2Points = parseJsonArray<Z2Point>(ca.z2_points)
  const z2ScatterRaw = parseJsonArray<Z2ScatterPoint>(ca.z2_scatter_points)
  const z2Efficiency = parseJsonArray<Z2EfficiencyPoint>(ca.z2_efficiency_points)
    .filter((p) => p.efficiency > 0)
    .sort((a, b) => (a.session_date < b.session_date ? -1 : 1))
  const z2Decoupling = parseJsonArray<Z2DecouplingPoint>(ca.z2_decoupling_points)
    .filter((p) => Number.isFinite(p.decoupling_pct))
    .sort((a, b) => (a.session_date < b.session_date ? -1 : 1))
  const vo2Points = parseJsonArray<VO2Point>(ca.vo2_points)

  // Z2 trend from z2_points
  const z2TrendPoints = z2Points
    .map((p) => {
      const avg = Number(p.avg_hr)
      const max = Number(p.max_hr)
      if (Number.isFinite(avg) && avg > 0)
        return { date: p.session_date, hr: avg, estimated: false }
      if (Number.isFinite(max) && max > 0) return { date: p.session_date, hr: max, estimated: true }
      return null
    })
    .filter((p): p is NonNullable<typeof p> => p !== null && Number.isFinite(p.hr) && p.hr > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  const speedByDate = new Map(z2Points.map((r) => [r.session_date, Number(r.speed_kmh)]))

  // Scatter (last 8 with speed > 0)
  const z2Scatter = z2ScatterRaw
    .map((p) => ({ date: p.session_date, hr: Number(p.avg_hr), speed: Number(p.speed_kmh) }))
    .filter((p) => p.hr > 0 && p.speed > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-8)

  // Aerobic test categories
  const fixedSpeedTests = aerobicTests.filter(
    (t) => t.test_type === 'FIXED_SPEED' && Number(t.avg_hr) > 0
  )
  const fixedHrTests = aerobicTests.filter(
    (t) => t.test_type === 'FIXED_HR' && Number(t.avg_speed) > 0
  )
  const decouplingTests = aerobicTests.filter(
    (t) => t.test_type === 'ZONE2_SESSION' && Number(t.decoupling_percent) >= 0
  )
  const fixedSpeedLast = fixedSpeedTests[fixedSpeedTests.length - 1]
  const fixedHrLast = fixedHrTests[fixedHrTests.length - 1]
  const decouplingLast = decouplingTests[decouplingTests.length - 1]

  // AFS scoring
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const scoreEff = (hr: number) => clamp((100 * (170 - hr)) / 30, 0, 100)
  const scoreCap = (spd: number) => clamp((100 * (spd - 5)) / 4, 0, 100)
  const scoreDur = (d: number) => clamp((100 * (10 - d)) / 10, 0, 100)
  const afsLabel = (v: number) =>
    v >= 80
      ? 'excellent'
      : v >= 65
        ? 'strong'
        : v >= 50
          ? 'average'
          : v >= 35
            ? 'developing'
            : 'weak base'
  const afsBandColor = (v: number | null) => {
    if (v == null || !Number.isFinite(v)) return 'border-border/30'
    if (v >= 80) return 'border-blue-400/50'
    if (v >= 65) return 'border-green-400/50'
    if (v >= 50) return 'border-yellow-400/50'
    if (v >= 35) return 'border-orange-400/50'
    return 'border-red-400/50'
  }

  const byMonth = new Map<string, Record<string, AerobicTest>>()
  for (const t of aerobicTests) {
    const month = String(t.date || '').slice(0, 7)
    if (!month) continue
    const rowsForMonth = byMonth.get(month) ?? {}
    rowsForMonth[t.test_type] = t
    byMonth.set(month, rowsForMonth)
  }
  const afsSeries = Array.from(byMonth.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, v]) => {
      if (!v.FIXED_SPEED || !v.FIXED_HR || !v.ZONE2_SESSION) return null
      const eff = scoreEff(Number(v.FIXED_SPEED.avg_hr))
      const cap = scoreCap(Number(v.FIXED_HR.avg_speed))
      const dur = scoreDur(Number(v.ZONE2_SESSION.decoupling_percent))
      const afs = 0.4 * cap + 0.35 * eff + 0.25 * dur
      return { date: `${month}-01`, afs: +afs.toFixed(1), eff, cap, dur }
    })
    .filter(Boolean) as { date: string; afs: number; eff: number; cap: number; dur: number }[]
  const afsLast = afsSeries[afsSeries.length - 1] || null
  const afsPrev = afsSeries.length > 1 ? afsSeries[afsSeries.length - 2] : null
  const afsDelta = afsLast && afsPrev ? afsLast.afs - afsPrev.afs : null

  // Adaptation / KPI
  let adaptState = ''
  let z2KpiStatus = 'Flat'
  let efficiencyBlock: React.ReactNode = null
  let aerobicSnapshot = ''

  if (z2Efficiency.length >= 1) {
    const recent8 = z2Efficiency.slice(-8)
    const last = recent8[recent8.length - 1]
    const first = recent8[0]
    const baseline = z2Efficiency[0]
    const rolling4 = z2Efficiency.slice(-4)
    const rolling4Avg = rolling4.reduce((s, p) => s + p.efficiency, 0) / rolling4.length
    const deltaRecent = first ? ((last.efficiency - first.efficiency) / first.efficiency) * 100 : 0
    const deltaBaseline = baseline
      ? ((last.efficiency - baseline.efficiency) / baseline.efficiency) * 100
      : 0

    z2KpiStatus = deltaRecent > 1 ? 'Improving' : deltaRecent < -1 ? 'Regressing' : 'Flat'
    const verdict =
      deltaRecent > 1 && pct >= 70
        ? 'On track'
        : pct < 60
          ? 'Needs consistency'
          : 'Stable but no gain'

    const recentVo2 = vo2Points.slice(-6).filter((p) => (p.avg_speed_kmh || p.max_speed_kmh) > 0)
    const vo2Stim = recentVo2.length >= 2 ? 'Adequate' : 'Low'
    adaptState =
      deltaRecent > 1 && pct >= 70 && vo2Stim === 'Adequate'
        ? 'Adapting'
        : pct < 60 || deltaRecent < -1
          ? 'Off track'
          : 'In progress'
    const adaptEmoji = adaptState === 'Adapting' ? '🟢' : adaptState === 'Off track' ? '🔴' : '🟡'

    const recommendation =
      deltaRecent > 1
        ? 'Keep current Z2 structure.'
        : 'Increase Z2 volume by +20 min/week or progress treadmill speed slightly.'

    efficiencyBlock = (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
              Z2 KPI Status
            </p>
            <p className="font-display text-2xl font-bold text-foreground">{z2KpiStatus}</p>
            <p className="text-xs text-muted-foreground mt-1">{verdict}</p>
            <p className="text-xs text-muted-foreground">
              Baseline: {baseline.efficiency.toFixed(3)} ({baseline.session_date})
            </p>
            <p className="text-xs text-muted-foreground">
              Current: {last.efficiency.toFixed(3)} ({last.session_date})
            </p>
            <p className="text-xs text-muted-foreground">
              {rolling4.length}-session avg: {rolling4Avg.toFixed(3)} · MoM proxy Δ{' '}
              {deltaRecent.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
              Fixed-HR Benchmark (primary)
            </p>
            <p className="font-display text-2xl font-bold text-primary">
              {last.speed_at_120 != null && Number.isFinite(last.speed_at_120)
                ? last.speed_at_120.toFixed(2)
                : '—'}{' '}
              km/h
            </p>
            <p className="text-xs text-muted-foreground">
              at 120 bpm · Efficiency {last.efficiency.toFixed(3)}
            </p>
            <p className="text-xs text-muted-foreground">
              Δ {deltaBaseline.toFixed(1)}% vs baseline · Alt @140:{' '}
              {last.speed_at_140 != null && Number.isFinite(last.speed_at_140)
                ? last.speed_at_140.toFixed(2)
                : '—'}{' '}
              km/h
            </p>
          </CardContent>
        </Card>
      </div>
    )

    aerobicSnapshot = `Efficiency: ${z2KpiStatus} · Compliance: ${pct}% · Drift data: ${z2Decoupling.length ? 'Available' : 'Missing'}\nRecommendation: ${recommendation}`
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

  const daysSince = (date?: string) => {
    if (!date) return 999
    return Math.floor(
      (new Date(`${today}T00:00:00`).getTime() - new Date(`${date}T00:00:00`).getTime()) / 86400000
    )
  }
  const dueLine = (name: string, date?: string) => {
    const d = daysSince(date)
    if (d > 35) return `${name}: overdue (${d}d)`
    if (d > 27) return `${name}: due soon (${d}d)`
    return `${name}: ok (${d}d)`
  }

  const pctClamped = Math.min(100, Math.round(pct))

  return (
    <div className="space-y-4 py-4">
      {/* Adaptation status */}
      {adaptState && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
              Am I adapting?
            </p>
            <p className="font-display text-2xl font-bold">
              {adaptState === 'Adapting' ? '🟢' : adaptState === 'Off track' ? '🔴' : '🟡'}{' '}
              {adaptState}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Efficiency {z2KpiStatus} · Compliance {pct}% · VO2 stimulus{' '}
              {vo2Points.slice(-6).filter((p) => (p.avg_speed_kmh || p.max_speed_kmh) > 0).length >=
              2
                ? 'Adequate'
                : 'Low'}{' '}
              · Drift data {z2Decoupling.length ? 'present' : 'missing'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Top stat row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Z2 Compliance</p>
            <p
              className="font-display text-3xl font-bold"
              style={{
                color:
                  pctClamped >= 80
                    ? 'var(--ok)'
                    : pctClamped >= 50
                      ? 'var(--warn)'
                      : 'var(--danger)'
              }}
            >
              {pctClamped}%
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {inCap}/{totalZ2} sessions in cap
            </p>
            <Progress value={pctClamped} className="h-1.5 [&>div]:bg-[var(--ok)]" />
          </CardContent>
        </Card>

        {/* Cardiac Decoupling card */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
              Cardiac Decoupling
            </p>
            {z2Decoupling.length > 0 ? (
              <div className="space-y-1">
                {z2Decoupling.slice(-5).map((p) => {
                  const tag =
                    p.decoupling_pct < 5 ? 'good' : p.decoupling_pct <= 7 ? 'watch' : 'high'
                  const col =
                    p.decoupling_pct < 5
                      ? 'var(--ok)'
                      : p.decoupling_pct <= 7
                        ? 'var(--warn)'
                        : 'var(--danger)'
                  return (
                    <div key={p.session_date} className="flex justify-between text-xs font-mono">
                      <span className="text-muted-foreground">{p.session_date}</span>
                      <span style={{ color: col }}>
                        {p.decoupling_pct.toFixed(1)}% ({tag})
                      </span>
                    </div>
                  )
                })}
                <p className="text-xs text-muted-foreground pt-1">
                  {'<5% good · 5–7% watch · >7% high drift'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No decoupling data yet (requires end HR in notes, e.g. &quot;end BPM 141&quot;).
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
              Z2 Sessions
            </p>
            <p className="font-display text-3xl font-bold text-foreground">{totalZ2}</p>
            <p className="text-xs text-muted-foreground">Total in last 12 weeks</p>
          </CardContent>
        </Card>
      </div>

      {/* Z2 KPI + Fixed-HR benchmark */}
      {efficiencyBlock}

      {/* Aerobic Snapshot */}
      {aerobicSnapshot && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
              Aerobic Status
            </p>
            {aerobicSnapshot.split('\n').map((line) => (
              <p key={line} className="text-xs text-muted-foreground">
                {line}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Aerobic Fitness (Monthly Tests) */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Aerobic Fitness (Monthly Tests)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AFS + metric cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Card className={cn('border', afsBandColor(afsLast?.afs ?? null))}>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">AFS</p>
                <p className="font-display text-2xl font-bold">
                  {afsLast ? afsLast.afs.toFixed(1) : '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {afsLast ? afsLabel(afsLast.afs) : 'need all 3 tests'}
                  {afsDelta != null
                    ? ` · ${afsDelta >= 0 ? '↑' : '↓'}${Math.abs(afsDelta).toFixed(1)}`
                    : ''}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/30">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">HR @ 11 km/h</p>
                <p className="font-display text-2xl font-bold">
                  {fixedSpeedLast ? Number(fixedSpeedLast.avg_hr).toFixed(0) : '—'}
                </p>
                <p className="text-xs text-muted-foreground">target: ↓</p>
              </CardContent>
            </Card>
            <Card className="border-border/30">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Speed @ 120 bpm</p>
                <p className="font-display text-2xl font-bold">
                  {fixedHrLast ? Number(fixedHrLast.avg_speed).toFixed(2) : '—'}
                </p>
                <p className="text-xs text-muted-foreground">km/h · target: ↑</p>
              </CardContent>
            </Card>
            <Card className="border-border/30">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Pa:Hr</p>
                <p className="font-display text-2xl font-bold">
                  {decouplingLast ? Number(decouplingLast.decoupling_percent).toFixed(1) : '—'}%
                </p>
                <p className="text-xs text-muted-foreground">target: ↓</p>
              </CardContent>
            </Card>
            <Card className="border-border/30">
              <CardContent className="p-3 space-y-0.5">
                <p className="text-xs text-muted-foreground">Test Scheduler</p>
                <p className="text-xs text-foreground/70">
                  {dueLine('Speed', fixedSpeedLast?.date)}
                </p>
                <p className="text-xs text-foreground/70">{dueLine('HR', fixedHrLast?.date)}</p>
                <p className="text-xs text-foreground/70">
                  {dueLine('Decouple', decouplingLast?.date)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Test specs */}
          <div className="rounded border border-border/30 bg-muted/10 p-3 space-y-2 text-xs text-muted-foreground">
            <p>
              <strong className="text-foreground">Fixed-Speed Cardiovascular Efficiency</strong> ·
              Run at <strong>11.0 km/h</strong>, <strong>0% incline</strong>,{' '}
              <strong>2.4 km</strong> (~13:05). Log avg/max HR. Lower HR over time = better.
            </p>
            <p>
              <strong className="text-foreground">Fixed-HR Aerobic Capacity</strong> ·{' '}
              <strong>30 min</strong> treadmill at <strong>0% incline</strong>, hold{' '}
              <strong>120 bpm</strong>. Log avg speed. Higher speed over time = better.
            </p>
            <p>
              <strong className="text-foreground">Aerobic Decoupling (Pa:Hr)</strong> · During
              steady Z2 run (prefer <strong>40+ min</strong>, min 30), keep pace constant. Log
              first/second-half HR. Lower % drift = better.
            </p>
          </div>

          {/* Log buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal('FIXED_SPEED')}>
              Log Fixed-Speed (11 km/h)
            </Button>
            <Button variant="outline" size="sm" onClick={() => setModal('FIXED_HR')}>
              Log Fixed-HR (120 bpm)
            </Button>
            <Button variant="outline" size="sm" onClick={() => setModal('ZONE2_SESSION')}>
              Log Decoupling (Z2)
            </Button>
          </div>

          {/* Mini charts grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {afsSeries.length >= 2 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Aerobic Fitness Score (AFS)</p>
                <MiniSeriesChart
                  rows={afsSeries}
                  getValue={(r) => (r as { afs: number }).afs}
                  formatLabel={(v) => v.toFixed(1)}
                />
              </div>
            )}
            {fixedSpeedTests.length >= 2 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">HR at 11 km/h</p>
                <MiniSeriesChart
                  rows={fixedSpeedTests}
                  getValue={(r) => Number((r as unknown as AerobicTest).avg_hr)}
                  formatLabel={(v) => `${v} bpm`}
                />
              </div>
            )}
            {fixedHrTests.length >= 2 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Speed at 120 bpm</p>
                <MiniSeriesChart
                  rows={fixedHrTests}
                  getValue={(r) => Number((r as unknown as AerobicTest).avg_speed)}
                  formatLabel={(v) => `${v.toFixed(2)} km/h`}
                />
              </div>
            )}
            {decouplingTests.length >= 2 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Aerobic Decoupling %</p>
                <MiniSeriesChart
                  rows={decouplingTests}
                  getValue={(r) => Number((r as unknown as AerobicTest).decoupling_percent)}
                  formatLabel={(v) => `${v.toFixed(1)}%`}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Z2 HR Trend */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Z2 HR Variation Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Z2HrTrendChart trendPoints={z2TrendPoints} speedByDate={speedByDate} />
        </CardContent>
      </Card>

      {/* Z2 Scatter */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Z2 Speed vs HR (Scatter + Trendline)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Z2ScatterChart points={z2Scatter} />
        </CardContent>
      </Card>

      {/* VO2 HR Efficiency Trends */}
      {vo2Points.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              VO2 HR Efficiency Trends (by Protocol)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VO2ProtocolChart rows={vo2Points} protocol="VO2_4x4" label="VO2 4x4" />
            <VO2ProtocolChart rows={vo2Points} protocol="VO2_1min" label="VO2 1min" />
          </CardContent>
        </Card>
      )}

      <AerobicTestModal
        open={!!modal}
        kind={modal}
        today={today}
        onClose={() => setModal(null)}
        onSaved={onRefresh}
      />
    </div>
  )
}
