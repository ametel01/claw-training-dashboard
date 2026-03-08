import { getById } from '../core/dom'

export function bindStatusPicker(renderDashboard: () => Promise<void>): void {
  const order = ['green', 'yellow', 'red']

  async function handleStatusTap(event) {
    const dot =
      event.target instanceof Element
        ? (event.target.closest('[data-role="status-dot"]') as HTMLElement | null)
        : null
    if (!dot) return

    event.preventDefault()
    event.stopPropagation()

    const date = dot.dataset.date
    const current = dot.dataset.status || 'green'
    const next = order[(order.indexOf(current) + 1) % order.length]

    try {
      const response = await fetch(
        `/api/set-status?date=${encodeURIComponent(date)}&status=${encodeURIComponent(next)}`,
        { method: 'POST' }
      )
      if (!response.ok) throw new Error(`set-status failed (${response.status})`)
      await renderDashboard()
    } catch (error) {
      console.error(error)
    }
  }

  document.addEventListener('click', handleStatusTap, true)
  document.addEventListener('touchend', handleStatusTap, true)
}

export function initOverviewMode(): void {
  const athleteButton = document.getElementById('athleteViewBtn')
  const logButton = document.getElementById('logViewBtn')
  if (!athleteButton || !logButton) return

  const athleteOnly = Array.from(document.querySelectorAll('.athlete-only'))
  const logOnly = Array.from(document.querySelectorAll('.log-only'))
  const setMode = (mode) => {
    const athlete = mode !== 'log'
    athleteButton.classList.toggle('active', athlete)
    logButton.classList.toggle('active', !athlete)
    athleteOnly.forEach((element) => element.classList.toggle('hidden-view', !athlete))
    logOnly.forEach((element) => element.classList.toggle('hidden-view', athlete))
  }

  athleteButton.addEventListener('click', () => setMode('athlete'))
  logButton.addEventListener('click', () => setMode('log'))
  setMode('athlete')
}

export function initUploadBox(): void {
  const wire = ({ kind, inputId, buttonId, statusId, boxId }) => {
    const input = document.getElementById(inputId) as HTMLInputElement | null
    const button = document.getElementById(buttonId) as HTMLButtonElement | null
    const status = document.getElementById(statusId)
    const box = document.getElementById(boxId)
    if (!input || !button || !status || !box) return

    const upload = async (file) => {
      if (!file) return
      button.disabled = true
      status.textContent = `Uploading ${file.name}...`
      try {
        const formData = new FormData()
        formData.append('kind', kind)
        formData.append('file', file)
        const response = await fetch('/api/upload-health', { method: 'POST', body: formData })
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !data.ok) {
          throw new Error(data.error || `upload failed (${response.status})`)
        }
        status.textContent = `Uploaded: ${data.path}`
      } catch (error) {
        status.textContent = `Upload failed: ${error.message || error}`
      } finally {
        button.disabled = false
      }
    }

    button.addEventListener('click', async () => upload(input.files?.[0]))
    input.addEventListener('change', async () => {
      if (input.files?.[0]) await upload(input.files[0])
    })

    box.addEventListener('dragover', (event) => {
      event.preventDefault()
      box.classList.add('dragging')
    })
    box.addEventListener('dragleave', () => box.classList.remove('dragging'))
    box.addEventListener('drop', async (event) => {
      event.preventDefault()
      box.classList.remove('dragging')
      const file = event.dataTransfer?.files?.[0]
      if (file) await upload(file)
    })
  }

  wire({
    kind: 'apple',
    inputId: 'appleFileInput',
    buttonId: 'appleUploadBtn',
    statusId: 'appleUploadStatus',
    boxId: 'appleDropBox'
  })
  wire({
    kind: 'polar',
    inputId: 'polarFileInput',
    buttonId: 'polarUploadBtn',
    statusId: 'polarUploadStatus',
    boxId: 'polarDropBox'
  })
}

export function initTabs(): void {
  const tabButtons = Array.from(document.querySelectorAll('.tabs .tab-btn[data-tab]'))
  const panels = Array.from(document.querySelectorAll('.tab-panel'))
  if (!tabButtons.length || !panels.length) return

  const activate = (tab, updateHash = true) => {
    tabButtons.forEach((button) => {
      const isActive = (button as HTMLElement).dataset.tab === tab
      button.classList.toggle('active', isActive)
      button.setAttribute('aria-selected', isActive ? 'true' : 'false')
    })
    panels.forEach((panel) => {
      panel.classList.toggle('active', (panel as HTMLElement).dataset.tabPanel === tab)
    })
    if (updateHash) {
      const newHash = `tab-${tab}`
      if (window.location.hash !== `#${newHash}`) {
        history.replaceState(null, '', `#${newHash}`)
      }
    }
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', () =>
      activate((button as HTMLElement).dataset.tab || 'overview')
    )
  })

  const fromHash = (window.location.hash || '').replace('#tab-', '')
  const initialTab = tabButtons.some((button) => (button as HTMLElement).dataset.tab === fromHash)
    ? fromHash
    : (tabButtons[0] as HTMLElement | undefined)?.dataset.tab || 'overview'
  activate(initialTab, false)
  window.__setActiveTab = (tab) => activate(tab)
}

export function getRefreshButtons() {
  return {
    refreshButton: getById<HTMLButtonElement>('refreshBtn'),
    refreshHealthButton: getById<HTMLButtonElement>('refreshHealthBtn')
  }
}
