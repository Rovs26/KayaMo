import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(mobileRoot, '../..');
const pwaRoot = path.join(repoRoot, 'apps/pwa');
const parkedRoot = path.join(pwaRoot, '.capacitor-parked');
const www = path.join(mobileRoot, 'www');

const parks: Array<{ src: string; name: string }> = [
  { src: path.join(pwaRoot, 'src/app/api'), name: 'api' },
  { src: path.join(pwaRoot, 'src/app/auth/callback'), name: 'auth-callback' },
  { src: path.join(pwaRoot, 'src/app/login/actions.ts'), name: 'login-actions.ts' },
  { src: path.join(pwaRoot, 'src/proxy.ts'), name: 'proxy.ts' },
];

function run(command: string, args: string[], env: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit', env });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
}

const pwaNext = path.join(pwaRoot, '.next');

function restoreAll(): void {
  for (const item of parks) {
    const dest = path.join(parkedRoot, item.name);
    if (!existsSync(dest)) continue;
    if (existsSync(item.src)) {
      rmSync(dest, { recursive: true, force: true });
      continue;
    }
    mkdirSync(path.dirname(item.src), { recursive: true });
    renameSync(dest, item.src);
  }
}

function parkAll(): string[] {
  mkdirSync(parkedRoot, { recursive: true });
  const moved: string[] = [];
  for (const item of parks) {
    if (!existsSync(item.src)) continue;
    const dest = path.join(parkedRoot, item.name);
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    renameSync(item.src, dest);
    moved.push(item.name);
  }
  return moved;
}

const leftoverAppParked = path.join(pwaRoot, 'src/app/.api-parked');
if (existsSync(leftoverAppParked)) {
  rmSync(leftoverAppParked, { recursive: true, force: true });
}

restoreAll();

if (!process.env.NEXT_PUBLIC_API_ORIGIN?.trim() && process.env.CAPACITOR_ALLOW_RELATIVE_API !== '1') {
  throw new Error(
    'NEXT_PUBLIC_API_ORIGIN is required for pnpm mobile:sync. The APK has no Next server; chat, OCR, and food resolve 404 without a hosted origin. Live-reload against pnpm dev:pwa does not need this. Set it in .env.local, or CAPACITOR_ALLOW_RELATIVE_API=1 to bundle UI-only (AI routes will 404).',
  );
}

mkdirSync(www, { recursive: true });
rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

try {
  parkAll();
  rmSync(pwaNext, { recursive: true, force: true });
  run('pnpm', ['--filter', '@kayamo/pwa', 'build'], {
    ...process.env,
    CAPACITOR_BUILD: '1',
  });
  const outDir = path.join(pwaRoot, 'out');
  if (!existsSync(outDir)) {
    throw new Error('PWA static export did not produce apps/pwa/out');
  }
  cpSync(outDir, www, { recursive: true });
} finally {
  restoreAll();
}

const cap = spawnSync('npx', ['cap', 'sync', 'android'], {
  cwd: mobileRoot,
  stdio: 'inherit',
  env: process.env,
});
if (cap.status !== 0) {
  throw new Error('npx cap sync android failed');
}
console.log('Mobile sync complete. webDir is the bundled PWA export.');
