'use client';

import {
  CIRCLE_KINDS,
  CIRCLE_KIND_LABELS,
  SHARE_FACETS,
  SHARE_FACET_LABELS,
  compileCircleShare,
  type CircleKind,
  type ShareFacet,
} from '@kayamo/core';
import { ArrowLeft } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import type { LocalCircle, LocalGoal } from '@kayamo/offline';
import styles from '@kayamo/features/app-shell.module.css';

export function CirclesScreen({
  socialEnabled,
  circles,
  goals,
  weekWorkoutCount,
  groveStageLabel,
  onSocial,
  onCreate,
  onUpdate,
  onRemove,
  onClose,
}: {
  socialEnabled: boolean;
  circles: LocalCircle[];
  goals: LocalGoal[];
  weekWorkoutCount: number;
  groveStageLabel: string;
  onSocial: (enabled: boolean) => void;
  onCreate: (input: { name: string; kind: CircleKind }) => Promise<string>;
  onUpdate: (input: {
    id: string;
    facets?: ShareFacet[];
    selectedGoalIds?: string[];
  }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CircleKind>('gym');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = circles.find((row) => row.id === selectedId) ?? null;
  const selectedTitles = useMemo(
    () =>
      goals
        .filter((goal) => selected?.selected_goal_ids.includes(goal.id))
        .map((goal) => goal.title),
    [goals, selected],
  );
  const preview = compileCircleShare({
    socialEnabled,
    name: selected?.name ?? name,
    kind: selected?.kind ?? kind,
    facets: selected?.facets ?? [],
    selectedGoalTitles: selectedTitles,
    weekWorkoutCount,
    groveStageLabel,
  });

  async function create() {
    const heading = name.trim();
    if (!heading || busy) return;
    setBusy(true);
    try {
      const id = await onCreate({ name: heading, kind });
      setName('');
      setSelectedId(id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${styles.flowOverlay} ${styles.flowSolid}`}>
      <div className={styles.activeHeader}>
        <button type="button" className={styles.iconButton} aria-label="Close" onClick={onClose}>
          <ArrowLeft size={21} />
        </button>
        <h1>Circles</h1>
      </div>
      <div className={styles.flowScroll}>
        <p className={styles.flowLead}>
          Circles are optional named groups with their own visibility. Social stays off until you turn
          it on. Nothing is published automatically.
        </p>
        <div className={styles.settingsGroup}>
          <button type="button" onClick={() => onSocial(!socialEnabled)} aria-pressed={socialEnabled}>
            <span>Social</span>
            <small>{socialEnabled ? 'on · still no invites' : 'off · nothing is published'}</small>
          </button>
          <p>There is no feed and no follower count. Invites are not sent in this slice.</p>
        </div>

        <p className={styles.eyebrow}>Name a Circle</p>
        <div className={styles.goalDraft}>
          <label>
            <span>Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Gym friends, thesis group"
            />
          </label>
        </div>
        <div className={styles.surfaceCard}>
          <div className={styles.choiceRow}>
            {CIRCLE_KINDS.map((row) => (
              <button
                key={row}
                type="button"
                className={kind === row ? styles.choiceOn : styles.choiceOff}
                aria-pressed={kind === row}
                onClick={() => setKind(row)}
              >
                {CIRCLE_KIND_LABELS[row]}
              </button>
            ))}
          </div>
        </div>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={!name.trim() || busy}
          onClick={() => void create()}
        >
          Keep on this device
        </button>
        <p className={styles.mutedNote}>Saved on this device. Nobody else is added for you.</p>

        <p className={styles.eyebrow}>On this device</p>
        {circles.length === 0 ? (
          <p className={styles.emptyLine}>
            No Circles yet. A Circle is not a follower list, and nobody else is added for you.
          </p>
        ) : (
          <div className={styles.settingsGroup}>
            {circles.map((row) => (
              <button key={row.id} type="button" onClick={() => setSelectedId(row.id)}>
                <span>{row.name}</span>
                <small>{CIRCLE_KIND_LABELS[row.kind]}</small>
              </button>
            ))}
          </div>
        )}

        {selected ? (
          <>
            <p className={styles.eyebrow}>What {selected.name} would see</p>
            <div className={styles.settingsGroup}>
              {SHARE_FACETS.map((facet) => {
                const on = selected.facets.includes(facet);
                return (
                  <button
                    key={facet}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      void onUpdate({
                        id: selected.id,
                        facets: on
                          ? selected.facets.filter((item) => item !== facet)
                          : [...selected.facets, facet],
                      })
                    }
                  >
                    <span>{SHARE_FACET_LABELS[facet]}</span>
                    <small>{on ? 'included' : 'not included'}</small>
                  </button>
                );
              })}
            </div>
            {selected.facets.includes('selected_goals') ? (
              <>
                <p className={styles.eyebrow}>Goals for this Circle</p>
                {goals.length === 0 ? (
                  <p className={styles.emptyLine}>No active goals to pick yet.</p>
                ) : (
                  <div className={styles.settingsGroup}>
                    {goals.map((goal) => {
                      const on = selected.selected_goal_ids.includes(goal.id);
                      return (
                        <button
                          key={goal.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            void onUpdate({
                              id: selected.id,
                              selectedGoalIds: on
                                ? selected.selected_goal_ids.filter((id) => id !== goal.id)
                                : [...selected.selected_goal_ids, goal.id],
                            })
                          }
                        >
                          <span>{goal.title}</span>
                          <small>{on ? 'visible to this Circle' : 'private'}</small>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : null}
            <p className={styles.mutedNote}>{preview.note}</p>
            {preview.wouldSee.length > 0 ? (
              <div className={styles.readingStack}>
                {preview.wouldSee.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : null}
            <p className={styles.eyebrow}>Never included</p>
            <p className={styles.mutedNote}>{preview.withheld.join(' · ')}</p>
            <div className={styles.settingsGroup}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  void onRemove(selected.id);
                }}
              >
                <span>Remove this Circle</span>
                <small>Stays off this device. Nothing was published.</small>
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
