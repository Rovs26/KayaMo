'use client';

import { Button } from '@kayamo/ui';
import { atwaterKcal, type PhCoreFieldDiff, type PhCoreFood, type PhCoreIssue } from '@kayamo/food/ph-core';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { applyPhCoreFood, confirmPhCoreFood, savePhCoreFood } from './actions';

type Props = {
  food: PhCoreFood;
  issues: PhCoreIssue[];
  diffs: PhCoreFieldDiff[];
};

export function PhCoreEditor({ food, issues, diffs }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<PhCoreFood>(food);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const expectedKcal = useMemo(() => atwaterKcal(draft), [draft]);

  function updatePer100g(key: keyof PhCoreFood['per100g'], value: string) {
    setDraft((current) => ({
      ...current,
      per100g: { ...current.per100g, [key]: Number(value) },
    }));
  }

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okText: string) {
    setPending(true);
    setMessage(null);
    const result = await fn();
    setPending(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage(okText);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {message ? <p className="font-body text-body text-accent">{message}</p> : null}

      {issues.length > 0 ? (
        <ul className="flex flex-col gap-1 font-body text-caption text-warning">
          {issues.map((issue) => (
            <li key={`${issue.code}-${issue.message}`}>
              {issue.level}: {issue.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-data text-caption uppercase tracking-[0.14em] text-muted">YAML checks ok</p>
      )}

      <label className="flex flex-col gap-1">
        <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">name</span>
        <input
          className="min-h-12 rounded-md bg-surface-2 px-3 text-text"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">aliases</span>
        <input
          className="min-h-12 rounded-md bg-surface-2 px-3 text-text"
          value={draft.name_tl.join(', ')}
          onChange={(event) =>
            setDraft({
              ...draft,
              name_tl: event.target.value
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean),
            })
          }
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['kcal', 'kcal'],
            ['protein', 'protein g'],
            ['carbs', 'carbs g'],
            ['fat', 'fat g'],
            ['fiber', 'fiber g'],
            ['sugar', 'sugar g'],
            ['sodium_mg', 'sodium mg'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">{label}</span>
            <input
              type="number"
              step="0.1"
              className="min-h-12 rounded-md bg-surface-2 px-3 text-text"
              value={draft.per100g[key]}
              onChange={(event) => updatePer100g(key, event.target.value)}
            />
          </label>
        ))}
      </div>
      <p className="font-data text-caption text-muted">
        4/4/9 expected {expectedKcal.toFixed(1)} kcal / 100 g (stated {draft.per100g.kcal})
      </p>

      <label className="flex flex-col gap-1">
        <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">typical prep</span>
        <textarea
          className="min-h-20 rounded-md bg-surface-2 px-3 py-2 text-text"
          value={draft.typical_prep}
          onChange={(event) => setDraft({ ...draft, typical_prep: event.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">source note</span>
        <textarea
          className="min-h-28 rounded-md bg-surface-2 px-3 py-2 text-text"
          value={draft.source_note}
          onChange={(event) => setDraft({ ...draft, source_note: event.target.value })}
        />
      </label>

      <div className="flex flex-col gap-3">
        <p className="font-data text-caption uppercase tracking-[0.14em] text-muted">servings</p>
        {draft.servings.map((serving, index) => (
          <div key={`${serving.label}-${index}`} className="grid grid-cols-[1fr_6rem_auto] gap-2">
            <input
              className="min-h-12 rounded-md bg-surface-2 px-3 text-text"
              value={serving.label}
              onChange={(event) => {
                const servings = draft.servings.map((row, i) =>
                  i === index ? { ...row, label: event.target.value } : row,
                );
                setDraft({ ...draft, servings });
              }}
            />
            <input
              type="number"
              className="min-h-12 rounded-md bg-surface-2 px-3 text-text"
              value={serving.grams}
              onChange={(event) => {
                const servings = draft.servings.map((row, i) =>
                  i === index ? { ...row, grams: Number(event.target.value) } : row,
                );
                setDraft({ ...draft, servings });
              }}
            />
            <label className="flex items-center gap-2 font-data text-caption text-muted">
              <input
                type="radio"
                name="default-serving"
                checked={serving.is_default === true}
                onChange={() => {
                  const servings = draft.servings.map((row, i) => ({
                    ...row,
                    is_default: i === index,
                  }));
                  setDraft({ ...draft, servings });
                }}
              />
              default
            </label>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Button
          disabled={pending}
          onClick={() => run(() => savePhCoreFood(draft), 'Saved YAML.')}
        >
          Save YAML
        </Button>
        <Button
          disabled={pending}
          variant="secondary"
          onClick={() => run(() => applyPhCoreFood(draft.id), 'Applied this food to the database.')}
        >
          Apply to database
        </Button>
        <Button
          disabled={pending}
          variant="secondary"
          onClick={() => run(() => confirmPhCoreFood(draft), 'Confirmed. Confidence set to 1.0.')}
        >
          Confirm numbers
        </Button>
      </div>

      <section>
        <h2 className="font-body text-title">Diff vs database</h2>
        {diffs.length === 0 ? (
          <p className="mt-2 font-body text-muted">YAML and database match.</p>
        ) : (
          <table className="mt-3 w-full text-left font-data text-caption">
            <thead>
              <tr className="text-muted">
                <th className="py-2 pr-3">field</th>
                <th className="py-2 pr-3">yaml</th>
                <th className="py-2">database</th>
              </tr>
            </thead>
            <tbody>
              {diffs.map((diff) => (
                <tr key={diff.field} className="border-t border-line align-top">
                  <td className="py-2 pr-3 text-muted">{diff.field}</td>
                  <td className="py-2 pr-3 whitespace-pre-wrap">{diff.yaml}</td>
                  <td className="py-2 whitespace-pre-wrap">{diff.db}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
