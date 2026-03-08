import { getValue } from '../core/dom'
import { currentDateInDashboardTZ } from '../core/time'
import type { AnyList, AnyRecord } from '../core/types'

export function renderCardioAnalytics(data: AnyRecord = {}): void {
  const node = document.getElementById('cardioAnalytics')
  if (!node) return

  const totalZ2 = data.total_z2 || 0
  const inCap = data.z2_in_cap || 0
  const pct = data.z2_compliance_pct ?? 0

  const parseJsonArray = (value) => {
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return []
      }
    }
    return []
  }

  const z2Points = parseJsonArray(data.z2_points)
  const z2TrendPoints = z2Points
    .map((point) => {
      const avg = Number(point.avg_hr)
      const max = Number(point.max_hr)
      if (Number.isFinite(avg) && avg > 0) {
        return { date: point.session_date, hr: avg, estimated: false }
      }
      if (Number.isFinite(max) && max > 0) {
        return { date: point.session_date, hr: max, estimated: true }
      }
      return null
    })
    .filter((point) => point && Number.isFinite(point.hr) && point.hr > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  const z2Scatter = parseJsonArray(data.z2_scatter_points)
    .map((point) => ({
      date: point.session_date,
      hr: Number(point.avg_hr),
      speed: Number(point.speed_kmh)
    }))
    .filter((point) => point.hr > 0 && point.speed > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-8)

  const z2Efficiency = parseJsonArray(data.z2_efficiency_points)
    .map((point) => ({
      date: point.session_date,
      efficiency: Number(point.efficiency),
      speedAt120: Number(point.speed_at_120),
      speedAt140: Number(point.speed_at_140)
    }))
    .filter((point) => point.efficiency > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  const z2Decoupling = parseJsonArray(data.z2_decoupling_points)
    .map((point) => ({ date: point.session_date, decoupling: Number(point.decoupling_pct) }))
    .filter((point) => Number.isFinite(point.decoupling))
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  const vo2Points = parseJsonArray(data.vo2_points)
  const aerobicTests = (window.__dashboardData?.aerobicTests || []).map((row) => ({ ...row }))

  let z2HrTrend = '<p class="muted">No Z2 HR data in last 12 weeks.</p>'
  const recentZ2 = z2TrendPoints.slice(-8)
  if (recentZ2.length >= 2) {
    const width = 320
    const height = 120
    const left = 32
    const right = 10
    const top = 10
    const bottom = 18
    const hrs = recentZ2.map((point) => Number(point.hr))
    const minHr = Math.floor((Math.min(...hrs) - 3) / 5) * 5
    const maxHr = Math.ceil((Math.max(...hrs) + 3) / 5) * 5
    const span = Math.max(5, maxHr - minHr)
    const plotWidth = width - left - right
    const plotHeight = height - top - bottom
    const points = recentZ2.map((point, index) => ({
      x: left + index * (plotWidth / (recentZ2.length - 1)),
      y: top + (1 - (Number(point.hr) - minHr) / span) * plotHeight,
      hr: Number(point.hr),
      date: point.date,
      estimated: !!point.estimated
    }))
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((value) => ({
      hr: Math.round(minHr + value * span),
      y: top + (1 - value) * plotHeight
    }))
    const z2Cap = 125
    const z2CapY = top + (1 - (z2Cap - minHr) / span) * plotHeight
    const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')
    const grid = ticks
      .map(
        (tick) =>
          `<line x1="${left}" y1="${tick.y}" x2="${width - right}" y2="${tick.y}" class="z2-grid"/>`
      )
      .join('')
    const yLabels = ticks
      .map(
        (tick) =>
          `<text x="${left - 6}" y="${tick.y + 3}" class="z2-label" text-anchor="end">${tick.hr}</text>`
      )
      .join('')
    const circles = points
      .map(
        (point) =>
          `<g><circle cx="${point.x}" cy="${point.y}" r="2.8" style="opacity:${point.estimated ? '0.65' : '1'}"></circle><title>${point.date}: HR ${point.hr}${point.estimated ? ' (from max HR)' : ''}</title></g>`
      )
      .join('')

    const speedByDate = new Map(z2Points.map((row) => [row.session_date, Number(row.speed_kmh)]))
    const efficiencyTrend = points
      .map((point) => {
        const speed = Number(speedByDate.get(point.date))
        return Number.isFinite(speed) && speed > 0 && point.hr > 0
          ? { x: point.x, eff: speed / point.hr }
          : null
      })
      .filter(Boolean) as Array<{ x: number; eff: number }>
    let efficiencyPolyline = ''
    let efficiencyLegend = 'efficiency line: need speed+HR logs'
    if (efficiencyTrend.length >= 2) {
      const minEfficiency = Math.min(...efficiencyTrend.map((point) => point.eff))
      const maxEfficiency = Math.max(...efficiencyTrend.map((point) => point.eff))
      const spanEfficiency = Math.max(0.0001, maxEfficiency - minEfficiency)
      const efficiencyPoints = efficiencyTrend.map((point) => ({
        x: point.x,
        y: top + (1 - (point.eff - minEfficiency) / spanEfficiency) * plotHeight
      }))
      efficiencyPolyline = `<polyline points="${efficiencyPoints.map((point) => `${point.x},${point.y}`).join(' ')}" fill="none" stroke="#ff8cc6" stroke-width="2" stroke-dasharray="4 2"/>`
      const firstEfficiency = efficiencyTrend[0].eff
      const lastEfficiency = efficiencyTrend[efficiencyTrend.length - 1].eff
      const delta = ((lastEfficiency - firstEfficiency) / firstEfficiency) * 100
      efficiencyLegend = `efficiency Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`
    }
    const deltaHr = (points[points.length - 1].hr - points[0].hr).toFixed(1)
    const estimatedCount = recentZ2.filter((point) => point.estimated).length
    z2HrTrend = `
      <div class="z2-graph-wrap">
        <svg viewBox="0 0 ${width} ${height}" class="z2-graph" role="img" aria-label="Z2 average HR trend">
          ${grid}${yLabels}
          <line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" class="z2-axis"/>
          <line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" class="z2-axis"/>
          <line x1="${left}" y1="${z2CapY}" x2="${width - right}" y2="${z2CapY}" stroke="#ffc15a" stroke-dasharray="3 2" stroke-width="1.2"/>
          <text x="${width - right}" y="${Math.max(8, z2CapY - 3)}" class="z2-label" text-anchor="end">Z2 cap ${z2Cap}</text>
          <polyline points="${polyline}" class="z2-line"/>
          ${efficiencyPolyline}
          ${circles}
          <text x="${left}" y="${height - 3}" class="z2-label">${points[0]?.date || ''}</text>
          <text x="${width - right}" y="${height - 3}" class="z2-label" text-anchor="end">${points[points.length - 1]?.date || ''}</text>
        </svg>
        <div class="muted">Last ${recentZ2.length} Z2 sessions · HR trend Δ ${deltaHr} bpm${estimatedCount ? ` · ${estimatedCount} points estimated from max HR` : ''} · ${efficiencyLegend}</div>
      </div>`
  }

  let z2ScatterGraph =
    '<div class="cardio-empty"><div><strong>Unlock this chart</strong></div><div class="muted">Log speed in notes as: <code>@ 6.2 km/h</code></div></div>'
  if (z2Scatter.length >= 2) {
    const width = 320
    const height = 180
    const left = 36
    const right = 12
    const top = 12
    const bottom = 24
    const minX = Math.min(...z2Scatter.map((point) => point.speed)) - 0.2
    const maxX = Math.max(...z2Scatter.map((point) => point.speed)) + 0.2
    const minY = Math.floor((Math.min(...z2Scatter.map((point) => point.hr)) - 3) / 5) * 5
    const maxY = Math.ceil((Math.max(...z2Scatter.map((point) => point.hr)) + 3) / 5) * 5
    const xSpan = Math.max(0.5, maxX - minX)
    const ySpan = Math.max(5, maxY - minY)
    const plotWidth = width - left - right
    const plotHeight = height - top - bottom
    const points = z2Scatter.map((point, index) => ({
      ...point,
      x: left + ((point.speed - minX) / xSpan) * plotWidth,
      y: top + (1 - (point.hr - minY) / ySpan) * plotHeight,
      opacity: (0.35 + (0.65 * (index + 1)) / z2Scatter.length).toFixed(2)
    }))
    const circles = points
      .map(
        (point) =>
          `<circle cx="${point.x}" cy="${point.y}" r="3.2" style="fill:#59a8ff;opacity:${point.opacity}"><title>${point.date}: ${point.speed.toFixed(1)} km/h · HR ${point.hr}</title></circle>`
      )
      .join('')

    let trendline = ''
    let trendlineNote = 'Need ≥4 sessions for a stable trendline'
    if (z2Scatter.length >= 4) {
      const meanX = z2Scatter.reduce((sum, point) => sum + point.speed, 0) / z2Scatter.length
      const meanY = z2Scatter.reduce((sum, point) => sum + point.hr, 0) / z2Scatter.length
      const covariance = z2Scatter.reduce(
        (sum, point) => sum + (point.speed - meanX) * (point.hr - meanY),
        0
      )
      const varianceX = z2Scatter.reduce((sum, point) => sum + (point.speed - meanX) ** 2, 0) || 1
      const slope = covariance / varianceX
      const intercept = meanY - slope * meanX
      const y1 = slope * minX + intercept
      const y2 = slope * maxX + intercept
      const toY = (value) => top + (1 - (value - minY) / ySpan) * plotHeight
      trendline = `<line x1="${left}" y1="${toY(y1)}" x2="${width - right}" y2="${toY(y2)}" class="vo2-line line-44"/>`
      trendlineNote = 'Trendline shown (≥4 sessions)'
    }

    z2ScatterGraph = `
      <div class="z2-graph-wrap">
        <svg viewBox="0 0 ${width} ${height}" class="z2-graph" role="img" aria-label="Z2 speed vs HR scatter">
          <line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" class="z2-axis"/>
          <line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" class="z2-axis"/>
          ${trendline}
          ${circles}
          <text x="${width / 2}" y="${height - 4}" class="z2-label" text-anchor="middle">Speed (km/h)</text>
          <text x="12" y="${height / 2}" class="z2-label" text-anchor="middle" transform="rotate(-90 12 ${height / 2})">Avg HR</text>
        </svg>
        <div class="muted">Older = lighter dot · newer = darker dot · ${trendlineNote}</div>
      </div>`
  }

  let adaptationBlock = '<p class="muted">Adaptation status unavailable.</p>'
  let z2KpiBlock = '<p class="muted">No Z2 KPI data yet.</p>'
  let efficiencyBlock = '<p class="muted">No Z2 efficiency points yet.</p>'
  let aerobicSnapshot = '<p class="muted">Aerobic status unavailable.</p>'
  if (z2Efficiency.length >= 1) {
    const recent = z2Efficiency.slice(-8)
    const last = recent[recent.length - 1]
    const first = recent[0]
    const baseline = z2Efficiency[0]
    const rolling4 = z2Efficiency.slice(-4)
    const rolling4Avg = rolling4.reduce((sum, point) => sum + point.efficiency, 0) / rolling4.length
    const deltaRecent = first ? ((last.efficiency - first.efficiency) / first.efficiency) * 100 : 0
    const deltaBaseline = baseline
      ? ((last.efficiency - baseline.efficiency) / baseline.efficiency) * 100
      : 0
    const status = deltaRecent > 1 ? 'Improving' : deltaRecent < -1 ? 'Regressing' : 'Flat'
    const verdict =
      deltaRecent > 1 && pct >= 70
        ? '🟢 On track'
        : pct < 60
          ? '🟡 Needs consistency'
          : '🟡 Stable but no gain'
    const recommendation =
      deltaRecent > 1
        ? 'Keep current Z2 structure.'
        : 'Increase Z2 volume by +20 min/week or progress treadmill speed slightly.'

    const recentVo2 = [...vo2Points]
      .slice(-6)
      .filter((point) => Number(point.avg_speed_kmh || point.max_speed_kmh || 0) > 0)
    const vo2Stimulus = recentVo2.length >= 2 ? 'Adequate' : 'Low'
    const adaptState =
      deltaRecent > 1 && pct >= 70 && vo2Stimulus === 'Adequate'
        ? '🟢 Adapting'
        : pct < 60 || deltaRecent < -1
          ? '🔴 Off track'
          : '🟡 In progress'

    adaptationBlock = `
      <div class="cardio-z2-card" style="grid-column:1 / -1">
        <div class="muted">Am I adapting?</div>
        <div class="cardio-z2-big">${adaptState}</div>
        <div class="muted">Efficiency ${status} · Compliance ${pct}% · VO2 stimulus ${vo2Stimulus} · Drift data ${z2Decoupling.length ? 'present' : 'missing'}</div>
      </div>`

    z2KpiBlock = `
      <div class="cardio-z2-card">
        <div class="muted">Z2 KPI status</div>
        <div class="cardio-z2-big">${status}</div>
        <div class="muted">${verdict}</div>
        <div class="muted">Baseline: ${baseline.efficiency.toFixed(3)} (${baseline.date})</div>
        <div class="muted">Current: ${last.efficiency.toFixed(3)} (${last.date})</div>
        <div class="muted">${rolling4.length}-session avg: ${rolling4Avg.toFixed(3)} · MoM proxy Δ ${deltaRecent.toFixed(1)}%</div>
      </div>`

    efficiencyBlock = `
      <div class="cardio-z2-card">
        <div class="muted">Fixed-HR benchmark (primary)</div>
        <div class="cardio-z2-big">${Number.isFinite(last.speedAt120) ? last.speedAt120.toFixed(2) : '—'} km/h</div>
        <div class="muted">at 120 bpm · Efficiency ${last.efficiency.toFixed(3)}</div>
        <div class="muted">Example: ${Number.isFinite(last.speedAt120) ? last.speedAt120.toFixed(1) : '6.1'} km/h @ 120 bpm</div>
        <div class="muted">Δ ${deltaBaseline.toFixed(1)}% vs baseline · Alt @140: ${Number.isFinite(last.speedAt140) ? last.speedAt140.toFixed(2) : '—'} km/h</div>
      </div>`

    aerobicSnapshot = `
      <div class="cardio-z2-card" style="grid-column:1 / -1">
        <div class="muted">Aerobic Status</div>
        <div class="muted">Efficiency: ${status} · Compliance: ${pct}% · Drift data: ${z2Decoupling.length ? 'Available' : 'Missing'} </div>
        <div class="muted"><strong>Recommendation:</strong> ${recommendation}</div>
      </div>`
  }

  let decouplingBlock =
    '<p class="muted">No decoupling data yet (requires end HR in notes, e.g. "end BPM 141").</p>'
  if (z2Decoupling.length) {
    const recent = z2Decoupling.slice(-5)
    const rows = recent
      .map((point) => {
        const tag = point.decoupling < 5 ? 'good' : point.decoupling <= 7 ? 'watch' : 'high'
        return `<div class="muted">${point.date}: ${point.decoupling.toFixed(1)}% (${tag})</div>`
      })
      .join('')
    decouplingBlock = `
      <div class="cardio-z2-card">
        <div class="muted">Aerobic decoupling (quarterly check)</div>
        ${rows}
        <div class="muted">Guide: &lt;5% good · 5–7% watch · &gt;7% high drift</div>
      </div>`
  }

  const drawMiniSeries = (rows, getY, formatter = (value) => value) => {
    if ((rows || []).length < 2) return '<p class="muted">Need at least 2 tests.</p>'
    const width = 320
    const height = 120
    const left = 30
    const right = 8
    const top = 10
    const bottom = 18
    const values = rows
      .map(getY)
      .map(Number)
      .filter((value) => Number.isFinite(value))
    if (values.length < 2) return '<p class="muted">Insufficient numeric data.</p>'
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = Math.max(1, max - min)
    const plotWidth = width - left - right
    const plotHeight = height - top - bottom
    const points = rows.map((row, index) => {
      const value = Number(getY(row))
      return {
        x: left + index * (plotWidth / (rows.length - 1)),
        y: top + (1 - (value - min) / span) * plotHeight,
        value,
        date: row.date
      }
    })
    const polyline = points.map((point) => `${point.x},${point.y}`).join(' ')
    return `<svg viewBox="0 0 ${width} ${height}" class="z2-graph"><line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" class="z2-axis"/><line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" class="z2-axis"/><polyline points="${polyline}" class="z2-line"/>${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="2.6"><title>${point.date}: ${formatter(point.value)}</title></circle>`).join('')}</svg>`
  }

  const fixedSpeedTests = aerobicTests.filter(
    (test) => test.test_type === 'FIXED_SPEED' && Number(test.avg_hr) > 0
  )
  const fixedHrTests = aerobicTests.filter(
    (test) => test.test_type === 'FIXED_HR' && Number(test.avg_speed) > 0
  )
  const decouplingTests = aerobicTests.filter(
    (test) => test.test_type === 'ZONE2_SESSION' && Number(test.decoupling_percent) >= 0
  )

  const fixedSpeedLast = fixedSpeedTests[fixedSpeedTests.length - 1]
  const fixedHrLast = fixedHrTests[fixedHrTests.length - 1]
  const decouplingLast = decouplingTests[decouplingTests.length - 1]

  const clamp = (value, min, max) => Math.max(min, Math.min(value, max))
  const scoreEfficiency = (hr) => clamp((100 * (170 - Number(hr))) / 30, 0, 100)
  const scoreCapacity = (speed) => clamp((100 * (Number(speed) - 5)) / 4, 0, 100)
  const scoreDurability = (decoupling) => clamp((100 * (10 - Number(decoupling))) / 10, 0, 100)
  const afsLabel = (value) =>
    value >= 80
      ? 'excellent'
      : value >= 65
        ? 'strong'
        : value >= 50
          ? 'average'
          : value >= 35
            ? 'developing'
            : 'weak base'

  const byMonth = new Map()
  for (const test of aerobicTests) {
    const month = String(test.date || '').slice(0, 7)
    if (!month) continue
    if (!byMonth.has(month)) byMonth.set(month, {})
    const slot = byMonth.get(month)
    slot[test.test_type] = test
  }

  const afsSeries = Array.from(byMonth.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, value]) => {
      if (!value.FIXED_SPEED || !value.FIXED_HR || !value.ZONE2_SESSION) return null
      const efficiency = scoreEfficiency(value.FIXED_SPEED.avg_hr)
      const capacity = scoreCapacity(value.FIXED_HR.avg_speed)
      const durability = scoreDurability(value.ZONE2_SESSION.decoupling_percent)
      const afs = 0.4 * capacity + 0.35 * efficiency + 0.25 * durability
      return { date: `${month}-01`, afs: Number(afs.toFixed(1)), efficiency, capacity, durability }
    })
    .filter(Boolean)
  const afsLast = afsSeries[afsSeries.length - 1] || null
  const afsPrev = afsSeries.length > 1 ? afsSeries[afsSeries.length - 2] : null
  const afsDelta = afsLast && afsPrev ? afsLast.afs - afsPrev.afs : null

  const daysSince = (date) => {
    if (!date) return 999
    const deltaMs =
      new Date(`${currentDateInDashboardTZ()}T00:00:00`).getTime() -
      new Date(`${date}T00:00:00`).getTime()
    return Math.floor(deltaMs / 86400000)
  }
  const dueLine = (name, date) => {
    const days = daysSince(date)
    if (days > 35) return `${name}: overdue (${days}d)`
    if (days > 27) return `${name}: due soon (${days}d)`
    return `${name}: ok (${days}d)`
  }
  const afsBand = (value) => {
    if (value == null || !Number.isFinite(value)) return 'afs-none'
    if (value >= 80) return 'afs-elite'
    if (value >= 65) return 'afs-green'
    if (value >= 50) return 'afs-yellow'
    if (value >= 35) return 'afs-orange'
    return 'afs-red'
  }

  const aerobicCards = `
    <div class="cardio-z2-card ${afsBand(afsLast?.afs)}"><div class="muted">Aerobic Fitness Score (AFS)</div><div class="cardio-z2-big">${afsLast ? afsLast.afs.toFixed(1) : '—'}</div><div class="muted">${afsLast ? afsLabel(afsLast.afs) : 'need all 3 monthly tests'}${afsDelta == null ? '' : ` · ${afsDelta >= 0 ? '↑' : '↓'} ${Math.abs(afsDelta).toFixed(1)}`}</div></div>
    <div class="cardio-z2-card"><div class="muted">Cardio Efficiency (HR @ 11 km/h)</div><div class="cardio-z2-big">${fixedSpeedLast ? Number(fixedSpeedLast.avg_hr).toFixed(0) : '—'}</div><div class="muted">Trend target: ↓</div></div>
    <div class="cardio-z2-card"><div class="muted">Aerobic Capacity (speed @ 120 bpm)</div><div class="cardio-z2-big">${fixedHrLast ? Number(fixedHrLast.avg_speed).toFixed(2) : '—'} km/h</div><div class="muted">Trend target: ↑</div></div>
    <div class="cardio-z2-card"><div class="muted">Aerobic Durability (Pa:Hr)</div><div class="cardio-z2-big">${decouplingLast ? Number(decouplingLast.decoupling_percent).toFixed(1) : '—'}%</div><div class="muted">Trend target: ↓</div></div>
    <div class="cardio-z2-card"><div class="muted">Monthly test scheduler</div><div class="muted">${dueLine('Fixed-speed', fixedSpeedLast?.date)}<br/>${dueLine('Fixed-HR', fixedHrLast?.date)}<br/>${dueLine('Decoupling', decouplingLast?.date)}</div></div>
  `

  const recentVo2 = [...(vo2Points || [])].slice(-16)
  let vo2Graph = '<p class="muted">No VO2 data in last 12 weeks.</p>'
  if (recentVo2.length >= 1) {
    const width = 320
    const height = 120
    const leftPad = 32
    const rightPad = 22
    const topPad = 10
    const bottomPad = 18
    const defaultRestByProtocol = {
      VO2_4x4: 3,
      VO2_1min: 1
    }
    const rows = recentVo2
      .map((point) => ({
        date: point.session_date,
        protocol: point.protocol,
        speed: Number(point.avg_speed_kmh || point.max_speed_kmh || 0),
        hr: Number(point.avg_hr ?? point.max_hr ?? 0),
        workMin: Number(
          point.work_min ||
            (point.protocol === 'VO2_4x4' ? 4 : point.protocol === 'VO2_1min' ? 1 : 0)
        ),
        restMin: Number(
          point.easy_min || point.rest_min || defaultRestByProtocol[point.protocol] || 0
        )
      }))
      .filter(
        (point) => point.hr > 0 && (point.protocol === 'VO2_4x4' || point.protocol === 'VO2_1min')
      )
      .sort((a, b) => (a.date < b.date ? -1 : 1))

    const makeProtocolChart = (protocol, pointClass, lineClass, label) => {
      const series = rows.filter((row) => row.protocol === protocol)
      if (!series.length) {
        return `<div class="z2-graph-wrap"><p class="muted">${label}: no data.</p></div>`
      }

      const minHr = Math.floor((Math.min(...series.map((row) => row.hr)) - 3) / 5) * 5
      const maxHr = Math.ceil((Math.max(...series.map((row) => row.hr)) + 3) / 5) * 5
      const span = Math.max(5, maxHr - minHr)
      const plotWidth = width - leftPad - rightPad
      const plotHeight = height - topPad - bottomPad

      const points = series.map((row, index) => ({
        ...row,
        x:
          series.length === 1
            ? leftPad + plotWidth / 2
            : leftPad + index * (plotWidth / (series.length - 1)),
        y: topPad + (1 - (row.hr - minHr) / span) * plotHeight
      }))

      const polyline =
        points.length >= 2
          ? `<polyline points="${points.map((point) => `${point.x},${point.y}`).join(' ')}" class="vo2-line ${lineClass}"/>`
          : ''
      const pointMarkers = points
        .map((point, index) => {
          const dy = index % 2 === 0 ? -6 : 12
          const speedLabel =
            Number.isFinite(point.speed) && point.speed > 0 ? `${point.speed}k` : ''
          const workRest = point.workMin > 0 ? `${point.workMin}/${point.restMin || 0}m` : 'n/a'
          return `<g><circle cx="${point.x}" cy="${point.y}" r="2.8" class="${pointClass}"></circle>${speedLabel ? `<text x="${point.x}" y="${point.y + dy}" class="z2-point-label" text-anchor="middle">${speedLabel}</text>` : ''}<title>${point.date} ${protocol}: ${Number.isFinite(point.speed) && point.speed > 0 ? `${point.speed} km/h` : 'no speed logged'} · HR ${point.hr} · work/rest ${workRest}</title></g>`
        })
        .join('')

      const ticks = [0, 0.25, 0.5, 0.75, 1].map((value) => {
        const hrTick = Math.round(minHr + value * span)
        const y = topPad + (1 - value) * plotHeight
        return { hrTick, y }
      })
      const grid = ticks
        .map(
          (tick) =>
            `<line x1="${leftPad}" y1="${tick.y}" x2="${width - rightPad}" y2="${tick.y}" class="z2-grid"/>`
        )
        .join('')
      const yLabels = ticks
        .map(
          (tick) =>
            `<text x="${leftPad - 6}" y="${tick.y + 3}" class="z2-label" text-anchor="end">${tick.hrTick}</text>`
        )
        .join('')

      const efficiencyRows = series
        .filter(
          (row) =>
            Number.isFinite(row.speed) && row.speed > 0 && Number.isFinite(row.hr) && row.hr > 0
        )
        .map((row) => {
          const work = Math.max(0, row.workMin || 0)
          const rest = Math.max(0, row.restMin || 0)
          const restFactor = work > 0 && rest > 0 ? work / rest : work > 0 ? 1 : 0
          return { ...row, eff: (row.speed / row.hr) * restFactor }
        })

      let trendText = `${label}: need ≥2 sessions with speed + HR logged`
      if (efficiencyRows.length >= 2) {
        const first = efficiencyRows[0]
        const last = efficiencyRows[efficiencyRows.length - 1]
        const efficiencyDelta = ((last.eff - first.eff) / first.eff) * 100
        trendText = `${label} efficiency Δ ${efficiencyDelta >= 0 ? '+' : ''}${efficiencyDelta.toFixed(1)}% (${first.eff.toFixed(4)} → ${last.eff.toFixed(4)}, ${efficiencyRows.length} sessions, rest-adjusted)`
      }

      return `
        <div class="z2-graph-wrap" style="margin-bottom:10px">
          <div class="muted" style="margin-bottom:4px">${label}</div>
          <svg viewBox="0 0 ${width} ${height}" class="z2-graph" role="img" aria-label="${label} HR efficiency trend">
            ${grid}
            ${yLabels}
            <line x1="${leftPad}" y1="${height - bottomPad}" x2="${width - rightPad}" y2="${height - bottomPad}" class="z2-axis"/>
            <line x1="${leftPad}" y1="${topPad}" x2="${leftPad}" y2="${height - bottomPad}" class="z2-axis"/>
            ${polyline}
            ${pointMarkers}
          </svg>
          <div class="vo2-legend"><span class="muted">${trendText}</span></div>
        </div>
      `
    }

    vo2Graph = `${makeProtocolChart('VO2_4x4', 'vo2-pt-44', 'line-44', 'VO2 4x4')} ${makeProtocolChart('VO2_1min', 'vo2-pt-18', 'line-18', 'VO2 1min')}`
  }

  node.innerHTML = `
    <div class="cardio-analytics">
      ${adaptationBlock}
      <div class="cardio-z2-card">
        <div class="muted">Z2 compliance</div>
        <div class="cardio-z2-big">${pct}%</div>
        <div class="muted">${inCap}/${totalZ2} sessions in cap</div>
      </div>
      ${z2KpiBlock}
      ${efficiencyBlock}
      ${decouplingBlock}
      ${aerobicSnapshot}
      <div class="cardio-vo2-list" style="grid-column:1 / -1">
        <div class="muted" style="margin-bottom:6px">Aerobic Fitness (monthly tests)</div>
        <div class="cardio-analytics">${aerobicCards}</div>
        <div class="test-specs">
          <div><strong>Fixed-Speed Cardiovascular Efficiency</strong> · Run at <strong>11.0 km/h</strong>, <strong>0% incline</strong>, <strong>2.4 km</strong> (~13:05). Log avg/max HR. Lower HR over time = better.</div>
          <div><strong>Fixed-HR Aerobic Capacity</strong> · <strong>30 min</strong> treadmill at <strong>0% incline</strong>, hold <strong>120 bpm</strong>. Log avg speed. Higher speed over time = better.</div>
          <div><strong>Aerobic Decoupling (Pa:Hr)</strong> · During steady Z2 run (prefer <strong>40+ min</strong>, min 30), keep pace constant. Log first-half HR and second-half HR. Lower % drift = better.</div>
        </div>
        <div class="status-actions" style="margin-top:8px">
          <button type="button" class="status-btn" id="logFixedSpeedBtn">Log Fixed-Speed (11 km/h)</button>
          <button type="button" class="status-btn" id="logFixedHrBtn">Log Fixed-HR (120 bpm)</button>
          <button type="button" class="status-btn" id="logDecouplingBtn">Log Decoupling (Z2)</button>
        </div>
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Aerobic Fitness Score (AFS)</div>
        ${drawMiniSeries(
          afsSeries,
          (row) => row.afs,
          (value) => `${Number(value).toFixed(1)}`
        )}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">HR at 11 km/h</div>
        ${drawMiniSeries(
          fixedSpeedTests,
          (row) => row.avg_hr,
          (value) => `${value} bpm`
        )}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Speed at 120 bpm</div>
        ${drawMiniSeries(
          fixedHrTests,
          (row) => row.avg_speed,
          (value) => `${Number(value).toFixed(2)} km/h`
        )}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Aerobic Decoupling %</div>
        ${drawMiniSeries(
          decouplingTests,
          (row) => row.decoupling_percent,
          (value) => `${Number(value).toFixed(1)}%`
        )}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Z2 HR variation trend</div>
        ${z2HrTrend}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Z2 speed vs HR (scatter + trendline)</div>
        ${z2ScatterGraph}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">VO2 HR efficiency trends (by protocol)</div>
        ${vo2Graph}
      </div>
    </div>
  `

  const postAerobic = async (payload) => {
    const response = await fetch('/api/log-aerobic-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      let message = `failed (${response.status})`
      try {
        const json = await response.json()
        if (json?.error) message = json.error
      } catch {}
      throw new Error(message)
    }
  }

  const today = currentDateInDashboardTZ()

  const ensureAerobicModal = () => {
    let modal = document.getElementById('aerobicEntryModal')
    if (modal) return modal
    modal = document.createElement('div')
    modal.id = 'aerobicEntryModal'
    modal.className = 'modal'
    modal.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="aeroTitle">
        <div class="modal-head">
          <h3 id="aeroTitle">Log aerobic test</h3>
          <button type="button" class="modal-close" id="aeroCloseBtn">×</button>
        </div>
        <div id="aeroBody" class="modal-body"></div>
      </div>`
    document.body.appendChild(modal)
    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.classList.remove('open')
    })
    modal
      .querySelector('#aeroCloseBtn')
      ?.addEventListener('click', () => modal?.classList.remove('open'))
    return modal
  }

  const num = (id) => {
    const value = Number.parseFloat(getValue(id))
    return Number.isFinite(value) ? value : null
  }

  const openAerobicForm = (kind) => {
    const modal = ensureAerobicModal()
    const title = modal.querySelector('#aeroTitle')
    const body = modal.querySelector('#aeroBody')
    if (!title || !body) return

    if (kind === 'FIXED_SPEED') {
      title.textContent = 'Log Fixed-Speed Test (11.0 km/h, 0% incline, 2.4 km)'
      body.innerHTML = `
        <div class="status-actions"><input id="aeroAvgHr" class="status-input" type="number" step="1" placeholder="Average HR" /><input id="aeroMaxHr" class="status-input" type="number" step="1" placeholder="Max HR (optional)" /></div>
        <div class="status-actions"><button type="button" class="status-btn" id="aeroSaveBtn">Save Test</button></div>`
      body.querySelector('#aeroSaveBtn')?.addEventListener('click', async () => {
        const avgHr = num('aeroAvgHr')
        const maxHr = num('aeroMaxHr')
        if (!avgHr || avgHr <= 0) return alert('Enter average HR')
        await postAerobic({
          testType: 'FIXED_SPEED',
          date: today,
          speed: 11,
          distance: 2.4,
          duration: 13,
          avgHr,
          maxHr,
          notes: 'Monthly fixed-speed test'
        })
        modal.classList.remove('open')
        await window.__renderDashboard?.()
      })
    }

    if (kind === 'FIXED_HR') {
      title.textContent = 'Log Fixed-HR Test (120 bpm, 30 min, 0% incline)'
      body.innerHTML = `
        <div class="status-actions"><input id="aeroAvgSpeed" class="status-input" type="number" step="0.1" placeholder="Average speed (km/h)" /><input id="aeroAvgHr" class="status-input" type="number" step="1" placeholder="Average HR (default 120)" value="120" /></div>
        <div class="status-actions"><button type="button" class="status-btn" id="aeroSaveBtn">Save Test</button></div>`
      body.querySelector('#aeroSaveBtn')?.addEventListener('click', async () => {
        const avgSpeed = num('aeroAvgSpeed')
        const avgHr = num('aeroAvgHr') || 120
        if (!avgSpeed || avgSpeed <= 0) return alert('Enter average speed')
        await postAerobic({
          testType: 'FIXED_HR',
          date: today,
          duration: 30,
          avgSpeed,
          avgHr,
          notes: 'Monthly fixed-HR test'
        })
        modal.classList.remove('open')
        await window.__renderDashboard?.()
      })
    }

    if (kind === 'ZONE2_SESSION') {
      title.textContent = 'Log Decoupling Test (steady Z2)'
      body.innerHTML = `
        <div class="status-actions"><input id="aeroHr1" class="status-input" type="number" step="1" placeholder="HR first half" /><input id="aeroHr2" class="status-input" type="number" step="1" placeholder="HR second half" /></div>
        <div class="status-actions"><input id="aeroS1" class="status-input" type="number" step="0.1" placeholder="Speed first half (optional)" /><input id="aeroS2" class="status-input" type="number" step="0.1" placeholder="Speed second half (optional)" /></div>
        <div class="status-actions"><button type="button" class="status-btn" id="aeroSaveBtn">Save Test</button></div>`
      body.querySelector('#aeroSaveBtn')?.addEventListener('click', async () => {
        const hr1 = num('aeroHr1')
        const hr2 = num('aeroHr2')
        const speed1 = num('aeroS1')
        const speed2 = num('aeroS2')
        if (!hr1 || !hr2 || hr1 <= 0) return alert('Enter first and second half HR')
        await postAerobic({
          testType: 'ZONE2_SESSION',
          date: today,
          duration: 40,
          hrFirstHalf: hr1,
          hrSecondHalf: hr2,
          speedFirstHalf: speed1,
          speedSecondHalf: speed2,
          notes: 'Monthly decoupling test'
        })
        modal.classList.remove('open')
        await window.__renderDashboard?.()
      })
    }

    modal.classList.add('open')
  }

  const fixedSpeedButton = document.getElementById('logFixedSpeedBtn')
  if (fixedSpeedButton) {
    fixedSpeedButton.onclick = () => openAerobicForm('FIXED_SPEED')
  }
  const fixedHrButton = document.getElementById('logFixedHrBtn')
  if (fixedHrButton) {
    fixedHrButton.onclick = () => openAerobicForm('FIXED_HR')
  }
  const decouplingButton = document.getElementById('logDecouplingBtn')
  if (decouplingButton) {
    decouplingButton.onclick = () => openAerobicForm('ZONE2_SESSION')
  }
}
