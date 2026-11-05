import { CellFeature, featureDistance } from './features';

/** FEN piece letter, or '.' for an empty square. */
export type Label = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | 'p' | 'n' | 'b' | 'r' | 'q' | 'k' | '.';

export interface Template {
  label: Label;
  feature: CellFeature;
  /** Fixture or source this template came from (used to exclude in leave-one-out tests). */
  source?: string;
}

export interface CellGuess {
  label: Label;
  /** Distance to the nearest template with the winning label. */
  distance: number;
  /** Distance gap to the nearest template with a different label; small means uncertain. */
  margin: number;
  /** Runner-up label, for quick correction in the UI. */
  alt: Label;
}

/** Anything with less ink than this is empty (shadows and anti-aliasing stay well below). */
export const EMPTY_FILL = 0.04;

export function classifyCell(f: CellFeature, templates: Template[]): CellGuess {
  if (f.fill < EMPTY_FILL) return { label: '.', distance: 0, margin: 1, alt: '.' };
  const best = new Map<Label, number>();
  // Built-in templates are pieces only; '.' templates come from user corrections
  // ("this was actually empty") and compete like any other label.
  for (const t of templates) {
    const d = featureDistance(f, t.feature);
    const cur = best.get(t.label);
    if (cur === undefined || d < cur) best.set(t.label, d);
  }
  const ranked = [...best].sort((a, b) => a[1] - b[1]);
  if (!ranked.length) return { label: '.', distance: 1, margin: 0, alt: '.' };
  const [label, distance] = ranked[0];
  const [alt, altD] = ranked[1] ?? ['.', 1];
  return { label, distance, margin: altD - distance, alt };
}
