import { AddProductForm } from './add-product-form';

export default async function AddProductPage({
  searchParams,
}: {
  searchParams: Promise<{ barcode?: string }>;
}) {
  const params = await searchParams;
  const barcode = params.barcode?.replace(/\D/g, '') ?? '';

  return (
    <main className="px-4 pt-8 pl-5">
      <p className="font-data text-caption uppercase tracking-[0.18em] text-muted">My Foods</p>
      <h1 className="mt-2 font-body text-title">Add this product</h1>
      <p className="mt-2 max-w-[32ch] font-body text-body text-muted">
        Photograph the nutrition facts panel. Confirm the numbers before they save to My Foods.
      </p>
      <AddProductForm barcode={barcode} />
    </main>
  );
}
