import { describe, expect, it } from 'vitest';
import { authRedirectTo } from './ports';

describe('authRedirectTo', () => {
  it('uses the native callback when the shell is Capacitor', () => {
    expect(
      authRedirectTo({
        afterAuthPath: '/app',
        isNativeApp: () => true,
        nativeCallbackUrl: 'kayamo://auth/callback',
      }),
    ).toBe('kayamo://auth/callback');
  });
});
