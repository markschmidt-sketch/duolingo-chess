import { h, mount, toast } from './dom';
import { fileToCanvas, pixels } from './image';
import { recognize, toFenGrid, sideToMoveFromHighlight } from '../vision';
import { allTemplates } from '../vision/learned';
import { placementToGrid } from '../vision/fen';
import { loadGame, loadSettings } from '../game/storage';
import { showConfirm, showAdjust } from './confirm';
import { showPlay } from './play';
import { openSettings } from './settings';
import type { Grid } from '../vision/fen';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const EMPTY: Grid = Array.from({ length: 8 }, () => Array(8).fill('.'));

let pasteBound = false;

export function showHome(error?: string): void {
  const input = h('input', { type: 'file', accept: 'image/*', class: 'hidden' }) as HTMLInputElement;
  input.addEventListener('change', () => input.files?.[0] && importImage(input.files[0]));

  const saved = loadGame();
  const drop = h(
    'div',
    { class: 'drop' },
    h('div', { class: 'em' }, '♞'),
    h('h2', null, 'Continue a Duolingo game'),
    h('p', { class: 'muted' }, 'Pick a screenshot of the board. Everything runs on this phone. No internet needed.'),
    h('button', { class: 'primary big', type: 'button', onclick: () => input.click() }, 'Import screenshot'),
    input,
  );
  drop.addEventListener('dragover', (e) => e.preventDefault());
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files[0];
    if (f) importImage(f);
  });

  mount(
    h('div', { class: 'row' }, h('h1', null, 'Continue'), h('div', { class: 'spacer' }),
      h('button', { class: 'icon', type: 'button', 'aria-label': 'Settings', onclick: () => openSettings() }, '⚙︎')),
    error ? h('div', { class: 'banner err' }, error) : null,
    drop,
    saved
      ? h('button', { class: 'big', type: 'button', onclick: () => showPlay({ resume: saved }) },
          `Resume game (${saved.moves.length} moves, ${new Date(saved.savedAt).toLocaleDateString()})`)
      : null,
    h('div', { class: 'card' },
      h('h2', null, 'No screenshot?'),
      h('div', { class: 'row' },
        h('button', { type: 'button', style: 'flex:1', onclick: () => showConfirm({ grid: placementToGrid(START), whiteAtBottom: loadSettings().myColor === 'w' }) }, 'Start position'),
        h('button', { type: 'button', style: 'flex:1', onclick: () => showConfirm({ grid: EMPTY.map((r) => [...r]), whiteAtBottom: loadSettings().myColor === 'w' }) }, 'Empty board'),
      ),
    ),
    h('p', { class: 'foot' }, 'Tip: you can also paste a screenshot. Board reading is on-device; engine: Stockfish 19 (GPLv3).'),
  );

  if (!pasteBound) {
    pasteBound = true;
    window.addEventListener('paste', (e) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      const f = item?.getAsFile();
      if (f) importImage(f);
    });
  }
}

async function importImage(file: Blob): Promise<void> {
  mount(h('div', { class: 'card' }, h('p', { class: 'thinking' }, 'Reading the board')));
  let canvas: HTMLCanvasElement;
  try {
    canvas = await fileToCanvas(file);
  } catch {
    return showHome("Couldn't open that image. Try a PNG or JPEG screenshot.");
  }
  // Let the spinner paint before the (synchronous) recognizer runs.
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const settings = loadSettings();
  const templates = await allTemplates();
  const rec = recognize(pixels(canvas), templates, { myColorAtBottom: settings.myColor });
  if (!rec) {
    toast('Board not found. Line it up by hand.');
    return showAdjust(canvas, null);
  }
  showConfirm({
    grid: toFenGrid(rec.screen, rec.whiteAtBottom),
    whiteAtBottom: rec.whiteAtBottom,
    source: { canvas, rec },
    toMoveHint: sideToMoveFromHighlight(rec.screen, rec.highlighted),
  });
}

// Dev only (stripped from production builds): /?img=/fixtures/IMG_9215.PNG imports that file.
if (import.meta.env.DEV) {
  const u = new URLSearchParams(location.search).get('img');
  if (u) fetch(u).then((r) => r.blob()).then(importImage);
}
