import type { DashboardData } from '@/types/dashboard';
import { TrainingMaxCard } from './TrainingMaxCard';
import { CycleControl } from './CycleControl';
import { CyclePlan } from './CyclePlan';
import { Est1RMCard } from './Est1RMCard';

interface StrengthTabProps {
  data: DashboardData;
  onRefresh: () => void;
}

export function StrengthTab({ data, onRefresh }: StrengthTabProps) {
  const cycleControl = data.cycleControl || {};
  const tms = cycleControl.currentTM || [];
  const est1rm = data.est1RM || [];
  const plan = data.currentCyclePlan || [];

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Estimated 1RM */}
      {est1rm.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Estimated 1RM — Last 12 Weeks
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {est1rm.map((row) => (
              <Est1RMCard key={row.lift} row={row} />
            ))}
          </div>
        </div>
      )}

      {/* Current Cycle Plan */}
      {plan.length > 0 && <CyclePlan plan={plan} />}

      {/* Training Maxes */}
      {tms.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Training Maxes
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tms.map((tm) => (
              <TrainingMaxCard key={tm.lift} tm={tm} onRefresh={onRefresh} />
            ))}
          </div>
        </div>
      )}

      {/* Cycle Controls */}
      <CycleControl cycleControl={cycleControl} onRefresh={onRefresh} />
    </div>
  );
}
