import { q } from '@/lib/db';

export const dynamic = 'force-dynamic';

type NewOrder = {
  order_no: string;
  total_cents: number;
  created_at: string;
  customer_phone: string;
  full_name: string | null;
  item_count: number;
};

// Polled by the dashboard every few seconds (login required - see middleware).
// GET /api/orders/new?since=<created_at of the newest order the page has seen>
// The cursor is Postgres' own text form of created_at so no microseconds are lost.
export async function GET(req: Request) {
  const since = new URL(req.url).searchParams.get('since') ?? '';
  const valid = since !== '' && !Number.isNaN(Date.parse(since.replace(' ', 'T')));

  const [{ latest }] = await q<{ latest: string | null }>(`SELECT MAX(created_at)::text AS latest FROM orders`);
  if (!valid) {
    return Response.json({ latest, orders: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const orders = await q<NewOrder>(
    `SELECT o.order_no, o.total_cents, o.created_at::text AS created_at, o.customer_phone, c.full_name,
            (SELECT COALESCE(SUM(qty), 0) FROM order_items WHERE order_id = o.id)::int AS item_count
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.created_at > $1::timestamptz
      ORDER BY o.created_at ASC
      LIMIT 20`,
    [since],
  );
  return Response.json({ latest: latest ?? since, orders }, { headers: { 'Cache-Control': 'no-store' } });
}
