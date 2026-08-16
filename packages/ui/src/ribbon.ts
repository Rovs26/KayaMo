export type RibbonPoint = {
  date: string;
  weight: number;
  trend: number;
};

export type RibbonDomain = {
  min: number;
  max: number;
};

export type RibbonGeom = {
  width: number;
  height: number;
  padX: number;
  padY: number;
};

export const DEFAULT_RIBBON_GEOM: RibbonGeom = {
  width: 390,
  height: 148,
  padX: 4,
  padY: 28,
};

export function ribbonDomain(series: RibbonPoint[], target?: number): RibbonDomain {
  const values: number[] = [];
  for (const point of series) {
    values.push(point.weight, point.trend);
  }
  const lo = values.length > 0 ? Math.min(...values) : 0;
  const hi = values.length > 0 ? Math.max(...values) : 1;
  const dataSpan = Math.max(hi - lo, 0.4);
  const includeTarget =
    target != null && target >= lo - dataSpan * 0.25 && target <= hi + dataSpan * 0.25;
  if (includeTarget && target != null) values.push(target);
  const min = values.length > 0 ? Math.min(...values) : lo;
  const max = values.length > 0 ? Math.max(...values) : hi;
  const span = Math.max(max - min, 0.4);
  const extra = span * 0.22;
  return { min: min - extra, max: max + extra };
}

export function scaleX(index: number, count: number, geom: RibbonGeom): number {
  if (count <= 1) return geom.width / 2;
  const inner = geom.width - geom.padX * 2;
  return geom.padX + (index / (count - 1)) * inner;
}

export function scaleY(value: number, domain: RibbonDomain, geom: RibbonGeom): number {
  const span = domain.max - domain.min;
  const t = span === 0 ? 0.5 : (value - domain.min) / span;
  const inner = geom.height - geom.padY * 2;
  return geom.padY + (1 - t) * inner;
}

export function polyline(
  values: number[],
  domain: RibbonDomain,
  geom: RibbonGeom,
): string {
  return values
    .map((value, index) => {
      const cmd = index === 0 ? 'M' : 'L';
      const x = scaleX(index, values.length, geom).toFixed(2);
      const y = scaleY(value, domain, geom).toFixed(2);
      return `${cmd}${x} ${y}`;
    })
    .join(' ');
}

export function trendBandPath(
  trends: number[],
  domain: RibbonDomain,
  geom: RibbonGeom,
): string {
  if (trends.length === 0) return '';
  const line = polyline(trends, domain, geom);
  const lastX = scaleX(trends.length - 1, trends.length, geom).toFixed(2);
  const firstX = scaleX(0, trends.length, geom).toFixed(2);
  const floor = (geom.height - 4).toFixed(2);
  return `${line} L${lastX} ${floor} L${firstX} ${floor} Z`;
}

export function weeklyRateKg(series: RibbonPoint[]): number | null {
  const first = series[0];
  const last = series[series.length - 1];
  if (!first || !last || series.length < 2) return null;
  const days = (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000;
  if (!Number.isFinite(days) || days <= 0) return null;
  return ((last.trend - first.trend) / days) * 7;
}
