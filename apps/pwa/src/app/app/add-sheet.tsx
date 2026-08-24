'use client';

import {
  asMealSlot,
  entriesOnLogicalDate,
  mealSlotAtHour,
  rankQuickLogFoods,
  shiftLogicalDate,
  type QuickLogHistoryEntry,
} from '@kayamo/food/quick-log';
import {
  instantOnLogicalDate,
  localHourFromInstant,
  logicalDateFromInstant,
  logFoodEntries,
  type LocalFoodEntry,
  type LogFoodEntryInput,
  useLiveFoodHistory,
} from '@kayamo/offline';
import {
  Barbell,
  Barcode,
  BowlFood,
  CaretRight,
  CheckSquareOffset,
  ClockCounterClockwise,
  ForkKnife,
  Scales,
} from '@phosphor-icons/react';
import { useEffect, useMemo } from 'react';
import styles from './kayamo-app.module.css';

function toHistory(entry: LocalFoodEntry, timeZone: string): QuickLogHistoryEntry | null {
  if (!entry.food_id) return null;
  const mealSlot = asMealSlot(entry.meal_slot);
  if (!mealSlot) return null;
  return {
    foodId: entry.food_id,
    name: entry.food_name_snapshot,
    mealSlot,
    loggedAtMs: Date.parse(entry.logged_at),
    localHour: localHourFromInstant(entry.logged_at, timeZone),
    quantity: entry.quantity,
    grams: entry.grams,
    servingId: entry.serving_id,
    servingLabel: entry.serving_label_snapshot,
    kcal: entry.kcal,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    fiber_g: entry.fiber_g,
    sugar_g: entry.sugar_g,
    sodium_mg: entry.sodium_mg,
    source: entry.source,
    resolvedVia: entry.resolved_via,
    confidence: entry.confidence,
  };
}

export function AddSheet({
  userId,
  timeZone,
  dayStartsAt,
  viewLogicalDate,
  todayLogical,
  workoutReady,
  onClose,
  onFood,
  onScan,
  onWeight,
  onWorkout,
  onTask,
  onLogged,
}: {
  userId: string;
  timeZone: string;
  dayStartsAt: string;
  viewLogicalDate: string;
  todayLogical: string;
  workoutReady: boolean;
  onClose: () => void;
  onFood: () => void;
  onScan: () => void;
  onWeight: () => void;
  onWorkout: () => void;
  onTask: () => void;
  onLogged: (message: string) => void;
}) {
  const historyRows = useLiveFoodHistory(userId);
  const history = useMemo(
    () => historyRows.flatMap((row) => toHistory(row, timeZone) ?? []),
    [historyRows, timeZone],
  );
  const hour = localHourFromInstant(new Date().toISOString(), timeZone);
  const mealSlot = mealSlotAtHour(hour);
  const chips = useMemo(
    () => rankQuickLogFoods(history, { mealSlot, hour, nowMs: Date.now() }).slice(0, 3),
    [history, hour, mealSlot],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const yesterday = shiftLogicalDate(viewLogicalDate, -1);
  const yesterdayItems = useMemo(
    () =>
      entriesOnLogicalDate(history, yesterday, (ms) =>
        logicalDateFromInstant(new Date(ms).toISOString(), timeZone, dayStartsAt),
      ),
    [dayStartsAt, history, timeZone, yesterday],
  );

  const writeAt =
    viewLogicalDate === todayLogical
      ? undefined
      : instantOnLogicalDate(viewLogicalDate, timeZone, dayStartsAt);

  async function logItems(
    items: Array<{
      foodId: string;
      name: string;
      mealSlot?: string;
      quantity: string;
      grams: string;
      kcal: string;
      protein_g: string;
      carbs_g: string;
      fat_g: string;
      fiber_g: string;
      sugar_g: string;
      sodium_mg: string;
      source: string;
      resolvedVia: string;
      servingId: string | null;
      servingLabel: string | null;
      confidence: string;
    }>,
    message: string,
  ) {
    const inputs: LogFoodEntryInput[] = items.map((item) => ({
      userId,
      mealSlot: asMealSlot(item.mealSlot) ?? mealSlot,
      foodId: item.foodId,
      foodName: item.name,
      quantity: item.quantity,
      grams: item.grams,
      kcal: item.kcal,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      fiber_g: item.fiber_g,
      sugar_g: item.sugar_g,
      sodium_mg: item.sodium_mg,
      source: item.source as LogFoodEntryInput['source'],
      resolvedVia: item.resolvedVia as LogFoodEntryInput['resolvedVia'],
      inputMethod: 'quick',
      servingId: item.servingId,
      servingLabel: item.servingLabel,
      confidence: item.confidence,
      timeZone,
      dayStartsAt,
      loggedAt: writeAt,
    }));
    if (inputs.length === 0) return;
    await logFoodEntries(inputs);
    onLogged(message);
    onClose();
  }

  const rows = [
    { label: 'Food', sub: 'Search, scan, or describe it to Mus', Icon: ForkKnife, go: onFood },
    { label: 'Weight', sub: 'One number, once a day is plenty', Icon: Scales, go: onWeight },
    {
      label: 'Workout',
      sub: workoutReady ? 'A session is ready to start' : 'Start empty or from last time',
      Icon: Barbell,
      go: onWorkout,
    },
    { label: 'Task or habit', sub: 'Goes on this day, nothing else changes', Icon: CheckSquareOffset, go: onTask },
  ];

  return (
    <div className={styles.sheetScrim}>
      <button type="button" className={styles.sheetBackdrop} aria-label="Close" onClick={onClose} />
      <div className={styles.bottomSheet} role="dialog" aria-label="Add">
        <div className={styles.sheetHandle} aria-hidden="true" />
        <p className={styles.sheetHeading}>What are you adding?</p>
        <div className={styles.addRows}>
          {rows.map((row) => (
            <button key={row.label} type="button" onClick={row.go}>
              <row.Icon size={23} />
              <span>
                <strong>{row.label}</strong>
                <small>{row.sub}</small>
              </span>
              <CaretRight size={17} />
            </button>
          ))}
        </div>
        <p className={styles.eyebrow}>Fastest paths</p>
        <div className={styles.quickChips}>
          {yesterdayItems.length > 0 ? (
            <button type="button" onClick={() => void logItems(yesterdayItems, 'Logged the same as yesterday.')}>
              <ClockCounterClockwise size={16} /> Same as yesterday
            </button>
          ) : null}
          {chips.map((chip) => (
            <button key={chip.foodId} type="button" onClick={() => void logItems([chip], `Logged ${chip.name}.`)}>
              <BowlFood size={16} /> {chip.name}
            </button>
          ))}
          <button type="button" onClick={onScan}>
            <Barcode size={16} /> Scan a pack
          </button>
        </div>
        <p className={styles.mutedNote}>
          {viewLogicalDate === todayLogical
            ? 'Same as yesterday and the chips write immediately. Search still opens a sheet if you want to change the amount.'
            : 'These land on the day you selected, not today.'}
        </p>
      </div>
    </div>
  );
}
