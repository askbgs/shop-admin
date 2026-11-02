import Link from 'next/link';
import Flash from '@/components/Flash';
import { listCategories } from '@/lib/catalog';
import { addCategory, deleteCategory, renameCategory } from './actions';
import PendingModal from '@/components/PendingModal';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const cats = await listCategories();
  return (
    <>
      <div className="head">
        <div>
          <h1>Categories</h1>
          <div className="muted">Renaming a category updates all its products too.</div>
        </div>
      </div>
      <Flash ok={sp.ok} err={sp.err} okText={{ added: 'Category added.', renamed: 'Category renamed.', deleted: 'Category deleted.' }} />

      <div className="grid two" style={{ alignItems: 'start' }}>
        <div className="card">
          {cats.length === 0 ? (
            <div className="empty">No categories yet</div>
          ) : (
            <table>
              <thead><tr><th>Name</th><th className="r">Products</th><th /></tr></thead>
              <tbody>
                {cats.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <form id={`c-${c.id}`} action={renameCategory} style={{ display: 'flex', gap: 8 }}>
                        <PendingModal title="Renaming category…" detail="Updating the category and all its products." />
                        <input type="hidden" name="id" value={c.id} />
                        <input className="inline-input" name="name" defaultValue={c.name} required maxLength={80} />
                      </form>
                    </td>
                    <td className="r num">
                      <Link href={`/products?category=${encodeURIComponent(c.name)}`}>{c.product_count}</Link>
                      {c.product_count !== c.active_count && <div className="muted">{c.active_count} active</div>}
                    </td>
                    <td className="tight">
                      <div className="actions">
                        <button className="btn" type="submit" form={`c-${c.id}`}>Rename</button>
                        {c.product_count === 0 && (
                          <form action={deleteCategory}>
                            <PendingModal title="Deleting category…" />
                            <input type="hidden" name="id" value={c.id} />
                            <button className="btn danger" type="submit" title="Delete category">✕</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <form action={addCategory} className="card">
          <PendingModal title="Adding category…" />
          <h2>Add category</h2>
          <label className="field">
            <span>Name</span>
            <input name="name" required maxLength={80} placeholder="e.g. Women Saree" />
          </label>
          <div className="form-actions"><button className="btn primary" type="submit">Add category</button></div>
        </form>
      </div>
    </>
  );
}
