'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { q } from '@/lib/db';
import { dbMessage, errUrl } from '@/lib/errors';
import { DISTRICTS, normalizePhone, str } from '@/lib/lk';

const UUID = /^[0-9a-f-]{36}$/i;

function readCustomer(fd: FormData) {
  const phone = normalizePhone(String(fd.get('phone') ?? ''));
  const district = str(fd, 'district', 40);
  if (!/^\d{9,15}$/.test(phone)) return { error: 'Enter a valid phone number, e.g. 0771234567 or 94771234567.' };
  if (district && !(DISTRICTS as readonly string[]).includes(district)) return { error: 'Choose a district from the list.' };
  return {
    data: {
      phone,
      full_name: str(fd, 'full_name', 120),
      address: str(fd, 'address', 500),
      city: str(fd, 'city', 80),
      district,
      notes: str(fd, 'notes', 2000),
    },
  };
}

export async function createCustomer(fd: FormData) {
  const { data, error } = readCustomer(fd);
  if (!data) redirect(errUrl('/customers/new', error!));
  let id: string | null = null;
  let msg: string | null = null;
  try {
    const [row] = await q<{ id: string }>(
      `INSERT INTO customers (phone, full_name, address, city, district, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [data.phone, data.full_name, data.address, data.city, data.district, data.notes],
    );
    id = row.id;
  } catch (e) {
    msg = dbMessage(e);
  }
  if (msg) redirect(errUrl('/customers/new', msg));
  revalidatePath('/customers');
  redirect(`/customers/${id}?ok=created`);
}

// Changing the phone also moves the customer's existing orders to the new number,
// so the WhatsApp agent still finds their order history.
export async function updateCustomer(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(id)) redirect('/customers');
  const base = `/customers/${id}`;
  const { data, error } = readCustomer(fd);
  if (!data) redirect(errUrl(base, error!));
  let msg: string | null = null;
  try {
    await q(
      `WITH old AS (SELECT phone FROM customers WHERE id = $1),
            upd AS (
              UPDATE customers SET phone=$2, full_name=$3, address=$4, city=$5, district=$6, notes=$7
               WHERE id = $1 RETURNING id
            )
       UPDATE orders SET customer_phone = $2, customer_id = $1
        WHERE customer_phone = (SELECT phone FROM old) AND (SELECT phone FROM old) <> $2 AND EXISTS (SELECT 1 FROM upd)`,
      [id, data.phone, data.full_name, data.address, data.city, data.district, data.notes],
    );
  } catch (e) {
    msg = dbMessage(e);
  }
  if (msg) redirect(errUrl(base, msg));
  revalidatePath('/', 'layout');
  redirect(`${base}?ok=saved`);
}

export async function deleteCustomer(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(id)) redirect('/customers');
  const rows = await q<{ id: string }>(
    `DELETE FROM customers c WHERE c.id = $1
        AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id OR o.customer_phone = c.phone)
     RETURNING c.id`,
    [id],
  );
  if (!rows[0]) redirect(errUrl(`/customers/${id}`, 'This customer has orders, so they cannot be deleted.'));
  revalidatePath('/customers');
  redirect('/customers?ok=deleted');
}
