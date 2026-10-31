import { q } from '@/lib/db';
import { ensureSchema } from '@/lib/migrate';

export const dynamic = 'force-dynamic';

// Public (no login) so WhatsApp / the n8n agent can fetch product photos.
// URLs are unguessable UUIDs and the content never changes, so it is cached for a year.
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = file.match(/^([0-9a-f-]{36})\.(jpg|png|webp)$/i);
  if (!m) return new Response('Not found', { status: 404 });
  await ensureSchema();
  const rows = await q<{ content_type: string; data: Buffer }>(`SELECT content_type, data FROM media WHERE id = $1`, [m[1]]);
  const img = rows[0];
  if (!img) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      'Content-Type': img.content_type,
      'Content-Length': String(img.data.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
