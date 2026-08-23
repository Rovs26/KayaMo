import { createServerSupabase } from '@/lib/supabase/server';
import { BarcodeLookup } from './barcode-lookup';

export default async function BarcodePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="px-4 pt-8 pl-5">
      <p className="font-data text-caption uppercase tracking-[0.18em] text-muted">Barcode</p>
      <h1 className="mt-2 font-body text-title">Scan a pack</h1>
      <p className="mt-2 max-w-[32ch] font-body text-body text-muted">
        Point the camera at the bars. If it is not in Open Food Facts yet, add it from the label.
      </p>
      {user ? <BarcodeLookup userId={user.id} /> : null}
    </main>
  );
}
