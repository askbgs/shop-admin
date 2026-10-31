'use server';

import { timingSafeEqual, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, createSessionToken } from '@/lib/session';

function same(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function login(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const nextRaw = String(formData.get('next') ?? '/');
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/';
  const expected = process.env.ADMIN_PASSWORD ?? '';

  if (!expected || !same(password, expected)) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const { token, maxAge } = await createSessionToken();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
  redirect(next);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
