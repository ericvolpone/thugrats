import * as THREE from 'three';
import { paint, C } from '../util.js';
import { MATS } from './models.js';

/**
 * Procedural low-poly toddler. Every hero is a baby, so heroes share this
 * builder and differ by palette, hat, mouth piece, outfit and held prop.
 *
 * Rig node names (also the contract for Blender replacements):
 *   hips > torso > head > hat
 *   torso > armL, armR (> prop > muzzle)
 *   hips > legL, legR
 * Origin at the feet, facing +Z, ~1.15 units tall.
 */
export function buildBaby(o = {}) {
  const P = {
    skin: C(o.skin ?? '#f2c3a0'),
    cheek: C(o.cheek ?? '#f08f8a'),
    diaper: C(o.diaper ?? '#f4f1ea'),
    shirt: o.shirt ? C(o.shirt) : null,
    hat: C(o.hatColor ?? '#2b2b33'),
    band: C(o.band ?? '#121216'),
    dark: C('#1a1416'),
    metal: C('#3c3f47'),
    gold: C('#f2c037'),
    brown: C('#6b3f22'),
  };
  const nodes = {};
  const mat = MATS.flat;
  const mesh = (parent, geo, col) => {
    const m = new THREE.Mesh(paint(geo, col), mat);
    parent.add(m);
    return m;
  };
  const group = (parent, name, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    nodes[name] = g;
    return g;
  };

  const root = new THREE.Group();
  root.name = 'root';
  const rig = group(root, 'rig');
  rig.scale.setScalar(o.scale ?? 1);

  // ── hips + diaper ──
  const hips = group(rig, 'hips', 0, 0.34, 0);
  mesh(hips, new THREE.IcosahedronGeometry(0.26, 1).scale(1.12, 0.78, 1.0), P.diaper);
  // safety pin
  mesh(hips, new THREE.BoxGeometry(0.1, 0.03, 0.02).translate(0, 0.06, 0.26), P.gold);

  // ── torso (belly) ──
  const torso = group(hips, 'torso', 0, 0.15, 0);
  const torsoCol = P.shirt ?? P.skin;
  mesh(torso, new THREE.IcosahedronGeometry(0.25, 1).scale(1.0, 1.05, 0.92).translate(0, 0.1, 0), (p) => (p.y < -0.02 && !P.shirt ? P.skin : torsoCol));
  if (o.chain) mesh(torso, new THREE.TorusGeometry(0.15, 0.022, 4, 10).rotateX(1.25).translate(0, 0.27, 0.07), P.gold);
  if (o.vest) mesh(torso, new THREE.IcosahedronGeometry(0.26, 1).scale(1.03, 0.9, 0.95).translate(0, 0.08, -0.01), C(o.vest));

  // ── head ──
  const head = group(torso, 'head', 0, 0.52, 0.02);
  mesh(head, new THREE.IcosahedronGeometry(0.33, 2).scale(1.0, 0.95, 0.95), P.skin);
  for (const s of [-1, 1]) {
    mesh(head, new THREE.IcosahedronGeometry(0.075, 1).translate(s * 0.33, 0, 0), P.skin); // ears
    mesh(head, new THREE.IcosahedronGeometry(0.06, 0).scale(1, 0.6, 0.4).translate(s * 0.17, -0.1, 0.27), P.cheek);
    // squinty tough-guy eyes + angry brows
    mesh(head, new THREE.SphereGeometry(0.04, 6, 4).scale(1.2, 0.55, 0.5).translate(s * 0.12, 0.03, 0.29), P.dark);
    const brow = new THREE.BoxGeometry(0.13, 0.03, 0.04).rotateZ(s * -0.35).translate(s * 0.12, 0.1, 0.29);
    mesh(head, brow, o.browColor ? C(o.browColor) : C('#5a3b28'));
  }
  mesh(head, new THREE.IcosahedronGeometry(0.045, 0).translate(0, -0.03, 0.32), P.skin); // nose
  // smirk
  mesh(head, new THREE.BoxGeometry(0.12, 0.018, 0.02).rotateZ(-0.15).translate(0.02, -0.14, 0.29), C('#7a3a35'));

  // mouth piece
  if (o.mouth === 'cigar') {
    const cig = new THREE.Group();
    cig.position.set(0.1, -0.135, 0.3);
    cig.rotation.set(0.15, 0.5, 0);
    head.add(cig);
    mesh(cig, new THREE.CylinderGeometry(0.025, 0.028, 0.26, 6).rotateX(Math.PI / 2).translate(0, 0, 0.11), P.brown);
    mesh(cig, new THREE.CylinderGeometry(0.029, 0.029, 0.03, 6).rotateX(Math.PI / 2).translate(0, 0, 0.06), P.gold);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff6a1a' }));
    tip.position.z = 0.25;
    tip.name = 'cigarTip';
    cig.add(tip);
    nodes.cigarTip = tip;
  } else if (o.mouth === 'pacifier') {
    mesh(head, new THREE.CylinderGeometry(0.08, 0.08, 0.02, 8).rotateX(Math.PI / 2).translate(0, -0.13, 0.32), C(o.pacifier ?? '#58c4ff'));
    mesh(head, new THREE.TorusGeometry(0.04, 0.012, 4, 8).translate(0, -0.13, 0.35), C(o.pacifier ?? '#58c4ff'));
  }

  // hat
  const hat = group(head, 'hat', 0, 0.24, -0.01);
  hat.rotation.z = o.hatTilt ?? 0.12;
  if (o.hat === 'fedora') {
    mesh(hat, new THREE.CylinderGeometry(0.46, 0.46, 0.035, 14).scale(1, 1, 0.92), P.hat);
    mesh(hat, new THREE.CylinderGeometry(0.25, 0.3, 0.26, 10).translate(0, 0.14, 0), (p) => (p.y > 0.25 ? P.hat.clone().multiplyScalar(0.85) : P.hat));
    mesh(hat, new THREE.CylinderGeometry(0.305, 0.305, 0.07, 10).translate(0, 0.05, 0), P.band);
    mesh(hat, new THREE.BoxGeometry(0.02, 0.06, 0.18).translate(0, 0.27, 0), P.hat.clone().multiplyScalar(0.7)); // crease
  } else if (o.hat === 'beanie') {
    mesh(hat, new THREE.IcosahedronGeometry(0.33, 1).scale(1.02, 0.6, 1.02).translate(0, 0.0, 0), P.hat);
    mesh(hat, new THREE.CylinderGeometry(0.34, 0.34, 0.08, 10).translate(0, -0.08, 0), P.band);
  } else if (o.hat === 'cap') {
    mesh(hat, new THREE.IcosahedronGeometry(0.33, 1).scale(1.03, 0.55, 1.03), P.hat);
    mesh(hat, new THREE.CylinderGeometry(0.24, 0.24, 0.03, 10).scale(1, 1, 0.7).translate(0, -0.08, 0.3), P.band);
  }

  // ── arms ──
  for (const s of [-1, 1]) {
    const name = s < 0 ? 'armL' : 'armR';
    const arm = group(torso, name, s * 0.27, 0.22, 0);
    arm.rotation.z = s * 0.25;
    mesh(arm, new THREE.CapsuleGeometry(0.075, 0.18, 3, 6).translate(0, -0.13, 0), P.shirt ?? P.skin);
    mesh(arm, new THREE.IcosahedronGeometry(0.075, 1).translate(0, -0.29, 0), P.skin);
  }
  // held prop (right hand). Points along -Y in arm space = forward when the arm is raised.
  const prop = group(nodes.armR, 'prop', 0, -0.3, 0.02);
  if (o.prop === 'pistol') {
    mesh(prop, new THREE.BoxGeometry(0.06, 0.24, 0.1).translate(0, -0.08, 0.02), P.metal);
    mesh(prop, new THREE.BoxGeometry(0.05, 0.05, 0.12).translate(0, 0.02, -0.04), P.brown); // grip
    mesh(prop, new THREE.CylinderGeometry(0.022, 0.022, 0.06, 6).translate(0, -0.22, 0.04), C('#1c1d22'));
    group(prop, 'muzzle', 0, -0.26, 0.04);
  } else if (o.prop === 'bat') {
    mesh(prop, new THREE.CylinderGeometry(0.05, 0.025, 0.55, 6).translate(0, -0.2, 0.02), C('#c48a4c'));
    group(prop, 'muzzle', 0, -0.45, 0.02);
  } else {
    group(prop, 'muzzle', 0, -0.05, 0);
  }

  // ── legs ──
  for (const s of [-1, 1]) {
    const leg = group(hips, s < 0 ? 'legL' : 'legR', s * 0.13, -0.08, 0);
    mesh(leg, new THREE.CapsuleGeometry(0.085, 0.1, 3, 6).translate(0, -0.1, 0), P.skin);
    mesh(leg, new THREE.IcosahedronGeometry(0.09, 1).scale(1, 0.6, 1.4).translate(0, -0.22, 0.04), o.shoes ? C(o.shoes) : P.skin);
  }

  return { root, nodes };
}
