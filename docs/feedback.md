# Feedback ke portfolio

## Arsitektur

Halaman publik `/masukan` menampilkan form yang tidak memerlukan sesi admin. Route `POST /api/feedback` memeriksa origin, batas body 8 KiB, format JSON, persetujuan, dan validasi Zod. Route membatasi tiga kiriman per alamat IP yang di-hash setiap 10 menit, lalu meneruskan hanya field yang diisi pada form ke server MCP portfolio. Nilai `project` ditetapkan server sebagai `PusakaPosters`; `consent` dan honeypot tidak diteruskan. Masukan tidak disimpan ke database PusakaPosters. Portfolio menerima testimoni berstatus pending untuk ditinjau pemilik sebelum dipublikasikan.

Limiter mengikuti utilitas in-memory aplikasi, sehingga hitungan per instance tidak tersinkron antar fungsi serverless. Batas efektif dapat lebih longgar ketika permintaan tersebar di beberapa instance; gunakan limiter bersama seperti Vercel Firewall atau Upstash bila dibutuhkan perlindungan terdistribusi.

## Konfigurasi

Tambahkan hanya pada environment server lokal dan deployment:

```dotenv
PORTFOLIO_MCP_URL="https://alfizilham.vercel.app/api/mcp"
PORTFOLIO_MCP_API_KEY=""
```

Jangan tambahkan prefix `NEXT_PUBLIC_`, jangan kirim key ke browser, dan jangan commit nilai rahasia. Jika URL atau key tidak dikonfigurasi, API mengembalikan pesan layanan yang sama dengan kegagalan upstream.

## Hasil dan pesan API

| Hasil upstream | HTTP lokal | Pesan/hasil |
| --- | ---: | --- |
| `ok` dengan id string dan status `pending` | 200 | `{ "ok": true }`; id tidak dikirim ke klien. |
| `invalid` (tool melaporkan `isError`) | 400 | Periksa kembali isian masukan. |
| `rate-limited` (batas lokal atau upstream) | 429 | Coba lagi nanti; respons lokal menyertakan `Retry-After`. |
| `unauthorized`, `unavailable`, `not-configured` | 503 | Masukan belum dapat dikirim saat ini. Coba lagi beberapa saat lagi. |
| Body invalid, consent tidak `true`, atau validasi field gagal | 400 | Periksa kembali isian masukan. |
| Honeypot terisi | 200 | Diakui seolah sukses tanpa meneruskan ke MCP. |

Pemanggilan MCP memakai timeout 10 detik dan tidak melakukan retry otomatis. Respons upstream dan key tidak dicatat ke log. Route tidak menyimpan isi masukan atau alamat IP mentah.

## Privasi dan publikasi

Hanya nama, peran, instansi, rating, isi masukan, dan konstanta project yang dikirim. Tidak ada roster, nomor telepon, atau foto anggota yang dikirim. Persetujuan wajib menyebutkan bahwa isi dan nama/peran boleh ditampilkan di portfolio. Portfolio tetap menahan kiriman sebagai pending hingga Alfiz menyetujuinya.

## Risiko kirim ganda

Server portfolio belum mendukung idempotency. Jika permintaan melewati timeout setelah berhasil tersimpan, aplikasi menampilkan kegagalan tetapi tidak mengirim ulang otomatis. Pengguna yang mengirim lagi secara manual dapat membuat testimoni pending ganda; periksa dashboard portfolio sebelum mengulangi kiriman yang hasilnya tidak pasti.

## Rotasi API key

Buat atau rotasi key dari pengelolaan MCP portfolio, perbarui `PORTFOLIO_MCP_API_KEY` pada environment lokal/deployment, lalu redeploy agar fungsi server memakai key baru. Hapus atau cabut key lama setelah key baru aktif. Jangan mencantumkannya di issue, log, atau client-side environment.
