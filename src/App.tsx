import { Loader2 } from 'lucide-react';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DetailDialog } from '@/features/details/DetailDialog';
import { CardioTab } from '@/features/cardio/CardioTab';
import { LogsTab } from '@/features/logs/LogsTab';
import { OverviewTab } from '@/features/overview/OverviewTab';
import { TodayGlance } from '@/features/overview/TodayGlance';
import { WeekHeaderBanner } from '@/features/overview/WeekHeaderBanner';
import { StrengthTab } from '@/features/strength/StrengthTab';
import { UploadsTab } from '@/features/uploads/UploadsTab';
import { setStatus } from '@/hooks/useApi';
import { useDashboardData } from '@/hooks/useDashboardData';
import { currentDateInDashboardTZ } from '@/lib/time';

const TAB_VALUES = ['overview', 'strength', 'cardio', 'uploads', 'logs'] as const;
type TabValue = (typeof TAB_VALUES)[number];
type RefreshLabelSetter = Dispatch<SetStateAction<string>>;

interface RefreshUiState {
  failureLabel: string;
  loadingLabel: string;
  resetDelay: number;
  setter: RefreshLabelSetter;
  successLabel: string;
}

interface DashboardTabsProps {
  activeTab: TabValue;
  data: NonNullable<ReturnType<typeof useDashboardData>['data']>;
  onCycleRecoveryStatus: (date: string, currentStatus?: string) => Promise<void>;
  onDateClick: (date: string) => void;
  onRefresh: ReturnType<typeof useDashboardData>['refresh'];
  setActiveTab: (value: TabValue) => void;
}

function getInitialTab(): TabValue {
  if (typeof window === 'undefined') return 'overview';
  const hashTab = window.location.hash.replace('#tab-', '');
  return TAB_VALUES.includes(hashTab as TabValue) ? (hashTab as TabValue) : 'overview';
}

function getRefreshUiState(
  includeHealth: boolean,
  setRefreshLabel: RefreshLabelSetter,
  setRefreshHealthLabel: RefreshLabelSetter,
): RefreshUiState {
  if (includeHealth) {
    return {
      failureLabel: 'Health refresh failed',
      loadingLabel: 'Importing health + refreshing...',
      resetDelay: 2200,
      setter: setRefreshHealthLabel,
      successLabel: 'Health + DB Updated ✓',
    };
  }

  return {
    failureLabel: 'Refresh failed',
    loadingLabel: 'Refreshing...',
    resetDelay: 1200,
    setter: setRefreshLabel,
    successLabel: 'Updated ✓',
  };
}

function getWeekRowCounts(
  row: NonNullable<ReturnType<typeof useDashboardData>['data']>['weekProgress'][number],
  details: NonNullable<ReturnType<typeof useDashboardData>['data']>['details'],
) {
  const barbellRows = details?.barbellByDate?.[row.session_date] || [];
  const hasMain = barbellRows.some((value) => value.category === 'main');
  const hasSupplemental = barbellRows.some((value) => value.category === 'supplemental');

  return {
    done:
      (hasMain ? 1 : 0) +
      (hasSupplemental ? 1 : 0) +
      (row.cardio_done ? 1 : 0) +
      (row.rings_done ? 1 : 0),
    planned:
      (row.main_lift ? 2 : 0) +
      (row.cardio_plan && row.cardio_plan !== 'OFF' ? 1 : 0) +
      (row.rings_plan ? 1 : 0),
  };
}

function buildWeeklyCompletion(data: ReturnType<typeof useDashboardData>['data']) {
  if (!data) return 'Week: --';
  const totals = (data.weekProgress || []).reduce(
    (accumulator, row) => {
      const counts = getWeekRowCounts(row, data.details || {});
      return {
        done: accumulator.done + counts.done,
        planned: accumulator.planned + counts.planned,
      };
    },
    { done: 0, planned: 0 },
  );
  const pct = totals.planned ? Math.round((totals.done / totals.planned) * 100) : 0;
  return `Week: ${totals.done}/${totals.planned} (${pct}%)`;
}

