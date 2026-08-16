import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; setup?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-[390px] flex-col bg-bg">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-accent" aria-hidden="true" />
      <header className="px-4 pt-10 pb-6 pl-5">
        <p className="font-data text-caption uppercase tracking-[0.18em] text-muted">KayaMo</p>
        <h1 className="mt-2 font-body text-title">Log in</h1>
        <p className="mt-2 max-w-[32ch] font-body text-muted">
          Magic link or Google. No password to forget between sets.
        </p>
      </header>
      <div className="flex-1 px-4 pl-5">
        <LoginForm
          sent={params.sent === '1'}
          setup={params.setup === '1'}
          error={params.error ?? null}
        />
      </div>
    </main>
  );
}
