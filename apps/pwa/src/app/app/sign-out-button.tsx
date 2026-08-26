'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { Button } from '@kayamo/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="md"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void createBrowserSupabaseClient()
          .auth.signOut()
          .then(() => {
            router.replace('/login');
          })
          .finally(() => setPending(false));
      }}
    >
      Sign out
    </Button>
  );
}
