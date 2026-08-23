'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { getProfile, listServings, listVisibleFoods } from '@kayamo/db';
import {
  nutrientsFromPer100g,
  persistableFoodId,
  toConfidenceString,
  type FoodCandidate,
} from '@kayamo/food/search-ui';
import { mealSlotAtHour } from '@kayamo/food/quick-log';
import type { LogFoodEntryInput } from '@kayamo/offline';
import {
  cacheFoodWithServings,
  getCachedServings,
  localHourFromInstant,
  logFoodEntries,
  tombstoneLocalFoodEntries,
} from '@kayamo/offline';
import { Button, EmptyState, Toast } from '@kayamo/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  barcodeEngine,
  cameraConstraintSets,
  cameraErrorCopy,
  isPermissionDenied,
  parseScannedBarcode,
  RETAIL_BARCODE_FORMATS,
  setTrackTorch,
  trackHasTorch,
} from '@/lib/barcode-scan';
import {
  QuantitySheet,
  sheetServingsFromFoodServings,
  toSheetServings,
  type QuantityTarget,
  type SheetServing,
} from '../../quantity-sheet';

const UNDO_MS = 8000;
const NATIVE_TICK_MS = 160;

type ResolveResponse = {
  candidates?: FoodCandidate[];
  error?: string;
};

type NativeDetector = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

type ZxingControls = { stop: () => void };

function asLogSource(value: string): LogFoodEntryInput['source'] {
  if (value === 'ph_core' || value === 'usda_fdc' || value === 'off' || value === 'user' || value === 'llm') {
    return value;
  }
  return 'user';
}

function asResolvedVia(value: string): LogFoodEntryInput['resolvedVia'] {
  if (
    value === 'ph_core' ||
    value === 'usda_fdc' ||
    value === 'off' ||
    value === 'user' ||
    value === 'llm' ||
    value === 'recipe'
  ) {
    return value;
  }
  return 'user';
}

function candidateToTarget(candidate: FoodCandidate, servingId: string | null): QuantityTarget {
  const nutrients = nutrientsFromPer100g(candidate.per100g, candidate.portion.grams);
  return {
    foodId: candidate.foodId,
    name: candidate.name,
    ...nutrients,
    quantity: String(candidate.portion.amount || 1),
    grams: String(candidate.portion.grams),
    servingId,
    servingLabel: candidate.portion.servingLabel,
    source: candidate.source,
    resolvedVia: candidate.source,
    confidence: toConfidenceString(candidate.confidence),
  };
}

function createNativeDetector(): NativeDetector | null {
  const Ctor = (
    globalThis as unknown as {
      BarcodeDetector?: new (opts: { formats: readonly string[] }) => NativeDetector;
    }
  ).BarcodeDetector;
  if (!Ctor) return null;
  return new Ctor({ formats: RETAIL_BARCODE_FORMATS });
}

async function openCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException('Camera API is missing', 'NotFoundError');
  }
  let last: unknown;
  for (const constraints of cameraConstraintSets()) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      last = error;
      if (isPermissionDenied(error)) throw error;
    }
  }
  throw last instanceof Error ? last : new DOMException('Could not start camera', 'NotReadableError');
}

