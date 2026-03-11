import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { currentDateInDashboardTZ } from '@/lib/time';
import type { DashboardData } from '@/types/dashboard';
import { DailyTiles } from './DailyTiles';
import { StatCard } from './StatCard';
import { WeekProgress } from './WeekProgress';

interface OverviewTabProps {
  data: DashboardData;
  onDateClick: (date: string) => void;
  onCycleRecoveryStatus: (date: string, currentStatus?: string) => void;
}

interface OverviewMetrics {
  details: DashboardData['details'];
  expectedByToday: number;
  expectedPct: number;
  intensityVerdict: string;
  plannedWeek: number;
  vo2Share: number;
  weekPct: number;
  weekProgress: DashboardData['weekProgress'];
  weeklyVerdict: string;
  z2Share: number;
  z2Verdict: string;
  z2WeekMin: number;
  z2WeeklyTarget: number;
}

function getWeeklyVerdict(weekPct: number, expectedPct: number, behind: number) {
  if (weekPct >= expectedPct) return 'On pace';
  if (behind >= 2) return `Behind by ${behind} sessions`;
  return 'Slightly behind';
}

function getIntensityVerdict(z2Share: number) {
  if (z2Share >= 75) return 'Z2-dominant';
  if (z2Share >= 65) return 'Slightly VO2-heavy';
  return 'Too VO2-heavy';
}

function buildOverviewMetrics(data: DashboardData): OverviewMetrics {
  const weekProgress = data.weekProgress || [];
  const details = data.details || {};
  const plannedWeek = weekProgress.reduce((count, row) => {
    return (
      count +
      (row.main_lift ? 1 : 0) +
      (row.main_lift ? 1 : 0) +
      (row.cardio_plan && row.cardio_plan !== 'OFF' ? 1 : 0) +
      (row.rings_plan ? 1 : 0)
    );
  }, 0);
  const doneWeek = weekProgress.reduce((count, row) => {
    const barbellRows = details?.barbellByDate?.[row.session_date] || [];
    const hasMain = barbellRows.some((value) => value.category === 'main');
    const hasSupp = barbellRows.some((value) => value.category === 'supplemental');
    return (
      count +
      (hasMain ? 1 : 0) +
      (hasSupp ? 1 : 0) +
      (row.cardio_done ? 1 : 0) +
      (row.rings_done ? 1 : 0)
    );
  }, 0);
  const weekPct = plannedWeek ? Math.round((doneWeek / plannedWeek) * 100) : 0;

  const today = currentDateInDashboardTZ();
  const dayIndex = Math.max(1, Math.min(7, ((new Date(`${today}T00:00:00`).getDay() + 6) % 7) + 1));
  const expectedByToday = Math.round(plannedWeek * (dayIndex / 7) || 0);
  const expectedPct = plannedWeek ? Math.round((expectedByToday / plannedWeek) * 100) : 0;
  const behind = Math.max(0, expectedByToday - doneWeek);

  const z2WeeklyTarget = 120;
  const cardioRows = Object.values(details?.cardioByDate || {}).flat();
  const seen = new Set<string>();
  const uniqueCardioSessions = cardioRows.filter((row) => {
    const key = `${row.session_date}|${row.protocol}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const z2Sessions = uniqueCardioSessions.filter((row) => row.protocol === 'Z2');
  const weekStartDate = (() => {
    const date = new Date(`${today}T00:00:00`);
    const day = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - day);
    return date.toISOString().slice(0, 10);
  })();
  const weekEndDate = (() => {
    const date = new Date(`${weekStartDate}T00:00:00`);
    date.setDate(date.getDate() + 6);
    return date.toISOString().slice(0, 10);
  })();
  const z2WeekMin = z2Sessions
    .filter((row) => row.session_date >= weekStartDate && row.session_date <= weekEndDate)
    .reduce((sum, row) => sum + Number(row.duration_min || 0), 0);
  const vo2Sessions = uniqueCardioSessions.filter((row) =>
    String(row.protocol || '').includes('VO2'),
  );
  const totalIntensity = Math.max(1, z2Sessions.length + vo2Sessions.length);
  const z2Share = Math.round((z2Sessions.length / totalIntensity) * 100);

  return {
    details,
    expectedByToday,
    expectedPct,
    intensityVerdict: getIntensityVerdict(z2Share),
    plannedWeek,
    vo2Share: 100 - z2Share,
    weekPct,
    weekProgress,
    weeklyVerdict: getWeeklyVerdict(weekPct, expectedPct, behind),
    z2Share,
    z2Verdict:
      z2WeekMin >= z2WeeklyTarget
        ? `Target met (+${z2WeekMin - z2WeeklyTarget}m)`
        : `Under target (${z2WeeklyTarget - z2WeekMin}m short)`,
    z2WeekMin,
    z2WeeklyTarget,
  };
}

export function OverviewTab({ data, onDateClick, onCycleRecoveryStatus }: OverviewTabProps) {
  const totals = data.totals || {};
  const dailyTiles = data.dailyTiles || [];
  const metrics = buildOverviewMetrics(data);

  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Barbell Sessions" value={totals.barbell_sessions ?? 0} accent />
        <StatCard label="Cardio Sessions" value={totals.cardio_sessions ?? 0} />
        <StatCard label="Rings Sessions" value={totals.rings_sessions ?? 0} />
        <StatCard label="Total Training Days" value={totals.total_training_days ?? 0} />
        <StatCard label="Active Days (14d)" value={totals.active_days_last_14 ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="border-border/50">
          <CardContent className="space-y-2 p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Training Status
            </p>
            <p className="font-display text-3xl font-bold">{metrics.weekPct}%</p>
            <p className="text-xs text-muted-foreground">
              Expected by today: {metrics.expectedPct}% ({metrics.expectedByToday}/
              {metrics.plannedWeek})
            </p>
            <p className="text-xs text-muted-foreground">{metrics.weeklyVerdict}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="space-y-2 p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Intensity Distribution
            </p>
            <p className="font-display text-3xl font-bold">
              {metrics.z2Share}% / {metrics.vo2Share}%
            </p>
            <p className="text-xs text-muted-foreground">Target: 75% / 25%</p>
            <p className="text-xs text-muted-foreground">{metrics.intensityVerdict}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="space-y-2 p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Z2 Volume</p>
            <p className="font-display text-3xl font-bold">
              {metrics.z2WeekMin} / {metrics.z2WeeklyTarget}
            </p>
            <p className="text-xs text-muted-foreground">Minutes this week</p>
            <p className="text-xs text-muted-foreground">{metrics.z2Verdict}</p>
          </CardContent>
        </Card>
      </div>

      <WeekProgress rows={metrics.weekProgress} onDateClick={onDateClick} />

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Daily Activity Tiles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DailyTiles
            tiles={dailyTiles}
            details={metrics.details}
            onDateClick={onDateClick}
            onCycleRecoveryStatus={onCycleRecoveryStatus}
          />
        </CardContent>
      </Card>
    </div>
  );
}
