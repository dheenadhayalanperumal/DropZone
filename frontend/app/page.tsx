'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, getUser, saveUser, clearUser } from '@/lib/api';
import BoxArt from '@/components/BoxArt';

type Brand = {
  name: string; tagline?: string; logo?: string;
  primary_color: string; accent_color: string; background_color: string;
  welcome_headline: string; opened_message: string; missed_message: string;
};

// Turn the admin brand palette into the CSS variables the .dz theme reads,
// so logo/colors set in the admin panel drive the customer experience.
function brandTheme(brand: Brand | null): React.CSSProperties | undefined {
  if (!brand) return undefined;
  const primary = brand.primary_color || '#f24e8b';
  const accent = brand.accent_color || '#f5a623';
  return {
    ['--dz-pink' as any]: primary,
    ['--dz-orange' as any]: accent,
    ['--dz-yellow' as any]: accent,
    ['--dz-grad' as any]: `linear-gradient(95deg, ${primary} 0%, ${accent} 100%)`,
    ['--dz-bg' as any]: brand.background_color || '#09090f',
  };
}
type Campaign = { id: number; name: string; description?: string; type: string };
type Drop = {
  drop_id: number; drop_index: number; title: string; open_at: string; close_at: string;
  status: 'opened' | 'available' | 'locked' | 'missed'; opened_at?: string;
  reward_title?: string | null; reward_type?: string | null; reward_value?: string | null;
  reward_image?: string | null; code?: string | null;
};
type Reward = { issue_id?: number; code?: string | null; title?: string; type?: string; value?: string; image?: string | null };
type OpenResp = { status: string; reward: Reward | null };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Home() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [user, setUser] = useState(getUser());
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<{ brand: Brand; campaigns: Campaign[] }>('/api/campaigns/active')
      .then((r) => { setBrand(r.brand); setCampaign(r.campaigns[0] ?? null); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoaded(true));
  }, []);

  async function loadCalendar() {
    if (!user || !campaign) return;
    try {
      const r = await api<{ drops: Drop[] }>(`/api/me/calendar?campaign=${campaign.id}`, { user });
      setDrops(r.drops);
    } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { loadCalendar(); /* eslint-disable-next-line */ }, [user, campaign]);

  function signOut() { clearUser(); setUser(null); setDrops([]); }

  if (!loaded) return (
    <div className="dz"><div className="dz-loading"><div className="dz-spin" /></div></div>
  );

  return (
    <div className="dz" style={brandTheme(brand)}>
      <div className="dz-shell">
        <main className="dz-body">
          {err && <p className="dz-err">{err}</p>}
          {!user
            ? <Enroll brand={brand} campaign={campaign} onDone={(u) => { saveUser(u); setUser(u); }} />
            : <Play brand={brand!} user={user} drops={drops} reload={loadCalendar} signOut={signOut} />}
        </main>
      </div>
    </div>
  );
}

/* ---------------- Brand mark ---------------- */
function Shield({ brand }: { brand: Brand | null }) {
  if (brand?.logo) {
    return <span className="dz-shield dz-shield--img" aria-hidden><img src={brand.logo} alt={brand.name || ''} /></span>;
  }
  const name = brand?.name || 'DZ';
  const initials = name.split(/\s+/).slice(0, 3).map((w) => w[0]).join('').toUpperCase() || 'DZ';
  return <span className="dz-shield" aria-hidden><b>{initials.length > 2 ? name.split(/\s+/).slice(0, 3).join('\n') : initials}</b></span>;
}

