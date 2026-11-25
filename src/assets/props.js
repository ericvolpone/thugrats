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
