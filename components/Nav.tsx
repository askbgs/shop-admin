'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/login/actions';

export default function Nav({ pending, lowStock }: { pending: number; lowStock: number }) {
  const path = usePathname();
  const is = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));
  return (
    <nav className="side">
      <div className="brand">Shop<span>Admin</span></div>
      <Link href="/" className={is('/') ? 'active' : ''}>Dashboard</Link>
      <Link href="/orders" className={is('/orders') ? 'active' : ''}>
        Orders {pending > 0 && <span className="pill">{pending}</span>}
      </Link>
      <Link href="/stock" className={is('/stock') ? 'active' : ''}>
        Low stock {lowStock > 0 && <span className="pill">{lowStock}</span>}
      </Link>
      <form action={logout}>
        <button type="submit">Sign out</button>
      </form>
    </nav>
  );
}
