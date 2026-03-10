import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useRecoveryStatusActions } from '@/features/overview/hooks/useRecoveryStatusActions';
import { setStatus } from '@/hooks/useApi';

vi.mock('@/hooks/useApi', () => ({
  setStatus: vi.fn(),
}));

describe('useRecoveryStatusActions', () => {
  it('cycles the recovery status and refreshes the dashboard', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    vi.mocked(setStatus).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRecoveryStatusActions(refresh));

    await act(async () => {
      await result.current.cycleRecoveryStatus('2026-03-10', 'green');
    });

    expect(setStatus).toHaveBeenCalledWith('2026-03-10', 'yellow');
    expect(refresh).toHaveBeenCalledWith();
  });

  it('reports errors when the API call fails', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const error = new Error('request failed');
    vi.mocked(setStatus).mockRejectedValue(error);

    const { result } = renderHook(() => useRecoveryStatusActions(refresh));

    await act(async () => {
      await result.current.cycleRecoveryStatus('2026-03-10', 'red');
    });

    expect(globalThis.reportError).toHaveBeenCalledWith(error);
    expect(refresh).not.toHaveBeenCalled();
  });
});
