import 'server-only';
import { headers } from 'next/headers';
import { q } from './db';

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MEDIA_RE = /\/media\/([0-9a-f-]{36})\.(?:jpg|png|webp)(?:\?.*)?$/i;

// Detect the real type from the file's first bytes (don't trust the browser's label).
export function sniffImage(buf: Buffer): { type: string; ext: string } | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: 'image/png', ext: 'png' };
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { type: 'image/webp', ext: 'webp' };
  return null;
}

// Public base URL used in image links the WhatsApp agent sends (must be reachable from the internet).
export async function publicBaseUrl(): Promise<string> {
  const env = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (env) return env;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function saveImage(buf: Buffer, width?: number, height?: number): Promise<string> {
  const kind = sniffImage(buf);
  if (!kind) throw new Error('UNSUPPORTED_IMAGE');
  const [row] = await q<{ id: string }>(
    `INSERT INTO media (content_type, data, bytes, width, height) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [kind.type, buf, buf.length, width ?? null, height ?? null],
  );
  return `${await publicBaseUrl()}/media/${row.id}.${kind.ext}`;
}

export function mediaIdFromUrl(url: string | null | undefined): string | null {
  return url?.match(MEDIA_RE)?.[1] ?? null;
}

// Delete an uploaded image once nothing points to it any more.
export async function deleteImageIfUnused(url: string | null | undefined) {
  const id = mediaIdFromUrl(url);
  if (!id) return;
  const like = `%/media/${id}.%`;
  await q(
    `DELETE FROM media m WHERE m.id = $1
        AND NOT EXISTS (SELECT 1 FROM products WHERE image_url LIKE $2)
        AND NOT EXISTS (SELECT 1 FROM product_variants WHERE image_url LIKE $2)
        AND NOT EXISTS (SELECT 1 FROM store_settings WHERE logo_url LIKE $2)`,
    [id, like],
  );
}
