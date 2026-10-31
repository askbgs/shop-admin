'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { pool, q } from '@/lib/db';
import { dbMessage, errUrl } from '@/lib/errors';
import { str } from '@/lib/lk';

const UUID = /^[0-9a-f-]{36}$/i;

export async function addCategory(fd: FormData) {
  const name = str(fd, 'name', 80);
  if (!name) redirect(errUrl('/categories', 'Enter a category name.'));
  let msg: string | null = null;
  try {
    await q(`INSERT INTO categories (name) VALUES ($1)`, [name]);
  } catch (e) {
    msg = dbMessage(e);
  }
  if (msg) redirect(errUrl('/categories', msg));
  revalidatePath('/categories');
  redirect('/categories?ok=added');
}

// Renames the category and every product that uses it, in one transaction.
export async function renameCategory(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const name = str(fd, 'name', 80);
  if (!UUID.test(id) || !name) redirect(errUrl('/categories', 'Enter a category name.'));
  const client = await pool().connect();
  let msg: string | null = null;
  try {
    await client.query('BEGIN');
    const old = await client.query<{ name: string }>(`SELECT name FROM categories WHERE id = $1 FOR UPDATE`, [id]);
    if (!old.rows[0]) throw new Error('missing');
    await client.query(`UPDATE categories SET name = $2 WHERE id = $1`, [id, name]);
    await client.query(`UPDATE products SET category = $2 WHERE category = $1`, [old.rows[0].name, name]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    msg = dbMessage(e);
  } finally {
    client.release();
  }
  if (msg) redirect(errUrl('/categories', msg));
  revalidatePath('/', 'layout');
  redirect('/categories?ok=renamed');
}

export async function deleteCategory(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(id)) redirect('/categories');
  const rows = await q<{ id: string }>(
    `DELETE FROM categories c WHERE c.id = $1 AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category = c.name) RETURNING c.id`,
    [id],
  );
  if (!rows[0]) redirect(errUrl('/categories', 'Move or delete the products in this category first.'));
  revalidatePath('/categories');
  redirect('/categories?ok=deleted');
}