export function BarcodeLookup({
  userId,
  onAddProduct,
}: {
  userId: string;
  onAddProduct: (barcode: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingRef = useRef<ZxingControls | null>(null);
  const nativeTimer = useRef<ReturnType<typeof setTimeout> | 0>(0);
  const stoppedRef = useRef(false);
  const handledRef = useRef(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | 0>(0);

  const [scanNonce, setScanNonce] = useState(0);
  const [live, setLive] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [typed, setTyped] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [hits, setHits] = useState<FoodCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState('Asia/Manila');
  const [dayStartsAt, setDayStartsAt] = useState('00:00:00');
  const [sheet, setSheet] = useState<{ target: QuantityTarget; servings: SheetServing[] } | null>(
    null,
  );
  const [undo, setUndo] = useState<{ ids: string[]; message: string } | null>(null);

  const hour = localHourFromInstant(new Date().toISOString(), timeZone);
  const mealSlot = mealSlotAtHour(hour);
  const miss = hits !== null && hits.length === 0 && Boolean(code);

  const releaseCamera = useCallback(() => {
    stoppedRef.current = true;
    if (nativeTimer.current) {
      clearTimeout(nativeTimer.current);
      nativeTimer.current = 0;
    }
    zxingRef.current?.stop();
    zxingRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const stopPreview = useCallback(() => {
    releaseCamera();
    setLive(false);
    setTorchOn(false);
    setTorchAvailable(false);
  }, [releaseCamera]);

  const openCandidate = useCallback(async (candidate: FoodCandidate) => {
    const id = persistableFoodId(candidate.foodId);
    const cached = id ? await getCachedServings(id) : [];
    const servings =
      cached.length > 0
        ? toSheetServings(cached)
        : sheetServingsFromFoodServings(candidate.servings);
    const servingId =
      servings.find((row) => row.label === candidate.portion.servingLabel)?.id ??
      servings.find((row) => row.isDefault)?.id ??
      servings[0]?.id ??
      null;
    setSheet({ target: candidateToTarget(candidate, servingId), servings });
  }, []);

  const lookup = useCallback(async (raw: string) => {
    const digits = parseScannedBarcode(raw);
    if (!digits) {
      setError('That does not look like a barcode. Use the digits under the bars.');
      return;
    }
    setBusy(true);
    setError(null);
    setCode(digits);
    try {
      const res = await fetch(`/api/foods/resolve?barcode=${encodeURIComponent(digits)}`);
      const json = (await res.json()) as ResolveResponse;
      if (!res.ok) {
        setHits(null);
        setError(json.error ?? 'Lookup failed.');
        return;
      }
      const candidates = json.candidates ?? [];
      setHits(candidates);
      const top = candidates[0];
      if (top) await openCandidate(top);
    } catch {
      setHits(null);
      setError('Lookup failed. Try again.');
    } finally {
      setBusy(false);
    }
  }, [openCandidate]);

  const onDecoded = useCallback(
    (raw: string) => {
      if (handledRef.current || stoppedRef.current) return;
      const digits = parseScannedBarcode(raw);
      if (!digits) return;
      handledRef.current = true;
      stopPreview();
      void lookup(digits);
    },
    [lookup, stopPreview],
  );

  useEffect(() => {
    const client = createBrowserSupabaseClient();
    let cancelled = false;
    async function hydrate() {
      try {
        const profile = await getProfile(client, userId);
        if (cancelled) return;
        if (profile?.timezone) setTimeZone(profile.timezone);
        if (profile?.day_starts_at) setDayStartsAt(profile.day_starts_at);
        const foods = await listVisibleFoods(client);
        for (const food of foods) {
          const servings = await listServings(client, food.id);
          await cacheFoodWithServings(food, servings);
        }
      } catch {
        // Dexie is enough offline.
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  useEffect(() => {
    stoppedRef.current = false;
    handledRef.current = false;
    let cancelled = false;

    async function startNative(video: HTMLVideoElement) {
      const detector = createNativeDetector();
      if (!detector) return false;
      const tick = async () => {
        if (cancelled || stoppedRef.current) return;
        try {
          const codes = await detector.detect(video);
          const raw = codes[0]?.rawValue;
          if (raw) {
            onDecoded(raw);
            return;
          }
        } catch {
          if (!cancelled && !stoppedRef.current) {
            await startZxing(video);
            return;
          }
        }
        if (!cancelled && !stoppedRef.current) {
          nativeTimer.current = setTimeout(() => void tick(), NATIVE_TICK_MS);
        }
      };
      nativeTimer.current = setTimeout(() => void tick(), NATIVE_TICK_MS);
      return true;
    }

    async function startZxing(video: HTMLVideoElement) {
      const stream = streamRef.current;
      if (!stream) return;
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromStream(stream, video, (result) => {
        const text = result?.getText();
        if (text) onDecoded(text);
      });
      if (cancelled || stoppedRef.current) {
        controls.stop();
        return;
      }
      zxingRef.current = controls;
    }

    async function start() {
      try {
        const stream = await openCameraStream();
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        const track = stream.getVideoTracks()[0];
        setTorchAvailable(Boolean(track && trackHasTorch(track)));
        setLive(true);
        const engine = barcodeEngine();
        if (engine === 'native') {
          const ok = await startNative(video);
          if (!ok) await startZxing(video);
        } else {
          await startZxing(video);
        }
      } catch (err) {
        if (!cancelled) setError(cameraErrorCopy(err));
      }
    }

    void start();
    return () => {
      cancelled = true;
      releaseCamera();
    };
  }, [onDecoded, releaseCamera, scanNonce]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !trackHasTorch(track)) return;
    const next = !torchOn;
    try {
      await setTrackTorch(track, next);
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }

  function showUndo(ids: string[], message: string) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ ids, message });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }

  async function logTarget(next: QuantityTarget) {
    setSheet(null);
    try {
      const rows = await logFoodEntries([
        {
          userId,
          mealSlot,
          foodId: persistableFoodId(next.foodId),
          foodName: next.name,
          quantity: next.quantity,
          grams: next.grams,
          kcal: next.kcal,
          protein_g: next.protein_g,
          carbs_g: next.carbs_g,
          fat_g: next.fat_g,
          fiber_g: next.fiber_g,
          sugar_g: next.sugar_g,
          sodium_mg: next.sodium_mg,
          source: asLogSource(next.source),
          resolvedVia: asResolvedVia(next.resolvedVia),
          inputMethod: 'barcode',
          servingId: next.servingId,
          servingLabel: next.servingLabel,
          confidence: next.confidence,
          timeZone,
          dayStartsAt,
        },
      ]);
      showUndo(
        rows.map((row) => row.id),
        `Logged ${next.name}`,
      );
    } catch {
      setError('Could not save locally. Try again.');
    }
  }

  async function onUndo() {
    if (!undo) return;
    const ids = undo.ids;
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    await tombstoneLocalFoodEntries({ ids, userId });
  }

  function retryCamera() {
    setError(null);
    setHits(null);
    setCode(null);
    setScanNonce((n) => n + 1);
  }

  return (
    <div className="mt-8 flex flex-col gap-5">
      <div className="relative overflow-hidden rounded-md bg-surface-2">
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full bg-black object-cover"
          autoPlay
          muted
          playsInline
          data-testid="barcode-video"
        />
        {!live && !error && hits === null ? (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center font-body text-body text-muted">
            Starting camera…
          </p>
        ) : null}
      </div>

      {torchAvailable ? (
        <Button type="button" variant={torchOn ? 'primary' : 'secondary'} size="md" onClick={() => void toggleTorch()}>
          {torchOn ? 'Light on' : 'Light off'}
        </Button>
      ) : null}

      {error ? (
        <div className="flex flex-col gap-3">
          <p className="font-body text-body text-warning">{error}</p>
          <Button type="button" variant="secondary" size="md" onClick={retryCamera}>
            Try the camera again
          </Button>
        </div>
      ) : null}

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (typed.length >= 8) {
            stopPreview();
            void lookup(typed);
          }
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="font-data text-caption uppercase tracking-[0.14em] text-muted">
            or type the digits
          </span>
          <input
            inputMode="numeric"
            value={typed}
            onChange={(event) => setTyped(event.target.value.replace(/\D/g, '').slice(0, 14))}
            className="min-h-12 border-b border-line bg-transparent px-0 font-body text-body text-text outline-none"
          />
        </label>
        <Button type="submit" size="lg" disabled={busy || typed.length < 8}>
          {busy ? 'Looking up…' : 'Look up'}
        </Button>
      </form>

      {miss ? (
        <EmptyState
          title="Add this product"
          body="This barcode is not in Open Food Facts yet. Photograph the nutrition facts panel and save it to My Foods."
          action={
            <Button type="button" size="lg" onClick={() => onAddProduct(code ?? '')}>
              Add this product
            </Button>
          }
        />
      ) : null}

      {sheet ? (
        <QuantitySheet
          key={sheet.target.foodId}
          target={sheet.target}
          servings={sheet.servings}
          onClose={() => setSheet(null)}
          onConfirm={(next) => void logTarget(next)}
        />
      ) : null}

      {undo ? (
        <div className="fixed inset-x-0 bottom-[5.5rem] z-40 mx-auto w-full max-w-[390px] px-4">
          <Toast
            message={undo.message}
            action={
              <button type="button" onClick={() => void onUndo()} className="font-semibold text-accent">
                Undo
              </button>
            }
          />
        </div>
      ) : null}
    </div>
  );
}
