import * as THREE from 'three';
import { propGeometry, MATS, createHeroModel } from '../assets/models.js';
import { zoneTexture, ZONE_LOOK } from './zoneTex.js';
import { rand, TAU, paint, C } from '../util.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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

/**
 * Aura models (full colour; instance colour stays white). `face`: point along the
 * orbit instead of tumbling. Every model is built around the origin, ~0.8m across.
 */
const AURA_MODELS = {
  cash() {
    const g = C('#3d8a4a'), g2 = C('#5fb06a'), band = C('#f2e6c4'), ink = C('#1f4f2a');
    const parts = [];
    for (let i = 0; i < 4; i++) parts.push(paint(new THREE.BoxGeometry(0.62, 0.06, 0.3).translate((i % 2) * 0.03 - 0.015, i * 0.065, (i % 3) * 0.02 - 0.02), i % 2 ? g : g2, 0.04));
    parts.push(paint(new THREE.BoxGeometry(0.14, 0.28, 0.32).translate(0, 0.1, 0), band, 0.02));
    parts.push(paint(new THREE.BoxGeometry(0.12, 0.01, 0.1).translate(0.2, 0.235, 0), ink, 0));
    parts.push(paint(new THREE.BoxGeometry(0.12, 0.01, 0.1).translate(-0.2, 0.235, 0), ink, 0));
    // a loose bill fluttering on top
    parts.push(paint(new THREE.BoxGeometry(0.6, 0.015, 0.28).rotateY(0.5).rotateZ(0.2).translate(0.05, 0.32, 0), g2, 0.03));
    return mergeGeometries(parts).translate(0, -0.12, 0);
  },
  glove() {
    const red = C('#d42a22'), dark = C('#8a1812'), white = C('#f4f0e6'), lace = C('#f2f2f2');
    return mergeGeometries([
      paint(new THREE.SphereGeometry(0.3, 12, 10).scale(1, 0.95, 1.15).translate(0, 0, 0.12), red, 0.04), // fist
      paint(new THREE.SphereGeometry(0.13, 10, 8).scale(1, 1, 1.5).translate(0.24, -0.05, 0.08), red, 0.04), // thumb
      paint(new THREE.BoxGeometry(0.42, 0.05, 0.2).translate(0, 0.27, 0.12), dark, 0.02), // knuckle seam
      paint(new THREE.CylinderGeometry(0.2, 0.22, 0.32, 12).rotateX(Math.PI / 2).translate(0, -0.02, -0.22), red, 0.04), // cuff
      paint(new THREE.CylinderGeometry(0.225, 0.225, 0.08, 12).rotateX(Math.PI / 2).translate(0, -0.02, -0.38), white, 0.02), // cuff band
      paint(new THREE.BoxGeometry(0.04, 0.03, 0.26).translate(0, 0.2, -0.22), lace, 0),
      paint(new THREE.BoxGeometry(0.16, 0.03, 0.03).translate(0, 0.2, -0.16), lace, 0),
      paint(new THREE.BoxGeometry(0.16, 0.03, 0.03).translate(0, 0.2, -0.27), lace, 0),
      // the string back to the hero
      paint(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4).rotateX(Math.PI / 2).translate(0, 0, -0.85), C('#c8b088'), 0),
    ]); // +Z (the fist) points away from the hero
  },
  shuriken() {
    const steel = C('#c9d2dc'), edge = C('#f4f8ff'), dark = C('#3a3f4a');
    const parts = [paint(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 12), steel, 0.02), paint(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8), dark, 0)];
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.ConeGeometry(0.11, 0.42, 3).rotateZ(-Math.PI / 2).scale(1, 0.25, 1).translate(0.3, 0, 0);
      parts.push(paint(blade.rotateY((i / 4) * TAU), (p) => (Math.hypot(p.x, p.z) > 0.36 ? edge : steel), 0.02));
    }
    return mergeGeometries(parts);
  },
  drone() {
    const body = C('#3a3f4a'), arm = C('#6a7080'), rotor = C('#c8d0dc'), cam = C('#111'), led = C('#ff3b3b'), led2 = C('#5dff9a');
    const parts = [
      paint(new THREE.BoxGeometry(0.28, 0.1, 0.34), body, 0.03),
      paint(new THREE.BoxGeometry(0.2, 0.05, 0.22).translate(0, 0.07, 0), C('#9aa4b4'), 0.02),
      paint(new THREE.SphereGeometry(0.07, 8, 6).translate(0, -0.07, 0.14), cam, 0),
      paint(new THREE.BoxGeometry(0.04, 0.04, 0.04).translate(0.08, 0.02, 0.18), led2, 0),
      paint(new THREE.BoxGeometry(0.04, 0.04, 0.04).translate(-0.08, 0.02, 0.18), led, 0),
    ];
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      parts.push(paint(new THREE.BoxGeometry(0.05, 0.04, 0.36).rotateY(Math.atan2(x, z)).translate(x * 0.13, 0, z * 0.13), arm, 0));
      parts.push(paint(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 6).translate(x * 0.25, 0.04, z * 0.25), body, 0));
      parts.push(paint(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 14).translate(x * 0.25, 0.09, z * 0.25), rotor, 0.04));
      parts.push(paint(new THREE.BoxGeometry(0.3, 0.015, 0.03).rotateY(x * z * 0.6).translate(x * 0.25, 0.1, z * 0.25), C('#2a2a2a'), 0));
    }
    return mergeGeometries(parts).scale(1.5, 1.5, 1.5);
  },
};
const AURA_MOTION = { cash: 'tumble', glove: 'radial', shuriken: 'flat', drone: 'face' };

