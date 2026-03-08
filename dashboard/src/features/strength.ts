import type { AnyList, AnyRecord } from '../core/types'

export function renderCycleControl(cycleControl: AnyRecord = {}): void {
  const node = document.getElementById('cycleControlPanel')
  if (!node) return

  const latest = cycleControl.latestBlock || {}
  const active = cycleControl.activeDeload || null
  const profiles = cycleControl.profiles || []
  const options = profiles
    .map(
      (profile) =>
        `<option value="${profile.code}" data-days="${profile.default_days || 7}">${profile.name}</option>`
    )
    .join('')
  const events = (cycleControl.recentEvents || [])
    .slice(0, 5)
    .map(
      (event) =>
        `<li>${event.event_date} · ${event.event_type}${event.deload_code ? ` (${event.deload_code})` : ''}</li>`
    )
    .join('')
  const tmCards = (cycleControl.currentTM || [])
    .map(
      (row) => `
    <article class="tm-card">
      <div class="tm-head">
        <strong>${row.lift}</strong>
        <span class="muted">${row.effective_date || '—'}</span>
      </div>
      <div class="tm-value">${Number(row.tm_kg || 0).toFixed(1)} kg</div>
      <div class="tm-actions">
        <button class="status-btn" data-tm-lift="${row.lift}" data-tm-delta="-2.5" type="button">-2.5</button>
        <button class="status-btn" data-tm-lift="${row.lift}" data-tm-delta="2.5" type="button">+2.5</button>
        <button class="status-btn" data-tm-lift="${row.lift}" data-tm-delta="5" type="button">+5</button>
      </div>
      <div class="tm-set-row">
        <input class="status-input tm-set-input" id="tmSet-${row.lift}" type="number" step="0.5" placeholder="Set exact kg" />
        <button class="status-btn" data-tm-set="${row.lift}" type="button">Set</button>
      </div>
    </article>
  `
    )
    .join('')

  node.innerHTML = `
    <section class="cycle-control-grid">
      <article class="cycle-control-card">
        <h3 class="cycle-section-title">Cycle</h3>
        <div class="muted">Current block: <strong>#${latest.block_no || '—'}</strong> · ${latest.block_type || '—'}</div>
        <div class="muted">Start: <strong>${latest.start_date || '—'}</strong></div>
        <div class="status-actions compact">
          <input id="newCycleStartInput" class="status-input" type="date" />
          <select id="newCycleTypeInput" class="status-input"><option value="Leader">Leader</option><option value="Anchor">Anchor</option></select>
          <button id="startCycleBtn" class="status-btn" type="button">Start New Cycle</button>
        </div>
      </article>

      <article class="cycle-control-card">
        <h3 class="cycle-section-title">Deload</h3>
        <div class="muted">Active: <strong>${active ? `${active.name || active.deload_code} (${active.start_date} → ${active.end_date})` : 'none'}</strong></div>
        <div class="status-actions compact">
          <select id="deloadTypeInput" class="status-input">${options}</select>
          <input id="deloadStartInput" class="status-input" type="date" />
          <input id="deloadDaysInput" class="status-input" type="number" min="1" step="1" placeholder="Days" />
          <button id="applyDeloadBtn" class="status-btn" type="button">Apply Deload</button>
        </div>
      </article>
    </section>

    <section class="cycle-control-card">
      <h3 class="cycle-section-title">Training Max</h3>
      <div class="tm-grid">${tmCards || '<p class="muted">No TM data.</p>'}</div>
    </section>

    <section class="cycle-control-card">
      <h3 class="cycle-section-title">Recent cycle events</h3>
      <ul class="detail-list">${events || '<li>No events yet.</li>'}</ul>
    </section>
  `
}

