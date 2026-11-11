# Feedback publik dan koneksi MCP portfolio

## Alur

1. Pengunjung membuka modal **Beri Feedback**: otomatis sekitar 3 detik setelah beranda dimuat (bisa dilewati; muncul lagi setiap halaman dimuat ulang) atau lewat menu samping (Beri Feedback). Halaman penuh `/masukan` tetap tersedia. Admin yang sedang masuk tidak diganggu modal otomatis.
2. `POST /api/feedback` (multipart) memvalidasi isian, lalu **menyimpan ke database lebih dulu** (tabel `Feedback`, status `QUEUED`). Setelah respons dikirim (`after()`), server mencoba mengirim ke portfolio. Pengunjung tidak kehilangan masukan walau portfolio sedang bermasalah.
3. Pengiriman ulang otomatis: dari cron harian (`vercel.json`, `/api/cron/feedback`), saat admin membuka halaman Feedback, dan setelah tiap kiriman baru. Admin juga bisa menekan **Kirim ulang** per baris.

Alamat tool: `submit_feedback` (nama, isi, rating, peran, project `PusakaPosters`). Persetujuan, honeypot, dan foto tidak diteruskan.

## Pengaturan koneksi (admin)

Pengaturan > **Koneksi portfolio (MCP)**: URL MCP, API key, sakelar Tersambung/Terputus, tombol **Tes koneksi**, dan status terakhir (waktu, hasil, durasi, keterangan). Tidak ada environment variable untuk MCP.

- URL harus `https`, tanpa kredensial, berupa nama domain (bukan IP/localhost) agar form admin tidak bisa dipakai memanggil alamat internal. Redirect tidak diikuti.
- API key dienkripsi AES-256-GCM dengan kunci turunan (HKDF-SHA256) dari `SESSION_SECRET`, disimpan di tabel `PortfolioConnection`, hanya ditampilkan tersamar (empat karakter terakhir), tidak pernah dikirim balik ke browser dan tidak dicatat di log. Jika `SESSION_SECRET` diganti, key tersimpan tidak terbaca dan harus diisi ulang.
- **Terputus**: feedback baru tetap tersimpan dan menunggu di antrean; tidak ada pengiriman. Sambungkan lagi untuk melanjutkan.
- **Tes koneksi** memakai `tools/list` (baca saja), jadi tidak membuat testimoni di portfolio. Hasilnya juga menyebut field yang belum didukung tool (mis. foto).

## Antrean dan penanganan error

Kolom `Feedback`: `id`, `syncStatus` (`QUEUED`/`SENT`/`FAILED`), `attempts`, `lastError`, `nextAttemptAt`, `uncertain`, `remoteId`.

| Penyebab | Arti | Diulang? |
| --- | --- | --- |
| `dns` | nama server tidak ditemukan | ya |
| `network` | koneksi gagal | ya |
| `timeout` | tidak ada jawaban dalam 10 detik | ya |
| `rate_limited` (429) | batas 60 permintaan/menit; `Retry-After` dihormati | ya |
| `server` (5xx/respons rusak) | server portfolio bermasalah | ya |
| `unauthorized` (401/403) | API key ditolak | tidak |
| `invalid` (4xx lain, `isError`) | data ditolak | tidak |

Jeda eksponensial dengan jitter: 30 dtk, 2 mnt, 8 mnt, 32 mnt, 2 jam (maksimal 5 percobaan, lalu `FAILED`). Satu baris hanya dikirim oleh satu pemroses (klaim atomik dengan lease 60 detik), dan baris `SENT` tidak pernah dikirim lagi. Penyebab spesifik ditampilkan di daftar Feedback admin.

## Batasan sisi portfolio

- Tool `submit_feedback` **tidak punya field foto**, jadi foto profil hanya disimpan lokal (prefix `feedback/` di Supabase Storage (bucket yang sama dengan foto anggota)) dan tampil di daftar admin lewat signed URL; di UI tanpa foto dipakai avatar inisial.
- Tool **tidak punya idempotency key**. Timeout atau 5xx bisa terjadi setelah portfolio menerima testimoni, sehingga retry dapat membuat duplikat. Baris seperti itu ditandai "pengiriman tidak pasti"; periksa dashboard portfolio sebelum mengirim ulang manual.

## Anti-spam dan privasi

Honeypot, batas 3 kiriman per IP (di-hash) per 10 menit (di memori instance, jadi hanya pembatas ringan), checkbox persetujuan wajib, foto maksimal 2 MB (JPG/PNG/WebP, magic byte dicek lalu diubah ke WebP 256 px tanpa metadata). Log hanya mencatat kategori hasil, bukan key, isi, atau nama.

## Cron

Tambahkan `CRON_SECRET` (acak panjang) di environment Vercel agar Vercel Cron mengirim `Authorization: Bearer ...`. Tanpa itu, endpoint hanya bisa dipanggil admin yang sedang masuk. Jadwal harian dipilih agar cocok dengan paket Hobby.

## Rotasi key

1. Buat key baru di pengelolaan MCP portfolio.
2. Pengaturan > Koneksi portfolio: tempel key baru, Simpan, lalu Tes koneksi.
3. Cabut key lama di server portfolio.
