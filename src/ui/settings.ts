import { h, seg, field, sheet, toast } from './dom';
import { loadSettings, saveSettings, Settings } from '../game/storage';
import { forgetLearned } from '../vision/learned';
import { levelField, THINK_TIMES } from './setup';

/** Defaults for new games, plus in-game engine strength when `current` is given. */
export async function openSettings(current?: { level: number; movetime: number }): Promise<void> {
  const s: Settings = { ...loadSettings(), ...(current ?? {}) };
  const check = (label: string, key: 'showEval' | 'autoQueen') => {
    const cb = h('input', { type: 'checkbox', checked: s[key] }) as HTMLInputElement;
    cb.addEventListener('change', () => (s[key] = cb.checked));
    return h('label', { class: 'check' }, cb, label);
  };
  await sheet<void>((close) =>
    h('div', { class: 'card', style: 'border:0;padding:0;max-height:80dvh;overflow:auto' },
      h('h2', null, 'Settings'),
      current ? null : field('I usually play', seg([['w', 'White'], ['b', 'Black']], s.myColor, (v) => (s.myColor = v))),
      current ? null : field('Usually next to move', seg([['w', 'White'], ['b', 'Black']], s.toMove, (v) => (s.toMove = v))),
      levelField(s.level, (v) => (s.level = v)),
      field('Think time', seg(THINK_TIMES, String(s.movetime), (v) => (s.movetime = +v))),
      check('Show evaluation bar', 'showEval'),
      check('Always promote to queen', 'autoQueen'),
      current
        ? null
        : h('button', { type: 'button', class: 'link', onclick: async () => {
            await forgetLearned();
            toast('Forgot learned corrections');
          } }, 'Forget learned board corrections'),
      h('button', { class: 'primary', type: 'button', onclick: () => (saveSettings(s), close(null)) }, 'Done'),
    ),
  );
}
