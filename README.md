<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/logo-lockup-dark.webp">
    <img src="public/brand/logo-lockup-light.webp" alt="PusakaPosters" width="340">
  </picture>
</p>

<p align="center">
  PWA mobile-first untuk mengelola profil dan foto anggota leting <b>Pusaka Jeumala</b><br>
  sebagai bahan poster branding media sosial.
</p>

<p align="center">
  Next.js 16 &middot; Prisma ORM 7 + NeonDB &middot; Supabase Storage &middot; TensorFlow.js
</p>

---

## Alur upload foto

1. Anggota memakai kode undangan sekali pakai dari panitia, lalu membuat akun dengan nomor telepon dan password.
2. Saat pendaftaran, anggota mengisi profil dan memilih foto. Akun anggota lama tetap memakai nomor dan password yang dibuat saat upload sebelumnya.
3. **Di browser**: model segmentasi (`@tensorflow-models/body-segmentation`, Selfie Segmentation) menghapus background.
4. Foto asli dan hasil cutout dinormalisasi ke WebP dan PNG alpha.
5. Dikirim ke server; server memvalidasi ulang (sharp), lalu menyimpan ke Supabase Storage dengan struktur:

```
member-photos/
  <nama-anggota>-<8 huruf id>/
    original.webp
    cutout.png
```

6. Path file + data anggota disimpan di Postgres (NeonDB) lewat Prisma.

Jika penghapusan background gagal (mis. tidak ada orang terdeteksi), foto asli tetap terkirim dan pengguna diberi pesan. Anggota hanya dapat melihat dan mengubah profilnya sendiri; direktori dan foto seluruh anggota hanya dapat dibuka admin.

Panitia membuat kode di **Pengaturan → Undangan anggota**. Kode acak 128-bit berlaku tujuh hari dan hanya dapat digunakan sekali; database hanya menyimpan hash kode. Pendaftaran ditutup bersama sakelar **Terima upload baru**.

## Setup

Gunakan Node.js 20.19.0 atau lebih baru (disarankan Node 22), sesuai persyaratan Prisma 7.

1. **Neon**: buat project, salin connection string *pooled* ke `DATABASE_URL` dan yang *direct* ke `DIRECT_URL`.
2. **Supabase**: buat project, salin `Project URL` ke `SUPABASE_URL` dan `service_role key` ke `SUPABASE_SERVICE_ROLE_KEY` (rahasia, hanya server). Bucket `member-photos` (private) dibuat otomatis saat upload pertama.
3. Salin `.env.example` menjadi `.env`, lalu isi. Buat `SESSION_SECRET` dengan `openssl rand -base64 48`, dan isi `ADMIN_PASSWORD` (password admin awal; bisa diganti di Pengaturan).
4. Jalankan:

```bash
npm install            # juga menjalankan prisma generate + menyalin model MediaPipe ke public/
npx prisma migrate deploy
npm run dev
```

Migrasi `0003_member_accounts` menambahkan sesi anggota dan kode undangan tanpa menghapus data anggota lama. Akun lama menggunakan nomor telepon dan password yang ditetapkan saat upload. Jika password lupa, anggota perlu menghubungi admin.

## Variabel lingkungan

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | Ya | URL NeonDB pooled untuk runtime. |
| `DIRECT_URL` | Ya | URL NeonDB langsung untuk Prisma migrate. |
| `SUPABASE_URL` | Ya | URL project Supabase Storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya | Kunci rahasia server untuk bucket privat. |
| `SUPABASE_BUCKET` | Ya | Nama bucket foto anggota, biasanya `member-photos`. |
| `ADMIN_PASSWORD` | Setup awal | Password admin awal sebelum diganti dari Pengaturan. |
| `SESSION_SECRET` | Ya | Kunci penanda tangan cookie admin. |
| `SUPER_ADMIN_PASSWORD` | Wajib | Password menu Super Admin (MCP Server, Security); berbeda dari password admin. |
| `CRON_SECRET` | Opsional | Rahasia untuk Vercel Cron `/api/cron/feedback`. URL dan API key MCP portfolio diatur super admin lewat Super Admin > MCP Server (terenkripsi di database), bukan lewat env. |
| `NEXT_PUBLIC_SEGMENTER_RUNTIME` | Opsional | Pilih runtime segmentasi `mediapipe` (default) atau `tfjs`. |
| `NEXT_PUBLIC_SEGMENTER_MODEL_URL` | Opsional | URL model khusus runtime TF.js. |

