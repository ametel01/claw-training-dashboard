import { currentDateInDashboardTZ } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { DailyTile, Details } from '@/types/dashboard';

interface DailyTilesProps {
  tiles: DailyTile[];
  details: Details;
  onDateClick: (date: string) => void;
  onCycleRecoveryStatus: (date: string, currentStatus?: string) => void;
}

interface TileBadgeSpec {
  detail?: string;
  done: boolean;
  icon: string;
  planned: boolean;
}

interface TileSummary {
  badges: TileBadgeSpec[];
  dayName: string;
  isPast: boolean;
  pain: string;
  title: string;
}

function getBadgeClass(done: boolean, isPast: boolean) {
  if (done) return 'border-[var(--ok)]/30 bg-[var(--ok)]/10 text-[var(--ok)]';
  if (isPast) return 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]';
  return 'border-primary/20 bg-primary/10 text-primary';
}

function getPainClass(pain: string) {
  if (pain === 'red') return 'bg-[var(--danger)]';
  if (pain === 'yellow') return 'bg-[var(--warn)]';
  return 'bg-[var(--ok)]';
}

function buildTileSummary(tile: DailyTile, details: Details, today: string): TileSummary {
  const isPast = tile.session_date < today;
  const barbellRows = details?.barbellByDate?.[tile.session_date] || [];
  const hasMain = barbellRows.some((row) => row.category === 'main');
  const hasSupp = barbellRows.some((row) => row.category === 'supplemental');

  const badges = [
    {
      icon: '🏋',
      planned: Boolean(tile.planned_barbell_main),
      done: hasMain,
      detail: tile.planned_barbell_main ? `${tile.planned_barbell_main}`.trim() : tile.barbell_lift,
    },
    {
      icon: '🏋+',
      planned: Boolean(tile.planned_barbell_supp),
      done: hasSupp,
      detail: tile.planned_barbell_supp
        ? `${tile.planned_barbell_supp} ${tile.planned_supp_sets || ''}x${tile.planned_supp_reps || ''}`.trim()
        : '',
    },
    {
      icon: '❤️',
      planned: Boolean(tile.planned_cardio && tile.planned_cardio !== 'OFF'),
      done: Boolean(tile.has_cardio),
      detail: tile.planned_cardio || tile.cardio_protocol,
    },
    {
      icon: '🤸',
      planned: Boolean(tile.planned_rings),
      done: Boolean(tile.has_rings),
      detail: tile.planned_rings || tile.rings_template,
    },
  ];
  const completionCount = badges.filter((badge) => badge.planned && badge.done).length;
  const plannedCount = badges.filter((badge) => badge.planned).length;

  return {
    badges,
    dayName: new Date(`${tile.session_date}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
    }),
    isPast,
    pain: tile.pain_level || 'green',
    title: plannedCount === 0 ? 'Rest day' : `${completionCount}/${plannedCount} complete`,
  };
}

function BadgePill({ detail, done, icon, isPast, planned }: TileBadgeSpec & { isPast: boolean }) {
  if (!planned) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]',
        getBadgeClass(done, isPast),
      )}
    >
      {icon} {detail || ''}
    </span>
  );
}

function DailyTileCard({
  onCycleRecoveryStatus,
  onDateClick,
  summary,
  tile,
}: {
  onCycleRecoveryStatus: (date: string, currentStatus?: string) => void;
  onDateClick: (date: string) => void;
  summary: TileSummary;
  tile: DailyTile;
}) {
  return (
    <article
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
            {summary.dayName} · {tile.session_date}
          </p>
          <p className="text-sm font-medium text-foreground">{summary.title}</p>
        </div>
        <button
          type="button"
          data-role="status-dot"
          aria-label={`Recovery status: ${summary.pain}`}
          title={`Recovery status: ${summary.pain} (tap to change)`}
          className={cn(
            'mt-0.5 h-3 w-3 rounded-full border border-white/20',
            getPainClass(summary.pain),
          )}
          onClick={(event) => {
            event.stopPropagation();
            onCycleRecoveryStatus(tile.session_date, summary.pain);
          }}
        />
      </div>
      <div className="pointer-events-none mt-2 flex flex-wrap gap-1.5">
        {summary.badges.map((badge) => (
          <BadgePill
            key={`${tile.session_date}:${badge.icon}:${badge.detail || ''}`}
            {...badge}
            isPast={summary.isPast}
          />
        ))}
      </div>
    </article>
  );
}

export function DailyTiles({
  tiles,
  details,
  onDateClick,
  onCycleRecoveryStatus,
}: DailyTilesProps) {
  const today = currentDateInDashboardTZ();
  if (!tiles?.length) return null;

  const orderedTiles = [...tiles].reverse();

  return (
    <details open>
      <summary className="mb-3 list-none cursor-pointer text-sm font-medium uppercase tracking-widest text-muted-foreground">
        Last 14 Days
      </summary>
      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 xl:grid-cols-3">
        {orderedTiles.map((tile) => (
          <DailyTileCard
            key={tile.session_date}
            tile={tile}
            summary={buildTileSummary(tile, details, today)}
            onDateClick={onDateClick}
            onCycleRecoveryStatus={onCycleRecoveryStatus}
          />
        ))}
      </div>
    </details>
  );
}
