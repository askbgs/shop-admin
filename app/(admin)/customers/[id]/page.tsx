import Link from 'next/link';
import { notFound } from 'next/navigation';
import CustomerForm from '@/components/CustomerForm';
import Flash from '@/components/Flash';
import StatusBadge from '@/components/StatusBadge';
import { getCustomer } from '@/lib/customers';
import { dateTime, lkr } from '@/lib/format';
import { deleteCustomer, updateCustomer } from '../actions';

export const dynamic = 'force-dynamic';

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await getCustomer(id);
  if (!data) notFound();
  const { customer, orders, spent } = data;
  const active = orders.filter((o) => o.status !== 'cancelled');

  return (
    <>
      <div className="head">
        <div>
          <div className="muted"><Link href="/customers">Customers</Link> /</div>
          <h1>{customer.full_name ?? `+${customer.phone}`}</h1>
          <div className="muted">Customer since {dateTime(customer.created_at)}</div>
        </div>
        <a className="btn" href={`https://wa.me/${customer.phone}`} target="_blank" rel="noreferrer">Open WhatsApp chat ↗</a>
      </div>
      <Flash ok={sp.ok} err={sp.err} okText={{ created: 'Customer created.', saved: 'Customer saved.' }} />

      <div className="grid kpis">
        <div className="card kpi"><div className="label">Orders</div><div className="value num">{orders.length}</div><div className="sub">{orders.length - active.length} cancelled</div></div>
        <div className="card kpi"><div className="label">Total spent</div><div className="value num">{lkr(spent)}</div><div className="sub">excl. cancelled</div></div>
        <div className="card kpi"><div className="label">Average order</div><div className="value num">{lkr(active.length ? Math.round(spent / active.length / 100) * 100 : 0)}</div></div>
      </div>

      <div className="grid two" style={{ alignItems: 'start' }}>
        <CustomerForm action={updateCustomer} customer={customer} submitLabel="Save customer" />
        <div className="grid">
          <div className="card">
            <h2>Orders</h2>
            {orders.length === 0 ? (
              <div className="empty">No orders yet</div>
            ) : (
              <table>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.order_no} className="link">
                      <td><Link href={`/orders/${o.order_no}`}><b>{o.order_no}</b></Link><div className="muted">{dateTime(o.created_at)} · {o.item_count} items</div></td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="r num">{lkr(o.total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {orders.length === 0 && (
            <form action={deleteCustomer} className="card danger-zone">
              <h2>Delete customer</h2>
              <input type="hidden" name="id" value={customer.id} />
              <div className="muted" style={{ marginBottom: 10 }}>Only customers without orders can be deleted.</div>
              <button className="btn danger" type="submit">Delete customer</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
