import { describe, it, expect } from 'vitest';
import { inferCastling, possibleEnPassant, buildFen, checkPlayable } from '../src/game/position';
import { validatePlacement } from '../src/vision/validate';
import { placementToGrid } from '../src/vision/fen';

const start = placementToGrid('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');

describe('position helpers', () => {
  it('infers castling from home squares', () => {
    expect(inferCastling(start)).toBe('KQkq');
    expect(inferCastling(placementToGrid('Qn3rk1/2bp2p1/pp2q2p/2p2p2/2P1p3/P3P3/1PB2PPP/R1B2RK1'))).toBe('-');
    expect(inferCastling(placementToGrid('r2qkb1r/ppp2ppp/5n2/4n3/6b1/2N1PN2/PPP3PP/R1BQKB1R'))).toBe('KQkq');
  });

  it('offers en passant only when a double push is possible', () => {
    // After 1.e4 d5 2.e5 f5 — White can take f6 e.p.
    const g = placementToGrid('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR');
    expect(possibleEnPassant(g, 'w')).toEqual(['d6', 'f6']);
    expect(possibleEnPassant(start, 'w')).toEqual([]);
  });

  it('validates placements', () => {
    expect(validatePlacement(start)).toEqual([]);
    expect(validatePlacement(placementToGrid('8/8/8/8/8/8/8/K7')).map((i) => i.message)).toContain(
      'Black must have exactly one king (found 0)',
    );
    expect(validatePlacement(placementToGrid('P6k/8/8/8/8/8/8/K7')).length).toBe(1);
  });

  it('rejects a position where the side not to move is in check', () => {
    // Black king on e8 attacked by Qe2, but it's White to move.
    const fen = buildFen(placementToGrid('4k3/8/8/8/8/8/4Q3/4K3'), { toMove: 'w', castling: '-', enPassant: '-' });
    expect(checkPlayable(fen)).toMatch(/Black is in check/);
    expect(checkPlayable(fen.replace(' w ', ' b '))).toBeNull();
  });
});
