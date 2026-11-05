/** Minimal RGBA image shared by the browser (ImageData) and Node tests (pngjs). */
export interface RGBAImage {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

export type RGB = [number, number, number];

export function dist2(a: RGB, r: number, g: number, b: number): number {
  const dr = a[0] - r;
  const dg = a[1] - g;
  const db = a[2] - b;
  return dr * dr + dg * dg + db * db;
}

export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function lum(c: RGB): number {
  return luminance(c[0], c[1], c[2]);
}

/** Most common color among the given pixels, using 4-bit-per-channel bins and returning the bin's mean color. */
export function dominantColor(pixels: number[][]): RGB {
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (const [r, g, b] of pixels) {
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = bins.get(k);
    if (e) {
      e.n++;
      e.r += r;
      e.g += g;
      e.b += b;
    } else bins.set(k, { n: 1, r, g, b });
  }
  let best = { n: 0, r: 0, g: 0, b: 0 };
  for (const e of bins.values()) if (e.n > best.n) best = e;
  return best.n ? [best.r / best.n, best.g / best.n, best.b / best.n] : [0, 0, 0];
}
