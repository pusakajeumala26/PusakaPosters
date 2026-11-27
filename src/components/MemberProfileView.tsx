'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { MemberView } from '@/lib/types';
import { GENDER_LABELS, STATUS_META } from '@/lib/types';
import { formatWhen } from '@/lib/format';
import { usePresence } from '@/lib/use-presence';
import { UploadModal, type EditingState } from './UploadModal';
import { IconImage, IconLock } from './icons';

export function MemberProfileView({ member }: { member: MemberView }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const presence = usePresence(editing, 340);
  const status = STATUS_META.find((item) => item.id === member.status)!;
  const editState: EditingState = {
    member,
    data: { name: member.name, countryCode: member.countryCode, phone: member.phone ?? '', gender: member.gender },
  };

  return <>
    <section className="member-profile" aria-labelledby="profile-title">
      <div className="profile-welcome">
        <div><span className="profile-eyebrow">RUANG ANGGOTA</span><h2 id="profile-title">Halo, {member.name.split(' ')[0]}.</h2><p>Ini ruang pribadi untuk data dan foto postermu.</p></div>
        <div className="profile-private"><IconLock size={16} /><span>Pribadi</span></div>
      </div>
      <article className="profile-identity">
        <div className={member.hasCutout ? 'profile-portrait checker' : 'profile-portrait'}>
          {member.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated no-store thumbnail route
            <img src={`${member.thumbUrl}&w=480`} alt={`Foto profil ${member.name}`} />
          ) : <span>{member.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}</span>}
          <span className="profile-image-tag"><IconImage size={14} /> FOTO PROFIL</span>
        </div>
        <div className="profile-details">
          <span className="profile-eyebrow">ANGGOTA PUSAKA JEUMALA</span>
          <h3>{member.name}</h3>
          <p className="profile-phone">{member.phoneDisplay}</p>
          <div className="profile-tags"><span>{GENDER_LABELS[member.gender]}</span><span className={status.chip}>{status.label}</span></div>
          <p className="profile-date">Bergabung {formatWhen(member.createdAt)}</p>
          <button type="button" className="btn primary profile-edit" onClick={() => setEditing(true)}>Edit data & foto</button>
        </div>
      </article>
      <div className="profile-note"><span className="profile-note-mark"><IconLock size={18} /></span><div><b>Foto dan data ini hanya untukmu</b><p>Anggota lain tidak dapat melihat profil ini. Panitia dapat melihatnya untuk menyiapkan poster leting.</p></div></div>
      <div className="profile-caption"><span>PROFIL PRIBADI</span><span>·</span><span>Diperbarui setiap kali kamu menyimpan perubahan</span></div>
    </section>
    {presence.present && <UploadModal open={editing} presence={presence.phase} editing={editState} admin={false} uploadOpen={true} onClose={() => setEditing(false)} onDone={() => { setEditing(false); router.refresh(); }} />}
  </>;
}

