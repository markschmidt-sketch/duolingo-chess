import type { Label } from './classify';

/** 8x8 board, row 0 = rank 8, col 0 = file a (standard FEN order). */
export type Grid = Label[][];

export function placementToGrid(placement: string): Grid {
  return placement.split('/').map((rank) => {
    const row: Label[] = [];
    for (const ch of rank) {
      if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) row.push('.');
      else row.push(ch as Label);
    }
    return row;
  });
}

export function gridToPlacement(grid: Grid): string {
  return grid
    .map((row) => {
      let s = '';
      let empty = 0;
      for (const l of row) {
        if (l === '.') empty++;
        else {
          if (empty) s += empty;
          empty = 0;
          s += l;
        }
      }
      return s + (empty ? empty : '');
    })
    .join('/');
}

/** Rotate 180° — converts between "white at bottom" and "black at bottom" screen order. */
export function flipGrid(grid: Grid): Grid {
  return grid.map((row) => [...row].reverse()).reverse();
}
