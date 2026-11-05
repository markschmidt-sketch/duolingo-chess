import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
// usage: crop.ts file top out cells(e.g. "0,0;0,1") scale
const [file, topS, out, cellsS, scaleS] = process.argv.slice(2);
const png = PNG.sync.read(readFileSync(file));
const top = +topS, cw = png.width / 8, sc = +(scaleS ?? 2);
const cells = cellsS.split(';').map((s) => s.split(',').map(Number));
const S = Math.round(cw);
const o = new PNG({ width: S * sc * cells.length, height: S * sc });
cells.forEach(([r, c], k) => {
  for (let y = 0; y < S * sc; y++) for (let x = 0; x < S * sc; x++) {
    const sx = Math.floor(c * cw + x / sc), sy = Math.floor(top + r * cw + y / sc);
    const si = (sy * png.width + sx) * 4, di = (y * o.width + k * S * sc + x) * 4;
    for (let j = 0; j < 4; j++) o.data[di + j] = png.data[si + j];
  }
});
writeFileSync(out, PNG.sync.write(o));
