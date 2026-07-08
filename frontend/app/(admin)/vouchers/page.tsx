'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Voucher = {
  id: number; title: string; description?: string; type: string; value?: string;
  code_mode: string; shared_code?: string; stock?: number | null; validity_days?: number | null;
  active: number; issued: number; redeemed: number; expired: number;
};

const TYPES = ['coupon', 'points', 'badge', 'custom', 'empty'];

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    try {
      const res = await api<{ vouchers: Voucher[] }>('/api/admin/vouchers', { admin: true });
      setVouchers(res.vouchers);
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  return (
    <>
      <div className="toolbar">
        <div>
          <h1 className="page-title">Vouchers &amp; Coupons</h1>
          <p className="page-sub" style={{ margin: 0 }}>Define what goes inside boxes and track issuance.</p>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={() => setShowForm(true)}>+ New voucher</button>
      </div>
      {err && <div className="err">{err}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Reward</th><th>Type</th><th>Value</th><th>Stock</th>
              <th>Issued</th><th>Redeemed</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((v) => (
              <tr key={v.id}>
                <td><strong>{v.title}</strong><div className="muted" style={{ fontSize: 12 }}>{v.description}</div></td>
                <td><span className="chip purple">{v.type}</span></td>
                <td>{v.value || '—'}</td>
                <td>{v.stock === null || v.stock === undefined ? '∞' : v.stock}</td>
                <td>{v.issued}</td>
                <td>{v.redeemed}</td>
                <td>{v.active ? <span className="chip green">active</span> : <span className="chip">off</span>}</td>
              </tr>
            ))}
            {!vouchers.length && <tr><td colSpan={7} className="muted">No vouchers yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && <VoucherForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </>
  );
}

function VoucherForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ title: '', type: 'coupon', value: '', code_mode: 'shared', shared_code: '', stock: '', validity_days: '30' });
  const [err, setErr] = useState('');
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));

  async function save() {
    setErr('');
    try {
      await api('/api/admin/vouchers', {
        method: 'POST', admin: true,
        body: JSON.stringify({
          ...f,
          stock: f.stock === '' ? null : Number(f.stock),
          validity_days: f.validity_days === '' ? null : Number(f.validity_days),
          codes: f.code_mode === 'unique' && f.codes ? f.codes.split(/\s+/).filter(Boolean) : undefined,
        }),
      });
      onSaved();
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">New voucher</div>
        <label className="field"><span>Title</span><input value={f.title} onChange={(e) => set('title', e.target.value)} /></label>
        <label className="field"><span>Description</span><input value={f.description || ''} onChange={(e) => set('description', e.target.value)} /></label>
        <div className="grid-2">
          <label className="field"><span>Type</span>
            <select value={f.type} onChange={(e) => set('type', e.target.value)}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="field"><span>Value</span><input value={f.value} onChange={(e) => set('value', e.target.value)} placeholder="10% off" /></label>
        </div>
        <div className="grid-2">
          <label className="field"><span>Code mode</span>
            <select value={f.code_mode} onChange={(e) => set('code_mode', e.target.value)}>
              <option value="shared">shared code</option>
              <option value="unique">unique per user</option>
            </select>
          </label>
          {f.code_mode === 'shared'
            ? <label className="field"><span>Shared code</span><input value={f.shared_code} onChange={(e) => set('shared_code', e.target.value)} /></label>
            : <label className="field"><span>Codes (whitespace-sep)</span><input value={f.codes || ''} onChange={(e) => set('codes', e.target.value)} /></label>}
        </div>
        <div className="grid-2">
          <label className="field"><span>Stock (blank = ∞)</span><input value={f.stock} onChange={(e) => set('stock', e.target.value)} type="number" /></label>
          <label className="field"><span>Validity days</span><input value={f.validity_days} onChange={(e) => set('validity_days', e.target.value)} type="number" /></label>
        </div>
        {err && <div className="err">{err}</div>}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Save voucher</button>
        </div>
      </div>
    </div>
  );
}
