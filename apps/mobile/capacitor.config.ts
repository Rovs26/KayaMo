import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Bundle the PWA build into the APK (webDir). Do not set server.url to a
 * hosted origin — that is a remote WebView, which complicates Play review
 * and breaks offline Dexie as the source of truth.
 *
 * Next API routes (OCR, Coco, guidance) cannot run inside the WebView.
 * CAPACITOR_BUILD parks those routes and static-exports the UI; the WebView
 * calls NEXT_PUBLIC_API_ORIGIN when that env is set.
 */
const config: CapacitorConfig = {
  appId: 'ph.kayamo.app',
  appName: 'KayaMo',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#FAF7F0',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1F3D2B',
    },
    LocalNotifications: {
      smallIcon: 'ic_launcher',
      iconColor: '#1F3D2B',
    },
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
