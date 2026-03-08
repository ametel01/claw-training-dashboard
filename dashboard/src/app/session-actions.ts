import { getValue, isChecked } from '../core/dom'
import type { AnyRecord } from '../core/types'

export function installSessionActions(renderDashboard: () => Promise<void>): void {
  window.setRecoveryStatus = async (date, status) => {
    const targetDate = date || window.__activeDetailDate
    if (!targetDate) return
    try {
      const response = await fetch(
        `/api/set-status?date=${encodeURIComponent(targetDate)}&status=${encodeURIComponent(status)}`,
        { method: 'POST' }
      )
      if (!response.ok) throw new Error(`set-status failed (${response.status})`)
      await renderDashboard()
      window.__openDetailForDate?.(targetDate)
    } catch (error) {
      console.error(error)
    }
  }

  window.logSessionAction = async (action) => {
    const date = window.__activeDetailDate
    const planned = window.__activePlanned || {}
    if (!date) return

    const payload: AnyRecord = {
      action,
      date,
      plannedBarbellRows: planned.plannedBarbellRows || [],
      plannedCardio: planned.plannedCardio || null
    }

    const postLogAction = async (body) => {
      const response = await fetch('/api/log-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!response.ok) {
        let message = `log-action failed (${response.status})`
        try {
          const json = await response.json()
          if (json?.error) message = json.error
        } catch {}
        throw new Error(message)
      }
    }

    if (action === 'finish_session') {
      const mainWeight = Number.parseFloat(getValue('mainWeightInput'))
      const mainReps = Number.parseInt(getValue('mainRepsInput'), 10)
      const mainRpe = Number.parseFloat(getValue('mainRpeInput'))

      const supplementalCompleted = isChecked('suppCompletedInput')
      const supplementalModified = isChecked('suppModifiedInput')
      const supplementalWeight = Number.parseFloat(getValue('suppWeightInput'))
      const supplementalSets = Number.parseInt(getValue('suppSetsInput'), 10)

      const cardioDuration = Number.parseInt(getValue('cardioDurationInput'), 10)
      const cardioHr = Number.parseInt(getValue('cardioAvgHrInput'), 10)
      const cardioSpeed = Number.parseFloat(getValue('cardioSpeedInput'))
      const cardioWorkMin = Number.parseFloat(getValue('cardioWorkMinInput'))
      const cardioRestMin = Number.parseFloat(getValue('cardioRestMinInput'))
      const ringsCompleted = isChecked('ringsCompletedInput')

      if (
        Number.isFinite(mainWeight) &&
        Number.isFinite(mainReps) &&
        mainWeight > 0 &&
        mainReps > 0
      ) {
        await postLogAction({
          action: 'main_done',
          date,
          plannedBarbellRows: (planned.plannedBarbellRows || []).map((row) =>
            row.category === 'main'
              ? {
                  ...row,
                  planned_weight_kg: mainWeight,
                  prescribed_reps: mainReps,
                  note: Number.isFinite(mainRpe) ? `RPE ${mainRpe}` : row.note
                }
              : row
          ),
          plannedCardio: planned.plannedCardio || null
        })
      }

      if (supplementalModified && Number.isFinite(supplementalWeight) && supplementalWeight > 0) {
        const reps =
          (planned.plannedBarbellRows || []).find((row) => row.category === 'supplemental')
            ?.prescribed_reps || 5
        const sets =
          Number.isFinite(supplementalSets) && supplementalSets > 0 ? supplementalSets : 10
        await postLogAction({
          action: 'supp_modified',
          date,
          plannedBarbellRows: planned.plannedBarbellRows || [],
          plannedCardio: planned.plannedCardio || null,
          suppModifiedText: `${sets}x${reps}@${supplementalWeight}`
        })
      } else if (supplementalCompleted) {
        await postLogAction({
          action: 'supp_done',
          date,
          plannedBarbellRows: planned.plannedBarbellRows || [],
          plannedCardio: planned.plannedCardio || null
        })
      }

      if (
        Number.isFinite(cardioDuration) &&
        cardioDuration > 0 &&
        Number.isFinite(cardioHr) &&
        cardioHr > 0
      ) {
        const plannedCardio = { ...(planned.plannedCardio || {}), duration_min: cardioDuration }
        await postLogAction({
          action: 'cardio_done',
          date,
          plannedBarbellRows: planned.plannedBarbellRows || [],
          plannedCardio,
          avgHr: cardioHr,
          speedKmh: Number.isFinite(cardioSpeed) && cardioSpeed > 0 ? cardioSpeed : undefined,
          workMin: Number.isFinite(cardioWorkMin) && cardioWorkMin > 0 ? cardioWorkMin : undefined,
          restMin: Number.isFinite(cardioRestMin) && cardioRestMin >= 0 ? cardioRestMin : undefined
        })
      }

      if (ringsCompleted) {
        await postLogAction({
          action: 'rings_done',
          date,
          plannedBarbellRows: planned.plannedBarbellRows || [],
          plannedCardio: planned.plannedCardio || null
        })
      }

      let e1rmText = '—'
      let deltaText = '—'
      if (
        Number.isFinite(mainWeight) &&
        Number.isFinite(mainReps) &&
        mainWeight > 0 &&
        mainReps > 0
      ) {
        const e1rm = mainWeight * (1 + mainReps / 30)
        e1rmText = `${e1rm.toFixed(1)} kg`
        const prevMain = (window.__dashboardData?.details?.barbellByDate?.[date] || []).filter(
          (row: AnyRecord) => row.category === 'main'
        )
        const prevTop = prevMain.length ? prevMain[prevMain.length - 1] : null
        if (prevTop?.actual_weight_kg && prevTop?.actual_reps) {
          const prevE1 = Number(prevTop.actual_weight_kg) * (1 + Number(prevTop.actual_reps) / 30)
          const delta = e1rm - prevE1
          deltaText = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} kg vs previous logged main`
        }
      }

      const z2InCap = Number.isFinite(cardioHr) ? (cardioHr <= 125 ? 'Yes' : 'No') : '—'
      const quality = (() => {
        const mainOk =
          Number.isFinite(mainWeight) && Number.isFinite(mainReps) && mainWeight > 0 && mainReps > 0
        const cardioOk =
          Number.isFinite(cardioDuration) &&
          Number.isFinite(cardioHr) &&
          cardioDuration > 0 &&
          cardioHr > 0
        const supplementalOk =
          supplementalCompleted ||
          (supplementalModified && Number.isFinite(supplementalWeight) && supplementalWeight > 0)
        const score = [mainOk, supplementalOk, cardioOk].filter(Boolean).length
        if (score === 3) return 'A (full session)'
        if (score === 2) return 'B (mostly complete)'
        if (score === 1) return 'C (partial)'
        return 'D (logged but incomplete)'
      })()

      await renderDashboard()
      window.__openDetailForDate?.(date)
      alert(
        `Session finished\n\nTop set e1RM: ${e1rmText}\nDelta: ${deltaText}\nZ2 in cap: ${z2InCap}\nSession quality: ${quality}`
      )
      return
    }

    if (action === 'supp_modified') {
      const supplementalWeight = Number.parseFloat(getValue('suppWeightInput'))
      const supplementalSets = Number.parseInt(getValue('suppSetsInput'), 10)
      const reps =
        (planned.plannedBarbellRows || []).find((row) => row.category === 'supplemental')
          ?.prescribed_reps || 5
      if (!Number.isFinite(supplementalWeight) || supplementalWeight <= 0) {
        alert('Enter modified supplemental weight first.')
        return
      }
      const sets = Number.isFinite(supplementalSets) && supplementalSets > 0 ? supplementalSets : 10
      payload.suppModifiedText = `${sets}x${reps}@${supplementalWeight}`
    }

    if (action === 'cardio_done' || action === 'z2_fixed_hr_test') {
      const hrText = getValue('cardioAvgHrInput').trim()
      const durationInput = Number.parseInt(getValue('cardioDurationInput'), 10)
      const speedInput = Number.parseFloat(getValue('cardioSpeedInput'))
      const workMinInput = Number.parseFloat(getValue('cardioWorkMinInput'))
      const restMinInput = Number.parseFloat(getValue('cardioRestMinInput'))

      if (!hrText) {
        alert('Enter Avg HR in the Cardio section first, then tap Mark Cardio Complete.')
        return
      }

      const avgHr = Number.parseInt(hrText, 10)
      if (!Number.isFinite(avgHr) || avgHr <= 0) {
        alert('Please enter a valid average HR number.')
        return
      }

      payload.avgHr = avgHr
      payload.plannedCardio = {
        ...(planned.plannedCardio || {}),
        duration_min:
          Number.isFinite(durationInput) && durationInput > 0
            ? durationInput
            : planned.plannedCardio?.duration_min || 30
      }

      if (Number.isFinite(speedInput) && speedInput > 0) payload.speedKmh = speedInput

      const protocol = String(
        payload.plannedCardio?.session_type || payload.plannedCardio?.protocol || ''
      )
      const isVo2 = protocol.includes('VO2') || protocol === 'VO2_4x4' || protocol === 'VO2_1min'
      const defaultWork = protocol.includes('4x4') || protocol === 'VO2_4x4' ? 4 : 1
      const defaultRest = protocol.includes('4x4') || protocol === 'VO2_4x4' ? 3 : 1

      if (Number.isFinite(workMinInput) && workMinInput > 0) payload.workMin = workMinInput
      if (Number.isFinite(restMinInput) && restMinInput >= 0) payload.restMin = restMinInput

      if (action === 'cardio_done' && isVo2) {
        if (!Number.isFinite(payload.workMin) || payload.workMin <= 0) {
          payload.workMin = defaultWork
        }
        if (!Number.isFinite(payload.restMin) || payload.restMin < 0) {
          payload.restMin = defaultRest
        }
      }

      if (action === 'z2_fixed_hr_test' && !payload.speedKmh) {
        alert('For Fixed-HR test, enter speed (km/h) before saving.')
        return
      }
    }

    if (action === 'main_done') {
      const mainWeight = Number.parseFloat(getValue('mainWeightInput'))
      const mainReps = Number.parseInt(getValue('mainRepsInput'), 10)
      if (
        Number.isFinite(mainWeight) &&
        mainWeight > 0 &&
        Number.isFinite(mainReps) &&
        mainReps > 0
      ) {
        payload.plannedBarbellRows = (planned.plannedBarbellRows || []).map((row) =>
          row.category === 'main'
            ? { ...row, planned_weight_kg: mainWeight, prescribed_reps: mainReps }
            : row
        )
      }
    }

    try {
      await postLogAction(payload)
      await renderDashboard()
      window.__openDetailForDate?.(date)
      if (action === 'cardio_done') alert('Cardio session saved.')
      if (action === 'z2_fixed_hr_test') alert('Monthly Z2 fixed-HR test saved.')
    } catch (error) {
      console.error(error)
      alert(`Could not save action: ${error.message || error}`)
    }
  }
}
