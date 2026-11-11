# Feedback publik dan koneksi MCP portfolio

## Alur

1. Pengunjung membuka modal **Beri Feedback**: otomatis sekitar 3 detik setelah beranda dimuat (bisa dilewati; muncul lagi setiap halaman dimuat ulang) atau lewat menu samping (Beri Feedback). Halaman penuh `/masukan` tetap tersedia. Admin yang sedang masuk tidak diganggu modal otomatis.
2. `POST /api/feedback` (multipart) memvalidasi isian, lalu **menyimpan ke database lebih dulu** (tabel `Feedback`, status `QUEUED`). Setelah respons dikirim (`after()`), server mencoba mengirim ke portfolio. Pengunjung tidak kehilangan masukan walau portfolio sedang bermasalah.
3. Pengiriman ulang otomatis: dari cron harian (`vercel.json`, `/api/cron/feedback`), saat admin membuka halaman Feedback, dan setelah tiap kiriman baru. Admin juga bisa menekan **Kirim ulang** per baris.

Alamat tool: `submit_feedback` (nama, isi, rating, peran, project `PusakaPosters`, `idempotency_key`). Persetujuan, honeypot, dan foto tidak diteruskan (lihat Kontrak portfolio).

## Pengaturan koneksi (super admin)

Super Admin > **MCP Server** (Koneksi portfolio): URL MCP, API key, sakelar Tersambung/Terputus, tombol **Tes koneksi**, dan status terakhir (waktu, hasil, durasi, keterangan). Tidak ada environment variable untuk MCP.

- URL harus `https`, tanpa kredensial, berupa nama domain (bukan IP/localhost) agar form admin tidak bisa dipakai memanggil alamat internal. Redirect tidak diikuti.
- API key dienkripsi AES-256-GCM dengan kunci turunan (HKDF-SHA256) dari `SESSION_SECRET`, disimpan di tabel `PortfolioConnection`, hanya ditampilkan tersamar (empat karakter terakhir), tidak pernah dikirim balik ke browser dan tidak dicatat di log. Jika `SESSION_SECRET` diganti, key tersimpan tidak terbaca dan harus diisi ulang.
- **Terputus**: feedback baru tetap tersimpan dan menunggu di antrean; tidak ada pengiriman. Sambungkan lagi untuk melanjutkan.
- **Tes koneksi** memanggil `GET <URL MCP>/health` tanpa key lebih dulu (membedakan masalah jaringan/DNS dari masalah key), lalu `tools/list` dengan key untuk memeriksa auth. Keduanya baca saja, jadi tidak membuat testimoni. Jika `tools/list` kosong, key tidak punya scope `feedback:write`. Hasilnya juga menyebut field yang belum didukung tool.

## Antrean dan penanganan error

Kolom `Feedback`: `id`, `syncStatus` (`QUEUED`/`SENT`/`FAILED`), `attempts`, `lastError`, `nextAttemptAt`, `remoteId`. Kolom `uncertain` dari versi lama tidak dipakai lagi (dibiarkan agar tanpa migrasi). `lastError` berisi penyebab, atau `penyebab|ringkasan` (mis. `invalid|name: terlalu pendek`).

Penyebab dipetakan dari `error.data.code` yang dikirim server portfolio (status HTTP hanya cadangan bila body bukan JSON-RPC). Retry hanya bila penyebabnya sementara dan server tidak menyatakan `retryable = false`, atau bila error jaringan/timeout.

| Penyebab | Kode server | Arti | Diulang? |
| --- | --- | --- | --- |
| `dns` | - | nama server tidak ditemukan | ya |
| `network` | - | koneksi gagal | ya |
| `timeout` | - | tidak ada jawaban dalam 10 detik | ya |
| `rate_limited` | `rate_limited` (429) | batas permintaan; `Retry-After` dihormati | ya |
| `server` | `internal` (5xx) | server portfolio bermasalah | ya, bila `retryable` bukan false |
| `unauthorized` | `unauthorized` (401) | API key ditolak | tidak |
| `forbidden_scope` | `forbidden_scope` (403) | key tanpa scope `feedback:write` | tidak |
| `invalid` | `invalid_params` (`isError` + `issues`) | isian ditolak; field dan pesannya tampil di admin | tidak |
| `protocol` | `parse_error`, `invalid_request`, `method_not_found` | permintaan tidak dikenali | tidak |

Jeda eksponensial dengan jitter: 30 dtk, 2 mnt, 8 mnt, 32 mnt, 2 jam (maksimal 5 percobaan, lalu `FAILED`). Satu baris hanya dikirim oleh satu pemroses (klaim atomik dengan lease 60 detik), dan baris `SENT` tidak pernah dikirim lagi. Penyebab spesifik ditampilkan di daftar Feedback admin.

## Kontrak portfolio

- **Idempotency**: id feedback lokal dikirim sebagai `idempotency_key` di setiap pengiriman dan retry. Balasan `duplicate: true` berarti key itu sudah diterima dan dianggap **berhasil** (`SENT`). Karena itu tidak ada lagi status "pengiriman tidak pasti"; **Kirim ulang** di admin aman dan tanpa konfirmasi.
- **Foto**: `avatar_url` hanya dikirim bila foto punya URL https publik yang permanen (maksimal 500 karakter, tanpa user:password). Foto profil disimpan di bucket Supabase privat dan hanya dibuka lewat signed URL yang kedaluwarsa (1 jam), jadi tidak punya URL permanen: `avatar_url` tidak dikirim dan portfolio menampilkan inisial.

## Anti-spam dan privasi

Honeypot, batas 3 kiriman per IP (di-hash) per 10 menit (di memori instance, jadi hanya pembatas ringan), checkbox persetujuan wajib, foto maksimal 2 MB (JPG/PNG/WebP, magic byte dicek lalu diubah ke WebP 256 px tanpa metadata). Log hanya mencatat kategori hasil, bukan key, isi, atau nama.

## Cron

Tambahkan `CRON_SECRET` (acak panjang) di environment Vercel agar Vercel Cron mengirim `Authorization: Bearer ...`. Tanpa itu, endpoint hanya bisa dipanggil admin yang sedang masuk. Jadwal harian dipilih agar cocok dengan paket Hobby.

## Rotasi key

1. Buat key baru di pengelolaan MCP portfolio.
2. Super Admin > MCP Server: tempel key baru, Simpan, lalu Tes koneksi.
3. Cabut key lama di server portfolio.


## Peran pengirim

Peran dipilih dari daftar umum (Mahasiswa, Pelajar, Engineer, Desainer, Pengusaha, Pendidik, Profesional, Lainnya). Setelah dipilih muncul isian detail (misalnya jurusan dan kampus). Keduanya disimpan digabung di kolom `role` (contoh: `Mahasiswa - Teknik Komputer di Universitas Syiah Kuala`). Saat dikirim ke portfolio, `role` dipotong 80 karakter sesuai batas tool `submit_feedback`; data lengkap tetap di database.


## Super Admin

Menu **Super Admin** (MCP Server dan Security) tampil di sidebar untuk semua pengunjung dengan ikon gembok. Membukanya meminta `SUPER_ADMIN_PASSWORD` (terpisah dari password admin; login admin tidak membukanya). Sesi super admin berlaku 15 menit, bisa dikunci lewat tombol **Kunci super admin**, dan dicek di server pada setiap API terkait. Koneksi portfolio ada di tab MCP Server; ganti password admin ada di tab Security.
