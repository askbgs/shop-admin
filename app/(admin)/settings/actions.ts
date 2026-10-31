'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { q } from '@/lib/db';
import { dbMessage, errUrl } from '@/lib/errors';
import { DISTRICTS, normalizePhone, str, toCents } from '@/lib/lk';

const URL_FIELDS = ['logo_url', 'website', 'facebook_url', 'instagram_url', 'tiktok_url'] as const;

export async function saveSettings(fd: FormData) {
  const storeName = str(fd, 'store_name', 120);
  if (!storeName) redirect(errUrl('/settings', 'Store name is required.'));

  const fee = toCents(fd.get('delivery_fee'));
  const freeFrom = toCents(fd.get('free_delivery_threshold') || '0');
  if (fee === null) redirect(errUrl('/settings', 'Enter a valid delivery fee in LKR (0 for free delivery).'));
  if (freeFrom === null) redirect(errUrl('/settings', 'Enter a valid free-delivery amount in LKR (0 to switch it off).'));

  const district = str(fd, 'district', 40);
  if (district && !(DISTRICTS as readonly string[]).includes(district)) redirect(errUrl('/settings', 'Choose a district from the list.'));

  const urls: Record<string, string | null> = {};
  for (const f of URL_FIELDS) {
    const v = str(fd, f, 500);
    if (v && !/^https?:\/\//i.test(v)) redirect(errUrl('/settings', `${f.replace('_url', '').replace('_', ' ')} must start with http:// or https://`));
    urls[f] = v;
  }
  const phone = str(fd, 'phone', 30);
  const wa = str(fd, 'whatsapp', 30);
  const email = str(fd, 'email', 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect(errUrl('/settings', 'Enter a valid email address.'));

  let msg: string | null = null;
  try {
    await q(
      `UPDATE store_settings SET
         store_name=$1, tagline=$2, description=$3, logo_url=$4, phone=$5, whatsapp=$6, email=$7, website=$8,
         address=$9, city=$10, district=$11, opening_hours=$12, facebook_url=$13, instagram_url=$14, tiktok_url=$15,
         delivery_fee_cents=$16, free_delivery_threshold_cents=$17, delivery_info=$18, return_policy=$19,
         bank_name=$20, bank_branch=$21, bank_account_name=$22, bank_account_number=$23, payment_instructions=$24
       WHERE id = 1`,
      [
        storeName, str(fd, 'tagline', 160), str(fd, 'description', 2000), urls.logo_url,
        phone, wa ? normalizePhone(wa) : null, email, urls.website,
        str(fd, 'address', 500), str(fd, 'city', 80), district, str(fd, 'opening_hours', 500),
        urls.facebook_url, urls.instagram_url, urls.tiktok_url,
        fee, freeFrom, str(fd, 'delivery_info', 1000), str(fd, 'return_policy', 2000),
        str(fd, 'bank_name', 120), str(fd, 'bank_branch', 120), str(fd, 'bank_account_name', 120),
        str(fd, 'bank_account_number', 40), str(fd, 'payment_instructions', 1000),
      ],
    );
  } catch (e) {
    msg = dbMessage(e);
  }
  if (msg) redirect(errUrl('/settings', msg));
  revalidatePath('/', 'layout');
  redirect('/settings?ok=saved');
}
