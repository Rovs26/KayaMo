export const RETAIL_BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const;

export type BarcodeEngine = 'native' | 'zxing';

/** Feature-detect only. Never sniff the user-agent. */
export function hasNativeBarcodeDetector(
  global: { BarcodeDetector?: unknown } = globalThis as { BarcodeDetector?: unknown },
): boolean {
  return typeof global.BarcodeDetector === 'function';
}

export function barcodeEngine(
  global: { BarcodeDetector?: unknown } = globalThis as { BarcodeDetector?: unknown },
): BarcodeEngine {
  return hasNativeBarcodeDetector(global) ? 'native' : 'zxing';
}

export function parseScannedBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  return digits;
}

export function isPermissionDenied(error: unknown): boolean {
  const name = error instanceof DOMException ? error.name : '';
  return name === 'NotAllowedError' || name === 'PermissionDeniedError';
}

/**
 * Recovery copy for camera failures. Names both Safari and Chrome settings
 * so we do not need to sniff the browser.
 */
export function cameraErrorCopy(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (isPermissionDenied(error)) {
    return [
      'Camera access is blocked.',
      'Safari: Settings → Safari → Camera → Allow.',
      'Chrome: tap the lock icon beside the address → Site settings → Camera → Allow.',
      'Then return here and scan again, or type the digits under the bars.',
    ].join(' ');
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'This device has no camera KayaMo can use. Type the digits under the bars instead.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Another app is using the camera. Close it, then scan again — or type the digits under the bars.';
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'Could not match this camera. Type the digits under the bars, or try again.';
  }
  if (name === 'SecurityError') {
    return 'Camera needs a secure page (https or localhost). Type the digits under the bars for now.';
  }
  return 'Could not start the camera. Type the digits under the bars instead.';
}

/** Looser sets last — Safari often rejects exact width/height. */
export function cameraConstraintSets(): MediaStreamConstraints[] {
  return [
    {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    { audio: false, video: { facingMode: { ideal: 'environment' } } },
    { audio: false, video: true },
  ];
}

export function trackHasTorch(track: Pick<MediaStreamTrack, 'getCapabilities'>): boolean {
  try {
    const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
    return Boolean(capabilities && 'torch' in capabilities);
  } catch {
    return false;
  }
}

export async function setTrackTorch(
  track: Pick<MediaStreamTrack, 'applyConstraints'>,
  on: boolean,
): Promise<void> {
  await track.applyConstraints({
    advanced: [{ torch: on } as MediaTrackConstraintSet],
  });
}
