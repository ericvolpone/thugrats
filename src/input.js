/**
 * Run controls — abilities fire on their own, you move, turn the camera and jump.
 *
 *   Keyboard: WASD / arrows move · Q / E turn camera · Space jump
 *   Mouse:    drag anywhere to turn the camera
 *   Gamepad:  left stick move · right stick turn · A (bottom button) jump
 *   Touch:    left part of the screen = floating joystick
 *             right part = drag sideways to turn · JUMP button
 *
 * move() is screen-relative ({x: right, y: forward}); the Run rotates it by the
 * camera yaw. turn() returns this frame's yaw change in radians.
 */
const STICK_R = 60;
const MOUSE_TURN = 0.006; // radians per pixel
const TOUCH_TURN = 0.009;
const KEY_TURN = 2.4; // radians per second
const PAD_TURN = 3.0;

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.stick = null; // {id, ox, oy, x, y}
    this.look = null; // {id, x}
    this.turnAcc = 0;
    this.jumpQueued = false;
    this.prevPadJump = false;
    this.stickEl = document.getElementById('stick');
    this.knobEl = this.stickEl.querySelector('.knob');

    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.pressed.add(e.code);
        if (e.code === 'Space') this.jumpQueued = true;
      }
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());

    const zone = document.getElementById('touch-zone');
    zone.addEventListener('contextmenu', (e) => e.preventDefault());
    zone.addEventListener('pointerdown', (e) => {
      const touch = e.pointerType === 'touch';
      const leftSide = e.clientX < innerWidth * 0.55;
      try { zone.setPointerCapture(e.pointerId); } catch { /* gone */ }
      if (touch && leftSide && !this.stick) {
        this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        this.stickEl.style.transform = `translate(${e.clientX - STICK_R}px, ${e.clientY - STICK_R}px)`;
        this.stickEl.classList.add('on');
        this.updateKnob();
      } else if (!this.look) {
        this.look = { id: e.pointerId, x: e.clientX, k: touch ? TOUCH_TURN : MOUSE_TURN };
      }
    });
    zone.addEventListener('pointermove', (e) => {
      if (this.stick?.id === e.pointerId) {
        this.stick.x = e.clientX;
        this.stick.y = e.clientY;
        const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy;
        const d = Math.hypot(dx, dy);
        if (d > STICK_R * 1.4) {
          const k = (d - STICK_R * 1.4) / d;
          this.stick.ox += dx * k;
          this.stick.oy += dy * k;
          this.stickEl.style.transform = `translate(${this.stick.ox - STICK_R}px, ${this.stick.oy - STICK_R}px)`;
        }
        this.updateKnob();
      } else if (this.look?.id === e.pointerId) {
        this.turnAcc -= (e.clientX - this.look.x) * this.look.k;
        this.look.x = e.clientX;
      }
    });
    const end = (e) => {
      if (this.stick?.id === e.pointerId) {
        this.stick = null;
        this.stickEl.classList.remove('on');
      }
      if (this.look?.id === e.pointerId) this.look = null;
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    const jb = document.getElementById('jump-btn');
    jb.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.jumpQueued = true;
      jb.classList.add('on');
    });
    const up = () => jb.classList.remove('on');
    jb.addEventListener('pointerup', up);
    jb.addEventListener('pointercancel', up);
    const sb = document.getElementById('sig-btn');
    sb.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.sigQueued = true;
    });
  }

  setTouchEnabled(on) {
    document.getElementById('touch-zone').classList.toggle('hidden', !on);
    document.getElementById('jump-btn').classList.toggle('hidden', !on);
    document.getElementById('sig-btn').classList.toggle('hidden', !on);
    if (!on) {
      this.stick = null;
      this.look = null;
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

  pads() {
    return [...(navigator.getGamepads?.() ?? [])].filter(Boolean);
  }

  /** Screen-relative movement {x: right, y: forward}, |v| <= 1. */
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
    for (const pad of this.pads()) {
      const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > 0.2) { x += ax; y -= ay; }
    }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y };
  }

  /** Camera yaw change this frame (radians, + = turn left). */
  turn(dt) {
    let t = this.turnAcc;
    this.turnAcc = 0;
    if (this.down.has('KeyQ')) t += KEY_TURN * dt;
    if (this.down.has('KeyE')) t -= KEY_TURN * dt;
    for (const pad of this.pads()) {
      const rx = pad.axes[2] ?? 0;
      if (Math.abs(rx) > 0.2) t -= rx * Math.abs(rx) * PAD_TURN * dt;
    }
    return t;
  }

  /** Ignore the pad's A button until it is released (it was used in a menu). */
  blockPadJump() {
    this.prevPadJump = true;
  }

  /** True once per jump press (any device). */
  jump() {
    let j = this.jumpQueued;
    this.jumpQueued = false;
    const padJump = this.pads().some((p) => p.buttons[0]?.pressed);
    if (padJump && !this.prevPadJump) j = true;
    this.prevPadJump = padJump;
    return j;
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** True once per signature-move press: F, gamepad Y, or the touch SIG button. */
  signature() {
    const padY = this.pads().some((p) => p.buttons[3]?.pressed);
    const hit = this.sigQueued || this.pressed.has('KeyF') || (padY && !this.prevPadSig);
    this.sigQueued = false;
    return hit;
  }

  endFrame() {
    this.pressed.clear();
    // track Y every frame (menus included) so a Y used on a card screen can't fire a move
    this.prevPadSig = this.pads().some((p) => p.buttons[3]?.pressed);
  }
}
