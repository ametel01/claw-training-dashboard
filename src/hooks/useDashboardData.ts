import { useState, useEffect, useCallback } from 'react';
import type { DashboardData } from '@/types/dashboard';

export function useDashboardData() {
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

  const refresh = useCallback(
    async (includeHealth = false) => {
      setLoading(true);
      try {
        await fetch(`/api/refresh${includeHealth ? '?includeHealth=1' : ''}`, { method: 'POST' });
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
