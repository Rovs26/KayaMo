import { createServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppShell } from './app-shell';

export default async function AppHome() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <AppShell userId={user.id} email={user.email ?? 'Signed in'} />;
}
