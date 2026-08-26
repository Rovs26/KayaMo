'use client';

import type { Serving } from '@kayamo/db';
import {
  defaultServing,
  rescaleNutrientSnapshot,
  sortServingsPhFirst,
  type NutrientSnapshot,
} from '@kayamo/food/quick-log';
import { Button, NumberDisplay, Sheet } from '@kayamo/ui';
import { useMemo, useState } from 'react';

export type QuantityTarget = NutrientSnapshot & {
  foodId: string;
  name: string;
  quantity: string;
  grams: string;
  servingId: string | null;
  servingLabel: string | null;
  source: string;
  resolvedVia: string;
  confidence: string;
};

export type SheetServing = {
  id: string | null;
  label: string;
  grams: number;
  isDefault?: boolean;
};

export function toSheetServings(rows: Serving[]): SheetServing[] {
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    grams: Number(row.grams_equivalent),
    isDefault: row.is_default,
  }));
}

export function sheetServingsFromFoodServings(
  servings: Array<{ label: string; grams: number; isDefault?: boolean }>,
): SheetServing[] {
  return servings.map((row) => ({
    id: null,
    label: row.label,
    grams: row.grams,
    isDefault: row.isDefault,
  }));
}

export function QuantitySheet({
  target,
  servings,
  onClose,
  onConfirm,
}: {
  target: QuantityTarget;
  servings: SheetServing[];
  onClose: () => void;
  onConfirm: (next: QuantityTarget) => void;
}) {
  const options = useMemo((): SheetServing[] => {
    const sorted = sortServingsPhFirst(servings);
    const hasGrams = sorted.some((row) => /\b(g|gram|grams)\b/i.test(row.label));
    if (!hasGrams) sorted.push({ id: null, label: 'g', grams: 1 });
    return sorted;
  }, [servings]);

  const [servingId, setServingId] = useState<string | null>(target.servingId);
  const [quantity, setQuantity] = useState(() => Math.max(1, Number(target.quantity) || 1));

  const selected =
    options.find((row) => row.id === servingId && servingId !== null) ??
    options.find((row) => row.label === target.servingLabel) ?? {
      id: target.servingId,
      label: target.servingLabel ?? 'g',
      grams: Number(target.grams) / Math.max(1, Number(target.quantity) || 1),
    };

  const grams = (selected.grams || 1) * quantity;
  const nutrients =
    Number(target.grams) > 0
      ? rescaleNutrientSnapshot(target, Number(target.grams), grams)
      : target;

  return (
    <Sheet
      open
      onClose={onClose}
      title={target.name}
      footer={
        <Button
          type="button"
          size="lg"
          onClick={() =>
            onConfirm({
              ...target,
              ...nutrients,
              quantity: String(quantity),
              grams: String(grams),
              servingId: selected.id,
              servingLabel: quantity === 1 ? selected.label : `${quantity} × ${selected.label}`,
            })
          }
        >
          Log
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="font-data text-caption uppercase tracking-[0.14em] text-muted">serving</p>
        <div className="flex flex-wrap gap-2">
          {options.map((row) => (
            <button
              key={`${row.id ?? 'none'}:${row.label}`}
              type="button"
              onClick={() => {
                setServingId(row.id);
                if (row.grams === 1 && row.label === 'g') {
                  setQuantity(Math.max(1, Math.round(Number(target.grams) || 100)));
                } else {
                  setQuantity(1);
                }
              }}
              className={`min-h-12 rounded-md px-4 font-body text-body ${
                selected.label === row.label && selected.id === row.id
                  ? 'bg-accent text-accent-fg'
                  : 'bg-surface-2 text-text'
              }`}
            >
              {row.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => setQuantity((n) => Math.max(1, n - 1))}
          >
            −
          </Button>
          <p className="font-data text-title text-text">{quantity}</p>
          <Button type="button" variant="secondary" size="lg" onClick={() => setQuantity((n) => n + 1)}>
            +
          </Button>
        </div>
        <NumberDisplay value={String(Math.round(Number(nutrients.kcal)))} unit="kcal" size="md" />
      </div>
    </Sheet>
  );
}

export function defaultQuantityFromServings(servings: Serving[]): {
  quantity: string;
  grams: string;
  servingId: string | null;
  servingLabel: string | null;
} {
  const mapped = servings.map((row) => ({
    label: row.label,
    grams: Number(row.grams_equivalent),
    isDefault: row.is_default,
  }));
  const picked = defaultServing(mapped);
  const match = servings.find((row) => row.label === picked.label) ?? servings[0];
  return {
    quantity: '1',
    grams: match?.grams_equivalent ?? String(picked.grams),
    servingId: match?.id ?? null,
    servingLabel: match?.label ?? picked.label,
  };
}
