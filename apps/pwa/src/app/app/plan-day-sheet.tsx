'use client';

import {
  DAY_CAPACITY_LABELS,
  DAY_CAPACITIES,
  DAY_INTENT_LABELS,
  DAY_INTENTS,
  PLAN_MODE_LABELS,
  proposeDayPlan,
  type DayCapacity,
  type DayIntent,
  type DayPlanCandidate,
  type PlanMode,
} from '@kayamo/core';
import { ArrowLeft, CheckCircle } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import styles from './kayamo-app.module.css';

export function PlanDaySheet({
  candidates,
  yesterdayNote,
  returningAfterDays,
  estimatedCapacity = null,
  learnedNote = null,
  initialMode = 'standard',
  onClose,
  onConfirm,
}: {
  candidates: DayPlanCandidate[];
  yesterdayNote: string | null;
  returningAfterDays: number;
  estimatedCapacity?: DayCapacity | null;
  learnedNote?: string | null;
  initialMode?: PlanMode;
  onClose: () => void;
  onConfirm: (input: {
    capacity: DayCapacity;
    intent: DayIntent | null;
    mode: PlanMode;
    kept: DayPlanCandidate[];
    customLabel: string | null;
  }) => Promise<void> | void;
}) {
  const [capacity, setCapacity] = useState<DayCapacity>(
    returningAfterDays >= 2 ? 'low' : (estimatedCapacity ?? 'normal'),
  );
  const [intent, setIntent] = useState<DayIntent | null>(null);
  const [mode, setMode] = useState<PlanMode>(initialMode);
  const [keepIds, setKeepIds] = useState<string[]>([]);
  const [customLabel, setCustomLabel] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode === 'rescue') {
      setKeepIds([]);
      return;
    }
    const next = proposeDayPlan({
      candidates,
      capacity,
      mode,
      yesterdayNote,
      returningAfterDays,
    });
    setKeepIds(next.items.filter((item) => item.suggested).map((item) => item.id));
  }, [candidates, capacity, mode, returningAfterDays, yesterdayNote]);

  const proposal = useMemo(
    () =>
      proposeDayPlan({
        candidates,
        capacity,
        mode,
        yesterdayNote,
        returningAfterDays,
        keepIds,
      }),
    [candidates, capacity, keepIds, mode, returningAfterDays, yesterdayNote],
  );

  const selected = proposal.items.filter((item) => keepIds.includes(item.id));

  function toggleKeep(id: string) {
    setKeepIds((current) =>
      current.includes(id) ? current.filter((row) => row !== id) : [...current, id],
    );
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm({
        capacity,
        intent,
        mode: proposal.mode,
        kept: selected,
        customLabel: customLabel.trim() || null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${styles.flowOverlay} ${styles.flowSolid}`}>
      <div className={styles.activeHeader}>
        <button type="button" className={styles.iconButton} aria-label="Back to Home" onClick={onClose}>
          <ArrowLeft size={21} />
        </button>
        <h1>{PLAN_MODE_LABELS[mode]}</h1>
      </div>
      <div className={styles.flowScroll}>
        {proposal.welcomeBack ? (
          <p className={styles.flowLead}>
            Welcome back. Nothing was taken away. We will not dump overdue work on today.
          </p>
        ) : (
          <p className={styles.flowLead}>
            Mus proposes from what is already on this device. You confirm every write.
          </p>
        )}
        {proposal.yesterdayNote ? (
          <p className={styles.mutedNote}>From last night: {proposal.yesterdayNote}</p>
        ) : null}
        {learnedNote ? <p className={styles.mutedNote}>{learnedNote}</p> : null}
        {estimatedCapacity && returningAfterDays < 2 ? (
          <p className={styles.mutedNote}>
            From confirmed days, a {DAY_CAPACITY_LABELS[estimatedCapacity].toLowerCase()} day is the honest default. You can still pick another.
          </p>
        ) : null}

        <p className={styles.eyebrow}>How is today?</p>
        <div className={styles.choiceRow}>
          {DAY_CAPACITIES.map((id) => (
            <button
              key={id}
              type="button"
              className={capacity === id ? styles.choiceOn : styles.choiceOff}
              aria-pressed={capacity === id}
              onClick={() => setCapacity(id)}
            >
              {DAY_CAPACITY_LABELS[id]}
            </button>
          ))}
        </div>

        <p className={styles.eyebrow}>Day intent · optional</p>
        <div className={styles.choiceRow}>
          {DAY_INTENTS.map((id) => (
            <button
              key={id}
              type="button"
              className={intent === id ? styles.choiceOn : styles.choiceOff}
              aria-pressed={intent === id}
              onClick={() => setIntent((current) => (current === id ? null : id))}
            >
              {DAY_INTENT_LABELS[id]}
            </button>
          ))}
        </div>

        <p className={styles.eyebrow}>
          {mode === 'rescue' ? 'What still has to happen?' : `On today · ${selected.length}`}
        </p>
        {proposal.items.length === 0 ? (
          <p className={styles.emptyLine}>Nothing queued. Write one thing, or skip.</p>
        ) : (
          <div className={styles.choiceColumn}>
            {proposal.items.map((item) => {
              const on = keepIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={on ? styles.choiceOn : styles.choiceOff}
                  aria-pressed={on}
                  onClick={() => toggleKeep(item.id)}
                >
                  {on ? <CheckCircle size={18} weight="fill" /> : null}
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.reason}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {proposal.overload && mode !== 'rescue' ? (
          <p className={styles.mutedNote}>
            The rest stays off today. Rescue if the day has already collapsed.
          </p>
        ) : null}

        <label className={styles.goalDraft}>
          <span>Add one more, if needed</span>
          <textarea
            value={customLabel}
            onChange={(event) => setCustomLabel(event.target.value)}
            rows={2}
            placeholder="Something that is not on the list yet"
          />
        </label>

        <div className={styles.buttonRow}>
          <button type="button" className={styles.secondaryButton} onClick={() => setMode('minimum')}>
            Minimum
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => setMode('rescue')}>
            Rescue
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => setMode('restructure')}>
            Restructure
          </button>
        </div>
      </div>
      <div className={styles.flowFooter}>
        <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void confirm()}>
          Confirm this plan
        </button>
      </div>
    </div>
  );
}
