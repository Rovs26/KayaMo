import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@kayamo/db/service';
import {
  createResolveQueryCache,
  lookupOffBarcode,
  resolveFood,
  searchOff,
  searchUsda,
  shouldAutoPick,
  supabaseCanonicalStore,
  supabaseResolveCatalog,
} from '@kayamo/food';
import { createServerSupabase } from '@/lib/supabase/server';

const queryCache = createResolveQueryCache();

export async function GET(request: Request) {
  const supabase = await createServerSupabase(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to resolve foods.' }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const text = (params.get('q') ?? '').trim().slice(0, 200);
  const barcode = (params.get('barcode') ?? '').trim().slice(0, 20);
  const localOnly = params.get('local') === '1';
  if (!text && !barcode) {
    return NextResponse.json({ error: 'q or barcode is required.' }, { status: 400 });
  }

  try {
    const candidates = await resolveFood(
      { ...(text ? { text } : {}), ...(barcode ? { barcode } : {}) },
      user.id,
      {
        catalog: supabaseResolveCatalog(supabase),
        ...(localOnly
          ? {}
          : {
              cache: supabaseCanonicalStore(createServiceSupabase()),
              network: {
                searchOff: (query: string) => searchOff(query),
                lookupOffBarcode: (code: string) => lookupOffBarcode(code),
                searchUsda: (query: string) => searchUsda(query),
              },
              queryCache,
            }),
      },
    );
    return NextResponse.json({
      candidates,
      autoPick: shouldAutoPick(candidates),
      stage: localOnly ? 'local' : 'full',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resolve failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
