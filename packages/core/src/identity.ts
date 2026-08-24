export const LIFE_AREAS = [
  'physical',
  'mind',
  'emotions',
  'faith',
  'work',
  'relationships',
  'money',
  'purpose',
] as const;

export type LifeArea = (typeof LIFE_AREAS)[number];

export const LIFE_AREA_LABELS: Record<LifeArea, string> = {
  physical: 'Physical Self',
  mind: 'Mind & Learning',
  emotions: 'Emotions & Inner State',
  faith: 'Faith',
  work: 'Work, Study & Career',
  relationships: 'Relationships',
  money: 'Money & Opportunities',
  purpose: 'Purpose & Community',
};

const PHYSICAL_HINT =
  /\b(squat|bench|deadlift|gym|workout|train|run|lift|kg|kilo|walk|protein|meal|food)\b/i;

export function isLifeArea(value: string): value is LifeArea {
  return (LIFE_AREAS as readonly string[]).includes(value);
}

/** Empty compass means every area is nearby. A chosen list hides the rest without a rebuild. */
export function listedLifeAreas(activeAreas: readonly string[] | null | undefined): LifeArea[] {
  const chosen = [...new Set((activeAreas ?? []).filter(isLifeArea))];
  if (chosen.length === 0) return [...LIFE_AREAS];
  return LIFE_AREAS.filter((area) => chosen.includes(area));
}

export function suggestLifeArea(title: string): LifeArea | null {
  return PHYSICAL_HINT.test(title) ? 'physical' : null;
}

export function goalFitsLifeArea(
  title: string,
  area: string | null | undefined,
  target: LifeArea,
): boolean {
  if (area === target) return true;
  if (area) return false;
  return suggestLifeArea(title) === target;
}
