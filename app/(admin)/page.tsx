import Link from 'next/link';
import RevenueChart from '@/components/RevenueChart';
import StatusBadge from '@/components/StatusBadge';
import { STATUSES, dateTime, lkr } from '@/lib/format';
import {
  getDailyRevenue,
  getKpis,
  getLowStock,
  getStatusCounts,
  getTopProducts,
  listOrders,
  lowStockThreshold,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const [kpis, statusCounts, daily, top, low, recent] = await Promise.all([
    getKpis(),
    getStatusCounts(),
    getDailyRevenue(30),
    getTopProducts(5),
    getLowStock(8),
    listOrders({ pageSize: 8 }),
  ]);
  const topMax = Math.max(1, ...top.map((t) => t.revenue));
  const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Colombo', weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <div className="head">
        <div>
          <h1>Dashboard</h1>
          <div className="muted">{today}</div>
        </div>
        <Link className="btn" href="/orders?status=pending">Review pending orders →</Link>
      </div>

      <div className="grid kpis">
        <div className="card kpi">
          <div className="label">Today&apos;s revenue</div>
          <div className="value num">{lkr(kpis.today_revenue)}</div>
          <div className="sub">{kpis.today_orders} orders today</div>
        </div>
        <div className="card kpi">
          <div className="label">This month</div>
          <div className="value num">{lkr(kpis.month_revenue)}</div>
          <div className="sub">{kpis.month_orders} orders</div>
        </div>
        <div className="card kpi">
          <div className="label">Avg order (30d)</div>
          <div className="value num">{lkr(Math.round(kpis.avg_order / 100) * 100)}</div>
          <div className="sub">excl. cancelled</div>
        </div>
        <Link href="/orders?status=pending" className={`card kpi ${kpis.pending > 0 ? 'alert' : ''}`} style={{ textDecoration: 'none' }}>
          <div className="label">Pending</div>
          <div className="value num">{kpis.pending}</div>
          <div className="sub">waiting for confirmation</div>
        </Link>
        <Link href="/stock" className={`card kpi ${low.length > 0 ? 'alert' : ''}`} style={{ textDecoration: 'none' }}>
          <div className="label">Low stock</div>
          <div className="value num">{low.length}{low.length === 8 ? '+' : ''}</div>
          <div className="sub">variants ≤ {lowStockThreshold()} left</div>
        </Link>
      </div>

      <div className="grid two" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>Daily revenue</h2>
          <RevenueChart data={daily} />
        </div>
        <div className="card">
          <h2>Orders by status</h2>
          <table>
            <tbody>
              {STATUSES.map((s) => (
                <tr key={s} className="link">
                  <td><Link href={`/orders?status=${s}`} style={{ textDecoration: 'none' }}><StatusBadge status={s} /></Link></td>
                  <td className="r num">{statusCounts[s] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>Recent orders</h2>
          {recent.rows.length === 0 ? (
            <div className="empty">No orders yet</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Order</th><th>Customer</th><th>Status</th><th className="r">Total</th><th>Placed</th></tr>
                </thead>
                <tbody>
                  {recent.rows.map((o) => (
                    <tr key={o.order_no} className="link">
                      <td><Link href={`/orders/${o.order_no}`}><b>{o.order_no}</b></Link></td>
                      <td>{o.full_name ?? '—'}<div className="muted">+{o.customer_phone}</div></td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="r num">{lkr(o.total_cents)}</td>
                      <td className="muted">{dateTime(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <h2>Top products (30 days)</h2>
            {top.length === 0 ? (
              <div className="empty">No sales yet</div>
            ) : (
              <div className="bars-list">
                {top.map((t) => (
                  <div className="bar-row" key={t.product_name}>
                    <div>{t.product_name} <span className="muted">· {t.qty} sold</span></div>
                    <div className="num">{lkr(t.revenue)}</div>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(t.revenue / topMax) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card">
            <h2>Low stock</h2>
            {low.length === 0 ? (
              <div className="empty">All variants are well stocked</div>
            ) : (
              <table>
                <tbody>
                  {low.map((v) => (
                    <tr key={`${v.product_name}-${v.size}-${v.color}`}>
                      <td>{v.product_name}<div className="muted">{v.size} · {v.color}</div></td>
                      <td className={`r num ${v.stock_qty === 0 ? 'stock-0' : 'stock-low'}`}>{v.stock_qty === 0 ? 'Out' : v.stock_qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: 10 }}><Link href="/stock" className="muted">See all →</Link></div>
          </div>
        </div>
      </div>
    </>
  );
}
