// Shim untuk '@mediapipe/selfie_segmentation' (lihat next.config.mjs).
// Skrip aslinya dimuat dari /mediapipe/selfie_segmentation/selfie_segmentation.js
// oleh src/lib/segment.ts, yang memasang kelas global window.SelfieSegmentation.
export function SelfieSegmentation(config) {
  const Ctor = typeof window !== 'undefined' ? window.SelfieSegmentation : undefined;
  if (!Ctor) throw new Error('MediaPipe SelfieSegmentation belum dimuat.');
  return new Ctor(config);
}

export const VERSION = 'self-hosted';
