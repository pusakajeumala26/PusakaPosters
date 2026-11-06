/**
 * Segmentasi orang (hapus background) di browser memakai TensorFlow.js
 * (@tensorflow-models/body-segmentation, model MediaPipe Selfie Segmentation).
 * Semua dimuat lazy lewat import() supaya tidak membebani bundel awal halaman.
 */

type BodySegmentationModule = typeof import('@tensorflow-models/body-segmentation');
type Segmenter = Awaited<ReturnType<BodySegmentationModule['createSegmenter']>>;

const SOLUTION_PATH = '/mediapipe/selfie_segmentation';

export class NoPersonError extends Error {
  constructor() {
    super('Orang tidak terdeteksi di foto. Pastikan wajah dan badan terlihat jelas.');
  }
}

let scriptPromise: Promise<void> | null = null;
let segmenterPromise: Promise<Segmenter> | null = null;

/** Muat skrip MediaPipe (UMD) dari /public; ia memasang window.SelfieSegmentation. */
function loadMediapipeScript(): Promise<void> {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = `${SOLUTION_PATH}/selfie_segmentation.js`;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Gagal memuat model segmentasi. Periksa koneksi lalu coba lagi.'));
    document.head.appendChild(el);
  }).catch((e) => {
    scriptPromise = null;
    throw e;
  });
  return scriptPromise;
}

export function getSegmenter(): Promise<Segmenter> {
  segmenterPromise ??= (async () => {
    const [tf, bodySegmentation] = await Promise.all([
      import('@tensorflow/tfjs-core'),
      import('@tensorflow-models/body-segmentation'),
    ]);
    await import('@tensorflow/tfjs-backend-webgl');
    await tf.ready();

    const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;

    if (process.env.NEXT_PUBLIC_SEGMENTER_RUNTIME === 'tfjs') {
      // Inferensi benar-benar berjalan di TF.js (WebGL). Model diunduh dari TF Hub,
      // atau dari NEXT_PUBLIC_SEGMENTER_MODEL_URL jika kamu host sendiri.
      await import('@tensorflow/tfjs-converter');
      const modelUrl = process.env.NEXT_PUBLIC_SEGMENTER_MODEL_URL;
      return bodySegmentation.createSegmenter(model, {
        runtime: 'tfjs',
        modelType: 'general',
        ...(modelUrl ? { modelUrl } : {}),
      });
    }

    await loadMediapipeScript();
    return bodySegmentation.createSegmenter(model, {
      runtime: 'mediapipe',
      modelType: 'general',
      solutionPath: SOLUTION_PATH,
    });
  })().catch((e) => {
    segmenterPromise = null;
    throw e;
  });
  return segmenterPromise;
}

/** Peta keyakinan "ini orang" untuk sebuah canvas (ImageData; ukuran mengikuti model). */
export async function segmentPerson(canvas: HTMLCanvasElement): Promise<ImageData> {
  const segmenter = await getSegmenter();
  const people = await segmenter.segmentPeople(canvas, { flipHorizontal: false });
  const first = people[0];
  if (!first) throw new NoPersonError();
  return first.mask.toImageData();
}

/** Mulai unduh model di latar belakang (dipanggil saat modal upload dibuka). */
export function preloadSegmenter() {
  getSegmenter().catch(() => {});
}
