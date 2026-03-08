export {}

declare global {
  interface Window {
    __dashboardData?: Record<string, any>
    __renderDashboard?: () => Promise<void>
    __activeDetailDate?: string
    __activePlanned?: Record<string, any>
    __openDetailForDate?: (date: string) => void
    __setActiveTab?: (tab: string) => void
    setRecoveryStatus?: (date?: string, status?: string) => Promise<void>
    logSessionAction?: (action: string) => Promise<void>
  }
}