/* ---------------- Enrollment (landing → OTP) ---------------- */
function Enroll({ brand, campaign, onDone }: { brand: Brand | null; campaign: Campaign | null; onDone: (u: { id: number; identifier: string }) => void }) {
  const [phase, setPhase] = useState<'form' | 'otp'>('form');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const phoneOk = /^\d{10}$/.test(phone);

  async function verify(code: string) {
    if (!campaign) { setErr('No active campaign right now.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await api<{ user_id: number; identifier: string }>('/api/enroll', {
        method: 'POST',
        body: JSON.stringify({ identifier: `+91${phone}`, name, campaign_id: campaign.id }),
      });
      onDone({ id: r.user_id, identifier: r.identifier });
    } catch (e: any) { setErr(e.message || 'Could not verify'); setBusy(false); }
  }

  return (
    <div className="dz-stagger">
      <Hero brand={brand} />
      {phase === 'form' ? (
        <div className="dz-card">
          <p className="dz-eyebrow">One step away</p>
          <div className="dz-field">
            <label>Your name</label>
            <input className="dz-input" value={name} placeholder="Enter your name" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="dz-field">
            <label>Mobile number</label>
            <div className="dz-phone">
              <span className="cc">+91</span>
              <input inputMode="numeric" maxLength={10} placeholder="00000 00000"
                value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
            </div>
          </div>
          {err && <p className="dz-err">{err}</p>}
          <button className="dz-cta" disabled={!name.trim() || !phoneOk} onClick={() => { setErr(''); setPhase('otp'); }}>
            Send OTP
          </button>
          <p className="dz-hint">We’ll text a one-time code. No spam, ever.</p>
        </div>
      ) : (
        <OtpCard phone={phone} busy={busy} err={err} onEdit={() => { setErr(''); setPhase('form'); }} onVerify={verify} />
      )}
      <HowItWorks />
    </div>
  );
}

function Hero({ brand }: { brand: Brand | null }) {
  return (
    <section className="dz-hero">
      {brand?.logo && <img className="dz-hero-logo" src={brand.logo} alt={brand.name || ''} />}
      <h1>A New Box Drops<br /><span className="em">Every Day</span> 📦</h1>
      <p>{brand?.tagline || 'Customers scan, tap to open, and see what’s inside. Miss a day — miss the reward.'}</p>
    </section>
  );
}

function OtpCard({ phone, busy, err, onEdit, onVerify }: { phone: string; busy: boolean; err: string; onEdit: () => void; onVerify: (code: string) => void }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);
  const code = digits.join('');

  function set(i: number, v: string) {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...digits]; next[i] = d; setDigits(next);
    if (d && i < 3) refs.current[i + 1]?.focus();
  }
  function onKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  }
  return (
    <div className="dz-card">
      <div className="dz-otp-head">
        <p className="dz-eyebrow" style={{ margin: 0 }}>Verify OTP</p>
        <button className="dz-link" onClick={onEdit}>Edit</button>
      </div>
      <p className="dz-otp-sub">Enter the code we have sent to <b>+91 {phone}</b></p>
      <div className="dz-otp-row">
        {digits.map((d, i) => (
          <input key={i} ref={(el) => { refs.current[i] = el; }} className="dz-otp-cell"
            inputMode="numeric" maxLength={1} value={d}
            onChange={(e) => set(i, e.target.value)} onKeyDown={(e) => onKey(i, e)} />
        ))}
      </div>
      <button className="dz-link dz-resend">Resend code</button>
      {err && <p className="dz-err">{err}</p>}
      <button className="dz-cta" disabled={code.length < 4 || busy} onClick={() => onVerify(code)}>
        {busy ? 'Verifying…' : 'Verify & Win Streak'}
      </button>
      <p className="dz-hint">Enter the 4-digit code we sent to your mobile number.</p>
    </div>
  );
}

function HowItWorks() {
  return (
    <div className="dz-hiw">
      <span className="dz-pill">How it works ?</span>
      <h3>How the DropBox Works</h3>
      <p>Scan → Open the box → Unlock an exciting reward.</p>
    </div>
  );
}

