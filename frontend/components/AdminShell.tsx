'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, clearSession, hasSession } from '@/lib/api';

const NAV = [
  { href: '/branding', icon: '🎨', label: 'Branding' },
  { href: '/dashboard', icon: '▦', label: 'Dashboard' },
  { href: '/users', icon: '👥', label: 'Users' },
  { href: '/vouchers', icon: '🎟️', label: 'Vouchers' },
  { href: '/campaigns', icon: '🚀', label: 'Campaigns' },
  { href: '/calendar', icon: '📅', label: 'Drop Calendar' },
  { href: '/analytics', icon: '📈', label: 'Analytics' },
  { href: '/whatsapp', icon: '💬', label: 'WhatsApp' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasSession()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  async function signOut() {
    try { await api('/api/admin/logout', { method: 'POST', admin: true }); } catch {}
    clearSession();
    router.replace('/login');
  }

  if (!ready) return null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-logo">Drop<span>Zone</span></div>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`nav-item ${pathname === n.href ? 'active' : ''}`}
          >
            <span className="ico">{n.icon}</span>
            {n.label}
          </Link>
        ))}
        <div className="nav-spacer" />
        <button className="signout" onClick={signOut}>Sign out</button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
