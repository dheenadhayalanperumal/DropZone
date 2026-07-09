'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

type Reward = {
  id: number; title: string; type: string; value?: string; code?: string | null;
  status: 'issued' | 'redeemed' | 'expired'; issued_at: string; redeemed_at?: string | null; expires_at?: string | null;
};
type Box = { id: number; drop_index: number; drop_title: string; campaign_name: string; status: string; opened_at?: string | null };
type Event = { id: number; type: string; meta: any; created_at: string; drop_index: number; drop_title: string; campaign_name: string };
type UserDetail = {
  id: number; name: string | null; identifier: string; created_at: string;
  boxes: Box[]; rewards: Reward[]; events: Event[];
};

const EVENT_ICON: Record<string, string> = { open: '📦', reveal: '🎁', issue: '🎟️', miss: '⌛', adjust: '🔧', complete: '🏁', enroll: '✅' };

export default function UserDetailPage() {
  return (
    <Suspense fallback={<div className="muted">Loading…</div>}>
      <UserDetailInner />
    </Suspense>
  );
}

function UserDetailInner() {
  const id = useSearchParams().get('id');
  const [user, setUser] = useState<UserDetail | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try { setUser(await api<UserDetail>(`/api/admin/users/${id}`, { admin: true })); }
    catch (e: any) { setErr(e.message); }
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  async function setRewardStatus(rewardId: number, status: string) {
    try {
      await api(`/api/admin/reward-issues/${rewardId}`, { method: 'PATCH', admin: true, body: JSON.stringify({ status }) });
      await load();
    } catch (e: any) { setErr(e.message); }
  }

  if (err) return <div className="err">{err}</div>;
  if (!user) return <div className="muted">Loading…</div>;

  const opened = user.boxes.filter((b) => b.status === 'opened').length;
  const redeemed = user.rewards.filter((r) => r.status === 'redeemed').length;

  return (
    <>
      <Link href="/users" className="muted" style={{ fontSize: 13 }}>‹ Back to users</Link>
      <div className="toolbar" style={{ marginTop: 8 }}>
        <div className="row">
          <span className="avatar" style={{ width: 46, height: 46, fontSize: 20 }}>{(user.name || user.identifier).slice(0, 1).toUpperCase()}</span>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{user.name || 'Unnamed user'}</h1>
            <p className="page-sub" style={{ margin: 0 }}>{user.identifier} · joined {new Date(user.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="label">Boxes opened</div><div className="value">{opened}</div></div>
        <div className="kpi"><div className="label">Rewards won</div><div className="value">{user.rewards.length}</div></div>
        <div className="kpi"><div className="label">Redeemed</div><div className="value">{redeemed}</div></div>
        <div className="kpi"><div className="label">Activity events</div><div className="value">{user.events.length}</div></div>
      </div>

      <div className="grid-2">
        {/* Won vouchers with status */}
        <div className="card">
          <div className="section-title">Won vouchers</div>
          <table>
            <thead><tr><th>Reward</th><th>Code</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {user.rewards.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.title}</strong>{r.value ? <span className="muted"> · {r.value}</span> : ''}
                    <div className="muted" style={{ fontSize: 12 }}>{new Date(r.issued_at).toLocaleDateString()}{r.expires_at ? ` → exp ${new Date(r.expires_at).toLocaleDateString()}` : ''}</div>
                  </td>
                  <td>{r.code ? <code>{r.code}</code> : <span className="muted">—</span>}</td>
                  <td><span className={`chip ${r.status === 'redeemed' ? 'green' : r.status === 'expired' ? 'red' : 'amber'}`}>{r.status}</span></td>
                  <td>
                    {r.status === 'issued' ? (
                      <div className="row">
                        <button className="btn sm" onClick={() => setRewardStatus(r.id, 'redeemed')}>Redeem</button>
                        <button className="btn ghost sm" onClick={() => setRewardStatus(r.id, 'expired')}>Expire</button>
                      </div>
                    ) : r.status === 'expired' ? (
                      <button className="btn ghost sm" onClick={() => setRewardStatus(r.id, 'issued')}>Reinstate</button>
                    ) : <span className="muted" style={{ fontSize: 12 }}>{r.redeemed_at ? new Date(r.redeemed_at).toLocaleDateString() : 'done'}</span>}
                  </td>
                </tr>
              ))}
              {!user.rewards.length && <tr><td colSpan={4} className="muted">No rewards won yet.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Activity timeline */}
        <div className="card">
          <div className="section-title">Activity</div>
          <div className="activity">
            {user.events.map((ev) => (
              <div key={ev.id} className="activity-item">
                <span className="avatar">{EVENT_ICON[ev.type] || '•'}</span>
                <div>
                  <div><span className="who" style={{ textTransform: 'capitalize' }}>{ev.type}</span> · {ev.campaign_name} <span className="muted">Day {ev.drop_index}</span></div>
                  {ev.meta?.result && <div className="muted" style={{ fontSize: 12 }}>{ev.meta.result}{ev.meta.code ? ` · ${ev.meta.code}` : ''}</div>}
                </div>
                <span className="when">{new Date(ev.created_at).toLocaleString()}</span>
              </div>
            ))}
            {!user.events.length && <div className="muted">No activity recorded.</div>}
          </div>
        </div>
      </div>

      {/* Box ledger */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title">Boxes</div>
        <table>
          <thead><tr><th>Campaign</th><th>Drop</th><th>Status</th><th>Opened</th></tr></thead>
          <tbody>
            {user.boxes.map((b) => (
              <tr key={b.id}>
                <td>{b.campaign_name}</td>
                <td>Day {b.drop_index} <span className="muted">{b.drop_title}</span></td>
                <td><span className={`chip ${b.status === 'opened' ? 'green' : b.status === 'missed' ? 'red' : b.status === 'available' ? 'purple' : ''}`}>{b.status}</span></td>
                <td className="muted">{b.opened_at ? new Date(b.opened_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
            {!user.boxes.length && <tr><td colSpan={4} className="muted">No boxes.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
