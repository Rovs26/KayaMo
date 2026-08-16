import { NumberDisplay } from './NumberDisplay';
import {
  DEFAULT_RIBBON_GEOM,
  polyline,
  ribbonDomain,
  scaleY,
  weeklyRateKg,
  type RibbonPoint,
} from '../ribbon';
import { cx } from '../cx';

export type TrendRibbonProps = {
  series: RibbonPoint[];
  target?: number;
  unit?: string;
  className?: string;
};

function rateLabel(rate: number | null): string {
  if (rate == null) return 'not enough days yet';
  const abs = Math.abs(rate);
  const n = abs.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (abs < 0.05) return 'holding';
  return rate < 0 ? `${n} kg/wk down` : `${n} kg/wk up`;
}

export function TrendRibbon({
  series,
  target,
  unit = 'kg',
  className,
}: TrendRibbonProps) {
  const geom = DEFAULT_RIBBON_GEOM;
  const domain = ribbonDomain(series, target);
  const trends = series.map((point) => point.trend);
  const last = series[series.length - 1];
  const rate = weeklyRateKg(series);
  const trendLine = polyline(trends, domain, geom);
  const targetY = target == null ? null : scaleY(target, domain, geom).toFixed(2);

  const label = last
    ? `Weight trend ${last.trend.toFixed(1)} ${unit}` +
      (target != null ? `, target ${target} ${unit}` : '') +
      `, ${rateLabel(rate)}`
    : 'No weight trend yet';

  return (
    <section className={cx('relative overflow-hidden bg-bg', className)} aria-label={label}>
      <svg
        viewBox={`0 0 ${geom.width} ${geom.height}`}
        preserveAspectRatio="none"
        className="block h-[148px] w-full"
        role="img"
        aria-hidden="true"
      >
        {trendLine ? (
          <>
            <path
              d={trendLine}
              fill="none"
              className="stroke-accent"
              strokeWidth="36"
              strokeLinejoin="round"
              strokeLinecap="butt"
              opacity="0.28"
            />
            <path
              d={trendLine}
              fill="none"
              className="stroke-accent"
              strokeWidth="5"
              strokeLinejoin="miter"
              strokeLinecap="square"
            />
          </>
        ) : null}
        {targetY != null ? (
          <line
            x1="0"
            x2={geom.width}
            y1={targetY}
            y2={targetY}
            className="stroke-text"
            strokeWidth="1"
            strokeDasharray="2 6"
            opacity="0.55"
          />
        ) : null}
      </svg>

      {last ? (
        <div className="pointer-events-none absolute inset-y-0 right-3 flex flex-col items-end justify-center mix-blend-normal">
          <NumberDisplay value={last.trend} unit={unit} size="lg" tone="accent" />
          <p className="mt-1 font-data text-caption uppercase tracking-[0.14em] text-muted">
            {rateLabel(rate)}
          </p>
        </div>
      ) : null}

      {target != null ? (
        <p className="absolute top-2 left-3 font-data text-caption uppercase tracking-[0.14em] text-muted">
          target {target}
        </p>
      ) : null}
    </section>
  );
}
