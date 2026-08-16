import { createServerSupabase } from '@/lib/supabase/server';
import { Button } from '@kayamo/ui';
import Link from 'next/link';
import { signOut } from './login/actions';

export default async function AdminHome() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-[390px] flex-col bg-bg px-4 pt-10">
      <p className="font-data text-caption uppercase tracking-[0.18em] text-muted">KayaMo admin</p>
      <h1 className="mt-2 font-body text-title">Internal</h1>
      <p className="mt-2 font-data text-caption text-muted">{user?.email ?? 'signed in'}</p>
      <p className="mt-6 max-w-[32ch] font-body text-muted">
        Review PH core foods, then apply the YAML into the database.
      </p>
      <Link
        href="/ph-core"
        className="mt-6 font-data text-caption uppercase tracking-[0.14em] text-accent"
      >
        PH core review
      </Link>
      <div className="mt-auto pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
        <form action={signOut}>
          <Button type="submit" variant="secondary" size="lg">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
