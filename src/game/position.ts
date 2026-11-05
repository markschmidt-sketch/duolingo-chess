import { Chess, validateFen } from 'chess.js';
import type { Grid } from '../vision/fen';
import { gridToPlacement } from '../vision/fen';

export type Side = 'w' | 'b';

/** Castling rights implied by kings and rooks still standing on their home squares. */
export function inferCastling(grid: Grid): string {
  let s = '';
  if (grid[7][4] === 'K') {
    if (grid[7][7] === 'R') s += 'K';
    if (grid[7][0] === 'R') s += 'Q';
  }
  if (grid[0][4] === 'k') {
    if (grid[0][7] === 'r') s += 'k';
    if (grid[0][0] === 'r') s += 'q';
  }
  return s || '-';
}

/**
 * En passant targets that would be legal if the last move was a double pawn push by
 * the side that just moved. Duolingo screenshots don't show this, so it's opt-in.
 */
export function possibleEnPassant(grid: Grid, toMove: Side): string[] {
  const out: string[] = [];
  const files = 'abcdefgh';
  // If White is to move, Black just pushed: black pawn on rank 5 (row 3), squares behind empty.
  const [row, pawn, mine, behind1, behind2, rank] =
    toMove === 'w' ? [3, 'p', 'P', 2, 1, '6'] : [4, 'P', 'p', 5, 6, '3'];
  for (let c = 0; c < 8; c++) {
    if (grid[row][c] !== pawn) continue;
    if (grid[behind1][c] !== '.' || grid[behind2][c] !== '.') continue;
    if (grid[row][c - 1] === mine || grid[row][c + 1] === mine) out.push(files[c] + rank);
  }
  return out;
}

export interface PositionOptions {
  toMove: Side;
  castling: string;
  enPassant: string;
}

export function buildFen(grid: Grid, o: PositionOptions): string {
  return `${gridToPlacement(grid)} ${o.toMove} ${o.castling || '-'} ${o.enPassant || '-'} 0 1`;
}

/** Returns an error message if the position can't be played, else null. */
export function checkPlayable(fen: string): string | null {
  const v = validateFen(fen);
  if (!v.ok) return (v.error ?? 'Invalid position').replace(/^Invalid FEN: /, '');
  try {
    const c = new Chess(fen);
    // The side that just moved can't be in check (their king would be capturable).
    const flipped = fen.replace(/ ([wb]) /, (_, s) => ` ${s === 'w' ? 'b' : 'w'} `).replace(/ [^ ]+ (\d+ \d+)$/, ' - $1');
    if (new Chess(flipped, { skipValidation: true }).inCheck())
      return `${c.turn() === 'w' ? 'Black' : 'White'} is in check but it's not their move. Check "side to move".`;
  } catch (e) {
    return (e as Error).message;
  }
  return null;
}
