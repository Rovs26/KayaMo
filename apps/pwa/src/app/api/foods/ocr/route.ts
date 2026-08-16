import { NextResponse } from 'next/server';
import { AiConfigError, extractNutritionLabel } from '@kayamo/ai';
import { draftFromOcr } from '@kayamo/food';
import { createServerSupabase } from '@/lib/supabase/server';

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to read a label.' }, { status: 401 });
  }

  const form = await request.formData();
  const image = form.get('image');
  const barcodeRaw = form.get('barcode');
  const barcode = typeof barcodeRaw === 'string' && /^\d{8,14}$/.test(barcodeRaw) ? barcodeRaw : undefined;

  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: 'Attach a photo of the nutrition facts panel.' }, { status: 400 });
  }
  if (image.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Photo is too large. Use one under 4 MB.' }, { status: 413 });
  }
  const mediaType = image.type || 'image/jpeg';
  if (!ALLOWED.has(mediaType)) {
    return NextResponse.json({ error: 'Use a JPEG, PNG, or WebP photo.' }, { status: 415 });
  }

  try {
    const bytes = new Uint8Array(await image.arrayBuffer());
    const ocr = await extractNutritionLabel({ image: bytes, mediaType, userId: user.id });
    const draft = draftFromOcr(ocr, barcode);
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof AiConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Could not read that label. Fill the fields by hand.' }, { status: 502 });
  }
}
