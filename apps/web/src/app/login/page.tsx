'use client';

import { isLocalDevLoginEnabled } from '@kayamo/features';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginForm } from './login-form';

function LoginInner() {
  const params = useSearchParams();
  const sent = params.get('sent') === '1';
  const setup = params.get('setup') === '1';
  const error = params.get('error');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="font-data text-caption uppercase tracking-[0.18em] text-muted">KayaMo desktop</p>
      <h1 className="mt-2 font-body text-title">Review on a bigger screen</h1>
      <p className="mt-2 max-w-prose text-muted">
        Magic link or Google. Logging stays on your phone. This shell is for history you already confirmed.
      </p>
      <div className="mt-6">
        <LoginForm
          sent={sent}
          setup={setup}
          error={error}
          localDev={isLocalDevLoginEnabled()}
        />
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
