import { closestFromEvent, getValue } from '../core/dom'
import { currentDateInDashboardTZ } from '../core/time'
import {
  bindStatusPicker,
  getRefreshButtons,
  initOverviewMode,
  initTabs,
  initUploadBox
} from '../features/controls'
import { renderDashboard } from './render-dashboard'
import { installSessionActions } from './session-actions'

export async function initApp(): Promise<void> {
  try {
    window.__renderDashboard = renderDashboard
    installSessionActions(renderDashboard)

    await renderDashboard()
    bindStatusPicker(renderDashboard)
    initTabs()
    initOverviewMode()
    initUploadBox()

    const todayButton = document.getElementById('todayBtn')
    if (todayButton) {
      todayButton.addEventListener('click', () => {
        window.__setActiveTab?.('overview')
        const today = currentDateInDashboardTZ()
        const target = document.querySelector(`[data-date="${today}"]`)
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        window.__openDetailForDate?.(today)
      })
    }

    document.addEventListener('click', (event) => {
      const button = closestFromEvent(event, '#startSessionBtn')
      if (!button) return
      window.__openDetailForDate?.(currentDateInDashboardTZ())
    })

    const { refreshButton, refreshHealthButton } = getRefreshButtons()
    const runRefresh = async ({ includeHealth = false } = {}) => {
      const button = includeHealth ? refreshHealthButton : refreshButton
      if (!button) return
      const originalText = button.textContent
      button.disabled = true
      if (refreshButton && includeHealth) refreshButton.disabled = true
      if (refreshHealthButton && !includeHealth) refreshHealthButton.disabled = true
      button.textContent = includeHealth ? 'Importing health + refreshing...' : 'Refreshing...'
      try {
        const url = includeHealth ? '/api/refresh?includeHealth=1' : '/api/refresh'
        const response = await fetch(url, { method: 'POST' })
        if (!response.ok) throw new Error(`Refresh failed (${response.status})`)
        await renderDashboard()
        button.textContent = includeHealth ? 'Health + DB Updated ✓' : 'Updated ✓'
        setTimeout(() => {
          button.textContent = originalText
        }, 1200)
      } catch (error) {
        console.error(error)
        button.textContent = includeHealth ? 'Health refresh failed' : 'Refresh failed'
        setTimeout(() => {
          button.textContent = originalText
        }, 2200)
      } finally {
        button.disabled = false
        if (refreshButton) refreshButton.disabled = false
        if (refreshHealthButton) refreshHealthButton.disabled = false
      }
    }

    refreshButton?.addEventListener('click', async () => {
      await runRefresh({ includeHealth: false })
    })
    refreshHealthButton?.addEventListener('click', async () => {
      await runRefresh({ includeHealth: true })
    })

    document.addEventListener('click', async (event) => {
      const tmDeltaButton = closestFromEvent<HTMLButtonElement>(event, '[data-tm-delta]')
      if (tmDeltaButton) {
        const lift = tmDeltaButton.getAttribute('data-tm-lift')
        const delta = Number.parseFloat(tmDeltaButton.getAttribute('data-tm-delta') || '0')
        try {
          tmDeltaButton.disabled = true
          const response = await fetch('/api/tm/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lift, mode: 'delta', value: delta })
          })
          if (!response.ok) throw new Error(`TM update failed (${response.status})`)
          await renderDashboard()
        } catch (error) {
          alert(`Could not update TM: ${error.message || error}`)
        } finally {
          tmDeltaButton.disabled = false
        }
        return
      }

      const tmSetButton = closestFromEvent<HTMLButtonElement>(event, '[data-tm-set]')
      if (tmSetButton) {
        const lift = tmSetButton.getAttribute('data-tm-set')
        const value = Number.parseFloat(getValue(`tmSet-${lift}`))
        if (!Number.isFinite(value) || value <= 0) {
          alert('Enter a valid TM kg value first.')
          return
        }
        try {
          tmSetButton.disabled = true
          const response = await fetch('/api/tm/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lift, mode: 'set', value })
          })
          if (!response.ok) throw new Error(`TM set failed (${response.status})`)
          await renderDashboard()
        } catch (error) {
          alert(`Could not set TM: ${error.message || error}`)
        } finally {
          tmSetButton.disabled = false
        }
        return
      }

      const startCycleButton = closestFromEvent<HTMLButtonElement>(event, '#startCycleBtn')
      if (startCycleButton) {
        const startDate = getValue('newCycleStartInput')
        const blockType = getValue('newCycleTypeInput') || 'Leader'
        try {
          startCycleButton.disabled = true
          const response = await fetch('/api/cycle/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, blockType })
          })
          if (!response.ok) throw new Error(`Start cycle failed (${response.status})`)
          await renderDashboard()
          alert('New cycle created.')
        } catch (error) {
          alert(`Could not start cycle: ${error.message || error}`)
        } finally {
          startCycleButton.disabled = false
        }
        return
      }

      const deloadButton = closestFromEvent<HTMLButtonElement>(event, '#applyDeloadBtn')
      if (deloadButton) {
        const deloadCode = getValue('deloadTypeInput')
        const startDate = getValue('deloadStartInput')
        const durationDays = Number.parseInt(getValue('deloadDaysInput'), 10) || 7
        try {
          deloadButton.disabled = true
          const response = await fetch('/api/cycle/deload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deloadCode, startDate, durationDays })
          })
          if (!response.ok) throw new Error(`Apply deload failed (${response.status})`)
          await renderDashboard()
          alert('Deload applied.')
        } catch (error) {
          alert(`Could not apply deload: ${error.message || error}`)
        } finally {
          deloadButton.disabled = false
        }
      }
    })
  } catch (error) {
    document.body.innerHTML = `<main class="app"><p>Failed to load dashboard data. Run export script first.</p><pre>${error}</pre></main>`
  }
}
