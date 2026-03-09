import { useEffect, useRef, useState } from 'react';
import type { DashboardRefresh } from '@/hooks/useDashboardData';

const REFRESH_LABEL_DEFAULT = 'Refresh from DB';
const REFRESH_HEALTH_LABEL_DEFAULT = 'Refresh + Health Import';

interface RefreshActionConfig {
  defaultLabel: string;
  failureLabel: string;
  loadingLabel: string;
  resetDelay: number;
  setLabel: (value: string) => void;
  successLabel: string;
}

export function useRefreshActions(refresh: DashboardRefresh) {
  const [refreshLabel, setRefreshLabel] = useState(REFRESH_LABEL_DEFAULT);
  const [refreshHealthLabel, setRefreshHealthLabel] = useState(REFRESH_HEALTH_LABEL_DEFAULT);
  const resetTimersRef = useRef<{ health?: number; standard?: number }>({});

  useEffect(() => {
    return () => {
      if (resetTimersRef.current.standard != null) {
        window.clearTimeout(resetTimersRef.current.standard);
      }

      if (resetTimersRef.current.health != null) {
        window.clearTimeout(resetTimersRef.current.health);
      }
    };
  }, []);

  function clearResetTimer(key: keyof typeof resetTimersRef.current) {
    const timer = resetTimersRef.current[key];

    if (timer != null) {
      window.clearTimeout(timer);
      delete resetTimersRef.current[key];
    }
  }

  function getConfig(
    includeHealth: boolean,
  ): [keyof typeof resetTimersRef.current, RefreshActionConfig] {
    if (includeHealth) {
      return [
        'health',
        {
          defaultLabel: REFRESH_HEALTH_LABEL_DEFAULT,
          failureLabel: 'Health refresh failed',
          loadingLabel: 'Importing health + refreshing...',
          resetDelay: 2200,
          setLabel: setRefreshHealthLabel,
          successLabel: 'Health + DB Updated ✓',
        },
      ];
    }

    return [
      'standard',
      {
        defaultLabel: REFRESH_LABEL_DEFAULT,
        failureLabel: 'Refresh failed',
        loadingLabel: 'Refreshing...',
        resetDelay: 1200,
        setLabel: setRefreshLabel,
        successLabel: 'Updated ✓',
      },
    ];
  }

  async function runRefresh(includeHealth = false) {
    const [timerKey, config] = getConfig(includeHealth);

    clearResetTimer(timerKey);
    config.setLabel(config.loadingLabel);

    try {
      await refresh(includeHealth);
      config.setLabel(config.successLabel);
    } catch {
      config.setLabel(config.failureLabel);
    }

    resetTimersRef.current[timerKey] = window.setTimeout(() => {
      config.setLabel(config.defaultLabel);
      delete resetTimersRef.current[timerKey];
    }, config.resetDelay);
  }

  return {
    refreshFromDb: () => runRefresh(false),
    refreshHealthLabel,
    refreshLabel,
    refreshWithHealth: () => runRefresh(true),
  };
}
