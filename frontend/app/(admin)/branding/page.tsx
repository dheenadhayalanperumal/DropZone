'use client';
import { useEffect, useRef, useState } from 'react';
import { api, API_BASE } from '@/lib/api';

type Brand = {
  name: string; tagline?: string; logo?: string; primary_color: string; accent_color: string; background_color: string;
  reveal_style: string; welcome_headline: string; opened_message: string; missed_message: string;
  box_closed_image?: string; box_opened_image?: string; box_missed_image?: string;
};

export default function BrandingPage() {
  const [b, setB] = useState<Brand | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof Brand, v: any) => setB((s) => (s ? { ...s, [k]: v } : s));

  useEffect(() => {
    api<Brand>('/api/admin/brand', { admin: true }).then(setB).catch((e) => setErr(e.message));
  }, []);

  async function save() {
    if (!b) return;
    setErr(''); setSaved(false);
    try {
      await api('/api/admin/brand', { method: 'PUT', admin: true, body: JSON.stringify(b) });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e: any) { setErr(e.message); }
  }

  async function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(''); setUploading(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(new Error('Could not read file'));
        r.readAsDataURL(file);
      });
      const { url } = await api<{ url: string }>('/api/admin/upload', {
        method: 'POST', admin: true, body: JSON.stringify({ data: dataUrl, filename: file.name }),
      });
      set('logo', API_BASE + url);
    } catch (e: any) { setErr(e.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  if (!b) return <div className="muted">Loading…</div>;

  const states = [
    { key: 'locked', emoji: '🔒', label: 'Locked', cls: 'locked' },
    { key: 'available', emoji: '🎁', label: 'Available', cls: 'available' },
    { key: 'opened', emoji: '✅', label: 'Opened', cls: 'opened' },
    { key: 'missed', emoji: '⌛', label: 'Missed', cls: 'missed' },
  ];

  return (
    <>
      <h1 className="page-title">Brand Profile</h1>
      <p className="page-sub">Style the customer-facing drop experience.</p>

      <div className="grid-2">
        <div className="card">
          <div className="section-title">Identity</div>
          <label className="field"><span>Brand name</span><input value={b.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label className="field"><span>Tagline</span><input value={b.tagline || ''} placeholder="A new box drops every day" onChange={(e) => set('tagline', e.target.value)} /></label>

          {/* Logo — file upload + preview + URL */}
          <div className="field">
            <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>Logo</span>
            <div className="row" style={{ marginBottom: 8 }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', overflow: 'hidden', flex: '0 0 auto' }}>
                {b.logo ? <img src={b.logo} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span className="muted" style={{ fontSize: 11 }}>none</span>}
              </div>
              <button type="button" className="btn secondary sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload logo'}
              </button>
              {b.logo && <button type="button" className="btn ghost sm" onClick={() => set('logo', '')}>Remove</button>}
              <input ref={fileRef} type="file" accept="image/*" onChange={onLogoFile} style={{ display: 'none' }} />
            </div>
            <input value={b.logo || ''} onChange={(e) => set('logo', e.target.value)} placeholder="…or paste an image URL" />
          </div>

          {/* Colors — picker + synced hex input */}
          <div className="grid-3">
            <ColorField label="Primary" value={b.primary_color} onChange={(v) => set('primary_color', v)} />
            <ColorField label="Accent" value={b.accent_color} onChange={(v) => set('accent_color', v)} />
            <ColorField label="Background" value={b.background_color} onChange={(v) => set('background_color', v)} />
          </div>

          <label className="field"><span>Reveal animation</span>
            <select value={b.reveal_style} onChange={(e) => set('reveal_style', e.target.value)}>
              <option value="unwrap">unwrap</option><option value="flip">flip</option><option value="confetti">confetti</option>
            </select>
          </label>
          <div className="section-title" style={{ marginTop: 12 }}>Copy</div>
          <label className="field"><span>Welcome headline</span><input value={b.welcome_headline} onChange={(e) => set('welcome_headline', e.target.value)} /></label>
          <label className="field"><span>Opened message</span><input value={b.opened_message} onChange={(e) => set('opened_message', e.target.value)} /></label>
          <label className="field"><span>Missed message</span><input value={b.missed_message} onChange={(e) => set('missed_message', e.target.value)} /></label>
          {err && <div className="err">{err}</div>}
          <div className="row">
            <button className="btn" onClick={save}>Save branding</button>
            {saved && <span className="chip green">Saved ✓</span>}
          </div>
        </div>

        <div className="card">
          <div className="section-title">Live preview</div>
          <div style={{ background: b.background_color, borderRadius: 14, padding: 20 }}>
            {b.logo && <div style={{ textAlign: 'center', marginBottom: 12 }}><img src={b.logo} alt="logo" style={{ maxHeight: 46, maxWidth: 160, objectFit: 'contain' }} /></div>}
            <div style={{ textAlign: 'center', fontWeight: 800, color: b.primary_color, fontSize: 20, marginBottom: 4 }}>{b.name}</div>
            <div style={{ textAlign: 'center', color: '#cbd5e1', fontSize: 13, marginBottom: 4 }}>{b.tagline}</div>
            <div style={{ textAlign: 'center', color: '#cbd5e1', fontSize: 13, marginBottom: 18 }}>{b.welcome_headline}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {states.map((s) => (
                <div key={s.key} className={`box-card ${s.cls}`}
                  style={s.key === 'available' ? { background: `color-mix(in srgb, ${b.primary_color} 40%, #14141f)`, borderColor: b.primary_color } : undefined}>
                  <span className="emoji">{s.emoji}</span>
                  <span className="cap">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Color swatch picker + hex text input, kept in sync both ways. */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <label className="field">
      <span>{label}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="color" value={valid ? value : '#000000'} onChange={(e) => onChange(e.target.value)}
          style={{ width: 42, height: 40, padding: 3, borderRadius: 10, flex: '0 0 auto', cursor: 'pointer' }} />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false}
          style={{ flex: 1, fontFamily: 'ui-monospace, SFMono-Regular, monospace', textTransform: 'uppercase' }} />
      </div>
    </label>
  );
}
