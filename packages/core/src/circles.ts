import { shiftLogicalDateUtc } from './day-plan';

export const CIRCLE_KINDS = ['family', 'gym', 'study', 'church', 'startup', 'custom'] as const;
export type CircleKind = (typeof CIRCLE_KINDS)[number];

export const CIRCLE_KIND_LABELS: Record<CircleKind, string> = {
  family: 'Family',
  gym: 'Gym friends',
  study: 'Study group',
  church: 'Church group',
  startup: 'Startup accountability',
  custom: 'Custom',
};

export const SHARE_FACETS = ['workout_count', 'selected_goals', 'grove_stage'] as const;
export type ShareFacet = (typeof SHARE_FACETS)[number];

export const SHARE_FACET_LABELS: Record<ShareFacet, string> = {
  workout_count: 'Confirmed workouts this week',
  selected_goals: 'Goals you pick',
  grove_stage: 'Grove stage name',
};

export const ALWAYS_WITHHELD = [
  'Calories and macros',
  'Weight',
  'Journals',
  'Faith and prayer',
  'Money',
  'Life Inbox',
] as const;

export const DEFAULT_FACETS: Record<CircleKind, readonly ShareFacet[]> = {
  family: ['selected_goals'],
  gym: ['workout_count'],
  study: ['selected_goals'],
  church: ['selected_goals'],
  startup: ['selected_goals'],
  custom: [],
};

export function isCircleKind(value: string): value is CircleKind {
  return (CIRCLE_KINDS as readonly string[]).includes(value);
}

export function isShareFacet(value: string): value is ShareFacet {
  return (SHARE_FACETS as readonly string[]).includes(value);
}

export function sanitizeFacets(values: readonly string[]): ShareFacet[] {
  const unique: ShareFacet[] = [];
  for (const value of values) {
    if (!isShareFacet(value)) continue;
    if (unique.includes(value)) continue;
    unique.push(value);
  }
  return unique;
}

export function defaultFacetsFor(kind: CircleKind): ShareFacet[] {
  return [...DEFAULT_FACETS[kind]];
}

export function weekWindowStart(todayLogical: string): string {
  return shiftLogicalDateUtc(todayLogical, -6);
}

export function inCurrentWeek(logicalDate: string, todayLogical: string): boolean {
  return logicalDate >= weekWindowStart(todayLogical) && logicalDate <= todayLogical;
}

export function countWeekWorkouts(
  logicalDates: readonly string[],
  todayLogical: string,
): number {
  return logicalDates.filter((date) => inCurrentWeek(date, todayLogical)).length;
}

export type CircleShareInput = {
  socialEnabled: boolean;
  name: string;
  kind: CircleKind;
  facets: readonly string[];
  selectedGoalTitles: readonly string[];
  weekWorkoutCount: number;
  groveStageLabel: string;
};

export type CircleSharePreview = {
  published: false;
  connected: false;
  wouldSee: string[];
  withheld: string[];
  note: string;
};

export function compileCircleShare(input: CircleShareInput): CircleSharePreview {
  const facets = sanitizeFacets(input.facets);
  const withheld = [...ALWAYS_WITHHELD];
  if (!input.socialEnabled) {
    return {
      published: false,
      connected: false,
      wouldSee: [],
      withheld,
      note: 'Social is off. Nothing is published, and nobody else is in this Circle.',
    };
  }

  const wouldSee: string[] = [];
  if (facets.includes('workout_count')) {
    const count = Math.max(0, Math.floor(input.weekWorkoutCount));
    wouldSee.push(
      count === 1 ? '1 workout confirmed this week' : `${count} workouts confirmed this week`,
    );
  }
  if (facets.includes('selected_goals')) {
    const titles = input.selectedGoalTitles.map((title) => title.trim()).filter(Boolean);
    wouldSee.push(
      titles.length > 0
        ? `Goals you named: ${titles.join(', ')}`
        : 'No goals selected for this Circle yet.',
    );
  }
  if (facets.includes('grove_stage')) {
    const stage = input.groveStageLabel.trim() || 'Seed';
    wouldSee.push(`Grove stage: ${stage}. Points stay private.`);
  }

  return {
    published: false,
    connected: false,
    wouldSee,
    withheld,
    note: 'Preview only. Invites are not sent. There is no feed and no follower count.',
  };
}
