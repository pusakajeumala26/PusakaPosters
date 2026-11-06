// Menyalin model & WASM MediaPipe Selfie Segmentation dari node_modules ke public/
// supaya di-host sendiri (tanpa CDN), bisa di-cache oleh service worker.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', '@mediapipe', 'selfie_segmentation');
const dest = join(root, 'public', 'mediapipe', 'selfie_segmentation');

if (!existsSync(src)) {
  console.warn('[copy-mediapipe] paket @mediapipe/selfie_segmentation tidak ditemukan, dilewati.');
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
let copied = 0;
for (const file of readdirSync(src)) {
  if (/\.(js|wasm|tflite|binarypb)$/.test(file)) {
    cpSync(join(src, file), join(dest, file));
    copied += 1;
  }
}
console.log(`[copy-mediapipe] ${copied} file disalin ke public/mediapipe/selfie_segmentation`);
