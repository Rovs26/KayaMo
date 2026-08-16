import type { ReactNode } from 'react';
import { cx } from '../cx';

export type EmptyStateProps = {
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cx('flex flex-col items-stretch gap-4 px-1 py-6', className)}>
      <div className="h-px w-12 bg-accent" aria-hidden="true" />
      <h2 className="font-body text-title text-text">{title}</h2>
      <p className="max-w-[28ch] font-body text-body text-muted">{body}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
