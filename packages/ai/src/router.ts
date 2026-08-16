import type { z } from 'zod';

export type AiTier = 'nano' | 'small' | 'vision' | 'coach';

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiConfigError';
  }
}

export type AiTextPart = { type: 'text'; text: string };
export type AiImagePart = {
  type: 'image';
  image: Uint8Array;
  mediaType: string;
  providerOptions?: { openai?: { imageDetail?: 'low' | 'high' | 'auto' } };
};
export type AiUserContent = AiTextPart | AiImagePart;

export type AiMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string | AiUserContent[];
};

export type GenerateObjectArgs<S extends z.ZodType> = {
  tier: AiTier;
  schema: S;
  system: string;
  messages: AiMessage[];
  userId: string;
};

export type GenerateObjectFn = <S extends z.ZodType>(
  args: GenerateObjectArgs<S>,
) => Promise<{ object: unknown }>;

function envModel(tier: AiTier): string | undefined {
  const key =
    tier === 'nano'
      ? 'MODEL_NANO'
      : tier === 'small'
        ? 'MODEL_SMALL'
        : tier === 'vision'
          ? 'MODEL_VISION'
          : 'MODEL_COACH';
  return process.env[key]?.trim() || undefined;
}

async function liveGenerateObject<S extends z.ZodType>(
  args: GenerateObjectArgs<S>,
): Promise<{ object: unknown }> {
  const apiKey = process.env.AI_PROVIDER_API_KEY?.trim();
  const modelId = envModel(args.tier) ?? envModel('small');
  if (!apiKey || !modelId) {
    throw new AiConfigError('OCR is not configured. Fill the label by hand.');
  }

  const { generateObject } = await import('ai');
  const { createOpenAI } = await import('@ai-sdk/openai');
  const openai = createOpenAI({ apiKey });
  const generate = generateObject as unknown as (args: {
    model: unknown;
    schema: S;
    system: string;
    messages: AiMessage[];
    providerOptions?: { openai?: { reasoningEffort?: 'none' | 'low' | 'medium' } };
  }) => Promise<{ object: unknown }>;
  return generate({
    model: openai(modelId),
    schema: args.schema,
    system: args.system,
    messages: args.messages,
    ...(args.tier === 'vision'
      ? { providerOptions: { openai: { reasoningEffort: 'low' } } }
      : {}),
  });
}

/**
 * Every LLM call goes through here. Do not log prompt/image/nutrition content.
 */
export async function completeObject<S extends z.ZodType>(
  args: GenerateObjectArgs<S>,
  deps: { generateObject?: GenerateObjectFn } = {},
): Promise<z.infer<S>> {
  const generate = deps.generateObject ?? liveGenerateObject;
  const result = await generate(args);
  return args.schema.parse(result.object);
}