const LOB_COLORS = { grenade: '#4f7d2f', molotov: '#d9a441', cement: '#a9a49a', dynamite: '#c8281e', bottle: '#3a8f4a', pipe: '#8a8f99', pudding: '#e8b86b', gas: '#7fc24a', smoke: '#555a60', c4: '#e8e2cf', firework: '#ff4fa3', slime: '#7dff7a', knife: '#c9d2dc' };
const ZONE_COLORS = { fire: '#ff6a1a', cement: '#9c978c', gas: '#7fc24a', ice: '#8fd8ff', smoke: '#6b6f78', slime: '#62e05a', void: '#5a2a8a', glass: '#bfe8d0' };

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
    this.oMesh = inst(paint(new THREE.BoxGeometry(0.7, 0.3, 0.45), C('#ffffff')), MATS.flat, MAX_O);
    this.auraMeshes = {}; // model -> InstancedMesh (made on first use)
    this.inst = inst;
    this.zones = [];
    this.traps = [];
    this.cars = [];
    this.marks = [];
    this.goons = [];
    this.decoys = []; // cardboard cut-outs thugs walk to and beat on instead of you
    this.decoyPool = [];
    this.shadows = []; // shadow copies of the hero that do dashes (the real hero stays put)
    this.shadowPool = [];
    this.shadowMat = new THREE.MeshBasicMaterial({ color: '#2a1840', transparent: true, opacity: 0.6, depthWrite: false });
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
      ability: o.ability, hit: new Set(), explode: o.explode, knock: o.knock ?? 0.8, speed: o.speed, onHit: o.onHit,
    });
    this.run.fx.muzzle(o.x, o.y ?? 0.7, o.z);
  }

  enemyShot(o) {
    if (this.eshots.length >= MAX_E) return;
    this.eshots.push({ x: o.x, z: o.z, y: o.y ?? 1, vx: Math.sin(o.angle) * o.speed, vz: Math.cos(o.angle) * o.speed, life: 4, dmg: o.dmg, color: o.color ?? '#fff', size: o.size ?? 0.25, src: o.src });
  }

  lob(o) {
    const p = this.run.player;
    if (this.lobs.length >= MAX_L) return o.onLand(o.tx, o.tz);
    this.lobs.push({ x0: o.x ?? p.x, z0: o.z ?? p.z, tx: o.tx, tz: o.tz, t: 0, dur: o.dur ?? 0.7, kind: o.kind, onLand: o.onLand, small: o.small, h: o.h ?? (o.small ? 1.5 : 3.2), color: o.color });
  }

  zone(o) {
    const color = o.color ?? ZONE_COLORS[o.kind] ?? '#888';
    const map = zoneTexture(o.kind);
    const mesh = new THREE.Mesh(this.zoneGeo, new THREE.MeshBasicMaterial({ color: map && o.kind === 'fire' ? '#ffffff' : color, map, transparent: true, opacity: 0.45, depthWrite: false }));
    mesh.position.set(o.x, 0.07 + (this.zoneY = ((this.zoneY ?? 0) + 0.002) % 0.02), o.z);
    mesh.rotation.y = rand(0, TAU);
    mesh.scale.setScalar(o.r);
    mesh.renderOrder = 1;
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

  /**
   * A shadow copy of the hero dashes from (x, z) along `angle` for `len` over
   * `dur` seconds, then fades. Used for charges so the player never loses control.
   * onStep(x, z, k) runs every frame with progress k (0..1).
   */
  shadow({ x, z, angle, len, dur = 0.28, onStep, color }) {
    let model = this.shadowPool.pop();
    if (!model) {
      model = createHeroModel(this.run.hero.model);
      model.root.scale.setScalar(1.15);
      model.root.traverse((o) => { if (o.isMesh) { o.material = this.shadowMat; o.renderOrder = 2; } });
    }
    model.root.visible = true;
    this.scene.add(model.root);
    this.shadows.push({ model, x0: x, z0: z, angle, len, dur, t: 0, onStep, color: color ?? '#8a5ac8' });
  }

  /**
   * A flat cardboard cut-out of the hero on a stand. Thugs within `lure` of it
   * walk over and beat on it instead of you (bosses don't fall for it). When its
   * time is up it explodes (onEnd).
   */
  decoy({ x, z, life, lure = 9, ability, onEnd }) {
    let d = this.decoyPool.pop();
    if (!d) {
      const g = new THREE.Group();
      const model = createHeroModel(this.run.hero.model);
      model.root.scale.set(1.15, 1.15, 0.12); // pressed flat: printed cardboard
      model.root.position.z = 0.08;
      g.add(model.root);
      const brown = C('#b88a52'), dark = C('#8a6234');
      const back = mergeGeometries([
        paint(new THREE.BoxGeometry(1.25, 1.75, 0.05).translate(0, 0.95, 0), brown, 0.06), // board behind the print
        paint(new THREE.BoxGeometry(0.08, 1.2, 0.7).rotateX(-0.5).translate(0, 0.55, -0.32), dark, 0.05), // easel leg
        paint(new THREE.BoxGeometry(1.3, 0.06, 0.5).translate(0, 0.03, -0.05), dark, 0.05), // base
      ]);
      g.add(new THREE.Mesh(back, MATS.flat));
      // a dashed ring shows how far it lures
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 48, 1).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#ffd98a', transparent: true, opacity: 0.35, depthWrite: false }));
      ring.position.y = 0.06;
      d = { g, ring };
    }
    d.g.position.set(x, 0, z);
    d.g.rotation.set(0, Math.atan2(this.run.camera.position.x - x, this.run.camera.position.z - z), 0); // face the camera
    d.ring.position.set(x, 0.06, z);
    d.ring.scale.setScalar(lure);
    this.scene.add(d.g, d.ring);
    Object.assign(d, { x, z, life, lure, ability, onEnd, t: 0, hitT: 0, radius: 0.5 });
    this.decoys.push(d);
    return d;
  }

  /** A thug landed a hit on a decoy: it wobbles and sheds cardboard. */
  hitDecoy(d) {
    d.hitT = 0.25;
    this.run.fx.burst(d.x, 1, d.z, '#c8a060', 2, 2.5, 0.35, 0.8);
  }

  /** Keep an always-on aura (def.aura) spinning for ability `a`; its count/radius follow the ability's stats. */
  aura(a) {
    let o = this.orbits.find((q) => q.ability === a);
    if (!o) {
      o = { ...a.def.aura, ability: a, life: Infinity, aura: true, t: 0, angle: rand(0, TAU), hitT: new Map() };
      this.orbits.push(o);
    }
    o.count = a.stat('count');
    o.r = a.stat('area');
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
    const model = createHeroModel(o.model ?? 'goon');
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
      // fast bullets move in sub-steps so they can't tunnel through small mobs
      const subs = Math.max(1, Math.ceil((b.speed * dt) / 0.7));
      let dead = false;
      for (let sub = 0; sub < subs && !dead; sub++) {
      const h = dt / subs;
      b.x += b.vx * h;
      b.z += b.vz * h;
      b.left -= b.speed * h;
      dead = b.left <= 0 || run.world.solidAt(b.x, b.z, 0, b.y);
      if (!dead) {
        const r = 0.25 * b.size;
        mobs.each(b.x, b.z, r, (m) => {
          if (dead || b.hit.has(m.id)) return;
          b.hit.add(m.id);
          run.hit(m, b.dmg, b.ability, { knock: b.knock, fromX: b.x - b.vx, fromZ: b.z - b.vz });
          if (b.explode) run.explode(b.x, b.z, b.explode.r, b.dmg * b.explode.dmg, b.ability, { small: true, color: b.explode.color });
          b.onHit?.(m, b);
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
      let dead = s.life <= 0 || run.world.solidAt(s.x, s.z, 0, s.y);
      // vertical overlap: jump over shots, but standing on a car doesn't make you safe
      if (!dead && Math.abs(s.y - (p.y + 0.6)) < 1.1 + s.size && Math.hypot(s.x - p.x, s.z - p.z) < p.radius + s.size) {
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
      this.lMesh.setColorAt(n, _c.set(l.color ?? LOB_COLORS[l.kind] ?? '#888'));
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
      const look = ZONE_LOOK[zn.kind];
      const base = zn.mesh.material.map ? 0.88 : 0.4;
      zn.mesh.material.opacity = base * fade + (zn.kind === 'fire' ? Math.sin(run.time * 18 + i) * 0.08 : 0);
      if (look) {
        zn.mesh.rotation.y += look.spin * dt;
        // splat in, then a slow breathing wobble for gooey stuff
        const grow = look.splat ? Math.min(1, 0.55 + zn.t * 4) : Math.min(1, 0.3 + zn.t * 3);
        const wob = zn.kind === 'slime' ? 1 + Math.sin(run.time * 4 + i) * 0.025 : 1;
        zn.mesh.scale.set(zn.r * grow * wob, 1, zn.r * grow / wob);
        if (look.bubble && Math.random() < dt * 5 * zn.r) {
          const a = rand(0, TAU), r = Math.sqrt(Math.random()) * zn.r * 0.9;
          run.fx.burst(zn.x + Math.sin(a) * r, 0.15, zn.z + Math.cos(a) * r, zn.mesh.material.color.getStyle(), 2, 1.2, 0.35, 0.8, 6);
        }
        if (look.puff && Math.random() < dt * 3 * zn.r) {
          const a = rand(0, TAU), r = Math.sqrt(Math.random()) * zn.r * 0.8;
          run.fx.burst(zn.x + Math.sin(a) * r, 0.4, zn.z + Math.cos(a) * r, zn.mesh.material.color.getStyle(), 1, 0.6, 1.1, 2.2, -1.2);
        }
        if (look.inward && Math.random() < dt * 10) {
          const a = rand(0, TAU);
          run.fx.burst(zn.x + Math.sin(a) * zn.r, 0.3, zn.z + Math.cos(a) * zn.r, '#c08cff', 1, 0.3, 0.5, 0.8, 0);
        }
      }
      if (zn.slow) mobs.each(zn.x, zn.z, zn.r, (m) => { m.zoneSlow = Math.max(m.zoneSlow, m.tier >= 2 ? zn.slow * 0.4 : zn.slow); });
      if (zn.pull) mobs.each(zn.x, zn.z, zn.r, (m) => {
        if (m.tier >= 2) return;
        const dx = zn.x - m.x, dz = zn.z - m.z, d = Math.hypot(dx, dz) || 1;
        if (d > 0.6) { m.x += (dx / d) * zn.pull * dt * (m.tier ? 0.4 : 1); m.z += (dz / d) * zn.pull * dt * (m.tier ? 0.4 : 1); }
      });
      if (zn.follow) { zn.x = run.player.x; zn.z = run.player.z; zn.mesh.position.set(zn.x, 0.07, zn.z); }
      zn.onTick?.(zn, dt);
      if (zn.dps) {
        zn.tick -= dt;
        if (zn.tick <= 0) {
          zn.tick = 0.5;
          mobs.each(zn.x, zn.z, zn.r, (m) => run.hit(m, zn.dps * 0.5, zn.ability, { noCrit: true, isBurn: zn.kind === 'fire', color: zn.kind === 'fire' ? '#ff9a3d' : '#cfe' }));
        }
        if (zn.kind === 'fire' && Math.random() < dt * 14 * zn.r) {
          const a = rand(0, TAU), r = Math.sqrt(Math.random()) * zn.r;
          run.fx.burst(zn.x + Math.sin(a) * r, 0.2, zn.z + Math.cos(a) * r, Math.random() < 0.5 ? '#ff7a1a' : '#ffd23f', 1, 1.2, 0.5, 1, -3);
        }
      }
      if (zn.t >= zn.life) { this.scene.remove(zn.mesh); zn.mesh.material.dispose(); this.zones.splice(i, 1); }
    }

    // traps
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const t = this.traps[i];
      if (!t) continue; // a trigger (chain reactions) can remove other traps mid-loop
      t.t += dt;
      t.arm -= dt;
      t.mesh.position.y = Math.abs(Math.sin(t.t * 6)) * 0.05;
      if (Math.random() < dt * 8) run.fx.burst(t.x, 0.45, t.z, '#ffd23f', 1, 1, 0.3, 0.5, 0);
      if (t.arm <= 0 && mobs.count(t.x, t.z, t.trigger) > 0) {
        this.scene.remove(t.mesh);
        this.traps.splice(i, 1);
        if (run.stats.trapRoot) for (const m of mobs.near(t.x, t.z, t.trigger * 2.2)) m.rootT = Math.max(m.rootT, m.tier >= 2 ? 0.25 : run.stats.trapRoot);
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
      if (c.left <= 0) {
        if (run.stats.nitro && c.ability) run.explode(c.x - c.vx * 0.4, c.z - c.vz * 0.4, 3.2, c.dmg * run.stats.nitro, c.ability);
        this.scene.remove(c.mesh);
        this.cars.splice(i, 1);
      }
    }

    // orbits / auras (cash, gloves, stars, drones; plain boxes for anything else)
    n = 0;
    const used = {};
    for (let i = this.orbits.length - 1; i >= 0; i--) {
      const o = this.orbits[i];
      o.t += dt;
      o.angle += dt * 3.6;
      if (o.t >= o.life) { this.orbits.splice(i, 1); continue; }
      const grow = o.aura ? Math.min(1, o.t * 2) : Math.min(1, o.t * 4, (o.life - o.t) * 4);
      const dmg = o.ability.stat('damage');
      const spin = o.spin ?? 3.6;
      o.angle += dt * (spin - 3.6);
      let mesh = this.oMesh, motion = 'tumble';
      if (o.model && AURA_MODELS[o.model]) {
        mesh = this.auraMeshes[o.model] ??= this.inst(AURA_MODELS[o.model](), MATS.flat, MAX_O);
        motion = AURA_MOTION[o.model];
      }
      for (let k = 0; k < o.count; k++) {
        const a = o.angle + (k / o.count) * TAU;
        const x = p.x + Math.sin(a) * o.r * grow, z = p.z + Math.cos(a) * o.r * grow;
        mobs.each(x, z, 0.7, (m) => {
          const last = o.hitT.get(m.id) ?? -9;
          if (run.time - last < 0.45) return;
          o.hitT.set(m.id, run.time);
          run.hit(m, dmg, o.ability, { knock: o.knock ?? 3, fromX: p.x, fromZ: p.z });
          o.onHit?.(m);
        });
        const c = used[mesh.uuid] ?? 0;
        if (c < MAX_O) {
          const bob = Math.sin(run.time * 5 + k) * 0.15;
          if (motion === 'face') _e.set(Math.sin(run.time * 3 + k) * 0.15, a + (spin >= 0 ? Math.PI / 2 : -Math.PI / 2), Math.sign(spin) * -0.35, 'YXZ');
          else if (motion === 'radial') _e.set(0.1, a, Math.sin(run.time * 6 + k) * 0.2);
          else if (motion === 'flat') _e.set(0.25, run.time * 14 + k, 0);
          else _e.set(0, a + run.time * 4, 0.3);
          _q.setFromEuler(_e);
          _e.order = 'XYZ';
          _m.compose(_v.set(x, (motion === 'flat' ? 0.9 : 0.8) + bob, z), _q, _s.set(grow, grow, grow));
          if (mesh === this.oMesh) mesh.setColorAt(c, _c.set(o.color ?? '#3da35a'));
          mesh.setMatrixAt(c, _m);
          used[mesh.uuid] = c + 1;
        }
        if (Math.random() < dt * 3) run.fx.burst(x, 0.8, z, o.spark ?? '#7be495', 1, 1.5, 0.6, 0.7, 2);
      }
    }
    for (const mesh of [this.oMesh, ...Object.values(this.auraMeshes)]) {
      mesh.count = used[mesh.uuid] ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // cardboard decoys
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const d = this.decoys[i];
      d.t += dt;
      d.hitT = Math.max(0, d.hitT - dt);
      d.g.rotation.z = d.hitT > 0 ? Math.sin(d.t * 50) * 0.12 : 0;
      d.ring.material.opacity = 0.2 + 0.15 * Math.sin(d.t * 4);
      if (d.t >= d.life) {
        this.scene.remove(d.g, d.ring);
        this.decoys.splice(i, 1);
        this.decoyPool.push(d);
        d.onEnd?.(d);
      }
    }

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
        g.target = run.mobs.target(g.x, g.z, g.seek ?? 10, 'nearest');
      }
      let tx, tz, moving = false;
      if (g.target) { tx = g.target.x; tz = g.target.z; } else {
        const side = (i % 2 ? 1 : -1) * 1.8;
        tx = p.x + Math.cos(p.facing) * side - Math.sin(p.facing) * 1.5;
        tz = p.z - Math.sin(p.facing) * side - Math.cos(p.facing) * 1.5;
      }
      const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz);
      const reach = g.target ? g.target.radius + (g.reach ?? 0.9) : 0.6;
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
        g.atkT = g.rate ?? 0.65;
        g.swing = 1;
        const dmg = g.permanent ? 18 * run.stats.dmg * (1 + (run.abilityById('goon')?.inc.damage ?? 0)) : g.ability.stat('damage');
        if (g.onAttack) g.onAttack(g, g.target, dmg);
        else run.hit(g.target, dmg, g.ability ?? { def: { id: 'godfather', tags: [] } }, { knock: 4, fromX: g.x, fromZ: g.z });
      }
      run.world.collide(g, 0.4);
      g.model.root.position.set(g.x, 0, g.z);
      g.model.root.rotation.y = g.facing;
      g.model.animator.update(dt, { move: moving ? 1 : 0, aiming: g.swing > 0, shoot: g.swing, hurt: 0, dead: false });
    }

    // shadow dashes: run out, linger a moment, fade
    for (let i = this.shadows.length - 1; i >= 0; i--) {
      const sh = this.shadows[i];
      sh.t += dt;
      const k = Math.min(1, sh.t / sh.dur);
      const e = 1 - (1 - k) * (1 - k);
      const x = sh.x0 + Math.sin(sh.angle) * sh.len * e, z = sh.z0 + Math.cos(sh.angle) * sh.len * e;
      if (k < 1) sh.onStep?.(x, z, k);
      const root = sh.model.root;
      root.position.set(x, 0, z);
      root.rotation.y = sh.angle;
      sh.model.animator.update(dt, { move: k < 1 ? 1 : 0, aiming: false, shoot: 0, hurt: 0, dead: false, air: false });
      if (Math.random() < dt * 40 && k < 1) run.fx.burst(x, 0.6, z, sh.color, 1, 1.5, 0.4, 0.8, 1);
      if (sh.t > sh.dur + 0.25) {
        this.scene.remove(root);
        this.shadowPool.push(sh.model);
        this.shadows.splice(i, 1);
      }
    }
    // the material is shared, so fade it by the youngest live shadow
    if (this.shadows.length) {
      const age = Math.min(...this.shadows.map((sh) => Math.max(0, sh.t - sh.dur) / 0.25));
      this.shadowMat.opacity = 0.6 * (1 - age);
    }
  }

  dispose() {
    for (const k of ['bMesh', 'eMesh', 'lMesh', 'oMesh']) this.scene.remove(this[k]);
    for (const m of Object.values(this.auraMeshes)) this.scene.remove(m);
    for (const z of this.zones) this.scene.remove(z.mesh);
    for (const d of this.decoys) this.scene.remove(d.g, d.ring);
    for (const t of this.traps) this.scene.remove(t.mesh);
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const m of this.marks) this.scene.remove(m.mesh);
    for (const g of this.goons) this.scene.remove(g.model.root);
    for (const sh of this.shadows) this.scene.remove(sh.model.root);
  }
}
