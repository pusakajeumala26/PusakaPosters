import type { MemberView } from './types';

type Job = { path: string; url: string };

/**
 * Kumpulkan foto anggota (admin) jadi satu ZIP di browser.
 * Struktur: <folder-anggota>/original.webp dan cutout sesuai format/path yang disimpan.
 * File diambil langsung dari Supabase lewat signed URL, jadi tidak membebani server.
 */
export async function downloadPhotosZip(
  members: MemberView[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const jobs: Job[] = [];
  for (const m of members) {
    if (!m.folder) continue;
    if (m.originalUrl) jobs.push({ path: `${m.folder}/original.webp`, url: m.originalUrl });
    if (m.cutoutUrl) jobs.push({
      path: `${m.folder}/cutout.${m.cutoutPath?.toLowerCase().endsWith('.png') ? 'png' : 'webp'}`,
      url: m.cutoutUrl,
    });
  }
  if (!jobs.length) throw new Error('Tidak ada foto untuk diunduh.');

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  let done = 0;
  let next = 0;

  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const res = await fetch(job.url);
      if (!res.ok) throw new Error(`Gagal mengambil ${job.path} (${res.status}). Muat ulang halaman lalu coba lagi.`);
      zip.file(job.path, await res.blob());
      onProgress?.(++done, jobs.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, worker));

  // WebP sudah terkompresi, jadi cukup "STORE" agar cepat.
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pusakaposters-foto-${stamp}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return jobs.length;
}
