import { loadRootEnv } from '../packages/db/src/load-root-env';
import { seed } from '../packages/db/src/seed';

async function main() {
  loadRootEnv();
  const result = await seed();
  console.info(`Seeded ${result.foods} foods and ${result.recipes} recipe.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  console.error(`Seed failed: ${message}`);
  process.exitCode = 1;
});
