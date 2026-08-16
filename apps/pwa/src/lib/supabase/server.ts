import { cookies } from 'next/headers';
import { createCookieSupabase } from '@kayamo/db';

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createCookieSupabase({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) => {
      try {
        for (const { name, value, options } of toSet) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // Called from a Server Component where cookies are read-only.
      }
    },
  });
}
