import type { WeekHeader } from '@/types/dashboard'

interface WeekHeaderBannerProps {
  weekHeader: WeekHeader | null
}

function clampPct(value: number) {
  return Math.max(0, Math.min(100, Number(value) || 0))
}

function pctHue(value: number) {
  const pct = clampPct(value)
  const scaled = Math.max(0, Math.min(1, (pct - 60) / 40))
  return 120 - 120 * scaled
}

function barFill(value: number) {
  const hue = pctHue(value)
  const c1 = `hsl(${hue.toFixed(0)} 85% 66%)`
  const c2 = `hsl(${hue.toFixed(0)} 80% 52%)`
  const c3 = `hsl(${hue.toFixed(0)} 88% 42%)`
  return `linear-gradient(90deg, ${c1} 0%, ${c2} 55%, ${c3} 100%)`
}

export function WeekHeaderBanner({ weekHeader }: WeekHeaderBannerProps) {
  if (!weekHeader) return null

  const mainNumbers = String(weekHeader.main_pct || '')
    .split('/')
    .map((value) => Number(String(value).replace('%', '')))
    .filter((value) => Number.isFinite(value))
  const supplementalNumber = Number(String(weekHeader.supp_pct || '').replace('%', ''))

  return (
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Current Block</p>
          <p className="font-display text-2xl font-bold text-primary">
            5/3/1 · {weekHeader.block_type} · Week {weekHeader.week_in_block}
          </p>
          <p className="mt-1 text-xs font-mono text-muted-foreground">
            Main: {weekHeader.main_pct} · Supplemental: {weekHeader.supp_pct}
          </p>
        </div>
        {weekHeader.deload_code && (
          <span className="inline-flex w-fit rounded-full border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-3 py-1 text-xs font-medium text-[var(--warn)]">
            Deload: {weekHeader.deload_name || weekHeader.deload_code}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {mainNumbers.map((value, index) => (
          <div key={`main-${index}-${value}`} className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-border/60">
              <div
                className="h-full rounded-full"
                style={{ width: `${clampPct(value)}%`, background: barFill(value) }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{value}%</p>
          </div>
        ))}
        {Number.isFinite(supplementalNumber) && (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-border/60">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${clampPct(supplementalNumber)}%`,
                  background: barFill(supplementalNumber)
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Supp {supplementalNumber}%</p>
          </div>
        )}
      </div>
    </section>
  )
}
