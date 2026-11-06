import type { CSSProperties } from 'react';

export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`skeleton ${className}`} style={style} />;
}

export function PageSkeleton({ page }: { page: 'home' | 'galeri' | 'status' | 'pengaturan' }) {
  const row = (key: number) => <div className="sk-row" key={key}><Skeleton className="sk-circle" /><div><Skeleton className="sk-line" /><Skeleton className="sk-short" /></div></div>;
  return <section className={`page-skeleton sk-${page}`} aria-busy="true" aria-label="Memuat halaman">
    <span className="sr">Memuat...</span>
    {page === 'home' && <><div className="sk-stats"><div className="sk-card"><Skeleton className="sk-line" /><Skeleton className="sk-number" /><Skeleton className="sk-line" /></div><div className="sk-card"><Skeleton className="sk-line" /><Skeleton className="sk-number" /><Skeleton className="sk-chart" /></div></div><div className="sk-toolbar"><Skeleton className="sk-line" /><Skeleton className="sk-button" /><Skeleton className="sk-button" /></div><div className="sk-rows">{Array.from({ length: 6 }, (_, i) => row(i))}</div></>}
    {page === 'galeri' && <><div className="sk-toolbar"><Skeleton className="sk-line" /><Skeleton className="sk-button" /><Skeleton className="sk-button" /></div><div className="sk-grid">{Array.from({ length: 10 }, (_, i) => <div className="sk-tile" key={i}><Skeleton className="sk-photo" /><Skeleton className="sk-line" /></div>)}</div></>}
    {page === 'status' && <div className="sk-kanban">{Array.from({ length: 4 }, (_, i) => <div className="sk-column" key={i}><Skeleton className="sk-line" />{Array.from({ length: i < 2 ? 3 : 2 }, (_, j) => <div className="sk-status-card" key={j}>{row(j)}<Skeleton className="sk-button" /></div>)}</div>)}</div>}
    {page === 'pengaturan' && <div className="sk-settings">{Array.from({ length: 4 }, (_, i) => <div className="sk-setting-card" key={i}><Skeleton className="sk-line" /><Skeleton className="sk-short" /><Skeleton className="sk-input" /><Skeleton className="sk-input" /><Skeleton className="sk-button" /></div>)}</div>}
  </section>;
}
