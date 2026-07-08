'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';

type Campaign = {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  type?: string;
  active: number;
};

type CampaignApiResponse = {
  campaigns: Campaign[];
};

export default function CampaignsPage() {
  const searchParams = useSearchParams();
  const isNew = searchParams.get('new');

  if (isNew) {
    return <CampaignCreate />;
  }

  return <CampaignList />;
}

function CampaignList() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const data = await api<CampaignApiResponse>('/api/admin/campaigns', { admin: true });
        setCampaigns(data.campaigns);
      } catch (err) {
        setError('Failed to fetch campaigns.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchCampaigns();
  }, []);

  const handleEdit = (id: number) => {
    router.push(`/campaigns/${id}`);
  };

  const handleCreate = () => {
    router.push('/campaigns?new=1');
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this campaign?')) {
      try {
        await api(`/api/admin/campaigns/${id}`, { method: 'DELETE', admin: true });
        setCampaigns(campaigns.filter(c => c.id !== id));
      } catch (err) {
        setError('Failed to delete campaign.');
        console.error(err);
      }
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h1>Campaigns</h1>
      <button className="btn" onClick={handleCreate}>Create Campaign</button>
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Description</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id}>
              <td>{campaign.id}</td>
              <td>{campaign.name}</td>
              <td>{campaign.description}</td>
              <td>{new Date(campaign.start_date).toLocaleDateString()}</td>
              <td>{campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : ''}</td>
              <td>{campaign.active ? 'Yes' : 'No'}</td>
              <td>
                <button className="btn btn-sm" onClick={() => handleEdit(campaign.id)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(campaign.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignCreate() {
  const [campaign, setCampaign] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    type: 'daily',
    active: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSave = async () => {
    setLoading(true);
    try {
      await api('/api/admin/campaigns', { method: 'POST', admin: true, body: JSON.stringify(campaign) });
      router.push('/campaigns');
    } catch (err) {
      setError('Failed to create campaign.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const set = (k: keyof Campaign, v: any) => setCampaign((s) => (s ? { ...s, [k]: v } : s));

  return (
    <div>
      <h1>Create Campaign</h1>
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
        <button className="btn" onClick={handleSave} disabled={loading}>
          {loading ? 'Creating...' : 'Create'}
        </button>
        {error && <div className="err">{error}</div>}
      </div>
    </div>
  );
}
