import { NextResponse } from 'next/server';
import { z } from 'zod';
import { refreshTargets } from '@/lib/guidance-server';
import { createServerSupabase } from '@/lib/supabase/server';

const requestSchema = z
  .object({
    effectiveFrom: z.string().date(),
    requestedWeeklyRatePercent: z.number().min(0).max(10).optional(),
    trainingDaysPerWeek: z.number().int().min(0).max(6).default(3),
  })
  .strict();

export async function POST(request: Request) {
  const supabase = await createServerSupabase(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid target request.' }, { status: 400 });
  }

  const result = await refreshTargets(supabase, user.id, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ targets: result.value });
}
