import { createServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { DesktopShell } from './desktop-shell';
import { OfflineRoot } from './offline-root';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <OfflineRoot>
      <DesktopShell email={user.email ?? 'Signed in'}>{children}</DesktopShell>
    </OfflineRoot>
  );
}
