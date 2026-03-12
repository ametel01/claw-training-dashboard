import { CardioTab } from '@/features/cardio/CardioTab';
import { CardioAnalyticsTab } from '@/features/cardio/CardioAnalyticsTab';
import { LogsTab } from '@/features/logs/LogsTab';
import { OverviewTab } from '@/features/overview/OverviewTab';
import { StrengthTab } from '@/features/strength/StrengthTab';
import { UploadsTab } from '@/features/uploads/UploadsTab';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
      className="flex flex-col gap-2"
      onValueChange={(value) => {
        if (isDashboardTab(value)) {
          onTabChange(value);
        }
      }}
    >
      <div className="my-3 sm:hidden">
        <Select
          value={activeTab}
          onValueChange={(value) => {
            if (isDashboardTab(value)) {
              onTabChange(value);
            }
          }}
        >
          <SelectTrigger className="h-11 border-border/30 bg-muted/30 text-sm">
            <SelectValue placeholder="Select section" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {DASHBOARD_TABS.map((tab) => (
                <SelectItem key={tab.value} value={tab.value}>
                  {tab.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <TabsList className="hidden h-auto w-full flex-wrap justify-start gap-1 rounded-2xl border border-border/30 bg-muted/30 p-1 sm:my-4 sm:flex">
        {DASHBOARD_TABS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="min-h-10 rounded-xl px-4 py-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
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
      <TabsContent value="cardio-analytics">
        <CardioAnalyticsTab data={data} />
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
