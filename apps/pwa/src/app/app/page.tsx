import { createServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { KayaMoApp } from './kayamo-app';

export default async function AppHome() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <KayaMoApp userId={user.id} email={user.email ?? 'Signed in'} />;
}
