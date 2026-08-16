import { cx } from '../cx';

export type NumberDisplaySize = 'sm' | 'md' | 'lg';
export type NumberDisplayTone = 'default' | 'accent' | 'warning';

export type NumberDisplayProps = {
  value: number | string;
  unit?: string;
  size?: NumberDisplaySize;
  tone?: NumberDisplayTone;
  className?: string;
};

function formatValue(value: number | string): string {
  if (typeof value === 'string') return value;
  return Number.isInteger(value)
    ? value.toLocaleString('en-PH')
    : value.toLocaleString('en-PH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

const sizeClass: Record<NumberDisplaySize, string> = {
  sm: 'text-[1.375rem] leading-none',
  md: 'text-numeral',
  lg: 'text-display',
};

const toneClass: Record<NumberDisplayTone, string> = {
  default: 'text-text',
  accent: 'text-accent',
  warning: 'text-warning',
};

export function NumberDisplay({
  value,
  unit,
  size = 'md',
  tone = 'default',
  className,
}: NumberDisplayProps) {
  return (
    <span
      className={cx(
        'inline-flex items-baseline gap-1 font-numeral tabular-nums tracking-tight',
        '[font-family:var(--font-numeral)]',
        sizeClass[size],
        toneClass[tone],
        className,
      )}
    >
      <span>{formatValue(value)}</span>
      {unit ? (
        <span className="font-data text-caption font-normal tracking-wider text-muted">
          {unit}
        </span>
      ) : null}
    </span>
  );
}
