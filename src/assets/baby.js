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
  // waistband, side tabs, leg-hole trim and a safety pin
  mesh(hips, new THREE.CylinderGeometry(0.285, 0.29, 0.05, 14).scale(1.02, 1, 0.92).translate(0, 0.13, 0), P.diaper.clone().multiplyScalar(0.88));
  for (const s of [-1, 1]) {
    mesh(hips, new THREE.BoxGeometry(0.08, 0.07, 0.03).translate(s * 0.2, 0.08, 0.2).rotateY(s * -0.4), C(o.tabs ?? '#9ad8ff'));
    mesh(hips, new THREE.TorusGeometry(0.1, 0.018, 4, 10).rotateX(Math.PI / 2).translate(s * 0.13, -0.13, 0), P.diaper.clone().multiplyScalar(0.85));
  }
  mesh(hips, new THREE.BoxGeometry(0.12, 0.025, 0.02).translate(0, 0.06, 0.26), P.gold);
  mesh(hips, new THREE.TorusGeometry(0.02, 0.006, 3, 6).translate(0.065, 0.06, 0.265), P.gold);

  // ── torso (belly) ──
  const torso = group(hips, 'torso', 0, 0.15, 0);
  const torsoCol = P.shirt ?? P.skin;
  mesh(torso, new THREE.IcosahedronGeometry(0.25, 1).scale(1.0, 1.05, 0.92).translate(0, 0.1, 0), (p) => (p.y < -0.02 && !P.shirt ? P.skin : torsoCol));
  if (!P.shirt) mesh(torso, new THREE.IcosahedronGeometry(0.018, 0).translate(0, -0.02, 0.235), P.cheek.clone().multiplyScalar(0.8)); // belly button
  if (P.shirt) {
    // collar + buttons
    mesh(torso, new THREE.TorusGeometry(0.13, 0.03, 4, 12).rotateX(Math.PI / 2 - 0.25).translate(0, 0.3, 0.02), o.collar ? C(o.collar) : P.shirt.clone().multiplyScalar(1.15));
    for (let i = 0; i < 3; i++) mesh(torso, new THREE.IcosahedronGeometry(0.018, 0).translate(0, 0.2 - i * 0.09, 0.235 - Math.abs(i - 1) * 0.01), C(o.buttons ?? '#d8d0c0'));
  }
  if (o.tie) {
    mesh(torso, new THREE.BoxGeometry(0.06, 0.05, 0.03).translate(0, 0.27, 0.2), C(o.tie));
    mesh(torso, new THREE.BoxGeometry(0.07, 0.2, 0.02).translate(0, 0.14, 0.235).rotateX(-0.05), C(o.tie));
  }
  if (o.suspenders) for (const s of [-1, 1]) mesh(torso, new THREE.BoxGeometry(0.035, 0.42, 0.02).translate(s * 0.1, 0.06, 0.225).rotateZ(s * 0.08), C(o.suspenders));
  if (o.chain) mesh(torso, new THREE.TorusGeometry(0.15, 0.022, 4, 10).rotateX(1.25).translate(0, 0.27, 0.07), P.gold);
  if (o.vest) {
    mesh(torso, new THREE.IcosahedronGeometry(0.26, 1).scale(1.03, 0.9, 0.95).translate(0, 0.08, -0.01), C(o.vest));
    for (const s of [-1, 1]) mesh(torso, new THREE.BoxGeometry(0.08, 0.07, 0.03).translate(s * 0.1, 0.0, 0.245), C(o.vest).multiplyScalar(0.75)); // pockets
  }
  if (o.bandolier) {
    mesh(torso, new THREE.BoxGeometry(0.06, 0.6, 0.04).rotateZ(0.75).translate(0, 0.1, 0.24), C(o.bandolier));
    for (let i = -2; i <= 2; i++) mesh(torso, new THREE.CylinderGeometry(0.017, 0.017, 0.07, 5).translate(i * 0.065, 0.1 - i * 0.06, 0.27), C('#c8281e'));
  }
  if (o.belt) {
    mesh(torso, new THREE.CylinderGeometry(0.245, 0.25, 0.05, 12).scale(1, 1, 0.94).translate(0, -0.07, 0), C(o.belt));
    mesh(torso, new THREE.BoxGeometry(0.07, 0.05, 0.02).translate(0, -0.07, 0.24), P.gold);
  }

  // ── head ──
  const head = group(torso, 'head', 0, 0.52, 0.02);
  mesh(head, new THREE.IcosahedronGeometry(0.33, 2).scale(1.0, 0.95, 0.95), P.skin);
  for (const s of [-1, 1]) {
    mesh(head, new THREE.IcosahedronGeometry(0.075, 1).translate(s * 0.33, 0, 0), P.skin); // ears
    mesh(head, new THREE.IcosahedronGeometry(0.06, 0).scale(1, 0.6, 0.4).translate(s * 0.17, -0.1, 0.27), P.cheek);
    // squinty tough-guy eyes (white, pupil, glint) + angry brows
    mesh(head, new THREE.SphereGeometry(0.05, 8, 5).scale(1.2, 0.6, 0.45).translate(s * 0.12, 0.03, 0.285), C('#f8f4ee'));
    mesh(head, new THREE.SphereGeometry(0.032, 6, 4).scale(1, 0.75, 0.5).translate(s * 0.115, 0.025, 0.3), C(o.eyes ?? '#3a2a1e'));
    mesh(head, new THREE.IcosahedronGeometry(0.009, 0).translate(s * 0.105 + 0.01, 0.04, 0.312), C('#ffffff'));
    // eyelid (the squint)
    mesh(head, new THREE.SphereGeometry(0.052, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.25, 0.55, 0.5).translate(s * 0.12, 0.04, 0.285), P.skin.clone().multiplyScalar(0.93));
    const brow = new THREE.BoxGeometry(0.13, 0.03, 0.04).rotateZ(s * -0.35).translate(s * 0.12, 0.1, 0.29);
    mesh(head, brow, o.browColor ? C(o.browColor) : C('#5a3b28'));
  }
  mesh(head, new THREE.IcosahedronGeometry(0.045, 0).translate(0, -0.03, 0.32), P.skin); // nose
  // smirk + chin dimple + a curl of hair poking out
  mesh(head, new THREE.BoxGeometry(0.12, 0.018, 0.02).rotateZ(-0.15).translate(0.02, -0.14, 0.29), C('#7a3a35'));
  mesh(head, new THREE.BoxGeometry(0.07, 0.014, 0.02).rotateZ(-0.1).translate(0.03, -0.165, 0.28), P.cheek.clone().multiplyScalar(0.85));
  mesh(head, new THREE.TorusGeometry(0.045, 0.014, 4, 8, Math.PI * 1.5).rotateY(Math.PI / 2).translate(0, 0.27, 0.2), C(o.hair ?? '#6a4a2a'));
  if (o.scar) mesh(head, new THREE.BoxGeometry(0.015, 0.12, 0.015).rotateZ(0.3).translate(-0.14, 0.02, 0.305), C('#c87a6a'));
  if (o.freckles) for (const [x, y] of [[-0.18, -0.04], [-0.14, -0.07], [0.16, -0.05], [0.19, -0.03]]) mesh(head, new THREE.IcosahedronGeometry(0.01, 0).translate(x, y, 0.28), C('#b87a5a'));

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

  // face accessories
  if (o.glasses) {
    for (const sx of [-1, 1]) mesh(head, new THREE.TorusGeometry(0.075, 0.016, 4, 10).translate(sx * 0.12, 0.03, 0.31), C(o.glasses));
    mesh(head, new THREE.BoxGeometry(0.08, 0.016, 0.016).translate(0, 0.04, 0.32), C(o.glasses));
  }
  if (o.shades) mesh(head, new THREE.BoxGeometry(0.36, 0.07, 0.04).translate(0, 0.04, 0.3), C(o.shades));
  if (o.mask) mesh(head, new THREE.BoxGeometry(0.42, 0.1, 0.05).translate(0, 0.04, 0.28), C(o.mask));
  if (o.goggles) {
    mesh(head, new THREE.CylinderGeometry(0.34, 0.34, 0.06, 12).translate(0, 0.14, 0), C('#3a2a1a'));
    for (const sx of [-1, 1]) mesh(head, new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8).rotateX(Math.PI / 2).translate(sx * 0.11, 0.15, 0.3), C(o.goggles));
  }

  // hat
  const hat = group(head, 'hat', 0, 0.24, -0.01);
  hat.rotation.z = o.hatTilt ?? 0.12;
  if (o.hat === 'fedora') {
    mesh(hat, new THREE.CylinderGeometry(0.46, 0.46, 0.035, 14).scale(1, 1, 0.92), P.hat);
    mesh(hat, new THREE.CylinderGeometry(0.25, 0.3, 0.26, 10).translate(0, 0.14, 0), (p) => (p.y > 0.25 ? P.hat.clone().multiplyScalar(0.85) : P.hat));
    mesh(hat, new THREE.CylinderGeometry(0.305, 0.305, 0.07, 10).translate(0, 0.05, 0), P.band);
    mesh(hat, new THREE.BoxGeometry(0.02, 0.06, 0.18).translate(0, 0.27, 0), P.hat.clone().multiplyScalar(0.7)); // crease
    if (o.feather) mesh(hat, new THREE.BoxGeometry(0.03, 0.22, 0.06).rotateZ(-0.5).translate(0.3, 0.14, 0.05), C(o.feather));
    mesh(hat, new THREE.TorusGeometry(0.46, 0.012, 3, 18).rotateX(Math.PI / 2).scale(1, 0.92, 1).translate(0, 0.01, 0), P.hat.clone().multiplyScalar(0.7)); // brim edge
  } else if (o.hat === 'beanie') {
    mesh(hat, new THREE.IcosahedronGeometry(0.33, 1).scale(1.02, 0.6, 1.02).translate(0, 0.0, 0), P.hat);
    mesh(hat, new THREE.CylinderGeometry(0.34, 0.34, 0.08, 10).translate(0, -0.08, 0), P.band);
    mesh(hat, new THREE.IcosahedronGeometry(0.08, 1).translate(0, 0.21, 0), P.band); // pompom
  } else if (o.hat === 'hardhat') {
    mesh(hat, new THREE.IcosahedronGeometry(0.34, 1).scale(1.02, 0.62, 1.05).translate(0, 0.02, 0), P.hat);
    mesh(hat, new THREE.CylinderGeometry(0.4, 0.4, 0.03, 12).translate(0, -0.07, 0.03), P.hat);
    mesh(hat, new THREE.BoxGeometry(0.06, 0.06, 0.55).translate(0, 0.2, 0), P.band);
    mesh(hat, new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8).rotateX(Math.PI / 2).translate(0, 0.08, 0.33), C('#fff6c0')); // lamp
    mesh(hat, new THREE.BoxGeometry(0.14, 0.08, 0.02).translate(0, 0.02, 0.34), C('#c8281e')); // sticker
  } else if (o.hat === 'beret') {
    mesh(hat, new THREE.CylinderGeometry(0.36, 0.33, 0.1, 12).translate(0.05, 0.02, 0), P.hat);
    mesh(hat, new THREE.CylinderGeometry(0.02, 0.02, 0.07, 4).translate(0.05, 0.1, 0), P.hat);
    mesh(hat, new THREE.IcosahedronGeometry(0.035, 0).translate(-0.22, 0.04, 0.2), C(o.pin ?? '#c8c8d0')); // pin
  } else if (o.hat === 'brain') {
    mesh(hat, new THREE.IcosahedronGeometry(0.3, 1).scale(1.05, 0.75, 1.1).translate(0, 0.06, -0.02), P.hat);
    for (let i = -2; i <= 2; i++) mesh(hat, new THREE.BoxGeometry(0.02, 0.05, 0.5).translate(i * 0.09, 0.2, -0.02), P.band);
  } else if (o.hat === 'bandana') {
    mesh(hat, new THREE.IcosahedronGeometry(0.33, 1).scale(1.03, 0.5, 1.03).translate(0, -0.02, 0), P.hat);
    mesh(hat, new THREE.BoxGeometry(0.06, 0.14, 0.18).translate(0, -0.05, -0.36).rotateX(0.4), P.hat);
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
    mesh(arm, new THREE.CapsuleGeometry(0.022, 0.04, 2, 4).rotateZ(s * 0.6).translate(s * -0.05, -0.27, 0.04), P.skin); // thumb
    if (P.shirt) mesh(arm, new THREE.CylinderGeometry(0.085, 0.085, 0.04, 8).translate(0, -0.21, 0), P.shirt.clone().multiplyScalar(0.85)); // cuff
    if (o.watch && s > 0) mesh(arm, new THREE.CylinderGeometry(0.08, 0.08, 0.035, 8).translate(0, -0.235, 0), C(o.watch));
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
  } else if (o.prop === 'dynamite') {
    for (let i = -1; i <= 1; i++) mesh(prop, new THREE.CylinderGeometry(0.035, 0.035, 0.26, 6).translate(i * 0.07, -0.1, 0.02), C('#c8281e'));
    mesh(prop, new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4).translate(0, -0.27, 0.02), C('#ddd'));
    group(prop, 'muzzle', 0, -0.32, 0.02);
  } else if (o.prop === 'rifle') {
    mesh(prop, new THREE.BoxGeometry(0.06, 0.62, 0.08).translate(0, -0.2, 0.02), P.metal);
    mesh(prop, new THREE.BoxGeometry(0.07, 0.2, 0.12).translate(0, 0.08, -0.02), P.brown);
    mesh(prop, new THREE.CylinderGeometry(0.04, 0.04, 0.16, 6).translate(0, -0.12, 0.09), C('#15161a')); // scope
    group(prop, 'muzzle', 0, -0.52, 0.02);
  } else if (o.prop === 'silencer') {
    mesh(prop, new THREE.BoxGeometry(0.05, 0.2, 0.09).translate(0, -0.06, 0.02), C('#202227'));
    mesh(prop, new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6).translate(0, -0.24, 0.03), C('#15161a'));
    group(prop, 'muzzle', 0, -0.33, 0.03);
  } else if (o.prop === 'raygun') {
    mesh(prop, new THREE.CylinderGeometry(0.06, 0.03, 0.22, 8).translate(0, -0.12, 0.02), C('#c0c8d4'));
    for (let i = 0; i < 3; i++) mesh(prop, new THREE.CylinderGeometry(0.075, 0.075, 0.02, 8).translate(0, -0.04 - i * 0.05, 0.02), C('#ff4fa3'));
    mesh(prop, new THREE.IcosahedronGeometry(0.04, 0).translate(0, -0.25, 0.02), C('#7dff7a'));
    group(prop, 'muzzle', 0, -0.28, 0.02);
  } else {
    group(prop, 'muzzle', 0, -0.05, 0);
  }
  if (o.gloves) {
    for (const arm of [nodes.armL, nodes.armR]) mesh(arm, new THREE.IcosahedronGeometry(0.12, 1).scale(1, 1, 1.15).translate(0, -0.3, 0.02), C(o.gloves));
  }

  // ── legs ──
  for (const s of [-1, 1]) {
    const leg = group(hips, s < 0 ? 'legL' : 'legR', s * 0.13, -0.08, 0);
    mesh(leg, new THREE.CapsuleGeometry(0.085, 0.1, 3, 6).translate(0, -0.1, 0), P.skin);
    mesh(leg, new THREE.IcosahedronGeometry(0.09, 1).scale(1, 0.6, 1.4).translate(0, -0.22, 0.04), o.shoes ? C(o.shoes) : P.skin);
    if (o.shoes) {
      mesh(leg, new THREE.BoxGeometry(0.15, 0.025, 0.24).translate(0, -0.265, 0.04), C(o.soles ?? '#f4f1ea')); // sole
      mesh(leg, new THREE.CylinderGeometry(0.09, 0.09, 0.04, 8).translate(0, -0.17, 0), C(o.shoes).multiplyScalar(1.2)); // cuff
    } else for (let t = -1; t <= 1; t++) mesh(leg, new THREE.IcosahedronGeometry(0.022, 0).translate(t * 0.04, -0.23, 0.15), P.skin); // toes
  }

  return { root, nodes };
}
