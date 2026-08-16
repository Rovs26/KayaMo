export const PACKAGE = '@kayamo/food';

export {
  cacheOnFirstHit,
  normalizedToFoodInsert,
  supabaseCanonicalStore,
  type CanonicalFoodStore,
} from './cache';
export { DATA_LICENSES, OFF_ATTRIBUTION, USDA_SOURCE_NOTE } from './licenses';
export {
  dedupeKey,
  displayName,
  kjToKcal,
  looksLikeBarcode,
  mergeCandidates,
  normalizeBarcode,
  normalizeName,
  parseGramsFromText,
  perServingToPer100g,
  toGrams,
  withDefaultServings,
} from './normalize';
export {
  atwaterDelta,
  atwaterKcal,
  issuesForFood,
  parsePhCoreDocument,
  validatePhCoreFoods,
  type PhCoreIssue,
  type PhCoreValidation,
} from './ph-core/validate';
export { diffPhCoreVsDb, type PhCoreFieldDiff } from './ph-core/diff';
export {
  findPhCoreYamlPath,
  loadPhCoreYaml,
  replacePhCoreFood,
  serializePhCoreYaml,
  writePhCoreYaml,
} from './ph-core/io';
export {
  ATWATER_TOLERANCE,
  UNVERIFIED_CONFIDENCE_MAX,
  phCoreFoodSchema,
  phCoreFileSchema,
  type PhCoreCategory,
  type PhCoreFood,
  type PhCoreFile,
} from './ph-core/schema';
export { toPhCoreFoodRow } from './ph-core/to-row';
export { searchExternalFoods, type SearchExternalDeps } from './search';
export { lookupOffBarcode, mapOffProduct, searchOff, type OffDeps } from './sources/off';
export { getUsdaFood, mapUsdaFood, searchUsda, type UsdaDeps } from './sources/usda';
export { HourlyLimiter, RateLimitError, noopLimiter } from './sources/limiter';
export {
  FoodSourceError,
  normalizedFoodSchema,
  type FoodServing,
  type NormalizedFood,
  type NutrientsPer100g,
  type RemoteSource,
} from './types';
