'use client';

import { ArrowLeft } from '@phosphor-icons/react';
import type { LocalGoal } from '@kayamo/offline';
import styles from './kayamo-app.module.css';

export function WeeklyResetSheet({
  todayLogical,
  inboxCount,
  unfinishedTitles,
  goals,
  onGoalStatus,
  onClose,
  onFinish,
}: {
  todayLogical: string;
  inboxCount: number;
  unfinishedTitles: string[];
  goals: LocalGoal[];
  onGoalStatus: (id: string, status: 'active' | 'paused' | 'released' | 'completed') => Promise<void> | void;
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
