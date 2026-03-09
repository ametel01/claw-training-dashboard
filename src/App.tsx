import { TopBar } from '@/components/layout/TopBar';
import { ErrorScreen } from '@/components/states/ErrorScreen';
import { LoadingScreen } from '@/components/states/LoadingScreen';
import { DetailDialog } from '@/features/details/DetailDialog';
import { useDetailDialogState } from '@/features/details/hooks/useDetailDialogState';
import { DashboardTabs } from '@/features/navigation/components/DashboardTabs';
import { useDashboardTabHash } from '@/features/navigation/hooks/useDashboardTabHash';
import { DashboardOverviewHeader } from '@/features/overview/components/DashboardOverviewHeader';
import { useRecoveryStatusActions } from '@/features/overview/hooks/useRecoveryStatusActions';
import { useTodayNavigation } from '@/features/overview/hooks/useTodayNavigation';
import { formatWeeklyCompletionSummary } from '@/features/overview/lib/weeklyCompletion';
import { useRefreshActions } from '@/features/refresh/hooks/useRefreshActions';
import { useDashboardData } from '@/hooks/useDashboardData';

export default function App() {
  const { data, loading, error, refresh } = useDashboardData();
  const { activeTab, setActiveTab } = useDashboardTabHash();
  const detailDialog = useDetailDialogState();
  const refreshActions = useRefreshActions(refresh);
  const { cycleRecoveryStatus } = useRecoveryStatusActions(refresh);
  const { goToToday } = useTodayNavigation({
    openDetail: detailDialog.openForDate,
    setActiveTab,
  });

  if (loading && !data) return <LoadingScreen />;
  if (error && !data) return <ErrorScreen error={error} />;

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        onRefresh={refreshActions.refreshFromDb}
        onRefreshWithHealth={refreshActions.refreshWithHealth}
        onToday={goToToday}
        loading={loading}
        refreshLabel={refreshActions.refreshLabel}
        refreshHealthLabel={refreshActions.refreshHealthLabel}
        weeklyCompletion={formatWeeklyCompletionSummary(data)}
        generatedAt={
          data?.generatedAt ? `Data generated: ${new Date(data.generatedAt).toLocaleString()}` : ''
        }
      />
      <main className="mx-auto max-w-5xl px-4 pb-8">
        {data ? (
          <>
            <DashboardOverviewHeader data={data} onStartSession={detailDialog.openForDate} />
            <DashboardTabs
              activeTab={activeTab}
              data={data}
              onDateClick={detailDialog.openForDate}
              onCycleRecoveryStatus={cycleRecoveryStatus}
              onRefresh={refresh}
              onTabChange={setActiveTab}
            />
          </>
        ) : null}
      </main>

      <DetailDialog
        date={detailDialog.detailDate}
        data={data}
        open={detailDialog.detailOpen}
        onClose={detailDialog.closeDetail}
        onRefresh={refresh}
      />
    </div>
  );
}
