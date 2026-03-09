import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DashboardRefresh } from '@/hooks/useDashboardData';
import type { DashboardData, PlannedBarbellRow, PlannedCardioRow } from '@/types/dashboard';
import { logAction } from '@/hooks/useApi';

interface DetailDialogProps {
  date: string | null;
  data: DashboardData | null;
  open: boolean;
  onClose: () => void;
  onRefresh: DashboardRefresh;
}

interface DetailFormState {
  mainWeight: string;
  mainReps: string;
  mainRpe: string;
  supplementalCompleted: boolean;
  supplementalModified: boolean;
  supplementalWeight: string;
  supplementalSets: string;
  cardioDuration: string;
  cardioAvgHr: string;
  cardioSpeed: string;
  cardioWorkMin: string;
  cardioRestMin: string;
  ringsCompleted: boolean;
}

const INITIAL_FORM: DetailFormState = {
  mainWeight: '',
  mainReps: '',
  mainRpe: '',
  supplementalCompleted: true,
  supplementalModified: false,
  supplementalWeight: '',
  supplementalSets: '',
  cardioDuration: '',
  cardioAvgHr: '',
  cardioSpeed: '',
  cardioWorkMin: '',
  cardioRestMin: '',
  ringsCompleted: false,
};

function applyMainOverrides(
  rows: PlannedBarbellRow[] | undefined,
  mainWeight: number,
  mainReps: number,
  mainRpe: number | null,
) {
  return (rows || []).map((row) => {
    if (row.category !== 'main') return row;

    return {
      ...row,
      planned_weight_kg: mainWeight,
      prescribed_reps: mainReps,
      note: Number.isFinite(mainRpe) ? `RPE ${mainRpe}` : row.note,
    };
  });
}

