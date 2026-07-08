'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';

type Campaign = {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  type: string;
  active: number;
};

export default function CampaignEditPage() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  useEffect(() => {
    if (!id) return;
    async function fetchCampaign() {
      try {
        const data = await api<Campaign>(`/api/admin/campaigns/${id}`, { admin: true });
        setCampaign(data);
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
    try {
      await api(`/api/admin/campaigns/${id}`, { method: 'PUT', admin: true, body: JSON.stringify(campaign) });
      router.push('/campaigns');
    } catch (err) {
      setError('Failed to update campaign.');
      console.error(err);
    }
  };
  
  const set = (k: keyof Campaign, v: any) => setCampaign((s) => (s ? { ...s, [k]: v } : s));

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }
  
  if (!campaign) {
    return <div>Campaign not found.</div>;
  }

  return (
    <div>
      <h1>Edit Campaign</h1>
      <div className="card">
        <label className="field"><span>Name</span><input value={campaign.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label className="field"><span>Description</span><textarea value={campaign.description} onChange={(e) => set('description', e.target.value)} /></label>
        <label className="field"><span>Start Date</span><input type="date" value={campaign.start_date.split('T')[0]} onChange={(e) => set('start_date', e.target.value)} /></label>
        <label className="field"><span>End Date</span><input type="date" value={campaign.end_date.split('T')[0]} onChange={(e) => set('end_date', e.target.value)} /></label>
        <label className="field">
          <span>Type</span>
          <select value={campaign.type} onChange={(e) => set('type', e.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label className="field">
          <span>Active</span>
          <input type="checkbox" checked={!!campaign.active} onChange={(e) => set('active', e.target.checked ? 1 : 0)} />
        </label>
        <button className="btn" onClick={handleSave}>Save</button>
      </div>
    </div>
  );
}
