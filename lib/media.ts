import 'server-only';
import { headers } from 'next/headers';
import { q } from './db';
import { deleteFromPinpicx, pinpicxEnabled, uploadToPinpicx } from './pinpicx';

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MEDIA_RE = /\/media\/([0-9a-f-]{36})\.(?:jpg|png|webp)(?:\?.*)?$/i;

// Detect the real type from the file's first bytes (don't trust the browser's label).
export function sniffImage(buf: Buffer): { type: string; ext: string } | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: 'image/png', ext: 'png' };
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { type: 'image/webp', ext: 'webp' };
  return null;
}

// Public base URL for photos served by this app (fallback storage when PinPicX is not configured).
export async function publicBaseUrl(): Promise<string> {
  const env = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (env) return env;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function slug(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'photo';
}

/**
 * Store a photo and return the public URL to save on the product / variant.
 * With PINPICX_API_KEY set it is uploaded to PinPicX (the URL is the PinPicX direct link);
 * otherwise it is kept in Postgres and served from /media/<id>.<ext>.
 */
export async function saveImage(buf: Buffer, opts: { width?: number; height?: number; name?: string } = {}): Promise<string> {
  const kind = sniffImage(buf);
  if (!kind) throw new Error('UNSUPPORTED_IMAGE');

  if (pinpicxEnabled()) {
    const name = `${slug(opts.name ?? 'product')}.${kind.ext}`;
    const { id, url } = await uploadToPinpicx(buf, kind.type, name);
    await q(
      `INSERT INTO hosted_images (url, provider, remote_id) VALUES ($1, 'pinpicx', $2)
       ON CONFLICT (url) DO UPDATE SET remote_id = EXCLUDED.remote_id`,
      [url, id],
    );
    return url;
  }

  const [row] = await q<{ id: string }>(
    `INSERT INTO media (content_type, data, bytes, width, height) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [kind.type, buf, buf.length, opts.width ?? null, opts.height ?? null],
  );
  return `${await publicBaseUrl()}/media/${row.id}.${kind.ext}`;
}

export function mediaIdFromUrl(url: string | null | undefined): string | null {
  return url?.match(MEDIA_RE)?.[1] ?? null;
}

async function stillUsed(url: string): Promise<boolean> {
  const [r] = await q<{ used: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM products WHERE image_url = $1)
         OR EXISTS (SELECT 1 FROM product_variants WHERE image_url = $1)
         OR EXISTS (SELECT 1 FROM store_settings WHERE logo_url = $1) AS used`,
    [url],
  );
  return r.used;
}

// Delete an uploaded photo (from Postgres or PinPicX) once nothing points to it any more.
// Never throws: a failed clean-up must not block the admin's change.
export async function deleteImageIfUnused(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    if (await stillUsed(url)) return;

    const hosted = await q<{ remote_id: string | null }>(`SELECT remote_id FROM hosted_images WHERE url = $1`, [url]);
    if (hosted[0]) {
      if (hosted[0].remote_id && pinpicxEnabled()) await deleteFromPinpicx(hosted[0].remote_id);
      await q(`DELETE FROM hosted_images WHERE url = $1`, [url]);
      return;
    }

    const id = mediaIdFromUrl(url);
    if (id) await q(`DELETE FROM media WHERE id = $1`, [id]);
  } catch (e) {
    console.error('Image clean-up failed for', url, e);
  }
}
