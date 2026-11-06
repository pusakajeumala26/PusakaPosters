'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const dateString = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export function DatePicker({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => value ? new Date(`${value}T12:00:00`) : new Date());
  const [style, setStyle] = useState<CSSProperties>({});
  const shown = useMemo(() => new Date(month.getFullYear(), month.getMonth(), 1), [month]);
  const days = useMemo(() => {
    const first = shown.getDay();
    const count = new Date(shown.getFullYear(), shown.getMonth() + 1, 0).getDate();
    return [...Array(first).fill(0), ...Array.from({ length: count }, (_, i) => i + 1)];
  }, [shown]);

  useEffect(() => {
    if (!open) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setStyle({ position: 'fixed', left: Math.max(8, rect.left), top: Math.min(rect.bottom + 6, window.innerHeight - 340), width: Math.min(310, window.innerWidth - 16) });
    const outside = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const viewport = () => setOpen(false);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', viewport);
    window.addEventListener('scroll', viewport, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', viewport); window.removeEventListener('scroll', viewport, true); };
  }, [open]);

  function pick(day: number) {
    onChange(dateString(shown.getFullYear(), shown.getMonth(), day));
    setOpen(false);
    buttonRef.current?.focus();
  }

  return <div ref={ref} className="date-picker">
    <input id={`${id}-native`} className="sr" type="date" value={value} aria-label="Tenggat upload" onChange={(e) => onChange(e.target.value)} />
    <button ref={buttonRef} id={id} type="button" className="date-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
      {value ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : 'Pilih tanggal'}
      <span aria-hidden="true">▦</span>
    </button>
    {open && <div className="date-panel" role="dialog" aria-label="Pilih tenggat upload" style={style} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); buttonRef.current?.focus(); } }}>
      <div className="date-head"><button type="button" className="icon-btn" aria-label="Bulan sebelumnya" onClick={() => setMonth(new Date(shown.getFullYear(), shown.getMonth() - 1, 1))}>‹</button>
        <b>{new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(shown)}</b>
        <button type="button" className="icon-btn" aria-label="Bulan berikutnya" onClick={() => setMonth(new Date(shown.getFullYear(), shown.getMonth() + 1, 1))}>›</button></div>
      <div className="date-grid">{WEEKDAYS.map((d) => <span className="date-week" key={d}>{d}</span>)}
        {days.map((day, i) => day ? <button type="button" key={`${day}-${i}`} className={value === dateString(shown.getFullYear(), shown.getMonth(), day) ? 'date-day selected' : 'date-day'}
          aria-pressed={value === dateString(shown.getFullYear(), shown.getMonth(), day)} onClick={() => pick(day)}>{day}</button> : <span aria-hidden="true" key={`blank-${i}`} />)}</div>
      {value && <button type="button" className="text-btn date-clear" onClick={() => { onChange(''); setOpen(false); }}>Hapus tenggat</button>}
    </div>}
  </div>;
}
