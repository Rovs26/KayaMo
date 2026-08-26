export const AUTH_OTP_TYPES = [
  'magiclink',
  'email',
  'signup',
  'invite',
  'recovery',
  'email_change',
] as const;

export type AuthOtpType = (typeof AUTH_OTP_TYPES)[number];

export function isAuthOtpType(value: string): value is AuthOtpType {
  return (AUTH_OTP_TYPES as readonly string[]).includes(value);
}

export function authCallbackNextPath(raw: string | null, fallback: string): string {
  const next = raw ?? fallback;
  return next.startsWith('/') ? next : fallback;
}
