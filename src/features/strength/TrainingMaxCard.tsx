import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateTM, updateTMDelta } from '@/hooks/useApi'
import type { TMRow } from '@/types/dashboard'

interface TrainingMaxCardProps {
  tm: TMRow
  onRefresh: () => void
}

export function TrainingMaxCard({ tm, onRefresh }: TrainingMaxCardProps) {
  const [customVal, setCustomVal] = useState('')
  const [loading, setLoading] = useState(false)

  async function adjustDelta(delta: number) {
    setLoading(true)
    try {
      await updateTMDelta(tm.lift, delta)
      onRefresh()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function setExact() {
    const val = parseFloat(customVal)
    if (Number.isNaN(val) || val <= 0) return
    setLoading(true)
    try {
      await updateTM(tm.lift, val)
      setCustomVal('')
      onRefresh()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            {tm.lift}
          </p>
          {tm.effective_date && (
            <span className="font-mono text-xs text-muted-foreground">{tm.effective_date}</span>
          )}
        </div>
        <p className="font-display text-3xl font-bold text-primary">
          {Number(tm.tm_kg).toFixed(1)} <span className="text-sm text-muted-foreground">kg</span>
        </p>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => adjustDelta(-2.5)}
            className="flex-1 text-xs h-7"
          >
            −2.5
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => adjustDelta(2.5)}
            className="flex-1 text-xs h-7"
          >
            +2.5
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => adjustDelta(5)}
            className="flex-1 text-xs h-7"
          >
            +5
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            step="0.5"
            placeholder="Set exact kg"
            value={customVal}
            onChange={(e) => setCustomVal(e.target.value)}
            className="h-8 text-xs"
          />
          <Button size="sm" disabled={loading} onClick={setExact} className="h-8 text-xs px-3">
            Set
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
