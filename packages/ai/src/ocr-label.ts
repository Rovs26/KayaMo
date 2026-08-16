import { nutritionLabelOcrSchema, type NutritionLabelOcr } from '@kayamo/food/label-ocr';
import { completeObject, type GenerateObjectFn } from './router';

export const LABEL_OCR_SYSTEM = `You extract numbers from a photograph of a packaged-food nutrition facts panel.

Rules:
- Copy only values that are clearly visible on the label. Never invent, estimate, or complete missing rows.
- Philippine labels are often per serving, not per 100 g. Set basis to per_serving unless the panel says per 100 g / 100 ml.
- Sodium is in milligrams (mg). If the label shows salt in grams, omit sodium_mg rather than converting.
- servingGrams is the gram weight of one labeled serving when printed (e.g. "60g"). If only a household measure is shown with no grams, omit servingGrams.
- If a line is unreadable, omit that field. Do not use 0 to mean "I could not read it."
- overallConfidence is how readable the whole panel is (0–1). Per-field confidence is how sure you are of that one number.
- productName and brand from the pack if visible.`;

export async function extractNutritionLabel(
  input: { image: Uint8Array; mediaType: string; userId: string },
  deps: { generateObject?: GenerateObjectFn } = {},
): Promise<NutritionLabelOcr> {
  return completeObject(
    {
      tier: 'vision',
      schema: nutritionLabelOcrSchema,
      system: LABEL_OCR_SYSTEM,
      userId: input.userId,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract the nutrition facts panel. Omit any number you cannot read.',
            },
            {
              type: 'image',
              image: input.image,
              mediaType: input.mediaType,
              providerOptions: { openai: { imageDetail: 'high' } },
            },
          ],
        },
      ],
    },
    deps,
  );
}