function getSessionQuality({
  cardioDuration,
  cardioHr,
  form,
  mainReps,
  mainWeight,
  supplementalWeight,
  isPositiveNumber,
}: {
  cardioDuration: number;
  cardioHr: number;
  form: DetailFormState;
  mainReps: number;
  mainWeight: number | null;
  supplementalWeight: number | null;
  isPositiveNumber: (value: number | null) => value is number;
}) {
  const mainOk = isPositiveNumber(mainWeight) && Number.isFinite(mainReps) && mainReps > 0;
  const cardioOk =
    Number.isFinite(cardioDuration) &&
    Number.isFinite(cardioHr) &&
    cardioDuration > 0 &&
    cardioHr > 0;
  const supplementalOk =
    form.supplementalCompleted ||
    (form.supplementalModified && isPositiveNumber(supplementalWeight));
  const score = [mainOk, supplementalOk, cardioOk].filter(Boolean).length;

  if (score === 3) return 'A (full session)';
  if (score === 2) return 'B (mostly complete)';
  if (score === 1) return 'C (partial)';
  return 'D (logged but incomplete)';
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This dialog intentionally mirrors the staged session workflow.
export function DetailDialog({ date, data, open, onClose, onRefresh }: DetailDialogProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [form, setForm] = useState<DetailFormState>(INITIAL_FORM);

  const tileData = date
    ? (data?.dailyTiles || []).find((tile) => tile.session_date === date)
    : null;
  const weekRowData = date
    ? (data?.weekProgress || []).find((row) => row.session_date === date)
    : null;
  const barbellRows = (date ? data?.details?.barbellByDate?.[date] : undefined) || [];
  const cardioRows = (date ? data?.details?.cardioByDate?.[date] : undefined) || [];
  const ringsRows = (date ? data?.details?.ringsByDate?.[date] : undefined) || [];
  const plannedBarbellRows = (date ? data?.details?.plannedBarbellByDate?.[date] : undefined) || [];
  const plannedCardio = ((date ? data?.details?.plannedCardioByDate?.[date] : undefined) ||
    [])[0] as PlannedCardioRow | undefined;
  const plannedRingsRows = (date ? data?.details?.plannedRingsByDate?.[date] : undefined) || [];

  const mainPlan = plannedBarbellRows.filter((row) => row.category === 'main');
  const supplementalPlan = plannedBarbellRows.filter((row) => row.category === 'supplemental');
  const mainTop = mainPlan.length ? mainPlan[mainPlan.length - 1] : null;
  const supplementalTop = supplementalPlan[0] || null;
  const ringsTemplates = [
    ...new Set(plannedRingsRows.map((row) => row.template_code).filter(Boolean)),
  ];
  const ringsTemplate =
    ringsTemplates.length > 0
      ? ringsTemplates.join('+')
      : tileData?.planned_rings || weekRowData?.rings_plan || null;
  const ringsPlanText =
    plannedRingsRows
      .filter((row) => row.item_no != null)
      .map(
        (row) =>
          `[${row.template_code}] ${row.item_no}. ${row.exercise} ${row.sets_text || ''}x${row.reps_or_time || ''}`,
      )
      .join('\n') || 'Not scheduled';

  const hasMainLogged = barbellRows.some((row) => row.category === 'main');
  const hasSupplementalLogged = barbellRows.some((row) => row.category === 'supplemental');
  const hasCardioLogged = cardioRows.length > 0;
  const hasRingsLogged = ringsRows.length > 0;
  const dayName = tileData?.day_name || weekRowData?.day_name || '';

  function isPositiveNumber(value: number | null): value is number {
    return value !== null && Number.isFinite(value) && value > 0;
  }

  function isNonNegativeNumber(value: number | null): value is number {
    return value !== null && Number.isFinite(value) && value >= 0;
  }

  useEffect(() => {
    setForm({
      ...INITIAL_FORM,
      cardioDuration: plannedCardio?.duration_min ? String(plannedCardio.duration_min) : '',
      cardioWorkMin: plannedCardio?.vo2_work_min ? String(plannedCardio.vo2_work_min) : '',
      cardioRestMin: plannedCardio?.vo2_easy_min ? String(plannedCardio.vo2_easy_min) : '',
      ringsCompleted: hasRingsLogged,
    });
  }, [plannedCardio, hasRingsLogged]);

  async function postLogAction(payload: Record<string, unknown>) {
    await logAction(payload);
  }

  async function refreshOpenDialog() {
    await Promise.resolve(onRefresh());
  }

  function num(value: string) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This dispatcher preserves the existing action payload contract.
  async function runAction(action: string) {
    if (!date) return;

    const payload: Record<string, unknown> = {
      action,
      date,
      plannedBarbellRows,
      plannedCardio: plannedCardio || null,
    };

    async function submit(body: Record<string, unknown>) {
      await postLogAction(body);
    }

    setLoadingAction(action);

    try {
      if (action === 'finish_session') {
        const mainWeight = num(form.mainWeight);
        const mainReps = Number.parseInt(form.mainReps, 10);
        const mainRpe = num(form.mainRpe);
        const supplementalWeight = num(form.supplementalWeight);
        const supplementalSets = Number.parseInt(form.supplementalSets, 10);
        const cardioDuration = Number.parseInt(form.cardioDuration, 10);
        const cardioHr = Number.parseInt(form.cardioAvgHr, 10);
        const cardioSpeed = num(form.cardioSpeed);
        const cardioWorkMin = num(form.cardioWorkMin);
        const cardioRestMin = num(form.cardioRestMin);

        if (isPositiveNumber(mainWeight) && Number.isFinite(mainReps) && mainReps > 0) {
          await submit({
            action: 'main_done',
            date,
            plannedBarbellRows: applyMainOverrides(
              plannedBarbellRows,
              mainWeight,
              mainReps,
              mainRpe,
            ),
            plannedCardio: plannedCardio || null,
          });
        }

        if (form.supplementalModified && isPositiveNumber(supplementalWeight)) {
          const reps =
            plannedBarbellRows.find((row) => row.category === 'supplemental')?.prescribed_reps || 5;
          const sets =
            Number.isFinite(supplementalSets) && supplementalSets > 0 ? supplementalSets : 10;
          await submit({
            action: 'supp_modified',
            date,
            plannedBarbellRows,
            plannedCardio: plannedCardio || null,
            suppModifiedText: `${sets}x${reps}@${supplementalWeight}`,
          });
        } else if (form.supplementalCompleted) {
          await submit({
            action: 'supp_done',
            date,
            plannedBarbellRows,
            plannedCardio: plannedCardio || null,
          });
        }

        if (
          Number.isFinite(cardioDuration) &&
          cardioDuration > 0 &&
          Number.isFinite(cardioHr) &&
          cardioHr > 0
        ) {
          await submit({
            action: 'cardio_done',
            date,
            plannedBarbellRows,
            plannedCardio: {
              ...(plannedCardio || {}),
              duration_min: cardioDuration,
            },
            avgHr: cardioHr,
            speedKmh: isPositiveNumber(cardioSpeed) ? cardioSpeed : undefined,
            workMin: isPositiveNumber(cardioWorkMin) ? cardioWorkMin : undefined,
            restMin: isNonNegativeNumber(cardioRestMin) ? cardioRestMin : undefined,
          });
        }

        if (form.ringsCompleted) {
          await submit({
            action: 'rings_done',
            date,
            plannedBarbellRows,
            plannedCardio: plannedCardio || null,
          });
        }

        let e1rmText = '—';
        let deltaText = '—';
        if (isPositiveNumber(mainWeight) && Number.isFinite(mainReps) && mainReps > 0) {
          const e1rm = mainWeight * (1 + mainReps / 30);
          e1rmText = `${e1rm.toFixed(1)} kg`;
          const previousMainRows = barbellRows.filter((row) => row.category === 'main');
          const previousTop = previousMainRows[previousMainRows.length - 1];
          if (previousTop?.actual_weight_kg && previousTop?.actual_reps) {
            const prevE1 =
              Number(previousTop.actual_weight_kg) * (1 + Number(previousTop.actual_reps) / 30);
            const delta = e1rm - prevE1;
            deltaText = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} kg vs previous logged main`;
          }
        }

        const z2InCap =
          Number.isFinite(cardioHr) && cardioHr > 0 ? (cardioHr <= 125 ? 'Yes' : 'No') : '—';
        const quality = getSessionQuality({
          cardioDuration,
          cardioHr,
          form,
          mainReps,
          mainWeight,
          supplementalWeight,
          isPositiveNumber,
        });

        await refreshOpenDialog();
        window.alert(
          `Session finished\n\nTop set e1RM: ${e1rmText}\nDelta: ${deltaText}\nZ2 in cap: ${z2InCap}\nSession quality: ${quality}`,
        );
        return;
      }

      if (action === 'supp_modified') {
        const supplementalWeight = num(form.supplementalWeight);
        const supplementalSets = Number.parseInt(form.supplementalSets, 10);
        const reps =
          plannedBarbellRows.find((row) => row.category === 'supplemental')?.prescribed_reps || 5;
        if (!isPositiveNumber(supplementalWeight)) {
          window.alert('Enter modified supplemental weight first.');
          return;
        }
        payload.suppModifiedText = `${Number.isFinite(supplementalSets) && supplementalSets > 0 ? supplementalSets : 10}x${reps}@${supplementalWeight}`;
      }

      if (action === 'cardio_done' || action === 'z2_fixed_hr_test') {
        if (!form.cardioAvgHr.trim()) {
          window.alert('Enter Avg HR in the Cardio section first, then tap Mark Cardio Complete.');
          return;
        }

        const avgHr = Number.parseInt(form.cardioAvgHr, 10);
        const durationInput = Number.parseInt(form.cardioDuration, 10);
        const speedInput = num(form.cardioSpeed);
        const workMinInput = num(form.cardioWorkMin);
        const restMinInput = num(form.cardioRestMin);

        if (!Number.isFinite(avgHr) || avgHr <= 0) {
          window.alert('Please enter a valid average HR number.');
          return;
        }

        payload.avgHr = avgHr;
        payload.plannedCardio = {
          ...(plannedCardio || {}),
          duration_min:
            Number.isFinite(durationInput) && durationInput > 0
              ? durationInput
              : plannedCardio?.duration_min || 30,
        };
        if (isPositiveNumber(speedInput)) payload.speedKmh = speedInput;

        const protocol = String(
          (payload.plannedCardio as PlannedCardioRow | undefined)?.session_type ||
            (payload.plannedCardio as PlannedCardioRow | undefined)?.protocol ||
            '',
        );
        const isVo2 = protocol.includes('VO2') || protocol === 'VO2_4x4' || protocol === 'VO2_1min';
        const defaultWork = protocol.includes('4x4') || protocol === 'VO2_4x4' ? 4 : 1;
        const defaultRest = protocol.includes('4x4') || protocol === 'VO2_4x4' ? 3 : 1;

        if (isPositiveNumber(workMinInput)) payload.workMin = workMinInput;
        if (isNonNegativeNumber(restMinInput)) payload.restMin = restMinInput;

        if (action === 'cardio_done' && isVo2) {
          if (
            !Number.isFinite((payload.workMin as number | undefined) ?? Number.NaN) ||
            Number(payload.workMin) <= 0
          ) {
            payload.workMin = defaultWork;
          }
          if (
            !Number.isFinite((payload.restMin as number | undefined) ?? Number.NaN) ||
            Number(payload.restMin) < 0
          ) {
            payload.restMin = defaultRest;
          }
        }

        if (action === 'z2_fixed_hr_test' && !payload.speedKmh) {
          window.alert('For Fixed-HR test, enter speed (km/h) before saving.');
          return;
        }
      }

      if (action === 'main_done') {
        const mainWeight = num(form.mainWeight);
        const mainReps = Number.parseInt(form.mainReps, 10);
        if (isPositiveNumber(mainWeight) && Number.isFinite(mainReps) && mainReps > 0) {
          payload.plannedBarbellRows = plannedBarbellRows.map((row) =>
            row.category === 'main'
              ? { ...row, planned_weight_kg: mainWeight, prescribed_reps: mainReps }
              : row,
          );
        }
      }

      await submit(payload);
      await refreshOpenDialog();

      if (action === 'cardio_done') {
        window.alert('Cardio session saved.');
      }
      if (action === 'z2_fixed_hr_test') {
        window.alert('Monthly Z2 fixed-HR test saved.');
      }
    } catch (error) {
      window.alert(
        `Could not save action: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Training details {dayName ? `· ${dayName}` : ''} {date}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <section className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="text-xs uppercase tracking-widest text-primary">Main Lift</h4>
            <p className="mt-2 text-sm">
              <strong>Main - {mainTop?.lift || '—'}</strong>
              <br />
              Working sets prescribed:
              {mainPlan.length
                ? mainPlan
                    .map((row) => `${row.planned_weight_kg}×${row.prescribed_reps}`)
                    .join(' · ')
                : '—'}
              <br />
              Top set prescribed: {mainTop?.planned_weight_kg || '—'} ×
              {mainTop?.prescribed_reps || '—'}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Input
                placeholder="Top set weight"
                type="number"
                step="0.5"
                value={form.mainWeight}
                onChange={(event) =>
                  setForm((current) => ({ ...current, mainWeight: event.target.value }))
                }
              />
              <Input
                placeholder="Top set reps"
                type="number"
                step="1"
                value={form.mainReps}
                onChange={(event) =>
                  setForm((current) => ({ ...current, mainReps: event.target.value }))
                }
              />
              <Input
                placeholder="RPE (optional)"
                type="number"
                step="0.5"
                value={form.mainRpe}
                onChange={(event) =>
                  setForm((current) => ({ ...current, mainRpe: event.target.value }))
                }
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              disabled={loadingAction !== null || hasMainLogged}
              onClick={() => runAction('main_done')}
            >
              {hasMainLogged ? 'Main Recorded ✓' : 'Mark Main Complete'}
            </Button>
          </section>

          <section className="rounded-lg border border-border/40 bg-muted/10 p-4">
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground">
              Supplemental
            </h4>
            <p className="mt-2 text-sm">
              <strong>{supplementalTop?.lift || '—'}</strong>
              <br />
              Prescribed:
              {supplementalPlan.length
                ? `${supplementalPlan.length}×${supplementalTop?.prescribed_reps ?? '-'} @ ${supplementalTop?.planned_weight_kg ?? '-'} kg`
                : '—'}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.supplementalCompleted}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      supplementalCompleted: event.target.checked,
                    }))
                  }
                />
                Completed as prescribed
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.supplementalModified}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      supplementalModified: event.target.checked,
                    }))
                  }
                />
                Modified
              </label>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Modified weight"
                type="number"
                step="0.5"
                value={form.supplementalWeight}
                onChange={(event) =>
                  setForm((current) => ({ ...current, supplementalWeight: event.target.value }))
                }
              />
              <Input
                placeholder="Sets completed"
                type="number"
                step="1"
                value={form.supplementalSets}
                onChange={(event) =>
                  setForm((current) => ({ ...current, supplementalSets: event.target.value }))
                }
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={loadingAction !== null || hasSupplementalLogged}
                onClick={() => runAction('supp_done')}
              >
                {hasSupplementalLogged ? 'Supp Recorded ✓' : 'Mark Supp Complete'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loadingAction !== null || hasSupplementalLogged}
                onClick={() => runAction('supp_modified')}
              >
                {hasSupplementalLogged ? 'Supp Recorded ✓' : 'Save Supp Modified'}
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-border/40 bg-muted/10 p-4">
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground">Cardio</h4>
            <p className="mt-2 text-sm">
              <strong>{plannedCardio?.session_type || 'Z2'}</strong>
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Input
                placeholder="Duration (min)"
                type="number"
                step="1"
                value={form.cardioDuration}
                onChange={(event) =>
                  setForm((current) => ({ ...current, cardioDuration: event.target.value }))
                }
              />
              <Input
                placeholder="Avg HR"
                type="number"
                step="1"
                value={form.cardioAvgHr}
                onChange={(event) =>
                  setForm((current) => ({ ...current, cardioAvgHr: event.target.value }))
                }
              />
              <Input
                placeholder="Speed (optional)"
                type="number"
                step="0.1"
                value={form.cardioSpeed}
                onChange={(event) =>
                  setForm((current) => ({ ...current, cardioSpeed: event.target.value }))
                }
              />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Work interval (min)"
                type="number"
                step="0.5"
                value={form.cardioWorkMin}
                onChange={(event) =>
                  setForm((current) => ({ ...current, cardioWorkMin: event.target.value }))
                }
              />
              <Input
                placeholder="Rest interval (min)"
                type="number"
                step="0.5"
                value={form.cardioRestMin}
                onChange={(event) =>
                  setForm((current) => ({ ...current, cardioRestMin: event.target.value }))
                }
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              disabled={loadingAction !== null || hasCardioLogged}
              onClick={() => runAction('cardio_done')}
            >
              {hasCardioLogged ? 'Cardio Recorded ✓' : 'Mark Cardio Complete'}
            </Button>
          </section>

          <section className="rounded-lg border border-border/40 bg-muted/10 p-4">
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground">Rings</h4>
            <p className="mt-2 text-sm">
              <strong>Template {ringsTemplate || '—'}</strong>
            </p>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
              {ringsPlanText}
            </pre>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.ringsCompleted}
                  disabled={hasRingsLogged}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, ringsCompleted: event.target.checked }))
                  }
                />
                Completed as prescribed
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={loadingAction !== null || hasRingsLogged}
                onClick={() => runAction('rings_done')}
              >
                {hasRingsLogged ? 'Rings Recorded ✓' : 'Mark Rings Complete'}
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="text-xs uppercase tracking-widest text-primary">Finish Session</h4>
            <Button
              type="button"
              className="mt-3"
              disabled={loadingAction !== null}
              onClick={() => runAction('finish_session')}
            >
              Finish Session
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
