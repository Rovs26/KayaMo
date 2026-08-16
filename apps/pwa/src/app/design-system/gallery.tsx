'use client';

import { useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  NumberDisplay,
  Sheet,
  Toast,
  TrendRibbon,
} from '@kayamo/ui';

const TREND = [
  { date: '2026-08-03', weight: 74.9, trend: 74.4 },
  { date: '2026-08-04', weight: 74.1, trend: 74.28 },
  { date: '2026-08-05', weight: 74.6, trend: 74.18 },
  { date: '2026-08-06', weight: 73.2, trend: 73.92 },
  { date: '2026-08-07', weight: 73.8, trend: 73.78 },
  { date: '2026-08-08', weight: 73.4, trend: 73.58 },
  { date: '2026-08-09', weight: 72.6, trend: 73.32 },
  { date: '2026-08-10', weight: 73.1, trend: 73.16 },
  { date: '2026-08-11', weight: 72.8, trend: 72.98 },
  { date: '2026-08-12', weight: 71.9, trend: 72.72 },
  { date: '2026-08-13', weight: 72.6, trend: 72.58 },
  { date: '2026-08-14', weight: 72.2, trend: 72.4 },
  { date: '2026-08-15', weight: 72.4, trend: 72.28 },
  { date: '2026-08-16', weight: 71.9, trend: 72.14 },
];

function Stamp({ children }: { children: string }) {
  return (
    <p className="px-4 pt-6 pb-2 font-data text-caption uppercase tracking-[0.18em] text-muted">
      {children}
    </p>
  );
}

export function Gallery() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toastOn, setToastOn] = useState(true);

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-[390px] flex-col bg-bg">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-accent" aria-hidden="true" />

      <div className="flex-1 pb-36">

      <header className="flex items-end justify-between px-4 pt-6 pb-2 pl-5">
        <div>
          <p className="font-data text-caption uppercase tracking-[0.18em] text-muted">
            KayaMo
          </p>
          <h1 className="mt-1 font-body text-title">Design system</h1>
        </div>
        <p className="font-data text-caption text-muted">390</p>
      </header>

      <TrendRibbon series={TREND} target={70.5} />

      <Stamp>scale · number display</Stamp>
      <div className="mx-4 border-y border-line font-data">
        <div className="flex items-baseline justify-between py-2.5">
          <span className="text-caption uppercase tracking-[0.14em] text-muted">remain</span>
          <NumberDisplay value={1480} unit="kcal" size="md" />
        </div>
        <div className="flex items-baseline justify-between border-t border-line py-2.5">
          <span className="text-caption uppercase tracking-[0.14em] text-muted">protein</span>
          <NumberDisplay value={86} unit="g" size="md" tone="accent" />
        </div>
        <div className="flex items-baseline justify-between border-t border-line py-2.5">
          <span className="text-caption uppercase tracking-[0.14em] text-muted">over</span>
          <NumberDisplay value={210} unit="kcal" size="md" tone="warning" />
        </div>
      </div>

      <Stamp>log lines · card</Stamp>
      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="font-body text-body">Adobo + kanin</p>
            <p className="font-data text-caption text-muted">1 order · tanghalian</p>
          </div>
          <NumberDisplay value={620} unit="kcal" size="sm" />
        </div>
      </Card>
      <Card tone="warning">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="font-body text-body">Coke sakto</p>
            <p className="font-data text-caption text-muted">1 can · over target</p>
          </div>
          <NumberDisplay value={140} unit="kcal" size="sm" tone="warning" />
        </div>
      </Card>

      <Stamp>empty</Stamp>
      <div className="scroll-mb-40 px-4">
        <EmptyState
          title="Walang entry pa"
          body="Log the first plate. Numbers stay here; nothing is judged."
          action={
            <Button size="lg" onClick={() => setSheetOpen(true)}>
              Quick log
            </Button>
          }
        />
      </div>

      <Stamp>toast</Stamp>
      {toastOn ? (
        <Toast
          message="Logged. Undo?"
          action={
            <button type="button" className="font-body font-semibold text-accent">
              Undo
            </button>
          }
        />
      ) : (
        <p className="px-4 font-data text-caption text-muted">toast hidden</p>
      )}
      <Toast tone="warning" message="Over target on kcal — logged as-is." />

      <Stamp>buttons</Stamp>
      <div className="flex flex-col gap-2 px-4">
        <Button variant="secondary" size="md">
          Secondary md
        </Button>
        <Button variant="ghost" size="md">
          Ghost md
        </Button>
        <Button variant="primary" size="lg" disabled>
          Disabled
        </Button>
      </div>

      <div className="h-4" />
      </div>

      <div className="sticky bottom-0 z-30 border-t border-line bg-bg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-2">
          <Button size="lg" onClick={() => setSheetOpen(true)}>
            Log meal
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setToastOn((value) => !value)}
          >
            {toastOn ? 'Hide toast' : 'Show toast'}
          </Button>
        </div>
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Quantity"
        footer={
          <>
            <Button size="lg" onClick={() => setSheetOpen(false)}>
              Save
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setSheetOpen(false)}>
              Close
            </Button>
          </>
        }
      >
        <p className="mb-4 font-body text-muted">PH units first. Thumb-sized steppers.</p>
        <div className="flex items-center justify-between border-y border-line py-3">
          <span className="font-body">tasa</span>
          <NumberDisplay value={2} size="lg" />
        </div>
      </Sheet>
    </div>
  );
}
