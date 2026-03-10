import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useRefreshActions } from '@/features/refresh/hooks/useRefreshActions';

describe('useRefreshActions', () => {
  it('shows a success label and resets it after refresh', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useRefreshActions(refresh));

    await act(async () => {
      await result.current.refreshFromDb();
    });

    expect(refresh).toHaveBeenCalledWith(false);
    expect(result.current.refreshLabel).toBe('Updated ✓');

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    expect(result.current.refreshLabel).toBe('Refresh from DB');
  });

  it('shows a failure label and resets it after a rejected refresh', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useRefreshActions(refresh));

    await act(async () => {
      await result.current.refreshWithHealth();
    });

    expect(refresh).toHaveBeenCalledWith(true);
    expect(result.current.refreshHealthLabel).toBe('Health refresh failed');

    await act(async () => {
      vi.advanceTimersByTime(2200);
    });

    expect(result.current.refreshHealthLabel).toBe('Refresh + Health Import');
  });
});
