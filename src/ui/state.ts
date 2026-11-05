import type { Recognition } from '../vision';
import type { Grid } from '../vision/fen';
import type { Side } from '../game/position';

/** A position on its way from the screenshot to a game. */
export interface Draft {
  /** FEN order, rank 8 first. */
  grid: Grid;
  /** Whether White is at the bottom of the screenshot (and of the editor). */
  whiteAtBottom: boolean;
  /** The screenshot it came from, if any. */
  source?: { canvas: HTMLCanvasElement; rec: Recognition };
  /** Side to move implied by Duolingo's last-move highlight. */
  toMoveHint?: Side | null;
}
