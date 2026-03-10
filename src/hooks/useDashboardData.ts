import { useState, useEffect, useCallback } from 'react';
import type { DashboardData } from '@/types/dashboard';

export type DashboardRefresh = (includeHealth?: boolean) => Promise<void>;

export interface UseDashboardDataResult {
  data: DashboardData | null;
  error: string | null;
  loading: boolean;
  refresh: DashboardRefresh;
}

export function useDashboardData(): UseDashboardDataResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/data.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load data');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh: DashboardRefresh = useCallback(
    async (includeHealth = false) => {
      setLoading(true);
      try {
        // biome-ignore lint/security/noSecrets: query param, not a secret
        const endpoint = includeHealth ? '/api/refresh?includeHealth=1' : '/api/refresh';
        const response = await fetch(endpoint, {
          method: 'POST',
        });
        if (!response.ok) {
          throw new Error('Refresh failed');
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Refresh failed');
        setLoading(false);
        throw e;
      }
    },
    [load],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refresh };
}
