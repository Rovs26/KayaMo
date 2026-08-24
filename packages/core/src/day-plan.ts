export const DAY_CAPACITIES = ['great', 'normal', 'low', 'overwhelmed', 'sick'] as const;
export type DayCapacity = (typeof DAY_CAPACITIES)[number];

export const DAY_INTENTS = [
  'focused',
  'calm',
  'recovery',
  'family',
  'get_things_done',
] as const;
export type DayIntent = (typeof DAY_INTENTS)[number];

export const PLAN_MODES = ['standard', 'minimum', 'rescue', 'restructure'] as const;
export type PlanMode = (typeof PLAN_MODES)[number];

export const DAY_CAPACITY_LABELS: Record<DayCapacity, string> = {
  great: 'Great',
  normal: 'Normal',
  low: 'Low energy',
  overwhelmed: 'Overwhelmed',
  sick: 'Sick',
};

export const DAY_INTENT_LABELS: Record<DayIntent, string> = {
  focused: 'Focused',
  calm: 'Calm',
  recovery: 'Recovery',
  family: 'Family',
  get_things_done: 'Get things done',
};

export const PLAN_MODE_LABELS: Record<PlanMode, string> = {
  standard: 'Plan My Day',
  minimum: 'Minimum Day',
  rescue: 'Rescue My Day',
  restructure: 'Restructure',
};

export type DayPlanCandidate = {
  id: string;
  title: string;
  source: 'task' | 'inbox' | 'goal' | 'habit' | 'workout';
  sourceId: string;
};

export type DayPlanItem = DayPlanCandidate & {
  reason: string;
  suggested: boolean;
};

export type DayPlanProposal = {
  mode: PlanMode;
  limit: number;
  overload: boolean;
  welcomeBack: boolean;
  yesterdayNote: string | null;
  items: DayPlanItem[];
};

const CAPACITY_LIMIT: Record<DayCapacity, number> = {
  great: 3,
  normal: 3,
  low: 2,
  overwhelmed: 1,
  sick: 1,
};

export function daysBetweenLogical(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

export function shiftLogicalDateUtc(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function suggestedPlanLimit(
  capacity: DayCapacity,
  returningAfterDays: number,
  busyHours = 0,
): number {
  const base = CAPACITY_LIMIT[capacity];
  const afterReturn = returningAfterDays >= 2 ? 1 : base;
  const reduction = Math.floor(Math.max(0, busyHours) / 3);
  return Math.max(1, afterReturn - reduction);
}

export function proposedPlanMode(capacity: DayCapacity, explicit?: PlanMode): PlanMode {
  if (explicit) return explicit;
  if (capacity === 'overwhelmed' || capacity === 'sick' || capacity === 'low') return 'minimum';
  return 'standard';
}

function reasonFor(
  candidate: DayPlanCandidate,
  index: number,
  input: { welcomeBack: boolean; mode: PlanMode; yesterdayNote: string | null },
): string {
  if (input.welcomeBack && index === 0) {
    return 'One realistic step back. Quiet days took nothing away.';
  }
  if (input.mode === 'minimum') {
    return 'Kept as a meaningful minimum.';
  }
  if (input.mode === 'rescue') {
    return 'Still has to happen in the time that is left.';
  }
  if (input.mode === 'restructure') {
    return 'Fits the remaining day after the disruption.';
  }
  if (candidate.source === 'goal') return 'Next step on the goal you confirmed.';
  if (candidate.source === 'inbox') return 'From Life Inbox, after you confirm it.';
  if (candidate.source === 'habit') return 'A gentle repeat, not a streak to protect.';
  if (candidate.source === 'workout') return 'Training on today, if you still want it.';
  if (input.yesterdayNote && index === 0) {
    return 'Carried from last night’s reflection, if you still want it.';
  }
  return 'Already on today.';
}

export function proposeDayPlan(input: {
  candidates: readonly DayPlanCandidate[];
  capacity: DayCapacity;
  mode?: PlanMode;
  yesterdayNote?: string | null;
  returningAfterDays?: number;
  keepIds?: readonly string[];
  busyHours?: number;
}): DayPlanProposal {
  const returningAfterDays = input.returningAfterDays ?? 0;
  const welcomeBack = returningAfterDays >= 2;
  const mode = proposedPlanMode(input.capacity, input.mode);
  const keep = input.keepIds ? new Set(input.keepIds) : null;
  const limit = keep
    ? keep.size
    : suggestedPlanLimit(input.capacity, returningAfterDays, input.busyHours ?? 0);
  const ordered = [...input.candidates];
  const items: DayPlanItem[] = ordered.map((candidate, index) => {
    const suggested = keep ? keep.has(candidate.id) : index < limit;
    return {
      ...candidate,
      suggested,
      reason: reasonFor(candidate, index, {
        welcomeBack,
        mode,
        yesterdayNote: input.yesterdayNote ?? null,
      }),
    };
  });
  return {
    mode,
    limit,
    overload: ordered.length > limit,
    welcomeBack,
    yesterdayNote: input.yesterdayNote?.trim() || null,
    items,
  };
}

export function weeklyResetDue(
  lastResetOn: string | null,
  todayLogical: string,
): boolean {
  if (!lastResetOn) {
    return new Date(`${todayLogical}T00:00:00.000Z`).getUTCDay() === 0;
  }
  return daysBetweenLogical(lastResetOn, todayLogical) >= 7;
}
