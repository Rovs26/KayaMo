import { BarcodeLookup } from './barcode-lookup';

export default function BarcodePage() {
  return (
    <main className="px-4 pt-8 pl-5">
      <p className="font-data text-caption uppercase tracking-[0.18em] text-muted">Barcode</p>
      <h1 className="mt-2 font-body text-title">Look up a pack</h1>
      <p className="mt-2 max-w-[32ch] font-body text-body text-muted">
        If Open Food Facts does not have it yet, add it from the label.
      </p>
      <BarcodeLookup />
    </main>
  );
}
