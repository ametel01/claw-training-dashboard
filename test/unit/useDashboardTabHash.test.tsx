import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { useDashboardTabHash } from '@/features/navigation/hooks/useDashboardTabHash';

describe('useDashboardTabHash', () => {
  it('initializes from a valid hash', () => {
    window.history.replaceState(null, '', '#tab-strength');

    const { result } = renderHook(() => useDashboardTabHash());

    expect(result.current.activeTab).toBe('strength');
  });

  it('falls back to overview for invalid hashes', () => {
    window.history.replaceState(null, '', '#tab-invalid');

    const { result } = renderHook(() => useDashboardTabHash());

    expect(result.current.activeTab).toBe('overview');
  });

  it('updates the location hash when the tab changes', () => {
    window.history.replaceState(null, '', '#tab-overview');

    const { result } = renderHook(() => useDashboardTabHash());

    act(() => {
      result.current.setActiveTab('cardio');
    });

    expect(window.location.hash).toBe('#tab-cardio');
  });

  it('accepts cardio analytics as a valid tab hash', () => {
    window.history.replaceState(null, '', '#tab-cardio-analytics');

    const { result } = renderHook(() => useDashboardTabHash());

    expect(result.current.activeTab).toBe('cardio-analytics');
  });
});
