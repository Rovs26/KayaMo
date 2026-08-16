import type { ReactNode } from 'react';
import { cx } from '../cx';

export type ToastTone = 'default' | 'warning';

export type ToastProps = {
  message: string;
  action?: ReactNode;
  tone?: ToastTone;
  className?: string;
};

export function Toast({ message, action, tone = 'default', className }: ToastProps) {
  return (
    <div
      role="status"
      className={cx(
        'flex min-h-12 items-center justify-between gap-3 px-4 py-3',
        'border-t border-line bg-surface-2 text-body text-text',
        tone === 'warning' && 'border-t-warning',
        className,
      )}
    >
      <p className="font-body">{message}</p>
      {action ? <div className="shrink-0 font-semibold text-accent">{action}</div> : null}
    </div>
  );
}
