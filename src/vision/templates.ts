import data from './templates.json';
import { decodeFeature } from './features';
import type { Label, Template } from './classify';

let cache: Template[] | null = null;

/** Built-in templates generated from the fixtures by scripts/build-templates.ts. */
export function loadTemplates(): Template[] {
  cache ??= (data as { label: Label; f: string; src: string }[]).map((t) => ({
    label: t.label,
    feature: decodeFeature(t.f),
    source: t.src,
  }));
  return cache;
}
