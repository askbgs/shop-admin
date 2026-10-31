import 'server-only';
import { q } from './db';
import type { OrderStatus } from './format';

export type CustomerRow = {
  id: string;
  phone: string;
  full_name: string | null;
  city: string | null;
  district: string | null;
  created_at: Date;
  order_count: number;
  total_spent: number;
  last_order_at: Date | null;
  total_rows: number;
};

export async function listCustomers(f: { search?: string; district?: string; sort?: string; page?: number; pageSize?: number }) {
  const pageSize = f.pageSize ?? 30;
  const page = Math.max(1, f.page ?? 1);
  const order =
    f.sort === 'spent' ? 'total_spent DESC, c.created_at DESC'
    : f.sort === 'orders' ? 'order_count DESC, c.created_at DESC'
    : f.sort === 'name' ? 'c.full_name NULLS LAST, c.phone'
    : 'COALESCE(MAX(o.created_at), c.created_at) DESC';
  const rows = await q<CustomerRow>(
    `SELECT c.id, c.phone, c.full_name, c.city, c.district, c.created_at,
            COUNT(o.id)::int AS order_count,
            COALESCE(SUM(o.total_cents) FILTER (WHERE o.status <> 'cancelled'), 0)::float8 AS total_spent,
            MAX(o.created_at) AS last_order_at,
            COUNT(*) OVER ()::int AS total_rows
       FROM customers c
       LEFT JOIN orders o ON o.customer_phone = c.phone
      WHERE ($1::text IS NULL OR c.full_name ILIKE '%' || $1 || '%' OR c.phone ILIKE '%' || $1 || '%' OR c.city ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR c.district = $2)
      GROUP BY c.id
      ORDER BY ${order}
      LIMIT $3 OFFSET $4`,
    [f.search || null, f.district || null, pageSize, (page - 1) * pageSize],
  );
  return { rows, total: rows[0]?.total_rows ?? 0 };
}

export type Customer = {
  id: string;
  phone: string;
  full_name: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

export type CustomerOrder = { order_no: string; status: OrderStatus; total_cents: number; created_at: Date; item_count: number };

export async function getCustomer(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [customer] = await q<Customer>(
    `SELECT id, phone, full_name, address, city, district, notes, created_at, updated_at FROM customers WHERE id = $1`,
    [id],
  );
  if (!customer) return null;
  const orders = await q<CustomerOrder>(
    `SELECT o.order_no, o.status, o.total_cents, o.created_at,
            (SELECT COALESCE(SUM(qty), 0) FROM order_items WHERE order_id = o.id)::int AS item_count
       FROM orders o
      WHERE o.customer_phone = $1 OR o.customer_id = $2
      ORDER BY o.created_at DESC
      LIMIT 100`,
    [customer.phone, customer.id],
  );
  const spent = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total_cents, 0);
  return { customer, orders, spent };
}
