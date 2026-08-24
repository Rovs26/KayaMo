'use client';

import {
  ArrowLeft,
  CaretRight,
  DeviceMobile,
  Moon,
  Sparkle,
  Sun,
  UserCircle,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { SignOutButton } from './sign-out-button';
import styles from './kayamo-app.module.css';

type Theme = 'system' | 'day' | 'night';

export function SettingsScreen({
  email,
  theme,
  onTheme,
  faithEnabled,
  onFaith,
  reminderEnabled,
  onReminder,
  musMayReadIdentity,
  onMusMayReadIdentity,
  bodyRows,
  dayRows,
  onEditBody,
  onBack,
}: {
  email: string;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  faithEnabled: boolean;
  onFaith: (enabled: boolean) => void;
  reminderEnabled: boolean;
  onReminder: (enabled: boolean) => void;
  musMayReadIdentity: boolean;
  onMusMayReadIdentity: (enabled: boolean) => void;
  bodyRows: Array<{ id: string; label: string; value: string }>;
  dayRows: Array<{ id: string; label: string; value: string }>;
  onEditBody: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div className={`${styles.flowOverlay} ${styles.flowSolid}`}>
      <div className={styles.activeHeader}>
        <button type="button" className={styles.iconButton} aria-label="Back to Grove" onClick={onBack}>
          <ArrowLeft size={21} />
        </button>
        <h1>Settings</h1>
      </div>
      <div className={styles.flowScroll}>
        <div className={styles.settingsIdentity}>
          <UserCircle size={34} />
          <div>
            <p>{email}</p>
            <small>signed in · this device</small>
          </div>
        </div>

        <p className={styles.eyebrow}>Body and targets</p>
        <div className={styles.settingsGroup}>
          {bodyRows.map((row) => (
            <button key={row.id} type="button" onClick={() => onEditBody(row.id)}>
              <span>{row.label}</span>
              <small>{row.value}</small>
              <CaretRight size={15} />
            </button>
          ))}
          <p>Targets recompute in code from these numbers. Mus never sets them.</p>
        </div>

        <p className={styles.eyebrow}>Appearance</p>
        <div className={styles.surfaceCard}>
          <div className={styles.choiceRow}>
            {(
              [
                { id: 'system' as const, label: 'System', Icon: Sparkle },
                { id: 'day' as const, label: 'Day', Icon: Sun },
                { id: 'night' as const, label: 'Night', Icon: Moon },
              ] as const
            ).map((row) => (
              <button
                key={row.id}
                type="button"
                className={theme === row.id ? styles.choiceOn : styles.choiceOff}
                aria-pressed={theme === row.id}
                onClick={() => onTheme(row.id)}
              >
                <row.Icon size={16} />
                {row.label}
              </button>
            ))}
          </div>
        </div>

        <p className={styles.eyebrow}>Day and reminders</p>
        <div className={styles.settingsGroup}>
          {dayRows.map((row) => (
            <button key={row.id} type="button" onClick={() => onEditBody(row.id)}>
              <span>{row.label}</span>
              <small>{row.value}</small>
              <CaretRight size={15} />
            </button>
          ))}
          <button type="button" onClick={() => onFaith(!faithEnabled)}>
            <span>Faith mode</span>
            <small>{faithEnabled ? 'on' : 'off'}</small>
            <CaretRight size={15} />
          </button>
          <button type="button" onClick={() => onReminder(!reminderEnabled)}>
            <span>One quiet reminder</span>
            <small>{reminderEnabled ? 'on' : 'off'}</small>
            <CaretRight size={15} />
          </button>
        </div>

        <p className={styles.eyebrow}>What Mus may read</p>
        <div className={styles.settingsGroup}>
          <button type="button" onClick={() => onMusMayReadIdentity(!musMayReadIdentity)}>
            <span>Future self and compass</span>
            <small>{musMayReadIdentity ? 'Mus may read' : 'Private from Mus'}</small>
            <CaretRight size={15} />
          </button>
          <p>Life Inbox stays private until you allow a specific item. Storage is not automatic access.</p>
        </div>

        <p className={styles.eyebrow}>Privacy</p>
        <div className={styles.surfaceCard}>
          <div className={styles.privacyLead}>
            <DeviceMobile size={21} />
            <p>
              Diary, venting and prayer entries stay on this device. They leave it only when you tap{' '}
              <b>Remember this</b> on a message.
            </p>
          </div>
          <Link className={styles.settingsRowLink} href="/about">
            Food data and privacy notes <CaretRight size={15} />
          </Link>
        </div>

        <div className={styles.signOutWide}>
          <SignOutButton />
        </div>
        <p className={styles.buildStamp}>KayaMo · ph.kayamo.app</p>
      </div>
    </div>
  );
}
