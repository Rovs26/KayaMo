'use client';

import { rescaleNutrientSnapshot } from '@kayamo/food/quick-log';
import {
  restoreLocalFoodEntry,
  reviseLocalFoodEntry,
  tombstoneLocalFoodEntry,
  type LocalFoodEntry,
} from '@kayamo/offline';
import { Trash, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import styles from '@kayamo/features/app-shell.module.css';

const UNDO_MS = 8000;

export function FoodRecordSheet({
  entry,
  userId,
  onClose,
  onChanged,
}: {
  entry: LocalFoodEntry;
  userId: string;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const originalGrams = Number(entry.grams);
  const [grams, setGrams] = useState(originalGrams);
  const [confirm, setConfirm] = useState(false);
  const [gone, setGone] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | 0>(0);

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const scaled = rescaleNutrientSnapshot(
    {
      kcal: entry.kcal,
      protein_g: entry.protein_g,
      carbs_g: entry.carbs_g,
      fat_g: entry.fat_g,
      fiber_g: entry.fiber_g,
      sugar_g: entry.sugar_g,
      sodium_mg: entry.sodium_mg,
    },
    originalGrams,
    grams,
  );
  const delta = Math.round(Number(scaled.kcal) - Number(entry.kcal));

  async function save() {
    await reviseLocalFoodEntry({
      id: entry.id,
      userId,
      quantity: entry.quantity,
      grams: String(grams),
      ...scaled,
      servingLabel: `${grams} g`,
    });
    onChanged('Saved the correction.');
    onClose();
  }

  async function remove() {
    await tombstoneLocalFoodEntry({ id: entry.id, userId });
    setGone(true);
    setConfirm(false);
    onChanged(`Removed. Undo for a few seconds.`);
    undoTimer.current = setTimeout(() => {
      setGone(false);
      onClose();
    }, UNDO_MS);
  }

  async function undo() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    await restoreLocalFoodEntry({ id: entry.id, userId });
    setGone(false);
    onChanged('Restored.');
    onClose();
  }

  if (gone) {
    return (
      <div className={styles.undoToast} role="status">
        <p>Removed. {entry.food_name_snapshot} left the ledger.</p>
        <button type="button" onClick={() => void undo()}>
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className={styles.sheetScrim}>
      <button type="button" className={styles.sheetBackdrop} aria-label="Close" onClick={onClose} />
      {confirm ? (
        <div className={styles.confirmCard} role="dialog" aria-label="Remove record">
          <p>Remove {entry.food_name_snapshot.toLowerCase()} from this day?</p>
          <small>
            This day’s total drops by {Math.round(Number(entry.kcal))} kcal. Grove points already
            confirmed stay where they are.
          </small>
          <button className={styles.dangerButton} type="button" onClick={() => void remove()}>
            Remove the record
          </button>
          <button className={styles.ghostWide} type="button" onClick={() => setConfirm(false)}>
            Keep it
          </button>
        </div>
      ) : (
        <div className={styles.bottomSheet} role="dialog" aria-label="Edit record">
          <div className={styles.sheetHandle} aria-hidden="true" />
          <div className={styles.sheetTitleRow}>
            <div>
              <p>{entry.food_name_snapshot}</p>
              <div className={styles.provenance}>
                <span>{entry.source.replaceAll('_', '-')}</span>
                <small>
                  confidence {Math.round(Number(entry.confidence) * 100)}% · logged{' '}
                  {new Date(entry.logged_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                </small>
              </div>
            </div>
            <button type="button" className={styles.iconButton} aria-label="Close" onClick={onClose}>
              <X size={19} />
            </button>
          </div>
          <p className={styles.eyebrow}>Amount</p>
          <div className={styles.stepperRow}>
            <span>Grams</span>
            <button type="button" aria-label="Less" onClick={() => setGrams((value) => Math.max(5, value - 10))}>
              −
            </button>
            <b>
              {grams}
              <i> g</i>
            </b>
            <button type="button" aria-label="More" onClick={() => setGrams((value) => value + 10)}>
              +
            </button>
          </div>
          <div className={styles.editMacros}>
            <div>
              <small>kcal</small>
              <strong>{Math.round(Number(scaled.kcal))}</strong>
            </div>
            <div>
              <small>P</small>
              <strong>{Math.round(Number(scaled.protein_g))}</strong>
            </div>
            <div>
              <small>C</small>
              <strong>{Math.round(Number(scaled.carbs_g))}</strong>
            </div>
            <div>
              <small>F</small>
              <strong>{Math.round(Number(scaled.fat_g))}</strong>
            </div>
            <span>{delta === 0 ? 'same' : `${delta > 0 ? '+' : ''}${delta} kcal`}</span>
          </div>
          <div className={styles.sheetActions}>
            <button className={styles.primaryButton} type="button" onClick={() => void save()}>
              Save the correction
            </button>
            <button
              className={styles.dangerIcon}
              type="button"
              aria-label="Remove this record"
              onClick={() => setConfirm(true)}
            >
              <Trash size={21} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
