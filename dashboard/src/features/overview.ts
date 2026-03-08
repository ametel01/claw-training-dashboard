import { currentDateInDashboardTZ } from '../core/time'
import type { AnyList, AnyRecord } from '../core/types'

function statCard(label: string, value: string | number): string {
  return `<article class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></article>`
}

function yesNoChip(label: string, done: boolean, detail = ''): string {
  const className = done ? 'chip done' : 'chip'
  return `<span class="${className}"><i class="dot"></i>${label}${detail ? ` · ${detail}` : ''}</span>`
}

export function renderTotals(totals: AnyRecord): void {
  const node = document.getElementById('totals')
  if (!node) return

  node.innerHTML = [
    statCard('Barbell Sessions', totals.barbell_sessions ?? 0),
    statCard('Cardio Sessions', totals.cardio_sessions ?? 0),
    statCard('Rings Sessions', totals.rings_sessions ?? 0),
    statCard('Total Training Days', totals.total_training_days ?? 0),
    statCard('Active Days (14d)', totals.active_days_last_14 ?? 0)
  ].join('')
}

export function renderWeekHeader(weekHeader: AnyRecord | null): void {
  const node = document.getElementById('weekHeaderBanner')
  if (!node) return
  if (!weekHeader) {
    node.innerHTML = '<div class="week-header-title">Cycle info unavailable</div>'
    return
  }

  const mainNumbers = String(weekHeader.main_pct || '')
    .split('/')
    .map((value) => Number(String(value).replace('%', '')))
    .filter((value) => Number.isFinite(value))
  const supplementalNumber = Number(String(weekHeader.supp_pct || '').replace('%', ''))
  const clampPct = (value) => Math.max(0, Math.min(100, Number(value) || 0))
  const pctHue = (value) => {
    const pct = clampPct(value)
    const scaled = Math.max(0, Math.min(1, (pct - 60) / 40))
    return 120 - 120 * scaled
  }
  const barFill = (value) => {
    const hue = pctHue(value)
    const c1 = `hsl(${hue.toFixed(0)} 85% 66%)`
    const c2 = `hsl(${hue.toFixed(0)} 80% 52%)`
    const c3 = `hsl(${hue.toFixed(0)} 88% 42%)`
    return `linear-gradient(90deg, ${c1} 0%, ${c2} 55%, ${c3} 100%)`
  }
  const bars = mainNumbers
    .map(
      (value) =>
        `<div class="pct-bar"><span style="width:${clampPct(value)}%; background:${barFill(value)}"></span><label>${value}%</label></div>`
    )
    .join('')
  const deloadBadge = weekHeader.deload_code
    ? `<span class="chip done">Deload: ${weekHeader.deload_name || weekHeader.deload_code}</span>`
    : ''

  node.innerHTML = `
    <div class="week-header-title">5/3/1 · ${weekHeader.block_type} · Week ${weekHeader.week_in_block} ${deloadBadge}</div>
    <div class="week-header-meta">Main: ${weekHeader.main_pct} · Supplemental: ${weekHeader.supp_pct}</div>
    <div class="pct-bars">${bars}${Number.isFinite(supplementalNumber) ? `<div class="pct-bar supp"><span style="width:${clampPct(supplementalNumber)}%; background:${barFill(supplementalNumber)}"></span><label>Supp ${supplementalNumber}%</label></div>` : ''}</div>
  `
}

