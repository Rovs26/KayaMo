'use client';

import {
  LoginForm as SharedLoginForm,
  apiUrl,
  isLocalDevLoginEnabled,
  LOCAL_DEV_EMAIL,
} from '@kayamo/features';
import { isNativeApp } from '@kayamo/mobile/native';

const PORTS = {
  afterAuthPath: '/app',
  isNativeApp,
  nativeCallbackUrl: 'kayamo://auth/callback',
} as const;

export function LoginForm({
  sent,
  error,
  setup,
  localDev,
}: {
  sent: boolean;
  error: string | null;
  setup: boolean;
  localDev: boolean;
}) {
  return (
    <SharedLoginForm
      ports={PORTS}
      sent={sent}
      error={error}
      setup={setup}
      localDev={localDev}
      localDevAction={isLocalDevLoginEnabled() ? apiUrl('/api/auth/local-dev') : undefined}
      localDevEmail={LOCAL_DEV_EMAIL}
    />
  );
}
