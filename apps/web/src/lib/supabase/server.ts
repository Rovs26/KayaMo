import { createCookieSupabase } from '@kayamo/db';
import { cookies } from 'next/headers';

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
