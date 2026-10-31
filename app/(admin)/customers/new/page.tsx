import Link from 'next/link';
import CustomerForm from '@/components/CustomerForm';
import Flash from '@/components/Flash';
import { createCustomer } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <div className="head">
        <div>
          <div className="muted"><Link href="/customers">Customers</Link> /</div>
          <h1>New customer</h1>
        </div>
      </div>
      <Flash err={sp.err} />
      <div style={{ maxWidth: 760 }}>
        <CustomerForm action={createCustomer} submitLabel="Create customer" />
      </div>
    </>
  );
}
