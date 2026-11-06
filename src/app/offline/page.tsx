import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Offline' };
export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <main className="offline">
      <div>
        <img className="mono" src="/brand/logo-mark-light.webp" alt="" width={56} height={56} />
        <h1>Kamu sedang offline</h1>
        <p>PusakaPosters butuh internet untuk memuat dan mengirim data. Sambungkan kembali lalu coba lagi.</p>
        {/* Tautan biasa, bukan <Link>: halaman ini bisa tampil dari cache tanpa JavaScript */}
        <a className="btn primary" href="/">
          Muat ulang
        </a>
      </div>
    </main>
  );
}
