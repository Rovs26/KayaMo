import { createServerSupabase } from '@/lib/supabase/server';
import { FoodSearch } from './food-search';

export default async function FoodSearchPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="px-4 pt-8 pl-5">
      <p className="font-data text-caption uppercase tracking-[0.18em] text-muted">Search</p>
      <h1 className="mt-2 font-body text-title">Find a food</h1>
      <p className="mt-2 max-w-[32ch] font-body text-body text-muted">
        Local matches show first. Packaged and USDA results stream in below.
      </p>
      {user ? <FoodSearch userId={user.id} /> : null}
    </main>
  );
}
