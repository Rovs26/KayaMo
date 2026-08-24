import Image from 'next/image';
import Link from 'next/link';
import { isLocalDevLoginEnabled } from '@/lib/local-dev-login';
import { LoginForm } from './login-form';
import { LoginTheme } from './login-theme';
import { LoginFlow } from './welcome';
import styles from './login.module.css';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; setup?: string; account?: string }>;
}) {
  const params = await searchParams;
  const forceLogin = params.sent === '1' || Boolean(params.error) || params.setup === '1' || params.account === '1';

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
            sent={params.sent === '1'}
            setup={params.setup === '1'}
            error={params.error ?? null}
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
