import { cn } from '@/lib/utils'
import type { WeekProgressRow } from '@/types/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { currentDateInDashboardTZ } from '@/lib/time'

interface WeekProgressProps {
  rows: WeekProgressRow[]
  onDateClick: (date: string) => void
}

export function WeekProgress({ rows, onDateClick }: WeekProgressProps) {
  const today = currentDateInDashboardTZ()
  if (!rows?.length) return null

  function renderChip(label: string, done: boolean, detail: string) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]',
          done
            ? 'border-[var(--ok)]/30 bg-[var(--ok)]/10 text-[var(--ok)]'
            : 'border-border/30 bg-muted/30 text-muted-foreground'
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {label}
        {detail ? ` · ${detail}` : ''}
      </span>
    )
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
          This Week
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {rows.map((row) => {
            const planned = [
              !!row.main_lift,
              !!row.cardio_plan && row.cardio_plan !== 'OFF',
              !!row.rings_plan
            ].filter(Boolean).length
            const done = [!!row.barbell_done, !!row.cardio_done, !!row.rings_done].filter(
              Boolean
            ).length
            const isUpcoming = row.session_date >= today
            const isDoneAll = done === planned && planned > 0
            const isPartial = done > 0 && !isDoneAll

            const borderClass = isDoneAll
              ? 'border-[var(--ok)]/40 bg-[var(--ok)]/10 text-[var(--ok)]'
              : isPartial
                ? 'border-[var(--warn)]/40 bg-[var(--warn)]/10 text-[var(--warn)]'
                : isUpcoming
                  ? 'border-border/30 bg-muted/20 text-muted-foreground'
                  : 'border-border/20 bg-muted/10 text-muted-foreground/60'

            const dotColor = isDoneAll ? 'var(--ok)' : isPartial ? 'var(--warn)' : 'transparent'

            return (
              <button
                key={row.session_date}
                type="button"
                data-date={row.session_date}
                onClick={() => onDateClick(row.session_date)}
                className={cn(
                  'rounded border p-3 text-left transition-all hover:scale-[1.01] cursor-pointer',
                  borderClass
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium">{row.day_name?.slice(0, 3) || '?'}</p>
                    <p className="text-xs opacity-70">{row.session_date.slice(5)}</p>
                  </div>
                  <div
                    className="mt-1 h-2 w-2 rounded-full"
                    style={{ backgroundColor: dotColor }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {renderChip('🏋', !!row.barbell_done, row.main_lift || '—')}
                  {renderChip('❤️', !!row.cardio_done, row.cardio_plan || 'OFF')}
                  {renderChip('🤸', !!row.rings_done, row.rings_plan || '—')}
                </div>
                <div
                  className="mt-1 h-1 w-full rounded-full"
                  style={{ backgroundColor: dotColor }}
                />
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
