'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { isLocalDevLoginEnabled } from '@/lib/local-dev-login';
import { LoginForm } from './login-form';
import { LoginTheme } from './login-theme';
import { LoginFlow } from './welcome';
import styles from './login.module.css';

function LoginInner() {
  const params = useSearchParams();
  const sent = params.get('sent') === '1';
  const setup = params.get('setup') === '1';
  const account = params.get('account') === '1';
  const error = params.get('error');
  const forceLogin = sent || Boolean(error) || setup || account;

  return (
    <main className={styles.viewport}>
      <LoginTheme />
      <div className={styles.atmosphere} aria-hidden="true" />
      <LoginFlow forceLogin={forceLogin}>
        <div className={styles.shell}>
          <section className={styles.hero} aria-label="KayaMo">
            <div className={styles.heroGlow} aria-hidden="true" />
            <div className={styles.heroCopy}>
              <p className={styles.wordmark}>KayaMo</p>
              <h1>Pasok muna.</h1>
              <p>Magic link or Google. No password to forget between sets.</p>
            </div>
            <Image
              className={styles.coco}
              src="/coco-seed.png"
              alt="Coco, a hopeful seed companion"
              width={196}
              height={196}
              priority
            />
          </section>
          <LoginForm
            sent={sent}
            setup={setup}
            error={error}
            localDev={isLocalDevLoginEnabled()}
          />
          <p className={styles.footer}>
            <Link href="/about">About food data</Link>
          </p>
        </div>
      </LoginFlow>
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
