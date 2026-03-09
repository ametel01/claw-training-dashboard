import type { DashboardData, Details, WeekProgressRow } from '@/types/dashboard';

interface WeekRowCounts {
  done: number;
  planned: number;
}

export function getWeekRowCounts(row: WeekProgressRow, details: Details): WeekRowCounts {
  const barbellRows = details.barbellByDate?.[row.session_date] || [];
  const hasMain = barbellRows.some((value) => value.category === 'main');
  const hasSupplemental = barbellRows.some((value) => value.category === 'supplemental');

  return {
    done:
      (hasMain ? 1 : 0) +
      (hasSupplemental ? 1 : 0) +
      (row.cardio_done ? 1 : 0) +
      (row.rings_done ? 1 : 0),
    planned:
      (row.main_lift ? 2 : 0) +
      (row.cardio_plan && row.cardio_plan !== 'OFF' ? 1 : 0) +
      (row.rings_plan ? 1 : 0),
  };
}

export function formatWeeklyCompletionSummary(data: DashboardData | null | undefined) {
  if (!data) return 'Week: --';

  const totals = data.weekProgress.reduce(
    (accumulator, row) => {
      const counts = getWeekRowCounts(row, data.details);

      return {
        done: accumulator.done + counts.done,
        planned: accumulator.planned + counts.planned,
      };
    },
    { done: 0, planned: 0 },
  );

  const pct = totals.planned ? Math.round((totals.done / totals.planned) * 100) : 0;
  return `Week: ${totals.done}/${totals.planned} (${pct}%)`;
}
