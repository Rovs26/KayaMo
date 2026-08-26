import { createServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { FoodHistoryClient } from './food-history-client';

export default async function FoodHistoryPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <FoodHistoryClient userId={user.id} />;
}
