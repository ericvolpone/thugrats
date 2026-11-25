import * as THREE from 'three';
import { mobGeometry, MATS } from '../assets/models.js';
import { MOBS, BOSSES } from '../data/mobs.js';
import { BossBrain } from './bossBrain.js';
import { TAU, rand } from '../util.js';

/**
 * All enemies. Regular + elite mobs of a type share one InstancedMesh (one draw
 * call per type); bosses and titans get their own mesh. Tiers:
 *   0 regular · 1 elite · 2 boss · 3 titan
 * A uniform grid (rebuilt each frame) answers "who is near X" quickly.
 */
const CELL = 4;
const CAP = 420;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const ELITE_TINT = new THREE.Color(1.25, 1.05, 0.55);
const WHITE = new THREE.Color(1, 1, 1);

export const TIER_NAMES = ['Thug', 'Elite', 'Boss', 'Titan'];

let nextId = 1;

export class MobManager {
  constructor(run) {
    this.run = run;
    this.scene = run.scene;
    this.list = [];
    this.batches = new Map(); // model -> {mesh, n}
    this.grid = new Map();
    this.cap = 340;

    const blobGeo = new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2);
    this.blobs = new THREE.InstancedMesh(blobGeo, new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3, depthWrite: false }), CAP + 40);
    this.blobs.frustumCulled = false;
    this.blobs.renderOrder = 1;
    this.scene.add(this.blobs);

    const ringGeo = new THREE.TorusGeometry(1, 0.08, 4, 18).rotateX(Math.PI / 2);
    this.rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd23f' }), 80);
    this.rings.frustumCulled = false;
    this.scene.add(this.rings);
  }

  batch(model) {
    let b = this.batches.get(model);
    if (!b) {
      const mesh = new THREE.InstancedMesh(mobGeometry(model), MATS.flat, CAP);
      mesh.frustumCulled = false;
      mesh.count = 0;
      for (let i = 0; i < CAP; i++) mesh.setColorAt(i, WHITE);
      this.scene.add(mesh);
      b = { mesh, n: 0 };
      this.batches.set(model, b);
    }
    return b;
  }

  /** Warm up instanced meshes for a roster so the first spawn doesn't hitch. */
  prepare(ids) {
    for (const id of ids) this.batch(MOBS[id].model);
  }

  get alive() {
    let n = 0;
    for (const m of this.list) if (!m.dead && m.tier < 2) n++;
    return n;
  }

  /** Spawn a regular/elite mob (tier 0/1). */
  spawn(typeId, x, z, elite = false) {
    const def = MOBS[typeId];
    const sc = this.run.mobScale();
    const hp = def.hp * sc.hp * (elite ? 7 : 1);
    const m = this.make({
      def, typeId, tier: elite ? 1 : 0, x, z, hp,
      dmg: def.dmg * sc.dmg * (elite ? 1.6 : 1),
      speed: def.speed * (elite ? 0.92 : 1) * rand(0.92, 1.08),
      radius: def.radius * (elite ? 1.45 : 1),
      scale: elite ? 1.45 : 1,
      xp: def.xp * (elite ? 6 : 1) * sc.xp,
    });
    if (!elite) this.batch(def.model);
    else this.batch(def.model);
    return m;
  }

  /** Spawn a boss (tier 2) or titan (tier 3) from data/mobs.js BOSSES. */
  spawnBoss(bossId, x, z, titanCfg = null) {
    const def = BOSSES[bossId];
    const sc = this.run.mobScale(true);
    const tier = def.titan ? 3 : 2;
    const m = this.make({
      def, typeId: bossId, tier, x, z, hp: def.hp * sc.hp, dmg: def.dmg * sc.dmg,
      speed: def.speed, radius: def.radius, scale: def.scale, xp: 0,
    });
    m.boss = def;
    m.titanCfg = titanCfg;
    m.mesh = new THREE.Mesh(mobGeometry(def.model), MATS.flat);
    m.mesh.scale.setScalar(def.scale);
    this.scene.add(m.mesh);
    m.brain = new BossBrain(this.run, m);
    return m;
  }

  make(o) {
    const m = {
      id: nextId++, ...o, maxHp: o.hp, vx: 0, vz: 0, kx: 0, kz: 0,
      facing: rand(0, TAU), atkT: rand(0.3, 1), wind: 0, windKind: null, rangedT: rand(0.5, 2),
      slowT: 0, slow: 0, rootT: 0, burnT: 0, burnDps: 0, burnTick: 0, flash: 0, spawnT: 0,
      dead: false, deathT: 0, phase: rand(0, TAU), zoneSlow: 0, fear: false, armor: o.def.armor ?? 0,
      height: 1.8 * (o.scale ?? 1),
    };
    this.list.push(m);
    return m;
  }

  // ── spatial queries ─────────────────────────────────────────
  key(cx, cz) { return (cx + 2048) * 4096 + (cz + 2048); }

  rebuildGrid() {
    for (const arr of this.grid.values()) arr.length = 0;
    for (const m of this.list) {
      if (m.dead) continue;
      const k = this.key(Math.floor(m.x / CELL), Math.floor(m.z / CELL));
      let arr = this.grid.get(k);
      if (!arr) { arr = []; this.grid.set(k, arr); }
      arr.push(m);
    }
  }

  /** Calls fn(m) for every live mob whose body overlaps the circle (x, z, r). */
  each(x, z, r, fn) {
    const pad = 3; // biggest radius we care about
    const c0x = Math.floor((x - r - pad) / CELL), c1x = Math.floor((x + r + pad) / CELL);
    const c0z = Math.floor((z - r - pad) / CELL), c1z = Math.floor((z + r + pad) / CELL);
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cz = c0z; cz <= c1z; cz++) {
        const arr = this.grid.get(this.key(cx, cz));
        if (!arr) continue;
        for (const m of arr) {
          if (m.dead) continue;
          const dx = m.x - x, dz = m.z - z, rr = r + m.radius;
          if (dx * dx + dz * dz <= rr * rr) fn(m);
        }
      }
    }
  }

  near(x, z, r) {
    const out = [];
    this.each(x, z, r, (m) => out.push(m));
    return out;
  }

  count(x, z, r) {
    let n = 0;
    this.each(x, z, r, () => n++);
    return n;
  }

  static priority(m) {
    return m.tier * 1e7 + m.maxHp;
  }

  /** Candidates in range sorted: strongest (tier, then max hp, then closest) or nearest. */
  candidates(x, z, range, mode) {
    const out = [];
    for (const m of this.list) {
      if (m.dead || m.spawnT < 0.5) continue;
      const dx = m.x - x, dz = m.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 > range * range) continue;
      m._d2 = d2;
      out.push(m);
    }
    if (mode === 'nearest') out.sort((a, b) => a._d2 - b._d2);
    else out.sort((a, b) => MobManager.priority(b) - MobManager.priority(a) || a._d2 - b._d2);
    return out;
  }

  /**
   * Best single target. mode: 'strongest' (elites > regular, then toughest),
   * 'nearest', 'cluster' (the mob with the most others around it; bosses win ties).
   */
  target(x, z, range, mode = 'strongest') {
    if (mode === 'cluster') {
      const c = this.candidates(x, z, range, 'nearest');
      if (!c.length) return null;
      let best = null, bestN = -1;
      const step = Math.max(1, Math.floor(c.length / 40));
      for (let i = 0; i < c.length; i += step) {
        const n = this.count(c[i].x, c[i].z, 3) + c[i].tier * 3;
        if (n > bestN) { bestN = n; best = c[i]; }
      }
      return best;
    }
    return this.candidates(x, z, range, mode)[0] ?? null;
  }

  targets(x, z, range, n, mode = 'strongest') {
    return this.candidates(x, z, range, mode).slice(0, n);
  }

  // ── simulation ─────────────────────────────────────────────
  update(dt) {
    const run = this.run;
    const p = run.player;
    const fearR = run.stats.fearRadius;
    this.rebuildGrid();

    for (const m of this.list) {
      if (m.dead) { m.deathT += dt; continue; }
      m.spawnT = Math.min(1, m.spawnT + dt * 3);
      m.flash = Math.max(0, m.flash - dt * 6);
      m.phase += dt * (m.speed * 1.6);

      // status
      if (m.burnT > 0) {
        m.burnT -= dt;
        m.burnTick -= dt;
        if (m.burnTick <= 0) {
          m.burnTick = 0.5;
          run.hit(m, m.burnDps * 0.5, null, { isBurn: true, noCrit: true, color: '#ff8a3d' });
          if (m.dead) continue;
        }
      }
      m.rootT -= dt;
      m.slowT -= dt;
      const dx = p.x - m.x, dz = p.z - m.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      m.fear = fearR > 0 && dist < fearR + m.radius;

      if (m.brain) m.brain.update(dt, dist);

      // movement
      let sp = m.speed;
      if (m.slowT > 0) sp *= 1 - m.slow;
      if (m.zoneSlow) sp *= 1 - m.zoneSlow;
      if (m.fear) sp *= 0.7;
      if (m.rootT > 0 || m.wind > 0 || m.brain?.busy) sp = 0;
      const touch = m.radius + p.radius;
      let want = 1;
      const r = m.def.ranged;
      if (r && dist < r.keep) want = dist < r.keep * 0.7 ? -0.6 : 0;
      if (dist < touch + 0.05) want = 0;
      const nx = dx / dist, nz = dz / dist;
      m.vx = nx * sp * want;
      m.vz = nz * sp * want;
      if (m.brain?.dash) { m.vx = m.brain.dash.vx; m.vz = m.brain.dash.vz; }
      m.x += (m.vx + m.kx) * dt;
      m.z += (m.vz + m.kz) * dt;
      const kd = Math.exp(-8 * dt);
      m.kx *= kd;
      m.kz *= kd;
      if (!m.brain?.busy || m.brain?.dash) {
        const tf = m.brain?.dash ? Math.atan2(m.vx, m.vz) : Math.atan2(nx, nz);
        let d = tf - m.facing;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        m.facing += d * Math.min(1, dt * 8);
      }
      m.zoneSlow = 0;

      // melee
      m.atkT -= dt;
      if (m.wind > 0) {
        m.wind -= dt;
        if (m.wind <= 0) {
          if (m.windKind === 'melee') {
            if (Math.hypot(p.x - m.x, p.z - m.z) <= touch + (m.def.reach ?? 0.5) + 0.4) run.hurtPlayer(m.dmg, m);
          } else if (m.windKind === 'ranged') {
            this.fireRanged(m);
          }
          m.windKind = null;
        }
      } else if (m.rootT <= 0 && !m.brain?.busy) {
        if (dist <= touch + (m.def.reach ?? 0.5) && m.atkT <= 0) {
          m.wind = 0.28;
          m.windKind = 'melee';
          m.atkT = m.def.atkCd ?? 1.2;
        } else if (r && dist <= r.range && (m.rangedT -= dt) <= 0) {
          m.wind = 0.4;
          m.windKind = 'ranged';
          m.rangedT = r.cd * rand(0.85, 1.2);
        }
      }

      // leash: stragglers far behind get recycled back into the fight
      if (m.tier < 2 && dist > 62) {
        const a = Math.atan2(p.x - m.x, p.z - m.z) + Math.PI + rand(-0.6, 0.6);
        const [sx, sz] = run.spawnPoint(a);
        m.x = sx;
        m.z = sz;
        m.spawnT = 0;
      }
    }

    // separation (push overlapping mobs apart) + keep out of the player + obstacles
    for (const m of this.list) {
      if (m.dead) continue;
      if (!m.def.fly) {
        this.each(m.x, m.z, m.radius, (o) => {
          if (o === m) return;
          const dx = m.x - o.x, dz = m.z - o.z;
          const d = Math.hypot(dx, dz) || 0.01;
          const overlap = m.radius + o.radius - d;
          if (overlap <= 0) return;
          const wm = m.tier >= 2 ? 0.05 : o.tier >= 2 ? 0.95 : 0.5;
          m.x += (dx / d) * overlap * wm;
          m.z += (dz / d) * overlap * wm;
        });
        run.world.collide(m);
      }
      const dx = m.x - p.x, dz = m.z - p.z;
      const d = Math.hypot(dx, dz) || 0.01;
      const min = m.radius + p.radius;
      if (d < min) {
        m.x = p.x + (dx / d) * min;
        m.z = p.z + (dz / d) * min;
      }
    }

    // remove finished corpses
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      if (m.dead && m.deathT > 0.4) {
        if (m.mesh) { this.scene.remove(m.mesh); }
        this.list[i] = this.list[this.list.length - 1];
        this.list.pop();
      }
    }
    this.draw();
  }

  fireRanged(m) {
    const p = this.run.player;
    const r = m.def.ranged;
    const n = r.spread ?? 1;
    const base = Math.atan2(p.x - m.x, p.z - m.z);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.22;
      this.run.enemyShot({ x: m.x, z: m.z, y: 1.1 * m.scale, angle: a, speed: r.speed, dmg: r.dmg * this.run.mobScale().dmg * (m.tier === 1 ? 1.5 : 1), color: r.color, size: r.size, src: m });
    }
  }

  draw() {
    for (const b of this.batches.values()) b.n = 0;
    let blobs = 0, rings = 0;
    const t = this.run.time;
    for (const m of this.list) {
      const deathK = m.dead ? Math.min(1, m.deathT / 0.35) : 0;
      const grow = m.spawnT < 1 ? 0.3 + 0.7 * m.spawnT : 1;
      const squash = 1 + m.flash * 0.18;
      const sc = m.scale * grow * (1 - deathK * 0.6);
      const walk = Math.hypot(m.vx, m.vz) > 0.2 ? 1 : 0;
      const sway = Math.sin(m.phase) * 0.1 * walk;
      let pitch = 0;
      if (m.wind > 0) pitch = m.windKind === 'melee' ? -0.25 : -0.15; // lean back on wind-up
      else if (m.atkT > (m.def.atkCd ?? 1) - 0.15) pitch = 0.45; // lunge
      if (m.brain?.pose) pitch = m.brain.pose;
      pitch += deathK * 1.4;
      const fly = m.def.fly ? m.def.fly + Math.sin(m.phase * 1.7) * 0.15 : 0;
      const bob = Math.abs(Math.sin(m.phase)) * 0.06 * walk * m.scale;
      _e.set(pitch, m.facing, sway);
      _q.setFromEuler(_e);
      _p.set(m.x, fly + bob - deathK * 0.3, m.z);
      _s.set(sc / squash ** 0.5, sc * squash ** -0.5 * (m.flash > 0 ? 0.9 : 1), sc / squash ** 0.5);
      _m.compose(_p, _q, _s);

      if (m.mesh) {
        m.mesh.matrixAutoUpdate = false;
        m.mesh.matrix.copy(_m);
      } else {
        const b = this.batch(m.def.model);
        if (b.n >= CAP) continue;
        b.mesh.setMatrixAt(b.n, _m);
        _c.copy(m.tier === 1 ? ELITE_TINT : WHITE);
        if (m.burnT > 0) _c.lerp(new THREE.Color(1.4, 0.6, 0.3), 0.35 + 0.2 * Math.sin(t * 20));
        if (m.rootT > 0 || m.slowT > 0) _c.lerp(new THREE.Color(0.6, 0.65, 0.75), 0.5);
        if (m.flash > 0) _c.lerp(new THREE.Color(3, 3, 3), Math.min(1, m.flash));
        b.mesh.setColorAt(b.n, _c);
        b.n++;
      }
      if (!m.dead && blobs < CAP + 40) {
        const r = m.radius * 1.15 * grow;
        _m.makeScale(r, 1, r).setPosition(m.x, 0.03, m.z);
        this.blobs.setMatrixAt(blobs++, _m);
      }
      if (!m.dead && m.tier >= 1 && rings < 80) {
        const r = m.radius * 1.25 + Math.sin(t * 4) * 0.05;
        _m.makeScale(r, 1, r).setPosition(m.x, 0.08, m.z);
        this.rings.setMatrixAt(rings++, _m);
      }
    }
    for (const b of this.batches.values()) {
      b.mesh.count = b.n;
      b.mesh.instanceMatrix.needsUpdate = true;
      if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
    }
    this.blobs.count = blobs;
    this.blobs.instanceMatrix.needsUpdate = true;
    this.rings.count = rings;
    this.rings.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const b of this.batches.values()) this.scene.remove(b.mesh);
    for (const m of this.list) if (m.mesh) this.scene.remove(m.mesh);
    this.scene.remove(this.blobs, this.rings);
  }
}
