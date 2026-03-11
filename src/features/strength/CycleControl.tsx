import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Cycle
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Current:
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
            <div className="flex flex-col gap-1">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Start date
              </p>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-10 text-sm"
                placeholder="Start date"
              />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Block type
              </p>
              <Select value={blockType} onValueChange={setBlockType}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Select block type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Leader">Leader</SelectItem>
                    <SelectItem value="Anchor">Anchor</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <Button
              disabled={loading}
              onClick={handleNewCycle}
              size="sm"
              className="w-full text-xs sm:w-fit"
            >
              Start New Cycle
            </Button>
          </div>
          {events.length > 0 ? (
            <div className="border-t border-border/30 pt-2">
              <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">
                Recent events
              </p>
              <div className="flex flex-col gap-1">
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
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Active: <span className="text-foreground">{getActiveDeloadText(active)}</span>
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Deload profile
              </p>
              <Select value={deloadCode} onValueChange={setDeloadCode}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Select deload profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.code} value={profile.code}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Start date
              </p>
              <Input
                type="date"
                value={deloadStart}
                onChange={(event) => setDeloadStart(event.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Duration
              </p>
              <Input
                type="number"
                min={1}
                step={1}
                placeholder="Days (default 7)"
                value={deloadDays}
                onChange={(event) => setDeloadDays(event.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <Button
              disabled={loading}
              onClick={handleDeload}
              size="sm"
              variant="outline"
              className="w-full text-xs sm:w-fit"
            >
              Apply Deload
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
