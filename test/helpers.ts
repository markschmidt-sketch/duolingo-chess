import type { RGBAImage } from '../src/vision/image';
import { locateBoard } from '../src/vision/locateBoard';

/** Box-filter downscale, approximating a screenshot from a smaller iPhone. */
export function resize(img: RGBAImage, w: number): RGBAImage {
  const s = img.width / w;
  const h = Math.round(img.height / s);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * s), x1 = Math.max(x0 + 1, Math.floor((x + 1) * s));
      const y0 = Math.floor(y * s), y1 = Math.max(y0 + 1, Math.floor((y + 1) * s));
      const acc = [0, 0, 0, 0];
      let n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const i = (Math.min(yy, img.height - 1) * img.width + Math.min(xx, img.width - 1)) * 4;
          for (let k = 0; k < 4; k++) acc[k] += img.data[i + k];
          n++;
        }
      const o = (y * w + x) * 4;
      for (let k = 0; k < 4; k++) out[o + k] = acc[k] / n;
    }
  return { width: w, height: h, data: out };
}

/** Paint a warm "last move" tint over the plain background pixels of the given screen cells. */
export function tintCells(img: RGBAImage, cells: [number, number][], rgb: [number, number, number]): RGBAImage {
  const b = locateBoard(img)!;
  const cw = b.size / 8;
  const data = new Uint8ClampedArray(img.data);
  for (const [r, c] of cells) {
    const bg = [b.light, b.dark][(r + c) % 2];
    for (let y = Math.round(b.y + r * cw); y < Math.round(b.y + (r + 1) * cw); y++)
      for (let x = Math.round(b.x + c * cw); x < Math.round(b.x + (c + 1) * cw); x++) {
        const i = (y * img.width + x) * 4;
        if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) < 8) {
          data[i] = rgb[0];
          data[i + 1] = rgb[1];
          data[i + 2] = rgb[2];
        }
      }
  }
  return { ...img, data };
}

/** What a browser canvas returns for a Display P3 PNG: pixels converted to sRGB (clipped). */
export function p3ToSrgb(img: RGBAImage): RGBAImage {
  const lin = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    lin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  const enc = (v: number) => {
    v = Math.min(1, Math.max(0, v));
    return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
  };
  const data = new Uint8ClampedArray(img.data.length);
  for (let i = 0; i < data.length; i += 4) {
    const r = lin[img.data[i]], g = lin[img.data[i + 1]], b = lin[img.data[i + 2]];
    data[i] = enc(1.2249 * r - 0.2247 * g);
    data[i + 1] = enc(-0.042 * r + 1.0419 * g);
    data[i + 2] = enc(-0.0197 * r - 0.0786 * g + 1.0979 * b);
    data[i + 3] = img.data[i + 3];
  }
  return { ...img, data };
}
