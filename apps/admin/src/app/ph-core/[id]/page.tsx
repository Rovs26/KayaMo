import { diffPhCoreVsDb, issuesForFood, loadPhCoreYaml } from '@kayamo/food';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PhCoreEditor } from '../editor';
import { loadPhCoreDbFood } from '@/lib/ph-core-db';
import { isPhCoreEditorEnabled } from '@/lib/ph-core-dev';

export const dynamic = 'force-dynamic';

export default async function PhCoreFoodPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isPhCoreEditorEnabled()) notFound();
  const { id } = await params;
  const yaml = loadPhCoreYaml();
  const food = yaml.foods.find((row) => row.id === id);
  if (!food) notFound();

  const db = await loadPhCoreDbFood(id);
  const diffs = diffPhCoreVsDb(food, db);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col bg-bg px-4 pt-10 pb-16">
      <p className="font-data text-caption uppercase tracking-[0.18em] text-muted">KayaMo admin</p>
      <h1 className="mt-2 font-body text-title">{food.name}</h1>
      <p className="mt-1 font-data text-caption text-muted">{food.id}</p>
      <div className="mt-8">
        <PhCoreEditor food={food} issues={issuesForFood(food)} diffs={diffs} />
      </div>
      <Link
        href="/ph-core"
        className="mt-10 font-data text-caption uppercase tracking-[0.14em] text-muted"
      >
        Back to list
      </Link>
    </main>
  );
}
