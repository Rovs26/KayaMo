import {
  daysBetweenLogical,
  suggestedPlanLimit,
  type DayCapacity,
} from './day-plan';

const CAPACITY_ORDER: DayCapacity[] = ['sick', 'overwhelmed', 'low', 'normal', 'great'];

export type FocusDurationSample = {
  plannedMinutes: number;
  actualMinutes: number;
};

export type LearnedDuration = {
  minutes: number;
  sampleCount: number;
  typical: 'shorter' | 'as_planned' | 'longer';
};

export type CapacityHistoryDay = {
  capacity: DayCapacity | null;
  planned: number;
  completed: number;
};

export type DeadlineRisk = {
  level: 'none' | 'watch' | 'tight' | 'overdue';
  daysLeft: number | null;
  reason: string;
};

export type ForgottenItem = {
  kind: 'inbox' | 'task';
  id: string;
  title: string;
  idleDays: number;
};

export type AdaptivePattern = {
  key: string;
  kind: 'duration' | 'capacity' | 'forgotten' | 'deadline' | 'weekday';
  statement: string;
};

export function actualMinutesBetween(startedAt: string, endedAt: string): number {
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60_000);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return Math.round(value);
}

export function learnedFocusMinutes(
  samples: readonly FocusDurationSample[],
): LearnedDuration | null {
  const usable = samples.filter((row) => row.actualMinutes >= 3 && row.actualMinutes <= 180);
  if (usable.length < 3) return null;
  const minutes = Math.min(90, Math.max(5, median(usable.map((row) => row.actualMinutes))));
  const planned = median(usable.map((row) => row.plannedMinutes));
  const typical =
    minutes <= planned * 0.75 ? 'shorter' : minutes >= planned * 1.25 ? 'longer' : 'as_planned';
  return { minutes, sampleCount: usable.length, typical };
}

function stepDown(capacity: DayCapacity): DayCapacity {
  const index = CAPACITY_ORDER.indexOf(capacity);
  return CAPACITY_ORDER[Math.max(0, index - 1)] ?? 'low';
}

/** Suggests a capacity from confirmed days. Never invents a busier day than the last one named. */
export function estimateCapacityFromHistory(
  days: readonly CapacityHistoryDay[],
): DayCapacity | null {
  const named = days.filter((day) => day.capacity !== null) as Array<
    CapacityHistoryDay & { capacity: DayCapacity }
  >;
  if (named.length < 3) return named.at(0)?.capacity ?? null;
  const recent = named[0]!.capacity;
  const overstated = named.filter((day) => {
    if (day.capacity !== 'great' && day.capacity !== 'normal') return false;
    const cap = suggestedPlanLimit(day.capacity, 0);
    return day.planned >= cap && day.completed < Math.ceil(cap / 2);
  });
  if (overstated.length >= 3 && overstated.length * 2 >= named.length) {
    return stepDown(recent);
  }
  return recent;
}

export function deadlineRisk(input: {
  today: string;
  targetDate: string | null | undefined;
  remainingSteps: number;
}): DeadlineRisk {
  if (!input.targetDate) {
    return { level: 'none', daysLeft: null, reason: '' };
  }
  const daysLeft = daysBetweenLogical(input.today, input.targetDate);
  if (daysLeft < 0) {
    return {
      level: 'overdue',
      daysLeft,
      reason: 'The date passed. The goal is still yours to keep, pause, or set down.',
    };
  }
  if (input.remainingSteps > daysLeft) {
    return {
      level: 'tight',
      daysLeft,
      reason: `More remaining steps (${input.remainingSteps}) than days left (${daysLeft}). A smaller next step is allowed.`,
    };
  }
  if (input.remainingSteps > 0 && input.remainingSteps === daysLeft) {
    return {
      level: 'watch',
      daysLeft,
      reason: 'One step a day would meet the date, if you still want that date.',
    };
  }
  return { level: 'none', daysLeft, reason: '' };
}

