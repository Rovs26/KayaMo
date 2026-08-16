import { LoginForm } from './login-form';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; setup?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-[390px] flex-col bg-bg px-4 pt-10">
      <p className="font-data text-caption uppercase tracking-[0.18em] text-muted">KayaMo admin</p>
      <h1 className="mt-2 font-body text-title">Sign in</h1>
      <div className="mt-6">
        <LoginForm
          sent={params.sent === '1'}
          setup={params.setup === '1'}
          error={params.error ?? null}
        />
      </div>
    </main>
  );
}
