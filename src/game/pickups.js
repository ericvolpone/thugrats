import * as THREE from 'three';
import { MATS } from '../assets/models.js';
import { paint, C, rand, TAU } from '../util.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sfx } from '../audio.js';

/**
 * XP gems, gold, baby bottles (heal), magnets and chests. Everything inside
 * your pickup range flies to you.
 */
const MAX_G = 700, MAX_C = 250;
/** Seconds before an unopened chest disappears. */
export const CHEST_LIFE = 90;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();
const GEM_COLORS = [[1, '#58c4ff'], [5, '#4fe07a'], [20, '#c06cff'], [80, '#ff9a1f']];

/** A floating text label (chest prices, the Black Market sign). */
export function labelSprite(w = 256, h = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  spr.renderOrder = 5;
  spr.userData.set = (text, fg = '#fff', bg = 'rgba(0,0,0,0.7)') => {
    if (spr.userData.text === text + fg) return;
    spr.userData.text = text + fg;
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.fillStyle = bg;
    g.beginPath(); g.roundRect(4, 8, w - 8, h - 16, 24); g.fill();
    g.font = `bold ${Math.round(h * 0.5)}px "Lilita One", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = fg;
    g.fillText(text, w / 2, h / 2 + 2);
    tex.needsUpdate = true;
  };
  return spr;
}

function marketGeometry() {
  const wood = C('#5a3a22'), dark = C('#2a2230'), tarp = C('#4a2a6a'), tarp2 = C('#2e1a44'), crate = C('#8a6238'), neon = C('#5dff9a'), gold = C('#f2c037');
  const parts = [
    // table + goods
    paint(new THREE.BoxGeometry(3.2, 0.12, 1.3).translate(0, 0.95, 0.4), wood),
    paint(new THREE.BoxGeometry(3.0, 0.9, 0.08).translate(0, 0.45, 1.0), dark),
    paint(new THREE.BoxGeometry(0.7, 0.45, 0.6).translate(-0.9, 1.23, 0.4), crate),
    paint(new THREE.BoxGeometry(0.5, 0.3, 0.4).translate(0.2, 1.16, 0.5), C('#3a5a3a')),
    paint(new THREE.CylinderGeometry(0.14, 0.14, 0.4, 8).translate(0.9, 1.21, 0.3), C('#a02a2a')),
    paint(new THREE.CylinderGeometry(0.14, 0.14, 0.4, 8).translate(1.15, 1.21, 0.55), C('#2a6aa0')),
    paint(new THREE.BoxGeometry(0.4, 0.06, 0.3).translate(0.4, 1.04, 0.15), gold),
    // poles + sagging tarp roof
    ...[[-1.6, -0.3], [1.6, -0.3], [-1.6, 1.1], [1.6, 1.1]].map(([x, z]) => paint(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6).translate(x, 1.3, z), wood)),
    paint(new THREE.BoxGeometry(3.6, 0.08, 1.9).rotateX(-0.18).translate(0, 2.65, 0.4), tarp),
    ...[0, 1, 2, 3, 4, 5].map((i) => paint(new THREE.BoxGeometry(0.6, 0.35, 0.04).translate(-1.5 + i * 0.6, 2.45, 1.38), i % 2 ? tarp : tarp2)),
    // crates stacked behind
    paint(new THREE.BoxGeometry(1, 1, 1).translate(-1.1, 0.5, -0.9), crate),
    paint(new THREE.BoxGeometry(0.8, 0.8, 0.8).translate(-1.1, 1.4, -0.9), crate),
    paint(new THREE.BoxGeometry(1, 0.9, 1).translate(1.2, 0.45, -1), crate),
    // the dealer: trench coat + fedora
    paint(new THREE.CylinderGeometry(0.32, 0.45, 1.3, 8).translate(0, 0.65, -0.5), C('#6a5a44')),
    paint(new THREE.SphereGeometry(0.3, 10, 8).translate(0, 1.55, -0.5), C('#f0c8a0')),
    paint(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 12).translate(0, 1.75, -0.5), C('#222')),
    paint(new THREE.CylinderGeometry(0.24, 0.27, 0.25, 12).translate(0, 1.88, -0.5), C('#222')),
    paint(new THREE.BoxGeometry(0.5, 0.08, 0.06).translate(0, 1.58, -0.22), C('#111')),
    // neon tube along the front
    paint(new THREE.BoxGeometry(3.4, 0.06, 0.06).translate(0, 2.25, 1.42), neon),
  ];
  return mergeGeometries(parts);
}

function chestGeometry() {
  const wood = C('#7a4a22'), gold = C('#f2c037'), dark = C('#3a220e');
  return mergeGeometries([
    paint(new THREE.BoxGeometry(1.2, 0.7, 0.8).translate(0, 0.35, 0), wood),
    paint(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(0, 0.7, 0), wood),
    paint(new THREE.BoxGeometry(1.24, 0.1, 0.84).translate(0, 0.7, 0), gold),
    paint(new THREE.BoxGeometry(0.1, 0.9, 0.84).translate(-0.45, 0.55, 0), gold),
    paint(new THREE.BoxGeometry(0.1, 0.9, 0.84).translate(0.45, 0.55, 0), gold),
    paint(new THREE.BoxGeometry(0.2, 0.25, 0.06).translate(0, 0.6, 0.42), dark),
  ]);
}

export class Pickups {
  constructor(run) {
    this.run = run;
    this.scene = run.scene;
    this.gems = [];
    this.coins = [];
    this.specials = [];
    this.chests = [];
    this.gMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial(), MAX_G);
    this.cMesh = new THREE.InstancedMesh(paint(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 10).rotateX(Math.PI / 2), C('#f6c945'), 0.05), MATS.flat, MAX_C);
    for (const m of [this.gMesh, this.cMesh]) {
      m.frustumCulled = false;
      m.count = 0;
      this.scene.add(m);
    }
    for (let i = 0; i < MAX_G; i++) this.gMesh.setColorAt(i, _c.set(1, 1, 1));
    this.chestGeo = chestGeometry();
    this.bottleGeo = mergeGeometries([
      paint(new THREE.CylinderGeometry(0.16, 0.18, 0.4, 8).translate(0, 0.2, 0), C('#f4f8ff')),
      paint(new THREE.CylinderGeometry(0.1, 0.16, 0.12, 8).translate(0, 0.46, 0), C('#ff7aa8')),
      paint(new THREE.ConeGeometry(0.07, 0.14, 6).translate(0, 0.58, 0), C('#ffd2a0')),
    ]);
    this.buildMarket();
    this.magnetGeo = mergeGeometries([
      paint(new THREE.TorusGeometry(0.3, 0.1, 4, 10, Math.PI).translate(0, 0.35, 0), C('#e0302a')),
      paint(new THREE.BoxGeometry(0.2, 0.2, 0.2).translate(-0.3, 0.25, 0), C('#ddd')),
      paint(new THREE.BoxGeometry(0.2, 0.2, 0.2).translate(0.3, 0.25, 0), C('#ddd')),
    ]);
  }

  /** The Black Market: a shady stall near the spawn where contracts buy Contraband. */
  buildMarket() {
    const w = this.run.world, sp = this.run.map.spawn ?? [0, 0];
    let pos = null;
    for (let r = 9; r < 40 && !pos; r += 2) {
      // prefer north of the spawn (in front of the starting camera), then sweep both ways
      for (let j = 0; j < 16; j++) {
        const a = Math.PI + (j % 2 ? 1 : -1) * Math.ceil(j / 2) * (TAU / 16);
        const x = sp[0] + Math.sin(a) * r, z = sp[1] + Math.cos(a) * r;
        if (w.freeAt(x, z, 3.2) && w.clear(x, z, 2.5)) { pos = [x, z]; break; }
      }
    }
    pos ??= w.freeSpot(sp[0] + 10, sp[1], 3);
    const [x, z] = pos;
    const mesh = new THREE.Mesh(marketGeometry(), MATS.flat);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.atan2(sp[0] - x, sp[1] - z); // face the spawn
    this.scene.add(mesh);
    const sign = labelSprite(320, 96);
    sign.material.depthTest = true; // the $ on the minimap finds it; up close it shouldn't cover the fight
    sign.position.set(x, 4, z);
    sign.scale.set(2.8, 0.84, 1);
    this.scene.add(sign);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: '#5dff9a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(x, 15, z);
    this.scene.add(beam);
    this.market = { x, z, mesh, sign, beam, warned: -9 };
  }

  gem(x, z, value) {
    if (this.gems.length >= MAX_G) {
      // merge into a random existing gem far away to keep the count bounded
      const g = this.gems[Math.floor(Math.random() * this.gems.length)];
      g.v += value;
      return;
    }
    this.gems.push({ x: x + rand(-0.3, 0.3), z: z + rand(-0.3, 0.3), v: value, pull: false, sp: 0, t: rand(0, 6) });
  }

  coin(x, z, value) {
    if (this.coins.length >= MAX_C) { this.coins[0].v += value; return; }
    this.coins.push({ x: x + rand(-0.4, 0.4), z: z + rand(-0.4, 0.4), v: value, pull: false, sp: 0, t: rand(0, 6) });
  }

  special(kind, x, z) {
    const mesh = new THREE.Mesh(kind === 'heal' ? this.bottleGeo : this.magnetGeo, MATS.flat);
    mesh.position.set(x, 0.3, z);
    this.scene.add(mesh);
    this.specials.push({ kind, x, z, mesh, pull: false, sp: 0, t: 0 });
  }

  chest(x, z) {
    const mesh = new THREE.Mesh(this.chestGeo, MATS.flat);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rand(0, TAU);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 6, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    glow.position.y = 3;
    mesh.add(glow);
    this.scene.add(mesh);
    const label = labelSprite();
    label.position.set(x, 2.2, z);
    label.scale.set(2, 0.75, 1);
    this.scene.add(label);
    const c = { x, z, mesh, label, glow, t: 0, near: false };
    this.chests.push(c);
    return c;
  }

  /** Pull every gem/coin on the map to the player. */
  vacuum() {
    for (const g of this.gems) g.pull = true;
    for (const c of this.coins) c.pull = true;
  }

  update(dt) {
    const run = this.run, p = run.player;
    const pr = run.stats.pickup;
    const t = run.time;
    const step = (o) => {
      const dx = p.x - o.x, dz = p.z - o.z;
      const d = Math.hypot(dx, dz);
      if (!o.pull && d < pr) o.pull = true;
      if (o.pull) {
        o.sp = Math.min(40, o.sp + dt * 45);
        const k = Math.min(1, (o.sp * dt) / Math.max(0.01, d));
        o.x += dx * k;
        o.z += dz * k;
      }
      return d < 0.7;
    };

    let n = 0;
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      if (step(g)) {
        run.addXp(g.v);
        sfx('xp', 0.04);
        this.gems[i] = this.gems[this.gems.length - 1];
        this.gems.pop();
        continue;
      }
      g.t += dt;
      const s = g.v >= 80 ? 1.9 : g.v >= 20 ? 1.5 : g.v >= 5 ? 1.2 : 1;
      _e.set(0, g.t * 2, 0);
      _q.setFromEuler(_e);
      _m.compose(_v.set(g.x, 0.45 + Math.sin(g.t * 3) * 0.1, g.z), _q, _s.set(s, s * 1.3, s));
      this.gMesh.setMatrixAt(n, _m);
      let col = GEM_COLORS[0][1];
      for (const [v, c] of GEM_COLORS) if (g.v >= v) col = c;
      this.gMesh.setColorAt(n, _c.set(col));
      n++;
    }
    this.gMesh.count = n;
    this.gMesh.instanceMatrix.needsUpdate = true;
    this.gMesh.instanceColor.needsUpdate = true;

    n = 0;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (step(c)) {
        run.addGold(c.v);
        sfx('gold', 0.06);
        this.coins[i] = this.coins[this.coins.length - 1];
        this.coins.pop();
        continue;
      }
      c.t += dt;
      _e.set(0, c.t * 4, 0);
      _q.setFromEuler(_e);
      const s = c.v >= 10 ? 1.6 : 1;
      _m.compose(_v.set(c.x, 0.4 + Math.sin(c.t * 3) * 0.08, c.z), _q, _s.set(s, s, s));
      this.cMesh.setMatrixAt(n++, _m);
    }
    this.cMesh.count = n;
    this.cMesh.instanceMatrix.needsUpdate = true;

    for (let i = this.specials.length - 1; i >= 0; i--) {
      const s = this.specials[i];
      s.t += dt;
      if (step(s)) {
        this.scene.remove(s.mesh);
        this.specials.splice(i, 1);
        if (s.kind === 'heal') { run.heal(run.stats.maxHp * 0.3); run.fx.burst(p.x, 1, p.z, '#7dff9a', 12, 3); }
        if (s.kind === 'magnet') { this.vacuum(); run.toast('🧲 Magnet! Everything comes to papa.'); }
        sfx('levelup', 0.2);
        continue;
      }
      s.mesh.position.set(s.x, 0.3 + Math.sin(s.t * 3) * 0.12, s.z);
      s.mesh.rotation.y = s.t * 1.5;
    }

    const cost = run.chestCost();
    for (const c of this.chests) {
      c.t += dt;
      c.mesh.position.y = Math.abs(Math.sin(c.t * 2)) * 0.1;
      // chests expire: the last 15s show a countdown and blink
      const left = CHEST_LIFE - c.t;
      c.label.userData.set(left < 15 ? `${cost} 💰 · ${Math.ceil(left)}s` : `${cost} 💰`, run.gold >= cost ? '#ffd23f' : '#ff8a7a');
      const blink = left < 10 && Math.sin(c.t * 14) > 0;
      c.mesh.visible = !blink;
      c.glow.material.opacity = left < 15 ? 0.1 : 0.18;
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      c.near = d < 1.8;
    }
    for (let i = this.chests.length - 1; i >= 0; i--) {
      const c = this.chests[i];
      if (c.t >= CHEST_LIFE) {
        run.fx.burst(c.x, 0.6, c.z, '#c8a060', 10, 3);
        this.scene.remove(c.mesh, c.label);
        this.chests.splice(i, 1);
        continue;
      }
      if (!c.near) continue;
      if (run.tryOpenChest(c)) {
        this.scene.remove(c.mesh, c.label);
        this.chests.splice(i, 1);
      }
    }

    const mk = this.market;
    const has = run.contracts > 0;
    mk.sign.userData.set(has ? `BLACK MARKET (${run.contracts})` : 'BLACK MARKET', has ? '#5dff9a' : '#c9b8e0', 'rgba(20,10,30,0.8)');
    mk.beam.material.opacity = has ? 0.13 + Math.sin(t * 3) * 0.05 : 0;
    mk.sign.position.y = 4 + Math.sin(t * 2) * 0.1;
    if (Math.hypot(p.x - mk.x, p.z - mk.z) < 2.8 && !run.choice && !run.queue.length) {
      if (!run.tryMarket() && t - mk.warned > 5) {
        mk.warned = t;
        run.toast('🕶️ Black Market: kill a Crime Titan to complete a contract, then trade it here for Contraband.');
      }
    }
  }

  dispose() {
    this.scene.remove(this.gMesh, this.cMesh);
    for (const s of this.specials) this.scene.remove(s.mesh);
    for (const c of this.chests) this.scene.remove(c.mesh, c.label);
    const mk = this.market;
    this.scene.remove(mk.mesh, mk.sign, mk.beam);
  }
}
