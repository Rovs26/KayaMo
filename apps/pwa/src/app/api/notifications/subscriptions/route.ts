import { createServerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(4000),
  expirationTime: z.number().nullable(),
  keys: z.object({
    p256dh: z.string().min(1).max(1000),
    auth: z.string().min(1).max(1000),
  }).strict(),
}).strict();

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to enable reminders.' }, { status: 401 });
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid push subscription.' }, { status: 400 });
  const now = new Date().toISOString();
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    expires_at: parsed.data.expirationTime
      ? new Date(parsed.data.expirationTime).toISOString()
      : null,
    updated_at: now,
  }, { onConflict: 'user_id,endpoint' });
  if (error) return NextResponse.json({ error: 'Could not enable web push.' }, { status: 502 });
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to change reminders.' }, { status: 401 });
  const parsed = z.object({ endpoint: z.string().url().max(4000) }).strict()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid push subscription.' }, { status: 400 });
  const { error } = await supabase.from('push_subscriptions').delete()
    .eq('user_id', user.id).eq('endpoint', parsed.data.endpoint);
  if (error) return NextResponse.json({ error: 'Could not disable web push.' }, { status: 502 });
  return NextResponse.json({ deleted: true });
}
