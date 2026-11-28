import type { CSSProperties } from 'react';

export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`skeleton ${className}`} style={style} />;
}

export type SkeletonPage = 'home' | 'auth' | 'profile' | 'activity' | 'galeri' | 'status' | 'pengaturan' | 'feedback' | 'form' | 'mcp' | 'security';

function Rows({ count = 5 }: { count?: number }) {
  return <div className="sk-rows">{Array.from({ length: count }, (_, i) => <div className="sk-row" key={i}><Skeleton className="sk-circle" /><div><Skeleton className="sk-line" /><Skeleton className="sk-short" /></div></div>)}</div>;
}

function Fields({ count = 4 }: { count?: number }) {
  return <div className="sk-form-fields">{Array.from({ length: count }, (_, i) => <div className="sk-field" key={i}><Skeleton className="sk-short" /><Skeleton className="sk-input" /></div>)}<Skeleton className="sk-button sk-submit" /></div>;
}

export function PageSkeleton({ page }: { page: SkeletonPage }) {
  return <section className={`page-skeleton sk-${page}`} aria-busy="true" aria-label="Memuat halaman">
    <span className="sr">Halaman sedang dimuat</span>
    {page === 'home' && <><div className="sk-dashboard-metrics">{Array.from({ length: 3 }, (_, i) => <div className="sk-dashboard-metric" key={i}><Skeleton className="sk-short"/><Skeleton className="sk-number"/><Skeleton className="sk-short"/></div>)}</div><div className="sk-dashboard-chart"><div><Skeleton className="sk-line"/><Skeleton className="sk-short"/></div><Skeleton className="sk-chart"/></div><div className="sk-section-title"><Skeleton className="sk-line"/><Skeleton className="sk-short"/></div><Rows count={7}/></>}
    {page === 'auth' && <div className="sk-auth-card"><Skeleton className="sk-logo"/><Skeleton className="sk-title"/><Skeleton className="sk-line"/><div className="sk-auth-tabs"><Skeleton/><Skeleton/></div><Fields count={2}/><Skeleton className="sk-short sk-center"/><div className="sk-help-box"><Skeleton className="sk-circle"/><div><Skeleton className="sk-line"/><Skeleton className="sk-short"/></div></div></div>}
    {page === 'profile' && <><div className="sk-page-heading"><Skeleton className="sk-short"/><Skeleton className="sk-title"/><Skeleton className="sk-line"/></div><div className="sk-profile-card"><Skeleton className="sk-profile-photo"/><div><Skeleton className="sk-short"/><Skeleton className="sk-title"/><Skeleton className="sk-line"/><Skeleton className="sk-button"/></div></div><div className="sk-help-box"><Skeleton className="sk-circle"/><div><Skeleton className="sk-line"/><Skeleton className="sk-short"/></div></div><div className="sk-two-cards"><Skeleton className="sk-card"/><Skeleton className="sk-card"/></div></>}
    {page === 'activity' && <><div className="sk-page-heading"><Skeleton className="sk-short"/><Skeleton className="sk-title"/><Skeleton className="sk-line"/></div><div className="sk-activity-card"><Skeleton className="sk-pill"/><Skeleton className="sk-title"/><Skeleton className="sk-line"/><Skeleton className="sk-chart"/><Skeleton className="sk-short"/></div><div className="sk-card"><Skeleton className="sk-line"/><Skeleton className="sk-short"/></div></>}
    {page === 'galeri' && <><div className="sk-section-title"><Skeleton className="sk-title"/><Skeleton className="sk-button"/><Skeleton className="sk-button"/></div><div className="sk-grid">{Array.from({ length: 8 }, (_, i) => <div className="sk-tile" key={i}><Skeleton className="sk-photo"/><Skeleton className="sk-line"/><Skeleton className="sk-short"/></div>)}</div></>}
    {page === 'status' && <div className="sk-kanban">{Array.from({ length: 4 }, (_, i) => <div className="sk-column" key={i}><Skeleton className="sk-line"/><Rows count={3}/></div>)}</div>}
    {page === 'pengaturan' && <div className="sk-settings">{Array.from({ length: 3 }, (_, i) => <div className="sk-setting-card" key={i}><Skeleton className="sk-title"/><Skeleton className="sk-line"/><Fields count={2}/></div>)}</div>}
    {page === 'feedback' && <><div className="sk-page-heading"><Skeleton className="sk-title"/><Skeleton className="sk-line"/></div><div className="sk-section-title"><Skeleton className="sk-line"/><Skeleton className="sk-button"/></div><Rows count={5}/></>}
    {page === 'form' && <><div className="sk-page-heading"><Skeleton className="sk-short"/><Skeleton className="sk-title"/><Skeleton className="sk-line"/></div><div className="sk-form-card"><Fields count={5}/></div></>}
    {page === 'mcp' && <><div className="sk-page-heading"><Skeleton className="sk-title"/><Skeleton className="sk-line"/></div><div className="sk-settings"><div className="sk-setting-card"><Skeleton className="sk-title"/><Skeleton className="sk-line"/><Fields count={3}/><Skeleton className="sk-card"/></div><div className="sk-setting-card"><Skeleton className="sk-title"/><Rows count={3}/></div></div></>}
    {page === 'security' && <><div className="sk-page-heading"><Skeleton className="sk-title"/><Skeleton className="sk-line"/></div><div className="sk-form-card"><Skeleton className="sk-title"/><Skeleton className="sk-line"/><Fields count={1}/></div></>}
  </section>;
}