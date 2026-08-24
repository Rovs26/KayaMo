import { describe, expect, it } from 'vitest';
import {
  goalFitsLifeArea,
  listedLifeAreas,
  suggestLifeArea,
} from './identity';

describe('listed life areas', () => {
  it('shows every area when the compass has not chosen a subset', () => {
    expect(listedLifeAreas([])).toEqual([
      'physical',
      'mind',
      'emotions',
      'faith',
      'work',
      'relationships',
      'money',
      'purpose',
    ]);
    expect(listedLifeAreas(null)).toEqual(listedLifeAreas([]));
  });

  it('hides areas that were not chosen, without dropping the chosen order of LIFE_AREAS', () => {
    expect(listedLifeAreas(['work', 'physical', 'work'])).toEqual(['physical', 'work']);
  });
});

describe('physical goal fit', () => {
  it('treats an explicit area as authoritative', () => {
    expect(goalFitsLifeArea('Squat a hundred kilos', 'work', 'physical')).toBe(false);
    expect(goalFitsLifeArea('Find calmer work', 'physical', 'physical')).toBe(true);
  });

  it('only infers Physical Self from untagged training language', () => {
    expect(suggestLifeArea('Squat a hundred kilos')).toBe('physical');
    expect(goalFitsLifeArea('Squat a hundred kilos', null, 'physical')).toBe(true);
    expect(goalFitsLifeArea('Finish the thesis chapter', null, 'physical')).toBe(false);
  });
});
