import * as THREE from 'three';
import { paint, C } from '../util.js';
import { registerMob, merge } from './models.js';

/**
 * Procedural mob models. Each returns ONE merged vertex-coloured geometry
 * (origin at feet, facing +Z) so hundreds can be drawn with instancing.
 * Grown-ups are the enemy: cops, nannies, crossing guards... all much taller
 * than our babies.
 */
const M = new THREE.Matrix4();
const at = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));

function adult(o) {
  const skin = C(o.skin ?? '#e8b48f');
  const shirt = C(o.shirt ?? '#3355aa');
  const pants = C(o.pants ?? '#22263a');
  const shoes = C(o.shoes ?? '#151515');
  const hatC = C(o.hatColor ?? '#1b2340');
  const dark = C('#141414');
  const h = o.height ?? 1;
  const g = o.girth ?? 1;
  const parts = [];
  const add = (geo, col, m) => parts.push([paint(geo, col), m ?? M.identity()]);

  // legs
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.2 * g, 0.75, 0.22).translate(s * 0.13 * g, 0.42, 0), (p) => (p.y < 0.1 ? shoes : pants));
    add(new THREE.BoxGeometry(0.22 * g, 0.1, 0.32).translate(s * 0.13 * g, 0.05, 0.05), shoes);
  }
  // torso
  if (o.dress) {
    add(new THREE.CylinderGeometry(0.24 * g, 0.42 * g, 0.75, 8).translate(0, 0.62, 0), C(o.dress));
  }
  add(new THREE.BoxGeometry(0.5 * g, 0.6, 0.32 * g).translate(0, 1.1, 0), shirt);
  if (o.belly) add(new THREE.IcosahedronGeometry(0.3, 1).scale(1.1 * g, 1, 1.05 * g).translate(0, 0.98, 0.1 * g), shirt);
  if (o.belt !== false) add(new THREE.BoxGeometry(0.52 * g, 0.07, 0.34 * g).translate(0, 0.82, 0), C(o.belt ?? '#1a1a1a'));
  if (o.vest) add(new THREE.BoxGeometry(0.54 * g, 0.5, 0.36 * g).translate(0, 1.13, 0), C(o.vest));
  if (o.badge) add(new THREE.BoxGeometry(0.08, 0.1, 0.03).translate(-0.12 * g, 1.22, 0.18 * g), C('#f2c94c'));
  if (o.tie) add(new THREE.BoxGeometry(0.07, 0.36, 0.02).translate(0, 1.15, 0.17 * g), C(o.tie));
  if (o.apron) add(new THREE.BoxGeometry(0.46 * g, 0.75, 0.03).translate(0, 0.85, 0.2 * g + (o.belly ? 0.1 : 0)), C(o.apron));
  // arms
  for (const s of [-1, 1]) {
    add(new THREE.CapsuleGeometry(0.08, 0.5, 2, 6).translate(s * 0.33 * g, 1.07, 0), (p) => (p.y < 0.85 ? skin : shirt));
  }
  // head
  add(new THREE.CylinderGeometry(0.08, 0.09, 0.1, 6).translate(0, 1.45, 0), skin);
  add(new THREE.IcosahedronGeometry(0.2, 1).scale(1, 1.1, 1).translate(0, 1.62, 0), skin);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.04, 0.02).translate(s * 0.07, 1.66, 0.19), dark);
  if (o.mustache) add(new THREE.BoxGeometry(0.14, 0.035, 0.03).translate(0, 1.56, 0.2), C(o.hair ?? '#3a2a1a'));
  if (o.glasses) add(new THREE.BoxGeometry(0.24, 0.05, 0.03).translate(0, 1.66, 0.2), C(o.glasses));
  if (o.hair) add(new THREE.IcosahedronGeometry(0.21, 1).scale(1.03, 0.75, 1.03).translate(0, 1.72, -0.03), C(o.hair));

  // hats
  switch (o.hat) {
    case 'cop':
      add(new THREE.CylinderGeometry(0.23, 0.21, 0.13, 10).translate(0, 1.82, 0), hatC);
      add(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 10).scale(1, 1, 0.6).translate(0, 1.76, 0.15), dark);
      add(new THREE.BoxGeometry(0.06, 0.06, 0.02).translate(0, 1.83, 0.22), C('#f2c94c'));
      break;
    case 'cap':
      add(new THREE.IcosahedronGeometry(0.21, 1).scale(1.04, 0.6, 1.04).translate(0, 1.76, 0), hatC);
      add(new THREE.CylinderGeometry(0.15, 0.15, 0.025, 8).scale(1, 1, 0.8).translate(0, 1.75, 0.2), hatC);
      break;
    case 'hardhat':
      add(new THREE.IcosahedronGeometry(0.23, 1).scale(1.05, 0.7, 1.05).translate(0, 1.77, 0), hatC);
      add(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 10).translate(0, 1.72, 0.02), hatC);
      break;
    case 'bun':
      add(new THREE.IcosahedronGeometry(0.11, 1).translate(0, 1.84, -0.12), C(o.hair ?? '#6a4a2a'));
      break;
    case 'beanie':
      add(new THREE.IcosahedronGeometry(0.22, 1).scale(1.03, 0.75, 1.03).translate(0, 1.76, 0), hatC);
      break;
    case 'fedora':
      add(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 12).translate(0, 1.76, 0), hatC);
      add(new THREE.CylinderGeometry(0.17, 0.2, 0.17, 10).translate(0, 1.85, 0), hatC);
      break;
    case 'chef':
      add(new THREE.CylinderGeometry(0.2, 0.18, 0.3, 8).translate(0, 1.9, 0), C('#fafafa'));
      break;
    case 'pompadour':
      add(new THREE.IcosahedronGeometry(0.2, 1).scale(1.1, 0.8, 1.5).translate(0, 1.8, 0.06), C('#111'));
      break;
    case 'captain':
      add(new THREE.CylinderGeometry(0.24, 0.22, 0.12, 10).translate(0, 1.82, 0), C('#f4f4f4'));
      add(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 10).scale(1, 1, 0.6).translate(0, 1.76, 0.15), dark);
      break;
    default: break;
  }

  // held props (right hand ~ (0.33g, 0.75, 0))
  const hx = 0.33 * g;
  switch (o.prop) {
    case 'baton': add(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6).rotateX(1.2).translate(hx, 0.8, 0.2), dark); break;
    case 'stopsign':
      add(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 5).translate(hx + 0.05, 1.0, 0.1), C('#bbbbbb'));
      add(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 8).rotateX(Math.PI / 2).translate(hx + 0.05, 1.7, 0.1), C('#d6262a'));
      break;
    case 'bottle': add(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 6).translate(hx, 0.7, 0.08), C('#e8f4ff')); break;
    case 'shield': add(new THREE.BoxGeometry(0.55, 0.95, 0.06).translate(0, 1.0, 0.35), C('#8fb0c8')); break;
    case 'clipboard': add(new THREE.BoxGeometry(0.22, 0.3, 0.03).rotateX(-0.6).translate(hx - 0.05, 0.95, 0.2), C('#a77b4b')); break;
    case 'hook': add(new THREE.TorusGeometry(0.08, 0.02, 4, 8, Math.PI * 1.4).translate(hx, 0.7, 0.05), C('#cfcfcf')); break;
    case 'wrench': add(new THREE.BoxGeometry(0.06, 0.5, 0.06).rotateX(0.6).translate(hx, 0.85, 0.15), C('#9aa0a8')); break;
    case 'cards': add(new THREE.BoxGeometry(0.2, 0.03, 0.28).translate(hx, 0.8, 0.12), C('#fafafa')); break;
    case 'radio': add(new THREE.BoxGeometry(0.08, 0.18, 0.06).translate(hx, 0.75, 0.08), dark); break;
    case 'ladle': add(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 5).rotateX(0.8).translate(hx, 0.95, 0.2), C('#b9bec6'));
      add(new THREE.IcosahedronGeometry(0.1, 0).translate(hx, 1.15, 0.42), C('#b9bec6')); break;
    case 'gavel': add(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 5).rotateX(1).translate(hx, 0.85, 0.2), C('#5a3a1f'));
      add(new THREE.CylinderGeometry(0.08, 0.08, 0.24, 8).rotateZ(Math.PI / 2).translate(hx, 0.95, 0.38), C('#5a3a1f')); break;
    case 'mic': add(new THREE.CylinderGeometry(0.03, 0.02, 0.25, 6).rotateX(0.5).translate(hx, 0.85, 0.15), dark);
      add(new THREE.IcosahedronGeometry(0.06, 0).translate(hx, 0.95, 0.22), C('#999')); break;
    default: break;
  }
  if (o.cape) add(new THREE.BoxGeometry(0.6 * g, 1.1, 0.04).translate(0, 0.95, -0.22 * g), C(o.cape));
  if (o.collar) add(new THREE.BoxGeometry(0.62 * g, 0.18, 0.36 * g).translate(0, 1.38, -0.02), C(o.collar));
  return merge(parts).scale(h, h, h);
}

