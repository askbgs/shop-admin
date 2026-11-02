'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/login/actions';
import PendingModal from './PendingModal';

export default function Nav({ pending, lowStock, storeName }: { pending: number; lowStock: number; storeName: string }) {
  const path = usePathname();
  const is = (p: string) => (p === '/' ? path === '/' : path === p || path.startsWith(`${p}/`));
  const link = (href: string, label: string, badge?: number) => (
    <Link href={href} className={is(href) ? 'active' : ''}>
      {label} {badge ? <span className="pill">{badge}</span> : null}
    </Link>
  );
  return (
    <nav className="side">
      <div className="brand" title={storeName}>{storeName}<span> · Admin</span></div>
      {link('/', 'Dashboard')}
      {link('/orders', 'Orders', pending)}
      <div className="nav-sep">Catalogue</div>
      {link('/products', 'Products')}
      {link('/categories', 'Categories')}
      {link('/stock', 'Low stock', lowStock)}
      <div className="nav-sep">People & store</div>
      {link('/customers', 'Customers')}
      {link('/settings', 'Store settings')}
      <form action={logout}>
        <PendingModal title="Signing out…" />
        <button type="submit">Sign out</button>
      </form>
    </nav>
  );
}
