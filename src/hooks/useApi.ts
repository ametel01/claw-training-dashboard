export async function setStatus(date: string, status: string) {
  const res = await fetch(
    `/api/set-status?date=${encodeURIComponent(date)}&status=${encodeURIComponent(status)}`,
    { method: 'POST' }
  )
  if (!res.ok) throw new Error('Failed to set status')
}

export async function updateTM(lift: string, value: number) {
  const res = await fetch('/api/tm/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lift, mode: 'set', value })
  })
  if (!res.ok) throw new Error('Failed to update TM')
}

export async function updateTMDelta(lift: string, delta: number) {
  const res = await fetch('/api/tm/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lift, mode: 'delta', value: delta })
  })
  if (!res.ok) throw new Error('Failed to update TM')
}

export async function startCycle(params: Record<string, unknown>) {
  const res = await fetch('/api/cycle/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  if (!res.ok) throw new Error('Failed to start cycle')
}

export async function applyDeload(params: Record<string, unknown>) {
  const res = await fetch('/api/cycle/deload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  if (!res.ok) throw new Error('Failed to apply deload')
}

export async function logAction(payload: Record<string, unknown>) {
  const res = await fetch('/api/log-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error('Failed to log action')
}
