'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { pool, q } from '@/lib/db';
import { dbMessage, errUrl } from '@/lib/errors';
import { GENDERS, str, toCents } from '@/lib/lk';
import { deleteImageIfUnused } from '@/lib/media';

const UUID = /^[0-9a-f-]{36}$/i;

type ProductInput = {
  sku: string | null; name: string; description: string | null; category: string; gender: string;
  brand: string | null; material: string | null; price_cents: number; image_url: string | null;
  tags: string[]; is_active: boolean;
};

function readProduct(fd: FormData): { data?: ProductInput; error?: string } {
  const name = str(fd, 'name', 200);
  const category = str(fd, 'category', 80);
  const gender = String(fd.get('gender') ?? 'unisex');
  const price = toCents(fd.get('price'));
  const image = str(fd, 'image_url', 1000);
  if (!name) return { error: 'Product name is required.' };
  if (!category) return { error: 'Choose a category.' };
  if (!(GENDERS as readonly string[]).includes(gender)) return { error: 'Choose a valid gender.' };
  if (price === null) return { error: 'Enter a valid price in LKR.' };
  if (image && !/^https?:\/\//i.test(image)) return { error: 'Image URL must start with http:// or https://' };
  const tags = String(fd.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
  return {
    data: {
      sku: str(fd, 'sku', 60),
      name,
      description: str(fd, 'description', 2000),
      category,
      gender,
      brand: str(fd, 'brand', 100),
      material: str(fd, 'material', 100),
      price_cents: price,
      image_url: image,
      tags,
      is_active: fd.get('is_active') === 'on',
    },
  };
}

async function ensureCategory(name: string) {
  await q(`INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [name]);
}

export async function createProduct(fd: FormData) {
  const { data, error } = readProduct(fd);
  if (!data) redirect(errUrl('/products/new', error!));
  let id: string | null = null;
  let msg: string | null = null;
  try {
    await ensureCategory(data.category);
    const [row] = await q<{ id: string }>(
      `INSERT INTO products (sku, name, description, category, gender, brand, material, price_cents, image_url, tags, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [data.sku, data.name, data.description, data.category, data.gender, data.brand, data.material, data.price_cents, data.image_url, data.tags, data.is_active],
    );
    id = row.id;
  } catch (e) {
    msg = dbMessage(e);
  }
  if (msg) redirect(errUrl('/products/new', msg));
  revalidatePath('/products');
  redirect(`/products/${id}?ok=created`);
}

export async function updateProduct(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(id)) redirect('/products');
  const base = `/products/${id}`;
  const { data, error } = readProduct(fd);
  if (!data) redirect(errUrl(base, error!));
  let msg: string | null = null;
  let oldImage: string | null = null;
  try {
    await ensureCategory(data.category);
    oldImage = (await q<{ image_url: string | null }>(`SELECT image_url FROM products WHERE id = $1`, [id]))[0]?.image_url ?? null;
    await q(
      `UPDATE products SET sku=$2, name=$3, description=$4, category=$5, gender=$6, brand=$7, material=$8,
              price_cents=$9, image_url=$10, tags=$11, is_active=$12
        WHERE id=$1`,
      [id, data.sku, data.name, data.description, data.category, data.gender, data.brand, data.material, data.price_cents, data.image_url, data.tags, data.is_active],
    );
  } catch (e) {
    msg = dbMessage(e);
  }
  if (msg) redirect(errUrl(base, msg));
  if (oldImage !== data.image_url) await deleteImageIfUnused(oldImage);
  revalidatePath('/', 'layout');
  redirect(`${base}?ok=saved`);
}

export async function deleteProduct(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(id)) redirect('/products');
  const images = await q<{ image_url: string }>(
    `SELECT image_url FROM products WHERE id = $1 AND image_url IS NOT NULL
     UNION SELECT image_url FROM product_variants WHERE product_id = $1 AND image_url IS NOT NULL`,
    [id],
  );
  const rows = await q<{ id: string }>(
    `DELETE FROM products p WHERE p.id = $1
        AND NOT EXISTS (SELECT 1 FROM order_items oi JOIN product_variants v ON v.id = oi.variant_id WHERE v.product_id = p.id)
     RETURNING p.id`,
    [id],
  );
  if (!rows[0]) redirect(errUrl(`/products/${id}`, 'This product has orders, so it can only be deactivated, not deleted.'));
  for (const img of images) await deleteImageIfUnused(img.image_url);
  revalidatePath('/', 'layout');
  redirect('/products?ok=deleted');
}

