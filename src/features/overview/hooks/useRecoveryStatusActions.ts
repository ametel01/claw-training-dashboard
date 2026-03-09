import { setStatus } from '@/hooks/useApi';
import type { DashboardRefresh } from '@/hooks/useDashboardData';

const RECOVERY_STATUS_ORDER = ['green', 'yellow', 'red'] as const;

export function useRecoveryStatusActions(refresh: DashboardRefresh) {
  async function cycleRecoveryStatus(date: string, currentStatus = 'green') {
    const nextStatus =
      RECOVERY_STATUS_ORDER[
        (RECOVERY_STATUS_ORDER.indexOf(currentStatus as (typeof RECOVERY_STATUS_ORDER)[number]) +
          1) %
          RECOVERY_STATUS_ORDER.length
      ];

    try {
      await setStatus(date, nextStatus);
      await refresh();
    } catch (error) {
      reportError(error);
    }
  }

  return { cycleRecoveryStatus };
}
