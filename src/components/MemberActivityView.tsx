import type { MemberView } from '@/lib/types';
import { STATUS_META } from '@/lib/types';
import { IconLock } from './icons';
export function MemberActivityView({ member }: { member: MemberView }) {
 const status=STATUS_META.find(x=>x.id===member.status)!;
 return <section className="member-activity"><span className="dashboard-kicker">RUANG PRIBADI</span><h2>Aktivitas poster</h2><p>Perkembangan data dan foto Anda untuk kebutuhan poster leting.</p><article className="activity-status-card"><span className={status.chip}>{status.label}</span><h3>{member.name}</h3><p>Foto dan data profil Anda sudah tersimpan untuk dikelola oleh panitia.</p><div className="activity-track"><i/></div><small><IconLock size={15}/> Informasi ini hanya terlihat oleh Anda dan admin.</small></article><article className="activity-tip"><b>Perlu memperbarui foto?</b><p>Gunakan tombol tambah di bawah untuk memperbarui foto profil atau data Anda.</p></article></section>;
}
