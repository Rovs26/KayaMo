# @kayamo/mobile — Capacitor Android shell

Wraps the `apps/pwa` static export. **Native code only** — UI lives in the PWA.

- `appId` `ph.kayamo.app` · `appName` KayaMo
- Android only this pass. `webDir` is `www` (bundled). Never a remote `server.url`.
- Plugins sit behind `src/native/` so the browser PWA still works.

## Tooling this Capacitor 7 project needs

- **Android Studio Ladybug | 2024.2.1 or newer**
- **JDK 21** (Ladybug ships it). CLI builds: `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`
- Gradle will fail on JDK 17.

## First pass on a phone (auth + `/api` still on Next)

```bash
pnpm dev:pwa
cd apps/mobile && npx cap run android --live-reload
```

The WebView talks to the LAN Next server, so magic-link login, food search, and OCR work. This is the gym / carinderia check.

## Release bundle (no Next server inside the APK)

Set `NEXT_PUBLIC_API_ORIGIN` to the **hosted** PWA origin (the process that still
has `OPENAI_API_KEY`). `pnpm mobile:sync` refuses to run without it.

The WebView origin is `https://localhost`. Relative `/api` 404s. Cookie auth
does not cross that hop — `apiFetch` sends `Authorization: Bearer` and the
hosted `/api` CORS-allows `https://localhost`.

```bash
pnpm mobile:sync
npx cap run android --target <device-id>   # from apps/mobile
```

## Signing

```bash
keytool -genkey -v -keystore apps/mobile/android/kayamo-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias kayamo
cp apps/mobile/android/keystore.properties.example \
   apps/mobile/android/keystore.properties
```

Never commit the `.jks` or `keystore.properties`. Back the keystore up off-device — lose it and `ph.kayamo.app` cannot be updated.

`versionCode` is frozen per internal-test AAB in `android/app/build.gradle`. Never reuse a code.

```bash
cd apps/mobile/android && ./gradlew bundleRelease
```
