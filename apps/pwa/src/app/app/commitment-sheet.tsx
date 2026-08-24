'use client';

import { ArrowLeft } from '@phosphor-icons/react';
import { useState } from 'react';
import styles from './kayamo-app.module.css';

export function CommitmentSheet({
  logicalDate,
  onClose,
  onSave,
}: {
  logicalDate: string;
  onClose: () => void;
  onSave: (input: { title: string; startsAt: string | null; endsAt: string | null }) => Promise<void> | void;
}) {
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const heading = title.trim();
    if (!heading || busy) return;
    setBusy(true);
    try {
      await onSave({
        title: heading,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
      });
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
        <h1>Already committed</h1>
      </div>
      <div className={styles.flowScroll}>
        <p className={styles.flowLead}>
          This is a hour you already gave away. It is not a Google or Apple calendar sync.
        </p>
        <p className={styles.mutedNote}>For {logicalDate}.</p>
        <div className={styles.goalDraft}>
          <label>
            <span>What is it</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Class, shift, appointment" />
          </label>
          <label>
            <span>Starts · optional</span>
            <input type="time" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          </label>
          <label>
            <span>Ends · optional</span>
            <input type="time" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
          </label>
        </div>
      </div>
      <div className={styles.flowFooter}>
        <button className={styles.primaryButton} type="button" disabled={!title.trim() || busy} onClick={() => void save()}>
          Save on this device
        </button>
      </div>
    </div>
  );
}
