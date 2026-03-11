import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopBarProps {
  onRefresh: () => void;
  onRefreshWithHealth: () => void;
  onToday: () => void;
  loading: boolean;
  refreshLabel: string;
  refreshHealthLabel: string;
  weeklyCompletion: string;
  generatedAt: string;
}

export function TopBar({
  onRefresh,
  onRefreshWithHealth,
  onToday,
  loading,
  refreshLabel,
  refreshHealthLabel,
  weeklyCompletion,
  generatedAt,
}: TopBarProps) {
  const [showMeta, setShowMeta] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 lg:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-primary">CLAW</h1>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Training Dashboard
            </p>
            {generatedAt ? (
              <p className="mt-1 text-[11px] text-muted-foreground sm:hidden">{generatedAt}</p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMeta((open) => !open)}
            className="shrink-0 text-xs sm:hidden"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', showMeta && 'rotate-180')} />
            Status
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Button
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={onToday}
            className="w-full text-xs sm:w-auto"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={onRefresh}
            className="w-full border-border/50 text-xs sm:w-auto"
          >
            <RefreshCw className={cn('mr-1 h-3 w-3', loading && 'animate-spin')} />
            {refreshLabel}
          </Button>
        </div>

        <div
          className={cn(
            'hidden flex-col gap-3 rounded-2xl border border-border/40 bg-muted/20 p-3 sm:flex sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:p-0',
            showMeta && 'flex',
          )}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-border/50 bg-muted/30 px-3 py-1 font-mono text-foreground">
              {weeklyCompletion}
            </span>
            {generatedAt ? (
              <p className="hidden text-muted-foreground sm:block">{generatedAt}</p>
            ) : null}
          </div>
          <Button size="sm" disabled={loading} onClick={onRefreshWithHealth} className="text-xs">
            {refreshHealthLabel}
          </Button>
        </div>
      </div>
    </header>
  );
}
