import type { DashboardData } from '@/types/dashboard'
import { StatCard } from './StatCard'
import { WeekProgress } from './WeekProgress'
import { DailyTiles } from './DailyTiles'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface OverviewTabProps {
  data: DashboardData
  onDateClick: (date: string) => void
  onCycleRecoveryStatus: (date: string, currentStatus?: string) => void
}

export function OverviewTab({ data, onDateClick, onCycleRecoveryStatus }: OverviewTabProps) {
  const totals = data.totals || {}
  const weekProgress = data.weekProgress || []
  const dailyTiles = data.dailyTiles || []
  const details = data.details || {}

  const plannedWeek = weekProgress.reduce((count, row) => {
    return (
      count +
      (row.main_lift ? 1 : 0) +
      (row.main_lift ? 1 : 0) + // supplemental mirrors main
      (row.cardio_plan && row.cardio_plan !== 'OFF' ? 1 : 0) +
      (row.rings_plan ? 1 : 0)
    )
  }, 0)
  const doneWeek = weekProgress.reduce((count, row) => {
    const barbellRows = details?.barbellByDate?.[row.session_date] || []
    const hasMain = barbellRows.some((r) => r.category === 'main')
    const hasSupp = barbellRows.some((r) => r.category === 'supplemental')
    return (
      count +
      (hasMain ? 1 : 0) +
      (hasSupp ? 1 : 0) +
      (row.cardio_done ? 1 : 0) +
      (row.rings_done ? 1 : 0)
    )
  }, 0)
  const weekPct = plannedWeek ? Math.round((doneWeek / plannedWeek) * 100) : 0

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const dayIdx = Math.max(1, Math.min(7, ((new Date(`${today}T00:00:00`).getDay() + 6) % 7) + 1))
  const expectedByToday = Math.round(plannedWeek * (dayIdx / 7) || 0)
  const expectedPct = plannedWeek ? Math.round((expectedByToday / plannedWeek) * 100) : 0
  const behind = Math.max(0, expectedByToday - doneWeek)

  const z2WeeklyTarget = 120
  const cardioByDate = details?.cardioByDate || {}
  const cardioRows = Object.values(cardioByDate).flat()
  const seen = new Set<string>()
  const uniqueCardioSessions = cardioRows.filter((row) => {
    const key = `${row.session_date}|${row.protocol}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const z2Sessions = uniqueCardioSessions.filter((row) => {
    return row.protocol === 'Z2'
  })
  const weekStartDate = (() => {
    const d = new Date(`${today}T00:00:00`)
    const day = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - day)
    return d.toISOString().slice(0, 10)
  })()
  const weekEndDate = (() => {
    const d = new Date(`${weekStartDate}T00:00:00`)
    d.setDate(d.getDate() + 6)
    return d.toISOString().slice(0, 10)
  })()
  const z2WeekMin = z2Sessions
    .filter((r) => r.session_date >= weekStartDate && r.session_date <= weekEndDate)
    .reduce((sum, r) => sum + Number(r.duration_min || 0), 0)
  const z2Pct = Math.min(100, Math.round((z2WeekMin / z2WeeklyTarget) * 100))
  const vo2Sessions = uniqueCardioSessions.filter((row) =>
    String(row.protocol || '').includes('VO2')
  )
  const totalIntensity = Math.max(1, z2Sessions.length + vo2Sessions.length)
  const z2Share = Math.round((z2Sessions.length / totalIntensity) * 100)
  const vo2Share = 100 - z2Share
  const weeklyVerdict =
    weekPct >= expectedPct
      ? 'On pace'
      : behind >= 2
        ? `Behind by ${behind} sessions`
        : 'Slightly behind'
  const intensityVerdict =
    z2Share >= 75 ? 'Z2-dominant' : z2Share >= 65 ? 'Slightly VO2-heavy' : 'Too VO2-heavy'
  const z2Verdict =
    z2WeekMin >= z2WeeklyTarget
      ? `Target met (+${z2WeekMin - z2WeeklyTarget}m)`
      : `Under target (${z2WeeklyTarget - z2WeekMin}m short)`

  return (
    <div className="space-y-6 py-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Barbell Sessions" value={totals.barbell_sessions ?? 0} accent />
        <StatCard label="Cardio Sessions" value={totals.cardio_sessions ?? 0} />
        <StatCard label="Rings Sessions" value={totals.rings_sessions ?? 0} />
        <StatCard label="Total Training Days" value={totals.total_training_days ?? 0} />
        <StatCard label="Active Days (14d)" value={totals.active_days_last_14 ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Training Status
            </p>
            <p className="font-display text-3xl font-bold">{weekPct}%</p>
            <p className="text-xs text-muted-foreground">
              Expected by today: {expectedPct}% ({expectedByToday}/{plannedWeek})
            </p>
            <p className="text-xs text-muted-foreground">{weeklyVerdict}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Intensity Distribution
            </p>
            <p className="font-display text-3xl font-bold">
              {z2Share}% / {vo2Share}%
            </p>
            <p className="text-xs text-muted-foreground">Target: 75% / 25%</p>
            <p className="text-xs text-muted-foreground">{intensityVerdict}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Z2 Volume</p>
            <p className="font-display text-3xl font-bold">
              {z2WeekMin} / {z2WeeklyTarget}
            </p>
            <p className="text-xs text-muted-foreground">Minutes this week</p>
            <p className="text-xs text-muted-foreground">{z2Verdict}</p>
          </CardContent>
        </Card>
      </div>

      <WeekProgress rows={weekProgress} onDateClick={onDateClick} />

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
            Daily Activity Tiles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DailyTiles
            tiles={dailyTiles}
            details={details}
            onDateClick={onDateClick}
            onCycleRecoveryStatus={onCycleRecoveryStatus}
          />
        </CardContent>
      </Card>
    </div>
  )
}
