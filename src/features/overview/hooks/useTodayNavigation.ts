import { useEffect, useRef } from 'react';
import { DEFAULT_DASHBOARD_TAB, type TabValue } from '@/features/navigation/lib/dashboardTabs';
import { scrollToSessionDate } from '@/features/overview/lib/scrollToSessionDate';
import { currentDateInDashboardTZ } from '@/lib/time';

interface UseTodayNavigationOptions {
  openDetail: (date: string) => void;
  setActiveTab: (value: TabValue) => void;
}

export function useTodayNavigation({ openDetail, setActiveTab }: UseTodayNavigationOptions) {
  const scrollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current != null) {
        window.clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  function goToToday() {
    const today = currentDateInDashboardTZ();

    setActiveTab(DEFAULT_DASHBOARD_TAB);
    openDetail(today);

    if (scrollTimerRef.current != null) {
      window.clearTimeout(scrollTimerRef.current);
    }

    scrollTimerRef.current = window.setTimeout(() => {
      scrollToSessionDate(today);
      scrollTimerRef.current = null;
    }, 0);
  }

  return { goToToday };
}
