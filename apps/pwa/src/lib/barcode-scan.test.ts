import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  barcodeEngine,
  cameraConstraintSets,
  cameraErrorCopy,
  hasNativeBarcodeDetector,
  isPermissionDenied,
  parseScannedBarcode,
  trackHasTorch,
} from './barcode-scan';

describe('barcodeEngine', () => {
  it('uses native BarcodeDetector when the constructor exists', () => {
    expect(barcodeEngine({ BarcodeDetector: class {} })).toBe('native');
    expect(hasNativeBarcodeDetector({ BarcodeDetector: class {} })).toBe(true);
  });

  it('falls back to zxing when BarcodeDetector is missing, without a user-agent', () => {
    expect(barcodeEngine({})).toBe('zxing');
    expect(hasNativeBarcodeDetector({})).toBe(false);
  });
});

describe('parseScannedBarcode', () => {
  it('keeps retail EAN/UPC digit strings', () => {
    expect(parseScannedBarcode('3017620422003')).toBe('3017620422003');
    expect(parseScannedBarcode('EAN 4800016641103')).toBe('4800016641103');
  });

  it('rejects short or empty scans', () => {
    expect(parseScannedBarcode('123')).toBeNull();
    expect(parseScannedBarcode('abc')).toBeNull();
  });
});

describe('cameraErrorCopy', () => {
  it('tells the user how to re-enable the camera after a denial', () => {
    const error = new DOMException('denied', 'NotAllowedError');
    expect(isPermissionDenied(error)).toBe(true);
    const copy = cameraErrorCopy(error);
    expect(copy).toContain('Settings → Safari → Camera');
    expect(copy).toContain('lock icon');
    expect(copy).toContain('type the digits');
    expect(copy.toLowerCase()).not.toContain('something went wrong');
  });

  it('covers a missing camera without asking them to retry permission', () => {
    const copy = cameraErrorCopy(new DOMException('missing', 'NotFoundError'));
    expect(copy).toContain('no camera');
    expect(copy).toContain('Type the digits');
  });
});

describe('cameraConstraintSets', () => {
  it('starts with environment camera and ends with an unconstrained fallback', () => {
    const sets = cameraConstraintSets();
    expect(sets[0]?.video).toMatchObject({ facingMode: { ideal: 'environment' } });
    expect(sets[sets.length - 1]).toEqual({ audio: false, video: true });
  });
});

describe('trackHasTorch', () => {
  it('is true only when the capability is present', () => {
    expect(trackHasTorch({ getCapabilities: () => ({ torch: true }) as MediaTrackCapabilities })).toBe(
      true,
    );
    expect(trackHasTorch({ getCapabilities: () => ({}) as MediaTrackCapabilities })).toBe(false);
    expect(
      trackHasTorch({
        getCapabilities: () => {
          throw new Error('unsupported');
        },
      }),
    ).toBe(false);
  });
});

describe('no user-agent sniff', () => {
  it('picks the engine from BarcodeDetector, not navigator.userAgent', () => {
    const src = readFileSync(new URL('./barcode-scan.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch('userAgent');
    expect(src).not.toMatch('iPhone');
    expect(src).not.toMatch('navigator.platform');
  });
});
