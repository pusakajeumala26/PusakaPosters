import { formatWhen } from '@/lib/format';
import { thumbSrc } from '@/lib/thumb';
import type { MemberView } from '@/lib/types';
import { Avatar } from './Avatar';

type Day = { day: string; label: string; uploads: number; logins: number };
export function AdminDashboardView({ total, todayUploads, todayLogins, days, recent }: {
  total: number; todayUploads: number; todayLogins: number; days: Day[]; recent: MemberView[];
}) {
  const max = Math.max(1, ...days.flatMap(d => [d.uploads, d.logins]));
  return <div className="admin-dashboard">
    <div className="dashboard-intro"><span className="dashboard-kicker">PUSAKA JEUMALA · RINGKASAN</span><h2>Selamat datang, Admin</h2><p>Pantau aktivitas anggota dan perkembangan foto dalam satu tempat.</p></div>
    <section className="dashboard-metrics" aria-label="Ringkasan hari ini">
      <article><span>Total anggota</span><strong>{total}</strong><small>akun terdaftar</small></article>
      <article><span>Upload hari ini</span><strong>{todayUploads}</strong><small>foto anggota masuk</small></article>
      <article><span>Login hari ini</span><strong>{todayLogins}</strong><small>sesi anggota berhasil</small></article>
    </section>
    <section className="dashboard-chart">
      <div className="dashboard-section-head"><div><h3>Aktivitas harian</h3><p>14 hari terakhir · waktu WIB</p></div><div className="chart-legend"><span><i className="legend-upload"/>Upload</span><span><i className="legend-login"/>Login</span></div></div>
      <div className="dashboard-bars" role="img" aria-label="Grafik upload dan login selama 14 hari">
        {days.map(d => <div className="dashboard-day" key={d.day} title={`${d.label}: ${d.uploads} upload, ${d.logins} login`}>
          <div className="dashboard-bar-pair"><i className="dashboard-bar upload-bar" style={{height:`${Math.max(3,d.uploads/max*100)}%`}}/><i className="dashboard-bar login-bar" style={{height:`${Math.max(3,d.logins/max*100)}%`}}/></div><span>{d.label}</span>
        </div>)}
      </div>
    </section>
    <section className="dashboard-recent"><div className="dashboard-section-head"><div><h3>Upload terbaru</h3><p>Maksimal 7 anggota terakhir</p></div><span className="recent-count">{recent.length} terbaru</span></div>
      {recent.length ? <div className="recent-upload-list">{recent.map(m => <article className="recent-upload-card" key={m.id}><div><b>{m.name}</b><span>{formatWhen(m.createdAt)} · {m.status}</span></div><Avatar name={m.name} src={thumbSrc(m.thumbUrl,160)}/></article>)}</div> : <div className="dashboard-empty">Belum ada foto yang diunggah.</div>}
    </section>
  </div>;
}