export function renderTodayGlance(
  days: AnyList = [],
  _weekRows: AnyList = [],
  details: AnyRecord = {}
): void {
  const node = document.getElementById('todayGlance')
  if (!node) return

  const today = currentDateInDashboardTZ()
  const day = (days || []).find((value) => value.session_date === today)
  if (!day) {
    node.innerHTML =
      '<div class="today-title">TODAY</div><div class="today-meta">No data for today yet.</div>'
    return
  }

  const barbellRows = details?.barbellByDate?.[today] || []
  const hasMain = barbellRows.some((row) => row.category === 'main')
  const hasSupplemental = barbellRows.some((row) => row.category === 'supplemental')

  const plannedMain = !!day.planned_barbell_main
  const plannedSupplemental = !!day.planned_barbell_supp
  const plannedCardio = !!day.planned_cardio && day.planned_cardio !== 'OFF'
  const plannedRings = !!day.planned_rings
  const plannedCount = [plannedMain, plannedSupplemental, plannedCardio, plannedRings].filter(
    Boolean
  ).length
  const doneCount = [
    plannedMain && hasMain,
    plannedSupplemental && hasSupplemental,
    plannedCardio && day.has_cardio,
    plannedRings && day.has_rings
  ].filter(Boolean).length
  const status =
    doneCount === 0 ? 'Not Started' : doneCount === plannedCount ? 'Completed' : 'In Progress'
  const pct = plannedCount ? Math.round((doneCount / plannedCount) * 100) : 0

  const line = (emoji, plannedText, done) => {
    if (!plannedText) return ''
    return `<div class="today-line"><span class="today-chip ${done ? 'done' : 'pending'}">${done ? 'done' : 'pending'}</span>${emoji} ${plannedText}</div>`
  }

  const mainText = plannedMain ? `${day.planned_barbell_main}` : ''
  const supplementalText = plannedSupplemental
    ? `${day.planned_barbell_supp} ${day.planned_supp_sets || ''}x${day.planned_supp_reps || ''}`
    : ''
  const cardioText = plannedCardio ? day.planned_cardio : ''
  const ringsText = plannedRings ? `Rings ${day.planned_rings}` : ''
  const estimatedMinutes =
    (plannedMain || plannedSupplemental ? 60 : 0) +
    (plannedCardio ? 30 : 0) +
    (plannedRings ? 20 : 0)

  node.innerHTML = `
    <div class="today-title">
      <span><strong>TODAY</strong> · ${today}</span>
      <span class="today-progress"><span class="status-dot ${day.pain_level || 'green'}"></span>${doneCount}/${plannedCount || 0} · ${pct}%</span>
    </div>
    <div class="today-meta">Status: <strong>${status}</strong> · Planned time: <strong>${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}m</strong></div>
    <div class="today-lines">
      ${line('🏋', mainText, hasMain)}
      ${line('🏋+', supplementalText, hasSupplemental)}
      ${line('❤️', cardioText, !!day.has_cardio)}
      ${line('🤸', ringsText, !!day.has_rings)}
    </div>
    ${status === 'Not Started' ? '<div class="today-cta"><button class="btn-primary" type="button" id="startSessionBtn">Start Session</button></div>' : ''}
  `
}

export function renderWeeklyCompletion(weekRows: AnyList = [], details: AnyRecord = {}): void {
  let planned = 0
  let done = 0

  for (const row of weekRows) {
    const barbellRows = details?.barbellByDate?.[row.session_date] || []
    const hasMain = barbellRows.some((value) => value.category === 'main')
    const hasSupplemental = barbellRows.some((value) => value.category === 'supplemental')

    const plannedMain = !!row.main_lift
    const plannedSupplemental = !!row.main_lift
    const plannedCardio = !!row.cardio_plan && row.cardio_plan !== 'OFF'
    const plannedRings = !!row.rings_plan

    if (plannedMain) {
      planned += 1
      if (hasMain) done += 1
    }
    if (plannedSupplemental) {
      planned += 1
      if (hasSupplemental) done += 1
    }
    if (plannedCardio) {
      planned += 1
      if (row.cardio_done) done += 1
    }
    if (plannedRings) {
      planned += 1
      if (row.rings_done) done += 1
    }
  }

  const pct = planned ? Math.round((done / planned) * 100) : 0
  const pill = document.getElementById('weeklyCompletion')
  if (pill) pill.textContent = `Week: ${done}/${planned} (${pct}%)`
}

