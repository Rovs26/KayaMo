import { NextResponse } from 'next/server';
import { AiBudgetError, AiConfigError, extractNutritionLabel } from '@kayamo/ai';
import {
  getAgentSpendUsd,
  getProfile,
  insertAgentRunTelemetry,
} from '@kayamo/db';
import { draftFromOcr } from '@kayamo/food';
import { logicalDateFromInstant } from '@kayamo/offline';
import { createServerSupabase } from '@/lib/supabase/server';

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function nonnegativeEnvNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function visionModelId(): string {
  return process.env.MODEL_VISION?.trim() || process.env.MODEL_SMALL?.trim() || 'vision';
}

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

  const profile = await getProfile(supabase, user.id);
  const logicalDate = logicalDateFromInstant(
    new Date().toISOString(),
    profile?.timezone ?? 'Asia/Manila',
    profile?.day_starts_at ?? '00:00:00',
  );
  const dailyBudgetUsd = nonnegativeEnvNumber('AI_DAILY_BUDGET_USD_PER_USER', 0.05);
  const estimatedRequestCostUsd = nonnegativeEnvNumber('AI_ESTIMATED_VISION_USD', 0.02);
  const requestId = crypto.randomUUID();

  try {
    const bytes = new Uint8Array(await image.arrayBuffer());
    const ocr = await extractNutritionLabel(
      { image: bytes, mediaType, userId: user.id },
      {
        budget: {
          dailyBudgetUsd,
          estimatedRequestCostUsd,
          spentUsd: () => getAgentSpendUsd(supabase, { userId: user.id, logicalDate }),
          recordUsage: async (usage) => {
            await insertAgentRunTelemetry(supabase, {
              id: crypto.randomUUID(),
              userId: user.id,
              requestId,
              logicalDate,
              trigger: 'label_ocr',
              agent: 'label_ocr',
              model: visionModelId(),
              inputTokens: 0,
              outputTokens: 0,
              costUsd: usage.costUsd,
              latencyMs: usage.latencyMs,
              outcome: 'model',
              errorCode: 'none',
              updatedAt: new Date().toISOString(),
            });
          },
        },
      },
    );
    const draft = draftFromOcr(ocr, barcode);
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof AiBudgetError) {
      return NextResponse.json(
        { error: "Today's AI limit is resting. Type the numbers from the label." },
        { status: 429 },
      );
    }
    if (error instanceof AiConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Could not read that label. Fill the fields by hand.' }, { status: 502 });
  }
}
