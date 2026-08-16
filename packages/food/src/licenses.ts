export const OFF_ATTRIBUTION =
  'Nutritional data from Open Food Facts, licensed under ODbL. https://world.openfoodfacts.org';

export const USDA_SOURCE_NOTE = 'USDA FoodData Central (CC0 public domain).';

export const DATA_LICENSES = {
  usda: {
    name: 'USDA FoodData Central',
    license: 'CC0 1.0 public domain',
    url: 'https://fdc.nal.usda.gov',
    note: USDA_SOURCE_NOTE,
  },
  off: {
    name: 'Open Food Facts',
    license: 'Open Database License (ODbL)',
    url: 'https://world.openfoodfacts.org',
    attribution: OFF_ATTRIBUTION,
  },
} as const;
