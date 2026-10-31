import 'server-only';
import { q } from './db';
import type { OrderStatus } from './format';

const TZ = `'Asia/Colombo'`;

export function lowStockThreshold(): number {
  const n = Number(process.env.LOW_STOCK_THRESHOLD ?? 5);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

export type Kpis = {
  today_revenue: number;
  today_orders: number;
  month_revenue: number;
  month_orders: number;
  pending: number;
  avg_order: number;
};

export async function getKpis(): Promise<Kpis> {
  const rows = await q<Kpis>(`
    WITH t AS (SELECT (now() AT TIME ZONE ${TZ})::date AS d)
    SELECT
      COALESCE(SUM(total_cents) FILTER (WHERE (created_at AT TIME ZONE ${TZ})::date = (SELECT d FROM t) AND status <> 'cancelled'), 0)::float8 AS today_revenue,
      COUNT(*) FILTER (WHERE (created_at AT TIME ZONE ${TZ})::date = (SELECT d FROM t) AND status <> 'cancelled')::int AS today_orders,
      COALESCE(SUM(total_cents) FILTER (WHERE date_trunc('month', created_at AT TIME ZONE ${TZ}) = date_trunc('month', (SELECT d FROM t)::timestamp) AND status <> 'cancelled'), 0)::float8 AS month_revenue,
      COUNT(*) FILTER (WHERE date_trunc('month', created_at AT TIME ZONE ${TZ}) = date_trunc('month', (SELECT d FROM t)::timestamp) AND status <> 'cancelled')::int AS month_orders,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COALESCE(AVG(total_cents) FILTER (WHERE status <> 'cancelled' AND created_at >= now() - interval '30 days'), 0)::float8 AS avg_order
    FROM orders`);
  return rows[0];
}

export async function getStatusCounts(): Promise<Record<string, number>> {
  const rows = await q<{ status: string; n: number }>(`SELECT status, COUNT(*)::int AS n FROM orders GROUP BY status`);
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

export type DayPoint = { day: string; revenue: number; orders: number };

export async function getDailyRevenue(days = 30): Promise<DayPoint[]> {
  return q<DayPoint>(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day,
            COALESCE(SUM(o.total_cents), 0)::float8 AS revenue,
            COUNT(o.id)::int AS orders
       FROM generate_series((now() AT TIME ZONE ${TZ})::date - ($1::int - 1), (now() AT TIME ZONE ${TZ})::date, interval '1 day') AS d
       LEFT JOIN orders o
              ON (o.created_at AT TIME ZONE ${TZ})::date = d::date AND o.status <> 'cancelled'
      GROUP BY d
      ORDER BY d`,
    [days],
  );
}

export type TopProduct = { product_name: string; qty: number; revenue: number };

export async function getTopProducts(limit = 5): Promise<TopProduct[]> {
  return q<TopProduct>(
    `SELECT oi.product_name, SUM(oi.qty)::int AS qty, SUM(oi.line_total_cents)::float8 AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE o.status <> 'cancelled' AND o.created_at >= now() - interval '30 days'
      GROUP BY oi.product_name
      ORDER BY revenue DESC
      LIMIT $1`,
    [limit],
  );
}

export type LowStock = { product_name: string; sku: string | null; size: string; color: string; stock_qty: number };

export async function getLowStock(limit = 100): Promise<LowStock[]> {
  return q<LowStock>(
    `SELECT p.name AS product_name, v.sku, v.size, v.color, v.stock_qty
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
      WHERE v.is_active AND p.is_active AND v.stock_qty <= $1
      ORDER BY v.stock_qty, p.name, v.color, v.size
      LIMIT $2`,
    [lowStockThreshold(), limit],
  );
}

export type OrderRow = {
  order_no: string;
  status: OrderStatus;
  total_cents: number;
  payment_method: string;
  created_at: Date;
  customer_phone: string;
  full_name: string | null;
  item_count: number;
  total_rows: number;
};

export type OrderFilters = {
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export async function listOrders(f: OrderFilters): Promise<{ rows: OrderRow[]; total: number }> {
  const pageSize = f.pageSize ?? 25;
  const page = Math.max(1, f.page ?? 1);
  const rows = await q<OrderRow>(
    `SELECT o.order_no, o.status, o.total_cents, o.payment_method, o.created_at, o.customer_phone,
            c.full_name,
            (SELECT COALESCE(SUM(qty), 0) FROM order_items WHERE order_id = o.id)::int AS item_count,
            COUNT(*) OVER ()::int AS total_rows
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
      WHERE ($1::text IS NULL OR o.status = $1)
        AND ($2::text IS NULL OR o.order_no ILIKE '%' || $2 || '%' OR o.customer_phone ILIKE '%' || $2 || '%' OR c.full_name ILIKE '%' || $2 || '%')
        AND ($3::date IS NULL OR o.created_at >= ($3::date)::timestamp AT TIME ZONE ${TZ})
        AND ($4::date IS NULL OR o.created_at <  (($4::date) + 1)::timestamp AT TIME ZONE ${TZ})
      ORDER BY o.created_at DESC
      LIMIT $5 OFFSET $6`,
    [f.status || null, f.search || null, f.from || null, f.to || null, pageSize, (page - 1) * pageSize],
  );
  return { rows, total: rows[0]?.total_rows ?? 0 };
}

export type OrderDetail = {
  id: string;
  order_no: string;
  status: OrderStatus;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  payment_method: string;
  delivery_address: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  customer_phone: string;
  full_name: string | null;
  city: string | null;
  district: string | null;
};

export type OrderItem = {
  product_name: string;
  size: string;
  color: string;
  qty: number;
  unit_price_cents: number;
  line_total_cents: number;
  stock_qty: number | null;
};

export async function getOrder(orderNo: string): Promise<{ order: OrderDetail; items: OrderItem[] } | null> {
  const orders = await q<OrderDetail>(
    `SELECT o.id, o.order_no, o.status, o.subtotal_cents, o.delivery_fee_cents, o.total_cents, o.payment_method,
            o.delivery_address, o.notes, o.created_at, o.updated_at, o.customer_phone,
            c.full_name, c.city, c.district
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.order_no = $1`,
    [orderNo],
  );
  if (!orders[0]) return null;
  const items = await q<OrderItem>(
    `SELECT oi.product_name, oi.size, oi.color, oi.qty, oi.unit_price_cents, oi.line_total_cents, v.stock_qty
       FROM order_items oi
       LEFT JOIN product_variants v ON v.id = oi.variant_id
      WHERE oi.order_id = $1
      ORDER BY oi.product_name, oi.color, oi.size`,
    [orders[0].id],
  );
  return { order: orders[0], items };
}

export async function getCustomerOrderCount(phone: string): Promise<number> {
  const rows = await q<{ n: number }>(`SELECT COUNT(*)::int AS n FROM orders WHERE customer_phone = $1`, [phone]);
  return rows[0]?.n ?? 0;
}

// Only moves forward from an allowed current status; returns the new status or null if the order changed meanwhile.
export async function updateOrderStatus(orderNo: string, to: OrderStatus, allowedFrom: OrderStatus[]): Promise<string | null> {
  const rows = await q<{ status: string }>(
    `UPDATE orders SET status = $2 WHERE order_no = $1 AND status = ANY($3::text[]) RETURNING status`,
    [orderNo, to, allowedFrom],
  );
  return rows[0]?.status ?? null;
}
