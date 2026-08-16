'use client';

import { Button, EmptyState } from '@kayamo/ui';
import Link from 'next/link';
import { useState } from 'react';

type Hit = {
  foodId: string;
  name: string;
  source: string;
  brand?: string;
  portion: { kcal: number; grams: number; servingLabel: string };
};

export function BarcodeLookup() {
  const [barcode, setBarcode] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup(code: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/foods/resolve?barcode=${encodeURIComponent(code)}`);
      const json = (await res.json()) as { candidates?: Hit[]; error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Lookup failed.');
        setHits(null);
        return;
      }
      setHits(json.candidates ?? []);
    } catch {
      setError('Lookup failed. Try again.');
      setHits(null);
    } finally {
      setBusy(false);
    }
  }

  async function onDetect(file: File) {
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (opts: { formats: string[] }) => {
          detect: (source: ImageBitmap) => Promise<Array<{ rawValue?: string }>>;
        };
      }
    ).BarcodeDetector;
    if (!Detector) {
      setError('This browser cannot scan barcodes. Type the digits under the bars.');
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const codes = await new Detector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
      }).detect(bitmap);
      const value = codes[0]?.rawValue?.replace(/\D/g, '');
      if (!value) {
        setError('No barcode found in that photo. Type the digits instead.');
        return;
      }
      setBarcode(value);
      await lookup(value);
    } catch {
      setError('Could not read that barcode photo. Type the digits instead.');
    }
  }

  const miss = hits !== null && hits.length === 0 && barcode.length >= 8;

  return (
    <div className="mt-8 flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">
          barcode photo
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onDetect(file);
          }}
          className="font-body text-body text-text file:mr-3 file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:font-body file:text-body"
        />
      </label>

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (barcode.length >= 8) void lookup(barcode);
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">
            barcode digits
          </span>
          <input
            inputMode="numeric"
            value={barcode}
            onChange={(event) => setBarcode(event.target.value.replace(/\D/g, '').slice(0, 14))}
            className="min-h-12 border-b border-line bg-transparent px-0 font-body text-body text-text outline-none"
          />
        </label>
        <Button type="submit" size="lg" disabled={busy || barcode.length < 8}>
          {busy ? 'Looking up…' : 'Look up'}
        </Button>
      </form>

      {error ? <p className="font-body text-body text-warning">{error}</p> : null}

      {hits && hits.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {hits.map((hit) => (
            <li key={hit.foodId} className="border-y border-line py-3">
              <p className="font-body text-body">{hit.name}</p>
              <p className="font-data text-caption uppercase tracking-[0.14em] text-muted">
                {hit.source}
                {hit.brand ? ` · ${hit.brand}` : ''} · {Math.round(hit.portion.kcal)} kcal /{' '}
                {hit.portion.servingLabel}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {miss ? (
        <EmptyState
          title="Add this product"
          body="This barcode is not in Open Food Facts yet. Photograph the nutrition facts panel and save it to My Foods."
          action={
            <Link href={`/app/foods/add?barcode=${encodeURIComponent(barcode)}`}>
              <Button type="button" size="lg">
                Add this product
              </Button>
            </Link>
          }
        />
      ) : null}
    </div>
  );
}
