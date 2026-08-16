import { Button, EmptyState } from '@kayamo/ui';
import Link from 'next/link';

export default function ChatStubPage() {
  return (
    <main className="px-4 pt-8 pl-5">
      <p className="font-data text-caption uppercase tracking-[0.18em] text-muted">Coco</p>
      <h1 className="mt-2 font-body text-title">Chat</h1>
      <EmptyState
        className="mt-8"
        title="Coco is not in this build yet"
        body="Search for a food, or add it to My Foods from the label."
        action={
          <div className="flex flex-col gap-3">
            <Link href="/app/foods/search">
              <Button type="button" size="lg">
                Search foods
              </Button>
            </Link>
            <Link href="/app/foods/add">
              <Button type="button" variant="secondary" size="lg">
                Add it yourself
              </Button>
            </Link>
          </div>
        }
      />
    </main>
  );
}
