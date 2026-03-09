export const DASHBOARD_TZ = 'Asia/Manila'

export function currentDateInDashboardTZ(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: DASHBOARD_TZ })
}
