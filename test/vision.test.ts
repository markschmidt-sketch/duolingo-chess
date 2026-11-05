import { describe, it, expect, beforeAll } from 'vitest';
import { loadFixtures, Fixture } from '../scripts/fixtures';
import { recognize, toFenGrid } from '../src/vision';
import { locateBoard } from '../src/vision/locateBoard';
import { loadTemplates } from '../src/vision/templates';
import type { Template } from '../src/vision/classify';
import { gridToPlacement } from '../src/vision/fen';
import { resize, tintCells, p3ToSrgb } from './helpers';

const fixtures = loadFixtures();
const shipped = loadTemplates();

/** Templates from every fixture except one, extracted the same way the app does. */
function templatesExcept(name: string, all: Map<string, Template[]>): Template[] {
  return [...all].filter(([n]) => n !== name).flatMap(([, t]) => t);
}

const placement = (f: Fixture) => gridToPlacement(toFenGrid(f.screen, f.whiteAtBottom));

describe('board location', () => {
  it.each(fixtures.map((f) => [f.name, f] as const))('%s', (_, f) => {
    const b = locateBoard(f.img)!;
    expect(b).not.toBeNull();
    expect(b.size).toBe(f.img.width);
    // Boards start between the mascot and the bottom panel on every Duolingo screen.
    expect(b.y).toBeGreaterThan(700);
    expect(b.y + b.size).toBeLessThan(f.img.height - 300);
  });
});

describe('recognition with shipped templates', () => {
  it('has fixtures', () => expect(fixtures.length).toBeGreaterThanOrEqual(11));
  it.each(fixtures.map((f) => [f.name, f] as const))('%s', (_, f) => {
    const r = recognize(f.img, shipped)!;
    expect(r.screen).toEqual(f.screen);
    expect(r.whiteAtBottom).toBe(f.whiteAtBottom);
    expect(gridToPlacement(toFenGrid(r.screen, r.whiteAtBottom))).toBe(placement(f));
  });
});

describe('leave-one-out (screenshot never seen during training)', () => {
  const perFixture = new Map<string, Template[]>();
  beforeAll(() => {
    for (const f of fixtures) {
      const r = recognize(f.img, [])!;
      perFixture.set(
        f.name,
        r.features.flatMap((row, i) => row.map((feature, j) => ({ label: f.screen[i][j], feature, source: f.name }))),
      );
    }
  });
  it.each(fixtures.map((f) => [f.name, f] as const))('%s', (_, f) => {
    const r = recognize(f.img, templatesExcept(f.name, perFixture))!;
    expect(r.screen).toEqual(f.screen);
  });
});

describe('robustness', () => {
  it.each([1179, 1080, 828, 750])('other screen widths (%ipx)', (w) => {
    for (const f of fixtures) {
      const r = recognize(resize(f.img, w), shipped);
      expect(r, f.name).not.toBeNull();
      expect(r!.screen, f.name).toEqual(f.screen);
    }
  });

  it('light-mode last-move highlight (never seen in a real screenshot)', () => {
    const f = fixtures.find((x) => x.name === 'IMG_8462')!;
    // e4 (empty), e2 pawn, a8 rook, d3 (empty, dark square)
    const img = tintCells(f.img, [[4, 4], [6, 4], [0, 0], [5, 3]], [247, 236, 190]);
    const r = recognize(img, shipped)!;
    expect(r.screen).toEqual(f.screen);
  });
});

describe('JPEG-compressed screenshots (shared via Messages, photo exports)', () => {
  it.each([90, 70, 50])('quality %i', async (q) => {
    const jpeg = (await import('jpeg-js')).default;
    for (const f of fixtures) {
      const enc = jpeg.encode({ data: Buffer.from(f.img.data), width: f.img.width, height: f.img.height }, q);
      const r = recognize(jpeg.decode(enc.data, { useTArray: true }), shipped);
      expect(r, f.name).not.toBeNull();
      expect(r!.screen, f.name).toEqual(f.screen);
    }
  }, 60000);
});

describe('last-move highlight → side to move', () => {
  it.each([
    ['IMG_0707', 'b'],
    ['Screenshot 2026-11-05 at 19.16.06', 'w'],
  ] as const)('%s → %s to move', async (name, side) => {
    const { sideToMoveFromHighlight } = await import('../src/vision');
    const f = fixtures.find((x) => x.name === name)!;
    const r = recognize(f.img, shipped)!;
    expect(r.highlighted.length).toBe(1);
    expect(sideToMoveFromHighlight(r.screen, r.highlighted)).toBe(side);
  });
  it('no highlight on plain boards', () => {
    for (const f of fixtures.filter((x) => !['IMG_0707', 'Screenshot 2026-11-05 at 19.16.06'].includes(x.name)))
      expect(recognize(f.img, shipped)!.highlighted, f.name).toEqual([]);
  });
});

describe('Display P3 screenshots as decoded by a browser canvas (converted to sRGB)', () => {
  const P3 = ['IMG_0707', 'Screenshot 2026-11-05 at 19.16.06', 'Screenshot 2026-11-05 at 19.22.14'];
  it.each(P3)('%s', (name) => {
    const f = fixtures.find((x) => x.name === name)!;
    const r = recognize(p3ToSrgb(f.img), shipped, { myColorAtBottom: f.whiteAtBottom ? 'w' : 'b' })!;
    expect(r).not.toBeNull();
    expect(r.screen).toEqual(f.screen);
  });
});
