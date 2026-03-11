import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateTM, updateTMDelta } from '@/hooks/useApi';
import type { TMRow } from '@/types/dashboard';

interface TrainingMaxCardProps {
  tm: TMRow;
  onRefresh: () => void;
}

export function TrainingMaxCard({ tm, onRefresh }: TrainingMaxCardProps) {
  const [customVal, setCustomVal] = useState('');
  const [loading, setLoading] = useState(false);

  async function adjustDelta(delta: number) {
    setLoading(true);
    try {
      await updateTMDelta(tm.lift, delta);
      onRefresh();
    } catch {
      // Keep the control responsive if the update fails.
    } finally {
      setLoading(false);
    }
  }

  async function setExact() {
    const val = Number.parseFloat(customVal);
    if (Number.isNaN(val) || val <= 0) return;
    setLoading(true);
    try {
      await updateTM(tm.lift, val);
      setCustomVal('');
      onRefresh();
    } catch {
      // Keep the control responsive if the update fails.
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-border/50">
      <CardContent className="flex flex-col gap-3 p-4">
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
        <div className="grid grid-cols-3 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => adjustDelta(-2.5)}
            className="text-xs"
          >
            −2.5
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => adjustDelta(2.5)}
            className="text-xs"
          >
            +2.5
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => adjustDelta(5)}
            className="text-xs"
          >
            +5
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="number"
            step="0.5"
            placeholder="Set exact kg"
            value={customVal}
            onChange={(e) => setCustomVal(e.target.value)}
            className="h-10 text-sm"
          />
          <Button size="sm" disabled={loading} onClick={setExact} className="text-xs sm:px-3">
            Set
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
