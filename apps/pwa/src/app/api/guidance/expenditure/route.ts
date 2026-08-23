import { NextResponse } from 'next/server';
import { z } from 'zod';
import { refreshExpenditure } from '@/lib/guidance-server';
import { createServerSupabase } from '@/lib/supabase/server';

const requestSchema = z.object({ asOfDate: z.string().date() }).strict();

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid expenditure request.' }, { status: 400 });
  }

  const result = await refreshExpenditure(supabase, user.id, parsed.data.asOfDate);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ estimate: result.value });
}
