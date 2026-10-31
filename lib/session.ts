// Signed session cookie using Web Crypto, so it works in middleware (edge) and server code.
export const SESSION_COOKIE = 'shop_admin';
const SESSION_HOURS = 12;

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(payload: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error('SESSION_SECRET must be set (16+ chars)');
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
}

export async function createSessionToken(): Promise<{ token: string; maxAge: number }> {
  const maxAge = SESSION_HOURS * 3600;
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  const payload = `admin.${exp}`;
  return { token: `${payload}.${await sign(payload)}`, maxAge };
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [role, expStr, sig] = parts;
  const exp = Number(expStr);
  if (role !== 'admin' || !Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const expected = await sign(`${role}.${expStr}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i += 1) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
