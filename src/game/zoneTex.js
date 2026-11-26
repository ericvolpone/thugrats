import * as THREE from 'three';
import { mulberry32 } from '../util.js';

/**
 * Painted ground textures for ability zones (cement, slime, gas, fire...).
 * Most are drawn in greys with strong contrast and tinted by the zone's colour
 * (material.color), so a purple gas and a green gas share one texture. Fire is
 * drawn in full colour. Every texture fades out at the rim with a bright edge.
 */
const S = 256;
const cache = {};

function canvas() {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  return [c, c.getContext('2d')];
}

/** Clip to a circle with a soft, slightly irregular rim. */
function rimMask(g, rnd, wobble = 0, rim = 'rgba(255,255,255,0.9)', rimW = 6) {
  const cx = S / 2, R = S / 2 - 6;
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const w = 1 - wobble * (0.5 + 0.5 * Math.sin(a * 5 + rnd() * 0.3) * Math.sin(a * 3 + 1));
    pts.push([cx + Math.cos(a) * R * w, cx + Math.sin(a) * R * w]);
  }
  // rim line
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = rim;
  g.lineWidth = rimW;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  // keep only the inside, with a soft outer fade
  g.globalCompositeOperation = 'destination-in';
  const grad = g.createRadialGradient(cx, cx, R * 0.75, cx, cx, R + 3);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.85, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
  g.globalCompositeOperation = 'source-over';
}

const blob = (g, x, y, r, color) => {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
};

const PAINT = {
  cement(g, rnd) {
    g.fillStyle = '#9a9a9a';
    g.fillRect(0, 0, S, S);
    // trowel swirls
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 5;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.arc(S / 2 + (rnd() - 0.5) * 60, S / 2 + (rnd() - 0.5) * 60, 20 + i * 16, rnd() * 6, rnd() * 6 + 2);
      g.stroke();
    }
    // aggregate speckles
    for (let i = 0; i < 900; i++) {
      const v = rnd() < 0.5 ? 60 + rnd() * 40 : 190 + rnd() * 60;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2.5, 1 + rnd() * 2.5);
    }
    // cracks
    g.strokeStyle = 'rgba(30,30,30,0.7)';
    g.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) {
      let x = S / 2 + (rnd() - 0.5) * 80, y = S / 2 + (rnd() - 0.5) * 80;
      let a = rnd() * 6.28;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { a += (rnd() - 0.5) * 1.2; x += Math.cos(a) * 12; y += Math.sin(a) * 12; g.lineTo(x, y); }
      g.stroke();
    }
    // darker wet ring near the edge
    const gr = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    rimMask(g, rnd, 0.04, 'rgba(70,70,70,1)', 8);
  },
  slime(g, rnd) {
    g.fillStyle = '#b0b0b0';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 14; i++) blob(g, rnd() * S, rnd() * S, 20 + rnd() * 40, 'rgba(60,60,60,0.55)');
    for (let i = 0; i < 10; i++) blob(g, rnd() * S, rnd() * S, 15 + rnd() * 30, 'rgba(255,255,255,0.5)');
    // bubbles with a glint
    for (let i = 0; i < 26; i++) {
      const x = 30 + rnd() * (S - 60), y = 30 + rnd() * (S - 60), r = 3 + rnd() * 9;
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, Math.PI * 2); g.fill();
    }
    rimMask(g, rnd, 0.14, 'rgba(255,255,255,1)', 7);
  },
  gas(g, rnd) {
    g.fillStyle = 'rgba(150,150,150,0.55)';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 40; i++) blob(g, rnd() * S, rnd() * S, 18 + rnd() * 45, rnd() < 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(70,70,70,0.45)');
    // swirl streaks
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 4;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      for (let k = 0; k < 40; k++) {
        const a = i * 1.26 + k * 0.12, r = 10 + k * 2.6;
        const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
        k ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    rimMask(g, rnd, 0.1, 'rgba(255,255,255,0.7)', 5);
  },
  smoke(g, rnd) {
    g.fillStyle = 'rgba(120,120,120,0.7)';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 50; i++) blob(g, rnd() * S, rnd() * S, 20 + rnd() * 50, rnd() < 0.6 ? 'rgba(40,40,40,0.5)' : 'rgba(230,230,230,0.45)');
    rimMask(g, rnd, 0.12, 'rgba(200,200,200,0.6)', 5);
  },
  void(g, rnd) {
    g.fillStyle = '#6a6a6a';
    g.fillRect(0, 0, S, S);
    for (let arm = 0; arm < 4; arm++) {
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = 6;
      g.beginPath();
      for (let k = 0; k < 60; k++) {
        const a = arm * (Math.PI / 2) + k * 0.1, r = 6 + k * 2;
        const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
        k ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.3);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 60; i++) { g.fillStyle = '#fff'; g.fillRect(rnd() * S, rnd() * S, 2, 2); }
    rimMask(g, rnd, 0, 'rgba(255,255,255,1)', 8);
  },
  glass(g, rnd) {
    g.fillStyle = '#7a7a7a';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * S, y = rnd() * S, r = 4 + rnd() * 10, a = rnd() * 6.28;
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.95)' : 'rgba(200,230,255,0.8)';
      g.beginPath();
      g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      g.lineTo(x + Math.cos(a + 2.3) * r * 0.6, y + Math.sin(a + 2.3) * r * 0.6);
      g.lineTo(x + Math.cos(a + 4) * r * 0.8, y + Math.sin(a + 4) * r * 0.8);
      g.closePath();
      g.fill();
    }
    rimMask(g, rnd, 0.05, 'rgba(255,255,255,0.8)', 4);
  },
  ice(g, rnd) {
    PAINT.glass(g, rnd);
  },
  fire(g, rnd) {
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, '#fff2a0');
    gr.addColorStop(0.35, '#ffb02a');
    gr.addColorStop(0.7, '#ff5a1a');
    gr.addColorStop(1, '#5a1206');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 30; i++) blob(g, rnd() * S, rnd() * S, 10 + rnd() * 30, 'rgba(40,8,0,0.55)');
    for (let i = 0; i < 40; i++) blob(g, rnd() * S, rnd() * S, 6 + rnd() * 16, 'rgba(255,240,150,0.7)');
    for (let i = 0; i < 120; i++) { g.fillStyle = rnd() < 0.5 ? '#ffe680' : '#ff8a2a'; g.fillRect(rnd() * S, rnd() * S, 2, 2); }
    rimMask(g, rnd, 0.16, 'rgba(255,120,30,0.9)', 6);
  },
};

/** Texture for a zone kind (null if the kind has no painted look). */
export function zoneTexture(kind) {
  if (!PAINT[kind]) return null;
  if (!cache[kind]) {
    const [c, g] = canvas();
    PAINT[kind](g, mulberry32(kind.length * 7919 + kind.charCodeAt(0)));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    cache[kind] = tex;
  }
  return cache[kind];
}

/** Per-kind motion: spin speed (rad/s), splat-in, ambient particle colour. */
export const ZONE_LOOK = {
  fire: { spin: 0.2, splat: false },
  cement: { spin: 0, splat: true },
  slime: { spin: 0.15, splat: true, bubble: true },
  gas: { spin: 0.6, splat: false, puff: true },
  smoke: { spin: 0.35, splat: false, puff: true },
  void: { spin: -2.2, splat: false, inward: true },
  glass: { spin: 0, splat: true },
  ice: { spin: 0, splat: true },
};
