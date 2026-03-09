import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopBarProps {
  onRefresh: () => void
  onRefreshWithHealth: () => void
  onToday: () => void
  loading: boolean
  refreshLabel: string
  refreshHealthLabel: string
  weeklyCompletion: string
  generatedAt: string
}

export function TopBar({
  onRefresh,
  onRefreshWithHealth,
  onToday,
  loading,
  refreshLabel,
  refreshHealthLabel,
  weeklyCompletion,
  generatedAt
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary tracking-tight">CLAW</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            Training Dashboard
          </p>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={onRefresh}
              className="border-border/50 text-xs"
            >
              <RefreshCw className={cn('h-3 w-3 mr-1', loading && 'animate-spin')} />
              {refreshLabel}
            </Button>
            <Button size="sm" disabled={loading} onClick={onRefreshWithHealth} className="text-xs">
              {refreshHealthLabel}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={onToday}
              className="text-xs"
            >
              Today
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-full border border-border/50 bg-muted/30 px-3 py-1 font-mono text-foreground">
              {weeklyCompletion}
            </span>
            <p className="text-muted-foreground">{generatedAt}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
