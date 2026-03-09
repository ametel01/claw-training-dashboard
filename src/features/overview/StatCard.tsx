import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  accent?: boolean;
}

export function StatCard({ label, value, unit, trend, accent }: StatCardProps) {
  return (
    <Card
      className={cn(
        'border-border/50',
        accent && 'border-primary/30 shadow-[0_0_12px_hsl(var(--primary)/0.15)]',
      )}
    >
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
          {label}
        </p>
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              'font-display text-3xl font-bold',
              accent ? 'text-primary' : 'text-foreground',
            )}
          >
            {value}
          </span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
        {trend !== undefined && (
          <p
            className={cn('text-xs mt-1', trend >= 0 ? 'text-[var(--ok)]' : 'text-[var(--danger)]')}
          >
            {trend >= 0 ? '+' : ''}
            {trend}% vs last week
          </p>
        )}
      </CardContent>
    </Card>
  );
}
