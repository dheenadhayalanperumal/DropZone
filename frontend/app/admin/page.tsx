'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hasSession } from '@/lib/api';

// Admin entry point: land signed-in admins on the dashboard, others on login.
export default function AdminEntry() {
  const router = useRouter();
  useEffect(() => {
    router.replace(hasSession() ? '/dashboard' : '/login');
  }, [router]);
  return (
    <div className="auth-wrap">
      <p className="muted">Opening admin…</p>
    </div>
  );
}
