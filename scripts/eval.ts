import { loadFixtures } from './fixtures';
import { locateBoard } from '../src/vision/locateBoard';
import { cellFeature } from '../src/vision/features';
import { classifyCell, Template, EMPTY_FILL } from '../src/vision/classify';
const fx = loadFixtures();
const all: (Template & { r: number; c: number })[] = [];
const minFill: Record<string, number> = {}; let maxEmpty = 0;
for (const f of fx) {
  const b = locateBoard(f.img)!; const cw = b.size / 8;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const feat = cellFeature(f.img, b.x + c * cw, b.y + r * cw, cw);
    const label = f.screen[r][c];
    all.push({ label, feature: feat, source: f.name, r, c });
    if (label === '.') maxEmpty = Math.max(maxEmpty, feat.fill); else minFill[label] = Math.min(minFill[label] ?? 1, feat.fill);
  }
}
console.log('max empty fill', maxEmpty.toFixed(4), 'min piece fill', Object.entries(minFill).map(([k, v]) => k + v.toFixed(3)).join(' '), 'threshold', EMPTY_FILL);
let wrong = 0, total = 0; let minMargin = 9;
for (const f of fx) {
  const tpl = all.filter((t) => t.source !== f.name);
  const mine = all.filter((t) => t.source === f.name);
  for (const t of mine) {
    const g = classifyCell(t.feature, tpl); total++;
    if (g.label !== '.' ) minMargin = Math.min(minMargin, g.margin);
    if (g.label !== t.label) { wrong++; console.log(`  ✗ ${f.name} r${t.r}c${t.c} truth=${t.label} got=${g.label} d=${g.distance.toFixed(4)} m=${g.margin.toFixed(4)}`); }
  }
}
console.log(`leave-one-out: ${total - wrong}/${total} correct, min margin ${minMargin.toFixed(4)}`);
// lowest-margin cells
const lows: string[] = [];
for (const f of fx) {
  const tpl = all.filter((t) => t.source !== f.name);
  for (const t of all.filter((t) => t.source === f.name)) {
    if (t.label === '.') continue;
    const g = classifyCell(t.feature, tpl);
    lows.push(`${g.margin.toFixed(4)} ${f.name} r${t.r}c${t.c} ${t.label} alt=${g.alt} d=${g.distance.toFixed(4)}`);
  }
}
console.log(lows.sort().slice(0, 12).join('\n'));
