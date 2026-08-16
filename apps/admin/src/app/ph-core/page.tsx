import { issuesForFood, loadPhCoreYaml } from '@kayamo/food';
import { Button } from '@kayamo/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { applyAllPhCoreFoods } from './actions';
import { loadPhCoreDbIndex } from '@/lib/ph-core-db';
import { isPhCoreEditorEnabled } from '@/lib/ph-core-dev';

export const dynamic = 'force-dynamic';

export default async function PhCoreListPage() {
  if (!isPhCoreEditorEnabled()) notFound();

  const yaml = loadPhCoreYaml();
  const db = await loadPhCoreDbIndex();

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col bg-bg px-4 pt-10 pb-16">
      <p className="font-data text-caption uppercase tracking-[0.18em] text-muted">KayaMo admin</p>
      <h1 className="mt-2 font-body text-title">PH core</h1>
      <p className="mt-2 max-w-[48ch] font-body text-muted">
        YAML is the source of truth. Numbers come from USDA ingredient mixes, not FNRI. Confirm a
        row only after you have checked it yourself.
      </p>
      <p className="mt-3 font-data text-caption text-muted">
        {yaml.foods.length} foods · {yaml.errors.length} errors · {yaml.warnings.length} warnings
      </p>

      <form
        className="mt-6"
        action={async () => {
          'use server';
          await applyAllPhCoreFoods();
        }}
      >
        <Button type="submit" variant="secondary" size="md">
          Apply all to database
        </Button>
      </form>

      <table className="mt-8 w-full text-left font-data text-caption">
        <thead>
          <tr className="text-muted">
            <th className="py-2 pr-3">food</th>
            <th className="py-2 pr-3">kcal</th>
            <th className="py-2 pr-3">conf</th>
            <th className="py-2">db</th>
          </tr>
        </thead>
        <tbody>
          {yaml.foods.map((food) => {
            const remote = db.get(food.id);
            const foodIssues = issuesForFood(food);
            const dbStatus = !remote
              ? 'missing'
              : remote.name !== food.name || Number(remote.kcal) !== food.per100g.kcal
                ? 'diff'
                : 'ok';
            return (
              <tr key={food.id} className="border-t border-line">
                <td className="py-2 pr-3">
                  <Link href={`/ph-core/${food.id}`} className="text-accent hover:underline">
                    {food.name}
                  </Link>
                  {foodIssues.length > 0 ? (
                    <span className="mt-1 block text-warning">{foodIssues[0]?.code}</span>
                  ) : null}
                </td>
                <td className="py-2 pr-3">{food.per100g.kcal}</td>
                <td className="py-2 pr-3">{food.verified ? '1.00' : food.confidence}</td>
                <td className="py-2">{dbStatus}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Link href="/" className="mt-10 font-data text-caption uppercase tracking-[0.14em] text-muted">
        Back
      </Link>
    </main>
  );
}
