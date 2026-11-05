import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Key, Piece, Role } from 'chessground/types';
import type { Label } from '../vision/classify';
import type { Grid } from '../vision/fen';
import { h } from './dom';

export const FILES = 'abcdefgh';

/** FEN-order grid cell → square key. */
export const keyOf = (r: number, c: number): Key => `${FILES[c]}${8 - r}` as Key;
export const cellOf = (k: Key): [number, number] => [8 - +k[1], FILES.indexOf(k[0])];

const ROLES: Record<string, Role> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

export function labelToPiece(l: Label): Piece | undefined {
  if (l === '.') return undefined;
  return { role: ROLES[l.toLowerCase()], color: l === l.toUpperCase() ? 'white' : 'black' };
}

export function createBoard(config: Config): { el: HTMLDivElement; api: Api } {
  const el = h('div', { class: 'board-wrap' });
  const inner = h('div');
  el.append(inner);
  const api = Chessground(inner, { coordinates: false, ...config });
  return { el, api };
}

/** A piece image (chessground's cburnett set) for buttons. */
export function pieceIcon(l: Label): HTMLElement {
  const p = labelToPiece(l);
  const wrap = h('div', { class: 'cg-wrap piece-icon' });
  if (p) {
    const el = document.createElement('piece');
    el.className = `${p.role} ${p.color}`;
    wrap.append(el);
  }
  return wrap;
}

export const sameGrid = (a: Grid, b: Grid) => a.every((row, r) => row.every((x, c) => x === b[r][c]));
