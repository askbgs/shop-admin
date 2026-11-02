import Link from 'next/link';
import { notFound } from 'next/navigation';
import Flash from '@/components/Flash';
import ImageUpload from '@/components/ImageUpload';
import ProductForm from '@/components/ProductForm';
import { categoryNames, getProduct } from '@/lib/catalog';
import { lkr } from '@/lib/format';
import { centsToInput } from '@/lib/lk';
import { lowStockThreshold } from '@/lib/queries';
import { addVariant, deleteProduct, deleteVariant, updateProduct, updateVariant } from '../actions';
import { removeImage, uploadImage } from '../image-actions';
import PendingModal from '@/components/PendingModal';

export const dynamic = 'force-dynamic';

const OK: Record<string, string> = {
  created: 'Product created. Now add its sizes, colours and stock below.',
  saved: 'Product saved.',
  variant_added: 'Variant added.',
  variant_saved: 'Variant saved.',
  variant_deleted: 'Variant deleted.',
  product_image: 'Product photo uploaded.',
  product_image_removed: 'Product photo removed.',
  variant_image: 'Variant photo uploaded. The agent will send this photo for that colour/size.',
  variant_image_removed: 'Variant photo removed — it now uses the product photo.',
};

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [data, cats] = await Promise.all([getProduct(id), categoryNames()]);
  if (!data) notFound();
  const { product, variants, orderLines } = data;
  const totalStock = variants.filter((v) => v.is_active).reduce((s, v) => s + v.stock_qty, 0);
  const low = lowStockThreshold();

  return (
    <>
      <div className="head">
        <div>
          <div className="muted"><Link href="/products">Products</Link> /</div>
          <h1>{product.name} {!product.is_active && <span className="badge s-cancelled">Inactive</span>}</h1>
          <div className="muted">{product.category} · {lkr(product.price_cents)} · {totalStock} in stock across {variants.length} variants</div>
        </div>
      </div>
      <Flash ok={sp.ok} err={sp.err} okText={OK} />

      <div className="grid two" style={{ alignItems: 'start' }}>
        <ProductForm action={updateProduct} product={product} categories={cats} submitLabel="Save product" />
        <div className="grid">
          <div className="card">
            <h2>Main photo</h2>
            <ImageUpload
              upload={uploadImage}
              remove={removeImage}
              fields={{ kind: 'product', product_id: product.id }}
              imageUrl={product.image_url}
              size="lg"
              label="Upload main product photo"
            />
            <div className="muted" style={{ marginTop: 8 }}>
              JPG or PNG from your phone or computer — resized automatically and uploaded to PinPicX. Used for every variant that has no photo of its own.
            </div>
          </div>
          <div className="card danger-zone">
            <h2>Delete product</h2>
            {orderLines > 0 ? (
              <div className="muted">This product appears in {orderLines} order {orderLines === 1 ? 'line' : 'lines'}, so it can&apos;t be deleted. Untick <b>Active</b> to hide it from the agent.</div>
            ) : (
              <form action={deleteProduct}>
                <PendingModal title="Deleting product…" detail="Removing the product, its variants and photos." />
                <input type="hidden" name="id" value={product.id} />
                <div className="muted" style={{ marginBottom: 10 }}>Removes the product and all its variants. This can&apos;t be undone.</div>
                <button className="btn danger" type="submit">Delete product</button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="card" id="variants" style={{ marginTop: 16 }}>
        <h2>Sizes, colours & stock</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Photo</th><th>Size</th><th>Colour</th><th className="r">Extra (LKR)</th><th className="r">Price</th>
                <th className="r">Stock</th><th className="r">Sold</th><th>Active</th><th />
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => {
                const fid = `v-${v.id}`;
                return (
                  <tr key={v.id} className={v.is_active ? '' : 'muted-row'} data-variant={v.id}>
                    <td className="tight">
                      <ImageUpload
                        upload={uploadImage}
                        remove={removeImage}
                        fields={{ kind: 'variant', product_id: product.id, variant_id: v.id }}
                        imageUrl={v.image_url}
                        fallbackUrl={product.image_url}
                        label={`Upload photo for ${v.color} ${v.size}`}
                      />
                    </td>
                    <td><input form={fid} className="inline-input" name="size" defaultValue={v.size} required maxLength={40} /></td>
                    <td><input form={fid} className="inline-input" name="color" defaultValue={v.color} required maxLength={60} /></td>
                    <td className="r"><input form={fid} className="inline-input num" name="extra_price" defaultValue={centsToInput(v.extra_price_cents)} inputMode="decimal" style={{ width: 90, textAlign: 'right' }} /></td>
                    <td className="r num muted" style={{ whiteSpace: 'nowrap' }}>{lkr(product.price_cents + v.extra_price_cents)}</td>
                    <td className="r">
                      <input form={fid} className={`inline-input num ${v.stock_qty === 0 ? 'stock-0' : v.stock_qty <= low ? 'stock-low' : ''}`} name="stock_qty" defaultValue={v.stock_qty} inputMode="numeric" style={{ width: 80, textAlign: 'right' }} />
                    </td>
                    <td className="r num">{v.sold}</td>
                    <td><input form={fid} type="checkbox" name="v_active" defaultChecked={v.is_active} aria-label="Active" /></td>
                    <td className="tight">
                      <div className="actions" style={{ flexWrap: 'nowrap' }}>
                        <form id={fid} action={updateVariant}>
                          <PendingModal title="Saving variant…" detail="Updating size, colour, price and stock." />
                          <input type="hidden" name="product_id" value={product.id} />
                          <input type="hidden" name="variant_id" value={v.id} />
                          <button className="btn" type="submit">Save</button>
                        </form>
                        {v.sold === 0 && (
                          <form action={deleteVariant}>
                            <PendingModal title="Deleting variant…" />
                            <input type="hidden" name="product_id" value={product.id} />
                            <input type="hidden" name="variant_id" value={v.id} />
                            <button className="btn danger" type="submit" title="Delete variant">✕</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className="muted" style={{ fontSize: 12 }} title="Add a photo after saving the variant">New</td>
                <td><input form="v-new" className="inline-input" name="size" placeholder="M" required maxLength={40} /></td>
                <td><input form="v-new" className="inline-input" name="color" placeholder="Black" required maxLength={60} /></td>
                <td className="r"><input form="v-new" className="inline-input" name="extra_price" placeholder="0" inputMode="decimal" style={{ width: 90, textAlign: 'right' }} /></td>
                <td />
                <td className="r"><input form="v-new" className="inline-input" name="stock_qty" placeholder="10" required inputMode="numeric" style={{ width: 80, textAlign: 'right' }} /></td>
                <td />
                <td />
                <td className="tight">
                  <form id="v-new" action={addVariant}>
                    <PendingModal title="Adding variant…" />
                    <input type="hidden" name="product_id" value={product.id} />
                    <button className="btn primary" type="submit">+ Add</button>
                  </form>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          Click a photo box to upload a picture for that colour/size — faded boxes are using the main photo. Stock goes down automatically when the agent places an order and back up if you cancel it. Variants that have been sold can&apos;t be deleted — untick Active instead.
        </div>
      </div>
    </>
  );
}
