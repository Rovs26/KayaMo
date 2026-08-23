import Link from 'next/link';

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[390px] flex-col justify-center px-6">
      <p className="font-data text-caption uppercase tracking-[0.18em] text-muted">Offline</p>
      <h1 className="mt-2 font-body text-title">Your saved day is still here</h1>
      <p className="mt-4 font-body text-body text-muted">
        Reopen KayaMo from your installed app to keep using locally saved actions. Sync will resume when your connection returns.
      </p>
      <Link href="/app" className="mt-8 font-body text-body text-accent underline-offset-4 hover:underline">
        Try KayaMo again
      </Link>
    </main>
  );
}
