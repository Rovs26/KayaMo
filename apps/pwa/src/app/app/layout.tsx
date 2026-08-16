import type { ReactNode } from 'react';
import { SignOutButton } from './sign-out-button';

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-[390px] flex-col bg-bg">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-accent" aria-hidden="true" />
      <div className="flex-1 pb-28">{children}</div>
      <div className="sticky bottom-0 z-30 border-t border-line bg-bg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <SignOutButton />
      </div>
    </div>
  );
}
