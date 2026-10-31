import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { STATUSES, dateTime, isStatus, lkr } from '@/lib/format';
import { listOrders } from '@/lib/queries';

export const dynamic = 'force-dynamic';

type SP = { status?: string; q?: string; from?: string; to?: string; page?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const status = isStatus(sp.status) ? sp.status : '';
  const search = (sp.q ?? '').trim().slice(0, 60);
  const from = sp.from && DATE_RE.test(sp.from) ? sp.from : '';
  const to = sp.to && DATE_RE.test(sp.to) ? sp.to : '';
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 25;

  const { rows, total } = await listOrders({ status, search, from, to, page, pageSize });
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const href = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { status, q: search, from, to, page: String(page), ...over };
    Object.entries(merged).forEach(([k, v]) => { if (v && !(k === 'page' && v === '1')) p.set(k, v); });
    const s = p.toString();
    return s ? `/orders?${s}` : '/orders';
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>Orders</h1>
          <div className="muted">{total} {total === 1 ? 'order' : 'orders'}{status && ` · ${status}`}</div>
        </div>
      </div>

      <div className="tabs">
        <Link href={href({ status: '', page: '1' })} className={!status ? 'on' : ''}>All</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={href({ status: s, page: '1' })} className={status === s ? 'on' : ''} style={{ textTransform: 'capitalize' }}>{s}</Link>
        ))}
      </div>

      <form className="filters" method="get">
        {status && <input type="hidden" name="status" value={status} />}
        <label>Search
          <input name="q" defaultValue={search} placeholder="Order no, phone or name" style={{ width: 240 }} />
        </label>
        <label>From<input type="date" name="from" defaultValue={from} /></label>
        <label>To<input type="date" name="to" defaultValue={to} /></label>
        <button className="btn primary" type="submit">Apply</button>
        {(search || from || to) && <Link className="btn" href={status ? `/orders?status=${status}` : '/orders'}>Clear</Link>}
      </form>

      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">No orders match these filters</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th><th>Customer</th><th>Status</th><th className="r">Items</th>
                  <th className="r">Total</th><th>Payment</th><th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.order_no} className="link">
                    <td><Link href={`/orders/${o.order_no}`}><b>{o.order_no}</b></Link></td>
                    <td>{o.full_name ?? '—'}<div className="muted">+{o.customer_phone}</div></td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="r num">{o.item_count}</td>
                    <td className="r num">{lkr(o.total_cents)}</td>
                    <td>{o.payment_method === 'bank_transfer' ? 'Bank transfer' : o.payment_method}</td>
                    <td className="muted">{dateTime(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="pager">
            <span className="muted">Page {page} of {pages}</span>
            <div className="actions">
              {page > 1 && <Link className="btn" href={href({ page: String(page - 1) })}>← Prev</Link>}
              {page < pages && <Link className="btn" href={href({ page: String(page + 1) })}>Next →</Link>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
