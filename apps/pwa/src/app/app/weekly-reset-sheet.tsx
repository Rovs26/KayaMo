'use client';

import type { AdaptivePattern, DeadlineRisk } from '@kayamo/core';
import { ArrowLeft } from '@phosphor-icons/react';
import type { LocalGoal } from '@kayamo/offline';
import styles from '@kayamo/features/app-shell.module.css';

export function WeeklyResetSheet({
  todayLogical,
  inboxCount,
  unfinishedTitles,
  forgottenTitles,
  durationNote,
  capacityNote,
  deadlineNotes,
  patterns,
  goals,
  onGoalStatus,
  onKeepPattern,
  onSkipPattern,
  onClose,
  onFinish,
}: {
  todayLogical: string;
  inboxCount: number;
  unfinishedTitles: string[];
  forgottenTitles: string[];
  durationNote: string | null;
  capacityNote: string | null;
  deadlineNotes: Array<{ goalId: string; title: string; risk: DeadlineRisk }>;
  patterns: AdaptivePattern[];
  goals: LocalGoal[];
  onGoalStatus: (id: string, status: 'active' | 'paused' | 'released' | 'completed') => Promise<void> | void;
  onKeepPattern: (pattern: AdaptivePattern) => Promise<void> | void;
  onSkipPattern: (pattern: AdaptivePattern) => void;
  onClose: () => void;
  onFinish: () => Promise<void> | void;
}) {
  const active = goals.filter((goal) => goal.status === 'active');
  return (
    <div className={`${styles.flowOverlay} ${styles.flowSolid}`}>
      <div className={styles.activeHeader}>
        <button type="button" className={styles.iconButton} aria-label="Close" onClick={onClose}>
          <ArrowLeft size={21} />
        </button>
        <h1>Weekly Reset</h1>
      </div>
      <div className={styles.flowScroll}>
        <p className={styles.flowLead}>
          A look at the week, not a score. Quiet days took nothing from the grove.
        </p>
        <p className={styles.mutedNote}>Week of {todayLogical}. Inbox still holding {inboxCount}.</p>

        <p className={styles.eyebrow}>From your records</p>
        {durationNote || capacityNote || deadlineNotes.length > 0 ? (
          <div className={styles.surfaceCard}>
            {durationNote ? <p>{durationNote}</p> : null}
            {capacityNote ? <p>{capacityNote}</p> : null}
            {deadlineNotes.map((row) => (
              <p key={row.goalId}>
                {row.title}: {row.risk.reason}
              </p>
            ))}
          </div>
        ) : (
          <p className={styles.emptyLine}>Not enough confirmed days yet for a pattern. That is allowed.</p>
        )}

        <p className={styles.eyebrow}>Forgotten · still not dumped onto today</p>
        {forgottenTitles.length === 0 ? (
          <p className={styles.emptyLine}>Nothing sitting idle from earlier.</p>
        ) : (
          <ul className={styles.plainList}>
            {forgottenTitles.slice(0, 8).map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        )}

        <p className={styles.eyebrow}>Unfinished · not dumped onto today</p>
        {unfinishedTitles.length === 0 ? (
          <p className={styles.emptyLine}>Nothing waiting from earlier in the week.</p>
        ) : (
          <ul className={styles.plainList}>
            {unfinishedTitles.slice(0, 8).map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        )}

        {patterns.length > 0 ? (
          <>
            <p className={styles.eyebrow}>Patterns · confirm or skip</p>
            {patterns.map((pattern) => (
              <div key={pattern.key} className={styles.surfaceCard}>
                <p>{pattern.statement}</p>
                <div className={styles.choiceRow}>
                  <button type="button" className={styles.choiceOn} onClick={() => void onKeepPattern(pattern)}>
                    Keep as a rule
                  </button>
                  <button type="button" className={styles.choiceOff} onClick={() => onSkipPattern(pattern)}>
                    Not that
                  </button>
                </div>
              </div>
            ))}
          </>
        ) : null}

        <p className={styles.eyebrow}>Goals · still matter?</p>
        {active.length === 0 ? (
          <p className={styles.emptyLine}>No active goals. That is allowed.</p>
        ) : (
          active.map((goal) => (
            <div key={goal.id} className={styles.surfaceCard}>
              <strong>{goal.title}</strong>
              <div className={styles.choiceRow}>
                <button type="button" className={styles.choiceOn} onClick={() => void onGoalStatus(goal.id, 'active')}>
                  Keep
                </button>
                <button type="button" className={styles.choiceOff} onClick={() => void onGoalStatus(goal.id, 'paused')}>
                  Pause
                </button>
                <button type="button" className={styles.choiceOff} onClick={() => void onGoalStatus(goal.id, 'released')}>
                  Set down
                </button>
                <button type="button" className={styles.choiceOff} onClick={() => void onGoalStatus(goal.id, 'completed')}>
                  It happened
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className={styles.flowFooter}>
        <button className={styles.primaryButton} type="button" onClick={() => void onFinish()}>
          Close the week
        </button>
      </div>
    </div>
  );
}
