import { loadRootEnv } from '../packages/db/src/load-root-env';
import { seed } from '../packages/db/src/seed';

async function main() {
  loadRootEnv();
  const result = await seed();
  const planning =
    result.tasks > 0
      ? `, ${result.tasks} task, and ${result.routines} routine for KAYAMO_SEED_USER_ID`
      : '';
  console.info(
    `Seeded ${result.foods} foods, ${result.exercises} exercises, ${result.stages} Coco stages, ${result.achievements} achievements, ${result.cosmetics} cosmetics, ${result.scripturePassages} reviewed Scripture passages, and ${result.recipes} recipe${planning}.`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  console.error(`Seed failed: ${message}`);
  process.exitCode = 1;
});
