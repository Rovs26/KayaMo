'use client';

import {
  LIFE_AREA_LABELS,
  LIFE_AREAS,
  type LifeArea,
} from '@kayamo/core';
import {
  createLocalTask,
  saveLocalCompass,
  saveLocalDailyPlan,
  saveLocalFutureSelf,
} from '@kayamo/offline';
import {
  ArrowLeft,
  BookOpenText,
  ChatCircle,
  Footprints,
  Tree,
} from '@phosphor-icons/react';
import Image from 'next/image';
import { useState } from 'react';
import styles from '@kayamo/features/app-shell.module.css';

const SEEDS = [
  { id: 'step', label: 'One honest next step I can finish today', Icon: Tree },
  { id: 'walk', label: 'A twenty minute walk', Icon: Footprints },
  { id: 'talk', label: 'Message someone I care about', Icon: ChatCircle },
  { id: 'sit', label: 'Sit still for five minutes', Icon: BookOpenText },
] as const;

function pressed(on: boolean) {
  return on ? styles.choiceOn : styles.choiceOff;
}

export function FirstRun({
  userId,
  logicalDate,
  onDone,
}: {
  userId: string;
  logicalDate: string;
  onDone: () => Promise<void> | void;
}) {
  const [step, setStep] = useState(1);
  const [statement, setStatement] = useState('');
  const [areas, setAreas] = useState<LifeArea[]>([]);
  const [mattersNow, setMattersNow] = useState('');
  const [unsure, setUnsure] = useState(false);
  const [seed, setSeed] = useState<(typeof SEEDS)[number]['id']>('step');
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);

  function toggleArea(area: LifeArea) {
    setAreas((current) =>
      current.includes(area) ? current.filter((row) => row !== area) : [...current, area],
    );
  }

  async function finish() {
    setBusy(true);
    const label = custom.trim() || SEEDS.find((row) => row.id === seed)?.label || 'One honest next step';
    try {
      if (statement.trim()) {
        await saveLocalFutureSelf({ userId, statement: statement.trim() });
      }
      if (areas.length > 0 || mattersNow.trim() || unsure) {
        await saveLocalCompass({
          userId,
          activeAreas: areas,
          mattersNow: unsure ? 'I don’t know yet.' : mattersNow.trim() || null,
        });
      }
      const task = await createLocalTask({ userId, title: label, scheduledFor: logicalDate });
      await saveLocalDailyPlan({
        userId,
        logicalDate,
        actionKind: 'task',
        recordId: task.id,
        label,
        completeMorning: true,
        planMode: 'standard',
      });
    } catch {
      // Offline: Dexie writes still stand.
    } finally {
      localStorage.setItem('kayamo:first-run-done', '1');
      setBusy(false);
      await onDone();
    }
  }

  function next() {
    if (step < 4) {
      setStep(step + 1);
      return;
    }
    void finish();
  }

  return (
    <div className={styles.flowOverlay}>
      <div className={styles.flowWash} aria-hidden="true" />
      <div className={styles.flowTop}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Previous question"
          disabled={step === 1}
          onClick={() => setStep((current) => Math.max(1, current - 1))}
        >
          <ArrowLeft size={21} />
        </button>
        <div className={styles.frDots} role="group" aria-label={`Step ${step} of 4`}>
          {[1, 2, 3, 4].map((n) => (
            <i key={n} data-on={n <= step ? '1' : '0'} data-now={n === step ? '1' : '0'} />
          ))}
        </div>
        <button type="button" className={styles.textLink} onClick={next}>
          Skip
        </button>
      </div>
      <div className={styles.flowScroll}>
        <div className={styles.frAsk}>
          <Image src="/coco-seed.png" alt="Mus" width={56} height={56} />
          <div>
            <h1>
              {step === 1
                ? 'Who are you trying to become?'
                : step === 2
                  ? 'What parts of life matter now?'
                  : step === 3
                    ? 'What matters most this season?'
                    : 'One useful first plan.'}
            </h1>
            <p>
              {step === 1
                ? 'A sentence is enough. You can change it any week. Mus may read this unless you turn that off later.'
                : step === 2
                  ? 'Pick a few. Skip the rest. Hidden areas stay gone without rebuilding the app.'
                  : step === 3
                    ? 'Compass, not a life audit. “I don’t know yet” is a complete answer.'
                    : 'Small is fine. Home looks better with one honest thing on it than with nothing.'}
            </p>
          </div>
        </div>

        {step === 1 ? (
          <label className={styles.goalDraft}>
            <span>Your words</span>
            <textarea
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              rows={4}
              placeholder="Someone who keeps promises to myself…"
            />
          </label>
        ) : null}

        {step === 2 ? (
          <div className={styles.frStack}>
            <div className={styles.choiceColumn}>
              {LIFE_AREAS.map((area) => (
                <button
                  key={area}
                  type="button"
                  className={pressed(areas.includes(area))}
                  aria-pressed={areas.includes(area)}
                  onClick={() => toggleArea(area)}
                >
                  {LIFE_AREA_LABELS[area]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className={styles.frStack}>
            <label className={styles.goalDraft}>
              <span>This season</span>
              <textarea
                value={mattersNow}
                onChange={(event) => {
                  setMattersNow(event.target.value);
                  if (event.target.value.trim()) setUnsure(false);
                }}
                rows={3}
                disabled={unsure}
                placeholder="Work that does not drain me, Sunday rest…"
              />
            </label>
            <button
              type="button"
              className={pressed(unsure)}
              aria-pressed={unsure}
              onClick={() => {
                setUnsure((current) => !current);
                if (!unsure) setMattersNow('');
              }}
            >
              I don’t know yet
            </button>
          </div>
        ) : null}

        {step === 4 ? (
          <div className={styles.frStack}>
            <div className={styles.choiceColumn}>
              {SEEDS.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={pressed(seed === row.id && !custom.trim())}
                  aria-pressed={seed === row.id && !custom.trim()}
                  onClick={() => {
                    setSeed(row.id);
                    setCustom('');
                  }}
                >
                  <row.Icon size={19} />
                  {row.label}
                </button>
              ))}
            </div>
            <label className={styles.goalDraft}>
              <span>Or write your own</span>
              <textarea
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                rows={2}
                placeholder="One thing I can actually do today"
              />
            </label>
          </div>
        ) : null}
      </div>
      <div className={styles.flowFooter}>
        <button className={styles.primaryButton} type="button" disabled={busy} onClick={next}>
          {step === 4 ? 'Start with Mus' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
