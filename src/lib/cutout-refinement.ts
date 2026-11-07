/** Pixel-only matte cleanup. Kept free of DOM APIs so browser code and tests share it. */
export type RefinementOptions = {
  erodeRadius?: number;
  dilateRadius?: number;
  edgeBandRadius?: number;
  localRadius?: number;
  backgroundVarianceLimit?: number;
  despillTolerance?: number;
  choke?: number;
  minVisibleAlpha?: number;
};

const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const pixel = (x: number, y: number, width: number) => y * width + x;

function confidenceChannel(mask: ImageData) {
  let minA = 255;
  let maxA = 0;
  for (let i = 3; i < mask.data.length; i += 4) {
    minA = Math.min(minA, mask.data[i]);
    maxA = Math.max(maxA, mask.data[i]);
  }
  return maxA - minA > 12 ? 3 : 0;
}

/** Bilinear resize to retain model confidence between sampled pixels. */
export function upsampleMaskBilinear(mask: ImageData, width: number, height: number): Float32Array {
  const channel = confidenceChannel(mask);
  const out = new Float32Array(width * height);
  const sx = mask.width / width;
  const sy = mask.height / height;
  for (let y = 0; y < height; y++) {
    const fy = Math.max(0, (y + 0.5) * sy - 0.5);
    const y0 = Math.floor(fy);
    const y1 = Math.min(mask.height - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.max(0, (x + 0.5) * sx - 0.5);
      const x0 = Math.floor(fx);
      const x1 = Math.min(mask.width - 1, x0 + 1);
      const wx = fx - x0;
      const at = (xx: number, yy: number) => mask.data[(pixel(xx, yy, mask.width) << 2) + channel] / 255;
      const top = at(x0, y0) * (1 - wx) + at(x1, y0) * wx;
      const bottom = at(x0, y1) * (1 - wx) + at(x1, y1) * wx;
      out[pixel(x, y, width)] = top * (1 - wy) + bottom * wy;
    }
  }
  return out;
}

function boxCount(binary: Uint8Array, width: number, height: number, radius: number) {
  const stride = width + 1;
  const sums = new Uint32Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y++) {
    let row = 0;
    for (let x = 1; x <= width; x++) {
      row += binary[pixel(x - 1, y - 1, width)];
      sums[y * stride + x] = sums[(y - 1) * stride + x] + row;
    }
  }
  const out = new Uint32Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      out[pixel(x, y, width)] = sums[y1 * stride + x1] - sums[y0 * stride + x1] - sums[y1 * stride + x0] + sums[y0 * stride + x0];
    }
  }
  return out;
}

/** Keep the largest 8-connected region above the soft foreground floor. */
function largestComponent(probability: Float32Array, width: number, height: number) {
  const size = width * height;
  const seen = new Uint8Array(size);
  const queue = new Int32Array(size);
  let best: number[] = [];
  for (let start = 0; start < size; start++) {
    if (seen[start] || probability[start] <= 0.1) continue;
    let head = 0;
    let tail = 0;
    const component: number[] = [];
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const current = queue[head++];
      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const next = pixel(nx, ny, width);
        if (!seen[next] && probability[next] > 0.1) {
          seen[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (component.length > best.length) best = component;
  }
  const keep = new Uint8Array(size);
  for (const index of best) keep[index] = 1;
  return keep;
}

/** Multi-source 8-neighbor flood that tags each pixel with its nearest sure pixel. */
function nearestSure(seeds: Uint8Array, width: number, height: number) {
  const size = width * height;
  const nearest = new Int32Array(size).fill(-1);
  const queue = new Int32Array(size);
  let tail = 0;
  for (let i = 0; i < size; i++) if (seeds[i]) {
    nearest[i] = i;
    queue[tail++] = i;
  }
  for (let head = 0; head < tail; head++) {
    const current = queue[head];
    const x = current % width;
    const y = Math.floor(current / width);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const next = pixel(nx, ny, width);
      if (nearest[next] < 0) {
        nearest[next] = nearest[current];
        queue[tail++] = next;
      }
    }
  }
  return nearest;
}

type LocalColor = { color: [number, number, number]; variance: number };
function localMedian(image: ImageData, seeds: Uint8Array, seed: number, radius: number): LocalColor {
  const { width, height, data } = image;
  const x = seed % width;
  const y = Math.floor(seed / width);
  const channels: [number[], number[], number[]] = [[], [], []];
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    const at = pixel(nx, ny, width);
    if (!seeds[at]) continue;
    const i = at << 2;
    channels[0].push(data[i]); channels[1].push(data[i + 1]); channels[2].push(data[i + 2]);
  }
  if (!channels[0].length) {
    const i = seed << 2;
    return { color: [data[i], data[i + 1], data[i + 2]], variance: 0 };
  }
  const color = channels.map((values) => {
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  }) as [number, number, number];
  const variance = channels.reduce((sum, values, channel) => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return sum + values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  }, 0) / 3;
  return { color, variance };
}

