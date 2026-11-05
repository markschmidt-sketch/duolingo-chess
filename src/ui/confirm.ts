import type { Key } from 'chessground/types';
import { h, mount, toast } from './dom';
import { createBoard, keyOf, cellOf, pieceIcon } from './board';
import { cropCanvas, pixels } from './image';
import type { Draft } from './state';
import type { Label } from '../vision/classify';
import { EMPTY_FILL } from '../vision/classify';
import { Grid, flipGrid, gridToPlacement } from '../vision/fen';
import { recognize, toFenGrid, sideToMoveFromHighlight } from '../vision';
import { boardAt, BoardRect } from '../vision/locateBoard';
import { allTemplates, learn } from '../vision/learned';
import { validatePlacement } from '../vision/validate';
import { loadSettings } from '../game/storage';
import { showHome } from './home';
import { showSetup } from './setup';

/** Below this classification margin a square gets an amber "please check" outline. */
const UNSURE_MARGIN = 0.03;

const PALETTE: Label[][] = [
  ['K', 'Q', 'R', 'B', 'N', 'P'],
  ['k', 'q', 'r', 'b', 'n', 'p'],
];

/**
 * Show what was read and let the user fix it. Edits happen in screen order (the way the
 * screenshot looks), so flipping orientation never moves pieces around on screen.
 */
