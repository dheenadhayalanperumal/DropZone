'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Stats = {
  registered_users: number; boxes_opened: number; rewards_claimed: number;
  open_rate: number; missed_drops: number; completion_rate: number;
};
type Activity = {
  id: number; type: string; meta: any; created_at: string;
  user_name: string; identifier: string; drop_index: number; campaign_name: string;
};
type Analytics = {
  daily_opens: { day: string; opens: number }[];
  reward_distribution: { title: string; type: string; claimed: number }[];
};

const KPIS: { key: keyof Stats; label: string; suffix?: string }[] = [
  { key: 'registered_users', label: 'Registered Users' },
  { key: 'boxes_opened', label: 'Boxes Opened' },
  { key: 'rewards_claimed', label: 'Rewards Claimed' },
  { key: 'open_rate', label: 'Open Rate', suffix: '%' },
  { key: 'missed_drops', label: 'Missed Drops' },
  { key: 'completion_rate', label: 'Completion Rate', suffix: '%' },
];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [s, a, act] = await Promise.all([
          api<Stats>('/api/admin/stats', { admin: true }),
          api<Analytics>('/api/admin/analytics', { admin: true }),
          api<{ activity: Activity[] }>('/api/admin/activity', { admin: true }),
        ]);
        setStats(s); setAnalytics(a); setActivity(act.activity);
      } catch (e: any) { setErr(e.message); }
    })();
  }, []);

  if (err) return <div className="err">{err}</div>;

  const maxOpens = Math.max(1, ...(analytics?.daily_opens.map((d) => d.opens) || [1]));
  const maxReward = Math.max(1, ...(analytics?.reward_distribution.map((d) => d.claimed) || [1]));

  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-sub">Live engagement across your drop campaigns.</p>

      <div className="kpi-grid">
        {KPIS.map((k) => (
          <div className="kpi" key={k.key}>
            <div className="label">{k.label}</div>
            <div className="value">
              {stats ? stats[k.key] : '—'}{k.suffix || ''}
            </div>
            <div className="delta up">▲ live</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="section-title">Daily Opens</div>
          <div className="bars">
            {(analytics?.daily_opens || []).slice(-14).map((d) => (
              <div className="bar-col" key={d.day}>
                <div className="bar" style={{ height: `${(d.opens / maxOpens) * 100}%` }} title={`${d.opens}`} />
                <div className="bar-label">{d.day.slice(5)}</div>
              </div>
            ))}
            {!analytics?.daily_opens.length && <div className="muted">No opens yet.</div>}
          </div>
        </div>

        <div className="card">
          <div className="section-title">Reward Distribution</div>
          <div className="bars">
            {(analytics?.reward_distribution || []).map((r) => (
              <div className="bar-col" key={r.title}>
                <div className="bar alt" style={{ height: `${(r.claimed / maxReward) * 100}%` }} title={`${r.claimed}`} />
                <div className="bar-label">{r.title.slice(0, 8)}</div>
              </div>
            ))}
            {!analytics?.reward_distribution.length && <div className="muted">No rewards claimed yet.</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Recent Activity</div>
        <div className="activity">
          {activity.map((a) => (
            <ActivityRow key={a.id} a={a} />
          ))}
          {!activity.length && <div className="muted">No activity yet.</div>}
        </div>
      </div>
    </>
  );
}

function ActivityRow({ a }: { a: Activity }) {
  const name = a.user_name || a.identifier;
  let body: React.ReactNode;
  if (a.type === 'open') {
    body = <><strong>Day {a.drop_index} Box Opened</strong></>;
  } else if (a.type === 'miss') {
    body = <span className="muted"><strong>Missed Day {a.drop_index}</strong></span>;
  } else if (a.type === 'complete') {
    body = <><strong>Completed Campaign</strong> 🎉</>;
  } else {
    body = <>{a.type}</>;
  }
  return (
    <div className="activity-item">
      <div className="avatar">👤</div>
      <div>
        <span className="who">{name}</span> · {body}
      </div>
      <span className="when">{new Date(a.created_at).toLocaleString()}</span>
    </div>
  );
}