function LoadingState() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <p className="text-sm text-destructive">{error}</p>
      <p className="text-xs text-muted-foreground">
        Make sure the Flask server is running and `data.json` exists.
      </p>
    </div>
  );
}

function DashboardTabs({
  activeTab,
  data,
  onCycleRecoveryStatus,
  onDateClick,
  onRefresh,
  setActiveTab,
}: DashboardTabsProps) {
  return (
    <>
      <div className="space-y-4 pt-4">
        <WeekHeaderBanner weekHeader={data.weekHeader} />
        <TodayGlance
          tiles={data.dailyTiles || []}
          details={data.details || {}}
          onStartSession={onDateClick}
        />
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
        <TabsList className="my-4 w-full justify-start border border-border/30 bg-muted/30">
          <TabsTrigger
            value="overview"
            className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="strength"
            className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Strength
          </TabsTrigger>
          <TabsTrigger
            value="cardio"
            className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Cardio
          </TabsTrigger>
          <TabsTrigger
            value="uploads"
            className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Uploads
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Logs & History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            data={data}
            onDateClick={onDateClick}
            onCycleRecoveryStatus={onCycleRecoveryStatus}
          />
        </TabsContent>
        <TabsContent value="strength">
          <StrengthTab data={data} onRefresh={onRefresh} />
        </TabsContent>
        <TabsContent value="cardio">
          <CardioTab data={data} onRefresh={onRefresh} />
        </TabsContent>
        <TabsContent value="uploads">
          <UploadsTab onRefresh={onRefresh} />
        </TabsContent>
        <TabsContent value="logs">
          <LogsTab entries={data.auditLog || []} />
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function App() {
  const { data, loading, error, refresh } = useDashboardData();
  const [activeTab, setActiveTab] = useState<TabValue>(getInitialTab);
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [refreshLabel, setRefreshLabel] = useState('Refresh from DB');
  const [refreshHealthLabel, setRefreshHealthLabel] = useState('Refresh + Health Import');

  useEffect(() => {
    window.history.replaceState(null, '', `#tab-${activeTab}`);
  }, [activeTab]);

  function openDetail(date: string) {
    setDetailDate(date);
    setDetailOpen(true);
  }

  async function cycleRecoveryStatus(date: string, currentStatus = 'green') {
    const order = ['green', 'yellow', 'red'];
    const next = order[(order.indexOf(currentStatus) + 1) % order.length];

    try {
      await setStatus(date, next);
      await refresh();
    } catch {
      // Best-effort state toggle.
    }
  }

  async function handleRefresh(includeHealth = false) {
    const ui = getRefreshUiState(includeHealth, setRefreshLabel, setRefreshHealthLabel);
    const original = includeHealth ? 'Refresh + Health Import' : 'Refresh from DB';
    ui.setter(ui.loadingLabel);

    try {
      await refresh(includeHealth);
      ui.setter(ui.successLabel);
    } catch {
      ui.setter(ui.failureLabel);
    }

    window.setTimeout(() => ui.setter(original), ui.resetDelay);
  }

  function handleToday() {
    const today = currentDateInDashboardTZ();
    setActiveTab('overview');
    openDetail(today);
    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(`[data-date="${today}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState error={error} />;

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        onRefresh={() => handleRefresh(false)}
        onRefreshWithHealth={() => handleRefresh(true)}
        onToday={handleToday}
        loading={loading}
        refreshLabel={refreshLabel}
        refreshHealthLabel={refreshHealthLabel}
        weeklyCompletion={buildWeeklyCompletion(data)}
        generatedAt={
          data?.generatedAt ? `Data generated: ${new Date(data.generatedAt).toLocaleString()}` : ''
        }
      />
      <main className="mx-auto max-w-5xl px-4 pb-8">
        {data ? (
          <DashboardTabs
            activeTab={activeTab}
            data={data}
            onDateClick={openDetail}
            onCycleRecoveryStatus={cycleRecoveryStatus}
            onRefresh={refresh}
            setActiveTab={setActiveTab}
          />
        ) : null}
      </main>

      <DetailDialog
        date={detailDate}
        data={data}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onRefresh={refresh}
      />
    </div>
  );
}
