import type { Side } from './position';

export interface Settings {
  myColor: Side;
  toMove: Side;
  level: number;
  movetime: number;
  showEval: boolean;
  autoQueen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  myColor: 'w',
  toMove: 'b',
  level: 5,
  movetime: 1000,
  showEval: false,
  autoQueen: true,
};

export interface SavedGame {
  startFen: string;
  /** UCI moves played since startFen. */
  moves: string[];
  myColor: Side;
  level: number;
  movetime: number;
  savedAt: number;
}

const SETTINGS_KEY = 'dc.settings';
const GAME_KEY = 'dc.game';

function read<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...(read<Partial<Settings>>(SETTINGS_KEY) ?? {}) };
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function loadGame(): SavedGame | null {
  return read<SavedGame>(GAME_KEY);
}

export function saveGame(g: SavedGame): void {
  localStorage.setItem(GAME_KEY, JSON.stringify(g));
}

export function clearGame(): void {
  localStorage.removeItem(GAME_KEY);
}
