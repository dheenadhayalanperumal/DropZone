'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import DatePicker from '@/components/DatePicker';

type Campaign = {
  id: number; name: string; description?: string; type: string; duration_days: number;
  custom_duration_days?: number | null; grace_hours: number; timezone: string;
  start_date: string; end_date?: string; active: number; drop_count?: number; enrolled?: number;
};
type Drop = {
  id: number; drop_index: number; period_index: number; reward_id: number | null;
  title: string; open_at: string; close_at: string;
  reward_title?: string; reward_type?: string;
};
type Voucher = { id: number; title: string; type: string; image?: string | null };

export default function CalendarPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editDrop, setEditDrop] = useState<Drop | null>(null);
  const [err, setErr] = useState('');

  async function loadCampaigns() {
    const res = await api<{ campaigns: Campaign[] }>('/api/admin/campaigns', { admin: true });
    setCampaigns(res.campaigns);
    if (!selected && res.campaigns.length) setSelected(res.campaigns[0].id);
  }
  async function loadDrops(id: number) {
    const res = await api<{ drops: Drop[] }>(`/api/admin/campaigns/${id}/drops`, { admin: true });
    setDrops(res.drops);
  }
  useEffect(() => {
    (async () => {
      try {
        await loadCampaigns();
        const v = await api<{ vouchers: Voucher[] }>('/api/admin/vouchers', { admin: true });
        setVouchers(v.vouchers);
      } catch (e: any) { setErr(e.message); }
    })();
  }, []);
  useEffect(() => { if (selected) loadDrops(selected); }, [selected]);

  const now = Date.now();
  const campaign = campaigns.find((c) => c.id === selected);

  return (
    <>
      <div className="toolbar">
        <div>
          <h1 className="page-title">Drop Calendar</h1>
          <p className="page-sub" style={{ margin: 0 }}>Schedule campaigns and place a reward on each drop.</p>
        </div>
        <div className="spacer" />
        <select value={selected ?? ''} onChange={(e) => setSelected(Number(e.target.value))} style={{ width: 'auto' }}>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn" onClick={() => setShowNew(true)}>+ New campaign</button>
      </div>
      {err && <div className="err">{err}</div>}

      {campaign && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row" style={{ flexWrap: 'wrap', gap: 24 }}>
            <Meta label="Cadence" value={campaign.type} />
            <Meta label="Duration" value={`${campaign.duration_days || campaign.custom_duration_days} days`} />
            <Meta label="Drops" value={String(drops.length)} />
            <Meta label="Grace" value={`${campaign.grace_hours}h`} />
            <Meta label="Starts" value={campaign.start_date} />
            <Meta label="Ends" value={campaign.end_date || '—'} />
            <Meta label="Enrolled" value={String(campaign.enrolled ?? 0)} />
            <div className="spacer" />
            <span className={`chip ${campaign.active ? 'green' : ''}`}>{campaign.active ? 'active' : 'inactive'}</span>
            <Link className="btn secondary sm" href={`/campaigns/${campaign.id}`}>Edit campaign</Link>
          </div>
          {campaign.description && <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>{campaign.description}</p>}
        </div>
      )}

      <div className="card">
        <div className="section-title">Calendar</div>
        <div className="cal-grid">
          {drops.map((d) => {
            const open = new Date(d.open_at).getTime();
            const close = new Date(d.close_at).getTime();
            const isToday = now >= open && now <= close;
            const isPast = now > close;
            return (
              <div
                key={d.id}
                className={`cell ${d.reward_id ? 'filled' : ''} ${isToday ? 'today' : ''} ${isPast ? 'past' : ''}`}
                onClick={() => setEditDrop(d)}
                title={`${d.title} — ${new Date(d.open_at).toLocaleDateString()}`}
              >
                <span className="box-emoji">{d.reward_id ? '🎁' : '📦'}</span>
                <span className="idx">{d.title}</span>
                {d.reward_title && <span className="reward">{d.reward_title}</span>}
              </div>
            );
          })}
          {!drops.length && <div className="muted">No drops. Create a campaign first.</div>}
        </div>
      </div>

      {showNew && <CampaignForm onClose={() => setShowNew(false)} onSaved={async (id) => { setShowNew(false); await loadCampaigns(); setSelected(id); }} />}
      {editDrop && (
        <DropForm
          drop={editDrop}
          vouchers={vouchers}
          onClose={() => setEditDrop(null)}
          onSaved={async () => { setEditDrop(null); if (selected) loadDrops(selected); }}
        />
      )}
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{value}</div>
    </div>
  );
}

