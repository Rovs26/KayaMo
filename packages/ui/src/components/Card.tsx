import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';

export type CardTone = 'default' | 'warning';

export type CardProps = {
  children: ReactNode;
  tone?: CardTone;
} & HTMLAttributes<HTMLElement>;

export function Card({ children, tone = 'default', className, ...rest }: CardProps) {
  return (
    <article
      className={cx(
        'relative bg-surface px-4 py-3',
        'border-t border-line',
        tone === 'warning' && 'border-l-2 border-l-warning',
        className,
      )}
      {...rest}
    >
      {children}
    </article>
  );
}
