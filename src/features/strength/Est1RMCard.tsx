import { Card, CardContent } from '@/components/ui/card';
import type { Est1RMRow, TrendPoint } from '@/types/dashboard';

interface Est1RMCardProps {
  row: Est1RMRow;
}

function parseTrendPoints(value: Est1RMRow['trend_points']): TrendPoint[] {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) || [];
    } catch {
      return [];
    }
  }

  return Array.isArray(value) ? value : [];
}

function getTrendArrow(delta: number) {
  if (delta > 0) return '↑';
  if (delta < 0) return '↓';
  return '→';
}

function renderSparkline(values: number[], lift: string) {
  if (values.length < 2) return null;

  const width = 200;
  const height = 28;
  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values
    .map(
      (value, index) =>
        `${(index * (width / (values.length - 1))).toFixed(1)},${(height - pad - ((value - min) / span) * (height - 2 * pad)).toFixed(1)}`,
    )
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-full">
      <title>{lift} estimated one rep max trend</title>
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Est1RMCard({ row }: Est1RMCardProps) {
  const values = parseTrendPoints(row.trend_points)
    .slice()
    .reverse()
    .map((point) => Number(point.e1rm))
    .filter((value) => Number.isFinite(value));
  const delta4w = Number(row.delta_4w_kg || 0);
  const pctToNext = Math.max(0, Math.min(100, Number(row.progress_to_next_pct || 0)));

  return (
    <Card className="border-border/50">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {row.lift}
          </p>
          <span className="font-mono text-xs text-primary">{row.est_1rm_kg} kg</span>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {row.strength_level} · {row.bw_ratio}x BW
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            4w: {getTrendArrow(delta4w)} {Math.abs(delta4w).toFixed(1)} kg · Cycle:{' '}
            {Number(row.delta_cycle_kg || 0).toFixed(1)} kg
          </p>
        </div>
        {renderSparkline(values, row.lift)}
        <p className="font-mono text-xs text-muted-foreground">
          {row.next_level !== '—'
            ? `Next: ${row.next_level} at ${row.next_level_kg} kg`
            : 'Top level reached'}{' '}
          · BW {row.bodyweight_kg} kg
        </p>
        <div className="relative h-1 overflow-hidden rounded-full bg-border">
          <div
            className="absolute h-full rounded-full bg-primary"
            style={{ width: `${pctToNext}%` }}
          />
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {pctToNext}% to next · from {row.source_weight_kg}×{row.source_reps} ({row.source_date})
        </p>
      </CardContent>
    </Card>
  );
}
