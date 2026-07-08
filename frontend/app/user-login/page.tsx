'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, saveUser } from '@/lib/api';

export default function UserLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const res = await api<{ user_id: number, identifier: string }>('/api/enroll', {
        method: 'POST',
        body: JSON.stringify({ identifier, campaign_id: campaignId }),
      });
      saveUser({ id: res.user_id, identifier: res.identifier });
      router.push('/play');
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
        <h1>User Login</h1>
        <p>Enter your identifier and campaign ID to play.</p>
        <label className="field">
          <span>Identifier (e.g., email)</span>
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} type="text" required />
        </label>
        <label className="field">
          <span>Campaign ID</span>
          <input value={campaignId} onChange={(e) => setCampaignId(e.target.value)} type="text" required />
        </label>
        {err && <div className="err">{err}</div>}
        <button className="btn" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </div>
  );
}
