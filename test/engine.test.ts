import { describe, it, expect, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { Chess } from 'chess.js';
import { Engine, EnginePort } from '../src/engine/engine';

const require = createRequire(import.meta.url);

function nodePort(): EnginePort {
  let cb: (l: string) => void = () => {};
  const sf = require('stockfish')('lite-single', (line: string) => cb(line));
  return { postMessage: (c) => sf.processCommand(c), onLine: (f) => (cb = f), terminate: () => sf.terminate() };
}

const engine = new Engine(nodePort());
afterAll(() => engine.terminate());

describe('engine', () => {
  it.each([0, 5, 20])('returns a legal move at level %i', async (level) => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const r = await engine.search(fen, { level, movetime: 200 });
    const c = new Chess(fen);
    expect(() => c.move({ from: r.bestmove.slice(0, 2), to: r.bestmove.slice(2, 4), promotion: r.bestmove[4] })).not.toThrow();
  }, 20000);

  it('finds mate in one at full strength', async () => {
    // White: Qh5, Bc4 vs f7 — scholar's mate
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1';
    const r = await engine.analyse(fen, 300);
    expect(r.bestmove).toBe('h5f7');
    expect(r.score).toBeGreaterThan(90000);
  }, 20000);

  it('plays from a recognized fixture position (IMG_9215, white to move)', async () => {
    const fen = 'r2qkb1r/ppp2ppp/5n2/4n3/6b1/2N1PN2/PPP3PP/R1BQKB1R w KQkq - 0 1';
    const r = await engine.search(fen, { level: 5, movetime: 200 });
    expect(new Chess(fen).moves({ verbose: true }).map((m) => m.lan)).toContain(r.bestmove);
  }, 20000);
});
