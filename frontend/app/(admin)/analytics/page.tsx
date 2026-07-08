'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type PerDrop = { drop_index: number; title: string; available: number; opened: number; missed: number; open_rate: number };
type Analytics = {
  daily_opens: { day: string; opens: number }[];
  reward_distribution: { title: string; type: string; claimed: number }[];
  per_drop: PerDrop[];
  redemption_funnel: { issued: number; redeemed: number; expired: number };
};
type Campaign = { id: number; name: string };

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaign, setCampaign] = useState<string>('');
  const [err, setErr] = useState('');

  async function load() {
    try {
      const q = campaign ? `?campaign=${campaign}` : '';
      const d = await api<Analytics>(`/api/admin/analytics${q}`, { admin: true });
      setData(d);
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => {
    api<{ campaigns: Campaign[] }>('/api/admin/campaigns', { admin: true }).then((r) => setCampaigns(r.campaigns)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [campaign]);

  function exportCsv() {
    if (!data) return;
    const rows = [['Drop', 'Available', 'Opened', 'Missed', 'Open Rate %']];
    data.per_drop.forEach((p) => rows.push([p.title, String(p.available), String(p.opened), String(p.missed), String(p.open_rate)]));
    const csv = rows.map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'dropzone-analytics.csv'; a.click();
  }

  const f = data?.redemption_funnel;
  return (
    <>
      <div className="toolbar">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-sub" style={{ margin: 0 }}>Per-drop performance and redemption funnel.</p>
        </div>
        <div className="spacer" />
        <select value={campaign} onChange={(e) => setCampaign(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All campaigns</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn secondary" onClick={exportCsv}>Export CSV</button>
      </div>
      {err && <div className="err">{err}</div>}

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="label">Issued</div><div className="value">{f?.issued ?? 0}</div></div>
        <div className="kpi"><div className="label">Redeemed</div><div className="value">{f?.redeemed ?? 0}</div></div>
        <div className="kpi"><div className="label">Expired</div><div className="value">{f?.expired ?? 0}</div></div>
      </div>

      <div className="card">
        <div className="section-title">Per-drop performance</div>
        <table>
          <thead><tr><th>Drop</th><th>Available</th><th>Opened</th><th>Missed</th><th>Open Rate</th></tr></thead>
          <tbody>
            {(data?.per_drop || []).map((p) => (
              <tr key={p.drop_index}>
                <td>{p.title}</td><td>{p.available}</td><td>{p.opened}</td><td>{p.missed}</td>
                <td><span className="chip purple">{p.open_rate}%</span></td>
              </tr>
            ))}
            {!data?.per_drop.length && <tr><td colSpan={5} className="muted">No data yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
