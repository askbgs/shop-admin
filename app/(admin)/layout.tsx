import Nav from '@/components/Nav';
import { q } from '@/lib/db';
import { lowStockThreshold } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [c] = await q<{ pending: number; low: number }>(
    `SELECT (SELECT COUNT(*) FROM orders WHERE status = 'pending')::int AS pending,
            (SELECT COUNT(*) FROM product_variants v JOIN products p ON p.id = v.product_id
              WHERE v.is_active AND p.is_active AND v.stock_qty <= $1)::int AS low`,
    [lowStockThreshold()],
  );
  return (
    <div className="shell">
      <Nav pending={c?.pending ?? 0} lowStock={c?.low ?? 0} />
      <main className="main">{children}</main>
    </div>
  );
}
