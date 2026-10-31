import 'server-only';

// PinPicX image hosting API (https://pinpicx.app/api-docs)
//   POST   /v1/upload        multipart: image (file), name?, album?  -> data.url (direct link)
//   GET    /v1/images/{id}   poll while processing (202)
//   DELETE /v1/images/{id}
// The key is sent in the X-API-Key header (not the URL) so it never ends up in logs.

const API = (process.env.PINPICX_API_URL ?? 'https://pinpicx.app').replace(/\/+$/, '');

export function pinpicxEnabled(): boolean {
  return Boolean(process.env.PINPICX_API_KEY);
}

export class PinpicxError extends Error {
  constructor(public code: string, message: string, public status?: number) {
    super(message);
  }
}

const FRIENDLY: Record<string, string> = {
  invalid_key: 'PinPicX rejected the API key. Check PINPICX_API_KEY on Railway.',
  rate_limited: 'PinPicX upload limit reached for this hour. Try again later or upgrade the PinPicX plan.',
  storage_full: 'Your PinPicX storage is full. Free up space or upgrade the plan.',
  file_too_large: 'The photo is too large for PinPicX (max 32 MB).',
  unsupported_type: 'PinPicX does not accept this file type. Use JPG or PNG.',
  invalid_image: 'PinPicX could not read this photo. Try another JPG or PNG.',
  blocked_content: 'PinPicX blocked this image.',
};

type PinData = { id?: string; url?: string; display_url?: string };
type PinResponse = { success?: boolean; status?: number; data?: PinData; error?: { code?: string; message?: string } };

async function call(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<{ status: number; body: PinResponse; retryAfter?: string | null }> {
  const key = process.env.PINPICX_API_KEY;
  if (!key) throw new PinpicxError('no_key', 'PINPICX_API_KEY is not set.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 60_000);
  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { 'X-API-Key': key, Accept: 'application/json', ...(init.headers ?? {}) },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    const text = await res.text();
    let body: PinResponse = {};
    try { body = JSON.parse(text); } catch { body = { success: false, error: { code: 'bad_response', message: text.slice(0, 200) } }; }
    return { status: res.status, body, retryAfter: res.headers.get('retry-after') };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new PinpicxError('timeout', 'PinPicX did not respond in time. Please try again.');
    throw new PinpicxError('network', 'Could not reach PinPicX. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}

function fail(status: number, body: PinResponse): never {
  const code = body.error?.code ?? `http_${status}`;
  throw new PinpicxError(code, FRIENDLY[code] ?? body.error?.message ?? `PinPicX upload failed (${status}).`, status);
}

export async function uploadToPinpicx(buf: Buffer, contentType: string, name: string): Promise<{ id: string | null; url: string }> {
  const form = new FormData();
  form.set('image', new Blob([new Uint8Array(buf)], { type: contentType }), name);
  form.set('name', name);
  if (process.env.PINPICX_ALBUM_ID) form.set('album', process.env.PINPICX_ALBUM_ID);

  let { status, body } = await call('/v1/upload', { method: 'POST', body: form, timeoutMs: 90_000 });

  // 202 = still processing: poll GET /v1/images/{id} for up to ~60 s
  if (status === 202 && body.data?.id) {
    const id = body.data.id;
    for (let i = 0; i < 20 && status === 202; i += 1) {
      await new Promise((r) => setTimeout(r, 3000));
      ({ status, body } = await call(`/v1/images/${encodeURIComponent(id)}`, { method: 'GET' }));
    }
    if (status === 202) throw new PinpicxError('processing', 'PinPicX is still processing the photo. Try again in a minute.');
  }
  if (status !== 200 || !body.success || !body.data?.url) fail(status, body);
  return { id: body.data.id ?? null, url: body.data.url };
}

export async function deleteFromPinpicx(id: string): Promise<void> {
  const { status, body } = await call(`/v1/images/${encodeURIComponent(id)}`, { method: 'DELETE', timeoutMs: 20_000 });
  if (status >= 200 && status < 300) return;
  if (status === 404) return; // already gone
  fail(status, body);
}
