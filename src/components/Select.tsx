'use client';

import { createPortal } from 'react-dom';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { IconChevronDown } from './icons';

export type SelectOption = { value: string; label: string; searchText?: string };
type Props = {
  id: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  searchLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  dataField?: string;
};

export function Select({
  id, value, options, onChange, searchable = false, searchLabel = 'Cari pilihan', disabled = false,
  invalid = false, describedBy, className = '', dataField,
}: Props) {
  const uid = useId().replace(/:/g, '');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typed = useRef('');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(Math.max(0, options.findIndex((o) => o.value === value)));
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState<CSSProperties>({});
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('id');
    return q ? options.filter((o) => `${o.label} ${o.searchText ?? ''}`.toLocaleLowerCase('id').includes(q)) : options;
  }, [options, query]);
  const activeOption = filtered[Math.min(active, Math.max(0, filtered.length - 1))];
  const selectedOptionValue = options.find((option) => option.value === value)?.value;

  useEffect(() => {
    if (!open) return;
    const owner = buttonRef.current?.closest<HTMLElement>('[role="dialog"]') ?? document.body;
    setRoot(owner);
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      const flip = below < 280 && above > below;
      setPosition({ left: Math.max(8, rect.left), top: flip ? undefined : rect.bottom + 6,
        bottom: flip ? window.innerHeight - rect.top + 6 : undefined, width: Math.min(Math.max(rect.width, 220), window.innerWidth - 16),
        maxHeight: Math.max(150, Math.min(320, (flip ? above : below) - 18)), });
    };
    update();
    const closeOnViewport = () => setOpen(false);
    window.addEventListener('resize', closeOnViewport);
    window.addEventListener('scroll', closeOnViewport, true);
    const focusTimer = window.setTimeout(() => (searchable ? searchRef.current : document.getElementById(`${uid}-option-${selectedOptionValue}`))?.focus(), 0);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('resize', closeOnViewport);
      window.removeEventListener('scroll', closeOnViewport, true);
    };
  }, [open, options, value, searchable, uid, selectedOptionValue]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !document.getElementById(`${uid}-panel`)?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, uid]);

  function choose(option: SelectOption) {
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); buttonRef.current?.focus(); return;
    }
    if (event.key === 'Tab' && open) { setOpen(false); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      if (!filtered.length) return;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? filtered.length - 1 :
        (active + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length;
      setActive(next);
      window.requestAnimationFrame(() => document.getElementById(`${uid}-option-${filtered[next]?.value}`)?.focus());
    } else if ((event.key === 'Enter' || event.key === ' ') && open && activeOption) {
      event.preventDefault(); choose(activeOption);
    } else if (!searchable && event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      typed.current = `${typed.current}${event.key}`.toLocaleLowerCase('id');
      if (typeTimer.current) clearTimeout(typeTimer.current);
      const match = options.findIndex((o) => o.label.toLocaleLowerCase('id').startsWith(typed.current));
      if (match >= 0) { setActive(match); setOpen(true); }
      typeTimer.current = setTimeout(() => { typeTimer.current = null; typed.current = ''; }, 600);
    }
  }

  const panel = open && root ? createPortal(
    <div id={`${uid}-panel`} className="select-panel" style={position} onKeyDown={onKeyDown}>
      {searchable && <input ref={searchRef} className="select-search" type="search" aria-label={searchLabel} value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKeyDown} />}
      <div role="listbox" id={`${uid}-listbox`} aria-labelledby={id} className="select-options">
        {filtered.map((option, index) => <button type="button" role="option" aria-selected={option.value === value}
          id={`${uid}-option-${option.value}`} key={option.value} tabIndex={index === active ? 0 : -1}
          className={option.value === value ? 'select-option selected' : 'select-option'}
          onFocus={() => setActive(index)} onClick={() => choose(option)}>{option.label}</button>)}
        {!filtered.length && <div className="select-empty">Tidak ada pilihan</div>}
      </div>
    </div>, root) : null;

  return <>
    <input type="hidden" name={id} value={value} />
    <button ref={buttonRef} id={id} type="button" className={`select-trigger ${className}`} role="combobox"
      data-field={dataField}
      aria-haspopup="listbox" aria-controls={`${uid}-listbox`} aria-expanded={open} aria-activedescendant={open && activeOption ? `${uid}-option-${activeOption.value}` : undefined}
      aria-describedby={describedBy} aria-invalid={invalid} disabled={disabled} onClick={() => setOpen((v) => !v)} onKeyDown={onKeyDown}>
      <span className="select-label">{options.find((o) => o.value === value)?.label ?? 'Pilih'}</span>
      <span aria-hidden="true" className="select-chevron"><IconChevronDown size={16} /></span>
    </button>{panel}
  </>;
}