function quadruped(o) {
  const fur = C(o.fur), belly = C(o.belly ?? o.fur), dark = C('#111');
  const s = o.size ?? 1;
  const parts = [];
  const add = (geo, col) => parts.push(paint(geo, col));
  add(new THREE.IcosahedronGeometry(0.3, 1).scale(0.8, 0.7, 1.4).translate(0, 0.35, 0), (p) => (p.y < 0.25 ? belly : fur));
  add(new THREE.IcosahedronGeometry(0.2, 1).scale(0.9, 0.85, 1.1).translate(0, 0.48, 0.42), fur);
  add(new THREE.ConeGeometry(0.1, 0.22, 5).rotateX(Math.PI / 2).translate(0, 0.44, 0.62), fur);
  add(new THREE.IcosahedronGeometry(0.035, 0).translate(0, 0.45, 0.74), dark);
  for (const x of [-1, 1]) {
    add(new THREE.IcosahedronGeometry(0.03, 0).translate(x * 0.08, 0.54, 0.56), dark);
    add(new THREE.ConeGeometry(0.07, o.ears ?? 0.14, 4).translate(x * 0.1, 0.66, 0.38), C(o.ear ?? o.fur));
    for (const z of [-0.25, 0.22]) add(new THREE.BoxGeometry(0.08, 0.22, 0.08).translate(x * 0.13, 0.11, z), fur);
  }
  if (o.tail === 'long') add(new THREE.CylinderGeometry(0.02, 0.035, 0.6, 4).rotateX(1.3).translate(0, 0.3, -0.62), C(o.tailColor ?? '#d99a9a'));
  else add(new THREE.CylinderGeometry(0.03, 0.05, 0.3, 5).rotateX(-0.8).translate(0, 0.5, -0.45), fur);
  if (o.vest) add(new THREE.IcosahedronGeometry(0.31, 1).scale(0.82, 0.55, 0.8).translate(0, 0.42, 0.05), C(o.vest));
  return merge(parts).scale(s, s, s);
}

