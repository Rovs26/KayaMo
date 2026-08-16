import { describe, expect, it } from 'vitest';
import { parseFoodQuery } from './query-parse';

describe('parseFoodQuery', () => {
  it('parses amount, PH unit, and Taglish name', () => {
    expect(parseFoodQuery({ text: '2 tasa kanin' })).toMatchObject({
      name: 'kanin',
      amount: 2,
      unit: 'tasa',
    });
  });

  it('parses vague sizes', () => {
    expect(parseFoodQuery({ text: 'malaki tasa kanin' })).toMatchObject({
      name: 'kanin',
      amount: 1,
      unit: 'tasa',
      size: 'malaki',
    });
    expect(parseFoodQuery({ text: 'maliit piraso adobo' }).size).toBe('maliit');
  });

  it('treats digit-only input as a barcode', () => {
    expect(parseFoodQuery({ text: '3017620422003' })).toMatchObject({
      barcode: '3017620422003',
      name: '',
    });
  });
});
