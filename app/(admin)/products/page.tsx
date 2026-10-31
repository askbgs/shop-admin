import Link from 'next/link';
import Flash from '@/components/Flash';
import { categoryNames, listProducts } from '@/lib/catalog';
import { lkr } from '@/lib/format';
import { lowStockThreshold } from '@/lib/queries';

export const dynamic = 'force-dynamic';

type SP = { q?: string; category?: string; status?: string; page?: string; ok?: string; err?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const search = (sp.q ?? '').trim().slice(0, 60);
  const category = (sp.category ?? '').slice(0, 80);
  const status = ['active', 'inactive'].includes(sp.status ?? '') ? sp.status! : '';
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 30;
  const [{ rows, total }, cats] = await Promise.all([
    listProducts({ search, category, status, page, pageSize }),
    categoryNames(),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const low = lowStockThreshold();
  const href = (p: number) => {
    const u = new URLSearchParams();
    if (search) u.set('q', search);
    if (category) u.set('category', category);
    if (status) u.set('status', status);
    if (p > 1) u.set('page', String(p));
    const s = u.toString();
    return s ? `/products?${s}` : '/products';
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>Products</h1>
          <div className="muted">{total} {total === 1 ? 'product' : 'products'}</div>
        </div>
        <Link className="btn primary" href="/products/new">+ New product</Link>
      </div>
      <Flash ok={sp.ok} err={sp.err} okText={{ deleted: 'Product deleted.' }} />

      <form className="filters" method="get">
        <label>Search<input name="q" defaultValue={search} placeholder="Name, SKU or brand" style={{ width: 220 }} /></label>
        <label>Category
          <select name="category" defaultValue={category}>
            <option value="">All</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Status
          <select name="status" defaultValue={status}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <button className="btn primary" type="submit">Apply</button>
        {(search || category || status) && <Link className="btn" href="/products">Clear</Link>}
      </form>

      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">No products found. <Link href="/products/new">Add your first product</Link></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th /><th>Product</th><th>Category</th><th>For</th><th className="r">Price</th><th className="r">Variants</th><th className="r">Stock</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className={`link ${p.is_active ? '' : 'muted-row'}`}>
                    <td className="tight">
                      {p.image_url ? <img className="thumb" src={p.image_url} alt="" loading="lazy" /> : <div className="thumb" />}
                    </td>
                    <td><Link href={`/products/${p.id}`}><b>{p.name}</b></Link>{p.sku && <div className="muted">{p.sku}</div>}</td>
                    <td>{p.category}</td>
                    <td style={{ textTransform: 'capitalize' }}>{p.gender}</td>
                    <td className="r num">{lkr(p.price_cents)}</td>
                    <td className="r num">{p.variant_count}</td>
                    <td className={`r num ${p.total_stock === 0 ? 'stock-0' : p.total_stock <= low ? 'stock-low' : ''}`}>{p.total_stock}</td>
                    <td>{p.is_active ? <span className="badge s-delivered">Active</span> : <span className="badge s-cancelled">Inactive</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="pager">
            <span className="muted">Page {page} of {pages}</span>
            <div className="actions">
              {page > 1 && <Link className="btn" href={href(page - 1)}>← Prev</Link>}
              {page < pages && <Link className="btn" href={href(page + 1)}>Next →</Link>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
