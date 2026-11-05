import { PNG } from 'pngjs';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RGBAImage } from '../src/vision/image';
import { placementToGrid, flipGrid, Grid } from '../src/vision/fen';

export interface Fixture {
  name: string;
  img: RGBAImage;
  /** Ground truth in screen order (row 0 = top of screenshot). */
  screen: Grid;
  whiteAtBottom: boolean;
}

/** Fixtures whose board is shown from Black's side. */
const BLACK_AT_BOTTOM = new Set(['IMG_0707']);

export function loadFixtures(dir = 'fixtures'): Fixture[] {
  return readdirSync(dir)
    .filter((f) => /\.png$/i.test(f))
    .map((f): Fixture | null => {
      const name = f.replace(/\.png$/i, '');
      const fenPath = join(dir, name + '.fen');
      if (!existsSync(fenPath)) return null;
      const placement = readFileSync(fenPath, 'utf8').trim().split(/\s+/)[0];
      const png = PNG.sync.read(readFileSync(join(dir, f)));
      const whiteAtBottom = !BLACK_AT_BOTTOM.has(name);
      const g = placementToGrid(placement);
      return {
        name,
        img: { width: png.width, height: png.height, data: png.data },
        screen: whiteAtBottom ? g : flipGrid(g),
        whiteAtBottom,
      };
    })
    .filter((x): x is Fixture => x !== null);
}