function CampaignForm({ onClose, onSaved }: { onClose: () => void; onSaved: (id: number) => void }) {
  const [f, setF] = useState<any>({ name: '', type: 'daily', duration_days: 30, grace_hours: 0, timezone: 'UTC', start_date: new Date().toISOString().slice(0, 10), active: true });
  const [err, setErr] = useState('');
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));
  async function save() {
    setErr('');
    try {
      const body: any = { ...f, duration_days: Number(f.duration_days) };
      if (f.duration_days === 'custom') { body.duration_days = 0; body.custom_duration_days = Number(f.custom_duration_days || 0); }
      const res = await api<{ id: number }>('/api/admin/campaigns', { method: 'POST', admin: true, body: JSON.stringify(body) });
      onSaved(res.id);
    } catch (e: any) { setErr(e.message); }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">New campaign</div>
        <label className="field"><span>Name</span><input value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label className="field"><span>Description</span><input value={f.description || ''} onChange={(e) => set('description', e.target.value)} /></label>
        <div className="grid-2">
          <label className="field"><span>Cadence</span>
            <select value={f.type} onChange={(e) => set('type', e.target.value)}>
              <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="field"><span>Duration (days)</span>
            <select value={f.duration_days} onChange={(e) => set('duration_days', e.target.value)}>
              {[7, 14, 30, 90, 365].map((d) => <option key={d} value={d}>{d}</option>)}
              <option value="custom">Custom…</option>
            </select>
          </label>
        </div>
        {f.duration_days === 'custom' && (
          <label className="field"><span>Custom days</span><input type="number" value={f.custom_duration_days || ''} onChange={(e) => set('custom_duration_days', e.target.value)} /></label>
        )}
        <div className="grid-2">
          <label className="field"><span>Start date</span><DatePicker value={f.start_date} onChange={(v) => set('start_date', v)} /></label>
          <label className="field"><span>Grace hours</span><input type="number" value={f.grace_hours} onChange={(e) => set('grace_hours', e.target.value)} /></label>
        </div>
        <label className="field"><span>Timezone</span><input value={f.timezone} onChange={(e) => set('timezone', e.target.value)} /></label>
        {err && <div className="err">{err}</div>}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Create &amp; generate drops</button>
        </div>
      </div>
    </div>
  );
}

function DropForm({ drop, vouchers, onClose, onSaved }: { drop: Drop; vouchers: Voucher[]; onClose: () => void; onSaved: () => void }) {
  const [rewardId, setRewardId] = useState<string>(drop.reward_id ? String(drop.reward_id) : '');
  const [title, setTitle] = useState(drop.title);
  const [err, setErr] = useState('');
  async function save() {
    setErr('');
    try {
      await api(`/api/admin/drops/${drop.id}`, {
        method: 'PUT', admin: true,
        body: JSON.stringify({ reward_id: rewardId === '' ? null : Number(rewardId), title }),
      });
      onSaved();
    } catch (e: any) { setErr(e.message); }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">{drop.title}</div>
        <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
          Opens {new Date(drop.open_at).toLocaleString()} → closes {new Date(drop.close_at).toLocaleString()}
        </p>
        <label className="field"><span>Box title</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="field"><span>Reward inside</span>
          <select value={rewardId} onChange={(e) => setRewardId(e.target.value)}>
            <option value="">— empty (no reward) —</option>
            {vouchers.map((v) => <option key={v.id} value={v.id}>{v.title} ({v.type})</option>)}
          </select>
        </label>
        {err && <div className="err">{err}</div>}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Save drop</button>
        </div>
      </div>
    </div>
  );
}
