// Turn a Postgres error into a short message an admin can act on.
export function dbMessage(e: unknown): string {
  const err = e as { code?: string; constraint?: string; message?: string };
  if (err?.code === '23505') {
    if (err.constraint?.includes('phone')) return 'A customer with this phone number already exists.';
    if (err.constraint?.includes('size_color')) return 'This product already has a variant with that size and colour.';
    if (err.constraint?.includes('sku')) return 'That SKU is already used by another product.';
    if (err.constraint?.includes('categories')) return 'A category with that name already exists.';
    return 'That value is already in use.';
  }
  if (err?.code === '23514') return 'One of the values is not allowed (check price, stock or gender).';
  if (err?.code === '23503') return 'This record is still referenced by other data.';
  if (err?.code === '22P02') return 'One of the values has the wrong format.';
  console.error(e);
  return 'Could not save. Please try again.';
}

export function errUrl(base: string, msg: string): string {
  return `${base}${base.includes('?') ? '&' : '?'}err=${encodeURIComponent(msg)}`;
}
