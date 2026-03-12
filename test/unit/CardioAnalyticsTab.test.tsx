import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardioAnalyticsTab } from '@/features/cardio/CardioAnalyticsTab';
import { createDashboardDataFixture } from '../fixtures/dashboardData';

describe('CardioAnalyticsTab', () => {
  it('renders separate raw-data tables for Z2 and VO2 sessions', () => {
    const data = createDashboardDataFixture();
    data.details.cardioByDate = {
      '2026-03-10': [
        {
          id: 16,
          session_date: '2026-03-10',
          slot: 'CARDIO',
          protocol: 'Z2',
          duration_min: 30,
          avg_hr: 119,
          max_hr: 130,
          avg_speed_kmh: 8.2,
          z2_cap_respected: 0,
          notes: 'Restored from Garmin TCX',
          created_at: '2026-03-09 23:56:38',
        },
      ],
      '2026-03-09': [
        {
          id: 17,
          session_date: '2026-03-09',
          slot: 'CARDIO',
          protocol: 'Z2',
          duration_min: 31,
          avg_hr: 117,
          max_hr: 128,
          avg_speed_kmh: 6.5,
          z2_cap_respected: 1,
          notes: 'Imported from TCX',
          created_at: '2026-03-09 07:41:09',
        },
      ],
      '2026-03-07': [
        {
          id: 14,
          session_date: '2026-03-07',
          slot: 'CARDIO',
          protocol: 'VO2_1min',
          duration_min: 35,
          avg_hr: 148,
          max_hr: undefined,
          avg_speed_kmh: 15,
          z2_cap_respected: null,
          notes: 'Cardio done from dashboard',
          created_at: '2026-03-07 07:17:14',
        },
      ],
    };

    render(<CardioAnalyticsTab data={data} />);

    const z2Table = screen.getByRole('table', { name: 'Z2 raw cardio session data' });
    const vo2Table = screen.getByRole('table', { name: 'VO2 max raw cardio session data' });

    expect(
      within(z2Table).getByRole('columnheader', { name: 'Avg Speed (km/h)' }),
    ).toBeInTheDocument();
    expect(
      within(z2Table).queryByRole('columnheader', { name: 'Protocol' }),
    ).not.toBeInTheDocument();
    expect(
      within(z2Table).queryByRole('columnheader', { name: 'created_at' }),
    ).not.toBeInTheDocument();
    expect(within(z2Table).queryByRole('columnheader', { name: 'id' })).not.toBeInTheDocument();
    expect(within(z2Table).queryByRole('columnheader', { name: 'slot' })).not.toBeInTheDocument();
    expect(within(z2Table).getByText('8.2')).toBeInTheDocument();
    expect(within(z2Table).getAllByText('from TCX')).toHaveLength(2);
    expect(within(z2Table).queryByText('2026-03-07')).not.toBeInTheDocument();

    expect(within(vo2Table).getByText('2026-03-07')).toBeInTheDocument();
    expect(within(vo2Table).getByRole('columnheader', { name: 'Protocol' })).toBeInTheDocument();
    expect(within(vo2Table).getByText('VO2_1min')).toBeInTheDocument();
    expect(within(vo2Table).getByText('15')).toBeInTheDocument();
    expect(within(vo2Table).getByText('from dashboard')).toBeInTheDocument();
    expect(within(vo2Table).queryByRole('columnheader', { name: 'id' })).not.toBeInTheDocument();
    expect(within(vo2Table).queryByRole('columnheader', { name: 'slot' })).not.toBeInTheDocument();
  });
});
