import { RGBAImage, dist2 } from './image';
import { locateBoard, BoardRect } from './locateBoard';
import { cellFeature, CellFeature } from './features';
import { classifyCell, CellGuess, Template } from './classify';
import { Grid, flipGrid } from './fen';

export interface Recognition {
  board: BoardRect;
  /** Labels in screen order (row 0 = top of the screenshot). */
  screen: Grid;
  guesses: CellGuess[][];
  features: CellFeature[][];
  /** Best guess at whether White is at the bottom of the screenshot. */
  whiteAtBottom: boolean;
  /** Screen cells tinted as Duolingo's last-move highlight. */
  highlighted: [number, number][];
}

export function recognize(
  img: RGBAImage,
  templates: Template[],
  opts: { rect?: BoardRect; myColorAtBottom?: 'w' | 'b' } = {},
): Recognition | null {
  const board = opts.rect ?? locateBoard(img);
  if (!board) return null;
  const cw = board.size / 8;
  const screen: Grid = [];
  const guesses: CellGuess[][] = [];
  const features: CellFeature[][] = [];
  for (let r = 0; r < 8; r++) {
    screen.push([]);
    guesses.push([]);
    features.push([]);
    for (let c = 0; c < 8; c++) {
      const f = cellFeature(img, board.x + c * cw, board.y + r * cw, cw);
      const g = classifyCell(f, templates);
      features[r].push(f);
      guesses[r].push(g);
      screen[r].push(g.label);
    }
  }
  const highlighted: [number, number][] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const bg = features[r][c].bg!;
      const expected = (r + c) % 2 === 0 ? board.light : board.dark;
      if (dist2(expected, bg[0], bg[1], bg[2]) > HIGHLIGHT_DIST * HIGHLIGHT_DIST) highlighted.push([r, c]);
    }
  const whiteAtBottom = guessWhiteAtBottom(screen, (opts.myColorAtBottom ?? 'w') === 'w');
  return { board, screen, guesses, features, whiteAtBottom, highlighted };
}

/** A cell background this far from the normal square color is a last-move highlight. */
const HIGHLIGHT_DIST = 14;

/**
 * Duolingo highlights the square the last move landed on, so the piece there belongs
 * to the side that just moved and the other side is to move. Returns null if unclear.
 */
export function sideToMoveFromHighlight(screen: Grid, highlighted: [number, number][]): 'w' | 'b' | null {
  const colors = new Set<string>();
  for (const [r, c] of highlighted) {
    const l = screen[r][c];
    if (l !== '.') colors.add(l === l.toUpperCase() ? 'w' : 'b');
  }
  if (colors.size !== 1) return null;
  return colors.has('w') ? 'b' : 'w';
}

/** Screen-order grid → FEN-order grid (rank 8 first) for the given orientation. */
export function toFenGrid(screen: Grid, whiteAtBottom: boolean): Grid {
  return whiteAtBottom ? screen.map((r) => [...r]) : flipGrid(screen);
}

/**
 * Duolingo draws no coordinates. Orientation is only decided from the pieces when the
 * evidence is unambiguous; otherwise `fallback` (the player's color at the bottom) wins,
 * because endgames such as a pawn about to promote look the same from either side.
 */
export function guessWhiteAtBottom(screen: Grid, fallback = true): boolean {
  // Pawns can never stand on their own back rank.
  const impossibleIfWhiteBottom = screen[7].includes('P') || screen[0].includes('p');
  const impossibleIfWhiteTop = screen[0].includes('P') || screen[7].includes('p');
  if (impossibleIfWhiteBottom !== impossibleIfWhiteTop) return impossibleIfWhiteTop;
  // Pawns still on their starting rank.
  const count = (row: number, l: string) => screen[row].filter((x) => x === l).length;
  const homeIfWhiteBottom = count(6, 'P') + count(1, 'p');
  const homeIfWhiteTop = count(1, 'P') + count(6, 'p');
  if (homeIfWhiteBottom - homeIfWhiteTop >= 3) return true;
  if (homeIfWhiteTop - homeIfWhiteBottom >= 3) return false;
  return fallback;
}

export type { Template, CellGuess, Grid, BoardRect };
