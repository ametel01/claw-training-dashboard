import { TodayGlance } from '@/features/overview/TodayGlance';
import { WeekHeaderBanner } from '@/features/overview/WeekHeaderBanner';
import type { DashboardData } from '@/types/dashboard';

interface DashboardOverviewHeaderProps {
  data: DashboardData;
  onStartSession: (date: string) => void;
}

export function DashboardOverviewHeader({ data, onStartSession }: DashboardOverviewHeaderProps) {
  return (
    <div className="flex flex-col gap-4 pt-4">
      <WeekHeaderBanner weekHeader={data.weekHeader} />
      <TodayGlance
        tiles={data.dailyTiles || []}
        details={data.details || {}}
        onStartSession={onStartSession}
      />
    </div>
  );
}
