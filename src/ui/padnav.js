/**
 * Gamepad menu navigation for every DOM screen (hideout, level-up/loot cards,
 * pause, end screen).
 *
 *   D-pad / left stick  move focus to the nearest button in that direction
 *   A (bottom)          press the focused button
 *   B (right)           back: close pause / resume
 *   X (left)            reroll (on card screens)
 *   Y (top)             banish mode (on card screens)
 *   LB / RB             previous / next hideout tab
 *   Start               pause / resume during a run
 *
 * Works on whichever layer is on top: an open overlay wins over the hideout.
 * During a run with no overlay open the pad is left alone for movement.
 */
const LAYERS = ['#end', '#choice', '#pause', '#home'];
const FOCUSABLE = 'button:not([disabled]), [data-nav]';
const REPEAT_FIRST = 0.32, REPEAT_NEXT = 0.14;

export class PadNav {
  constructor({ onPause, onBack, input }) {
    this.onPause = onPause;
    this.onBack = onBack;
    this.input = input;
    this.prev = [];
    this.held = null; // {dir, t}
    this.active = false; // a pad was used for menus recently
    this.focused = null;
    addEventListener('pointerdown', () => this.setActive(false), { capture: true });
    addEventListener('keydown', (e) => { if (!e.code.startsWith('Arrow')) this.setActive(false); }, { capture: true });
  }

  setActive(on) {
    if (this.active === on) return;
    this.active = on;
    document.body.classList.toggle('padnav', on);
  }

  layer() {
    for (const sel of LAYERS) {
      const el = document.querySelector(sel);
      if (el && !el.classList.contains('hidden')) return el;
    }
    return null;
  }

  items(layer) {
    return [...layer.querySelectorAll(FOCUSABLE)].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    });
  }

  focus(el) {
    if (!el) return;
    this.focused = el;
    const layer = this.layer();
    if (layer) this.lastIndex = this.items(layer).indexOf(el);
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // tell the HUD even when the window itself isn't focused (no native focus events then)
    el.dispatchEvent(new CustomEvent('padfocus', { bubbles: true }));
  }

  /** Spatial move: best element whose centre lies in direction (dx, dy). */
  move(dx, dy, layer) {
    const list = this.items(layer);
    if (!list.length) return;
    const cur = list.includes(document.activeElement) ? document.activeElement : null;
    if (!cur) return this.focus(this.preferred(list));
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bs = Infinity;
    for (const e of list) {
      if (e === cur) continue;
      const b = e.getBoundingClientRect();
      const vx = b.left + b.width / 2 - ax, vy = b.top + b.height / 2 - ay;
      const along = vx * dx + vy * dy;
      if (along <= 4) continue;
      const across = Math.abs(vx * dy - vy * dx);
      const score = along + across * 2.5;
      if (score < bs) { bs = score; best = e; }
    }
    if (best) this.focus(best);
  }

  preferred(list) {
    return list.find((e) => e.hasAttribute('data-default')) ?? list.find((e) => e.classList.contains('card')) ?? list.find((e) => e.classList.contains('diff-btn')) ?? list.find((e) => e.classList.contains('btn')) ?? list[0];
  }

  update(dt, inRun) {
    const pad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
    if (!pad) return;
    const b = pad.buttons.map((x) => x?.pressed);
    const edge = (i) => b[i] && !this.prev[i];
    const layer = this.layer();
    const menuOpen = layer && (!inRun || layer.id !== 'home');

    if (edge(9)) { this.onPause?.(); this.setActive(true); }
    if (!menuOpen) {
      this.prev = b;
      this.held = null;
      return;
    }
    if (b.some(Boolean) || Math.hypot(pad.axes[0] ?? 0, pad.axes[1] ?? 0) > 0.5) this.setActive(true);

    // direction from d-pad or left stick
    let dir = null;
    const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
    if (b[12] || ay < -0.55) dir = 'up';
    else if (b[13] || ay > 0.55) dir = 'down';
    else if (b[14] || ax < -0.55) dir = 'left';
    else if (b[15] || ax > 0.55) dir = 'right';
    if (dir) {
      if (!this.held || this.held.dir !== dir) {
        this.held = { dir, t: REPEAT_FIRST };
        this.step(dir, layer);
      } else if ((this.held.t -= dt) <= 0) {
        this.held.t = REPEAT_NEXT;
        this.step(dir, layer);
      }
    } else this.held = null;

    if (edge(0)) {
      const list = this.items(layer);
      const cur = list.includes(document.activeElement) ? document.activeElement : null;
      if (cur) cur.click();
      else this.focus(this.preferred(list));
      this.input?.blockPadJump();
    }
    if (edge(1)) this.onBack?.(layer.id);
    if (edge(2)) layer.querySelector('#choice-reroll:not([disabled])')?.click();
    if (edge(3)) layer.querySelector('#choice-banish:not([disabled])')?.click();
    if (layer.id === 'home' && (edge(4) || edge(5))) {
      const tabs = [...layer.querySelectorAll('.tabs button')];
      const i = tabs.findIndex((t) => t.classList.contains('on'));
      const next = tabs[(i + (edge(5) ? 1 : -1) + tabs.length) % tabs.length];
      next?.click();
      requestAnimationFrame(() => this.focus(this.layer()?.querySelector('.tabs button.on')));
    }
    // keep focus inside the current layer (screens re-render)
    if (this.active && !layer.contains(document.activeElement)) {
      const list = this.items(layer);
      // screens re-render after a click: land on the same spot when we can
      this.focus(this.lastLayer === layer.id && this.lastIndex >= 0 ? list[Math.min(this.lastIndex, list.length - 1)] : this.preferred(list));
    }
    this.lastLayer = layer.id;
    this.prev = b;
  }

  step(dir, layer) {
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    this.move(d[0], d[1], layer);
  }
}
