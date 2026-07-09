'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import DatePicker from '@/components/DatePicker';

type Campaign = {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string | null;
  duration_days: number;
  custom_duration_days: number | null;
  grace_hours: number;
  timezone: string;
  type: string;
  active: number;
  drop_count?: number;
  enrolled?: number;
};

export default function CampaignEditPage() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  useEffect(() => {
    if (!id) return;
    async function fetchCampaign() {
      try {
        const data = await api<{ campaign: Campaign } | Campaign>(`/api/admin/campaigns/${id}`, { admin: true });
        setCampaign('campaign' in data ? data.campaign : data);
      } catch (err) {
        setError('Failed to fetch campaign details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchCampaign();
  }, [id]);

  const handleSave = async () => {
    if (!campaign) return;
    setError(null);
    try {
      await api(`/api/admin/campaigns/${id}`, { method: 'PUT', admin: true, body: JSON.stringify(campaign) });
      setSaved(true);
      setTimeout(() => { setSaved(false); router.push('/campaigns'); }, 1000);
    } catch (err) {
      setError('Failed to update campaign.');
      console.error(err);
    }
  };

  const set = (k: keyof Campaign, v: any) => setCampaign((s) => (s ? { ...s, [k]: v } : s));

  if (loading) return <div className="muted">Loading…</div>;
  if (error)   return <div className="err">{error}</div>;
  if (!campaign) return <div className="muted">Campaign not found.</div>;

  return (
    <div>
      <div className="toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>Edit Campaign</h1>
        <div className="spacer" />
        {campaign.drop_count != null && <span className="chip">{campaign.drop_count} drops</span>}
        {campaign.enrolled  != null && <span className="chip purple">{campaign.enrolled} enrolled</span>}
      </div>

      <div className="card">
        <label className="field"><span>Name</span>
          <input value={campaign.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label className="field"><span>Description</span>
          <textarea value={campaign.description} onChange={(e) => set('description', e.target.value)} />
        </label>

        <div className="grid-2">
          <label className="field"><span>Start Date</span>
            <DatePicker value={(campaign.start_date ?? '').split('T')[0]} onChange={(v) => set('start_date', v)} />
          </label>
          <label className="field"><span>End Date</span>
            <DatePicker value={(campaign.end_date ?? '').split('T')[0]} onChange={(v) => set('end_date', v)} />
          </label>
        </div>

        <div className="grid-2">
          <label className="field"><span>Cadence</span>
            <select value={campaign.type} onChange={(e) => set('type', e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="field"><span>Duration (days)</span>
            <input type="number" min={1} value={campaign.duration_days || campaign.custom_duration_days || ''} onChange={(e) => set('duration_days', Number(e.target.value))} />
          </label>
        </div>

        <div className="grid-2">
          <label className="field"><span>Grace hours (box stays open N hours past period)</span>
            <input type="number" min={0} value={campaign.grace_hours ?? 0} onChange={(e) => set('grace_hours', Number(e.target.value))} />
          </label>
          <label className="field"><span>Timezone</span>
            <input value={campaign.timezone ?? 'UTC'} onChange={(e) => set('timezone', e.target.value)} placeholder="UTC" />
          </label>
        </div>

        <label className="field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <input type="checkbox" checked={!!campaign.active} onChange={(e) => set('active', e.target.checked ? 1 : 0)} style={{ width: 'auto' }} />
          <span style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Active (visible to customers)</span>
        </label>

        {error && <div className="err">{error}</div>}
        <div className="row">
          <button className="btn ghost" onClick={() => router.push('/campaigns')}>Cancel</button>
          <button className="btn" onClick={handleSave}>Save changes</button>
          {saved && <span className="chip green">Saved ✓</span>}
        </div>
      </div>
    </div>
  );
}
