export type NativePorts = {
  isNativeApp: () => boolean;
  registerPushIfNative?: () => Promise<string | null>;
};

export type AuthRedirectPorts = {
  afterAuthPath: string;
  isNativeApp: () => boolean;
  nativeCallbackUrl: string;
};

export function authRedirectTo(ports: AuthRedirectPorts): string {
  if (ports.isNativeApp()) return ports.nativeCallbackUrl;
  if (typeof window === 'undefined') return ports.afterAuthPath;
  const next = ports.afterAuthPath.startsWith('/') ? ports.afterAuthPath : `/${ports.afterAuthPath}`;
  return `${window.location.origin}/auth/callback?next=${next}`;
}
