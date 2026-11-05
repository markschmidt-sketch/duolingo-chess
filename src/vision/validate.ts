import type { Grid } from './fen';

export interface Issue {
  message: string;
  /** FEN-order squares implicated, as [row, col]. */
  squares: [number, number][];
}

/** Basic legality of a recognized placement (FEN order, rank 8 first). */
export function validatePlacement(grid: Grid): Issue[] {
  const issues: Issue[] = [];
  const find = (l: string) => {
    const s: [number, number][] = [];
    grid.forEach((row, r) => row.forEach((x, c) => x === l && s.push([r, c])));
    return s;
  };
  for (const [k, name] of [['K', 'White'], ['k', 'Black']] as const) {
    const ks = find(k);
    if (ks.length !== 1) issues.push({ message: `${name} must have exactly one king (found ${ks.length})`, squares: ks });
  }
  for (const [p, name] of [['P', 'White'], ['p', 'Black']] as const) {
    const ps = find(p);
    if (ps.length > 8) issues.push({ message: `${name} has ${ps.length} pawns`, squares: ps });
    const edge = ps.filter(([r]) => r === 0 || r === 7);
    if (edge.length) issues.push({ message: `${name} pawn on the first/last rank`, squares: edge });
  }
  for (const [re, name] of [[/[PNBRQK]/, 'White'], [/[pnbrqk]/, 'Black']] as const) {
    const n = grid.flat().filter((x) => re.test(x)).length;
    if (n > 16) issues.push({ message: `${name} has ${n} pieces`, squares: [] });
  }
  return issues;
}
