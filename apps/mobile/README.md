# @kayamo/mobile — Capacitor shell

Wraps the `apps/pwa` build for Android and iOS. Built in Chapters 30–32.

**This app holds native code only.** No screens, no business logic — if you're
writing UI here, it belongs in the PWA.

- `capacitor.config.ts` — appId `ph.kayamo.app`, appName `KayaMo`
- `android/`, `ios/` — generated native projects
- native plugin wiring: camera, ML Kit barcode, push, haptics, health

**Why not React Native:** the PWA already exists and works. Capacitor embeds
it verbatim; React Native would mean rebuilding every screen.

**Build:**
```bash
pnpm --filter @kayamo/pwa build
pnpm --filter @kayamo/mobile sync
npx cap open android    # or ios
```
