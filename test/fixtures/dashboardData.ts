import type { DashboardData } from '@/types/dashboard';

export function createDashboardDataFixture(): DashboardData {
  return {
    generatedAt: '2026-03-10T08:00:00.000Z',
    weekHeader: {
      block_type: 'Leader',
      week_in_block: 2,
      main_pct: '70/80/90',
      supp_pct: '70%',
    },
    dailyTiles: [
      {
        session_date: '2026-03-10',
        day_name: 'Tuesday',
        pain_level: 'green',
        planned_barbell_main: 'Bench',
        planned_barbell_supp: 'Press',
        planned_cardio: 'Z2',
        planned_rings: 'A',
        has_cardio: 0,
        has_rings: 0,
      },
    ],
    weekProgress: [
      {
        session_date: '2026-03-10',
        day_name: 'Tuesday',
        main_lift: 'Bench',
        cardio_plan: 'Z2',
        rings_plan: 'A',
        barbell_done: 0,
        cardio_done: 0,
        rings_done: 0,
        pain_level: 'green',
      },
    ],
    totals: {
      barbell_sessions: 1,
      cardio_sessions: 2,
      rings_sessions: 0,
      total_training_days: 3,
      active_days_last_14: 5,
    },
    details: {
      barbellByDate: {},
      cardioByDate: {},
      ringsByDate: {},
      plannedBarbellByDate: {
        '2026-03-10': [
          {
            session_date: '2026-03-10',
            lift: 'Bench',
            category: 'main',
            set_no: 1,
            planned_weight_kg: 60,
            prescribed_reps: 5,
            prescribed_pct: 0.65,
          },
        ],
      },
      plannedCardioByDate: {
        '2026-03-10': [
          {
            session_date: '2026-03-10',
            session_type: 'Z2',
            duration_min: 40,
          },
        ],
      },
      plannedRingsByDate: {
        '2026-03-10': [
          {
            session_date: '2026-03-10',
            template_code: 'A',
            item_no: 1,
            exercise: 'Rows',
            sets_text: '5',
            reps_or_time: '6',
          },
        ],
      },
    },
    cycleControl: {
      latestBlock: {
        block_no: 2,
        block_type: 'Leader',
        start_date: '2026-03-03',
      },
      activeDeload: null,
      profiles: [
        {
          code: 'WEEK7_LIGHT',
          name: '7th Week Deload',
          default_days: 7,
        },
      ],
      recentEvents: [],
      currentTM: [
        {
          lift: 'Bench',
          tm_kg: 90,
          effective_date: '2026-03-03',
        },
      ],
    },
    est1RM: [],
    currentCyclePlan: [],
    cardioAnalytics: {
      total_z2: 0,
      z2_in_cap: 0,
      z2_compliance_pct: 0,
      z2_points: [],
      z2_scatter_points: [],
      z2_efficiency_points: [],
      z2_decoupling_points: [],
      vo2_points: [],
    },
    auditLog: [],
    aerobicTests: [],
  };
}
