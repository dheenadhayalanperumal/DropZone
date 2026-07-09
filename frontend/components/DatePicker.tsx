'use client';
import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;           // YYYY-MM-DD or ''
  onChange: (v: string) => void;
  placeholder?: string;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function displayFmt(v: string): string {
  const d = parseDate(v);
  if (!d) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DatePicker({ value, onChange, placeholder = 'Select date…' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const today = new Date();
  const selected = parseDate(value);
  const [cursor, setCursor] = useState<{ year: number; month: number }>(() => {
    const d = selected || today;
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Sync cursor when value changes externally
  useEffect(() => {
    const d = parseDate(value);
    if (d) setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function prevMonth() {
    setCursor((c) => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 });
  }
  function nextMonth() {
    setCursor((c) => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 });
  }

  function pick(day: number) {
    const d = new Date(cursor.year, cursor.month, day);
    onChange(fmt(d));
    setOpen(false);
  }

  // Build calendar grid
  const firstDay = new Date(cursor.year, cursor.month, 1).getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = fmt(today);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', padding: '10px 12px', background: 'var(--surface-2)',
          border: '1px solid var(--border)', borderRadius: 10, color: value ? 'var(--text)' : 'var(--muted)',
          fontSize: 14, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer',
        }}
      >
        <span>{value ? displayFmt(value) : placeholder}</span>
        <span style={{ opacity: 0.5, fontSize: 16 }}>📅</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 16, width: 272,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button type="button" onClick={prevMonth} style={navBtnStyle}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 14 }}>
              {MONTHS[cursor.month]} {cursor.year}
            </span>
            <button type="button" onClick={nextMonth} style={navBtnStyle}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAYS.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontWeight: 600, padding: '3px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const cellDate = fmt(new Date(cursor.year, cursor.month, day));
              const isSelected = cellDate === value;
              const isToday = cellDate === todayStr;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(day)}
                  style={{
                    height: 34, borderRadius: 8, border: 'none', fontSize: 13, fontWeight: isSelected ? 700 : 400,
                    cursor: 'pointer', transition: 'background .1s, color .1s',
                    background: isSelected
                      ? 'var(--primary)'
                      : isToday
                      ? 'color-mix(in srgb, var(--primary) 20%, transparent)'
                      : 'transparent',
                    color: isSelected ? '#fff' : isToday ? 'var(--primary-600)' : 'var(--text)',
                    outline: isToday && !isSelected ? '1px solid var(--primary)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = isToday ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'transparent';
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Clear button */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              style={{ marginTop: 12, width: '100%', padding: '7px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}
            >
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
  color: 'var(--text)', fontSize: 18, display: 'grid', placeItems: 'center',
};
