export function lkr(cents: number | string | null | undefined): string {
  const n = Number(cents ?? 0) / 100;
  return `LKR ${n.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function lkrShort(cents: number): string {
  const n = cents / 100;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

export function dateTime(d: Date | string): string {
  return new Date(d).toLocaleString('en-GB', {
    timeZone: 'Asia/Colombo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof STATUSES)[number];

// Allowed next steps for each status. Cancelling restores stock (DB trigger orders_on_cancel).
export const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function isStatus(s: unknown): s is OrderStatus {
  return typeof s === 'string' && (STATUSES as readonly string[]).includes(s);
}