URL dan API key MCP portfolio diatur super admin lewat menu Super Admin > MCP Server (disimpan terenkripsi di database), bukan lewat env. Detail alur, antrean, dan rotasi key ada di [docs/feedback.md](docs/feedback.md).

## Deploy (Vercel)

- Import repo, isi semua env dari `.env.example`, deploy. `npm run build` sudah menjalankan `prisma generate`.
- Jalankan `npx prisma migrate deploy` sekali terhadap database produksi.
- Vercel membatasi body request 4,5 MB. Klien otomatis memperkecil foto agar total (asli + cutout) di bawah 4,2 MB.

## Keamanan

- Bucket private; service-role key tidak pernah ke browser. Foto disajikan hanya setelah pemeriksaan sesi pemilik atau admin, melalui signed URL singkat atau endpoint thumbnail `no-store`.
- Direktori, galeri, status, ekspor, dan pengaturan hanya untuk admin. Sesi anggota memakai token acak opaque di cookie httpOnly 30 hari; database hanya menyimpan hash token. Logout dan pergantian password mencabut sesi.
- Login anggota memakai kode negara, nomor HP, dan password bcrypt. Pendaftaran memerlukan kode undangan satu kali. Pembatasan login dan pendaftaran disimpan di Neon agar berlaku lintas instance; pembatas feedback publik masih in-memory dan best-effort di serverless.
- Ada cek same-origin (CSRF), validasi server, dan ekspor CSV dilindungi dari formula injection.

## PWA

`manifest.ts`, `public/sw.js` (halaman offline, cache aset statis & model; tidak pernah men-cache `/api` atau foto), tombol Install hanya di Pengaturan.
Service worker aktif hanya pada build production (`npm run build && npm start`).

Saat merilis perubahan privasi, deploy migrasi `0003_member_accounts` sebelum aplikasi menerima trafik baru. Thumbnail kini memakai URL `/api/private/...` dengan `no-store`; route lama `/api/members/:id/thumb` dipensiunkan. Aplikasi juga memastikan bucket Supabase `member-photos` berstatus private saat foto dibaca/ditandatangani. Purge cache CDN Vercel untuk route thumbnail lama sebelum mengumumkan rilis, karena versi sebelumnya mengirim header cache publik satu tahun. Signed URL foto lama berhenti berlaku setelah masa kedaluwarsanya.

## Maintenance

Nama anggota baru otomatis disimpan dalam Title Case. Untuk merapikan data yang sudah ada, jalankan `node scripts/normalize-names.mjs --dry-run` untuk melihat perubahan terlebih dahulu, lalu `node scripts/normalize-names.mjs` untuk memperbarui nama di database. Script hanya mengubah kolom nama; folder foto tidak berubah.

## Catatan penting

Prisma 7 memakai adapter PostgreSQL @prisma/adapter-pg. DATABASE_URL dipakai adapter saat runtime, sedangkan DIRECT_URL dibaca oleh prisma.config.ts untuk migrasi. Client dihasilkan ke src/generated/prisma saat install/build dan tidak perlu dikomit.

- `npm run typecheck` dan `npm run build` bersih.
- Hasil hapus background pada beberapa foto di browser nyata (mask MediaPipe -> alpha).
- Alias `@mediapipe/selfie_segmentation` (lihat `next.config.mjs`) dan file di `public/mediapipe/` ada setelah install.
- Migrasi `0001_init` ditulis manual; bila `prisma migrate deploy` mengeluh, jalankan `npx prisma migrate dev --name init` di database kosong.
- Unduh ZIP di Galeri mengambil signed URL Supabase dari browser; bila diblokir CORS, atur CORS di Supabase atau ganti ke endpoint ZIP server.
- Runtime `mediapipe` (default) menjalankan inferensi lewat WASM MediaPipe melalui API TensorFlow.js models. Untuk runtime TF.js murni set `NEXT_PUBLIC_SEGMENTER_RUNTIME=tfjs` (dan `NEXT_PUBLIC_SEGMENTER_MODEL_URL` bila model di-host sendiri).

## Lisensi

Hak cipta (c) 2026 Pusaka Jeumala. All Rights Reserved. Lihat [LICENSE](LICENSE).
