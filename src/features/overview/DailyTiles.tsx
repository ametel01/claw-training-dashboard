import { cn } from '@/lib/utils'
import type { DailyTile, Details } from '@/types/dashboard'
import { currentDateInDashboardTZ } from '@/lib/time'

interface DailyTilesProps {
  tiles: DailyTile[]
  details: Details
  onDateClick: (date: string) => void
  onCycleRecoveryStatus: (date: string, currentStatus?: string) => void
}

export function DailyTiles({
  tiles,
  details,
  onDateClick,
  onCycleRecoveryStatus
}: DailyTilesProps) {
  const today = currentDateInDashboardTZ()
  if (!tiles?.length) return null

  const orderedTiles = [...tiles].reverse()

  function badgeFor({
    icon,
    planned,
    done,
    detail,
    isPast
  }: {
    icon: string
    planned: boolean
    done: boolean
    detail?: string
    isPast: boolean
  }) {
    if (!planned) return null
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]',
          done
            ? 'border-[var(--ok)]/30 bg-[var(--ok)]/10 text-[var(--ok)]'
            : isPast
              ? 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]'
              : 'border-primary/20 bg-primary/10 text-primary'
        )}
      >
        {icon} {detail || ''}
      </span>
    )
  }

  return (
    <details open>
      <summary className="mb-3 cursor-pointer list-none text-sm uppercase tracking-widest text-muted-foreground font-medium">
        Last 14 Days
      </summary>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {orderedTiles.map((tile) => {
          const isPast = tile.session_date < today
          const barbellRows = details?.barbellByDate?.[tile.session_date] || []
          const hasMain = barbellRows.some((r) => r.category === 'main')
          const hasSupp = barbellRows.some((r) => r.category === 'supplemental')

          const plannedMain = !!tile.planned_barbell_main
          const plannedSupp = !!tile.planned_barbell_supp
          const plannedCardio = !!tile.planned_cardio && tile.planned_cardio !== 'OFF'
          const plannedRings = !!tile.planned_rings

          const mainDetail = plannedMain ? `${tile.planned_barbell_main}`.trim() : tile.barbell_lift
          const suppDetail = plannedSupp
            ? `${tile.planned_barbell_supp} ${tile.planned_supp_sets || ''}x${tile.planned_supp_reps || ''}`.trim()
            : ''
          const cardioDetail = tile.planned_cardio || tile.cardio_protocol
          const ringsDetail = tile.planned_rings || tile.rings_template
          const completionCount = [
            plannedMain && hasMain,
            plannedSupp && hasSupp,
            plannedCardio && !!tile.has_cardio,
            plannedRings && !!tile.has_rings
          ].filter(Boolean).length
          const plannedCount = [plannedMain, plannedSupp, plannedCardio, plannedRings].filter(
            Boolean
          ).length
          const title =
            plannedCount === 0 ? 'Rest day' : `${completionCount}/${plannedCount} complete`
          const pain = tile.pain_level || 'green'
          const dayName = new Date(`${tile.session_date}T00:00:00`).toLocaleDateString(undefined, {
            weekday: 'short'
          })

          return (
            <article
              key={tile.session_date}
              data-date={tile.session_date}
              className="relative rounded-lg border border-border/40 bg-muted/10 p-3 text-left transition-colors hover:bg-muted/20"
            >
              <button
                type="button"
                data-date={tile.session_date}
                aria-label={`Open training details for ${tile.session_date}`}
                className="absolute inset-0 rounded-lg"
                onClick={() => onDateClick(tile.session_date)}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="pointer-events-none">
                  <p className="text-xs text-muted-foreground">
                    {dayName} · {tile.session_date}
                  </p>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                </div>
                <button
                  type="button"
                  data-role="status-dot"
                  aria-label={`Recovery status: ${pain}`}
                  title={`Recovery status: ${pain} (tap to change)`}
                  className={cn(
                    'mt-0.5 h-3 w-3 rounded-full border border-white/20',
                    pain === 'red'
                      ? 'bg-[var(--danger)]'
                      : pain === 'yellow'
                        ? 'bg-[var(--warn)]'
                        : 'bg-[var(--ok)]'
                  )}
                  onClick={(event) => {
                    event.stopPropagation()
                    onCycleRecoveryStatus(tile.session_date, pain)
                  }}
                />
              </div>
              <div className="pointer-events-none mt-2 flex flex-wrap gap-1.5">
                {badgeFor({
                  icon: '🏋',
                  planned: plannedMain,
                  done: hasMain,
                  detail: mainDetail,
                  isPast
                })}
                {badgeFor({
                  icon: '🏋+',
                  planned: plannedSupp,
                  done: hasSupp,
                  detail: suppDetail,
                  isPast
                })}
                {badgeFor({
                  icon: '❤️',
                  planned: plannedCardio,
                  done: !!tile.has_cardio,
                  detail: cardioDetail,
                  isPast
                })}
                {badgeFor({
                  icon: '🤸',
                  planned: plannedRings,
                  done: !!tile.has_rings,
                  detail: ringsDetail,
                  isPast
                })}
              </div>
            </article>
          )
        })}
      </div>
    </details>
  )
}
