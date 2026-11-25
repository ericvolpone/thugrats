/**
 * Movement input only — every ability fires on its own.
 * Keyboard: WASD / arrows. Gamepad: left stick. Touch: floating joystick
 * anywhere on the lower/left part of the screen (actually anywhere not on a button).
 * move = {x, y} with |move| <= 1, y is "up" on screen (forward).
 */
const STICK_R = 60;

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.stick = null; // {id, ox, oy, x, y}
    this.touchEnabled = false;
    this.stickEl = document.getElementById('stick');
    this.knobEl = this.stickEl.querySelector('.knob');

    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());

    const zone = document.getElementById('touch-zone');
    zone.addEventListener('pointerdown', (e) => {
      if (this.stick) return;
      try { zone.setPointerCapture(e.pointerId); } catch { /* gone */ }
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      this.stickEl.style.transform = `translate(${e.clientX - STICK_R}px, ${e.clientY - STICK_R}px)`;
      this.stickEl.classList.add('on');
      this.updateKnob();
    });
    zone.addEventListener('pointermove', (e) => {
      if (this.stick?.id !== e.pointerId) return;
      this.stick.x = e.clientX;
      this.stick.y = e.clientY;
      // drag the base along so the stick never "runs out"
      const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > STICK_R * 1.4) {
        const k = (d - STICK_R * 1.4) / d;
        this.stick.ox += dx * k;
        this.stick.oy += dy * k;
        this.stickEl.style.transform = `translate(${this.stick.ox - STICK_R}px, ${this.stick.oy - STICK_R}px)`;
      }
      this.updateKnob();
    });
    const end = (e) => {
      if (this.stick?.id !== e.pointerId) return;
      this.stick = null;
      this.stickEl.classList.remove('on');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  setTouchEnabled(on) {
    this.touchEnabled = on;
    document.getElementById('touch-zone').classList.toggle('hidden', !on);
    if (!on) {
      this.stick = null;
      this.stickEl.classList.remove('on');
    }
  }

  updateKnob() {
    const s = this.stick;
    let dx = s.x - s.ox, dy = s.y - s.oy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
    this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  /** Returns {x, y} movement, y = forward/up on screen. */
  move() {
    let x = 0, y = 0;
    const k = this.down;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (this.stick) {
      const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > 8) {
        const m = Math.min(1, d / STICK_R);
        x += (dx / d) * m;
        y -= (dy / d) * m;
      }
    }
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (!pad) continue;
      const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > 0.2) { x += ax; y -= ay; }
    }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y };
  }

  /** One-frame key edge. */
  wasPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
  }
}
