import { createServerSupabase } from '@/lib/supabase/server';
import { NumberDisplay } from '@kayamo/ui';

export default async function AppHome() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="px-4 pt-8 pl-5">
      <p className="font-data text-caption uppercase tracking-[0.18em] text-muted">KayaMo</p>
      <h1 className="mt-2 font-body text-title">Today</h1>
      <p className="mt-2 font-data text-caption text-muted">{user?.email ?? 'signed in'}</p>
      <div className="mt-8 border-y border-line py-4">
        <p className="font-data text-caption uppercase tracking-[0.14em] text-muted">remain</p>
        <NumberDisplay value="—" unit="kcal" size="lg" />
        <p className="mt-2 max-w-[32ch] font-body text-muted">
          Logging lands in later chapters. You are past the gate.
        </p>
      </div>
    </main>
  );
}
