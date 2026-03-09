import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { currentDateInDashboardTZ } from '@/lib/time'
import type { DailyTile, Details } from '@/types/dashboard'

interface TodayGlanceProps {
  tiles: DailyTile[]
  details: Details
  onStartSession: (date: string) => void
}

export function TodayGlance({ tiles, details, onStartSession }: TodayGlanceProps) {
  const today = currentDateInDashboardTZ()
  const day = tiles.find((t) => t.session_date === today)

  if (!day) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
            Today — {today}
          </p>
          <p className="text-sm text-muted-foreground">No data for today yet.</p>
        </CardContent>
      </Card>
    )
  }

  const barbellRows = details?.barbellByDate?.[today] || []
  const hasMain = barbellRows.some((r) => r.category === 'main')
  const hasSupp = barbellRows.some((r) => r.category === 'supplemental')
  const plannedMain = !!day.planned_barbell_main
  const plannedSupp = !!day.planned_barbell_supp
  const plannedCardio = !!day.planned_cardio && day.planned_cardio !== 'OFF'
  const plannedRings = !!day.planned_rings
  const plannedCount = [plannedMain, plannedSupp, plannedCardio, plannedRings].filter(
    Boolean
  ).length
  const doneCount = [
    plannedMain && hasMain,
    plannedSupp && hasSupp,
    plannedCardio && !!day.has_cardio,
    plannedRings && !!day.has_rings
  ].filter(Boolean).length
  const pct = plannedCount ? Math.round((doneCount / plannedCount) * 100) : 0
  const status =
    doneCount === 0 ? 'Not Started' : doneCount === plannedCount ? 'Completed' : 'In Progress'
  const estimatedMinutes =
    (plannedMain || plannedSupp ? 60 : 0) + (plannedCardio ? 30 : 0) + (plannedRings ? 20 : 0)

  const dotColor =
    day.pain_level === 'red'
      ? 'var(--danger)'
      : day.pain_level === 'yellow'
        ? 'var(--warn)'
        : 'var(--ok)'

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Today — {today}
            </p>
          </div>
          <span className="font-mono text-sm text-foreground">
            {doneCount}/{plannedCount} · {pct}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Status: <strong className="text-foreground">{status}</strong> · Planned time:{' '}
          <strong className="text-foreground">
            {Math.floor(estimatedMinutes / 60)}h {estimatedMinutes % 60}m
          </strong>
        </p>
        <div className="grid grid-cols-2 gap-1.5 text-xs mb-3">
          {plannedMain && (
            <div
              className={cn(
                'flex items-center gap-1',
                hasMain ? 'text-[var(--ok)]' : 'text-muted-foreground'
              )}
            >
              <span>{hasMain ? '✓' : '○'}</span>
              <span>{day.planned_barbell_main}</span>
            </div>
          )}
          {plannedSupp && (
            <div
              className={cn(
                'flex items-center gap-1',
                hasSupp ? 'text-[var(--ok)]' : 'text-muted-foreground'
              )}
            >
              <span>{hasSupp ? '✓' : '○'}</span>
              <span>Supp: {day.planned_barbell_supp}</span>
            </div>
          )}
          {plannedCardio && (
            <div
              className={cn(
                'flex items-center gap-1',
                day.has_cardio ? 'text-[var(--ok)]' : 'text-muted-foreground'
              )}
            >
              <span>{day.has_cardio ? '✓' : '○'}</span>
              <span>{day.planned_cardio}</span>
            </div>
          )}
          {plannedRings && (
            <div
              className={cn(
                'flex items-center gap-1',
                day.has_rings ? 'text-[var(--ok)]' : 'text-muted-foreground'
              )}
            >
              <span>{day.has_rings ? '✓' : '○'}</span>
              <span>Rings: {day.planned_rings}</span>
            </div>
          )}
        </div>
        {status === 'Not Started' && (
          <Button size="sm" onClick={() => onStartSession(today)} className="text-xs">
            Start Session
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
