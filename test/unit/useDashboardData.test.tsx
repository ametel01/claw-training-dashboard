import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDashboardData } from '@/hooks/useDashboardData';
import { createDashboardDataFixture } from '../fixtures/dashboardData';

describe('useDashboardData', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads dashboard data on mount', async () => {
    const data = createDashboardDataFixture();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(data), { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual(data);
    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/data.json', { cache: 'no-store' });
  });

  it('captures load failures', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('boom', { status: 500 }));

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Failed to load data');
  });

  it('refreshes data after a successful mutation call', async () => {
    const initial = createDashboardDataFixture();
    const refreshed = {
      ...createDashboardDataFixture(),
      generatedAt: '2026-03-10T09:00:00.000Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(initial), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(refreshed), { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.data?.generatedAt).toBe(initial.generatedAt));

    await act(async () => {
      await result.current.refresh(true);
    });

    await waitFor(() => expect(result.current.data?.generatedAt).toBe(refreshed.generatedAt));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/refresh?includeHealth=1', {
      method: 'POST',
    });
  });

  it('fails refresh when the mutation endpoint returns a non-success status', async () => {
    const initial = createDashboardDataFixture();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(initial), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 500 }));

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.data).not.toBeNull());

    await act(async () => {
      await expect(result.current.refresh()).rejects.toThrow('Refresh failed');
    });
    await waitFor(() => expect(result.current.error).toBe('Refresh failed'));
  });
});
