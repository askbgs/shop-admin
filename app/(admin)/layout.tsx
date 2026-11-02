import Nav from '@/components/Nav';
import OrderWatcher from '@/components/OrderWatcher';
import { q } from '@/lib/db';
import { ensureSchema } from '@/lib/migrate';
import { lowStockThreshold } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureSchema();
  const [c] = await q<{ pending: number; low: number; store_name: string | null; latest: string | null }>(
    `SELECT (SELECT COUNT(*) FROM orders WHERE status = 'pending')::int AS pending,
            (SELECT COUNT(*) FROM product_variants v JOIN products p ON p.id = v.product_id
              WHERE v.is_active AND p.is_active AND v.stock_qty <= $1)::int AS low,
            (SELECT store_name FROM store_settings WHERE id = 1) AS store_name,
            (SELECT MAX(created_at)::text FROM orders) AS latest`,
    [lowStockThreshold()],
  );
  return (
    <div className="shell">
      <Nav pending={c?.pending ?? 0} lowStock={c?.low ?? 0} storeName={c?.store_name ?? 'Shop'} />
      <main className="main">{children}</main>
      <OrderWatcher initialLatest={c?.latest ?? null} />
    </div>
  );
}
