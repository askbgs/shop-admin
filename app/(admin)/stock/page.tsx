import { getLowStock, lowStockThreshold } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function StockPage() {
  const rows = await getLowStock(500);
  const out = rows.filter((r) => r.stock_qty === 0).length;
  return (
    <>
      <div className="head">
        <div>
          <h1>Low stock</h1>
          <div className="muted">
            Variants with {lowStockThreshold()} or fewer left · {out} out of stock · {rows.length - out} running low
          </div>
        </div>
      </div>
      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">All variants are well stocked</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Product</th><th>SKU</th><th>Size</th><th>Colour</th><th className="r">Stock</th></tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={`${v.product_name}-${v.size}-${v.color}`}>
                    <td>{v.product_name}</td>
                    <td className="muted">{v.sku ?? '—'}</td>
                    <td>{v.size}</td>
                    <td>{v.color}</td>
                    <td className={`r num ${v.stock_qty === 0 ? 'stock-0' : 'stock-low'}`}>{v.stock_qty === 0 ? 'Out of stock' : v.stock_qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
