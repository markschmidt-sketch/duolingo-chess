/** Tiny DOM helpers — the app is small enough that a framework would be overhead. */

type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string };

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props | null = null,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k in el && k !== 'style') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export function mount(...nodes: Child[]): HTMLElement {
  const app = document.getElementById('app')!;
  app.replaceChildren(...nodes.filter((n): n is Node | string => n !== null && n !== undefined && n !== false));
  window.scrollTo(0, 0);
  return app;
}

/** Segmented control. */
export function seg<T extends string>(
  options: [T, string][],
  value: T,
  onChange: (v: T) => void,
): HTMLDivElement {
  const wrap = h('div', { class: 'seg' });
  const render = (cur: T) => {
    wrap.replaceChildren(
      ...options.map(([v, label]) =>
        h('button', { class: v === cur ? 'on' : '', type: 'button', onclick: () => (render(v), onChange(v)) }, label),
      ),
    );
  };
  render(value);
  return wrap;
}

export function field(label: string, ...control: Child[]): HTMLDivElement {
  return h('div', { class: 'field' }, h('label', null, label), ...control);
}

/** Bottom sheet; resolves with whatever `body` passes to `close`. */
export function sheet<T>(build: (close: (v: T | null) => void) => Node): Promise<T | null> {
  return new Promise((resolve) => {
    const overlay = h('div', { class: 'modal' });
    const close = (v: T | null) => {
      overlay.remove();
      resolve(v);
    };
    overlay.addEventListener('click', (e) => e.target === overlay && close(null));
    overlay.append(h('div', { class: 'card' }, build(close)));
    document.body.append(overlay);
  });
}

export function toast(msg: string): void {
  const t = h('div', {
    class: 'banner ok',
    style:
      'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom) + 20px);z-index:60;max-width:90vw',
  }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 1800);
}
