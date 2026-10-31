import { centsToInput, GENDERS } from '@/lib/lk';
import type { Product } from '@/lib/catalog';

export default function ProductForm({
  action,
  product,
  categories,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  product?: Product;
  categories: string[];
  submitLabel: string;
}) {
  return (
    <form action={action} className="card">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="form-grid">
        <label className="field full">
          <span>Product name *</span>
          <input name="name" required maxLength={200} defaultValue={product?.name ?? ''} placeholder="e.g. Floral Summer Frock" />
        </label>
        <label className="field">
          <span>Category *</span>
          <input name="category" required list="category-list" maxLength={80} defaultValue={product?.category ?? ''} placeholder="Pick or type a new one" />
          <datalist id="category-list">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label className="field">
          <span>For</span>
          <select name="gender" defaultValue={product?.gender ?? 'unisex'}>
            {GENDERS.map((g) => <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Price (LKR) *</span>
          <input name="price" required inputMode="decimal" defaultValue={centsToInput(product?.price_cents)} placeholder="1900" />
          <small>Base price. Variants can add an extra amount.</small>
        </label>
        <label className="field">
          <span>SKU</span>
          <input name="sku" maxLength={60} defaultValue={product?.sku ?? ''} placeholder="TS-001" />
        </label>
        <label className="field">
          <span>Brand</span>
          <input name="brand" maxLength={100} defaultValue={product?.brand ?? ''} />
        </label>
        <label className="field">
          <span>Material</span>
          <input name="material" maxLength={100} defaultValue={product?.material ?? ''} placeholder="100% cotton" />
        </label>
        <label className="field full">
          <span>Description</span>
          <textarea name="description" maxLength={2000} defaultValue={product?.description ?? ''} placeholder="What the agent tells customers about this item" />
        </label>
        <label className="field full">
          <span>Image URL</span>
          <input name="image_url" type="url" maxLength={1000} defaultValue={product?.image_url ?? ''} placeholder="https://..." />
          <small>{product ? 'Filled in automatically when you upload a photo on the right — or paste a public link.' : 'Optional — you can upload a photo after creating the product.'}</small>
        </label>
        <label className="field full">
          <span>Tags</span>
          <input name="tags" maxLength={400} defaultValue={(product?.tags ?? []).join(', ')} placeholder="casual, cotton, party" />
          <small>Comma separated. Helps the agent find this product.</small>
        </label>
        <label className="check full">
          <input type="checkbox" name="is_active" defaultChecked={product?.is_active ?? true} />
          Active (visible to the WhatsApp agent)
        </label>
      </div>
      <div className="form-actions">
        <button className="btn primary" type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}
