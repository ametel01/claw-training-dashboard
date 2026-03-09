import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { startCycle, applyDeload } from '@/hooks/useApi'
import type { CycleControl as CycleControlData } from '@/types/dashboard'

interface CycleControlProps {
  cycleControl: CycleControlData
  onRefresh: () => void
}

export function CycleControl({ cycleControl, onRefresh }: CycleControlProps) {
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [blockType, setBlockType] = useState('Leader')
  const [deloadCode, setDeloadCode] = useState(cycleControl.profiles?.[0]?.code || '')
  const [deloadStart, setDeloadStart] = useState('')
  const [deloadDays, setDeloadDays] = useState('7')

  const latest = cycleControl.latestBlock || {}
  const active = cycleControl.activeDeload || null
  const profiles = cycleControl.profiles || []
  const events = cycleControl.recentEvents || []

  async function handleNewCycle() {
    setLoading(true)
    try {
      await startCycle({ startDate, blockType })
      onRefresh()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeload() {
    setLoading(true)
    try {
      await applyDeload({
        deloadCode,
        startDate: deloadStart,
        durationDays: parseInt(deloadDays, 10) || 7
      })
      onRefresh()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
            Cycle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Current:{' '}
            <span className="text-foreground">
              #{latest.block_no || '—'} · {latest.block_type || '—'}
            </span>
          </p>
          {latest.start_date && (
            <p className="text-xs text-muted-foreground">
              Start: <span className="text-foreground">{latest.start_date}</span>
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 text-xs"
              placeholder="Start date"
            />
            <select
              value={blockType}
              onChange={(e) => setBlockType(e.target.value)}
              className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
            >
              <option value="Leader">Leader</option>
              <option value="Anchor">Anchor</option>
            </select>
            <Button disabled={loading} onClick={handleNewCycle} size="sm" className="h-8 text-xs">
              Start New Cycle
            </Button>
          </div>
          {events.length > 0 && (
            <div className="pt-2 border-t border-border/30">
              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-widest">
                Recent events
              </p>
              {events.slice(0, 5).map((ev) => (
                <p
                  key={`${ev.event_date}:${ev.event_type}:${ev.deload_code || ''}`}
                  className="text-xs font-mono text-muted-foreground"
                >
                  {ev.event_date} · {ev.event_type}
                  {ev.deload_code ? ` (${ev.deload_code})` : ''}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
            Deload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Active:{' '}
            <span className="text-foreground">
              {active
                ? `${active.name || active.deload_code} (${active.start_date} → ${active.end_date})`
                : 'none'}
            </span>
          </p>
          <div className="flex flex-col gap-2">
            <select
              value={deloadCode}
              onChange={(e) => setDeloadCode(e.target.value)}
              className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
            >
              {profiles.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={deloadStart}
              onChange={(e) => setDeloadStart(e.target.value)}
              className="h-8 text-xs"
            />
            <Input
              type="number"
              min={1}
              step={1}
              placeholder="Days (default 7)"
              value={deloadDays}
              onChange={(e) => setDeloadDays(e.target.value)}
              className="h-8 text-xs"
            />
            <Button
              disabled={loading}
              onClick={handleDeload}
              size="sm"
              variant="outline"
              className="h-8 text-xs"
            >
              Apply Deload
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
