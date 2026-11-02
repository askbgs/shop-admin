'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type NewOrder = { order_no: string; total_cents: number; created_at: string; customer_phone: string; full_name: string | null; item_count: number };
type Toast = NewOrder & { key: string };

const POLL_MS = 10_000;
const TOAST_MS = 15_000;

const lkr = (cents: number) => `LKR ${(cents / 100).toLocaleString('en-LK', { maximumFractionDigits: 2 })}`;

/**
 * Watches for new WhatsApp orders. Every 10 s (and whenever the tab becomes visible again)
 * it asks /api/orders/new for orders newer than the last one it has seen. For each new order
 * it shows a toast "New order arrived" and refreshes the current page's data, so the
 * dashboard KPIs, order lists and the Orders badge update without a reload.
 */
export default function OrderWatcher({ initialLatest }: { initialLatest: string | null }) {
  const router = useRouter();
  const since = useRef<string | null>(initialLatest);
  const busy = useRef(false);
  const stopped = useRef(false);
  const baseTitle = useRef<string>('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unseen, setUnseen] = useState(0);

  const dismiss = useCallback((key: string) => setToasts((t) => t.filter((x) => x.key !== key)), []);

  const check = useCallback(async () => {
    if (busy.current || stopped.current) return;
    busy.current = true;
    try {
      const res = await fetch(`/api/orders/new?since=${encodeURIComponent(since.current ?? '')}`, { cache: 'no-store' });
      if (res.status === 401) { stopped.current = true; return; } // signed out in another tab
      if (!res.ok) return;
      const data: { latest: string | null; orders: NewOrder[] } = await res.json();
      if (!since.current) { since.current = data.latest; return; } // first order ever: just start the cursor
      if (data.orders.length > 0) {
        since.current = data.orders[data.orders.length - 1].created_at;
        const fresh = data.orders.map((o) => ({ ...o, key: `${o.order_no}-${o.created_at}` }));
        setToasts((t) => [...fresh.reverse(), ...t].slice(0, 4));
        setUnseen((n) => n + fresh.length);
        router.refresh(); // re-render the server data on whatever page is open
      }
    } catch {
      // network blip: try again on the next tick
    } finally {
      busy.current = false;
    }
  }, [router]);

  // poll, pause while the tab is hidden, check immediately when it comes back
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!timer) timer = setInterval(check, POLL_MS); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVis = () => {
      if (document.visibilityState === 'visible') { check(); start(); } else stop();
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', check);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', check); };
  }, [check]);

  // auto-hide each toast
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.key), TOAST_MS));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  // "(2) New order · Dashboard" in the browser tab until the admin comes back to it
  useEffect(() => {
    const strip = (t: string) => t.replace(/^\(\d+\) New orders? · /, '');
    const apply = () => {
      baseTitle.current = strip(document.title) || baseTitle.current;
      const want = unseen > 0 ? `(${unseen}) New order${unseen > 1 ? 's' : ''} · ${baseTitle.current}` : baseTitle.current;
      if (document.title !== want) document.title = want;
    };
    apply();
    // the page refresh resets <title> from the page metadata - put the counter back each time
    const obs = new MutationObserver(apply);
    obs.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => obs.disconnect();
  }, [unseen]);
  useEffect(() => {
    const clear = () => { if (document.visibilityState === 'visible') setUnseen(0); };
    const t = setTimeout(clear, 4000);
    document.addEventListener('visibilitychange', clear);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', clear); };
  }, [unseen]);

  if (toasts.length === 0) return null;
  return (
    <div className="ow-stack" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <div className="ow-toast" role="status" key={t.key} data-order={t.order_no}>
          <div className="ow-icon" aria-hidden="true">🔔</div>
          <div className="ow-body">
            <div className="ow-title">New order arrived</div>
            <div className="ow-no">{t.order_no}</div>
            <div className="ow-meta">
              {t.full_name ?? `+${t.customer_phone}`} · {t.item_count} {t.item_count === 1 ? 'item' : 'items'} · <b>{lkr(t.total_cents)}</b>
            </div>
            <div className="ow-actions">
              <Link className="btn primary" href={`/orders/${t.order_no}`} onClick={() => dismiss(t.key)}>View order</Link>
              <span className="ow-note">Page updated</span>
            </div>
          </div>
          <button type="button" className="ow-x" onClick={() => dismiss(t.key)} aria-label="Dismiss">✕</button>
          <div className="ow-timer" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
