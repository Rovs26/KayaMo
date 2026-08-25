import { describe, expect, it } from 'vitest';
import {
  ALWAYS_WITHHELD,
  compileCircleShare,
  countWeekWorkouts,
  defaultFacetsFor,
  sanitizeFacets,
} from './circles';

describe('circle visibility', () => {
  it('lets gym friends see workout count and never calories, weight, or faith', () => {
    expect(defaultFacetsFor('gym')).toEqual(['workout_count']);
    expect(defaultFacetsFor('church')).toEqual(['selected_goals']);
    expect(sanitizeFacets(['workout_count', 'kcal', 'weight', 'faith', 'workout_count'])).toEqual([
      'workout_count',
    ]);
    const preview = compileCircleShare({
      socialEnabled: true,
      name: 'Gym friends',
      kind: 'gym',
      facets: ['workout_count', 'kcal', 'weight'],
      selectedGoalTitles: [],
      weekWorkoutCount: 4,
      groveStageLabel: 'Sprout',
    });
    expect(preview.published).toBe(false);
    expect(preview.connected).toBe(false);
    expect(preview.wouldSee.join(' ')).toMatch(/4 workouts/i);
    expect(preview.wouldSee.join(' ')).not.toMatch(/kcal|calorie|weight|faith/i);
    expect(preview.withheld).toEqual([...ALWAYS_WITHHELD]);
    expect(preview.note).toMatch(/no feed/i);
  });

  it('publishes nothing while social is off', () => {
    const preview = compileCircleShare({
      socialEnabled: false,
      name: 'Family',
      kind: 'family',
      facets: ['selected_goals'],
      selectedGoalTitles: ['Finish the thesis chapter'],
      weekWorkoutCount: 2,
      groveStageLabel: 'Sprout',
    });
    expect(preview.wouldSee).toEqual([]);
    expect(preview.published).toBe(false);
    expect(preview.note).toMatch(/social is off/i);
  });

  it('counts confirmed workouts inside the current week only', () => {
    expect(countWeekWorkouts(['2026-08-19', '2026-08-25', '2026-08-18'], '2026-08-25')).toBe(2);
  });
});
