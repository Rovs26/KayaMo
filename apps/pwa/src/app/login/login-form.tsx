import { Button } from '@kayamo/ui';
import { signInWithEmail, signInWithGoogle } from './actions';

export function LoginForm({
  sent,
  error,
  setup,
}: {
  sent: boolean;
  error: string | null;
  setup: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {setup ? (
        <p className="font-body text-body text-warning">
          Supabase env is empty. Copy <span className="font-data">.env.example</span> to{' '}
          <span className="font-data">.env.local</span>, run{' '}
          <span className="font-data">npx supabase start</span>, then paste the URL and keys
          from <span className="font-data">npx supabase status</span>.
        </p>
      ) : null}

      {sent ? (
        <p className="font-body text-body text-accent">
          Check your inbox — or Inbucket at localhost:54324 if you are on local Supabase.
        </p>
      ) : null}

      {error ? <p className="font-body text-body text-warning">{error}</p> : null}

      <form action={signInWithEmail} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">
            email
          </span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="min-h-12 border-b border-line bg-transparent px-0 font-body text-body text-text outline-none placeholder:text-muted"
          />
        </label>
        <Button type="submit" size="lg" disabled={setup}>
          Send magic link
        </Button>
      </form>

      <p className="text-center font-data text-caption uppercase tracking-[0.14em] text-muted">
        or
      </p>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="secondary" size="lg" disabled={setup}>
          Continue with Google
        </Button>
      </form>
    </div>
  );
}
