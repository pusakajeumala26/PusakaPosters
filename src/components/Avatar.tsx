'use client';

import { useEffect, useState } from 'react';
import { initials } from '@/lib/format';

/** Foto bulat; jatuh ke inisial jika belum ada foto atau URL-nya gagal dimuat. */
export function Avatar({ name, src }: { name: string; src: string | null }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setFailed(false); setLoaded(false); }, [src]);
  return (
    <span className="av" aria-hidden="true">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL dinamis dari Supabase
        <img className={loaded ? 'image-loaded' : 'image-pending'} src={src} alt="" loading="lazy" decoding="async"
          onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
