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
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();
const GEM_COLORS = [[1, '#58c4ff'], [5, '#4fe07a'], [20, '#c06cff'], [80, '#ff9a1f']];

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
    this.magnetGeo = mergeGeometries([
      paint(new THREE.TorusGeometry(0.3, 0.1, 4, 10, Math.PI).translate(0, 0.35, 0), C('#e0302a')),
      paint(new THREE.BoxGeometry(0.2, 0.2, 0.2).translate(-0.3, 0.25, 0), C('#ddd')),
      paint(new THREE.BoxGeometry(0.2, 0.2, 0.2).translate(0.3, 0.25, 0), C('#ddd')),
    ]);
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

  chest(x, z, free = false) {
    const mesh = new THREE.Mesh(this.chestGeo, MATS.flat);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rand(0, TAU);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 6, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    glow.position.y = 3;
    mesh.add(glow);
    this.scene.add(mesh);
    const c = { x, z, mesh, free, t: 0, near: false };
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

    for (const c of this.chests) {
      c.t += dt;
      c.mesh.position.y = Math.abs(Math.sin(c.t * 2)) * 0.1;
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      c.near = d < 1.8;
    }
    for (let i = this.chests.length - 1; i >= 0; i--) {
      const c = this.chests[i];
      if (!c.near) continue;
      if (run.tryOpenChest(c)) {
        this.scene.remove(c.mesh);
        this.chests.splice(i, 1);
      }
    }
  }

  dispose() {
    this.scene.remove(this.gMesh, this.cMesh);
    for (const s of this.specials) this.scene.remove(s.mesh);
    for (const c of this.chests) this.scene.remove(c.mesh);
  }
}
