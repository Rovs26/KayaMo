/**
 * Capability-detecting native bridge.
 * Web/PWA paths stay unchanged — every function no-ops or returns null off-device.
 */
import { Capacitor } from '@capacitor/core';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export async function scanRetailBarcode(): Promise<string | null> {
  if (!isNativeApp()) return null;
  const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');
  const granted = await BarcodeScanner.requestPermissions();
  if (granted.camera !== 'granted') return null;
  const { barcodes } = await BarcodeScanner.scan({
    formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE],
  });
  const raw = barcodes[0]?.rawValue ?? '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  return digits;
}

export async function takePhotoJpeg(): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  if (!isNativeApp()) return null;
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  const photo = await Camera.getPhoto({
    quality: 80,
    resultType: CameraResultType.Base64,
    source: CameraSource.Camera,
  });
  const base64 = photo.base64String;
  if (!base64) return null;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, mediaType: 'image/jpeg' };
}

export async function scheduleRestNotification(id: string, atIso: string, body: string): Promise<void> {
  if (!isNativeApp()) return;
  const at = Date.parse(atIso);
  if (!Number.isFinite(at) || at <= Date.now()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.requestPermissions();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId(id),
        title: 'Rest done',
        body,
        schedule: { at: new Date(at) },
        extra: { kayamo: 'rest-timer' },
      },
    ],
  });
}

export async function cancelRestNotification(id: string): Promise<void> {
  if (!isNativeApp()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({
    notifications: [{ id: notificationId(id) }],
  });
}

export async function setNativeChrome(): Promise<void> {
  if (!isNativeApp()) return;
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  const { SplashScreen } = await import('@capacitor/splash-screen');
  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: '#1F3D2B' });
  await SplashScreen.hide();
}

export async function hapticLight(): Promise<void> {
  if (!isNativeApp()) return;
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  await Haptics.impact({ style: ImpactStyle.Light });
}

export async function nativeShare(title: string, text: string, url?: string): Promise<void> {
  if (!isNativeApp()) return;
  const { Share } = await import('@capacitor/share');
  await Share.share({ title, text, url });
}

export async function nativePrefGet(key: string): Promise<string | null> {
  if (!isNativeApp()) return null;
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key });
  return value;
}

export async function nativePrefSet(key: string, value: string): Promise<void> {
  if (!isNativeApp()) return;
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key, value });
}

export async function registerPushIfNative(): Promise<string | null> {
  if (!isNativeApp()) return null;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') return null;
  await PushNotifications.register();
  return new Promise((resolve) => {
    void PushNotifications.addListener('registration', (token) => resolve(token.value));
    window.setTimeout(() => resolve(null), 8_000);
  });
}

/**
 * kayamo:// and https://kayamo.ph land here. Returns an unsubscribe.
 * Auth callbacks include ?code= for PKCE; other paths are in-app routes.
 */
export function listenAppUrlOpen(onOpen: (url: string) => void): () => void {
  if (!isNativeApp()) return () => undefined;
  let remove: (() => void) | undefined;
  void import('@capacitor/app').then(({ App }) => {
    void App.addListener('appUrlOpen', (event) => onOpen(event.url)).then((handle) => {
      remove = () => {
        void handle.remove();
      };
    });
  });
  return () => remove?.();
}

function notificationId(value: string): number {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) {
    total = (total + value.charCodeAt(i) * (i + 1)) % 1_000_000_000;
  }
  return total + 1;
}
