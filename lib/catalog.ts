import 'server-only';
import { q } from './db';

export type ProductRow = {
  id: string;
  sku: string | null;
  name: string;
  category: string;
  gender: string;
  price_cents: number;
  image_url: string | null;
  is_active: boolean;
  variant_count: number;
  total_stock: number;
  total_rows: number;
};

export async function listProducts(f: { search?: string; category?: string; status?: string; page?: number; pageSize?: number }) {
  const pageSize = f.pageSize ?? 30;
  const page = Math.max(1, f.page ?? 1);
  const active = f.status === 'active' ? true : f.status === 'inactive' ? false : null;
  const rows = await q<ProductRow>(
    `SELECT p.id, p.sku, p.name, p.category, p.gender, p.price_cents, p.image_url, p.is_active,
            COUNT(v.id)::int AS variant_count,
            COALESCE(SUM(v.stock_qty) FILTER (WHERE v.is_active), 0)::int AS total_stock,
            COUNT(*) OVER ()::int AS total_rows
       FROM products p
       LEFT JOIN product_variants v ON v.product_id = p.id
      WHERE ($1::text IS NULL OR p.name ILIKE '%' || $1 || '%' OR p.sku ILIKE '%' || $1 || '%' OR p.brand ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR p.category = $2)
        AND ($3::boolean IS NULL OR p.is_active = $3)
      GROUP BY p.id
      ORDER BY p.is_active DESC, p.name
      LIMIT $4 OFFSET $5`,
    [f.search || null, f.category || null, active, pageSize, (page - 1) * pageSize],
  );
  return { rows, total: rows[0]?.total_rows ?? 0 };
}

export type Product = {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  category: string;
  gender: string;
  brand: string | null;
  material: string | null;
  price_cents: number;
  image_url: string | null;
  tags: string[] | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type Variant = {
  id: string;
  sku: string | null;
  size: string;
  color: string;
  extra_price_cents: number;
  stock_qty: number;
  image_url: string | null;
  is_active: boolean;
  sold: number;
};

export async function getProduct(id: string): Promise<{ product: Product; variants: Variant[]; orderLines: number } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [product] = await q<Product>(
    `SELECT id, sku, name, description, category, gender, brand, material, price_cents, image_url, tags, is_active, created_at, updated_at
       FROM products WHERE id = $1`,
    [id],
  );
  if (!product) return null;
  const variants = await q<Variant>(
    `SELECT v.id, v.sku, v.size, v.color, v.extra_price_cents, v.stock_qty, v.image_url, v.is_active,
            COALESCE((SELECT SUM(oi.qty) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                       WHERE oi.variant_id = v.id AND o.status <> 'cancelled'), 0)::int AS sold
       FROM product_variants v
      WHERE v.product_id = $1
      ORDER BY v.is_active DESC, v.color, v.size`,
    [id],
  );
  const [{ n }] = await q<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM order_items oi JOIN product_variants v ON v.id = oi.variant_id WHERE v.product_id = $1`,
    [id],
  );
  return { product, variants, orderLines: n };
}

export type Category = { id: string; name: string; product_count: number; active_count: number };

export async function listCategories(): Promise<Category[]> {
  return q<Category>(
    `SELECT c.id, c.name,
            COUNT(p.id)::int AS product_count,
            COUNT(p.id) FILTER (WHERE p.is_active)::int AS active_count
       FROM categories c
       LEFT JOIN products p ON p.category = c.name
      GROUP BY c.id, c.name
      ORDER BY c.name`,
  );
}

export async function categoryNames(): Promise<string[]> {
  const rows = await q<{ name: string }>(
    `SELECT name FROM categories UNION SELECT DISTINCT category FROM products ORDER BY 1`,
  );
  return rows.map((r) => r.name);
}