function bird(o) {
  const body = C(o.body), wing = C(o.wing ?? o.body), beak = C(o.beak ?? '#f2b134');
  const s = o.size ?? 1;
  const parts = [];
  const add = (geo, col) => parts.push(paint(geo, col));
  add(new THREE.IcosahedronGeometry(0.22, 1).scale(0.8, 0.8, 1.3).translate(0, 0.5, 0), body);
  add(new THREE.IcosahedronGeometry(0.14, 1).translate(0, 0.66, 0.22), body);
  add(new THREE.ConeGeometry(0.05, 0.16, 4).rotateX(Math.PI / 2).translate(0, 0.64, 0.4), beak);
  for (const x of [-1, 1]) {
    add(new THREE.BoxGeometry(0.4, 0.04, 0.24).rotateZ(x * 0.35).translate(x * 0.3, 0.6, -0.02), wing);
    add(new THREE.IcosahedronGeometry(0.025, 0).translate(x * 0.07, 0.7, 0.33), C('#111'));
    add(new THREE.BoxGeometry(0.03, 0.3, 0.03).translate(x * 0.07, 0.15, 0), beak);
  }
  add(new THREE.BoxGeometry(0.18, 0.03, 0.2).translate(0, 0.5, -0.32), wing);
  return merge(parts).scale(s, s, s);
}