export function renderEst1RM(rows: AnyList = []): void {
  const node = document.getElementById('est1rmRows')
  if (!node) return
  if (!rows.length) {
    node.innerHTML = '<p class="muted">No main-set data in the last 12 weeks yet.</p>'
    return
  }

  const spark = (series = []) => {
    const trend = (Array.isArray(series) ? series : []).slice().reverse()
    if (trend.length < 2) return ''
    const values = trend
      .map((point) => Number(point.e1rm))
      .filter((value) => Number.isFinite(value))
    if (values.length < 2) return ''
    const width = 120
    const height = 26
    const pad = 2
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = Math.max(1, max - min)
    const points = values
      .map(
        (value, index) =>
          `${(index * (width / (values.length - 1))).toFixed(1)},${(height - pad - ((value - min) / span) * (height - 2 * pad)).toFixed(1)}`
      )
      .join(' ')
    return `<svg viewBox="0 0 ${width} ${height}" class="spark"><polyline points="${points}" fill="none" stroke="#9ad0ff" stroke-width="2"/></svg>`
  }

  node.innerHTML = rows
    .map((row) => {
      let trend = []
      if (typeof row.trend_points === 'string') {
        try {
          trend = JSON.parse(row.trend_points) || []
        } catch {
          trend = []
        }
      } else if (Array.isArray(row.trend_points)) {
        trend = row.trend_points
      }

      const delta4Weeks = Number(row.delta_4w_kg || 0)
      const arrow = delta4Weeks > 0 ? '↑' : delta4Weeks < 0 ? '↓' : '→'
      const pctToNext = Math.max(0, Math.min(100, Number(row.progress_to_next_pct || 0)))
      return `
    <article class="est1rm-card">
      <div class="est1rm-lift">${row.lift}</div>
      <div class="est1rm-value">${row.est_1rm_kg} kg</div>
      <div class="est1rm-level">${row.strength_level} · ${row.bw_ratio}x BW</div>
      <div class="est1rm-meta">4w: ${arrow} ${Math.abs(delta4Weeks).toFixed(1)} kg · Cycle: ${(Number(row.delta_cycle_kg || 0)).toFixed(1)} kg</div>
      ${spark(trend)}
      <div class="est1rm-meta">${row.next_level !== '—' ? `Next: ${row.next_level} at ${row.next_level_kg} kg` : 'Top level reached'} · BW ${row.bodyweight_kg} kg</div>
      <div class="progress-track"><span style="width:${pctToNext}%"></span></div>
      <div class="est1rm-meta">${pctToNext}% to next level · from ${row.source_weight_kg}×${row.source_reps} (${row.source_date})</div>
    </article>`
    })
    .join('')
}

