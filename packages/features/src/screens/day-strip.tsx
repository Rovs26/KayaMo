'use client';

import { shiftLogicalDate } from '@kayamo/food/quick-log';
import styles from './kayamo-app.module.css';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parts(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1));
}

export function DayStrip({
  todayLogical,
  selected,
  marked,
  onSelect,
}: {
  todayLogical: string;
  selected: string;
  marked: ReadonlySet<string>;
  onSelect: (logicalDate: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, index) => shiftLogicalDate(todayLogical, index - 6));
  return (
    <div className={styles.dayStrip} role="group" aria-label="Choose a day">
      {days.map((iso) => {
        const date = parts(iso);
        const on = iso === selected;
        const has = marked.has(iso);
        const label = `${DOW[date.getUTCDay()]} ${date.getUTCDate()}${iso === todayLogical ? ', today' : ''}`;
        return (
          <button
            key={iso}
            type="button"
            aria-pressed={on}
            aria-label={label}
            className={on ? styles.dayOn : styles.dayOff}
            onClick={() => onSelect(iso)}
          >
            <span>{DOW[date.getUTCDay()]?.slice(0, 3)}</span>
            <strong>{date.getUTCDate()}</strong>
            <i data-on={has ? '1' : '0'} />
          </button>
        );
      })}
    </div>
  );
}

export function PastDayBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <p className={styles.pastBanner}>
      You are looking at a past day. Anything you add lands on this date, not today.
    </p>
  );
}

export function WeekBars({
  todayLogical,
  kcalByDate,
  selected,
}: {
  todayLogical: string;
  kcalByDate: ReadonlyMap<string, number>;
  selected: string;
}) {
  const days = Array.from({ length: 7 }, (_, index) => shiftLogicalDate(todayLogical, index - 6));
  const max = Math.max(1, ...days.map((iso) => kcalByDate.get(iso) ?? 0));
  return (
    <div className={styles.weekCard}>
      <p className={styles.eyebrow}>Week</p>
      <div className={styles.weekBars} aria-hidden="true">
        {days.map((iso) => {
          const kcal = kcalByDate.get(iso) ?? 0;
          const height = kcal === 0 ? 4 : Math.max(12, Math.round((kcal / max) * 92));
          return (
            <div key={iso}>
              <b
                style={{ height: `${height}px` }}
                data-on={iso === selected ? '1' : '0'}
                data-empty={kcal === 0 ? '1' : '0'}
              />
              <span>{DOW[parts(iso).getUTCDay()]?.slice(0, 2)}</span>
            </div>
          );
        })}
      </div>
      <p>Bars show days with confirmed records. Empty days stay empty rather than counting as zero.</p>
    </div>
  );
}
