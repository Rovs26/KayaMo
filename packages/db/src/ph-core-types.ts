export type PhCoreFoodRow = {
  sourceId: string;
  name: string;
  nameTl: string[];
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  sugar_g: string;
  sodium_mg: string;
  confidence: string;
  sourceNote: string;
  verified: boolean;
  servings: Array<{ label: string; grams: string; isDefault: boolean }>;
};
