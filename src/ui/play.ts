import { Chess, Move, Square } from 'chess.js';
import type { Key } from 'chessground/types';
import type { DrawShape } from 'chessground/draw';
import { h, mount, sheet, toast } from './dom';
import { createBoard, pieceIcon } from './board';
import type { Label } from '../vision/classify';
import { Engine, SearchResult, approxElo } from '../engine/engine';
import { Side } from '../game/position';
import { SavedGame, clearGame, loadSettings, saveGame } from '../game/storage';
import { showHome } from './home';
import { openSettings } from './settings';

let engine: Engine | null = null;
function getEngine(): Engine {
  engine ??= Engine.inWorker(`${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`);
  return engine;
}

type Start = { fen: string; myColor: Side; level: number; movetime: number } | { resume: SavedGame };

export function showPlay(start: Start): void {
  const s0 = 'resume' in start ? start.resume : { startFen: start.fen, moves: [], ...start };
  const startFen = s0.startFen;
  const myColor = s0.myColor;
  let level = s0.level;
  let movetime = s0.movetime;
  const game = new Chess(startFen);
  for (const m of s0.moves) game.move(uciToMove(m));
  let resigned = false;
  /** Bumped whenever the position changes under a pending search, so stale results are dropped. */
  let gen = 0;
  let thinking = false;
  let evalScore: number | null = null; // centipawns from White's view
  let orientation: 'white' | 'black' = myColor === 'w' ? 'white' : 'black';

  const { el: boardEl, api } = createBoard({
    orientation,
    animation: { enabled: true, duration: 180 },
    movable: { free: false, showDests: true, events: { after: onUserMove } },
    premovable: { enabled: false },
    drawable: { enabled: true },
  });

  const status = h('div', { class: 'status' });
  const evalBar = h('div', { class: 'evalbar' }, h('div'));
  const movesEl = h('div', { class: 'moves' });
  const strength = h('span', { class: 'muted' });

  const tool = (ic: string, label: string, onclick: () => void) =>
    h('button', { type: 'button', onclick }, h('span', { class: 'ic' }, ic), label);
  const undoBtn = tool('↶', 'Undo', undo);
  const hintBtn = tool('💡', 'Hint', hint);

  mount(
    h('div', { class: 'row' },
      h('button', { class: 'icon', type: 'button', 'aria-label': 'Home', onclick: () => showHome() }, '‹'),
      h('h1', null, 'Play'),
      h('div', { class: 'spacer' }),
      h('button', { class: 'icon', type: 'button', 'aria-label': 'Settings', onclick: settings }, '⚙︎')),
    status,
    evalBar,
    boardEl,
    h('div', { class: 'toolbar' },
      undoBtn,
      hintBtn,
      tool('⇅', 'Flip', () => {
        orientation = orientation === 'white' ? 'black' : 'white';
        api.set({ orientation });
      }),
      tool('⤴', 'Share', share),
      tool('⚑', 'End', end),
    ),
    h('div', { class: 'row' }, strength),
    movesEl,
  );

  function legalDests(): Map<Key, Key[]> {
    const dests = new Map<Key, Key[]>();
    for (const m of game.moves({ verbose: true })) {
      const list = dests.get(m.from as Key) ?? [];
      list.push(m.to as Key);
      dests.set(m.from as Key, list);
    }
    return dests;
  }

  const myTurn = () => game.turn() === myColor;
  const over = () => resigned || game.isGameOver();

  function sync() {
    const last = game.history({ verbose: true }).at(-1);
    const turn = game.turn() === 'w' ? 'white' : 'black';
    api.set({
      fen: game.fen(),
      turnColor: turn,
      lastMove: last ? [last.from as Key, last.to as Key] : undefined,
      check: game.inCheck() ? turn : false,
      movable: {
        color: !over() && myTurn() && !thinking ? (myColor === 'w' ? 'white' : 'black') : undefined,
        dests: legalDests(),
      },
    });
    status.replaceChildren(...statusLine());
    evalBar.classList.toggle('hidden', !loadSettings().showEval);
    const pct = evalScore === null ? 50 : 50 + 50 * (2 / (1 + Math.exp(-evalScore / 400)) - 1);
    (evalBar.firstChild as HTMLElement).style.width = `${pct}%`;
    strength.textContent = `Engine: level ${level} (~${approxElo(level)} Elo), ${movetime / 1000}s per move`;
    undoBtn.disabled = game.history().length === 0;
    hintBtn.disabled = over() || !myTurn() || thinking;
    renderMoves();
    persist();
  }

  function statusLine(): Node[] {
    const side = game.turn();
    const dot = (c: Side) => h('span', { class: `dot ${c}` });
    if (resigned) return [h('span', null, 'You resigned.')];
    if (game.isCheckmate()) {
      const iWon = side !== myColor;
      return [h('span', null, iWon ? '🎉 Checkmate. You win!' : 'Checkmate. The engine wins.')];
    }
    if (game.isStalemate()) return [h('span', null, 'Draw by stalemate.')];
    if (game.isThreefoldRepetition()) return [h('span', null, 'Draw by threefold repetition.')];
    if (game.isInsufficientMaterial()) return [h('span', null, 'Draw: insufficient material.')];
    if (game.isDrawByFiftyMoves()) return [h('span', null, 'Draw by the 50-move rule.')];
    if (thinking) return [dot(side), h('span', { class: 'thinking' }, 'Engine is thinking')];
    return [dot(side), h('span', null, myTurn() ? (game.inCheck() ? 'Your move (check!)' : 'Your move') : 'Engine to move')];
  }

  function renderMoves() {
    const hist = game.history();
    const fenParts = startFen.split(' ');
    let n = +fenParts[5] || 1;
    let blackFirst = fenParts[1] === 'b';
    const parts: (Node | string)[] = [];
    hist.forEach((san, i) => {
      if (i === 0 && blackFirst) parts.push(`${n}… `);
      else if ((i + (blackFirst ? 1 : 0)) % 2 === 0) parts.push(`${n}. `);
      parts.push(h('b', null, san), ' ');
      if ((i + (blackFirst ? 1 : 0)) % 2 === 1) n++;
    });
    blackFirst = false;
    movesEl.replaceChildren(...(parts.length ? parts : [h('span', null, 'No moves yet.')]));
    movesEl.scrollTop = movesEl.scrollHeight;
  }

  function persist() {
    if (over()) return clearGame();
    saveGame({
      startFen,
      moves: game.history({ verbose: true }).map((m) => m.lan),
      myColor,
      level,
      movetime,
      savedAt: Date.now(),
    });
  }

  async function onUserMove(orig: Key, dest: Key) {
    const piece = game.get(orig as Square);
    let promotion: string | undefined;
    if (piece?.type === 'p' && (dest[1] === '8' || dest[1] === '1')) {
      promotion = loadSettings().autoQueen ? 'q' : ((await pickPromotion(myColor)) ?? 'q');
    }
    try {
      game.move({ from: orig, to: dest, promotion });
    } catch {
      return sync();
    }
    api.setAutoShapes([]);
    afterMove();
  }

  function afterMove() {
    sync();
    if (!over() && !myTurn()) engineMove();
    else if (!over()) updateEval();
  }

  async function engineMove() {
    const my = ++gen;
    thinking = true;
    sync();
    let res: SearchResult;
    try {
      res = await getEngine().search(game.fen(), { level, movetime });
    } catch {
      thinking = false;
      toast('Engine failed to respond');
      return sync();
    }
    if (my !== gen) return;
    thinking = false;
    if (!res.bestmove || res.bestmove === '(none)') return sync();
    game.move(uciToMove(res.bestmove));
    if (res.score !== undefined && level >= 15) evalScore = whiteView(-res.score, game.turn());
    afterMove();
  }

  async function updateEval() {
    if (!loadSettings().showEval) return;
    const my = gen;
    const fen = game.fen();
    const res = await getEngine().analyse(fen, 300);
    if (my !== gen || game.fen() !== fen || res.score === undefined) return;
    evalScore = whiteView(res.score, game.turn());
    sync();
  }

  async function hint() {
    hintBtn.disabled = true;
    const my = gen;
    const res = await getEngine().analyse(game.fen(), 1000);
    if (my !== gen || !res.bestmove) return sync();
    const m = uciToMove(res.bestmove);
    api.setAutoShapes([{ orig: m.from as Key, dest: m.to as Key, brush: 'blue' } satisfies DrawShape]);
    if (res.score !== undefined) evalScore = whiteView(res.score, game.turn());
    sync();
  }

  function undo() {
    gen++;
    if (thinking) getEngine().stop();
    thinking = false;
    resigned = false;
    game.undo();
    // Take back to the last position where it's my move.
    while (game.history().length && !myTurn()) game.undo();
    if (!myTurn() && !game.history().length) {
      // The engine moved first from the start position; let it move again.
      api.setAutoShapes([]);
      return afterMove();
    }
    api.setAutoShapes([]);
    sync();
  }

  function pgn(): string {
    const g = new Chess(startFen);
    g.setHeader('Event', 'Continued from Duolingo');
    g.setHeader('Date', new Date().toISOString().slice(0, 10).replace(/-/g, '.'));
    g.setHeader('White', myColor === 'w' ? 'Me' : `Stockfish level ${level}`);
    g.setHeader('Black', myColor === 'b' ? 'Me' : `Stockfish level ${level}`);
    for (const m of game.history({ verbose: true }) as Move[]) g.move(m.lan);
    return g.pgn();
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`);
    } catch {
      prompt(`Copy the ${what}:`, text);
    }
  }

  function share() {
    sheet<void>((close) =>
      h('div', { class: 'card', style: 'border:0;padding:0' },
        h('h2', null, 'Share'),
        h('button', { type: 'button', onclick: () => (close(null), copy(game.fen(), 'FEN')) }, 'Copy FEN (current position)'),
        h('button', { type: 'button', onclick: () => (close(null), copy(pgn(), 'PGN')) }, 'Copy PGN (moves so far)'),
        h('button', { type: 'button', onclick: () => (close(null), copy(startFen, 'FEN')) }, 'Copy starting FEN'),
      ),
    );
  }

  function end() {
    sheet<void>((close) =>
      h('div', { class: 'card', style: 'border:0;padding:0' },
        h('h2', null, over() ? 'Game over' : 'End game'),
        !over()
          ? h('button', { type: 'button', onclick: () => {
              close(null);
              gen++;
              if (thinking) getEngine().stop();
              thinking = false;
              resigned = true;
              sync();
            } }, '⚑ Resign')
          : null,
        h('button', { class: 'primary', type: 'button', onclick: () => (close(null), clearGame(), showHome()) }, 'New game from a screenshot'),
        h('button', { type: 'button', onclick: () => close(null) }, 'Cancel'),
      ),
    );
  }

  async function settings() {
    await openSettings({ level, movetime });
    const s = loadSettings();
    level = s.level;
    movetime = s.movetime;
    sync();
    if (s.showEval && !thinking && myTurn()) updateEval();
  }

  sync();
  if (!over() && !myTurn()) engineMove();
  else updateEval();
}

function whiteView(score: number, sideToMove: Side): number {
  const cp = Math.abs(score) > 90000 ? Math.sign(score) * 2000 : score;
  return sideToMove === 'w' ? cp : -cp;
}

function uciToMove(uci: string): { from: string; to: string; promotion?: string } {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}

function pickPromotion(color: Side): Promise<string | null> {
  return sheet<string>((close) =>
    h('div', { class: 'card', style: 'border:0;padding:0' },
      h('h2', null, 'Promote to'),
      h('div', { class: 'promo' },
        ...(['q', 'r', 'b', 'n'] as const).map((p) =>
          h('button', { type: 'button', onclick: () => close(p) }, pieceIcon((color === 'w' ? p.toUpperCase() : p) as Label)),
        ),
      ),
    ),
  );
}
