import { Button } from '@kayamo/ui';
import { signInWithEmail } from './actions';

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
          Fill <span className="font-data">.env.local</span> from{' '}
          <span className="font-data">npx supabase status</span>, then reload.
        </p>
      ) : null}
      {sent ? (
        <p className="font-body text-body text-accent">Magic link sent.</p>
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
            className="min-h-12 border-b border-line bg-transparent font-body text-text outline-none"
          />
        </label>
        <Button type="submit" size="lg" disabled={setup}>
          Send magic link
        </Button>
      </form>
    </div>
  );
}