export function showConfirm(draft: Draft): void {
  const rec = draft.source?.rec;
  let whiteAtBottom = draft.whiteAtBottom;
  const screen: Grid = (whiteAtBottom ? draft.grid : flipGrid(draft.grid)).map((r) => [...r]);
  let sel: [number, number] | null = null; // screen cell being edited

  const toScreen = (k: Key): [number, number] => {
    const [r, c] = cellOf(k);
    return whiteAtBottom ? [r, c] : [7 - r, 7 - c];
  };
  const toKey = (r: number, c: number) => (whiteAtBottom ? keyOf(r, c) : keyOf(7 - r, 7 - c));
  const fenGrid = () => toFenGrid(screen, whiteAtBottom);

  const { el: boardEl, api } = createBoard({
    orientation: whiteAtBottom ? 'white' : 'black',
    movable: { color: undefined },
    draggable: { enabled: false },
    selectable: { enabled: false },
    drawable: { enabled: false },
    highlight: { lastMove: false, check: false },
    animation: { enabled: false },
    events: {
      select: (k) => {
        const cell = toScreen(k);
        sel = sel && sel[0] === cell[0] && sel[1] === cell[1] ? null : cell;
        render();
      },
    },
  });

  const banner = h('div');
  const palette = h('div', { class: 'palette' });
  const selLabel = h('p', { class: 'muted' });
  const flipBtn = h('button', { type: 'button', style: 'flex:1', onclick: () => {
    whiteAtBottom = !whiteAtBottom;
    render();
  } }, 'Flip');

  const set = (l: Label) => {
    if (!sel) return;
    screen[sel[0]][sel[1]] = l;
    render();
  };
  for (const row of PALETTE)
    for (const l of row) palette.append(h('button', { type: 'button', 'aria-label': l, onclick: () => set(l) }, pieceIcon(l)));
  palette.append(h('button', { type: 'button', class: 'clear', 'aria-label': 'Clear square', onclick: () => set('.') }, '✕'));
  palette.style.gridTemplateColumns = 'repeat(6, 1fr)';
  palette.lastElementChild!.setAttribute('style', 'grid-column: span 6; aspect-ratio: auto');

  function unsureCells(): [number, number][] {
    if (!rec) return [];
    const out: [number, number][] = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        if (screen[r][c] !== rec.screen[r][c]) continue; // already looked at by the user
        const g = rec.guesses[r][c];
        const f = rec.features[r][c];
        if ((g.label !== '.' && g.margin < UNSURE_MARGIN) || (g.label === '.' && f.fill > EMPTY_FILL * 0.6)) out.push([r, c]);
      }
    return out;
  }

  function render() {
    const grid = fenGrid();
    const issues = validatePlacement(grid);
    const unsure = unsureCells();
    const custom = new Map<Key, string>();
    for (const [r, c] of unsure) custom.set(toKey(r, c), 'unsure');
    for (const i of issues) for (const [r, c] of i.squares) custom.set(keyOf(r, c), 'issue');
    if (sel) custom.set(toKey(sel[0], sel[1]), 'editing');
    api.set({
      fen: gridToPlacement(grid),
      orientation: whiteAtBottom ? 'white' : 'black',
      highlight: { custom },
    });

    banner.replaceChildren(
      issues.length
        ? h('div', { class: 'banner err' }, issues.map((i) => i.message).join(' · '))
        : unsure.length
          ? h('div', { class: 'banner warn' }, `Check the ${unsure.length} outlined square${unsure.length > 1 ? 's' : ''}, then continue.`)
          : rec
            ? h('div', { class: 'banner ok' }, 'Board read. Tap any square to fix it.')
            : h('div', { class: 'banner ok' }, 'Tap a square, then pick a piece.'),
    );
    if (sel) {
      const [r, c] = sel;
      const k = toKey(r, c);
      const g = rec && screen[r][c] === rec.screen[r][c] && rec.guesses[r][c].label !== '.' ? rec.guesses[r][c] : null;
      selLabel.textContent = `Square ${k}` + (g && g.alt !== '.' ? ` · next best guess: ${name(g.alt)}` : '');
      for (const b of palette.querySelectorAll('button')) b.classList.toggle('on', b.getAttribute('aria-label') === screen[r][c] || (screen[r][c] === '.' && b.classList.contains('clear')));
    } else {
      selLabel.textContent = 'Tap a square on the board to change it.';
      for (const b of palette.querySelectorAll('button')) b.classList.remove('on');
    }
    palette.classList.toggle('disabled', !sel);
    continueBtn.disabled = issues.some((i) => /king/.test(i.message));
    flipBtn.title = whiteAtBottom ? 'White is at the bottom' : 'Black is at the bottom';
    orient.textContent = whiteAtBottom ? 'White at the bottom' : 'Black at the bottom';
  }

  const orient = h('span', { class: 'muted' });
  const actions = h('div', { class: 'row' });
  const adjustRow = h('div');
  const continueBtn = h('button', { class: 'primary big', type: 'button', onclick: async () => {
    if (rec) {
      const fixes: { label: Label; feature: (typeof rec.features)[0][0] }[] = [];
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
          if (screen[r][c] !== rec.screen[r][c] && rec.features[r][c].fill >= EMPTY_FILL)
            fixes.push({ label: screen[r][c], feature: rec.features[r][c] });
      if (fixes.length) {
        await learn(fixes);
        toast(`Learned from ${fixes.length} correction${fixes.length > 1 ? 's' : ''}`);
      }
    }
    showSetup({ ...draft, grid: fenGrid(), whiteAtBottom });
  } }, 'Continue');

  const extras: Node[] = [];
  if (draft.source) {
    const { canvas, rec: r } = draft.source;
    const crop = cropCanvas(canvas, r.board.x, r.board.y, r.board.size);
    const toggle = h('button', { type: 'button', style: 'flex:1', onclick: () => {
      const showing = !crop.classList.contains('hidden');
      crop.classList.toggle('hidden', showing);
      boardEl.classList.toggle('hidden', !showing);
      toggle.textContent = showing ? 'Screenshot' : 'Board';
    } }, 'Screenshot');
    crop.classList.add('hidden');
    extras.push(crop);
    actions.prepend(toggle);
    adjustRow.append(h('button', { class: 'link', type: 'button', onclick: () => showAdjust(canvas, r.board) }, 'Adjust edges'));
  }

  mount(
    h('div', { class: 'row' },
      h('button', { class: 'icon', type: 'button', 'aria-label': 'Back', onclick: () => showHome() }, '‹'),
      h('h1', null, 'Check the board')),
    banner,
    boardEl,
    ...extras,
    h('div', { class: 'row' }, orient, h('div', { class: 'spacer' }), adjustRow),
    actions,
    h('div', { class: 'card' }, selLabel, palette),
    continueBtn,
  );
  actions.append(flipBtn, h('button', { type: 'button', style: 'flex:1', onclick: () => {
    for (const row of screen) row.fill('.');
    sel = null;
    render();
  } }, 'Clear all'));
  render();
}

const NAMES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
function name(l: Label): string {
  return `${l === l.toUpperCase() ? 'white' : 'black'} ${NAMES[l.toLowerCase()]}`;
}

