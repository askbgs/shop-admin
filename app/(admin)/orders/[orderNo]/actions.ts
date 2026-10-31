'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { NEXT_STATUS, STATUSES, isStatus, type OrderStatus } from '@/lib/format';
import { updateOrderStatus } from '@/lib/queries';

export async function changeStatus(formData: FormData) {
  const orderNo = String(formData.get('orderNo') ?? '');
  const to = formData.get('to');
  const base = `/orders/${encodeURIComponent(orderNo)}`;

  if (!/^ORD-[\w-]+$/.test(orderNo) || !isStatus(to)) redirect(`${base}?err=invalid`);

  // Statuses from which `to` is a legal next step
  const allowedFrom = STATUSES.filter((s) => NEXT_STATUS[s].includes(to as OrderStatus));
  let result: string | null = null;
  try {
    result = await updateOrderStatus(orderNo, to as OrderStatus, allowedFrom);
  } catch (e) {
    console.error('Status update failed', e);
    redirect(`${base}?err=db`);
  }
  revalidatePath('/', 'layout');
  redirect(result ? `${base}?ok=${to}` : `${base}?err=stale`);
}
