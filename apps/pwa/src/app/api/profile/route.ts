import { NextResponse } from 'next/server';
import { getProfile, updateProfile } from '@kayamo/db';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';

/** Mirrors the check constraints on `profiles` so a bad patch fails before the round-trip. */
const patchSchema = z
  .object({
    sex: z.enum(['female', 'male']),
    birth_year: z.number().int().min(1900).max(2100),
    height_cm: z.number().positive().max(300),
    activity_baseline: z.number().min(1.2).max(2),
    goal: z.enum(['lose', 'maintain', 'gain']),
    timezone: z.string().min(1).max(64),
    locale: z.enum(['en', 'fil', 'taglish']),
    day_starts_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/),
  })
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'Nothing to update.',
  });

export async function GET(request: Request) {
  const supabase = await createServerSupabase(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  return NextResponse.json({ profile: await getProfile(supabase, user.id) });
}

export async function PATCH(request: Request) {
  const supabase = await createServerSupabase(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid profile update.' }, { status: 400 });
  }

  const { height_cm, activity_baseline, ...rest } = parsed.data;
  const profile = await updateProfile(supabase, {
    userId: user.id,
    patch: {
      ...rest,
      ...(height_cm === undefined ? {} : { height_cm: String(height_cm) }),
      ...(activity_baseline === undefined
        ? {}
        : { activity_baseline: String(activity_baseline) }),
    },
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json({ profile });
}
