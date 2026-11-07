'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useDialog } from '@/lib/use-dialog';
import { usePresence } from '@/lib/use-presence';

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const dateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateFromString = (value: string) => value ? new Date(`${value}T12:00:00`) : new Date();
const monthTitle = (date: Date) => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
const longDate = (date: Date) => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);

export function DatePicker({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [month, setMonth] = useState(() => {
    const date = dateFromString(value);
    return new Date(date.getFullYear(), date.getMonth(), 1, 12);
  });
  const [draft, setDraft] = useState(value);
  const [cursor, setCursor] = useState(() => dateFromString(value));
  const presence = usePresence(open && !!portalRoot, 240);
  const dialogRef = useDialog<HTMLElement>(() => setOpen(false), open && presence.present);
  const todayValue = dateString(new Date());

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1, 12).getDay();
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, i) => {
      const day = i - first + 1;
      return day > 0 && day <= count ? new Date(month.getFullYear(), month.getMonth(), day, 12) : null;
    });
  }, [month]);

  const openPicker = () => {
    const trigger = buttonRef.current;
    setPortalRoot(trigger?.closest<HTMLElement>('[role="dialog"]') ?? document.body);
    const selected = dateFromString(value);
    setDraft(value);
    setCursor(selected);
    setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1, 12));
    setOpen(true);
  };

  const setCursorAndMonth = useCallback((date: Date) => {
    setCursor(date);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
    window.requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus());
  }, []);

  const changeMonth = useCallback((delta: number) => {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + delta, 1, 12);
    const maxDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    const nextCursor = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(cursor.getDate(), maxDay), 12);
    setMonth(nextMonth);
    setCursor(nextCursor);
  }, [cursor, month]);

  useEffect(() => {
    if (!open) return;
    const active = gridRef.current?.querySelector<HTMLElement>('[tabindex="0"]');
    active?.focus();
  }, [open, month, cursor]);

  function commit() {
    if (!draft) return;
    onChange(draft);
    setOpen(false);
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setDraft(dateString(cursor));
      return;
    }
    const delta = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -7 : event.key === 'ArrowDown' ? 7 : 0;
    if (delta) {
      event.preventDefault();
      const next = new Date(cursor);
      next.setDate(next.getDate() + delta);
      setCursorAndMonth(next);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = new Date(cursor);
      next.setDate(next.getDate() + (event.key === 'Home' ? -next.getDay() : 6 - next.getDay()));
      setCursorAndMonth(next);
      return;
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      changeMonth((event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1));
    }
  }

  const dialog = presence.present && portalRoot ? createPortal(
    <div className="date-overlay" data-state={presence.phase} aria-hidden={!open} inert={!open}>
      <button type="button" className="scrim" aria-label="Tutup kalender" tabIndex={-1} onClick={() => setOpen(false)} />
      <section ref={dialogRef} className="date-dialog" role="dialog" aria-modal="true" aria-label="Pilih tanggal" tabIndex={-1}>
        <header className="date-head">
          <button type="button" className="icon-btn" aria-label="Bulan sebelumnya" onClick={() => changeMonth(-1)}>‹</button>
          <h2 aria-live="polite" aria-atomic="true">{monthTitle(month)}</h2>
          <button type="button" className="icon-btn" aria-label="Bulan berikutnya" onClick={() => changeMonth(1)}>›</button>
        </header>
        <div className="date-grid" role="grid" aria-label={monthTitle(month)} onKeyDown={onGridKeyDown} ref={gridRef}>
          {WEEKDAYS.map((day) => <span className="date-week" role="columnheader" key={day}>{day}</span>)}
          {days.map((date, index) => {
            if (!date) return <span className="date-blank" role="gridcell" aria-hidden="true" key={`blank-${index}`} />;
            const dayValue = dateString(date);
            const selected = draft === dayValue;
            const active = dateString(cursor) === dayValue;
            const today = todayValue === dayValue;
            return <div role="gridcell" key={dayValue}>
              <button type="button" className={`date-day${selected ? ' selected' : ''}${today ? ' today' : ''}`}
                aria-label={longDate(date)} aria-current={today ? 'date' : undefined} aria-pressed={selected}
                tabIndex={active ? 0 : -1} data-autofocus={active ? '' : undefined}
                onFocus={() => setCursor(date)} onClick={() => setDraft(dayValue)}>{date.getDate()}</button>
            </div>;
          })}
        </div>
        <footer className="date-footer">
          {value && <button type="button" className="btn ghost date-clear" onClick={() => { onChange(''); setDraft(''); setOpen(false); }}>Hapus tanggal</button>}
          <span className="date-spacer" />
          <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Batal</button>
          <button type="button" className="btn primary" onClick={commit} disabled={!draft}>Pilih</button>
        </footer>
      </section>
    </div>, portalRoot) : null;

  return <div className="date-picker">
    <input id={`${id}-native`} className="sr" type="date" value={value} aria-label="Tenggat upload" onChange={(e) => onChange(e.target.value)} />
    <button ref={buttonRef} id={id} type="button" className="date-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={openPicker}>
      <span>{value ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(dateFromString(value)) : 'Pilih tanggal'}</span>
      <span aria-hidden="true">▦</span>
    </button>
    {dialog}
  </div>;
}
