import { CardioTab } from '@/features/cardio/CardioTab';
import { LogsTab } from '@/features/logs/LogsTab';
import { OverviewTab } from '@/features/overview/OverviewTab';
import { StrengthTab } from '@/features/strength/StrengthTab';
import { UploadsTab } from '@/features/uploads/UploadsTab';
import {
  DASHBOARD_TABS,
  isDashboardTab,
  type TabValue,
} from '@/features/navigation/lib/dashboardTabs';
import type { DashboardRefresh } from '@/hooks/useDashboardData';
import type { DashboardData } from '@/types/dashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DashboardTabsProps {
  activeTab: TabValue;
  data: DashboardData;
  onCycleRecoveryStatus: (date: string, currentStatus?: string) => void;
  onDateClick: (date: string) => void;
  onRefresh: DashboardRefresh;
  onTabChange: (value: TabValue) => void;
}

export function DashboardTabs({
  activeTab,
  data,
  onCycleRecoveryStatus,
  onDateClick,
  onRefresh,
  onTabChange,
}: DashboardTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        if (isDashboardTab(value)) {
          onTabChange(value);
        }
      }}
    >
      <TabsList className="my-4 w-full justify-start border border-border/30 bg-muted/30">
        {DASHBOARD_TABS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {tab.label}
          </TabsTrigger>
        ))}
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
  );
}
