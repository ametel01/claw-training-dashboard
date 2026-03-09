export const DASHBOARD_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'uploads', label: 'Uploads' },
  { value: 'logs', label: 'Logs & History' },
] as const;

export const DEFAULT_DASHBOARD_TAB = 'overview';

export type TabValue = (typeof DASHBOARD_TABS)[number]['value'];

export function isDashboardTab(value: string): value is TabValue {
  return DASHBOARD_TABS.some((tab) => tab.value === value);
}
