<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/logo-lockup-dark.webp">
    <img src="public/brand/logo-lockup-light.webp" alt="PusakaPosters" width="340">
  </picture>
</p>

<p align="center">
  PWA dashboard monokrom untuk mengumpulkan data dan foto anggota leting <b>Pusaka Jeumala</b><br>
  sebagai bahan poster branding media sosial.
</p>

<p align="center">
  Next.js 15 &middot; Prisma + NeonDB &middot; Supabase Storage &middot; TensorFlow.js
</p>

---

## Alur upload foto

1. Anggota memilih foto di modal Upload.
2. **Di browser**: model segmentasi (`@tensorflow-models/body-segmentation`, Selfie Segmentation) menghapus background.
3. Foto asli dan hasil cutout dikonversi ke **`.webp`**.
4. Dikirim ke server; server memvalidasi ulang (sharp), lalu menyimpan ke Supabase Storage dengan struktur:

```
member-photos/
  <nama-anggota>-<8 huruf id>/
    original.webp
    cutout.webp
```

5. Path file + data anggota disimpan di Postgres (NeonDB) lewat Prisma.

Jika penghapusan background gagal (mis. tidak ada orang terdeteksi), foto asli tetap terkirim dan pengguna diberi pesan.

## Setup

1. **Neon**: buat project, salin connection string *pooled* ke `DATABASE_URL` dan yang *direct* ke `DIRECT_URL`.
2. **Supabase**: buat project, salin `Project URL` ke `SUPABASE_URL` dan `service_role key` ke `SUPABASE_SERVICE_ROLE_KEY` (rahasia, hanya server). Bucket `member-photos` (private) dibuat otomatis saat upload pertama.
3. Salin `.env.example` menjadi `.env`, lalu isi. Buat `SESSION_SECRET` dengan `openssl rand -base64 48`, dan isi `ADMIN_PASSWORD` (password admin awal; bisa diganti di Pengaturan).
4. Jalankan:

```bash
npm install            # juga menjalankan prisma generate + menyalin model MediaPipe ke public/
npx prisma migrate deploy
npm run dev
```

5. **Commit `package-lock.json`** setelah `npm install` pertama supaya versi terkunci.

## Deploy (Vercel)

- Import repo, isi semua env dari `.env.example`, deploy. `npm run build` sudah menjalankan `prisma generate`.
- Jalankan `npx prisma migrate deploy` sekali terhadap database produksi.
- Vercel membatasi body request 4,5 MB. Klien otomatis memperkecil foto agar total (asli + cutout) di bawah 4,2 MB.

## Keamanan

- Bucket private; foto ditampilkan lewat signed URL (1 jam). Service-role key tidak pernah ke browser.
- Nomor HP disamarkan untuk non-admin. Halaman Galeri, Status, Pengaturan hanya untuk admin (cookie JWT httpOnly 12 jam; ganti password admin membatalkan sesi lama).
- Password anggota di-hash (bcrypt). Ada cek same-origin (CSRF), validasi zod di klien & server, dan rate limit sederhana (in-memory, bersifat best-effort di serverless).
- Ekspor CSV dilindungi dari formula injection.

## PWA

`manifest.ts`, `public/sw.js` (halaman offline, cache aset statis & model; tidak pernah men-cache `/api` atau foto), tombol Install hanya di Pengaturan.
Service worker aktif hanya pada build production (`npm run build && npm start`).

## Catatan penting

Kode ini ditulis tanpa bisa menjalankan `npm install`/`next build` (registry diblokir di lingkungan penulisan), jadi **belum diuji end-to-end**. Periksa lebih dulu:

- `npm run typecheck` dan `npm run build` bersih.
- Hasil hapus background pada beberapa foto di browser nyata (mask MediaPipe -> alpha).
- Alias `@mediapipe/selfie_segmentation` (lihat `next.config.mjs`) dan file di `public/mediapipe/` ada setelah install.
- Migrasi `0001_init` ditulis manual; bila `prisma migrate deploy` mengeluh, jalankan `npx prisma migrate dev --name init` di database kosong.
- Unduh ZIP di Galeri mengambil signed URL Supabase dari browser; bila diblokir CORS, atur CORS di Supabase atau ganti ke endpoint ZIP server.
- Runtime `mediapipe` (default) menjalankan inferensi lewat WASM MediaPipe melalui API TensorFlow.js models. Untuk runtime TF.js murni set `NEXT_PUBLIC_SEGMENTER_RUNTIME=tfjs` (dan `NEXT_PUBLIC_SEGMENTER_MODEL_URL` bila model di-host sendiri).

## Lisensi

Hak cipta (c) 2026 Pusaka Jeumala. All Rights Reserved. Lihat [LICENSE](LICENSE).