/* ---------------- Play view ---------------- */
function Play({ brand, user, drops, reload, signOut }: { brand: Brand; user: { id: number; identifier: string }; drops: Drop[]; reload: () => Promise<void>; signOut: () => void; }) {
  const [reveal, setReveal] = useState<{ resp: OpenResp; drop: Drop } | null>(null);
  const [boxOpen, setBoxOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const tap = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The drop the stage focuses on: the box whose window contains "now" (today's
  // box — whether still available or just opened), else the next live/upcoming one.
  const now = Date.now();
  const ts = (s: string) => new Date(s.replace(' ', 'T')).getTime();
  const focus = drops.find((d) => ts(d.open_at) <= now && now <= ts(d.close_at))
    || drops.find((d) => d.status === 'available')
    || drops.find((d) => d.status !== 'opened' && d.status !== 'missed')
    || drops[drops.length - 1];
  const canOpen = focus?.status === 'available' && !busy;

  // Reset local box state when the focus drop changes.
  useEffect(() => { setBoxOpen(focus?.status === 'opened'); }, [focus?.drop_id, focus?.status]);

  async function doOpen() {
    if (!focus || !canOpen) return;
    setBusy(true); setBoxOpen(true);
    try {
      const resp = await api<OpenResp>(`/api/boxes/${focus.drop_id}/open`, {
        method: 'POST', user,
        headers: { 'Idempotency-Key': `open-${focus.drop_id}` },
      });
      setTimeout(() => setReveal({ resp, drop: focus }), 480);
    } catch (e: any) {
      setBoxOpen(false);
      alert(e.message || 'Could not open the box');
    } finally { setBusy(false); }
  }
  function handleTap() {
    if (!canOpen) return;
    tap.current += 1;
    if (tap.current === 1) {
      setArmed(true);
      timer.current = setTimeout(() => { tap.current = 0; setArmed(false); }, 650);
    } else {
      clearTimeout(timer.current); tap.current = 0; setArmed(false); doOpen();
    }
  }

  const focusNum = focus?.drop_index ?? 0;
  const weekOf = Math.floor((focusNum - 1) / 7);
  const weekDrops = drops.filter((d) => Math.floor((d.drop_index - 1) / 7) === weekOf);
  const posInWeek = weekDrops.findIndex((d) => d.drop_id === focus?.drop_id) + 1;
  const refDate = focus ? new Date(focus.open_at) : new Date();

  const stageState = boxOpen ? 'opened' : focus?.status;

  return (
    <div className="dz-stagger">
      <div className="dz-center">
        <span className="dz-brandbar">
          <Shield brand={brand} />
          <span style={{ textAlign: 'left' }}>
            <span className="dz-brandbar-name">{brand.name}<small>{brand.tagline || 'Drop Zone'}</small></span>
          </span>
        </span>
        <p className="dz-sub">{brand.welcome_headline || 'Open a box every day. Miss a day — miss the reward.'}</p>
        <button onClick={reload} className="dz-link">Reload</button>
       
      </div>

      <p className="dz-eyebrow">Today’s box · tap to open</p>
      <section className="dz-drop">
        <div className="dz-drop-top">
          {focus?.status === 'available'
            ? <span className="dz-live"><span className="dz-dot" /> Today’s drop is live</span>
            : <span className="dz-live" style={{ color: 'var(--dz-muted)' }}>{stageState === 'opened' ? 'Opened for today' : 'Next drop'}</span>}
          <span className="dz-daytag">Day · {focusNum}</span>
        </div>

        <div className="dz-stage">
          <button
            className={`dz-box ${armed ? 'armed' : ''} ${busy ? 'opening' : ''}`}
            onClick={handleTap} disabled={!canOpen} aria-label="Open today's box">
            <BoxArt open={stageState === 'opened'} />
          </button>
        </div>

        {focus?.status === 'available' && !boxOpen ? (
          <>
            <h2>Double tap to open today’s box</h2>
            <p className="dz-tap-sub">One box. One day. Don’t miss it.</p>
          </>
        ) : stageState === 'opened' ? (
          <>
            <h2>Box opened 🎉</h2>
            <p className="dz-tap-sub">Come back tomorrow for the next drop.</p>
          </>
        ) : focus?.status === 'missed' ? (
          <>
            <h2>Missed for today</h2>
            <p className="dz-tap-sub">{brand.missed_message || 'This drop has closed. Catch the next one!'}</p>
          </>
        ) : (
          <>
            <h2>Locked</h2>
            <p className="dz-tap-sub">Opens {refDate.toLocaleDateString()}.</p>
          </>
        )}
      </section>

      <section className="dz-week">
        <h4>{MONTHS[refDate.getMonth()]} {refDate.getFullYear()} · Week {weekOf + 1}</h4>
        <p className="dz-week-sub">Day {Math.max(posInWeek, 1)} of {weekDrops.length}</p>
        <div className="dz-days">
          {weekDrops.map((d) => {
            const st = d.drop_id === focus?.drop_id && boxOpen ? 'opened' : d.status;
            return (
              <div key={d.drop_id} className={`dz-day ${d.drop_id === focus?.drop_id ? 'is-today' : ''}`}>
                <span className="lbl">{d.title}</span>
                <div className={`dz-tile ${st}`}>{tileIcon(st)}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="dz-signout">
        
        <button onClick={signOut} className="dz-link">not {user.identifier} signout</button>
      </section>

      {reveal && (
        <RevealModal
          resp={reveal.resp} brand={brand} dayIndex={reveal.drop.drop_index}
          onClose={async () => { setReveal(null); await reload(); }}
        />
      )}
    </div>
  );
}

function tileIcon(status: string) {
  if (status === 'opened') return '✓';
  if (status === 'available') return '🎁';
  if (status === 'missed') return '✕';
  return '🔒';
}

/* ---------------- Reveal modals ---------------- */
function rewardEmoji(type?: string) {
  const t = (type || '').toLowerCase();
  if (t.includes('discount') || t.includes('percent')) return '🏷️';
  if (t.includes('coffee') || t.includes('drink')) return '☕';
  if (t.includes('code') || t.includes('voucher')) return '🎟️';
  return '🎁';
}
function RevealModal({ resp, brand, dayIndex, onClose }: { resp: OpenResp; brand: Brand; dayIndex: number; onClose: () => void }) {
  const r = resp.reward;
  if (r) {
    return (
      <div className="dz-backdrop" onClick={onClose}>
        <div className="dz-modal" onClick={(e) => e.stopPropagation()}>
          <div className="dz-medal reward">
            {r.image ? <img src={r.image} alt="" /> : <span className="em">{rewardEmoji(r.type)}</span>}
          </div>
          <p className="dz-eyebrow">You got</p>
          <h2>{r.title || 'A reward!'}</h2>
          <p>{brand.opened_message || 'Show this code at the counter to redeem your reward.'}</p>
          {r.code && <div className="dz-code">{r.code}</div>}
          <button className="dz-cta" onClick={onClose}>Done</button>
        </div>
      </div>
    );
  }
  // No reward inside — streak encouragement.
  return (
    <div className="dz-backdrop" onClick={onClose}>
      <div className="dz-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dz-medal"><span className="em">📦</span></div>
        <h2>Day {dayIndex} · Keep Going</h2>
        <p>Nice one! Come back tomorrow to keep your streak and reach the next reward.</p>
        <button className="dz-cta" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

/* ---------------- Rewards drawer ---------------- */
function RewardsDrawer({ user, onClose }: { user: { id: number; identifier: string }; onClose: () => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    api<{ rewards: any[] }>('/api/me/rewards', { user }).then((r) => setRows(r.rewards)).catch(() => setRows([]));
  }, [user]);
  async function redeem(id: number) {
    try { await api(`/api/rewards/${id}/redeem`, { method: 'POST', user }); } catch {}
    const r = await api<{ rewards: any[] }>('/api/me/rewards', { user });
    setRows(r.rewards);
  }
  return (
    <div className="dz-backdrop" onClick={onClose}>
      <div className="dz-modal" style={{ maxWidth: 420, textAlign: 'left', padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div className="dz-otp-head" style={{ marginBottom: 18 }}>
          <p className="dz-eyebrow" style={{ margin: 0 }}>My rewards</p>
          <button className="dz-link" onClick={onClose}>Close</button>
        </div>
        {rows === null ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><div className="dz-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="dz-tap-sub" style={{ textAlign: 'center', padding: '20px 0' }}>No rewards yet — open some boxes!</p>
        ) : (
          <div className="dz-rewards">
            {rows.map((r) => (
              <div key={r.id} className="dz-reward-row">
                <div className="rw-ic">{rewardEmoji(r.type)}</div>
                <div className="rw-main">
                  <b>{r.title}</b>
                  <small>{r.code ? `Code ${r.code}` : r.value || ''}{r.expires_at ? ` · exp ${new Date(r.expires_at).toLocaleDateString()}` : ''}</small>
                </div>
                {r.status === 'issued'
                  ? <button className="dz-link" onClick={() => redeem(r.id)}>Redeem</button>
                  : <span className={`dz-tag ${r.status}`}>{r.status}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
