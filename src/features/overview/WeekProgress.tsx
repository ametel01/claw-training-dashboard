import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { currentDateInDashboardTZ } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { WeekProgressRow } from '@/types/dashboard';

interface WeekProgressProps {
  rows: WeekProgressRow[];
  onDateClick: (date: string) => void;
}

interface WeekProgressChip {
  detail: string;
  done: boolean;
  key: string;
  label: string;
  planned: boolean;
}

interface WeekProgressSummary {
  borderClass: string;
  chips: WeekProgressChip[];
  dayLabel: string;
  done: number;
  dotColor: string;
  planned: number;
}

function getBorderClass(isDoneAll: boolean, isPartial: boolean, isUpcoming: boolean) {
  if (isDoneAll) return 'border-[var(--ok)]/40 bg-[var(--ok)]/10 text-[var(--ok)]';
  if (isPartial) return 'border-[var(--warn)]/40 bg-[var(--warn)]/10 text-[var(--warn)]';
  if (isUpcoming) return 'border-border/30 bg-muted/20 text-muted-foreground';
  return 'border-border/20 bg-muted/10 text-muted-foreground/60';
}

function getDotColor(isDoneAll: boolean, isPartial: boolean) {
  if (isDoneAll) return 'var(--ok)';
  if (isPartial) return 'var(--warn)';
  return 'transparent';
}

function buildWeekProgressSummary(row: WeekProgressRow, today: string): WeekProgressSummary {
  const chips = [
    {
      key: 'barbell',
      label: '🏋',
      done: Boolean(row.barbell_done),
      detail: row.main_lift || '',
      planned: Boolean(row.main_lift),
    },
    {
      key: 'cardio',
      label: '❤️',
      done: Boolean(row.cardio_done),
      detail: row.cardio_plan || '',
      planned: Boolean(row.cardio_plan && row.cardio_plan !== 'OFF'),
    },
    {
      key: 'rings',
      label: '🤸',
      done: Boolean(row.rings_done),
      detail: row.rings_plan || '',
      planned: Boolean(row.rings_plan),
    },
  ].filter((chip) => chip.planned || chip.done);
  const planned = chips.filter((chip) => chip.planned).length;
  const done = chips.filter((chip) => chip.done).length;
  const isUpcoming = row.session_date >= today;
  const isDoneAll = done === planned && planned > 0;
  const isPartial = done > 0 && !isDoneAll;

  return {
    borderClass: getBorderClass(isDoneAll, isPartial, isUpcoming),
    chips,
    dayLabel: row.day_name?.slice(0, 3) || '?',
    done,
    dotColor: getDotColor(isDoneAll, isPartial),
    planned,
  };
}

function renderChip({ label, done, detail }: { label: string; done: boolean; detail: string }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]',
        done
          ? 'border-[var(--ok)]/30 bg-[var(--ok)]/10 text-[var(--ok)]'
          : 'border-border/30 bg-muted/30 text-muted-foreground',
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      <span>{label}</span>
      {detail ? <span className="hidden truncate sm:inline">&middot; {detail}</span> : null}
    </span>
  );
}

function WeekProgressCard({
  onDateClick,
  row,
  summary,
}: {
  onDateClick: (date: string) => void;
  row: WeekProgressRow;
  summary: WeekProgressSummary;
}) {
  return (
    <button
      type="button"
      data-date={row.session_date}
      onClick={() => onDateClick(row.session_date)}
      className={cn(
        'min-w-0 cursor-pointer snap-start rounded border p-3 text-left transition-all hover:scale-[1.01]',
        summary.borderClass,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium sm:text-xs">{summary.dayLabel}</p>
          <p className="text-xs opacity-70">{row.session_date.slice(5)}</p>
        </div>
        <div
          className="mt-1 size-2 shrink-0 rounded-full"
          style={{ backgroundColor: summary.dotColor }}
        />
      </div>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-current/80">
        {summary.planned ? `${summary.done}/${summary.planned} done` : 'Rest / Recovery'}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {summary.chips.length ? (
          summary.chips.map((chip) => <span key={chip.key}>{renderChip(chip)}</span>)
        ) : (
          <span className="text-[11px] text-muted-foreground">No planned sessions</span>
        )}
      </div>
      <div className="mt-1 h-1 w-full rounded-full" style={{ backgroundColor: summary.dotColor }} />
    </button>
  );
}

export function WeekProgress({ rows, onDateClick }: WeekProgressProps) {
  const today = currentDateInDashboardTZ();
  if (!rows?.length) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          This Week
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
        <ScrollArea className="w-full">
          <div className="grid auto-cols-[minmax(10rem,1fr)] grid-flow-col gap-2 snap-x snap-mandatory pb-3 sm:grid-cols-7 sm:grid-flow-row sm:auto-cols-auto sm:pb-0 sm:snap-none">
            {rows.map((row) => (
              <WeekProgressCard
                key={row.session_date}
                row={row}
                summary={buildWeekProgressSummary(row, today)}
                onDateClick={onDateClick}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="sm:hidden" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
