import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@kayamo/db/service';
import { searchExternalFoods, supabaseCanonicalStore } from '@kayamo/food';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to search foods.' }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get('q') ?? '';
  try {
    const foods = await searchExternalFoods(query, {
      cache: supabaseCanonicalStore(createServiceSupabase()),
    });
    return NextResponse.json({ foods });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
