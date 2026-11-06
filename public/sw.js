/* PusakaPosters service worker.
 * - Navigasi: jaringan dulu; jika offline tampilkan /offline.
 * - Aset statis (/_next/static, /mediapipe, /icons): cache dulu.
 * - Tidak pernah men-cache /api, halaman admin, atau foto (signed URL Supabase kedaluwarsa
 *   dan berisi data pribadi), supaya tidak ada data anggota tersisa di perangkat bersama.
 * Naikkan VERSION saat file di /public/mediapipe berubah. */
const VERSION = 'pp-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png', '/brand/logo-mark-light.webp'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(PRECACHE);

      // Simpan CSS & font yang dipakai halaman offline agar tampil benar tanpa jaringan.
      try {
        const html = await (await fetch(OFFLINE_URL, { cache: 'reload' })).text();
        const urls = [...html.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+\.(?:css|woff2))"/g)].map((m) => m[1]);
        const assets = await caches.open(ASSET_CACHE);
        await Promise.all(urls.map((u) => assets.add(u).catch(() => {})));
      } catch {
        /* tidak fatal */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase & lainnya: biarkan langsung ke jaringan
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
    );
    return;
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/mediapipe/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/brand/')
  ) {
    event.respondWith(cacheFirst(request));
  }
});
