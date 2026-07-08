'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, saveSession } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@dropzone.test');
  const [password, setPassword] = useState('dropzone123');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const res = await api<{ token: string }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      saveSession(res.token);
      router.push('/dashboard');
    } catch (e: any) {
      setErr(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <div className="brand-logo" style={{ padding: '0 0 14px' }}>Drop<span>Zone</span></div>
        <h1>Admin sign in</h1>
        <p>Manage campaigns, vouchers and the drop calendar.</p>
        <label className="field">
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>
        {err && <div className="err">{err}</div>}
        <button className="btn" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
