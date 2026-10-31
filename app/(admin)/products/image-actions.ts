'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { q } from '@/lib/db';
import { errUrl } from '@/lib/errors';
import { deleteImageIfUnused, MAX_IMAGE_BYTES, saveImage, sniffImage } from '@/lib/media';

const UUID = /^[0-9a-f-]{36}$/i;

type Target = { kind: 'product' | 'variant'; productId: string; variantId?: string };

function readTarget(fd: FormData): Target | null {
  const kind = fd.get('kind') === 'variant' ? 'variant' : 'product';
  const productId = String(fd.get('product_id') ?? '');
  const variantId = String(fd.get('variant_id') ?? '');
  if (!UUID.test(productId)) return null;
  if (kind === 'variant' && !UUID.test(variantId)) return null;
  return { kind, productId, variantId: kind === 'variant' ? variantId : undefined };
}

async function currentUrl(t: Target): Promise<string | null | undefined> {
  const rows = t.kind === 'variant'
    ? await q<{ image_url: string | null }>(`SELECT image_url FROM product_variants WHERE id = $1 AND product_id = $2`, [t.variantId, t.productId])
    : await q<{ image_url: string | null }>(`SELECT image_url FROM products WHERE id = $1`, [t.productId]);
  return rows[0] ? rows[0].image_url : undefined;
}

async function setUrl(t: Target, url: string | null) {
  if (t.kind === 'variant') {
    await q(`UPDATE product_variants SET image_url = $3 WHERE id = $1 AND product_id = $2`, [t.variantId, t.productId, url]);
  } else {
    await q(`UPDATE products SET image_url = $2 WHERE id = $1`, [t.productId, url]);
  }
}

export async function uploadImage(fd: FormData) {
  const t = readTarget(fd);
  if (!t) redirect('/products');
  const base = `/products/${t.productId}`;
  const back = t.kind === 'variant' ? '#variants' : '';
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) redirect(errUrl(base, 'Choose a photo to upload.'));
  if (file.size > MAX_IMAGE_BYTES) redirect(errUrl(base, 'Photo is too large (max 6 MB).'));

  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffImage(buf)) redirect(errUrl(base, 'Only JPG, PNG or WebP photos can be uploaded.'));

  const old = await currentUrl(t);
  if (old === undefined) redirect(errUrl(base, 'Product or variant not found.'));

  const width = Number(fd.get('width')) || undefined;
  const height = Number(fd.get('height')) || undefined;
  const url = await saveImage(buf, width, height);
  await setUrl(t, url);
  await deleteImageIfUnused(old);
  revalidatePath('/', 'layout');
  redirect(`${base}?ok=${t.kind === 'variant' ? 'variant_image' : 'product_image'}${back}`);
}

export async function removeImage(fd: FormData) {
  const t = readTarget(fd);
  if (!t) redirect('/products');
  const base = `/products/${t.productId}`;
  const old = await currentUrl(t);
  await setUrl(t, null);
  await deleteImageIfUnused(old);
  revalidatePath('/', 'layout');
  redirect(`${base}?ok=${t.kind === 'variant' ? 'variant_image_removed' : 'product_image_removed'}${t.kind === 'variant' ? '#variants' : ''}`);
}
