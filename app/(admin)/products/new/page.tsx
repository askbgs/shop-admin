import Link from 'next/link';
import Flash from '@/components/Flash';
import ProductForm from '@/components/ProductForm';
import { categoryNames } from '@/lib/catalog';
import { createProduct } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const sp = await searchParams;
  const cats = await categoryNames();
  return (
    <>
      <div className="head">
        <div>
          <div className="muted"><Link href="/products">Products</Link> /</div>
          <h1>New product</h1>
          <div className="muted">After saving, add sizes, colours and stock.</div>
        </div>
      </div>
      <Flash err={sp.err} />
      <div style={{ maxWidth: 820 }}>
        <ProductForm action={createProduct} categories={cats} submitLabel="Create product" />
      </div>
    </>
  );
}
