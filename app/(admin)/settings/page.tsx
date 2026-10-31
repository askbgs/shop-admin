import Flash from '@/components/Flash';
import { q } from '@/lib/db';
import { dateTime, lkr } from '@/lib/format';
import { centsToInput, DISTRICTS } from '@/lib/lk';
import { saveSettings } from './actions';

export const dynamic = 'force-dynamic';

type Settings = {
  store_name: string; tagline: string | null; description: string | null; logo_url: string | null;
  phone: string | null; whatsapp: string | null; email: string | null; website: string | null;
  address: string | null; city: string | null; district: string | null; opening_hours: string | null;
  facebook_url: string | null; instagram_url: string | null; tiktok_url: string | null;
  delivery_fee_cents: number; free_delivery_threshold_cents: number; delivery_info: string | null; return_policy: string | null;
  bank_name: string | null; bank_branch: string | null; bank_account_name: string | null; bank_account_number: string | null;
  payment_instructions: string | null; updated_at: Date;
};

function Text({ name, label, value, placeholder, hint, full, type = 'text', max = 200 }: {
  name: string; label: string; value: string | null; placeholder?: string; hint?: string; full?: boolean; type?: string; max?: number;
}) {
  return (
    <label className={`field ${full ? 'full' : ''}`}>
      <span>{label}</span>
      <input name={name} type={type} defaultValue={value ?? ''} placeholder={placeholder} maxLength={max} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function Area({ name, label, value, placeholder, hint, max = 2000 }: { name: string; label: string; value: string | null; placeholder?: string; hint?: string; max?: number }) {
  return (
    <label className="field full">
      <span>{label}</span>
      <textarea name={name} defaultValue={value ?? ''} placeholder={placeholder} maxLength={max} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const [s] = await q<Settings>(`SELECT * FROM store_settings WHERE id = 1`);

  return (
    <>
      <div className="head">
        <div>
          <h1>Store settings</h1>
          <div className="muted">Used by the WhatsApp agent and the order pricing · last saved {dateTime(s.updated_at)}</div>
        </div>
      </div>
      <Flash ok={sp.ok} err={sp.err} okText={{ saved: 'Store settings saved. The agent uses them from the next message.' }} />

      <form action={saveSettings} className="card" style={{ maxWidth: 900 }}>
        <div className="form-grid">
          <div className="section-title">Store</div>
          <Text name="store_name" label="Store name *" value={s.store_name} max={120} />
          <Text name="tagline" label="Tagline" value={s.tagline} placeholder="Trendy clothing for the whole family" max={160} />
          <Area name="description" label="About the store" value={s.description} placeholder="What you sell, what makes you different…" hint="The agent uses this to answer 'tell me about your shop'." />
          <Text name="logo_url" label="Logo URL" value={s.logo_url} type="url" placeholder="https://…" full max={500} />

          <div className="section-title">Contact</div>
          <Text name="phone" label="Contact number" value={s.phone} placeholder="026 222 3344" max={30} />
          <Text name="whatsapp" label="WhatsApp number" value={s.whatsapp ? `+${s.whatsapp}` : null} placeholder="+94 77 123 4567" max={30} />
          <Text name="email" label="Email" value={s.email} type="email" placeholder="hello@yourstore.lk" max={120} />
          <Text name="website" label="Website" value={s.website} type="url" placeholder="https://…" max={500} />
          <Text name="facebook_url" label="Facebook page" value={s.facebook_url} type="url" placeholder="https://facebook.com/…" max={500} />
          <Text name="instagram_url" label="Instagram" value={s.instagram_url} type="url" placeholder="https://instagram.com/…" max={500} />
          <Text name="tiktok_url" label="TikTok" value={s.tiktok_url} type="url" placeholder="https://tiktok.com/@…" max={500} />

          <div className="section-title">Address & hours</div>
          <Text name="address" label="Address" value={s.address} placeholder="No. 12, Main Street" full max={500} />
          <Text name="city" label="City / town" value={s.city} max={80} />
          <label className="field">
            <span>District</span>
            <select name="district" defaultValue={s.district ?? ''}>
              <option value="">—</option>
              {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <Area name="opening_hours" label="Opening hours" value={s.opening_hours} placeholder={'Mon–Sat 9.00 am – 8.00 pm\nSunday 10.00 am – 2.00 pm'} max={500} />

          <div className="section-title">Delivery & returns</div>
          <label className="field">
            <span>Delivery fee (LKR)</span>
            <input name="delivery_fee" inputMode="decimal" required defaultValue={centsToInput(s.delivery_fee_cents)} />
            <small>Added to every order. Currently {lkr(s.delivery_fee_cents)}.</small>
          </label>
          <label className="field">
            <span>Free delivery from (LKR)</span>
            <input name="free_delivery_threshold" inputMode="decimal" defaultValue={centsToInput(s.free_delivery_threshold_cents)} />
            <small>Orders at or above this subtotal get free delivery. 0 = never free.</small>
          </label>
          <Area name="delivery_info" label="Delivery information" value={s.delivery_info} placeholder="Island-wide delivery in 2–4 working days via courier." max={1000} />
          <Area name="return_policy" label="Exchange / return policy" value={s.return_policy} placeholder="Exchanges within 7 days with the receipt. Sale items cannot be returned." />

          <div className="section-title">Bank details (for bank transfer payments)</div>
          <Text name="bank_name" label="Bank" value={s.bank_name} placeholder="Commercial Bank" max={120} />
          <Text name="bank_branch" label="Branch" value={s.bank_branch} placeholder="Trincomalee" max={120} />
          <Text name="bank_account_name" label="Account name" value={s.bank_account_name} placeholder="ABC Fashion (Pvt) Ltd" max={120} />
          <Text name="bank_account_number" label="Account number" value={s.bank_account_number} placeholder="1234567890" max={40} />
          <Area name="payment_instructions" label="Payment instructions" value={s.payment_instructions} placeholder="Please send the payment slip to this WhatsApp number with your order number." max={1000} hint="The agent sends the bank details and these instructions when a customer chooses bank transfer." />
        </div>
        <div className="form-actions">
          <button className="btn primary" type="submit">Save settings</button>
        </div>
      </form>
    </>
  );
}
