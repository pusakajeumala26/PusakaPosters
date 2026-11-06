'use client';

import { IconAlert } from '@/components/icons';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="empty" role="alert">
      <IconAlert size={28} />
      <b>Halaman gagal dimuat</b>
      <p>Server atau database sedang bermasalah. Coba lagi sebentar.</p>
      {error.digest && <p className="num">Kode: {error.digest}</p>}
      <button type="button" className="btn primary" onClick={reset}>
        Coba lagi
      </button>
    </div>
  );
}
