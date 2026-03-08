import type { AnyList, AnyRecord } from '../core/types'

function section(title: string, content: string): string {
  return `<section class="detail-section"><h4>${title}</h4>${content}</section>`
}

export function bindDetailClicks(
  details: AnyRecord,
  dailyTiles: AnyList = [],
  weekProgress: AnyList = []
): void {
  const modal = document.getElementById('detailModal')
  const title = document.getElementById('detailTitle')
  const body = document.getElementById('detailBody')
  const closeButton = document.getElementById('detailClose')
  if (!modal || !title || !body || !closeButton) return

  function close() {
    modal.classList.remove('open')
  }

  const planByDate = Object.fromEntries((dailyTiles || []).map((day) => [day.session_date, day]))
  for (const row of weekProgress || []) {
    if (!planByDate[row.session_date]) {
      planByDate[row.session_date] = {
        session_date: row.session_date,
        pain_level: row.pain_level || 'green',
        planned_barbell_main: row.main_lift,
        planned_cardio: row.cardio_plan,
        planned_rings: row.rings_plan
      }
    }
  }

  function openForDate(date) {
    window.__activeDetailDate = date
    title.textContent = `Training details · ${date}`

    const barbell = details?.barbellByDate?.[date] || []
    const cardio = details?.cardioByDate?.[date] || []
    const rings = details?.ringsByDate?.[date] || []
    const basePlanned = planByDate?.[date] || {}
    const planned = {
      ...basePlanned,
      plannedBarbellRows: details?.plannedBarbellByDate?.[date] || [],
      plannedCardio: (details?.plannedCardioByDate?.[date] || [])[0] || null,
      plannedRingsRows: details?.plannedRingsByDate?.[date] || []
    }
    window.__activePlanned = planned

    const mainRows = (planned.plannedBarbellRows || []).filter((row) => row.category === 'main')
    const mainTop = mainRows.length ? mainRows[mainRows.length - 1] : null
    const mainPrescription = mainRows.length
      ? mainRows.map((row) => `${row.planned_weight_kg}×${row.prescribed_reps}`).join(' · ')
      : '—'
    const supplementalRows = (planned.plannedBarbellRows || []).filter(
      (row) => row.category === 'supplemental'
    )
    const supplemental = supplementalRows[0] || null
    const supplementalPrescription = supplementalRows.length
      ? `${supplementalRows.length}×${supplemental?.prescribed_reps ?? '-'} @ ${supplemental?.planned_weight_kg ?? '-'} kg`
      : '—'
    const cardioPlan = planned.plannedCardio || null
    const ringsRows = planned.plannedRingsRows || []
    const uniqueRingTemplates = [
      ...new Set(ringsRows.map((row) => row.template_code).filter(Boolean))
    ]
    const ringsTemplate = uniqueRingTemplates.length
      ? uniqueRingTemplates.join('+')
      : planned.planned_rings
        ? String(planned.planned_rings)
        : null
    const ringsPlanText =
      ringsRows
        .filter((row) => row.item_no != null)
        .map(
          (row) =>
            `[${row.template_code}] ${row.item_no}. ${row.exercise} ${row.sets_text || ''}x${row.reps_or_time || ''}`
        )
        .join('<br/>') || 'Not scheduled'

    const hasMainLogged = (barbell || []).some((row) => row.category === 'main')
    const hasSupplementalLogged = (barbell || []).some((row) => row.category === 'supplemental')
    const hasCardioLogged = (cardio || []).length > 0
    const hasRingsLogged = (rings || []).length > 0

    body.innerHTML = [
      section(
        'Main Lift',
        `
        <p><strong>Main – ${mainTop?.lift || '—'}</strong><br/>Working sets prescribed: ${mainPrescription}<br/>Top set prescribed: ${mainTop?.planned_weight_kg || '—'} × ${mainTop?.prescribed_reps || '—'}</p>
        <div class="status-actions">
          <input id="mainWeightInput" class="status-input" type="number" step="0.5" placeholder="Top set weight" />
          <input id="mainRepsInput" class="status-input" type="number" step="1" placeholder="Top set reps" />
          <input id="mainRpeInput" class="status-input" type="number" step="0.5" placeholder="RPE (optional)" />
          <button type="button" class="status-btn" onclick="window.logSessionAction('main_done')" ${hasMainLogged ? 'disabled' : ''}>${hasMainLogged ? 'Main Recorded ✓' : 'Mark Main Complete'}</button>
        </div>
      `
      ),
      section(
        'Supplemental',
        `
        <p><strong>${supplemental?.lift || '—'}</strong><br/>Prescribed: ${supplementalPrescription}</p>
        <div class="status-actions">
          <label><input id="suppCompletedInput" type="checkbox" checked /> Completed as prescribed</label>
          <label><input id="suppModifiedInput" type="checkbox" /> Modified</label>
        </div>
        <div class="status-actions">
          <input id="suppWeightInput" class="status-input" type="number" step="0.5" placeholder="Modified weight" />
          <input id="suppSetsInput" class="status-input" type="number" step="1" placeholder="Sets completed" />
          <button type="button" class="status-btn" onclick="window.logSessionAction('supp_done')" ${hasSupplementalLogged ? 'disabled' : ''}>${hasSupplementalLogged ? 'Supp Recorded ✓' : 'Mark Supp Complete'}</button>
          <button type="button" class="status-btn" onclick="window.logSessionAction('supp_modified')" ${hasSupplementalLogged ? 'disabled' : ''}>${hasSupplementalLogged ? 'Supp Recorded ✓' : 'Save Supp Modified'}</button>
        </div>
      `
      ),
      section(
        'Cardio',
        `
        <p><strong>${cardioPlan?.session_type || 'Z2'}</strong></p>
        <div class="status-actions">
          <input id="cardioDurationInput" class="status-input" type="number" step="1" placeholder="Duration (min)" value="${cardioPlan?.duration_min || ''}" />
          <input id="cardioAvgHrInput" class="status-input" type="number" step="1" placeholder="Avg HR" />
          <input id="cardioSpeedInput" class="status-input" type="number" step="0.1" placeholder="Speed (optional)" />
        </div>
        <div class="status-actions">
          <input id="cardioWorkMinInput" class="status-input" type="number" step="0.5" placeholder="Work interval (min)" value="${cardioPlan?.vo2_work_min || ''}" />
          <input id="cardioRestMinInput" class="status-input" type="number" step="0.5" placeholder="Rest interval (min)" value="${cardioPlan?.vo2_easy_min || ''}" />
          <button type="button" class="status-btn" onclick="window.logSessionAction('cardio_done')" ${hasCardioLogged ? 'disabled' : ''}>${hasCardioLogged ? 'Cardio Recorded ✓' : 'Mark Cardio Complete'}</button>
        </div>
      `
      ),
      section(
        'Rings',
        `
        <p><strong>Template ${ringsTemplate || '—'}</strong></p>
        <p class="muted">${ringsPlanText}</p>
        <div class="status-actions">
          <label><input id="ringsCompletedInput" type="checkbox" ${hasRingsLogged ? 'checked disabled' : ''}/> Completed as prescribed</label>
          <button type="button" class="status-btn" onclick="window.logSessionAction('rings_done')" ${hasRingsLogged ? 'disabled' : ''}>${hasRingsLogged ? 'Rings Recorded ✓' : 'Mark Rings Complete'}</button>
        </div>
      `
      ),
      section(
        'Finish Session',
        `
        <div class="status-actions">
          <button type="button" class="status-btn" onclick="window.logSessionAction('finish_session')">Finish Session</button>
        </div>
      `
      )
    ].join('')

    modal.classList.add('open')
  }

  window.__openDetailForDate = openForDate

  closeButton.addEventListener('click', close)
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close()
  })
  window.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') close()
  })

  for (const element of document.querySelectorAll('.tile, .week-row')) {
    const open = (event) => {
      if (event?.target?.closest?.('[data-role="status-dot"]')) return
      openForDate((element as HTMLElement).dataset.date || '')
    }
    element.addEventListener('click', open)
    element.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open(event)
      }
    })
  }
}
