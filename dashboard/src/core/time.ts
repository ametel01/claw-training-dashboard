const DASHBOARD_TIMEZONE = 'Asia/Manila'

export function currentDateInDashboardTZ(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DASHBOARD_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const y = parts.find((part) => part.type === 'year')?.value
  const m = parts.find((part) => part.type === 'month')?.value
  const d = parts.find((part) => part.type === 'day')?.value
  return `${y}-${m}-${d}`
}
