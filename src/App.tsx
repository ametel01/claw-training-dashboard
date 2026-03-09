import { useEffect, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TopBar } from '@/components/layout/TopBar'
import { OverviewTab } from '@/features/overview/OverviewTab'
import { TodayGlance } from '@/features/overview/TodayGlance'
import { WeekHeaderBanner } from '@/features/overview/WeekHeaderBanner'
import { StrengthTab } from '@/features/strength/StrengthTab'
import { CardioTab } from '@/features/cardio/CardioTab'
import { UploadsTab } from '@/features/uploads/UploadsTab'
import { LogsTab } from '@/features/logs/LogsTab'
import { DetailDialog } from '@/features/details/DetailDialog'
import { useDashboardData } from '@/hooks/useDashboardData'
import { setStatus } from '@/hooks/useApi'
import { Loader2 } from 'lucide-react'
import { currentDateInDashboardTZ } from '@/lib/time'

const TAB_VALUES = ['overview', 'strength', 'cardio', 'uploads', 'logs'] as const
type TabValue = (typeof TAB_VALUES)[number]

function getInitialTab(): TabValue {
  if (typeof window === 'undefined') return 'overview'
  const hashTab = window.location.hash.replace('#tab-', '')
  return TAB_VALUES.includes(hashTab as TabValue) ? (hashTab as TabValue) : 'overview'
}

export default function App() {
  const { data, loading, error, refresh } = useDashboardData()
  const [activeTab, setActiveTab] = useState<TabValue>(getInitialTab)
  const [detailDate, setDetailDate] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [refreshLabel, setRefreshLabel] = useState('Refresh from DB')
  const [refreshHealthLabel, setRefreshHealthLabel] = useState('Refresh + Health Import')

  useEffect(() => {
    window.history.replaceState(null, '', `#tab-${activeTab}`)
  }, [activeTab])

  function openDetail(date: string) {
    setDetailDate(date)
    setDetailOpen(true)
  }

  async function cycleRecoveryStatus(date: string, currentStatus = 'green') {
    const order = ['green', 'yellow', 'red']
    const next = order[(order.indexOf(currentStatus) + 1) % order.length]
    try {
      await setStatus(date, next)
      await refresh()
    } catch (e) {
      console.error(e)
    }
  }

  async function handleRefresh(includeHealth = false) {
    const setLabel = includeHealth ? setRefreshHealthLabel : setRefreshLabel
    const original = includeHealth ? 'Refresh + Health Import' : 'Refresh from DB'
    setLabel(includeHealth ? 'Importing health + refreshing...' : 'Refreshing...')
    try {
      await refresh(includeHealth)
      setLabel(includeHealth ? 'Health + DB Updated ✓' : 'Updated ✓')
      window.setTimeout(() => setLabel(original), 1200)
    } catch (e) {
      console.error(e)
      setLabel(includeHealth ? 'Health refresh failed' : 'Refresh failed')
      window.setTimeout(() => setLabel(original), 2200)
    }
  }

  function handleToday() {
    const today = currentDateInDashboardTZ()
    setActiveTab('overview')
    openDetail(today)
    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(`[data-date="${today}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
  }

  const weeklyCompletion = (() => {
    if (!data) return 'Week: --'
    let planned = 0
    let done = 0

    for (const row of data.weekProgress || []) {
      const barbellRows = data.details?.barbellByDate?.[row.session_date] || []
      const hasMain = barbellRows.some((value) => value.category === 'main')
      const hasSupplemental = barbellRows.some((value) => value.category === 'supplemental')

      if (row.main_lift) {
        planned += 1
        if (hasMain) done += 1
      }
      if (row.main_lift) {
        planned += 1
        if (hasSupplemental) done += 1
      }
      if (row.cardio_plan && row.cardio_plan !== 'OFF') {
        planned += 1
        if (row.cardio_done) done += 1
      }
      if (row.rings_plan) {
        planned += 1
        if (row.rings_done) done += 1
      }
    }

    const pct = planned ? Math.round((done / planned) * 100) : 0
    return `Week: ${done}/${planned} (${pct}%)`
  })()

  const generatedAt = data?.generatedAt
    ? `Data generated: ${new Date(data.generatedAt).toLocaleString()}`
    : ''

  if (loading && !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <p className="text-destructive text-sm">{error}</p>
        <p className="text-xs text-muted-foreground">
          Make sure the Flask server is running and data.json exists.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        onRefresh={() => handleRefresh(false)}
        onRefreshWithHealth={() => handleRefresh(true)}
        onToday={handleToday}
        loading={loading}
        refreshLabel={refreshLabel}
        refreshHealthLabel={refreshHealthLabel}
        weeklyCompletion={weeklyCompletion}
        generatedAt={generatedAt}
      />
      <main className="mx-auto max-w-5xl px-4 pb-8">
        {data && (
          <div className="space-y-4 pt-4">
            <WeekHeaderBanner weekHeader={data.weekHeader} />
            <TodayGlance
              tiles={data.dailyTiles || []}
              details={data.details || {}}
              onStartSession={openDetail}
            />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
          <TabsList className="my-4 w-full justify-start bg-muted/30 border border-border/30">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="strength"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs"
            >
              Strength
            </TabsTrigger>
            <TabsTrigger
              value="cardio"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs"
            >
              Cardio
            </TabsTrigger>
            <TabsTrigger
              value="uploads"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs"
            >
              Uploads
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs"
            >
              Logs & History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {data && (
              <OverviewTab
                data={data}
                onDateClick={openDetail}
                onCycleRecoveryStatus={cycleRecoveryStatus}
              />
            )}
          </TabsContent>
          <TabsContent value="strength">
            {data && <StrengthTab data={data} onRefresh={refresh} />}
          </TabsContent>
          <TabsContent value="cardio">
            {data && <CardioTab data={data} onRefresh={refresh} />}
          </TabsContent>
          <TabsContent value="uploads">
            <UploadsTab onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="logs">
            {data && <LogsTab entries={data.auditLog || []} />}
          </TabsContent>
        </Tabs>
      </main>

      <DetailDialog
        date={detailDate}
        data={data}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onRefresh={refresh}
      />
    </div>
  )
}
