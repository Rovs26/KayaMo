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