// ── Little Italy ─────────────────────────────────────────────
registerMob('rat', () => quadruped({ fur: '#6d6a70', belly: '#9c97a0', ear: '#d99a9a', tail: 'long', size: 0.9, ears: 0.1 }));
registerMob('mallcop', () => adult({ shirt: '#d9d4c3', pants: '#2b2f45', hat: 'cap', hatColor: '#23284a', badge: true, belly: true, prop: 'radio', mustache: true }));
registerMob('crossing_guard', () => adult({ shirt: '#ff8a1e', vest: '#e6f23a', pants: '#3a3a3a', hat: 'cap', hatColor: '#f2f2f2', prop: 'stopsign', girth: 1.1 }));
registerMob('nanny', () => adult({ shirt: '#5a4a8a', dress: '#3c2f63', hat: 'bun', hair: '#6a4a2a', prop: 'bottle', apron: '#f2f2f2', belt: false }));
registerMob('k9', () => quadruped({ fur: '#6b4a2b', belly: '#c99a62', vest: '#1f2a55', size: 1.1, ears: 0.2 }));
registerMob('riot_cop', () => adult({ shirt: '#1f2433', pants: '#141822', hat: 'hardhat', hatColor: '#11151e', prop: 'shield', girth: 1.15 }));
registerMob('officer_donut', () => adult({ shirt: '#2c3e85', pants: '#1a2048', hat: 'cop', badge: true, belly: true, girth: 1.4, prop: 'baton', mustache: true, tie: '#111' }));
registerMob('lunch_lady', () => adult({ shirt: '#c8e0c0', dress: '#9cbf94', hat: 'chef', apron: '#ffffff', belly: true, girth: 1.5, prop: 'ladle', glasses: '#c33' }));
registerMob('detective', () => adult({ shirt: '#a4865a', pants: '#5c4a32', hat: 'fedora', hatColor: '#5c4a32', collar: '#8a6d45', prop: 'clipboard', tie: '#7a1f1f' }));
registerMob('commissioner', () => adult({ shirt: '#151a2e', pants: '#0f1222', hat: 'cop', hatColor: '#0f1222', badge: true, cape: '#6a0d0d', girth: 1.25, mustache: true, hair: '#cfcfcf', tie: '#c9a227', prop: 'gavel' }));

