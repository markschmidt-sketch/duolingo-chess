import { h, mount, seg, field } from './dom';
import { createBoard } from './board';
import type { Draft } from './state';
import { gridToPlacement } from '../vision/fen';
import { Side, inferCastling, possibleEnPassant, buildFen, checkPlayable } from '../game/position';
import { loadSettings, saveSettings } from '../game/storage';
import { approxElo } from '../engine/engine';
import { showConfirm } from './confirm';
import { showPlay } from './play';

export const THINK_TIMES: [string, string][] = [['300', '0.3s'], ['1000', '1s'], ['2000', '2s'], ['5000', '5s']];

export function levelField(level: number, onChange: (v: number) => void): HTMLElement {
  const out = h('span');
  const input = h('input', { type: 'range', min: '0', max: '20', step: '1', value: String(level) }) as HTMLInputElement;
  const show = () => (out.textContent = `Level ${input.value} · ~${approxElo(+input.value)} Elo`);
  input.addEventListener('input', () => (show(), onChange(+input.value)));
  show();
  return field('Engine strength', h('div', { class: 'row' }, out), input);
}

export function showSetup(draft: Draft): void {
  const settings = loadSettings();
  // Duolingo puts the player's pieces at the bottom, so the screenshot says which side I am.
  let myColor: Side = draft.source ? (draft.whiteAtBottom ? 'w' : 'b') : settings.myColor;
  let toMove: Side = draft.toMoveHint ?? settings.toMove;
  let level = settings.level;
  let movetime = settings.movetime;
  const possibleCastling = inferCastling(draft.grid);
  let castling = possibleCastling === '-' ? '' : possibleCastling;
  let enPassant = '-';

  const { el: boardEl, api } = createBoard({
    viewOnly: true,
    fen: gridToPlacement(draft.grid),
    orientation: myColor === 'w' ? 'white' : 'black',
    animation: { enabled: false },
  });
  boardEl.style.maxWidth = '220px';
  boardEl.style.alignSelf = 'center';

  const error = h('div');
  const epWrap = h('div');
  const castleWrap = h('div', { class: 'row wrap' });
  const start = h('button', { class: 'primary big', type: 'button' }, 'Play');

  const fen = () => buildFen(draft.grid, { toMove, castling, enPassant });

  function refresh() {
    api.set({ orientation: myColor === 'w' ? 'white' : 'black' });
    const eps = possibleEnPassant(draft.grid, toMove);
    if (!eps.includes(enPassant)) enPassant = '-';
    epWrap.replaceChildren(
      eps.length
        ? field('En passant', seg([['-', 'None'], ...eps.map((s) => [s, s] as [string, string])], enPassant, (v) => ((enPassant = v), refresh())))
        : h('span'),
    );
    const msg = checkPlayable(fen());
    error.replaceChildren(msg ? h('div', { class: 'banner err' }, msg) : '');
    start.disabled = !!msg;
  }

  for (const [flag, label] of [['K', 'White O-O'], ['Q', 'White O-O-O'], ['k', 'Black O-O'], ['q', 'Black O-O-O']] as const) {
    if (!possibleCastling.includes(flag)) continue;
    const cb = h('input', { type: 'checkbox', checked: castling.includes(flag) }) as HTMLInputElement;
    cb.addEventListener('change', () => {
      castling = 'KQkq'.split('').filter((f) => (f === flag ? cb.checked : castling.includes(f))).join('');
      refresh();
    });
    castleWrap.append(h('label', { class: 'check', style: 'min-width:45%' }, cb, label));
  }

  start.addEventListener('click', () => {
    saveSettings({ ...loadSettings(), myColor, level, movetime });
    showPlay({ fen: fen(), myColor, level, movetime });
  });

  mount(
    h('div', { class: 'row' },
      h('button', { class: 'icon', type: 'button', 'aria-label': 'Back', onclick: () => showConfirm(draft) }, '‹'),
      h('h1', null, 'New game')),
    boardEl,
    h('div', { class: 'card' },
      field('I play', seg([['w', 'White'], ['b', 'Black']], myColor, (v) => ((myColor = v), refresh()))),
      field('Next to move', seg([['w', 'White'], ['b', 'Black']], toMove, (v) => ((toMove = v), refresh()))),
      draft.toMoveHint ? h('p', { class: 'muted' }, 'Set from the last-move highlight in the screenshot.') : null,
      levelField(level, (v) => (level = v)),
      field('Think time', seg(THINK_TIMES, String(movetime), (v) => (movetime = +v))),
    ),
    possibleCastling !== '-' || possibleEnPassant(draft.grid, 'w').length || possibleEnPassant(draft.grid, 'b').length
      ? h('details', { class: 'card more' },
          h('summary', null, 'Castling & en passant'),
          h('div', null, possibleCastling !== '-' ? field('Castling still allowed', castleWrap) : null, epWrap))
      : null,
    error,
    start,
  );
  refresh();
}
