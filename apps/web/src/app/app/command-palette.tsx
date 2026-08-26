'use client';

import { FOOD_HISTORY_FILTER_ID } from '@kayamo/features';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import styles from './shell.module.css';

export function CommandPalette() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [logStub, setLogStub] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (dialog.open) dialog.close();
      else dialog.showModal();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function goFood(focusFilter = false) {
    dialogRef.current?.close();
    router.push('/app/food');
    if (!focusFilter) return;
    window.setTimeout(() => {
      document.getElementById(FOOD_HISTORY_FILTER_ID)?.focus();
    }, 50);
  }

  return (
    <>
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId}>
        <h2 id={titleId}>Jump</h2>
        <p>Keyboard-first. Logging still happens on your phone.</p>
        <div className={styles.nav}>
          <button type="button" onClick={() => goFood()}>
            Food history
          </button>
          <button type="button" onClick={() => goFood(true)}>
            Filter food history
          </button>
          <button type="button" onClick={() => setLogStub(true)}>
            Log food
          </button>
        </div>
        {logStub ? (
          <p role="status">
            Search and log land with the food-search feature next. No barcode on desktop.
          </p>
        ) : null}
      </dialog>
    </>
  );
}