export function renderPerformanceKpis(weekRows: AnyList = [], details: AnyRecord = {}): void {
  const node = document.getElementById('performanceKpis')
  if (!node) return

  const plannedWeek = weekRows.reduce(
    (count, row) =>
      count +
      !!row.main_lift +
      !!row.main_lift +
      (!!row.cardio_plan && row.cardio_plan !== 'OFF') +
      !!row.rings_plan,
    0
  )
  const doneWeek = weekRows.reduce((count, row) => {
    const barbellRows = details?.barbellByDate?.[row.session_date] || []
    const hasMain = barbellRows.some((value) => value.category === 'main')
    const hasSupplemental = barbellRows.some((value) => value.category === 'supplemental')
    return (
      count +
      (hasMain ? 1 : 0) +
      (hasSupplemental ? 1 : 0) +
      (row.cardio_done ? 1 : 0) +
      (row.rings_done ? 1 : 0)
    )
  }, 0)
  const weekPct = plannedWeek ? Math.round((doneWeek / plannedWeek) * 100) : 0

  const today = currentDateInDashboardTZ()
  const dayIdx = Math.max(1, Math.min(7, ((new Date(`${today}T00:00:00`).getDay() + 6) % 7) + 1))
  const expectedByToday = Math.round(plannedWeek * (dayIdx / 7) || 0)
  const expectedPct = plannedWeek ? Math.round((expectedByToday / plannedWeek) * 100) : 0
  const behind = Math.max(0, expectedByToday - doneWeek)

  const cardioByDate = details?.cardioByDate || {}
  const cardioRows = Object.values(cardioByDate as AnyRecord).flat() as AnyList
  const cardioSessions = []
  const seenCardio = new Set()
  for (const row of cardioRows) {
    const key = `${row.session_date}|${row.protocol}`
    if (seenCardio.has(key)) continue
    seenCardio.add(key)
    cardioSessions.push(row)
  }
  const z2Sessions = cardioSessions.filter((row) => row.protocol === 'Z2')
  const vo2Sessions = cardioSessions.filter((row) => String(row.protocol || '').includes('VO2'))
  const z2Count = z2Sessions.length
  const vo2Count = vo2Sessions.length
  const totalIntensity = Math.max(1, z2Count + vo2Count)
  const z2Pct = Math.round((z2Count / totalIntensity) * 100)
  const vo2Pct = 100 - z2Pct

  const z2WeeklyTarget = 120
  const formatLocalDate = (date: Date): string => {
    const y = date.getFullYear()
    const m = `${date.getMonth() + 1}`.padStart(2, '0')
    const d = `${date.getDate()}`.padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const weekStart = (() => {
    const date = new Date(`${today}T00:00:00`)
    const day = (date.getDay() + 6) % 7
    date.setDate(date.getDate() - day)
    return formatLocalDate(date)
  })()
  const weekEnd = (() => {
    const date = new Date(`${weekStart}T00:00:00`)
    date.setDate(date.getDate() + 6)
    return formatLocalDate(date)
  })()
  const z2WeekMin = z2Sessions
    .filter((row) => row.session_date >= weekStart && row.session_date <= weekEnd)
    .reduce((minutes, row) => minutes + Number(row.duration_min || 0), 0)

  const weeklyVerdict =
    weekPct >= expectedPct
      ? '🟢 On pace'
      : behind >= 2
        ? `🔴 Behind by ${behind} sessions`
        : '🟡 Slightly behind'
  const intensityVerdict =
    z2Pct >= 75 ? '🟢 Z2-dominant' : z2Pct >= 65 ? '🟡 Slightly VO2-heavy' : '🔴 Too VO2-heavy'
  const z2Verdict =
    z2WeekMin >= z2WeeklyTarget
      ? `🟢 Target met (+${z2WeekMin - z2WeeklyTarget}m)`
      : `🔴 Under target (${z2WeeklyTarget - z2WeekMin}m short)`

  node.innerHTML = `
    <article class="kpi-card"><div class="muted">Training status · weekly execution</div><div class="kpi-value">${weekPct}%</div><div class="muted">Expected by today: ≥${expectedPct}% (${expectedByToday}/${plannedWeek})</div><div class="muted">${weeklyVerdict}</div></article>
    <article class="kpi-card"><div class="muted">Intensity distribution (Z2 vs VO2)</div><div class="kpi-value">${z2Pct}% / ${vo2Pct}%</div><div class="muted">Target: 75% / 25%</div><div class="muted">${intensityVerdict}</div></article>
    <article class="kpi-card"><div class="muted">Z2 volume</div><div class="kpi-value">${z2WeekMin} / ${z2WeeklyTarget} min</div><div class="muted">${z2Verdict}</div></article>
  `
}

export function renderWeekProgress(rows: AnyList): void {
  const node = document.getElementById('weekRows')
  if (!node) return

  const today = currentDateInDashboardTZ()
  node.innerHTML = rows
    .map((row) => {
      const planned = [
        !!row.main_lift,
        !!row.cardio_plan && row.cardio_plan !== 'OFF',
        !!row.rings_plan
      ].filter(Boolean).length
      const done = [!!row.barbell_done, !!row.cardio_done, !!row.rings_done].filter(Boolean).length
      const className =
        done === planned && planned > 0
          ? 'done-all'
          : done > 0
            ? 'partial'
            : row.session_date >= today
              ? 'upcoming'
              : ''
      return `
    <article class="week-row ${className}" role="button" tabindex="0" data-date="${row.session_date}">
      <div class="week-meta">
        <div class="week-day">${row.day_name.slice(0, 3)}</div>
        <div class="muted">${row.session_date.slice(5)}</div>
      </div>
      <div class="week-chips">
        ${yesNoChip('🏋', row.barbell_done, row.main_lift || '—')}
        ${yesNoChip('❤️', row.cardio_done, row.cardio_plan || 'OFF')}
        ${yesNoChip('🤸', row.rings_done, row.rings_plan || '—')}
      </div>
    </article>`
    })
    .join('')
}

export function renderDailyTiles(days: AnyList, details: AnyRecord = {}): void {
  const node = document.getElementById('dailyTiles')
  if (!node) return

  const today = currentDateInDashboardTZ()
  const badgeFor = ({ icon, planned, done, detail, isPast }) => {
    if (!planned) return ''
    let className = 'badge planned'
    if (done) className = 'badge done'
    else if (!done && isPast) className = 'badge missed'
    return `<span class="${className}">${icon} ${detail || ''}</span>`
  }

  const orderedDays = [...days].reverse()
  node.innerHTML = orderedDays
    .map((day) => {
      const isPast = day.session_date < today
      const barbellRows = details?.barbellByDate?.[day.session_date] || []
      const hasMain = barbellRows.some((row) => row.category === 'main')
      const hasSupplemental = barbellRows.some((row) => row.category === 'supplemental')

      const plannedMain = !!day.planned_barbell_main
      const plannedSupplemental = !!day.planned_barbell_supp
      const plannedCardio = !!day.planned_cardio && day.planned_cardio !== 'OFF'
      const plannedRings = !!day.planned_rings

      const mainDetail = plannedMain ? `${day.planned_barbell_main}`.trim() : day.barbell_lift
      const supplementalDetail = plannedSupplemental
        ? `${day.planned_barbell_supp} ${day.planned_supp_sets || ''}x${day.planned_supp_reps || ''}`.trim()
        : ''
      const cardioDetail = day.planned_cardio || day.cardio_protocol
      const ringsDetail = day.planned_rings || day.rings_template

      const pain = day.pain_level || 'green'
      const painBadge = `<span class="status-dot clickable ${pain}" data-date="${day.session_date}" data-status="${pain}" data-role="status-dot" title="Recovery status: ${pain} (tap to change)"></span>`

      const badges = [
        painBadge,
        badgeFor({
          icon: '🏋',
          planned: plannedMain,
          done: hasMain,
          detail: mainDetail,
          isPast
        }),
        badgeFor({
          icon: '🏋+',
          planned: plannedSupplemental,
          done: hasSupplemental,
          detail: supplementalDetail,
          isPast
        }),
        badgeFor({
          icon: '❤️',
          planned: plannedCardio,
          done: !!day.has_cardio,
          detail: cardioDetail,
          isPast
        }),
        badgeFor({
          icon: '🤸',
          planned: plannedRings,
          done: !!day.has_rings,
          detail: ringsDetail,
          isPast
        })
      ]
        .filter(Boolean)
        .join('')

      const completionCount = [
        plannedMain && hasMain,
        plannedSupplemental && hasSupplemental,
        plannedCardio && day.has_cardio,
        plannedRings && day.has_rings
      ].filter(Boolean).length
      const plannedCount = [plannedMain, plannedSupplemental, plannedCardio, plannedRings].filter(
        Boolean
      ).length
      const title = plannedCount === 0 ? 'Rest day' : `${completionCount}/${plannedCount} complete`

      const dayName = new Date(`${day.session_date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short'
      })
      return `
      <article class="tile" role="button" tabindex="0" data-date="${day.session_date}">
        <div class="tile-date">${dayName} · ${day.session_date}</div>
        <div class="tile-main">${title}</div>
        <div class="tile-flags">${badges}</div>
      </article>
    `
    })
    .join('')
}
