import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

// Paket asli @mediapipe/selfie_segmentation adalah bundel UMD yang tidak aman
// di-bundle. Skripnya dimuat dari /public/mediapipe (lihat src/lib/segment.ts);
// import di dalam body-segmentation diarahkan ke shim kecil ini.
const shim = path.join(dir, 'src/lib/mediapipe-shim.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@mediapipe/selfie_segmentation': shim,
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      '@mediapipe/selfie_segmentation': './src/lib/mediapipe-shim.js',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/mediapipe/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
