/** Shown on /login and enforced in the server action. Never true in production builds. */
export const LOCAL_DEV_EMAIL = 'local@kayamo.test';

export function isLocalDevLoginEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
}