function readVariant(fd: FormData) {
  const size = str(fd, 'size', 40);
  const color = str(fd, 'color', 60);
  const extra = toCents(fd.get('extra_price') || '0');
  const stockRaw = String(fd.get('stock_qty') ?? '').trim();
  const stock = /^\d+$/.test(stockRaw) ? Number(stockRaw) : NaN;
  const image = str(fd, 'v_image_url', 1000);
  if (!size || !color) return { error: 'Size and colour are required.' };
  if (extra === null) return { error: 'Extra price must be a number (0 or more).' };
  if (!Number.isInteger(stock) || stock < 0 || stock > 100000) return { error: 'Stock must be a whole number (0 or more).' };
  if (image && !/^https?:\/\//i.test(image)) return { error: 'Variant image URL must start with http(s)://' };
  return { data: { size, color, extra, stock, sku: str(fd, 'v_sku', 60), image, is_active: fd.get('v_active') !== 'off' } };
}

export async function addVariant(fd: FormData) {
  const productId = String(fd.get('product_id') ?? '');
  if (!UUID.test(productId)) redirect('/products');
  const base = `/products/${productId}`;
  const { data, error } = readVariant(fd);
  if (!data) redirect(errUrl(base, error!));
  let msg: string | null = null;
  try {
    await q(
      `INSERT INTO product_variants (product_id, sku, size, color, extra_price_cents, stock_qty, image_url, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
      [productId, data.sku, data.size, data.color, data.extra, data.stock, data.image],
    );
  } catch (e) {
    msg = dbMessage(e);
  }
  if (msg) redirect(errUrl(base, msg));
  revalidatePath('/', 'layout');
  redirect(`${base}?ok=variant_added#variants`);
}

export async function updateVariant(fd: FormData) {
  const productId = String(fd.get('product_id') ?? '');
  const variantId = String(fd.get('variant_id') ?? '');
  if (!UUID.test(productId) || !UUID.test(variantId)) redirect('/products');
  const base = `/products/${productId}`;
  const { data, error } = readVariant(fd);
  if (!data) redirect(errUrl(base, error!));
  let msg: string | null = null;
  try {
    await q(
      `UPDATE product_variants SET size=$3, color=$4, extra_price_cents=$5, stock_qty=$6, is_active=$7
        WHERE id=$2 AND product_id=$1`,
      [productId, variantId, data.size, data.color, data.extra, data.stock, fd.get('v_active') === 'on'],
    );
  } catch (e) {
    msg = dbMessage(e);
  }
  if (msg) redirect(errUrl(base, msg));
  revalidatePath('/', 'layout');
  redirect(`${base}?ok=variant_saved#variants`);
}

export async function deleteVariant(fd: FormData) {
  const productId = String(fd.get('product_id') ?? '');
  const variantId = String(fd.get('variant_id') ?? '');
  if (!UUID.test(productId) || !UUID.test(variantId)) redirect('/products');
  const base = `/products/${productId}`;
  const client = await pool().connect();
  let deletedImage: string | null | undefined;
  try {
    const r = await client.query<{ image_url: string | null }>(
      `DELETE FROM product_variants v WHERE v.id = $1 AND v.product_id = $2
          AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.variant_id = v.id)
       RETURNING v.image_url`,
      [variantId, productId],
    );
    deletedImage = r.rows[0] ? r.rows[0].image_url : undefined;
  } finally {
    client.release();
  }
  if (deletedImage === undefined) redirect(errUrl(base, 'This variant appears in orders, so untick "Active" instead of deleting it.'));
  await deleteImageIfUnused(deletedImage);
  revalidatePath('/', 'layout');
  redirect(`${base}?ok=variant_deleted#variants`);
}
