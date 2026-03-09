import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { applyDeload, startCycle } from '@/hooks/useApi';
import type { CycleControl as CycleControlData } from '@/types/dashboard';

interface CycleControlProps {
  cycleControl: CycleControlData;
  onRefresh: () => void;
}

async function runCycleControlAction(action: () => Promise<void>, onRefresh: () => void) {
  await action();
  onRefresh();
}

function getActiveDeloadText(active: CycleControlData['activeDeload']) {
  if (!active) return 'none';
  return `${active.name || active.deload_code} (${active.start_date} → ${active.end_date})`;
}

export function CycleControl({ cycleControl, onRefresh }: CycleControlProps) {
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [blockType, setBlockType] = useState('Leader');
  const [deloadCode, setDeloadCode] = useState(cycleControl.profiles?.[0]?.code || '');
  const [deloadStart, setDeloadStart] = useState('');
  const [deloadDays, setDeloadDays] = useState('7');

  const latest = cycleControl.latestBlock || {};
  const active = cycleControl.activeDeload || null;
  const profiles = cycleControl.profiles || [];
  const events = cycleControl.recentEvents || [];

  async function handleNewCycle() {
    setLoading(true);
    try {
      await runCycleControlAction(() => startCycle({ startDate, blockType }), onRefresh);
    } catch {
      // Leave the controls usable if the request fails.
    } finally {
      setLoading(false);
    }
  }

  async function handleDeload() {
    setLoading(true);
    try {
      await runCycleControlAction(
        () =>
          applyDeload({
            deloadCode,
            startDate: deloadStart,
            durationDays: Number.parseInt(deloadDays, 10) || 7,
          }),
        onRefresh,
      );
    } catch {
      // Leave the controls usable if the request fails.
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
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
          {latest.start_date ? (
            <p className="text-xs text-muted-foreground">
              Start: <span className="text-foreground">{latest.start_date}</span>
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-8 text-xs"
              placeholder="Start date"
            />
            <select
              value={blockType}
              onChange={(event) => setBlockType(event.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            >
              <option value="Leader">Leader</option>
              <option value="Anchor">Anchor</option>
            </select>
            <Button disabled={loading} onClick={handleNewCycle} size="sm" className="h-8 text-xs">
              Start New Cycle
            </Button>
          </div>
          {events.length > 0 ? (
            <div className="border-t border-border/30 pt-2">
              <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">
                Recent events
              </p>
              {events.slice(0, 5).map((event) => (
                <p
                  key={`${event.event_date}:${event.event_type}:${event.deload_code || ''}`}
                  className="font-mono text-xs text-muted-foreground"
                >
                  {event.event_date} · {event.event_type}
                  {event.deload_code ? ` (${event.deload_code})` : ''}
                </p>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Deload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Active: <span className="text-foreground">{getActiveDeloadText(active)}</span>
          </p>
          <div className="flex flex-col gap-2">
            <select
              value={deloadCode}
              onChange={(event) => setDeloadCode(event.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            >
              {profiles.map((profile) => (
                <option key={profile.code} value={profile.code}>
                  {profile.name}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={deloadStart}
              onChange={(event) => setDeloadStart(event.target.value)}
              className="h-8 text-xs"
            />
            <Input
              type="number"
              min={1}
              step={1}
              placeholder="Days (default 7)"
              value={deloadDays}
              onChange={(event) => setDeloadDays(event.target.value)}
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
  );
}
