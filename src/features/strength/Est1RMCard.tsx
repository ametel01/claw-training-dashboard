import { Card, CardContent } from '@/components/ui/card'
import type { Est1RMRow, TrendPoint } from '@/types/dashboard'

interface Est1RMCardProps {
  row: Est1RMRow
}

export function Est1RMCard({ row }: Est1RMCardProps) {
  let trend: TrendPoint[] = []
  if (typeof row.trend_points === 'string') {
    try {
      trend = JSON.parse(row.trend_points) || []
    } catch {
      trend = []
    }
  } else if (Array.isArray(row.trend_points)) {
    trend = row.trend_points
  }
  const values = trend
    .slice()
    .reverse()
    .map((p) => Number(p.e1rm))
    .filter((v) => Number.isFinite(v))

  const delta4w = Number(row.delta_4w_kg || 0)
  const arrow = delta4w > 0 ? '↑' : delta4w < 0 ? '↓' : '→'
  const pctToNext = Math.max(0, Math.min(100, Number(row.progress_to_next_pct || 0)))

  const renderSparkline = () => {
    if (values.length < 2) return null
    const width = 200
    const height = 28
    const pad = 2
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = Math.max(1, max - min)
    const points = values
      .map(
        (v, i) =>
          `${(i * (width / (values.length - 1))).toFixed(1)},${(height - pad - ((v - min) / span) * (height - 2 * pad)).toFixed(1)}`
      )
      .join(' ')
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-7">
        <title>{row.lift} estimated one rep max trend</title>
        <polyline
          points={points}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            {row.lift}
          </p>
          <span className="font-mono text-xs text-primary">{row.est_1rm_kg} kg</span>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {row.strength_level} · {row.bw_ratio}x BW
          </p>
          <p className="text-xs font-mono text-muted-foreground">
            4w: {arrow} {Math.abs(delta4w).toFixed(1)} kg · Cycle:{' '}
            {Number(row.delta_cycle_kg || 0).toFixed(1)} kg
          </p>
        </div>
        {renderSparkline()}
        <p className="text-xs text-muted-foreground font-mono">
          {row.next_level !== '—'
            ? `Next: ${row.next_level} at ${row.next_level_kg} kg`
            : 'Top level reached'}{' '}
          · BW {row.bodyweight_kg} kg
        </p>
        <div className="relative h-1 bg-border rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-primary rounded-full"
            style={{ width: `${pctToNext}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          {pctToNext}% to next · from {row.source_weight_kg}×{row.source_reps} ({row.source_date})
        </p>
      </CardContent>
    </Card>
  )
}
