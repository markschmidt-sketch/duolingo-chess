import { RGBAImage, RGB, dist2, dominantColor, luminance } from './image';
import { edgeBand } from './locateBoard';

/** Side length of the normalized cell grid. */
export const GRID = 32;
/** Pixels further than this from the cell's own background are foreground. */
const FG_DIST = 14;

/**
 * Drop shadows are the background color scaled darker (k·bg) with no hue change.
 * On light squares the shadow is mild (k≈0.88) while black pieces are far darker
 * (k≈0.4), so the allowed range depends on how bright the background is.
 */
function isShadow(bg: RGB, r: number, g: number, b: number): boolean {
  const bb = bg[0] * bg[0] + bg[1] * bg[1] + bg[2] * bg[2];
  if (!bb) return false;
  const k = (r * bg[0] + g * bg[1] + b * bg[2]) / bb;
  const bright = luminance(bg[0], bg[1], bg[2]) > 128;
  if (k < (bright ? 0.78 : 0.3) || k > 0.98) return false;
  const res2 = dist2([k * bg[0], k * bg[1], k * bg[2]], r, g, b);
  return res2 < (bright ? 36 : 25);
}

export interface CellFeature {
  /** GRID*GRID foreground coverage in [0,1]. */
  mask: Float32Array;
  /** GRID*GRID mean luminance (0..1) of foreground pixels; 0 where there's no foreground. */
  gray: Float32Array;
  /** Fraction of the cell covered by foreground. */
  fill: number;
  /** Background color measured from the cell's edge band (not serialized). */
  bg?: RGB;
}

/**
 * Describe one board cell independently of its background color. The background is
 * measured from the cell's own edge band, so last-move highlights (any tint, any theme)
 * drop out the same way plain squares do.
 */
export function cellFeature(img: RGBAImage, cx: number, cy: number, cw: number): CellFeature {
  const bg: RGB = dominantColor(edgeBand(img, cx, cy, cw));
  const mask = new Float32Array(GRID * GRID);
  const gray = new Float32Array(GRID * GRID);
  const cnt = new Float32Array(GRID * GRID);
  const n = Math.floor(cw);
  const t2 = FG_DIST * FG_DIST;
  let fg = 0;
  for (let y = 0; y < n; y++) {
    const sy = Math.round(cy + y);
    const gy = Math.min(GRID - 1, Math.floor((y * GRID) / n));
    for (let x = 0; x < n; x++) {
      const sx = Math.round(cx + x);
      const gx = Math.min(GRID - 1, Math.floor((x * GRID) / n));
      const i = (sy * img.width + sx) * 4;
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      const k = gy * GRID + gx;
      cnt[k]++;
      if (dist2(bg, r, g, b) > t2 && !isShadow(bg, r, g, b)) {
        mask[k]++;
        gray[k] += luminance(r, g, b) / 255;
        fg++;
      }
    }
  }
  for (let k = 0; k < mask.length; k++) {
    if (mask[k] > 0) gray[k] /= mask[k];
    mask[k] /= cnt[k] || 1;
  }
  return { mask, gray, fill: fg / (n * n), bg };
}

/** Distance between two cells: silhouette difference plus shading difference where both have ink. */
export function featureDistance(a: CellFeature, b: CellFeature): number {
  let dm = 0;
  let dg = 0;
  let both = 0;
  for (let k = 0; k < a.mask.length; k++) {
    const m = a.mask[k] - b.mask[k];
    dm += m * m;
    const w = Math.min(a.mask[k], b.mask[k]);
    if (w > 0) {
      const g = a.gray[k] - b.gray[k];
      dg += w * g * g;
      both += w;
    }
  }
  return dm / a.mask.length + (both ? dg / both : 0.25);
}

/** Compact serialized form for templates.json (values quantized to bytes). */
export function encodeFeature(f: CellFeature): string {
  const bytes = new Uint8Array(f.mask.length * 2);
  for (let k = 0; k < f.mask.length; k++) {
    bytes[k] = Math.round(f.mask[k] * 255);
    bytes[f.mask.length + k] = Math.round(f.gray[k] * 255);
  }
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function decodeFeature(s: string): CellFeature {
  const bin = atob(s);
  const n = bin.length / 2;
  const mask = new Float32Array(n);
  const gray = new Float32Array(n);
  let fill = 0;
  for (let k = 0; k < n; k++) {
    mask[k] = bin.charCodeAt(k) / 255;
    gray[k] = bin.charCodeAt(n + k) / 255;
    fill += mask[k];
  }
  return { mask, gray, fill: fill / n };
}
