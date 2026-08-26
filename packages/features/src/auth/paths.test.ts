import { describe, expect, it } from 'vitest';
import { authCallbackNextPath, isAuthOtpType } from './paths';

describe('authCallbackNextPath', () => {
  it('keeps an in-app path', () => {
    expect(authCallbackNextPath('/app/food', '/app')).toBe('/app/food');
  });

  it('rejects an external next value', () => {
    expect(authCallbackNextPath('https://evil.example', '/app')).toBe('/app');
  });
});

describe('isAuthOtpType', () => {
  it('accepts magiclink', () => {
    expect(isAuthOtpType('magiclink')).toBe(true);
  });
});
