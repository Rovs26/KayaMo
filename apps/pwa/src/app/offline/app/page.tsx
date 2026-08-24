import { OfflineAppResume } from './resume';

export default function OfflineAppPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-[390px] px-4 pt-8 pl-5">
      <p role="status" className="font-data text-caption uppercase tracking-[0.14em] text-muted">Offline · changes stay on this device until sync returns</p>
      <h1 className="mt-2 font-body text-title">Today with Mus</h1>
      <OfflineAppResume />
    </main>
  );
}
