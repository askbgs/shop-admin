import Link from 'next/link';
import Flash from '@/components/Flash';
import { listCustomers } from '@/lib/customers';
import { dateTime, lkr } from '@/lib/format';
import { DISTRICTS } from '@/lib/lk';

export const dynamic = 'force-dynamic';

type SP = { q?: string; district?: string; sort?: string; page?: string; ok?: string; err?: string };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const search = (sp.q ?? '').trim().slice(0, 60);
  const district = (DISTRICTS as readonly string[]).includes(sp.district ?? '') ? sp.district! : '';
  const sort = ['recent', 'spent', 'orders', 'name'].includes(sp.sort ?? '') ? sp.sort! : 'recent';
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = 30;
  const { rows, total } = await listCustomers({ search, district, sort, page, pageSize });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const u = new URLSearchParams();
    if (search) u.set('q', search);
    if (district) u.set('district', district);
    if (sort !== 'recent') u.set('sort', sort);
    if (p > 1) u.set('page', String(p));
    const s = u.toString();
    return s ? `/customers?${s}` : '/customers';
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>Customers</h1>
          <div className="muted">{total} {total === 1 ? 'customer' : 'customers'}</div>
        </div>
        <Link className="btn primary" href="/customers/new">+ New customer</Link>
      </div>
      <Flash ok={sp.ok} err={sp.err} okText={{ deleted: 'Customer deleted.' }} />

      <form className="filters" method="get">
        <label>Search<input name="q" defaultValue={search} placeholder="Name, phone or city" style={{ width: 220 }} /></label>
        <label>District
          <select name="district" defaultValue={district}>
            <option value="">All</option>
            {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label>Sort by
          <select name="sort" defaultValue={sort}>
            <option value="recent">Most recent</option>
            <option value="spent">Total spent</option>
            <option value="orders">Number of orders</option>
            <option value="name">Name</option>
          </select>
        </label>
        <button className="btn primary" type="submit">Apply</button>
        {(search || district || sort !== 'recent') && <Link className="btn" href="/customers">Clear</Link>}
      </form>

      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">No customers found</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Customer</th><th>Location</th><th className="r">Orders</th><th className="r">Spent</th><th>Last order</th></tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="link">
                    <td><Link href={`/customers/${c.id}`}><b>{c.full_name ?? 'No name'}</b></Link><div className="muted">+{c.phone}</div></td>
                    <td>{[c.city, c.district].filter(Boolean).join(', ') || '—'}</td>
                    <td className="r num">{c.order_count}</td>
                    <td className="r num">{lkr(c.total_spent)}</td>
                    <td className="muted">{c.last_order_at ? dateTime(c.last_order_at) : 'Never'}</td>
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
              {page > 1 && <Link className="btn" href={href(page - 1)}>← Prev</Link>}
              {page < pages && <Link className="btn" href={href(page + 1)}>Next →</Link>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
