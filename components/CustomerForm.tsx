import { DISTRICTS } from '@/lib/lk';
import type { Customer } from '@/lib/customers';

export default function CustomerForm({
  action,
  customer,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<void>;
  customer?: Customer;
  submitLabel: string;
}) {
  return (
    <form action={action} className="card">
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <div className="form-grid">
        <label className="field">
          <span>WhatsApp number *</span>
          <input name="phone" required inputMode="tel" defaultValue={customer ? `+${customer.phone}` : ''} placeholder="+94 77 123 4567" />
          <small>Saved as 94XXXXXXXXX — the number the agent sees.</small>
        </label>
        <label className="field">
          <span>Full name</span>
          <input name="full_name" maxLength={120} defaultValue={customer?.full_name ?? ''} />
        </label>
        <label className="field full">
          <span>Delivery address</span>
          <textarea name="address" maxLength={500} rows={2} defaultValue={customer?.address ?? ''} style={{ minHeight: 60 }} />
        </label>
        <label className="field">
          <span>City / town</span>
          <input name="city" maxLength={80} defaultValue={customer?.city ?? ''} />
        </label>
        <label className="field">
          <span>District</span>
          <select name="district" defaultValue={customer?.district ?? ''}>
            <option value="">—</option>
            {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="field full">
          <span>Notes (internal)</span>
          <textarea name="notes" maxLength={2000} defaultValue={customer?.notes ?? ''} placeholder="Sizes they like, delivery instructions…" />
        </label>
      </div>
      <div className="form-actions">
        <button className="btn primary" type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}
