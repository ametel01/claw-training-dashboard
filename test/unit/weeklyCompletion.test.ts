import { describe, expect, it } from 'vitest';
import { formatWeeklyCompletionSummary, getWeekRowCounts } from '@/features/overview/lib/weeklyCompletion';
import { createDashboardDataFixture } from '../fixtures/dashboardData';

describe('weeklyCompletion', () => {
  it('counts planned and completed work per row', () => {
    const data = createDashboardDataFixture();
    data.details.barbellByDate = {
      '2026-03-10': [
        {
          session_date: '2026-03-10',
          lift: 'Bench',
          category: 'main',
        },
        {
          session_date: '2026-03-10',
          lift: 'Press',
          category: 'supplemental',
        },
      ],
    };

    const counts = getWeekRowCounts(data.weekProgress[0], data.details);

    expect(counts).toEqual({ done: 2, planned: 4 });
  });

  it('formats the weekly completion summary', () => {
    const data = createDashboardDataFixture();
    data.details.barbellByDate = {
      '2026-03-10': [
        {
          session_date: '2026-03-10',
          lift: 'Bench',
          category: 'main',
        },
      ],
    };
    data.weekProgress[0].cardio_done = 1;

    expect(formatWeeklyCompletionSummary(data)).toBe('Week: 2/4 (50%)');
  });

  it('returns a placeholder when no data is present', () => {
    expect(formatWeeklyCompletionSummary(null)).toBe('Week: --');
  });
});
