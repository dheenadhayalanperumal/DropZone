'use client';
import { useEffect, useRef, useState } from 'react';
import { api, API_BASE } from '@/lib/api';

type Voucher = {
  id: number; title: string; description?: string; image?: string | null;
  type: string; value?: string; code_mode: string; shared_code?: string;
  stock?: number | null; validity_days?: number | null;
  active: number; issued: number; redeemed: number; expired: number;
};

const TYPES = ['coupon', 'points', 'badge', 'custom', 'empty'];

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    try {
      const res = await api<{ vouchers: Voucher[] }>('/api/admin/vouchers', { admin: true });
      setVouchers(res.vouchers);
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  function applyUpdate(updated: Partial<Voucher> & { id: number }) {
    setVouchers((vs) => vs.map((v) => v.id === updated.id ? { ...v, ...updated } : v));
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <h1 className="page-title">Vouchers &amp; Coupons</h1>
          <p className="page-sub" style={{ margin: 0 }}>Define what goes inside boxes and track issuance.</p>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={() => setShowNew(true)}>+ New voucher</button>
      </div>
      {err && <div className="err">{err}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Reward</th><th>Type</th><th>Value</th><th>Stock</th>
              <th>Issued</th><th>Redeemed</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((v) => (
              <tr key={v.id}>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    {v.image
                      ? <img src={v.image} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
                      : <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', fontSize: 16, flexShrink: 0 }}>🎁</div>
                    }
                    <div>
                      <strong>{v.title}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>{v.description}</div>
                    </div>
                  </div>
                </td>
                <td><span className="chip purple">{v.type}</span></td>
                <td>{v.value || '—'}</td>
                <td>{v.stock === null || v.stock === undefined ? '∞' : v.stock}</td>
                <td>{v.issued}</td>
                <td>{v.redeemed}</td>
                <td>{v.active ? <span className="chip green">active</span> : <span className="chip">off</span>}</td>
                <td>
                  <button className="btn sm ghost" onClick={() => setEditing(v)}>Edit</button>
                </td>
              </tr>
            ))}
            {!vouchers.length && <tr><td colSpan={8} className="muted">No vouchers yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {showNew && (
        <VoucherForm
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}
      {editing && (
        <VoucherForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(patch) => { setEditing(null); if (patch) applyUpdate(patch); load(); }}
        />
      )}
    </>
  );
}

// ── Shared create / edit form ─────────────────────────────────────────────────

type FormState = {
  title: string; description: string; image: string;
  type: string; value: string; code_mode: string; shared_code: string;
  stock: string; validity_days: string; active: number; codes: string;
};

function blankForm(): FormState {
  return { title: '', description: '', image: '', type: 'coupon', value: '', code_mode: 'shared', shared_code: '', stock: '', validity_days: '30', active: 1, codes: '' };
}

function voucherToForm(v: Voucher): FormState {
  return {
    title:        v.title,
    description:  v.description || '',
    image:        v.image || '',
    type:         v.type,
    value:        v.value || '',
    code_mode:    v.code_mode,
    shared_code:  v.shared_code || '',
    stock:        v.stock === null || v.stock === undefined ? '' : String(v.stock),
    validity_days:v.validity_days === null || v.validity_days === undefined ? '' : String(v.validity_days),
    active:       v.active,
    codes:        '',
  };
}

function VoucherForm({ initial, onClose, onSaved }: {
  initial?: Voucher;
  onClose: () => void;
  onSaved: (patch?: Partial<Voucher> & { id: number }) => void;
}) {
  const isEdit = !!initial;
  const [f, setF] = useState<FormState>(initial ? voucherToForm(initial) : blankForm());
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof FormState, v: any) => setF((s) => ({ ...s, [k]: v }));

  async function onImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setErr('');
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(new Error('Could not read file'));
        r.readAsDataURL(file);
      });
      const { url } = await api<{ url: string }>('/api/admin/upload', {
        method: 'POST', admin: true,
        body: JSON.stringify({ data: dataUrl, filename: file.name }),
      });
      set('image', url.startsWith('data:') ? url : API_BASE + url);
    } catch (e: any) { setErr(e.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function save() {
    setErr('');
    const payload: any = {
      ...f,
      stock:        f.stock === '' ? null : Number(f.stock),
      validity_days:f.validity_days === '' ? null : Number(f.validity_days),
      image:        f.image || null,
      codes:        f.code_mode === 'unique' && f.codes ? f.codes.split(/\s+/).filter(Boolean) : undefined,
    };
    try {
      if (isEdit) {
        await api(`/api/admin/vouchers/${initial!.id}`, { method: 'PUT', admin: true, body: JSON.stringify(payload) });
        // Pass every field that changed back up so the table updates immediately,
        // independent of whether the server echoes the large image payload.
        onSaved({
          id: initial!.id,
          title: f.title, description: f.description, image: f.image || null,
          type: f.type, value: f.value, code_mode: f.code_mode, shared_code: f.shared_code,
          stock: f.stock === '' ? null : Number(f.stock),
          validity_days: f.validity_days === '' ? null : Number(f.validity_days),
          active: f.active,
        });
      } else {
        await api('/api/admin/vouchers', { method: 'POST', admin: true, body: JSON.stringify(payload) });
        onSaved();
      }
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="section-title">{isEdit ? `Edit — ${initial!.title}` : 'New voucher'}</div>

        <label className="field"><span>Title</span>
          <input value={f.title} onChange={(e) => set('title', e.target.value)} />
        </label>

        <label className="field"><span>Description</span>
          <input value={f.description} onChange={(e) => set('description', e.target.value)} />
        </label>

        {/* Image */}
        <div className="field">
          <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>Image</span>
          <div className="row" style={{ marginBottom: 8 }}>
            <div style={{ width: 52, height: 52, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {f.image
                ? <img src={f.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 22 }}>🎁</span>}
            </div>
            <button type="button" className="btn secondary sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload image'}
            </button>
            {f.image && <button type="button" className="btn ghost sm" onClick={() => set('image', '')}>Remove</button>}
            <input ref={fileRef} type="file" accept="image/*" onChange={onImageFile} style={{ display: 'none' }} />
          </div>
          <input value={f.image} onChange={(e) => set('image', e.target.value)} placeholder="…or paste an image URL" />
        </div>

        <div className="grid-2">
          <label className="field"><span>Type</span>
            <select value={f.type} onChange={(e) => set('type', e.target.value)}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="field"><span>Value label</span>
            <input value={f.value} onChange={(e) => set('value', e.target.value)} placeholder="e.g. 10% off" />
          </label>
        </div>

        <div className="grid-2">
          <label className="field"><span>Code mode</span>
            <select value={f.code_mode} onChange={(e) => set('code_mode', e.target.value)}>
              <option value="shared">Shared code</option>
              <option value="unique">Unique per user</option>
            </select>
          </label>
          {f.code_mode === 'shared'
            ? <label className="field"><span>Shared code</span><input value={f.shared_code} onChange={(e) => set('shared_code', e.target.value)} /></label>
            : <label className="field"><span>Codes (space-separated)</span><input value={f.codes} onChange={(e) => set('codes', e.target.value)} placeholder="CODE1 CODE2 CODE3" /></label>}
        </div>

        <div className="grid-2">
          <label className="field"><span>Stock (blank = unlimited)</span>
            <input value={f.stock} onChange={(e) => set('stock', e.target.value)} type="number" min={0} />
          </label>
          <label className="field"><span>Validity (days)</span>
            <input value={f.validity_days} onChange={(e) => set('validity_days', e.target.value)} type="number" min={1} />
          </label>
        </div>

        <label className="field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <input type="checkbox" checked={!!f.active} onChange={(e) => set('active', e.target.checked ? 1 : 0)} style={{ width: 'auto' }} />
          <span style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Active (visible in campaigns)</span>
        </label>

        {err && <div className="err">{err}</div>}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>{isEdit ? 'Save changes' : 'Create voucher'}</button>
        </div>
      </div>
    </div>
  );
}
