import { loadData } from '../core/data'
import { renderAuditLog } from '../features/audit'
import { renderCardioAnalytics } from '../features/cardio'
import { bindDetailClicks } from '../features/details'
import {
  renderDailyTiles,
  renderPerformanceKpis,
  renderTodayGlance,
  renderTotals,
  renderWeekHeader,
  renderWeekProgress,
  renderWeeklyCompletion
} from '../features/overview'
import { renderCurrentCyclePlan, renderCycleControl, renderEst1RM } from '../features/strength'

export async function renderDashboard() {
  const data = await loadData()
  window.__dashboardData = data
  renderWeekHeader(data.weekHeader || null)
  renderTodayGlance(data.dailyTiles || [], data.weekProgress || [], data.details || {})
  renderTotals(data.totals || {})
  renderPerformanceKpis(data.weekProgress || [], data.details || {})
  renderCycleControl(data.cycleControl || {})
  renderEst1RM(data.est1RM || [])
  renderCurrentCyclePlan(data.currentCyclePlan || [])
  renderCardioAnalytics(data.cardioAnalytics || {})
  renderAuditLog(data.auditLog || [])
  renderWeekProgress(data.weekProgress || [])
  renderDailyTiles(data.dailyTiles || [], data.details || {})
  bindDetailClicks(data.details || {}, data.dailyTiles || [], data.weekProgress || [])
  renderWeeklyCompletion(data.weekProgress || [], data.details || {})

  const generatedAt = document.getElementById('generatedAt')
  if (generatedAt) {
    generatedAt.textContent = `Data generated: ${new Date(data.generatedAt).toLocaleString()}`
  }
}
