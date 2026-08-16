import Link from 'next/link';
import { DATA_LICENSES } from '@kayamo/food';

export const metadata = {
  title: 'About food data — KayaMo',
  description: 'Sources and licenses for KayaMo nutrition data',
};

export default function AboutPage() {
  const { usda, off } = DATA_LICENSES;

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-[390px] flex-col bg-bg">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-accent" aria-hidden="true" />
      <header className="px-4 pt-10 pb-6 pl-5">
        <p className="font-data text-caption uppercase tracking-[0.18em] text-muted">KayaMo</p>
        <h1 className="mt-2 font-body text-title">About food data</h1>
        <p className="mt-2 max-w-[36ch] font-body text-muted">
          Nutrition numbers come from open datasets, then from your own confirmed foods. Models never
          invent calorie or macro values.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-4 pb-10 pl-5">
        <section>
          <h2 className="font-body text-title">{usda.name}</h2>
          <p className="mt-2 font-body text-body text-muted">
            Generic ingredients and many packaged foods. License: {usda.license}.
          </p>
          <a
            className="mt-2 inline-block font-data text-caption text-accent underline-offset-2 hover:underline"
            href={usda.url}
            rel="noreferrer"
            target="_blank"
          >
            {usda.url}
          </a>
        </section>

        <section>
          <h2 className="font-body text-title">{off.name}</h2>
          <p className="mt-2 font-body text-body text-muted">{off.attribution}</p>
          <a
            className="mt-2 inline-block font-data text-caption text-accent underline-offset-2 hover:underline"
            href={off.url}
            rel="noreferrer"
            target="_blank"
          >
            {off.url}
          </a>
        </section>

        <p className="font-body text-caption text-muted">
          Philippine packaged SKUs are often missing from Open Food Facts. You can add a food yourself
          when a barcode is not in the catalogue.
        </p>

        <Link
          href="/app"
          className="font-data text-caption uppercase tracking-[0.14em] text-muted hover:text-text"
        >
          Back to app
        </Link>
      </div>
    </main>
  );
}