export function renderCurrentCyclePlan(rows: AnyList = []): void {
  const node = document.getElementById('cyclePlanRows')
  if (!node) return
  if (!rows.length) {
    node.innerHTML = '<p class="muted">No planned sessions found for current cycle.</p>'
    return
  }

  const byDate = new Map()
  for (const row of rows) {
    if (!byDate.has(row.session_date)) byDate.set(row.session_date, [])
    byDate.get(row.session_date).push(row)
  }

  const weekStart = (iso) => {
    const date = new Date(`${iso}T12:00:00Z`)
    const day = (date.getUTCDay() + 6) % 7
    date.setUTCDate(date.getUTCDate() - day)
    return date.toISOString().slice(0, 10)
  }

  const summarizeTile = (items) => {
    const mainLifts = [
      ...new Set(items.filter((value) => value.category === 'main').map((value) => value.lift))
    ]
    const supplementalLifts = [
      ...new Set(
        items.filter((value) => value.category === 'supplemental').map((value) => value.lift)
      )
    ]
    return {
      mainTxt: mainLifts.length ? mainLifts.join(' + ') : 'Rest',
      suppTxt: supplementalLifts.length ? supplementalLifts.join(' + ') : '—'
    }
  }

  const summarizeModal = (items, category) => {
    const filteredRows = items.filter((value) => value.category === category)
    if (!filteredRows.length) return '<p class="muted">—</p>'
    const byLift = new Map()
    for (const row of filteredRows) {
      if (!byLift.has(row.lift)) byLift.set(row.lift, [])
      byLift.get(row.lift).push(row)
    }

    const lines = []
    for (const [lift, liftRows] of byLift.entries()) {
      const grouped = new Map()
      for (const setRow of liftRows) {
        const key = `${setRow.prescribed_reps}|${setRow.planned_weight_kg}`
        grouped.set(key, (grouped.get(key) || 0) + 1)
      }
      const uniqueGroups = Array.from(grouped.entries())
      const detail =
        uniqueGroups.length === 1
          ? (() => {
              const [[key, count]] = uniqueGroups
              const [reps, weight] = key.split('|')
              return `${count}×${reps} @ ${weight}kg`
            })()
          : liftRows
              .map((setRow) => `${setRow.planned_weight_kg}×${setRow.prescribed_reps}`)
              .join(' · ')
      lines.push(`<li><strong>${lift}</strong>: ${detail}</li>`)
    }
    return `<ul class="detail-list">${lines.join('')}</ul>`
  }

  const allDates = Array.from(byDate.keys()).sort()
  const shiftDate = (iso, delta) => {
    const date = new Date(`${iso}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + delta)
    return date.toISOString().slice(0, 10)
  }
  const start = weekStart(allDates[0])
  const end = weekStart(allDates[allDates.length - 1])

  const weekStarts = []
  for (let date = start; date <= end; date = shiftDate(date, 7)) weekStarts.push(date)

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  node.innerHTML = weekStarts
    .map((weekStartDate, index) => {
      const cells = []
      for (let day = 0; day < 7; day += 1) {
        const date = shiftDate(weekStartDate, day)
        const items = byDate.get(date) || []
        if (!items.length) continue
        const { mainTxt, suppTxt } = summarizeTile(items)
        cells.push(
          `<article class="cycle-day-tile" data-cycle-date="${date}" tabindex="0"><div class="tile-date">${weekDays[day]} · ${date}</div><div class="tile-main">${mainTxt}</div><div class="muted">Supp: ${suppTxt}</div></article>`
        )
      }
      return `
      <section class="cycle-week-block">
        <div class="panel-head"><h3>Week ${index + 1} <span class="muted">· ${weekStartDate}</span></h3></div>
        <div class="cycle-calendar-grid">
          ${cells.join('')}
        </div>
      </section>`
    })
    .join('')

  let modal = document.getElementById('cyclePlanModal')
  if (!modal) {
    modal = document.createElement('div')
    modal.id = 'cyclePlanModal'
    modal.className = 'modal'
    modal.innerHTML =
      '<div class="modal-card" role="dialog" aria-modal="true"><div class="modal-head"><h3 id="cyclePlanTitle">Planned session</h3><button type="button" class="modal-close" id="cyclePlanClose">×</button></div><div id="cyclePlanBody" class="modal-body"></div></div>'
    document.body.appendChild(modal)
    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.classList.remove('open')
    })
    modal
      .querySelector('#cyclePlanClose')
      ?.addEventListener('click', () => modal?.classList.remove('open'))
  }

  const openCycleModal = (date) => {
    const items = byDate.get(date) || []
    const title = document.getElementById('cyclePlanTitle')
    const body = document.getElementById('cyclePlanBody')
    if (!title || !body || !modal) return

    title.textContent = `Planned session · ${date}`
    body.innerHTML = `
      <section class="detail-section"><h4>Main</h4>${summarizeModal(items, 'main')}</section>
      <section class="detail-section"><h4>Supplemental</h4>${summarizeModal(items, 'supplemental')}</section>
    `
    modal.classList.add('open')
  }

  for (const tile of node.querySelectorAll('.cycle-day-tile')) {
    const open = () => openCycleModal(tile.getAttribute('data-cycle-date'))
    tile.addEventListener('click', open)
    tile.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open()
      }
    })
  }
}
