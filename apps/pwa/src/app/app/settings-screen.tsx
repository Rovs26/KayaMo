'use client';

import {
  ACTION_LEVEL_LABELS,
  COMPLEXITY_LABELS,
  COMPLEXITY_LEVELS,
  type ComplexityLevel,
  type IntegrationStatus,
} from '@kayamo/core';
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
  integrations,
  onGrant,
  bodyRows,
  dayRows,
  onEditBody,
  onBack,
  complexity,
  onComplexity,
  onExportArchive,
  onExportEvidence,
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
  integrations: IntegrationStatus[];
  onGrant: (id: IntegrationStatus['id']) => void;
  bodyRows: Array<{ id: string; label: string; value: string }>;
  dayRows: Array<{ id: string; label: string; value: string }>;
  onEditBody: (id: string) => void;
  onBack: () => void;
  complexity: ComplexityLevel;
  onComplexity: (level: ComplexityLevel) => void;
  onExportArchive: () => void;
  onExportEvidence: () => void;
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

        <p className={styles.eyebrow}>What Mus can do</p>
        <div className={styles.settingsGroup}>
          {integrations.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onGrant(row.id)}
              aria-label={`${row.title}. ${row.connected ? 'Available here' : 'Not connected'}. ${ACTION_LEVEL_LABELS[row.level]}. ${row.restriction}`}
            >
              <span>{row.title}</span>
              <small>
                {row.connected ? 'Available here' : 'Not connected'} · {ACTION_LEVEL_LABELS[row.level]}
              </small>
              <CaretRight size={15} />
            </button>
          ))}
          <p>
            Tap to switch Suggest and Act with permission. Auto-manage is off. Calendar, health, and
            wearables stay disconnected until a real native connection exists — nothing here is faked.
          </p>
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

        <p className={styles.eyebrow}>How much to show · Mus Lite</p>
        <div className={styles.surfaceCard}>
          <div className={styles.choiceRow}>
            {COMPLEXITY_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                className={complexity === level ? styles.choiceOn : styles.choiceOff}
                aria-pressed={complexity === level}
                onClick={() => onComplexity(level)}
              >
                {COMPLEXITY_LABELS[level]}
              </button>
            ))}
          </div>
          <p className={styles.mutedNote}>
            Simple hides extra notes. Export, privacy, and your records stay available.
          </p>
        </div>

        <p className={styles.eyebrow}>Your archive · always free</p>
        <div className={styles.settingsGroup}>
          <button type="button" onClick={onExportArchive}>
            <span>Download Life Archive</span>
            <small>Markdown of story, goals, and becoming — not health numbers</small>
            <CaretRight size={15} />
          </button>
          <button type="button" onClick={onExportEvidence}>
            <span>Download Evidence Bank</span>
            <small>Work you marked as professional. Not a generated CV.</small>
            <CaretRight size={15} />
          </button>
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
