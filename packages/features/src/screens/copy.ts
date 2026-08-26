import {
  COMPANION_EVENT_POINTS,
  COMPANION_EVENT_TYPES,
  type CompanionEventType,
} from '@kayamo/core';

export function titleDate(date: Date): string {
  return new Intl.DateTimeFormat('en', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(date);
}

export function greeting(date: Date): string {
  const hour = date.getHours();
  return hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';
}

export function remainingClock(endsAt: string | null, now: number, maximumSeconds = 25 * 60): string {
  if (!endsAt) return '25:00';
  const seconds = Math.min(maximumSeconds, Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000)));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function stageLabel(stage: string): string {
  return stage.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function progressionEvent(eventKey: string, sourceLabel?: string): { label: string; points: number; detail: string } {
  const [rawType = '', sourceTable = 'confirmed activity'] = eventKey.split(':');
  const eventType = COMPANION_EVENT_TYPES.includes(rawType as CompanionEventType)
    ? rawType as CompanionEventType
    : null;
  return {
    label: sourceLabel ?? (eventType ? stageLabel(eventType) : 'Confirmed action'),
    points: eventType ? COMPANION_EVENT_POINTS[eventType] : 0,
    detail: sourceTable.replaceAll('_', ' '),
  };
}