/** Refine a soft person mask and remove local backdrop color on the edge. */
export function refinePersonMask(source: ImageData, softMask: ImageData, options: RefinementOptions = {}): ImageData {
  const { width, height, data } = source;
  if (softMask.width < 1 || softMask.height < 1 || data.length !== width * height * 4) throw new Error('Ukuran gambar/mask tidak valid.');
  const probability = upsampleMaskBilinear(softMask, width, height);
  const keep = largestComponent(probability, width, height);
  const size = width * height;
  for (let i = 0; i < size; i++) if (!keep[i]) probability[i] = 0;

  const scale = Math.max(0.4, Math.max(width, height) / 1600);
  const erodeRadius = options.erodeRadius ?? Math.max(1, Math.min(4, Math.round(2.5 * scale)));
  const dilateRadius = options.dilateRadius ?? Math.max(2, Math.min(8, Math.round(5 * scale)));
  const localRadius = options.localRadius ?? 4;
  const confidentFront = new Uint8Array(size);
  const possibleFront = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    confidentFront[i] = probability[i] > 0.9 ? 1 : 0;
    possibleFront[i] = probability[i] > 0.1 ? 1 : 0;
  }
  const frontCounts = boxCount(confidentFront, width, height, erodeRadius);
  const possibleCounts = boxCount(possibleFront, width, height, dilateRadius);
  const frontSure = new Uint8Array(size);
  const backgroundSure = new Uint8Array(size);
  const kernelArea = (2 * erodeRadius + 1) ** 2;
  const edgeBandRadius = options.edgeBandRadius ?? Math.max(8, Math.min(28, Math.round(Math.max(width, height) * 0.018)));
  const edgeKernelArea = (2 * edgeBandRadius + 1) ** 2;
  for (let i = 0; i < size; i++) {
    frontSure[i] = frontCounts[i] === kernelArea ? 1 : 0;
    backgroundSure[i] = possibleCounts[i] === 0 ? 1 : 0;
  }
  const nearEdgeCounts = boxCount(possibleFront, width, height, edgeBandRadius);
  const edgeBand = new Uint8Array(size);
  for (let i = 0; i < size; i++) edgeBand[i] = possibleFront[i] && nearEdgeCounts[i] < edgeKernelArea ? 1 : 0;
  const hasFront = frontSure.some((v) => v === 1);
  const hasBackground = backgroundSure.some((v) => v === 1);
  const result = new ImageData(new Uint8ClampedArray(data), width, height);

  if (!hasFront || !hasBackground) {
    for (let i = 0; i < size; i++) result.data[(i << 2) + 3] = Math.round(clamp(probability[i]) * 255);
    return result;
  }

  // A deeper foreground seed gives a cleaner F estimate when the model over-trusts a colored fringe.
  const deepFrontCounts = boxCount(frontSure, width, height, erodeRadius);
  const deepFront = new Uint8Array(size);
  for (let i = 0; i < size; i++) deepFront[i] = deepFrontCounts[i] === kernelArea ? 1 : 0;
  const nearestFront = nearestSure(deepFront.some((v) => v === 1) ? deepFront : frontSure, width, height);
  const nearestBackground = nearestSure(backgroundSure, width, height);
  const frontCache = new Map<number, LocalColor>();
  const backgroundCache = new Map<number, LocalColor>();
  const alpha = new Float32Array(size);
  const choke = options.choke ?? 0.035;
  const varianceLimit = options.backgroundVarianceLimit ?? 900;
  const despillTolerance = options.despillTolerance ?? 14;
  const minVisibleAlpha = options.minVisibleAlpha ?? 0.06;

  for (let i = 0; i < size; i++) {
    const modelAlpha = clamp(probability[i]);
    if (frontSure[i] && !edgeBand[i]) { alpha[i] = 1; continue; }
    if (backgroundSure[i]) { alpha[i] = 0; continue; }
    const fSeed = nearestFront[i];
    const bSeed = nearestBackground[i];
    if (fSeed < 0 || bSeed < 0) { alpha[i] = modelAlpha; continue; }
    let foreground = frontCache.get(fSeed);
    if (!foreground) {
      foreground = localMedian(source, frontSure, fSeed, localRadius);
      frontCache.set(fSeed, foreground);
    }
    let background = backgroundCache.get(bSeed);
    if (!background) {
      background = localMedian(source, backgroundSure, bSeed, localRadius);
      backgroundCache.set(bSeed, background);
    }
    const noisyBackground = background.variance > varianceLimit;

    const at = i << 2;
    const v = [data[at], data[at + 1], data[at + 2]];
    const delta = foreground.color.map((channel, c) => channel - background!.color[c]);
    const denom = delta.reduce((sum, d) => sum + d * d, 0);
    const projected = denom < 64 ? modelAlpha : clamp(v.reduce((sum, channel, c) => sum + (channel - background!.color[c]) * delta[c], 0) / denom);
    if (noisyBackground) alpha[i] = clamp(modelAlpha - choke);
    else if (edgeBand[i] && modelAlpha > 0.6 && projected < 0.04) alpha[i] = 0;
    else if (edgeBand[i]) alpha[i] = clamp(projected * 0.9 + modelAlpha * 0.1 - choke);
    else alpha[i] = clamp(projected * 0.78 + modelAlpha * 0.22 - choke);

    const a = alpha[i];
    const recovered = a < 0.12
      ? [...foreground.color]
      : v.map((channel, c) => clamp((channel - (1 - a) * background!.color[c]) / a, 0, 255));
    const bg = background.color;
    const dominant = bg.indexOf(Math.max(...bg));
    const otherAverage = (recovered[(dominant + 1) % 3] + recovered[(dominant + 2) % 3]) / 2;
    const otherBackgroundAverage = (bg[(dominant + 1) % 3] + bg[(dominant + 2) % 3]) / 2;
    const dominantIsBackdrop = bg[dominant] > otherBackgroundAverage + 20;
    if (dominantIsBackdrop && a < 0.999) recovered[dominant] = Math.min(recovered[dominant], otherAverage + despillTolerance);
    result.data[at] = Math.round(clamp(recovered[0] / 255, 0, 1) * 255);
    result.data[at + 1] = Math.round(clamp(recovered[1] / 255, 0, 1) * 255);
    result.data[at + 2] = Math.round(clamp(recovered[2] / 255, 0, 1) * 255);
  }

  // Sub-pixel feather: blend a small 3x3 average only into uncertain alpha.
  const feather = new Float32Array(alpha);
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = pixel(x, y, width);
    if (frontSure[i] || backgroundSure[i]) continue;
    let sum = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += alpha[pixel(x + dx, y + dy, width)];
    feather[i] = alpha[i] * 0.8 + (sum / 9) * 0.2;
  }
  for (let i = 0; i < size; i++) {
    const at = i << 2;
    if (feather[i] < minVisibleAlpha) feather[i] = 0;
    if (feather[i] === 0 && nearestFront[i] >= 0) {
      const seed = nearestFront[i];
      let foreground = frontCache.get(seed);
      if (!foreground) {
        foreground = localMedian(source, frontSure, seed, localRadius);
        frontCache.set(seed, foreground);
      }
      result.data[at] = foreground.color[0];
      result.data[at + 1] = foreground.color[1];
      result.data[at + 2] = foreground.color[2];
    }
    result.data[at + 3] = Math.round(clamp(feather[i]) * 255);
  }
  // Include the just-feathered sub-pixel ring (including pixels that began as sure background).
  for (let i = 0; i < size; i++) {
    if (feather[i] <= 0 || feather[i] >= 0.999 || nearestBackground[i] < 0) continue;
    const seed = nearestBackground[i];
    let background = backgroundCache.get(seed);
    if (!background) {
      background = localMedian(source, backgroundSure, seed, localRadius);
      backgroundCache.set(seed, background);
    }
    const bg = background.color;
    const dominant = bg.indexOf(Math.max(...bg));
    const otherBgAvg = (bg[(dominant + 1) % 3] + bg[(dominant + 2) % 3]) / 2;
    if (bg[dominant] <= otherBgAvg + 20) continue;
    const at = i << 2;
    const otherAvg = (result.data[at + ((dominant + 1) % 3)] + result.data[at + ((dominant + 2) % 3)]) / 2;
    result.data[at + dominant] = Math.min(result.data[at + dominant], Math.floor(otherAvg + despillTolerance));
  }
  return result;
}
