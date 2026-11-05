/** Build src/vision/templates.json from fixtures/*.png + *.fen (ground truth). */
import { writeFileSync } from 'node:fs';
import { loadFixtures } from './fixtures';
import { locateBoard } from '../src/vision/locateBoard';
import { cellFeature, encodeFeature, featureDistance } from '../src/vision/features';
import type { Label } from '../src/vision/classify';

const out: { label: Label; f: string; src: string }[] = [];
const kept: { label: Label; feature: ReturnType<typeof cellFeature> }[] = [];
for (const fx of loadFixtures()) {
  const b = locateBoard(fx.img);
  if (!b) throw new Error(`board not found in ${fx.name}`);
  const cw = b.size / 8;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const label = fx.screen[r][c];
      if (label === '.') continue;
      const feature = cellFeature(fx.img, b.x + c * cw, b.y + r * cw, cw);
      // Skip near-duplicates (same piece art on same square color) to keep the file small.
      if (kept.some((k) => k.label === label && featureDistance(k.feature, feature) < 0.002)) continue;
      kept.push({ label, feature });
      out.push({ label, f: encodeFeature(feature), src: fx.name });
    }
}
writeFileSync('src/vision/templates.json', JSON.stringify(out));
const counts: Record<string, number> = {};
for (const t of out) counts[t.label] = (counts[t.label] ?? 0) + 1;
console.log(`${out.length} templates`, counts);
