'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type User = {
  id: number; name: string | null; identifier: string;
  created_at: string; campaigns: number; rewards: number;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const router = useRouter();

  useEffect(() => {
    api<{ users: User[] }>('/api/admin/users', { admin: true })
      .then((d) => setUsers(d.users))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter((u) =>
    (u.name || '').toLowerCase().includes(q.toLowerCase()) ||
    u.identifier.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="toolbar">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-sub" style={{ margin: 0 }}>Everyone enrolled across your campaigns. Click a row for full activity.</p>
        </div>
        <div className="spacer" />
        <input placeholder="Search name or mobile…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
      </div>
      {err && <div className="err">{err}</div>}

      <div className="card">
        <table>
          <thead>
            <tr><th>User</th><th>Identifier</th><th>Registered</th><th>Campaigns</th><th>Rewards</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/users/${u.id}`)}>
                <td>
                  <div className="row">
                    <span className="avatar">{(u.name || u.identifier).slice(0, 1).toUpperCase()}</span>
                    <strong>{u.name || 'Unnamed'}</strong>
                  </div>
                </td>
                <td className="muted">{u.identifier}</td>
                <td className="muted">{new Date(u.created_at).toLocaleDateString()}</td>
                <td>{u.campaigns}</td>
                <td>{u.rewards > 0 ? <span className="chip purple">{u.rewards}</span> : <span className="muted">0</span>}</td>
                <td className="muted">›</td>
              </tr>
            ))}
            {!loading && !filtered.length && <tr><td colSpan={6} className="muted">No users found.</td></tr>}
            {loading && <tr><td colSpan={6} className="muted">Loading…</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
