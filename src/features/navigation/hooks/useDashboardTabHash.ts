import { useEffect, useState } from 'react';
import {
  DEFAULT_DASHBOARD_TAB,
  isDashboardTab,
  type TabValue,
} from '@/features/navigation/lib/dashboardTabs';

const TAB_HASH_PREFIX = '#tab-';

function getTabFromHash(hash: string): TabValue {
  const value = hash.replace(TAB_HASH_PREFIX, '');
  return isDashboardTab(value) ? value : DEFAULT_DASHBOARD_TAB;
}

export function useDashboardTabHash() {
  const [activeTab, setActiveTab] = useState<TabValue>(() => {
    if (typeof window === 'undefined') return DEFAULT_DASHBOARD_TAB;
    return getTabFromHash(window.location.hash);
  });

  useEffect(() => {
    function syncTabFromHash() {
      setActiveTab(getTabFromHash(window.location.hash));
    }

    window.addEventListener('hashchange', syncTabFromHash);
    return () => window.removeEventListener('hashchange', syncTabFromHash);
  }, []);

  useEffect(() => {
    const nextHash = `${TAB_HASH_PREFIX}${activeTab}`;

    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }, [activeTab]);

  return { activeTab, setActiveTab };
}
