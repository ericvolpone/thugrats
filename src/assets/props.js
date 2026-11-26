import * as THREE from 'three';
import { paint, C, hash } from '../util.js';
import { registerProp, merge } from './models.js';

/** Static props. Each function returns a painted geometry at the origin (feet at y=0). */
export const PROPS = {
  car(color = '#8a1c1c') {
    const body = C(color), dark = C('#1a1a1e'), glass = C('#9cc6e0'), chrome = C('#cfd3d8');
    return merge([
      paint(new THREE.BoxGeometry(1.9, 0.55, 4.2).translate(0, 0.6, 0), body),
      paint(new THREE.BoxGeometry(1.7, 0.5, 2.2).translate(0, 1.12, -0.2), (p) => (Math.abs(p.x) > 0.8 || Math.abs(p.z + 0.2) > 1.05 ? glass : body)),
      paint(new THREE.BoxGeometry(1.75, 0.08, 2.3).translate(0, 1.4, -0.2), body),
      paint(new THREE.BoxGeometry(2.0, 0.15, 0.2).translate(0, 0.45, 2.12), chrome),
      paint(new THREE.BoxGeometry(2.0, 0.15, 0.2).translate(0, 0.45, -2.12), chrome),
      ...[[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]].map(([x, z]) =>
        paint(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 8).rotateZ(Math.PI / 2).translate(x * 0.9, 0.38, z), dark)),
      paint(new THREE.BoxGeometry(0.3, 0.12, 0.05).translate(-0.6, 0.7, 2.13), C('#fff6c0')),
      paint(new THREE.BoxGeometry(0.3, 0.12, 0.05).translate(0.6, 0.7, 2.13), C('#fff6c0')),
    ]);
  },
  dumpster() {
    const g = C('#2f6b3a');
    return merge([
      paint(new THREE.BoxGeometry(2.2, 1.2, 1.3).translate(0, 0.65, 0), g),
      paint(new THREE.BoxGeometry(2.3, 0.1, 1.4).rotateX(-0.15).translate(0, 1.32, -0.05), C('#24502c')),
    ]);
  },
  trashcan() {
    return merge([
      paint(new THREE.CylinderGeometry(0.35, 0.3, 0.9, 8).translate(0, 0.45, 0), C('#7d848c')),
      paint(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 8).translate(0, 0.94, 0), C('#5f656c')),
    ]);
  },
  hydrant() {
    const r = C('#d2302c');
    return merge([
      paint(new THREE.CylinderGeometry(0.18, 0.22, 0.7, 7).translate(0, 0.35, 0), r),
      paint(new THREE.IcosahedronGeometry(0.2, 0).translate(0, 0.75, 0), r),
      paint(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 5).rotateZ(Math.PI / 2).translate(0, 0.45, 0), C('#b0221f')),
    ]);
  },
  lamp() {
    const m = C('#2a2d33');
    return merge([
      paint(new THREE.CylinderGeometry(0.08, 0.12, 4.2, 6).translate(0, 2.1, 0), m),
      paint(new THREE.BoxGeometry(0.1, 0.1, 0.9).translate(0, 4.1, 0.4), m),
      paint(new THREE.ConeGeometry(0.3, 0.3, 6).translate(0, 3.95, 0.85), C('#ffe9a0')),
    ]);
  },
  crate() {
    return paint(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), (p) => (Math.abs(p.x) > 0.45 || Math.abs(p.z) > 0.45 ? C('#9a6a3a') : C('#7a4f28')));
  },
  barrel() {
    return paint(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 8).translate(0, 0.55, 0), (p) => (Math.abs(p.y - 0.55) > 0.35 ? C('#3b3b3b') : C('#2e5a8a')));
  },
  bench() {
    const w = C('#7b5432'), m = C('#2a2a2a');
    return merge([
      paint(new THREE.BoxGeometry(2, 0.1, 0.5).translate(0, 0.5, 0), w),
      paint(new THREE.BoxGeometry(2, 0.5, 0.08).translate(0, 0.85, -0.22), w),
      paint(new THREE.BoxGeometry(0.1, 0.5, 0.5).translate(-0.9, 0.25, 0), m),
      paint(new THREE.BoxGeometry(0.1, 0.5, 0.5).translate(0.9, 0.25, 0), m),
    ]);
  },
  container(color = '#b8452c') {
    const c = C(color);
    return paint(new THREE.BoxGeometry(3, 3, 7.5).translate(0, 1.5, 0), (p) => (Math.abs(p.y - 1.5) > 1.4 ? c.clone().multiplyScalar(0.7) : c), 0.18);
  },
  bollard() {
    return merge([
      paint(new THREE.CylinderGeometry(0.3, 0.35, 0.7, 8).translate(0, 0.35, 0), C('#333')),
      paint(new THREE.CylinderGeometry(0.38, 0.3, 0.15, 8).translate(0, 0.75, 0), C('#333')),
    ]);
  },
  slot() {
    return merge([
      paint(new THREE.BoxGeometry(1, 1.8, 0.9).translate(0, 0.9, 0), C('#7a1020')),
      paint(new THREE.BoxGeometry(0.8, 0.5, 0.05).translate(0, 1.3, 0.46), C('#ffe27a')),
      paint(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 5).translate(0.6, 1.3, 0), C('#ccc')),
      paint(new THREE.IcosahedronGeometry(0.1, 0).translate(0.6, 1.65, 0), C('#e02')),
    ]);
  },
  palm() {
    const parts = [paint(new THREE.CylinderGeometry(0.15, 0.25, 4.5, 6).translate(0, 2.25, 0), C('#8a6a44'))];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      parts.push(paint(new THREE.BoxGeometry(0.5, 0.06, 2.2).translate(0, 0, 1.1).rotateX(0.5).rotateY(a).translate(0, 4.5, 0), C('#2f8a3a')));
    }
    return merge(parts);
  },
  /** Piazza fountain: round basin, column, top bowl. ~1.1m rim. */
  fountain(r = 2.6) {
    const stone = C('#cfc6b4'), water = C('#4fa6d8');
    return merge([
      paint(new THREE.CylinderGeometry(r, r + 0.2, 1.1, 18).translate(0, 0.55, 0), stone),
      paint(new THREE.CylinderGeometry(r - 0.3, r - 0.3, 0.05, 18).translate(0, 1.0, 0), water),
      paint(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 8).translate(0, 1.6, 0), stone),
      paint(new THREE.CylinderGeometry(1.1, 0.4, 0.4, 12).translate(0, 2.8, 0), stone),
      paint(new THREE.CylinderGeometry(0.9, 0.9, 0.05, 12).translate(0, 2.98, 0), water),
      paint(new THREE.IcosahedronGeometry(0.3, 0).translate(0, 3.3, 0), stone),
    ]);
  },
  /** Café table under a striped umbrella. */
  cafe(color = '#c8281e') {
    const c = C(color), w = C('#f4f1ea');
    const parts = [
      paint(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 10).translate(0, 0.75, 0), C('#e8e2d0')),
      paint(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5).translate(0, 1.2, 0), C('#333')),
      paint(new THREE.ConeGeometry(1.5, 0.6, 8, 1, true).translate(0, 2.5, 0), (p) => (Math.floor((Math.atan2(p.x, p.z) + Math.PI) / (Math.PI / 4)) % 2 ? c : w)),
    ];
    for (const a of [0, 2.1, 4.2]) parts.push(paint(new THREE.BoxGeometry(0.4, 0.5, 0.4).translate(Math.sin(a) * 0.95, 0.25, Math.cos(a) * 0.95), C('#5a3a22')));
    return merge(parts);
  },
  /** Market stall: counter with produce and a striped awning. */
  stall(color = '#2f8a3a') {
    const c = C(color), w = C('#f4f1ea');
    const parts = [
      paint(new THREE.BoxGeometry(3, 1, 1.4).translate(0, 0.5, 0), C('#8a5a32')),
      paint(new THREE.BoxGeometry(3.2, 0.1, 2).rotateX(-0.25).translate(0, 2.3, 0.2), (p) => (Math.floor((p.x + 1.6) * 2) % 2 ? c : w)),
    ];
    for (const x of [-1.45, 1.45]) parts.push(paint(new THREE.BoxGeometry(0.1, 2.3, 0.1).translate(x, 1.15, -0.6), C('#5a3a22')));
    const fruit = ['#e23a2a', '#f2c037', '#7ac24a', '#ff8a2a'];
    for (let i = 0; i < 8; i++) parts.push(paint(new THREE.IcosahedronGeometry(0.18, 0).translate(-1.2 + i * 0.34, 1.1, (i % 2) * 0.3 - 0.15), C(fruit[i % 4])));
    return merge(parts);
  },
  vespa(color = '#7ec8b8') {
    const c = C(color);
    return merge([
      paint(new THREE.BoxGeometry(0.5, 0.5, 1.4).translate(0, 0.55, -0.1), c),
      paint(new THREE.BoxGeometry(0.45, 0.15, 0.6).translate(0, 0.9, -0.3), C('#3a2a22')),
      paint(new THREE.BoxGeometry(0.35, 0.8, 0.15).translate(0, 0.8, 0.6), c),
      paint(new THREE.BoxGeometry(0.8, 0.06, 0.06).translate(0, 1.2, 0.6), C('#ccc')),
      ...[0.65, -0.6].map((z) => paint(new THREE.CylinderGeometry(0.25, 0.25, 0.15, 8).rotateZ(Math.PI / 2).translate(0, 0.25, z), C('#1a1a1e'))),
    ]);
  },
  planter() {
    const parts = [paint(new THREE.BoxGeometry(1.2, 0.6, 1.2).translate(0, 0.3, 0), C('#b06a3a'))];
    for (let i = 0; i < 5; i++) parts.push(paint(new THREE.IcosahedronGeometry(0.28, 0).translate((i % 3) * 0.3 - 0.3, 0.75, Math.floor(i / 3) * 0.4 - 0.2), i % 2 ? C('#e24a7a') : C('#3a8a3a')));
    return merge(parts);
  },
  /** Gantry crane straddling a quay: 4 legs, a top beam and a boom. */
  crane(color = '#e0a020') {
    const c = C(color);
    const parts = [];
    for (const [x, z] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) parts.push(paint(new THREE.BoxGeometry(0.8, 18, 0.8).translate(x, 9, z), c));
    parts.push(paint(new THREE.BoxGeometry(11, 1.2, 1).translate(0, 18, -3), c), paint(new THREE.BoxGeometry(11, 1.2, 1).translate(0, 18, 3), c));
    parts.push(paint(new THREE.BoxGeometry(1.4, 1.4, 30).translate(0, 19.2, 8), c));
    parts.push(paint(new THREE.BoxGeometry(2.4, 2, 2.4).translate(0, 17.2, 0), C('#3a3f47')));
    parts.push(paint(new THREE.BoxGeometry(0.1, 10, 0.1).translate(0, 13, 14), C('#222')));
    return merge(parts);
  },
  /** Cargo ship hull seen from the quay (length along z). */
  ship(len = 44) {
    const hull = C('#2c3e5a'), red = C('#8a2a22'), white = C('#e8e8e8');
    const parts = [
      paint(new THREE.BoxGeometry(12, 7, len).translate(0, 2.5, 0), (p) => (p.y < 0.5 ? red : hull)),
      paint(new THREE.ConeGeometry(6, 8, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.9).rotateX(Math.PI / 2).translate(0, 2.5, len / 2 + 3.5), hull),
      paint(new THREE.BoxGeometry(9, 6, 7).translate(0, 9, -len / 2 + 5), white),
      paint(new THREE.CylinderGeometry(1, 1, 4, 8).translate(0, 14, -len / 2 + 5), red),
    ];
    const cols = ['#b8452c', '#2c6bb8', '#3a8a4a', '#c8a020'];
    for (let i = 0; i < 6; i++) parts.push(paint(new THREE.BoxGeometry(10, 2.6, 5).translate(0, 7.3 + (i % 2) * 2.6, -len / 2 + 12 + Math.floor(i / 2) * 7), C(cols[i % 4])));
    return merge(parts);
  },
  forklift() {
    const y = C('#e8b020');
    return merge([
      paint(new THREE.BoxGeometry(1.3, 0.9, 2).translate(0, 0.7, 0), y),
      paint(new THREE.BoxGeometry(1.2, 0.1, 1.2).translate(0, 2.1, -0.2), y),
      ...[[-0.55, -0.7], [0.55, -0.7], [-0.55, 0.3], [0.55, 0.3]].map(([x, z]) => paint(new THREE.BoxGeometry(0.06, 1.4, 0.06).translate(x, 1.45, z), C('#333'))),
      paint(new THREE.BoxGeometry(1.4, 1.8, 0.1).translate(0, 1, 1.05), C('#333')),
      paint(new THREE.BoxGeometry(0.15, 0.06, 1).translate(-0.35, 0.15, 1.5), C('#777')),
      paint(new THREE.BoxGeometry(0.15, 0.06, 1).translate(0.35, 0.15, 1.5), C('#777')),
    ]);
  },
  /** Big neon sign on two poles. */
  neon(text = '#ff4fd8', frame = '#2a1a3a', w = 6, h = 3, y = 6) {
    const parts = [
      paint(new THREE.BoxGeometry(w, h, 0.4).translate(0, y + h / 2, 0), C(frame)),
      paint(new THREE.BoxGeometry(w - 0.6, h - 0.6, 0.45).translate(0, y + h / 2, 0), (p) => (Math.floor(p.x * 1.5 + p.y * 1.5) % 2 ? C(text) : C('#fff3a0'))),
    ];
    for (const x of [-w / 3, w / 3]) parts.push(paint(new THREE.BoxGeometry(0.3, y, 0.3).translate(x, y / 2, 0), C('#333')));
    return merge(parts);
  },
  roulette() {
    return merge([
      paint(new THREE.BoxGeometry(3, 0.9, 1.6).translate(0, 0.45, 0), C('#3a1a12')),
      paint(new THREE.BoxGeometry(2.8, 0.05, 1.4).translate(0, 0.92, 0), C('#1f6b3a')),
      paint(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 12).translate(-0.9, 1.0, 0), (p) => (Math.floor((Math.atan2(p.x + 0.9, p.z) + Math.PI) * 3) % 2 ? C('#c8281e') : C('#111'))),
    ]);
  },
  dice() {
    const parts = [paint(new THREE.BoxGeometry(4, 4, 4).translate(0, 2, 0), C('#e8e8e8'))];
    for (const [x, y, z] of [[0, 2, 2.02], [-1, 3, 2.02], [1, 1, 2.02], [2.02, 2, 0], [2.02, 3, 1], [2.02, 1, -1], [0, 4.02, 0]]) {
      parts.push(paint(new THREE.BoxGeometry(z > 2 ? 0.7 : 0.08, y > 4 ? 0.08 : 0.7, z > 2 ? 0.08 : 0.7).translate(x, y, z), C('#c8281e')));
    }
    return merge(parts);
  },
  /** Low wall / fence segment along x. */
  fence(len = 6, h = 1.2, color = '#5a5f66') {
    const parts = [paint(new THREE.BoxGeometry(len, 0.12, 0.12).translate(0, h, 0), C(color)), paint(new THREE.BoxGeometry(len, 0.12, 0.12).translate(0, h * 0.5, 0), C(color))];
    for (let x = -len / 2; x <= len / 2 + 0.01; x += 2) parts.push(paint(new THREE.BoxGeometry(0.15, h + 0.1, 0.15).translate(x, (h + 0.1) / 2, 0), C(color)));
    return merge(parts);
  },
  /** String of bulbs hung between two points at height y (sags in the middle). */
  lights(x0, z0, x1, z1, y = 6) {
    const parts = [];
    const n = Math.max(4, Math.floor(Math.hypot(x1 - x0, z1 - z0) / 1.5));
    const cols = ['#ffe9a0', '#ff8a7a', '#9ad8ff', '#a0ff9a'];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const yy = y - Math.sin(k * Math.PI) * 1.2;
      parts.push(paint(new THREE.IcosahedronGeometry(0.12, 0).translate(x0 + (x1 - x0) * k, yy, z0 + (z1 - z0) * k), C(cols[i % 4]), 0));
    }
    return merge(parts);
  },
  /** A city block / warehouse. w,d footprint, h height, color, window color. */
  building(w, d, h, color, seed = 1, windowColor = '#ffd77a') {
    const base = C(color);
    const win = C(windowColor);
    const darkWin = C('#2a3040');
    const parts = [paint(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), base, 0.06)];
    parts.push(paint(new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3).translate(0, h + 0.15, 0), base.clone().multiplyScalar(0.75)));
    // window grid on all 4 faces
    const floors = Math.max(1, Math.floor((h - 1.5) / 2.2));
    for (const [face, len] of [[0, w], [1, d], [2, w], [3, d]]) {
      const cols = Math.max(1, Math.floor(len / 2.2));
      for (let f = 0; f < floors; f++) {
        for (let c = 0; c < cols; c++) {
          const lit = hash(seed * 31 + face * 7 + f * 13 + c) > 0.55;
          const u = -len / 2 + (c + 0.5) * (len / cols);
          const y = 2 + f * 2.2;
          const g = new THREE.BoxGeometry(0.9, 1.1, 0.06);
          if (face === 0) g.translate(u, y, d / 2 + 0.02);
          if (face === 2) g.translate(u, y, -d / 2 - 0.02);
          if (face === 1) g.rotateY(Math.PI / 2).translate(w / 2 + 0.02, y, u);
          if (face === 3) g.rotateY(Math.PI / 2).translate(-w / 2 - 0.02, y, u);
          parts.push(paint(g, lit ? win : darkWin, 0));
        }
      }
    }
    return merge(parts);
  },
  // ── Chinatown ──
  /** String of red paper lanterns between two points. */
  lanterns(x0, z0, x1, z1, y = 6) {
    const parts = [];
    const n = Math.max(3, Math.floor(Math.hypot(x1 - x0, z1 - z0) / 2.2));
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const yy = y - Math.sin(k * Math.PI) * 1.0;
      const x = x0 + (x1 - x0) * k, z = z0 + (z1 - z0) * k;
      parts.push(paint(new THREE.IcosahedronGeometry(0.2, 1).scale(1, 1.2, 1).translate(x, yy - 0.28, z), C(i % 4 === 3 ? '#f2c037' : '#e0281e'), 0));
      parts.push(paint(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 6).translate(x, yy - 0.02, z), C('#2a1a10'), 0));
    }
    return merge(parts);
  },
  /** Three-tier pagoda with flared green roofs. */
  pagoda(w = 8, color = '#b8281e') {
    const wall = C(color), roof = C('#2f7a4a'), trim = C('#f2c037');
    const parts = [paint(new THREE.BoxGeometry(w + 1, 0.6, w + 1).translate(0, 0.3, 0), C('#8a8078'))];
    let y = 0.6, s = w;
    for (let i = 0; i < 3; i++) {
      const h = i ? 2.4 : 3.4;
      parts.push(paint(new THREE.BoxGeometry(s, h, s).translate(0, y + h / 2, 0), wall, 0.05));
      parts.push(paint(new THREE.CylinderGeometry(s * 0.45, s * 0.92, 1, 4).rotateY(Math.PI / 4).translate(0, y + h + 0.5, 0), roof));
      parts.push(paint(new THREE.BoxGeometry(s * 1.15, 0.12, s * 1.15).translate(0, y + h + 0.05, 0), trim));
      y += h + 1;
      s *= 0.72;
    }
    parts.push(paint(new THREE.ConeGeometry(0.25, 2, 6).translate(0, y + 1, 0), trim));
    return merge(parts);
  },
  /** Paifang gate: two red pillars and a stacked green roof across a street. */
  gate(w = 12, h = 7) {
    const red = C('#c8281e'), roof = C('#2f7a4a'), gold = C('#f2c037');
    return merge([
      paint(new THREE.CylinderGeometry(0.45, 0.5, h, 8).translate(-w / 2, h / 2, 0), red),
      paint(new THREE.CylinderGeometry(0.45, 0.5, h, 8).translate(w / 2, h / 2, 0), red),
      paint(new THREE.BoxGeometry(w + 1, 0.8, 1).translate(0, h - 0.6, 0), red),
      paint(new THREE.BoxGeometry(w * 0.4, 1.4, 0.3).translate(0, h - 1.9, 0), gold),
      paint(new THREE.CylinderGeometry(w * 0.4, w * 0.62, 1.2, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.22).translate(0, h + 0.4, 0), roof),
      paint(new THREE.CylinderGeometry(w * 0.25, w * 0.4, 0.9, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.3).translate(0, h + 1.3, 0), roof),
    ]);
  },
  /** Round mahjong table with four stools. */
  mahjong() {
    const parts = [
      paint(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 10).translate(0, 0.75, 0), C('#2f7a4a')),
      paint(new THREE.CylinderGeometry(0.1, 0.25, 0.75, 6).translate(0, 0.37, 0), C('#5a3a22')),
    ];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      parts.push(paint(new THREE.CylinderGeometry(0.22, 0.22, 0.45, 6).translate(Math.sin(a) * 1.1, 0.22, Math.cos(a) * 1.1), C('#8a2a1e')));
      parts.push(paint(new THREE.BoxGeometry(0.5, 0.04, 0.1).translate(Math.sin(a) * 0.55, 0.81, Math.cos(a) * 0.55).rotateY(a), C('#f4f1ea')));
    }
    return merge(parts);
  },
  /** Little pine in a pot (bonsai-ish). */
  bonsai() {
    const parts = [paint(new THREE.CylinderGeometry(0.55, 0.45, 0.5, 8).translate(0, 0.25, 0), C('#4a5a6a')), paint(new THREE.CylinderGeometry(0.08, 0.12, 1.2, 5).rotateZ(0.3).translate(0.15, 1, 0), C('#5a3a22'))];
    for (const [x, y, z, r] of [[0.4, 1.6, 0, 0.55], [-0.2, 1.35, 0.2, 0.45], [0.1, 1.9, -0.2, 0.4]]) parts.push(paint(new THREE.IcosahedronGeometry(r, 0).scale(1, 0.55, 1).translate(x, y, z), C('#2f6a3a')));
    return merge(parts);
  },

  // ── Coney Island ──
  /** Ferris wheel on an A-frame (visual; the base legs collide). */
  ferris(r = 11) {
    const steel = C('#e8e8e8'), cars = ['#e0281e', '#f2c037', '#2c6bb8', '#2f8a3a', '#ff4fd8'];
    const hub = r + 1.5;
    const parts = [];
    for (const z of [-1.4, 1.4]) {
      parts.push(paint(new THREE.TorusGeometry(r, 0.14, 4, 36).translate(0, hub, z), steel, 0));
      for (const s of [-1, 1]) parts.push(paint(new THREE.BoxGeometry(0.4, hub + 0.5, 0.4).translate(0, hub / 2, 0).rotateZ(s * 0.32).translate(0, 0, z), C('#c8c8d0')));
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      parts.push(paint(new THREE.BoxGeometry(0.1, r, 0.1).translate(0, r / 2, 0).rotateZ(a).translate(0, hub, 0), steel, 0));
      parts.push(paint(new THREE.BoxGeometry(1.4, 1.1, 1.6).translate(Math.sin(a) * r, hub - Math.cos(a) * r - 0.9, 0), C(cars[i % 5])));
    }
    parts.push(paint(new THREE.CylinderGeometry(0.6, 0.6, 3.2, 10).rotateX(Math.PI / 2).translate(0, hub, 0), C('#9aa0a8')));
    return merge(parts);
  },
  /** Carousel: striped canopy over poles and horses on a round deck. */
  carousel(r = 5) {
    const parts = [
      paint(new THREE.CylinderGeometry(r, r + 0.2, 0.5, 20).translate(0, 0.25, 0), C('#d8c8a8')),
      paint(new THREE.CylinderGeometry(0.6, 0.6, 5, 10).translate(0, 2.5, 0), C('#f2c037')),
      paint(new THREE.ConeGeometry(r + 0.6, 2.2, 16, 1, true).translate(0, 6, 0), (p) => (Math.floor((Math.atan2(p.x, p.z) + Math.PI) / (Math.PI / 8)) % 2 ? C('#e0281e') : C('#f4f1ea'))),
      paint(new THREE.CylinderGeometry(r + 0.6, r + 0.6, 0.6, 16, 1, true).translate(0, 4.6, 0), C('#e0281e')),
    ];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, x = Math.sin(a) * (r - 1.2), z = Math.cos(a) * (r - 1.2);
      parts.push(paint(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 5).translate(x, 2.5, z), C('#f2c037')));
      parts.push(paint(new THREE.BoxGeometry(0.4, 0.6, 1.2).translate(0, 1.6, 0).rotateY(a + Math.PI / 2).translate(x, 0, z), C(['#f4f1ea', '#5a3a22', '#2a2a2a', '#c8a080'][i % 4])));
    }
    return merge(parts);
  },
  /** One bent of roller-coaster track on posts (place many in a row). */
  coaster(len = 6, h = 5) {
    return merge([
      paint(new THREE.BoxGeometry(0.35, 0.35, len).translate(-0.8, h, 0), C('#e0281e')),
      paint(new THREE.BoxGeometry(0.35, 0.35, len).translate(0.8, h, 0), C('#e0281e')),
      paint(new THREE.BoxGeometry(2, 0.2, 0.3).translate(0, h - 0.2, 0), C('#f4f1ea')),
      paint(new THREE.BoxGeometry(0.3, h, 0.3).translate(0, h / 2, 0), C('#f4f1ea')),
      paint(new THREE.BoxGeometry(0.15, h * 1.1, 0.15).rotateZ(0.35).translate(-0.6, h / 2, 0), C('#f4f1ea')),
    ]);
  },
  /** Beach umbrella and towel. */
  umbrella(color = '#2c6bb8') {
    const c = C(color), w = C('#f4f1ea');
    return merge([
      paint(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 5).rotateZ(0.12).translate(0, 1.15, 0), C('#ddd')),
      paint(new THREE.ConeGeometry(1.4, 0.55, 8, 1, true).translate(0.15, 2.3, 0), (p) => (Math.floor((Math.atan2(p.x, p.z) + Math.PI) / (Math.PI / 4)) % 2 ? c : w)),
      paint(new THREE.BoxGeometry(0.9, 0.03, 1.8).translate(0.9, 0.02, 0.4), C(color === '#2c6bb8' ? '#f2c037' : '#2c6bb8')),
    ]);
  },
  /** Ring toss / milk bottle booth: counter, posts, a striped roof and prizes. */
  booth(color = '#e0281e') {
    const c = C(color), w = C('#f4f1ea');
    const parts = [
      paint(new THREE.BoxGeometry(3, 1, 1.6).translate(0, 0.5, 0), (p) => (Math.floor((p.x + 1.5) * 2) % 2 ? c : w)),
      paint(new THREE.BoxGeometry(3.3, 0.15, 2).translate(0, 2.7, 0), c),
      paint(new THREE.BoxGeometry(3.3, 0.5, 0.1).translate(0, 2.4, 1), C('#f2c037')),
    ];
    for (const x of [-1.5, 1.5]) parts.push(paint(new THREE.BoxGeometry(0.1, 2.6, 0.1).translate(x, 1.3, 0.75), w));
    for (let i = 0; i < 5; i++) parts.push(paint(new THREE.IcosahedronGeometry(0.22, 0).translate(-1.1 + i * 0.55, 1.95, -0.5), C(['#ff8ad0', '#8ad0ff', '#f2c037', '#8aff9a', '#c08aff'][i])));
    return merge(parts);
  },

  /** Ring-shaped altar where a titan is summoned. */
  altar(color = '#8a2be2') {
    const c = C(color);
    const parts = [paint(new THREE.CylinderGeometry(3.2, 3.4, 0.25, 16).translate(0, 0.12, 0), C('#3a3540'))];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      parts.push(paint(new THREE.BoxGeometry(0.4, 1.6, 0.4).translate(Math.cos(a) * 3, 0.8, Math.sin(a) * 3), C('#4a4452')));
      parts.push(paint(new THREE.IcosahedronGeometry(0.28, 0).translate(Math.cos(a) * 3, 1.85, Math.sin(a) * 3), c));
    }
    return merge(parts);
  },
};

registerProp('car', () => PROPS.car('#1d1d22'));
