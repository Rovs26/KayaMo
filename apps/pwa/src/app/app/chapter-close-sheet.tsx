'use client';

import { chapterCloseReady, type ChapterCloseInput } from '@kayamo/core';
import { ArrowLeft } from '@phosphor-icons/react';
import { useState } from 'react';
import styles from '@kayamo/features/app-shell.module.css';

const EMPTY: ChapterCloseInput = {
  changed: '',
  accomplished: '',
  letGo: '',
  learned: '',
  carries: '',
};

export function ChapterCloseSheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (fields: ChapterCloseInput) => Promise<void> | void;
}) {
  const [fields, setFields] = useState<ChapterCloseInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const ready = chapterCloseReady(fields);

  async function save() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await onSave(fields);
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
        <h1>Close this chapter</h1>
      </div>
      <div className={styles.flowScroll}>
        <p className={styles.flowLead}>
          The grove keeps every confirmed point. Closing a chapter does not take anything away.
        </p>
        <div className={styles.goalDraft}>
          <label>
            <span>What changed</span>
            <textarea value={fields.changed} rows={2} onChange={(event) => setFields({ ...fields, changed: event.target.value })} />
          </label>
          <label>
            <span>What was accomplished</span>
            <textarea value={fields.accomplished} rows={2} onChange={(event) => setFields({ ...fields, accomplished: event.target.value })} />
          </label>
          <label>
            <span>What was let go</span>
            <textarea value={fields.letGo} rows={2} onChange={(event) => setFields({ ...fields, letGo: event.target.value })} />
          </label>
          <label>
            <span>What was learned</span>
            <textarea value={fields.learned} rows={2} onChange={(event) => setFields({ ...fields, learned: event.target.value })} />
          </label>
          <label>
            <span>What carries forward</span>
            <textarea value={fields.carries} rows={2} onChange={(event) => setFields({ ...fields, carries: event.target.value })} />
          </label>
        </div>
      </div>
      <div className={styles.flowFooter}>
        <button className={styles.primaryButton} type="button" disabled={!ready || busy} onClick={() => void save()}>
          Keep this in Life Story
        </button>
      </div>
    </div>
  );
}
