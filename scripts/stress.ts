import { loadFixtures, Fixture } from './fixtures';
import { locateBoard } from '../src/vision/locateBoard';
import { cellFeature } from '../src/vision/features';
import { classifyCell, Template } from '../src/vision/classify';
import type { RGBAImage } from '../src/vision/image';

function resize(img: RGBAImage, w: number): RGBAImage {
  const s = img.width / w, h = Math.round(img.height / s);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // box filter
    const x0 = Math.floor(x * s), x1 = Math.max(x0 + 1, Math.floor((x + 1) * s));
    const y0 = Math.floor(y * s), y1 = Math.max(y0 + 1, Math.floor((y + 1) * s));
    const acc = [0, 0, 0, 0]; let n = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const i = (Math.min(yy, img.height - 1) * img.width + Math.min(xx, img.width - 1)) * 4;
      for (let k = 0; k < 4; k++) acc[k] += img.data[i + k]; n++;
    }
    const o = (y * w + x) * 4; for (let k = 0; k < 4; k++) out[o + k] = acc[k] / n;
  }
  return { width: w, height: h, data: out };
}
function tint(img: RGBAImage, f: Fixture, cells: [number, number][]): RGBAImage {
  const b = locateBoard(img)!; const cw = b.size / 8; const data = new Uint8ClampedArray(img.data);
  for (const [r, c] of cells) for (let y = Math.round(b.y + r * cw); y < Math.round(b.y + (r + 1) * cw); y++)
    for (let x = Math.round(c * cw); x < Math.round((c + 1) * cw); x++) {
      const i = (y * img.width + x) * 4; const px = [data[i], data[i + 1], data[i + 2]];
      const isBg = Math.abs(px[0] - px[2]) < 6 && px[0] > 236; // plain light-square pixels
      if (isBg) { data[i] = 247; data[i + 1] = 236; data[i + 2] = 190; }
    }
  return { ...img, data };
}
const fx = loadFixtures();
function feats(img: RGBAImage) {
  const b = locateBoard(img); if (!b) return null; const cw = b.size / 8;
  return Array.from({ length: 64 }, (_, k) => cellFeature(img, b.x + (k % 8) * cw, b.y + Math.floor(k / 8) * cw, cw));
}
const base = new Map(fx.map((f) => [f.name, feats(f.img)!]));
const tplExcept = (name: string): Template[] => fx.filter((f) => f.name !== name).flatMap((f) => base.get(f.name)!.map((feature, k) => ({ label: f.screen[Math.floor(k / 8)][k % 8], feature })));
function check(label: string, f: Fixture, img: RGBAImage) {
  const fs = feats(img); if (!fs) { console.log(`${label} ${f.name}: BOARD NOT FOUND`); return false; }
  const tpl = tplExcept(f.name); let bad = 0, minM = 9;
  fs.forEach((feat, k) => { const g = classifyCell(feat, tpl); const t = f.screen[Math.floor(k / 8)][k % 8]; if (g.label !== t) { bad++; console.log(`   ✗ ${label} ${f.name} k${k} ${t}->${g.label}`); } else if (t !== '.') minM = Math.min(minM, g.margin); });
  if (bad) console.log(`${label} ${f.name}: ${bad} wrong`);
  return bad === 0 ? minM : -1;
}
for (const w of [1320, 1290, 1179, 1080, 828, 750, 600]) {
  let ok = 0, minM = 9;
  for (const f of fx) { const m = check(`w${w}`, f, resize(f.img, w)); if (m !== false && m >= 0) { ok++; minM = Math.min(minM, m as number); } }
  console.log(`width ${w}: ${ok}/${fx.length} fixtures exact, min margin ${minM.toFixed(4)}`);
}
const light = fx.find((f) => f.name === 'IMG_8462')!;
// tint an empty light square (e4 → r4c4 screen), and an occupied light square (a8 r0c0 is light) plus e2 pawn (r6c4 light)
const m = check('tint', light, tint(light.img, light, [[4, 4], [0, 0], [6, 4], [5, 3]]));
console.log('light-mode highlight synthetic:', m === false || m < 0 ? 'FAIL' : `ok, min margin ${(m as number).toFixed(4)}`);
