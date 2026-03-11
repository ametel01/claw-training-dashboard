import { useState, useEffect, useCallback } from 'react';
import type { DashboardData } from '@/types/dashboard';

export type DashboardRefresh = (includeHealth?: boolean) => Promise<void>;

export interface UseDashboardDataResult {
  data: DashboardData | null;
  error: string | null;
  loading: boolean;
  refresh: DashboardRefresh;
}

function assertDashboardJsonResponse(res: Response) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error(
      'Expected dashboard JSON but received a non-JSON response. Ensure the backend is running on http://127.0.0.1:8080.',
    );
  }
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
      assertDashboardJsonResponse(res);
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
