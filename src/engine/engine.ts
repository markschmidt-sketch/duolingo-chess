/** Thin UCI wrapper around stockfish.js running in a Web Worker (or any postMessage-style port). */

export interface EnginePort {
  postMessage(cmd: string): void;
  onLine(cb: (line: string) => void): void;
  terminate(): void;
}

export interface Strength {
  /** 0–20; maps to Stockfish "Skill Level" plus a matching think-time cap. */
  level: number;
  /** Maximum time per move in ms. */
  movetime: number;
}

/** Rough Elo for each skill level, for display only. */
export function approxElo(level: number): number {
  return Math.round(800 + level * 110);
}

/**
 * Low skill levels also get a shallow depth cap. Skill Level alone still finds tactics
 * a beginner wouldn't, so depth keeps the bottom of the range playable for a casual player.
 */
export function depthFor(level: number): number | null {
  if (level >= 15) return null;
  return Math.max(1, Math.round(1 + level * 0.8));
}

export interface SearchResult {
  bestmove: string;
  /** Centipawns from the side to move, or mate-in-N encoded as ±(100000 - N). */
  score?: number;
  pv?: string[];
}

export class Engine {
  private listeners: ((line: string) => void)[] = [];
  private ready: Promise<void>;
  private busy: Promise<unknown> = Promise.resolve();

  constructor(private port: EnginePort) {
    port.onLine((line) => this.listeners.forEach((l) => l(line)));
    this.ready = this.until('uciok', () => port.postMessage('uci')).then(() => this.isReady());
  }

  static inWorker(url: string): Engine {
    const w = new Worker(url);
    return new Engine({
      postMessage: (c) => w.postMessage(c),
      onLine: (cb) => (w.onmessage = (e) => cb(String(e.data))),
      terminate: () => w.terminate(),
    });
  }

  private until(token: string, send: () => void): Promise<string> {
    return new Promise((resolve) => {
      const l = (line: string) => {
        if (line.startsWith(token)) {
          this.listeners = this.listeners.filter((x) => x !== l);
          resolve(line);
        }
      };
      this.listeners.push(l);
      send();
    });
  }

  private isReady(): Promise<void> {
    return this.until('readyok', () => this.port.postMessage('isready')).then(() => undefined);
  }

  /** Serialize searches so a stale "bestmove" can never be mistaken for a newer one. */
  private queue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.busy.then(fn, fn);
    this.busy = next.catch(() => undefined);
    return next;
  }

  search(fen: string, s: Strength): Promise<SearchResult> {
    return this.queue(async () => {
      await this.ready;
      const p = this.port;
      p.postMessage('ucinewgame');
      p.postMessage(`setoption name Skill Level value ${Math.round(s.level)}`);
      p.postMessage(`position fen ${fen}`);
      await this.isReady();
      let score: number | undefined;
      let pv: string[] | undefined;
      const info = (line: string) => {
        if (!line.startsWith('info') || !line.includes(' pv ')) return;
        const cp = line.match(/ score cp (-?\d+)/);
        const mate = line.match(/ score mate (-?\d+)/);
        if (cp) score = +cp[1];
        else if (mate) score = Math.sign(+mate[1]) * (100000 - Math.abs(+mate[1]));
        pv = line.split(' pv ')[1].trim().split(/\s+/);
      };
      this.listeners.push(info);
      const depth = depthFor(s.level);
      const line = await this.until('bestmove', () =>
        p.postMessage(`go movetime ${s.movetime}` + (depth ? ` depth ${depth}` : '')),
      );
      this.listeners = this.listeners.filter((x) => x !== info);
      return { bestmove: line.split(/\s+/)[1], score, pv };
    });
  }

  /** Full-strength analysis for hints and the eval bar, independent of opponent strength. */
  analyse(fen: string, movetime = 800): Promise<SearchResult> {
    return this.search(fen, { level: 20, movetime });
  }

  stop(): void {
    this.port.postMessage('stop');
  }

  terminate(): void {
    this.port.terminate();
  }
}
