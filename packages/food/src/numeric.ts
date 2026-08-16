export function toNutrientString(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const n = Math.abs(value) < 1e-12 ? 0 : value;
  return trimNumeric(n.toFixed(4));
}

export function toConfidenceString(value: number): string {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped.toFixed(2);
}

function trimNumeric(value: string): string {
  if (!value.includes('.')) return value;
  return value.replace(/\.?0+$/, '') || '0';
}