// ── The Docks ────────────────────────────────────────────────
registerMob('seagull', () => bird({ body: '#f2f2f2', wing: '#9aa3ad', size: 1.1 }));
registerMob('dockworker', () => adult({ shirt: '#3d6e8f', pants: '#2b3a4a', hat: 'beanie', hatColor: '#a33', prop: 'wrench', girth: 1.3, belly: true, mustache: true }));
registerMob('harbor_cop', () => adult({ shirt: '#e2e8ee', pants: '#1d2c44', hat: 'captain', badge: true, prop: 'baton' }));
registerMob('customs_agent', () => adult({ shirt: '#f4f4f4', pants: '#26303d', vest: '#2c3e50', hat: 'cap', hatColor: '#2c3e50', prop: 'clipboard', glasses: '#111' }));
registerMob('harbor_master', () => adult({ shirt: '#1c2f52', pants: '#1c2f52', hat: 'captain', belly: true, girth: 1.35, prop: 'hook', mustache: true, hair: '#ddd', tie: '#c9a227' }));
registerMob('big_tuna', () => adult({ shirt: '#cde3ea', pants: '#3a4b5a', apron: '#e8a34b', hat: 'beanie', hatColor: '#2a4c7a', girth: 1.6, belly: true, prop: 'hook', mustache: true }));
registerMob('customs_chief', () => adult({ shirt: '#f4f4f4', pants: '#1d2633', vest: '#14202c', hat: 'cop', hatColor: '#14202c', badge: true, prop: 'radio', glasses: '#111', girth: 1.2 }));
registerMob('admiral', () => adult({ shirt: '#f4f4f4', pants: '#f4f4f4', hat: 'captain', cape: '#14306a', badge: true, girth: 1.3, mustache: true, hair: '#eee', tie: '#14306a', prop: 'baton' }));

// ── Casino Row ───────────────────────────────────────────────
registerMob('pigeon', () => bird({ body: '#7e8794', wing: '#5c6470', beak: '#444', size: 0.9 }));
registerMob('bouncer', () => adult({ shirt: '#111', pants: '#111', hat: 'none', glasses: '#000', girth: 1.4, prop: 'none', skin: '#a86f4c' }));
registerMob('dealer', () => adult({ shirt: '#f4f4f4', vest: '#7a1020', pants: '#111', tie: '#111', hat: 'none', hair: '#2a1a0a', prop: 'cards' }));
registerMob('security', () => adult({ shirt: '#4a5a6a', pants: '#222', hat: 'cap', hatColor: '#222', badge: true, prop: 'radio', belly: true }));
registerMob('pit_boss', () => adult({ shirt: '#2a2a2a', pants: '#2a2a2a', tie: '#c9a227', hat: 'fedora', hatColor: '#111', belly: true, girth: 1.3, prop: 'radio' }));
registerMob('floor_manager', () => adult({ shirt: '#5a1060', pants: '#1a1a1a', tie: '#f2c94c', hat: 'none', hair: '#111', girth: 1.3, prop: 'clipboard', glasses: '#f2c94c' }));
registerMob('the_king', () => adult({ shirt: '#f4f4f4', pants: '#f4f4f4', hat: 'pompadour', cape: '#c9a227', collar: '#f2c94c', belt: '#f2c94c', glasses: '#c9a227', prop: 'mic', girth: 1.2 }));
registerMob('big_lou', () => adult({ shirt: '#3a0d0d', pants: '#1a1a1a', tie: '#f2c94c', hat: 'fedora', hatColor: '#f4f4f4', belly: true, girth: 1.7, mustache: true, prop: 'cards' }));
registerMob('dealer_supreme', () => adult({ shirt: '#f4f4f4', vest: '#0d3a1a', pants: '#111', tie: '#c9a227', hair: '#ddd', collar: '#0d3a1a', prop: 'cards', girth: 1.2 }));