export function goalPlausibility(input: {
  remainingSteps: number;
  daysLeft: number | null;
  typicalStepsPerWeek?: number;
}): { ok: boolean; reason: string } {
  const weekly = input.typicalStepsPerWeek ?? 2;
  if (input.daysLeft === null) {
    return { ok: true, reason: 'No date is set, so pace stays in your hands.' };
  }
  if (input.daysLeft < 0) {
    return { ok: true, reason: 'The date passed. Setting it down takes nothing from the grove.' };
  }
  const weeks = Math.max(input.daysLeft / 7, 1 / 7);
  const expected = weekly * weeks;
  if (input.remainingSteps > expected * 1.5) {
    return {
      ok: false,
      reason: 'At a gentle pace this date looks tight. Shrink the work, move the date, or keep only the next step.',
    };
  }
  return { ok: true, reason: 'The remaining steps can fit a gentle weekly pace.' };
}

export function forgottenItems(input: {
  today: string;
  inbox: readonly { id: string; content: string; createdAt: string }[];
  openTasks: readonly {
    id: string;
    title: string;
    createdAt: string;
    scheduledFor: string | null;
  }[];
}): ForgottenItem[] {
  const items: ForgottenItem[] = [];
  for (const row of input.inbox) {
    const idleDays = daysBetweenLogical(row.createdAt.slice(0, 10), input.today);
    if (idleDays >= 7) {
      items.push({ kind: 'inbox', id: row.id, title: row.content, idleDays });
    }
  }
  for (const row of input.openTasks) {
    const createdDay = row.createdAt.slice(0, 10);
    const idleDays = daysBetweenLogical(createdDay, input.today);
    const pastSchedule = Boolean(row.scheduledFor && row.scheduledFor < input.today);
    if (pastSchedule || (!row.scheduledFor && idleDays >= 3)) {
      items.push({ kind: 'task', id: row.id, title: row.title, idleDays });
    }
  }
  return items.sort((a, b) => b.idleDays - a.idleDays);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function busiestWeekday(presenceDates: readonly string[]): {
  weekday: string;
  count: number;
} | null {
  if (presenceDates.length < 8) return null;
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const iso of presenceDates) {
    const day = new Date(`${iso}T00:00:00.000Z`).getUTCDay();
    counts[day] = (counts[day] ?? 0) + 1;
  }
  let best = 0;
  for (let i = 1; i < 7; i += 1) {
    if (counts[i]! > counts[best]!) best = i;
  }
  const mean = presenceDates.length / 7;
  if (counts[best]! < 3 || counts[best]! < mean * 1.5) return null;
  return { weekday: WEEKDAYS[best]!, count: counts[best]! };
}

export function proposeAdaptivePatterns(input: {
  learned: LearnedDuration | null;
  estimatedCapacity: DayCapacity | null;
  forgotten: readonly ForgottenItem[];
  deadline: { goalTitle: string; risk: DeadlineRisk } | null;
  busiest: { weekday: string; count: number } | null;
  skipKeys?: readonly string[];
}): AdaptivePattern[] {
  const skip = new Set(input.skipKeys ?? []);
  const patterns: AdaptivePattern[] = [];
  if (input.learned?.typical === 'shorter') {
    patterns.push({
      key: 'duration:shorter',
      kind: 'duration',
      statement: `Focus often lands near ${input.learned.minutes} minutes. A shorter block is still a real block.`,
    });
  }
  if (input.estimatedCapacity === 'low' || input.estimatedCapacity === 'overwhelmed') {
    patterns.push({
      key: 'capacity:overstated',
      kind: 'capacity',
      statement:
        'Fuller days on the picker often still finished one thing. A smaller plan is allowed.',
    });
  }
  const forgottenInbox = input.forgotten.filter((row) => row.kind === 'inbox').length;
  if (forgottenInbox >= 1) {
    patterns.push({
      key: 'forgotten:inbox',
      kind: 'forgotten',
      statement: `${forgottenInbox === 1 ? 'A thought has' : `${forgottenInbox} thoughts have`} sat in Life Inbox for more than a week. Review is not a dump onto today.`,
    });
  }
  if (input.deadline && (input.deadline.risk.level === 'tight' || input.deadline.risk.level === 'overdue')) {
    patterns.push({
      key: `deadline:${input.deadline.goalTitle}`,
      kind: 'deadline',
      statement: `“${input.deadline.goalTitle}” ${input.deadline.risk.reason}`,
    });
  }
  if (input.busiest) {
    patterns.push({
      key: `weekday:${input.busiest.weekday}`,
      kind: 'weekday',
      statement: `Confirmed actions showed up most on ${input.busiest.weekday}s. That is a note, not a rule.`,
    });
  }
  return patterns.filter((row) => !skip.has(row.key));
}
