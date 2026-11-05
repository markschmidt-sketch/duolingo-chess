import { RGBAImage, RGB, dist2, dominantColor } from './image';

export interface BoardRect {
  x: number;
  y: number;
  size: number;
  /** Light / dark square colors measured from the board itself. */
  light: RGB;
  dark: RGB;
}

/** Two pixels this far apart (RGB euclidean) count as different square colors. */
const EDGE_DIFF = 9;
/** Pixels this close count as the same flat color. */
const FLAT = 10;

/**
 * Find the board in a Duolingo screenshot. Duolingo draws the board edge to edge,
 * so columns are known (width / 8) and only the vertical extent is unknown.
 *
 * A row belongs to the board when the color flips across most of the 7 inner column
 * boundaries while staying flat on each side. Pieces stay clear of the square edges,
 * so this holds even on fully occupied ranks. The board is the longest run of such
 * rows, which also works when a square color equals the page background.
 */
export function locateBoard(img: RGBAImage, x0 = 0, x1 = img.width): BoardRect | null {
  const size = x1 - x0;
  const cw = size / 8;
  const off = Math.max(2, Math.round(cw * 0.025));
  const hits = new Uint8Array(img.height);
  for (let y = 0; y < img.height; y++) {
    let n = 0;
    for (let c = 1; c < 8; c++) {
      const bx = Math.round(x0 + c * cw);
      const a = px(img, bx - off, y);
      const a2 = px(img, bx - off - 1, y);
      const b = px(img, bx + off, y);
      const b2 = px(img, bx + off + 1, y);
      if (d(a, a2) <= FLAT && d(b, b2) <= FLAT && d(a, b) >= EDGE_DIFF) n++;
    }
    hits[y] = n >= 5 ? 1 : 0;
  }

  // Longest run, bridging gaps of a few rows (anti-aliased rank boundaries).
  const gap = Math.max(3, Math.round(cw * 0.06));
  let bestStart = -1;
  let bestLen = 0;
  let start = -1;
  let last = -1;
  for (let y = 0; y <= img.height; y++) {
    if (y < img.height && hits[y]) {
      if (start < 0 || y - last > gap) start = y;
      last = y;
      if (last - start + 1 > bestLen) {
        bestLen = last - start + 1;
        bestStart = start;
      }
    }
  }
  if (bestStart < 0 || Math.abs(bestLen - size) > size * 0.04) return null;

  // The run can lose a row or two at either end, so center the square board on it.
  const y0 = Math.round(bestStart + (bestLen - size) / 2);
  return boardAt(img, clamp(y0, 0, img.height - Math.round(size)), x0, size);
}

/** Board at a known position (manual adjustment), with square colors measured from it. */
export function boardAt(img: RGBAImage, top: number, x0 = 0, size = img.width - x0): BoardRect {
  const cw = size / 8;
  // Measure square colors from parity groups of cell edge bands.
  const even: number[][] = [];
  const odd: number[][] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const band = edgeBand(img, x0 + c * cw, top + r * cw, cw);
      ((r + c) % 2 === 0 ? even : odd).push(...band);
    }
  return { x: x0, y: top, size, light: dominantColor(even), dark: dominantColor(odd) };
}

/** Pixels from the inner border strip of a cell (2%–7% in from each edge). */
export function edgeBand(img: RGBAImage, cx: number, cy: number, cw: number): number[][] {
  const out: number[][] = [];
  const i0 = Math.max(1, Math.round(cw * 0.02));
  const i1 = Math.max(i0 + 1, Math.round(cw * 0.07));
  const n = Math.round(cw);
  const step = Math.max(1, Math.round(cw / 48));
  for (let t = i0; t < n - i0; t += step)
    for (let k = i0; k < i1; k += 1) {
      out.push(px(img, cx + t, cy + k)); // top
      out.push(px(img, cx + t, cy + n - 1 - k)); // bottom
      out.push(px(img, cx + k, cy + t)); // left
      out.push(px(img, cx + n - 1 - k, cy + t)); // right
    }
  return out;
}

function px(img: RGBAImage, x: number, y: number): number[] {
  const xi = clamp(Math.round(x), 0, img.width - 1);
  const yi = clamp(Math.round(y), 0, img.height - 1);
  const i = (yi * img.width + xi) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

function d(a: number[], b: number[]): number {
  return Math.sqrt(dist2(a as RGB, b[0], b[1], b[2]));
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