// ── Pets ─────────────────────────────────────────────────────
// Chinatown
registerMob('alley_cat', () => quadruped({ fur: '#d88a3a', belly: '#f2d2a8', ear: '#e8a0a0', tail: 'long', size: 0.75, ears: 0.14 }));
registerMob('tourist', () => adult({ shirt: '#ff7ab8', pants: '#e8d8b0', hat: 'cap', hatColor: '#f2f2f2', prop: 'radio', belly: true, glasses: '#111' }));
registerMob('health_inspector', () => adult({ shirt: '#f4f4f4', pants: '#4a5a4a', vest: '#6a8a6a', hat: 'none', hair: '#3a2a1a', prop: 'clipboard', glasses: '#2a2a2a', tie: '#2f6a3a' }));
registerMob('line_cook', () => adult({ shirt: '#f4f4f4', pants: '#2a2a2a', apron: '#e8e8e8', hat: 'chef', prop: 'wrench', girth: 1.3, belly: true, mustache: true }));
registerMob('maitre_d', () => adult({ shirt: '#111', pants: '#111', vest: '#7a1020', tie: '#f2c94c', hat: 'none', hair: '#111', prop: 'cards', girth: 1.25, mustache: true }));
registerMob('food_critic', () => adult({ shirt: '#4a2a5a', pants: '#2a1a30', collar: '#f2f2f2', hat: 'fedora', hatColor: '#2a1a30', prop: 'clipboard', glasses: '#c9a227', girth: 1.4, belly: true }));
registerMob('landlord', () => adult({ shirt: '#5a4a2a', pants: '#3a2a1a', tie: '#c9a227', hat: 'fedora', hatColor: '#3a2a1a', prop: 'gavel', girth: 1.5, belly: true, mustache: true, hair: '#bbb' }));
registerMob('parade_dragon', () => adult({ shirt: '#d8201e', pants: '#d8201e', cape: '#f2c037', collar: '#f2c037', belt: '#f2c037', hat: 'chef', hatColor: '#f2c037', girth: 1.7, belly: true, prop: 'none', skin: '#e03a2a', glasses: '#f2c037' }));
// Coney Island
registerMob('lifeguard', () => adult({ shirt: '#e0281e', pants: '#e0281e', hat: 'cap', hatColor: '#f2f2f2', prop: 'radio', skin: '#d89a6a', glasses: '#111' }));
registerMob('clown', () => adult({ shirt: '#f2c037', pants: '#2c6bb8', collar: '#ff4fd8', hat: 'pompadour', hair: '#ff4f4f', prop: 'bottle', belly: true, girth: 1.15 }));
registerMob('mascot', () => adult({ shirt: '#c8682a', pants: '#c8682a', apron: '#f2d020', hat: 'none', girth: 1.6, belly: true, prop: 'none', skin: '#e8b48f' }));
registerMob('beach_cop', () => adult({ shirt: '#e2e8ee', pants: '#2b3a5a', hat: 'cap', hatColor: '#2b3a5a', badge: true, prop: 'baton', glasses: '#111' }));
registerMob('ringmaster', () => adult({ shirt: '#c8281e', pants: '#f4f4f4', collar: '#f2c94c', hat: 'fedora', hatColor: '#111', tie: '#f2c94c', prop: 'mic', girth: 1.3, mustache: true }));
registerMob('strongman', () => adult({ shirt: '#f4f4f4', pants: '#111', belt: '#c8281e', hat: 'none', hair: '#111', girth: 1.8, mustache: true, prop: 'wrench' }));
registerMob('fortune_teller', () => adult({ shirt: '#5a2a8a', dress: '#3a1a6a', hat: 'bun', hair: '#2a1a0a', prop: 'cards', apron: '#c9a227', glasses: '#c9a227', belt: false }));
registerMob('captain_coney', () => adult({ shirt: '#2c6bb8', pants: '#f4f4f4', hat: 'captain', cape: '#e0281e', collar: '#f2c94c', badge: true, girth: 1.6, belly: true, mustache: true, hair: '#eee', prop: 'mic' }));

registerMob('pet_bulldog', () => {
  const g = quadruped({ fur: '#c9a27a', belly: '#f1e3cf', ear: '#8a6a4a', size: 0.85, ears: 0.1 });
  const collar = paint(new THREE.TorusGeometry(0.17, 0.035, 4, 10).rotateY(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0.48 * 0.85, 0.3 * 0.85), C('#d6262a'));
  const tag = paint(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 6).rotateX(Math.PI / 2).translate(0, 0.33 * 0.85, 0.42 * 0.85), C('#f2c037'));
  return merge([g, collar, tag]);
});

export { adult, quadruped, bird, at };
