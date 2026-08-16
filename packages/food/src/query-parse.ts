import { looksLikeBarcode, normalizeBarcode, normalizeName } from './normalize';

export const PH_UNITS = ['tasa', 'piraso', 'order', 'hiwa', 'kutsara', 'bowl'] as const;
export const SIZE_WORDS = ['malaki', 'sakto', 'maliit'] as const;
export const SIZE_MULTIPLIER: Record<(typeof SIZE_WORDS)[number], number> = {
  malaki: 1.3,
  sakto: 1,
  maliit: 0.7,
};

const PARSE_UNITS = [
  'kutsara',
  'piraso',
  'tasa',
  'order',
  'hiwa',
  'bowl',
  'tablespoons',
  'tablespoon',
  'tbsp',
  'pieces',
  'piece',
  'pcs',
  'pc',
  'cups',
  'cup',
  'grams',
  'gram',
  'kg',
  'oz',
  'ml',
  'g',
] as const;

const UNIT_PATTERN = PARSE_UNITS.join('|');
const SIZE_PATTERN = SIZE_WORDS.join('|');

export type ParsedFoodQuery = {
  raw: string;
  barcode?: string;
  name: string;
  amount: number;
  unit?: string;
  size?: (typeof SIZE_WORDS)[number];
};

export type FoodQuery = {
  text?: string;
  barcode?: string;
};

export function parseFoodQuery(query: FoodQuery): ParsedFoodQuery {
  const barcode = normalizeBarcode(query.barcode) ?? (query.text ? normalizeBarcode(query.text) : undefined);
  if (barcode && looksLikeBarcode(barcode)) {
    return {
      raw: query.text?.trim() || barcode,
      barcode,
      name: '',
      amount: 1,
    };
  }

  const raw = (query.text ?? '').trim();
  if (!raw) {
    return { raw: '', name: '', amount: 1 };
  }

  const pattern = new RegExp(
    `^(?:(\\d+(?:\\.\\d+)?)\\s*)?(?:(${SIZE_PATTERN})\\s+)?(?:(${UNIT_PATTERN})\\s+)?(.+)$`,
    'i',
  );
  const match = raw.match(pattern);
  if (!match) {
    return { raw, name: normalizeName(raw), amount: 1 };
  }

  const amount = match[1] ? Number(match[1]) : 1;
  const sizeRaw = match[2]?.toLowerCase();
  const unitRaw = match[3]?.toLowerCase();
  const name = (match[4] ?? raw).trim().replace(/^(ng|na|of|ang)\s+/i, '');
  const size = SIZE_WORDS.find((word) => word === sizeRaw);

  return {
    raw,
    name: normalizeName(name),
    amount: Number.isFinite(amount) && amount > 0 ? amount : 1,
    ...(unitRaw ? { unit: unitRaw } : {}),
    ...(size ? { size } : {}),
  };
}
