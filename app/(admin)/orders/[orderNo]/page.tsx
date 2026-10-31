import Link from 'next/link';
import { notFound } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import { NEXT_STATUS, dateTime, lkr } from '@/lib/format';
import { getCustomerOrderCount, getOrder } from '@/lib/queries';
import { changeStatus } from './actions';

export const dynamic = 'force-dynamic';

const ACTION_LABEL: Record<string, string> = {
  confirmed: 'Confirm order',
  packed: 'Mark packed',
  shipped: 'Mark shipped',
  delivered: 'Mark delivered',
  cancelled: 'Cancel order',
};

const ERRORS: Record<string, string> = {
  invalid: 'That action is not allowed.',
  stale: 'The order status changed before your update — check the current status and try again.',
  db: 'Could not update the order. Please try again.',
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNo: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { orderNo } = await params;
  const sp = await searchParams;
  const data = await getOrder(decodeURIComponent(orderNo));
  if (!data) notFound();
  const { order, items } = data;
  const orderCount = await getCustomerOrderCount(order.customer_phone);
  const next = NEXT_STATUS[order.status];
  const waLink = `https://wa.me/${order.customer_phone}`;

  return (
    <>
      <div className="head">
        <div>
          <div className="muted"><Link href="/orders">Orders</Link> /</div>
          <h1>{order.order_no} <StatusBadge status={order.status} /></h1>
          <div className="muted">Placed {dateTime(order.created_at)} · updated {dateTime(order.updated_at)}</div>
        </div>
        {next.length > 0 && (
          <form action={changeStatus} className="actions">
            <input type="hidden" name="orderNo" value={order.order_no} />
            {next.map((s) => (
              <button
                key={s}
                name="to"
                value={s}
                type="submit"
                className={`btn ${s === 'cancelled' ? 'danger' : 'primary'}`}
              >
                {ACTION_LABEL[s]}
              </button>
            ))}
          </form>
        )}
      </div>

      {sp.ok && <div className="flash ok">Order marked as <b>{sp.ok}</b>{sp.ok === 'cancelled' && ' — stock has been restored'}.</div>}
      {sp.err && <div className="flash err">{ERRORS[sp.err] ?? 'Something went wrong.'}</div>}

      <div className="grid two">
        <div className="card">
          <h2>Items</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Product</th><th>Size</th><th>Colour</th><th className="r">Qty</th><th className="r">Unit</th><th className="r">Total</th><th className="r">In stock</th></tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.product_name}</td>
                    <td>{it.size}</td>
                    <td>{it.color}</td>
                    <td className="r num">{it.qty}</td>
                    <td className="r num">{lkr(it.unit_price_cents)}</td>
                    <td className="r num">{lkr(it.line_total_cents)}</td>
                    <td className={`r num ${it.stock_qty === 0 ? 'stock-0' : ''}`}>{it.stock_qty ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={5} className="r muted">Subtotal</td><td className="r num">{lkr(order.subtotal_cents)}</td><td /></tr>
                <tr><td colSpan={5} className="r muted">Delivery</td><td className="r num">{order.delivery_fee_cents === 0 ? 'Free' : lkr(order.delivery_fee_cents)}</td><td /></tr>
                <tr><td colSpan={5} className="r"><b>Total</b></td><td className="r num"><b>{lkr(order.total_cents)}</b></td><td /></tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <h2>Customer</h2>
            <dl className="dl">
              <dt>Name</dt><dd>{order.full_name ?? '—'}</dd>
              <dt>WhatsApp</dt><dd><a href={waLink} target="_blank" rel="noreferrer">+{order.customer_phone}</a></dd>
              <dt>Orders</dt><dd>{orderCount}</dd>
            </dl>
          </div>
          <div className="card">
            <h2>Delivery & payment</h2>
            <dl className="dl">
              <dt>Address</dt><dd>{order.delivery_address ?? '—'}</dd>
              <dt>City</dt><dd>{[order.city, order.district].filter(Boolean).join(', ') || '—'}</dd>
              <dt>Payment</dt><dd>{order.payment_method === 'bank_transfer' ? 'Bank transfer' : 'Cash on delivery'}</dd>
              {order.notes && (<><dt>Notes</dt><dd>{order.notes}</dd></>)}
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
