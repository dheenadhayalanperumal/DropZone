'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Settings = {
  mode: string; phone_number_id?: string; access_token?: string;
  verify_token?: string; business_acct_id?: string;
};
type Template = { id: number; name: string; language?: string; category?: string; body: string; status: string };
type User = { id: number; name: string; identifier: string };
type Message = {
  id: number; template_name: string | null; body: string; audience: string;
  recipients: number; status: string; sent_by: string | null; created_at: string;
};

export default function WhatsAppPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [nt, setNt] = useState({ name: '', category: 'MARKETING', body: '' });
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [audience, setAudience] = useState<number[]>([]);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof Settings, v: any) => setSettings((s) => (s ? { ...s, [k]: v } : s));

  async function loadTemplates() {
    const d = await api<{ templates: Template[] }>('/api/admin/whatsapp/templates', { admin: true });
    setTemplates(d.templates);
  }
  async function loadMessages() {
    const d = await api<{ messages: Message[] }>('/api/admin/whatsapp/messages', { admin: true });
    setMessages(d.messages);
  }
  useEffect(() => {
    api<Settings>('/api/admin/whatsapp/settings', { admin: true }).then(setSettings).catch((e) => setErr(e.message));
    loadTemplates().catch((e) => setErr(e.message));
    loadMessages().catch((e) => setErr(e.message));
    api<{ users: User[] }>('/api/admin/users', { admin: true }).then((d) => setUsers(d.users)).catch(() => {});
  }, []);

  async function saveSettings() {
    if (!settings) return;
    setErr(''); setSaved(false);
    try {
      await api('/api/admin/whatsapp/settings', { method: 'PUT', admin: true, body: JSON.stringify(settings) });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e: any) { setErr(e.message); }
  }
  async function createTemplate() {
    if (!nt.name.trim() || !nt.body.trim()) { setErr('Template name and body are required'); return; }
    setErr('');
    try {
      await api('/api/admin/whatsapp/templates', { method: 'POST', admin: true, body: JSON.stringify(nt) });
      setNt({ name: '', category: 'MARKETING', body: '' });
      await loadTemplates();
    } catch (e: any) { setErr(e.message); }
  }
  async function setStatus(id: number, status: string) {
    setErr('');
    try {
      await api(`/api/admin/whatsapp/templates/${id}`, { method: 'PATCH', admin: true, body: JSON.stringify({ status }) });
      setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
    } catch (e: any) { setErr(e.message); }
  }
  async function send() {
    if (!selectedTemplate) { setErr('Select an approved template to send'); return; }
    setErr(''); setSending(true);
    try {
      const r = await api<{ recipients: number; status: string; audience: string }>(
        '/api/admin/whatsapp/broadcast',
        { method: 'POST', admin: true, body: JSON.stringify({ template_id: Number(selectedTemplate), user_ids: audience }) },
      );
      await loadMessages();
      setSelectedTemplate(''); setAudience([]);
      alert(`${r.status === 'sent' ? 'Sent' : 'Simulated'} to ${r.recipients} recipient(s) · ${r.audience}`);
    } catch (e: any) { setErr(e.message); }
    finally { setSending(false); }
  }

  if (!settings) return <div className="muted">Loading…</div>;
  const approved = templates.filter((t) => t.status === 'approved');
  const configured = !!settings.phone_number_id;

  return (
    <>
      <div className="toolbar">
        <div>
          <h1 className="page-title">WhatsApp</h1>
          <p className="page-sub" style={{ margin: 0 }}>Connect the WhatsApp Business API, manage templates and run promotions.</p>
        </div>
        <div className="spacer" />
        <span className={`chip ${settings.mode === 'live' ? 'green' : 'amber'}`}>{settings.mode === 'live' ? 'Live' : 'Simulation'}</span>
        <span className={`chip ${configured ? 'green' : ''}`}>{configured ? 'Connected' : 'Not connected'}</span>
      </div>
      {err && <div className="err">{err}</div>}

      <div className="grid-2">
        {/* Connection */}
        <div className="card">
          <div className="section-title">API connection</div>
          <label className="field"><span>Mode</span>
            <select value={settings.mode} onChange={(e) => set('mode', e.target.value)}>
              <option value="simulation">Simulation (no live messages)</option>
              <option value="live">Live</option>
            </select>
          </label>
          <label className="field"><span>Phone number ID</span><input value={settings.phone_number_id || ''} onChange={(e) => set('phone_number_id', e.target.value)} placeholder="1234567890" /></label>
          <label className="field"><span>Access token</span><input type="password" value={settings.access_token || ''} onChange={(e) => set('access_token', e.target.value)} placeholder="EAAB…" /></label>
          <label className="field"><span>Verify token</span><input value={settings.verify_token || ''} onChange={(e) => set('verify_token', e.target.value)} /></label>
          <label className="field"><span>Business account ID</span><input value={settings.business_acct_id || ''} onChange={(e) => set('business_acct_id', e.target.value)} /></label>
          <div className="row">
            <button className="btn" onClick={saveSettings}>Save connection</button>
            {saved && <span className="chip green">Saved ✓</span>}
          </div>
        </div>

        {/* Create template */}
        <div className="card">
          <div className="section-title">Create template</div>
          <label className="field"><span>Template name</span><input value={nt.name} onChange={(e) => setNt({ ...nt, name: e.target.value })} placeholder="daily_drop_reminder" /></label>
          <label className="field"><span>Category</span>
            <select value={nt.category} onChange={(e) => setNt({ ...nt, category: e.target.value })}>
              <option value="MARKETING">Marketing</option>
              <option value="UTILITY">Utility</option>
              <option value="AUTHENTICATION">Authentication</option>
            </select>
          </label>
          <label className="field"><span>Body</span><textarea rows={4} value={nt.body} onChange={(e) => setNt({ ...nt, body: e.target.value })} placeholder="Your box for today is live! Tap to open before midnight 🎁" /></label>
          <button className="btn" onClick={createTemplate}>+ Add template</button>
        </div>
      </div>

      {/* Templates list w/ approval */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title">Templates &amp; approval</div>
        <table>
          <thead><tr><th>Name</th><th>Category</th><th>Body</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong></td>
                <td className="muted">{t.category || 'MARKETING'}</td>
                <td className="muted" style={{ maxWidth: 320 }}>{t.body}</td>
                <td><span className={`chip ${t.status === 'approved' ? 'green' : t.status === 'rejected' ? 'red' : 'amber'}`}>{t.status}</span></td>
                <td>
                  <div className="row">
                    {t.status !== 'approved' && <button className="btn sm" onClick={() => setStatus(t.id, 'approved')}>Approve</button>}
                    {t.status !== 'rejected' && <button className="btn ghost sm" onClick={() => setStatus(t.id, 'rejected')}>Reject</button>}
                  </div>
                </td>
              </tr>
            ))}
            {!templates.length && <tr><td colSpan={5} className="muted">No templates yet — create one above.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Promotion / broadcast */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title">Send promotion</div>
        <div className="grid-2">
          <label className="field"><span>Approved template</span>
            <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
              <option value="">Select a template…</option>
              {approved.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Recipients ({audience.length ? `${audience.length} selected` : 'all users'})</span>
            <select multiple value={audience.map(String)} style={{ height: 132 }}
              onChange={(e) => setAudience(Array.from(e.target.selectedOptions, (o) => Number(o.value)))}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.identifier} · {u.identifier}</option>)}
            </select>
          </label>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '0 0 12px' }}>Leave recipients empty to send to all enrolled users. Opt-outs are excluded automatically.</p>
        <button className="btn" onClick={send} disabled={sending || !approved.length}>{sending ? 'Sending…' : 'Send promotion'}</button>
        {!approved.length && <span className="muted" style={{ marginLeft: 12, fontSize: 13 }}>Approve a template first.</span>}
      </div>

      {/* Sent history */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title">Sent messages</div>
        <table>
          <thead><tr><th>When</th><th>Template</th><th>Audience</th><th>Recipients</th><th>Status</th><th>By</th></tr></thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id}>
                <td className="muted">{new Date(m.created_at).toLocaleString()}</td>
                <td>{m.template_name || <span className="muted">custom</span>}</td>
                <td>{m.audience}</td>
                <td>{m.recipients}</td>
                <td><span className={`chip ${m.status === 'sent' ? 'green' : m.status === 'failed' ? 'red' : 'amber'}`}>{m.status}</span></td>
                <td className="muted">{m.sent_by || '—'}</td>
              </tr>
            ))}
            {!messages.length && <tr><td colSpan={6} className="muted">No promotions sent yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
