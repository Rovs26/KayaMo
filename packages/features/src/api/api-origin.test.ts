import { describe, expect, it } from 'vitest';
import { apiUrl } from './api-origin';

describe('apiUrl', () => {
  it('keeps relative paths when no origin is set', () => {
    expect(apiUrl('/api/mus/respond', undefined)).toBe('/api/mus/respond');
    expect(apiUrl('/api/mus/respond', '')).toBe('/api/mus/respond');
  });

  it('prefixes the hosted origin and strips a trailing slash', () => {
    expect(apiUrl('/api/foods/ocr', 'https://kayamo.ph/')).toBe('https://kayamo.ph/api/foods/ocr');
  });
});
