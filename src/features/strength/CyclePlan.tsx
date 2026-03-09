import { useState, type ReactElement } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CyclePlanRow } from '@/types/dashboard';

interface CyclePlanProps {
  plan: CyclePlanRow[];
}

function weekStart(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function shiftDate(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function CyclePlan({ plan }: CyclePlanProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  if (!plan.length) return null;

  const byDate = new Map<string, CyclePlanRow[]>();
  for (const row of plan) {
    const rowsForDate = byDate.get(row.session_date) ?? [];
    rowsForDate.push(row);
    byDate.set(row.session_date, rowsForDate);
  }

  const allDates = Array.from(byDate.keys()).sort();
  const start = weekStart(allDates[0]);
  const end = weekStart(allDates[allDates.length - 1]);
  const weekStarts: string[] = [];
  for (let d = start; d <= end; d = shiftDate(d, 7)) weekStarts.push(d);

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const selectedItems = selectedDate ? byDate.get(selectedDate) || [] : [];

  function summarizeModal(items: CyclePlanRow[], category: CyclePlanRow['category']) {
    const filteredRows = items.filter((value) => value.category === category);
    if (!filteredRows.length) {
      return <p className="text-sm text-muted-foreground">—</p>;
    }

    const byLift = new Map<string, CyclePlanRow[]>();
    for (const row of filteredRows) {
      const rowsForLift = byLift.get(row.lift) ?? [];
      rowsForLift.push(row);
      byLift.set(row.lift, rowsForLift);
    }

    return (
      <ul className="space-y-2">
        {Array.from(byLift.entries()).map(([lift, liftRows]) => {
          const grouped = new Map<string, number>();
          for (const setRow of liftRows) {
            const key = `${setRow.prescribed_reps}|${setRow.planned_weight_kg}`;
            grouped.set(key, (grouped.get(key) || 0) + 1);
          }
          const uniqueGroups = Array.from(grouped.entries());
          const detail =
            uniqueGroups.length === 1
              ? (() => {
                  const [[key, count]] = uniqueGroups;
                  const [reps, weight] = key.split('|');
                  return `${count}×${reps} @ ${weight}kg`;
                })()
              : liftRows
                  .map((setRow) => `${setRow.planned_weight_kg}×${setRow.prescribed_reps}`)
                  .join(' · ');

          return (
            <li key={`${selectedDate}:${category}:${lift}`} className="text-sm">
              <strong>{lift}</strong>: {detail}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
            Current Cycle Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {weekStarts.map((ws, wi) => {
              const cells: ReactElement[] = [];
              for (let day = 0; day < 7; day++) {
                const date = shiftDate(ws, day);
                const items = byDate.get(date) || [];
                if (!items.length) continue;
                const mainLifts = [
                  ...new Set(items.filter((r) => r.category === 'main').map((r) => r.lift)),
                ];
                const suppLifts = [
                  ...new Set(items.filter((r) => r.category === 'supplemental').map((r) => r.lift)),
                ];
                cells.push(
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className="rounded border border-border/40 bg-muted/10 p-2.5 text-left transition-colors hover:bg-muted/20"
                  >
                    <p className="text-xs text-muted-foreground mb-1">
                      {weekDays[day]} · {date}
                    </p>
                    <p className="text-xs font-medium text-foreground">
                      {mainLifts.join(' + ') || 'Rest'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supp: {suppLifts.length ? suppLifts.join(' + ') : '—'}
                    </p>
                  </button>,
                );
              }
              return (
                <div key={ws}>
                  <p className="text-xs text-muted-foreground mb-2">
                    Week {wi + 1} <span className="font-mono">· {ws}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {cells}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Planned session · {selectedDate}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <section className="space-y-2">
              <h4 className="text-xs uppercase tracking-widest text-muted-foreground">Main</h4>
              {summarizeModal(selectedItems, 'main')}
            </section>
            <section className="space-y-2">
              <h4 className="text-xs uppercase tracking-widest text-muted-foreground">
                Supplemental
              </h4>
              {summarizeModal(selectedItems, 'supplemental')}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
