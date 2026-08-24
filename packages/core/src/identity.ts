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
