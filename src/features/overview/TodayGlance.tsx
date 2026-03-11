import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { currentDateInDashboardTZ } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { DailyTile, Details } from '@/types/dashboard';

interface TodayGlanceProps {
  tiles: DailyTile[];
  details: Details;
  onStartSession: (date: string) => void;
}

interface TodayTask {
  done: boolean;
  key: string;
  label: string;
}

interface TodaySummary {
  doneCount: number;
  dotColor: string;
  estimatedMinutes: number;
  pct: number;
  plannedCount: number;
  status: string;
  tasks: TodayTask[];
}

function getTodayStatus(doneCount: number, plannedCount: number) {
  if (doneCount === 0) return 'Not Started';
  if (doneCount === plannedCount) return 'Completed';
  return 'In Progress';
}

function getPainDotColor(painLevel?: string) {
  if (painLevel === 'red') return 'var(--danger)';
  if (painLevel === 'yellow') return 'var(--warn)';
  return 'var(--ok)';
}

function buildTodaySummary(day: DailyTile, details: Details, today: string): TodaySummary {
  const barbellRows = details?.barbellByDate?.[today] || [];
  const hasMain = barbellRows.some((row) => row.category === 'main');
  const hasSupp = barbellRows.some((row) => row.category === 'supplemental');
  const tasks = [
    {
      key: 'main',
      label: day.planned_barbell_main || '',
      done: hasMain,
      planned: Boolean(day.planned_barbell_main),
    },
    {
      key: 'supp',
      label: `Supp: ${day.planned_barbell_supp}`,
      done: hasSupp,
      planned: Boolean(day.planned_barbell_supp),
    },
    {
      key: 'cardio',
      label: day.planned_cardio || '',
      done: Boolean(day.has_cardio),
      planned: Boolean(day.planned_cardio && day.planned_cardio !== 'OFF'),
    },
    {
      key: 'rings',
      label: `Rings: ${day.planned_rings}`,
      done: Boolean(day.has_rings),
      planned: Boolean(day.planned_rings),
    },
  ].filter((task) => task.planned);
  const plannedCount = tasks.length;
  const doneCount = tasks.filter((task) => task.done).length;

  return {
    doneCount,
    dotColor: getPainDotColor(day.pain_level),
    estimatedMinutes:
      (day.planned_barbell_main || day.planned_barbell_supp ? 60 : 0) +
      (day.planned_cardio && day.planned_cardio !== 'OFF' ? 30 : 0) +
      (day.planned_rings ? 20 : 0),
    pct: plannedCount ? Math.round((doneCount / plannedCount) * 100) : 0,
    plannedCount,
    status: getTodayStatus(doneCount, plannedCount),
    tasks,
  };
}

function TodayTaskList({ tasks }: { tasks: TodayTask[] }) {
  return (
    <div className="mb-3 grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
      {tasks.map((task) => (
        <div
          key={task.key}
          className={cn(
            'flex items-center gap-1',
            task.done ? 'text-[var(--ok)]' : 'text-muted-foreground',
          )}
        >
          <span>{task.done ? '✓' : '○'}</span>
          <span>{task.label}</span>
        </div>
      ))}
    </div>
  );
}

export function TodayGlance({ tiles, details, onStartSession }: TodayGlanceProps) {
  const today = currentDateInDashboardTZ();
  const day = tiles.find((tile) => tile.session_date === today);

  if (!day) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">
            Today — {today}
          </p>
          <p className="text-sm text-muted-foreground">No data for today yet.</p>
        </CardContent>
      </Card>
    );
  }

  const summary = buildTodaySummary(day, details, today);

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: summary.dotColor }} />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Today — {today}
            </p>
          </div>
          <span className="font-mono text-sm text-foreground">
            {summary.doneCount}/{summary.plannedCount} · {summary.pct}%
          </span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Status: <strong className="text-foreground">{summary.status}</strong> · Planned time:
          <strong className="ml-1 text-foreground">
            {Math.floor(summary.estimatedMinutes / 60)}h {summary.estimatedMinutes % 60}m
          </strong>
        </p>
        <TodayTaskList tasks={summary.tasks} />
        {summary.status === 'Not Started' ? (
          <Button
            size="sm"
            onClick={() => onStartSession(today)}
            className="w-full text-xs sm:w-auto"
          >
            Start Session
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
