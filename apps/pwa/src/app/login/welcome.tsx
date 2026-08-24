'use client';

import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';
import styles from './login.module.css';

const WELCOME_KEY = 'kayamo:welcome-done';

const SCREENS = [
  {
    title: 'Ako si Mus.',
    body: 'A growth companion who only works from what you confirm. KayaMo is 18+, and it is not a medical service.',
  },
  {
    title: 'You hold the pen.',
    body: 'Mus can suggest a task, a meal, or a session. Nothing is saved until you confirm it, and you can edit first.',
  },
  {
    title: 'It only grows.',
    body: 'Mus grows from things you actually log. Time away does not take anything back.',
  },
] as const;

export function LoginFlow({
  forceLogin,
  children,
}: {
  forceLogin: boolean;
  children: ReactNode;
}) {
  const [mode, setMode] = useState<'welcome' | 'login'>(forceLogin ? 'login' : 'welcome');
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceLogin) {
      setMode('login');
      return;
    }
    if (localStorage.getItem(WELCOME_KEY) === '1') setMode('login');
  }, [forceLogin]);

  function goLogin() {
    localStorage.setItem(WELCOME_KEY, '1');
    setMode('login');
  }

  if (mode === 'login') return children;

  const screen = SCREENS[step] ?? SCREENS[0];
  const last = step === SCREENS.length - 1;

  return (
    <div className={styles.shell}>
      <section className={styles.welcome} aria-label={`Welcome, step ${step + 1} of ${SCREENS.length}`}>
        <div className={styles.welcomeGlow} aria-hidden="true" />
        <Image
          className={styles.welcomeCoco}
          src="/coco-seed.png"
          alt="Mus, a hopeful seed companion"
          width={220}
          height={220}
          priority
        />
        <p className={styles.wordmark}>KayaMo</p>
        <h1>{screen.title}</h1>
        <p className={styles.welcomeBody}>{screen.body}</p>
        <div className={styles.welcomeDots} aria-hidden="true">
          {SCREENS.map((item, index) => (
            <i key={item.title} data-on={index === step ? '1' : '0'} />
          ))}
        </div>
      </section>
      <div className={styles.welcomeActions}>
        <button type="button" className={styles.primary} onClick={() => (last ? goLogin() : setStep(step + 1))}>
          {last ? 'Get started' : 'Continue'}
        </button>
        <button type="button" className={`${styles.ghost} ${styles.welcomeSkip}`} onClick={goLogin}>
          I already have an account
        </button>
      </div>
    </div>
  );
}
