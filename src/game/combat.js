import * as THREE from 'three';
import { propGeometry, MATS, createHeroModel } from '../assets/models.js';
import { rand, TAU, paint, C } from '../util.js';
import { sfx } from '../audio.js';

/**
 * Everything the hero's abilities put into the world: bullets, enemy shots,
 * lobbed throwables, ground zones, traps, drive-by cars, orbiting cash,
 * hit-contract marks and hired goons.
 */
const MAX_B = 500, MAX_E = 300, MAX_L = 60, MAX_O = 40;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

const LOB_COLORS = { grenade: '#4f7d2f', molotov: '#d9a441', cement: '#a9a49a', dynamite: '#c8281e' };

export class Combat {
  constructor(run) {
    this.run = run;
    const scene = (this.scene = run.scene);
    const inst = (geo, mat, n) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.frustumCulled = false;
      m.count = 0;
      for (let i = 0; i < n; i++) m.setColorAt(i, _c.set(1, 1, 1));
      scene.add(m);
      return m;
    };
    this.bullets = [];
    this.bMesh = inst(new THREE.BoxGeometry(0.11, 0.11, 0.7), new THREE.MeshBasicMaterial(), MAX_B);
    this.eshots = [];
    this.eMesh = inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial(), MAX_E);
    this.lobs = [];
    this.lMesh = inst(new THREE.IcosahedronGeometry(0.24, 0), new THREE.MeshLambertMaterial({ flatShading: true }), MAX_L);
    this.orbits = [];
    this.oMesh = inst(paint(new THREE.BoxGeometry(0.7, 0.3, 0.45), C('#3da35a')), MATS.flat, MAX_O);
    this.zones = [];
    this.traps = [];
    this.cars = [];
    this.marks = [];
    this.goons = [];
    this.zoneGeo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
    this.trapGeo = (() => {
      const parts = [];
      for (let i = 0; i < 3; i++) parts.push(paint(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6).rotateZ(Math.PI / 2).translate(0, 0.12 + (i === 2 ? 0.17 : 0), (i === 2 ? 0 : i - 0.5) * 0.2), C('#c8281e')));
      return parts;
    })();
  }

  // ── bullets ──
  shoot(o) {
    if (this.bullets.length >= MAX_B) return;
    const s = Math.sin(o.angle), c = Math.cos(o.angle);
    this.bullets.push({
      x: o.x, z: o.z, y: o.y ?? 0.7, vx: s * o.speed, vz: c * o.speed, angle: o.angle, left: o.range ?? 18,
      dmg: o.dmg, pierce: o.pierce ?? 0, bounce: o.bounce ?? 0, size: o.size ?? 1, color: o.color ?? '#ffe38a',
      ability: o.ability, hit: new Set(), explode: o.explode, knock: o.knock ?? 0.8, speed: o.speed,
    });
    this.run.fx.muzzle(o.x, o.y ?? 0.7, o.z);
  }

  enemyShot(o) {
    if (this.eshots.length >= MAX_E) return;
    this.eshots.push({ x: o.x, z: o.z, y: o.y ?? 1, vx: Math.sin(o.angle) * o.speed, vz: Math.cos(o.angle) * o.speed, life: 4, dmg: o.dmg, color: o.color ?? '#fff', size: o.size ?? 0.25, src: o.src });
  }

  lob(o) {
    const p = this.run.player;
    this.lobs.push({ x0: o.x ?? p.x, z0: o.z ?? p.z, tx: o.tx, tz: o.tz, t: 0, dur: o.dur ?? 0.7, kind: o.kind, onLand: o.onLand, small: o.small, h: o.small ? 1.5 : 3.2 });
  }

  zone(o) {
    const color = o.kind === 'fire' ? '#ff6a1a' : o.kind === 'cement' ? '#9c978c' : '#888';
    const mesh = new THREE.Mesh(this.zoneGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false }));
    mesh.position.set(o.x, 0.07, o.z);
    mesh.scale.setScalar(o.r);
    this.scene.add(mesh);
    this.zones.push({ ...o, t: 0, tick: 0, mesh });
  }

  trap(o) {
    const g = new THREE.Group();
    for (const geo of this.trapGeo) g.add(new THREE.Mesh(geo, MATS.flat));
    g.position.set(o.x, 0, o.z);
    g.rotation.y = rand(0, TAU);
    this.scene.add(g);
    this.traps.push({ ...o, mesh: g, arm: 0.6, t: 0 });
  }

  car(o) {
    const mesh = new THREE.Mesh(propGeometry('car'), MATS.flat);
    const s = Math.sin(o.angle), c = Math.cos(o.angle);
    const len = 30;
    const x0 = o.x - s * len, z0 = o.z - c * len;
    mesh.position.set(x0, 0, z0);
    mesh.rotation.y = o.angle;
    this.scene.add(mesh);
    this.cars.push({ ...o, mesh, x: x0, z: z0, vx: s * 42, vz: c * 42, left: len * 2, hit: new Set() });
    sfx('car', 0.2);
  }

  orbit(o) {
    this.orbits.push({ ...o, t: 0, angle: rand(0, TAU), hitT: new Map() });
  }

  mark(mob, delay, cb) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 4, 16), new THREE.MeshBasicMaterial({ color: '#ff2020' }));
    const cross = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.06), mesh.material);
    const cross2 = cross.clone();
    cross2.rotation.z = Math.PI / 2;
    mesh.add(cross, cross2);
    this.scene.add(mesh);
    this.marks.push({ mob, t: delay, cb, mesh });
  }

  spawnGoon(o) {
    const model = createHeroModel('goon');
    const p = this.run.player;
    const a = rand(0, TAU);
    const g = { ...o, model, x: p.x + Math.sin(a) * 2, z: p.z + Math.cos(a) * 2, facing: 0, atkT: 0, swing: 0, target: null };
    model.root.scale.setScalar(o.permanent ? 1.05 : 0.95);
    model.root.position.set(g.x, 0, g.z);
    this.scene.add(model.root);
    this.goons.push(g);
    this.run.fx.burst(g.x, 0.6, g.z, '#ffffff', 10, 3);
    return g;
  }

  // ── update ──
  update(dt) {
    const run = this.run;
    const mobs = run.mobs;

    // player bullets
    let n = 0;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const step = b.speed * dt;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.left -= step;
      let dead = b.left <= 0 || run.world.solidAt(b.x, b.z);
      if (!dead) {
        const r = 0.25 * b.size;
        mobs.each(b.x, b.z, r, (m) => {
          if (dead || b.hit.has(m.id)) return;
          b.hit.add(m.id);
          run.hit(m, b.dmg, b.ability, { knock: b.knock, fromX: b.x - b.vx, fromZ: b.z - b.vz });
          if (b.explode) run.explode(b.x, b.z, b.explode.r, b.dmg * b.explode.dmg, b.ability, { small: true });
          if (b.pierce > 0) { b.pierce--; return; }
          if (b.bounce > 0) {
            b.bounce--;
            let best = null, bd = 64;
            mobs.each(b.x, b.z, 8, (o) => {
              if (b.hit.has(o.id)) return;
              const d = (o.x - b.x) ** 2 + (o.z - b.z) ** 2;
              if (d < bd) { bd = d; best = o; }
            });
            if (best) {
              b.angle = Math.atan2(best.x - b.x, best.z - b.z);
              b.vx = Math.sin(b.angle) * b.speed;
              b.vz = Math.cos(b.angle) * b.speed;
              b.left = 10;
              return;
            }
          }
          dead = true;
        });
      }
      if (dead) { this.bullets[i] = this.bullets[this.bullets.length - 1]; this.bullets.pop(); continue; }
      _e.set(0, b.angle, 0);
      _q.setFromEuler(_e);
      _m.compose(_v.set(b.x, b.y, b.z), _q, _s.set(b.size, b.size, b.size * (b.size > 1.5 ? 1.6 : 1)));
      this.bMesh.setMatrixAt(n, _m);
      this.bMesh.setColorAt(n, _c.set(b.color));
      n++;
    }
    this.bMesh.count = n;
    this.bMesh.instanceMatrix.needsUpdate = true;
    this.bMesh.instanceColor.needsUpdate = true;

    // enemy shots
    const p = run.player;
    n = 0;
    for (let i = this.eshots.length - 1; i >= 0; i--) {
      const s = this.eshots[i];
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.life -= dt;
      let dead = s.life <= 0 || run.world.solidAt(s.x, s.z);
      if (!dead && Math.hypot(s.x - p.x, s.z - p.z) < p.radius + s.size) {
        run.hurtPlayer(s.dmg, s.src);
        dead = true;
      }
      if (dead) { this.eshots[i] = this.eshots[this.eshots.length - 1]; this.eshots.pop(); continue; }
      const pulse = s.size * (1 + Math.sin(run.time * 20 + i) * 0.15);
      _m.makeScale(pulse, pulse, pulse).setPosition(s.x, s.y, s.z);
      this.eMesh.setMatrixAt(n, _m);
      this.eMesh.setColorAt(n, _c.set(s.color));
      n++;
    }
    this.eMesh.count = n;
    this.eMesh.instanceMatrix.needsUpdate = true;
    this.eMesh.instanceColor.needsUpdate = true;

    // lobbed throwables
    n = 0;
    for (let i = this.lobs.length - 1; i >= 0; i--) {
      const l = this.lobs[i];
      l.t += dt;
      const k = Math.min(1, l.t / l.dur);
      const x = l.x0 + (l.tx - l.x0) * k, z = l.z0 + (l.tz - l.z0) * k;
      const y = 0.8 * (1 - k) + Math.sin(k * Math.PI) * l.h + 0.2;
      if (k >= 1) {
        this.lobs.splice(i, 1);
        l.onLand(l.tx, l.tz);
        continue;
      }
      _e.set(l.t * 9, l.t * 5, 0);
      _q.setFromEuler(_e);
      const sc = l.small ? 0.6 : 1;
      _m.compose(_v.set(x, y, z), _q, _s.set(sc, sc * (l.kind === 'molotov' ? 1.8 : 1), sc));
      this.lMesh.setMatrixAt(n, _m);
      this.lMesh.setColorAt(n, _c.set(LOB_COLORS[l.kind] ?? '#888'));
      n++;
      if (l.kind === 'molotov' && Math.random() < 0.5) run.fx.burst(x, y, z, '#ff9a2a', 1, 0.5, 0.25, 0.6, 0);
    }
    this.lMesh.count = n;
    this.lMesh.instanceMatrix.needsUpdate = true;
    this.lMesh.instanceColor.needsUpdate = true;

    // zones
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const zn = this.zones[i];
      zn.t += dt;
      const fade = Math.min(1, (zn.life - zn.t) / 0.4);
      zn.mesh.material.opacity = 0.4 * fade + (zn.kind === 'fire' ? Math.sin(run.time * 18 + i) * 0.06 : 0);
      if (zn.slow) mobs.each(zn.x, zn.z, zn.r, (m) => { m.zoneSlow = Math.max(m.zoneSlow, m.tier >= 2 ? zn.slow * 0.4 : zn.slow); });
      if (zn.dps) {
        zn.tick -= dt;
        if (zn.tick <= 0) {
          zn.tick = 0.5;
          mobs.each(zn.x, zn.z, zn.r, (m) => run.hit(m, zn.dps * 0.5, zn.ability, { noCrit: true, isBurn: true, color: '#ff9a3d' }));
        }
        if (Math.random() < dt * 14 * zn.r) {
          const a = rand(0, TAU), r = Math.sqrt(Math.random()) * zn.r;
          run.fx.burst(zn.x + Math.sin(a) * r, 0.2, zn.z + Math.cos(a) * r, Math.random() < 0.5 ? '#ff7a1a' : '#ffd23f', 1, 1.2, 0.5, 1, -3);
        }
      }
      if (zn.t >= zn.life) { this.scene.remove(zn.mesh); zn.mesh.material.dispose(); this.zones.splice(i, 1); }
    }

    // traps
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const t = this.traps[i];
      t.t += dt;
      t.arm -= dt;
      t.mesh.position.y = Math.abs(Math.sin(t.t * 6)) * 0.05;
      if (Math.random() < dt * 8) run.fx.burst(t.x, 0.45, t.z, '#ffd23f', 1, 1, 0.3, 0.5, 0);
      if (t.arm <= 0 && mobs.count(t.x, t.z, t.trigger) > 0) {
        this.scene.remove(t.mesh);
        this.traps.splice(i, 1);
        t.onTrigger(t.x, t.z);
      }
    }

    // cars
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      c.left -= Math.hypot(c.vx, c.vz) * dt;
      c.mesh.position.set(c.x, Math.abs(Math.sin(c.left)) * 0.06, c.z);
      mobs.each(c.x, c.z, c.width * 0.75, (m) => {
        if (c.hit.has(m.id)) return;
        c.hit.add(m.id);
        // fling sideways off the hood
        const side = Math.sign((m.x - c.x) * c.vz - (m.z - c.z) * c.vx) || 1;
        run.hit(m, c.dmg, c.ability, { knock: 10, fromX: m.x - c.vz * side, fromZ: m.z + c.vx * side });
      });
      if (Math.random() < 0.5) run.fx.burst(c.x - c.vx * 0.05, 0.3, c.z - c.vz * 0.05, '#777', 1, 1, 0.5, 1.2, -1);
      if (c.left <= 0) { this.scene.remove(c.mesh); this.cars.splice(i, 1); }
    }

    // orbiting cash
    n = 0;
    for (let i = this.orbits.length - 1; i >= 0; i--) {
      const o = this.orbits[i];
      o.t += dt;
      o.angle += dt * 3.6;
      if (o.t >= o.life) { this.orbits.splice(i, 1); continue; }
      const grow = Math.min(1, o.t * 4, (o.life - o.t) * 4);
      const dmg = o.ability.stat('damage');
      for (let k = 0; k < o.count; k++) {
        const a = o.angle + (k / o.count) * TAU;
        const x = p.x + Math.sin(a) * o.r * grow, z = p.z + Math.cos(a) * o.r * grow;
        mobs.each(x, z, 0.7, (m) => {
          const last = o.hitT.get(m.id) ?? -9;
          if (run.time - last < 0.45) return;
          o.hitT.set(m.id, run.time);
          run.hit(m, dmg, o.ability, { knock: 3, fromX: p.x, fromZ: p.z });
        });
        if (n < MAX_O) {
          _e.set(0, a + run.time * 4, 0.3);
          _q.setFromEuler(_e);
          _m.compose(_v.set(x, 0.8 + Math.sin(run.time * 5 + k) * 0.15, z), _q, _s.set(grow, grow, grow));
          this.oMesh.setMatrixAt(n++, _m);
        }
        if (Math.random() < dt * 3) run.fx.burst(x, 0.8, z, '#7be495', 1, 1.5, 0.6, 0.7, 2);
      }
    }
    this.oMesh.count = n;
    this.oMesh.instanceMatrix.needsUpdate = true;

    // hit-contract marks
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const mk = this.marks[i];
      mk.t -= dt;
      const m = mk.mob;
      mk.mesh.position.set(m.x, m.height + 0.8, m.z);
      mk.mesh.rotation.set(-0.9, 0, run.time * 3);
      mk.mesh.scale.setScalar(1 + Math.max(0, mk.t) * 0.8);
      if (mk.t <= 0 || m.dead) {
        this.scene.remove(mk.mesh);
        this.marks.splice(i, 1);
        if (mk.t <= 0) mk.cb();
      }
    }

    this.updateGoons(dt);
  }

  updateGoons(dt) {
    const run = this.run, p = run.player;
    for (let i = this.goons.length - 1; i >= 0; i--) {
      const g = this.goons[i];
      if (!g.permanent) {
        g.life -= dt;
        if (g.life <= 0) {
          run.fx.burst(g.x, 0.6, g.z, '#ffffff', 10, 3);
          this.scene.remove(g.model.root);
          this.goons.splice(i, 1);
          continue;
        }
      }
      if (!g.target || g.target.dead || Math.hypot(g.target.x - p.x, g.target.z - p.z) > 14) {
        g.target = run.mobs.target(g.x, g.z, 10, 'nearest');
      }
      let tx, tz, moving = false;
      if (g.target) { tx = g.target.x; tz = g.target.z; } else {
        const side = (i % 2 ? 1 : -1) * 1.8;
        tx = p.x + Math.cos(p.facing) * side - Math.sin(p.facing) * 1.5;
        tz = p.z - Math.sin(p.facing) * side - Math.cos(p.facing) * 1.5;
      }
      const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz);
      const reach = g.target ? g.target.radius + 0.9 : 0.6;
      if (d > reach) {
        const sp = 7.5 * Math.min(1, d / 2);
        g.x += (dx / d) * sp * dt;
        g.z += (dz / d) * sp * dt;
        moving = true;
      }
      if (d > 0.1) g.facing = Math.atan2(dx, dz);
      g.atkT -= dt;
      g.swing = Math.max(0, g.swing - dt * 4);
      if (g.target && d <= reach + 0.2 && g.atkT <= 0) {
        g.atkT = 0.65;
        g.swing = 1;
        const dmg = g.permanent ? 18 * run.stats.dmg * (1 + (run.abilityById('goon')?.inc.damage ?? 0)) : g.ability.stat('damage');
        run.hit(g.target, dmg, g.ability ?? { def: { id: 'godfather', tags: [] } }, { knock: 4, fromX: g.x, fromZ: g.z });
      }
      run.world.collide(g, 0.4);
      g.model.root.position.set(g.x, 0, g.z);
      g.model.root.rotation.y = g.facing;
      g.model.animator.update(dt, { move: moving ? 1 : 0, aiming: g.swing > 0, shoot: g.swing, hurt: 0, dead: false });
    }
  }

  dispose() {
    for (const k of ['bMesh', 'eMesh', 'lMesh', 'oMesh']) this.scene.remove(this[k]);
    for (const z of this.zones) this.scene.remove(z.mesh);
    for (const t of this.traps) this.scene.remove(t.mesh);
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const m of this.marks) this.scene.remove(m.mesh);
    for (const g of this.goons) this.scene.remove(g.model.root);
  }
}
