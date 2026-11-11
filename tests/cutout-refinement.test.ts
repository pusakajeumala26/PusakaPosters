import assert from 'node:assert/strict';
import { test } from 'node:test';
import { refinePersonMask, upsampleMaskBilinear } from '../src/lib/cutout-refinement';

class TestImageData {
  data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}
Object.defineProperty(globalThis, 'ImageData', { configurable: true, value: TestImageData });

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

function fixture(backdrop: 'blue' | 'red') {
  const width = 128;
  const height = 96;
  const maskWidth = 32;
  const maskHeight = 24;
  const bg: [number, number, number] = backdrop === 'blue' ? [25, 80, 220] : [220, 40, 45];
  const skin: [number, number, number] = [218, 160, 128];
  const imageData = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dx = (x + 0.5 - width / 2) / 30;
    const dy = (y + 0.5 - height / 2) / 39;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const alpha = smoothstep(1.025, 0.965, distance);
    const index = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) imageData[index + c] = Math.round(skin[c] * alpha + bg[c] * (1 - alpha));
    imageData[index + 3] = 255;
  }
  const maskData = new Uint8ClampedArray(maskWidth * maskHeight * 4);
  for (let y = 0; y < maskHeight; y++) for (let x = 0; x < maskWidth; x++) {
    const dx = (x + 0.5 - maskWidth / 2) / 7.5;
    const dy = (y + 0.5 - maskHeight / 2) / 9.75;
    const probability = smoothstep(1.18, 0.82, Math.sqrt(dx * dx + dy * dy));
    const index = (y * maskWidth + x) * 4;
    const value = Math.round(probability * 255);
    maskData[index] = value;
    maskData[index + 1] = value;
    maskData[index + 2] = value;
    maskData[index + 3] = 255;
  }
  // Deliberate disconnected background fleck in the lower corner.
  for (let y = maskHeight - 3; y < maskHeight; y++) for (let x = 0; x < 4; x++) {
    const index = (y * maskWidth + x) * 4;
    maskData[index] = maskData[index + 1] = maskData[index + 2] = 200;
  }
  return {
    source: new ImageData(imageData, width, height),
    mask: new ImageData(maskData, maskWidth, maskHeight),
    backdrop: bg,
  };
}

function fringeMetrics(image: ImageData, backdrop: [number, number, number]) {
  const dominant = backdrop.indexOf(Math.max(...backdrop));
  const scores: number[] = [];
  for (let i = 0; i < image.data.length; i += 4) {
    const alpha = image.data[i + 3];
    if (alpha === 0 || alpha === 255) continue;
    const pixel = [image.data[i], image.data[i + 1], image.data[i + 2]];
    const others = (pixel[(dominant + 1) % 3] + pixel[(dominant + 2) % 3]) / 2;
    const score = Math.max(0, pixel[dominant] - others - 14);
    scores.push(score);
  }
  return {
    edgePixels: scores.length,
    fringePixels: scores.filter((v) => v > 0).length,
    maxDominanceOverTolerance: Math.round(Math.max(0, ...scores) * 100) / 100,
  };
}

for (const backdrop of ['blue', 'red'] as const) {
  test(`removes ${backdrop} spill from a soft-edge synthetic portrait`, (t) => {
    const { source, mask, backdrop: color } = fixture(backdrop);
    const baselineData = new Uint8ClampedArray(source.data);
    const baselineAlpha = upsampleMaskBilinear(mask, source.width, source.height);
    for (let i = 0; i < baselineAlpha.length; i++) baselineData[(i << 2) + 3] = Math.round(baselineAlpha[i] * 255);
    const baseline = new ImageData(baselineData, source.width, source.height);
    const before = fringeMetrics(baseline, color);
    const refined = refinePersonMask(source, mask);
    const after = fringeMetrics(refined, color);
    console.log(`[${backdrop}] fringe metrics before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
    assert.ok(before.fringePixels > 0, 'fixture should expose color spill before refinement');
    assert.equal(after.fringePixels, 0, 'refined edge must stay within the despill tolerance');
    assert.equal(after.maxDominanceOverTolerance, 0);
    assert.equal(refined.data[(95 * 128) * 4 + 3], 0, 'isolated corner component should be removed');
  });
}

test('keeps teal jacket color inside the edge band on a blue backdrop', () => {
  const width = 256;
  const height = 192;
  const maskWidth = 64;
  const maskHeight = 48;
  const jacket = [20, 130, 110];
  const backdrop = [0, 0, 255];
  const left = 40;
  const right = 216;
  const top = 30;
  const alphaAt = (x: number, y: number) => {
    const edge = Math.min(x + 0.5 - left, right - x - 0.5, y + 0.5 - top);
    return smoothstep(-0.75, 0.75, edge);
  };
  const imageData = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const a = alphaAt(x, y);
    const index = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) imageData[index + c] = Math.round(jacket[c] * a + backdrop[c] * (1 - a));
    imageData[index + 3] = 255;
  }
  const maskData = new Uint8ClampedArray(maskWidth * maskHeight * 4);
  for (let y = 0; y < maskHeight; y++) for (let x = 0; x < maskWidth; x++) {
    const edge = Math.min((x + 0.5) * 4 - left, right - (x + 0.5) * 4, (y + 0.5) * 4 - top);
    const value = Math.round(smoothstep(-5, 5, edge) * 255);
    const index = (y * maskWidth + x) * 4;
    maskData[index] = maskData[index + 1] = maskData[index + 2] = value;
    maskData[index + 3] = 255;
  }
  const refined = refinePersonMask(new ImageData(imageData, width, height), new ImageData(maskData, maskWidth, maskHeight));
  let checked = 0;
  for (let y = top + 4; y < top + 14; y++) for (let x = left + 14; x < right - 14; x++) {
    const index = (y * width + x) * 4;
    checked++;
    assert.ok(refined.data[index + 3] >= 250, `edge-band pixel (${x},${y}) must stay opaque`);
    for (let c = 0; c < 3; c++) {
      assert.ok(Math.abs(refined.data[index + c] - jacket[c]) <= 6, `edge-band pixel (${x},${y}) channel ${c} must keep the jacket color`);
    }
  }
  assert.ok(checked > 1000);
});

test('bilinear mask upscale preserves intermediate probabilities', () => {
  const data = new Uint8ClampedArray([
    0, 0, 0, 255, 255, 255, 255, 255,
    0, 0, 0, 255, 255, 255, 255, 255,
  ]);
  const mask = new ImageData(data, 2, 2);
  const scaled = upsampleMaskBilinear(mask, 4, 4);
  assert.ok(scaled.some((value) => value > 0.1 && value < 0.9));
});
