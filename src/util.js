import * as THREE from 'three';

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const TAU = Math.PI * 2;

export function dampAngle(a, b, k, dt) {
  const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + diff * (1 - Math.exp(-k * dt));
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Weighted pick: items is [{w, ...}] or a weight function. */
export function weighted(items, w = (x) => x.w) {
  let total = 0;
  for (const it of items) total += Math.max(0, w(it));
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, w(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Converts a geometry to flat, per-face vertex colors — the low-poly look.
 * colorAt(centroid) returns a THREE.Color (or anything with r/g/b) per triangle.
 */
const _p = new THREE.Vector3();
export function paint(geo, colorAt, jitter = 0.1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const fn = typeof colorAt === 'function' ? colorAt : () => colorAt;
  for (let i = 0; i < pos.count; i += 3) {
    _p.set(
      (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3,
      (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3,
      (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3,
    );
    const c = fn(_p);
    const j = 1 - jitter / 2 + hash(i * 0.37 + _p.x * 13.1 + _p.y * 5.3 + _p.z * 7.7) * jitter;
    for (let k = 0; k < 3; k++) {
      col[(i + k) * 3] = c.r * j;
      col[(i + k) * 3 + 1] = c.g * j;
      col[(i + k) * 3 + 2] = c.b * j;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // drop uvs so geometries can always be merged together
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

export const C = (hex) => new THREE.Color(hex);

export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
}

export function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n));
}

export const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