/** Manual fallback: line up the board square by hand when detection fails or is off. */
export function showAdjust(canvas: HTMLCanvasElement, initial: BoardRect | null): void {
  const W = canvas.width;
  const H = canvas.height;
  let size = initial?.size ?? Math.min(W, H);
  let x = initial?.x ?? 0;
  let y = initial?.y ?? Math.round((H - size) / 2);

  const scale = Math.min(1, 700 / W);
  const view = document.createElement('canvas');
  view.width = Math.round(W * scale);
  view.height = Math.round(H * scale);
  const g = view.getContext('2d')!;

  const draw = () => {
    g.drawImage(canvas, 0, 0, view.width, view.height);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    const sx = x * scale, sy = y * scale, ss = size * scale;
    g.fillRect(0, 0, view.width, sy);
    g.fillRect(0, sy + ss, view.width, view.height - sy - ss);
    g.fillRect(0, sy, sx, ss);
    g.fillRect(sx + ss, sy, view.width - sx - ss, ss);
    g.strokeStyle = '#1cb0f6';
    g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      g.beginPath();
      g.moveTo(sx + (i * ss) / 8, sy);
      g.lineTo(sx + (i * ss) / 8, sy + ss);
      g.moveTo(sx, sy + (i * ss) / 8);
      g.lineTo(sx + ss, sy + (i * ss) / 8);
      g.stroke();
    }
  };

  const slider = (label: string, get: () => number, setV: (v: number) => void, max: () => number) => {
    const input = h('input', { type: 'range', min: '0', step: '1' }) as HTMLInputElement;
    const sync = () => {
      input.max = String(Math.max(0, Math.round(max())));
      input.value = String(Math.round(get()));
    };
    input.addEventListener('input', () => (setV(+input.value), clampAll(), draw()));
    const nudge = (d: number) => h('button', { type: 'button', class: 'icon', onclick: () => (setV(get() + d), clampAll(), sync(), draw()) }, d < 0 ? '−' : '+');
    syncers.push(sync);
    return h('div', { class: 'field' }, h('label', null, label), h('div', { class: 'nudge' }, input, nudge(-1), nudge(1)));
  };
  const syncers: (() => void)[] = [];
  const clampAll = () => {
    size = Math.max(64, Math.min(size, W, H));
    x = Math.max(0, Math.min(x, W - size));
    y = Math.max(0, Math.min(y, H - size));
    syncers.forEach((s) => s());
  };

  // Drag on the image to move the board's top edge (the common case: full-width boards).
  let dragFrom: { py: number; y: number } | null = null;
  view.addEventListener('pointerdown', (e) => {
    dragFrom = { py: e.clientY, y };
    view.setPointerCapture(e.pointerId);
  });
  view.addEventListener('pointermove', (e) => {
    if (!dragFrom) return;
    const k = canvas.height / view.getBoundingClientRect().height;
    y = dragFrom.y + (e.clientY - dragFrom.py) * k;
    clampAll();
    draw();
  });
  view.addEventListener('pointerup', () => (dragFrom = null));
  view.style.touchAction = 'none';

  mount(
    h('div', { class: 'row' },
      h('button', { class: 'icon', type: 'button', 'aria-label': 'Back', onclick: () => showHome() }, '‹'),
      h('h1', null, 'Line up the board')),
    h('p', { class: 'muted' }, 'Drag the image or use the sliders until the blue grid sits exactly on the squares.'),
    h('div', { class: 'adjust' }, view),
    h('div', { class: 'card' },
      slider('Top', () => y, (v) => (y = v), () => H - size),
      slider('Size', () => size, (v) => (size = v), () => Math.min(W, H)),
      slider('Left', () => x, (v) => (x = v), () => W - size),
    ),
    h('button', { class: 'primary big', type: 'button', onclick: async () => {
      const img = pixels(canvas);
      const rect = boardAt(img, Math.round(y), Math.round(x), Math.round(size));
      const settings = loadSettings();
      const rec = recognize(img, await allTemplates(), { rect, myColorAtBottom: settings.myColor })!;
      showConfirm({
        grid: toFenGrid(rec.screen, rec.whiteAtBottom),
        whiteAtBottom: rec.whiteAtBottom,
        source: { canvas, rec },
        toMoveHint: sideToMoveFromHighlight(rec.screen, rec.highlighted),
      });
    } }, 'Read board'),
  );
  clampAll();
  draw();
}

