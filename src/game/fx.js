import * as THREE from 'three';
import { rand, TAU } from '../util.js';

/**
 * Cheap visual effects: instanced particles, expanding rings, explosion
 * flashes, sniper tracers and floating damage numbers (DOM, pooled).
 */
const MAXP = 900;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export class FX {
  constructor(run) {
    this.run = run;
    this.scene = run.scene;
    this.camera = run.camera;
    this.parts = [];
    this.pmesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.12), new THREE.MeshBasicMaterial({ color: '#fff' }), MAXP);
    this.pmesh.frustumCulled = false;
    for (let i = 0; i < MAXP; i++) this.pmesh.setColorAt(i, _c.set(1, 1, 1));
    this.scene.add(this.pmesh);

    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);
    this.flashes = [];
    this.flashGeo = new THREE.IcosahedronGeometry(1, 1);
    this.tracers = [];

    this.numLayer = document.getElementById('dmg-layer');
    this.nums = [];
    this.numPool = [];
  }

  burst(x, y, z, color, n = 8, speed = 4, life = 0.5, size = 1, gravity = 12) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= MAXP) this.parts.shift();
      const a = rand(0, TAU), up = rand(0.3, 1);
      const sp = speed * rand(0.4, 1);
      this.parts.push({
        x, y, z, vx: Math.sin(a) * sp, vy: up * sp, vz: Math.cos(a) * sp, life: life * rand(0.6, 1.2), max: life,
        r: _c.r, g: _c.g, b: _c.b, s: size * rand(0.7, 1.3), rot: rand(0, TAU), grav: gravity,
      });
    }
  }

  smoke(x, y, z) {
    if (this.parts.length >= MAXP) return;
    this.parts.push({ x, y, z, vx: rand(-0.2, 0.2), vy: 0.8, vz: rand(-0.2, 0.2), life: 1.2, max: 1.2, r: 0.7, g: 0.7, b: 0.72, s: 0.8, rot: 0, grav: -0.3, grow: true });
  }

  muzzle(x, y, z) {
    this.burst(x, y, z, '#ffd36b', 3, 3, 0.12, 0.8, 0);
  }

  ring(x, z, r, color, life = 0.4) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.position.set(x, 0.12, z);
    this.scene.add(mesh);
    this.rings.push({ mesh, r, t: 0, life });
  }

  explosion(x, z, r, color = '#ffb347') {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false });
    const mesh = new THREE.Mesh(this.flashGeo, mat);
    mesh.position.set(x, 0.3, z);
    this.scene.add(mesh);
    this.flashes.push({ mesh, r, t: 0, life: 0.28 });
    this.burst(x, 0.5, z, color, 10 + r * 3, r * 2.2, 0.55, 1.4);
    this.burst(x, 0.5, z, '#555', 6, r * 1.2, 0.8, 1.6, 2);
    this.ring(x, z, r, color, 0.3);
  }

  telegraphPop(t) {
    if (t.shape === 'circle') this.burst(t.x, 0.3, t.z, '#ff5030', 10, 5, 0.4);
    else if (t.shape === 'donut') this.ring(t.x, t.z, t.outer, '#ff4030', 0.35);
    else {
      const len = t.len ?? 6;
      for (let i = 0; i < 6; i++) {
        const d = (i / 5) * len;
        this.burst(t.x + Math.sin(t.angle) * d, 0.3, t.z + Math.cos(t.angle) * d, '#ff5030', 3, 4, 0.35);
      }
    }
  }

  /** Sniper tracer dropping onto (x, z) from the sky. */
  tracer(x, z) {
    const geo = new THREE.CylinderGeometry(0.06, 0.06, 30, 4).translate(0, 15, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ff4040', transparent: true, opacity: 0.9 }));
    mesh.position.set(x, 0, z);
    mesh.rotation.set(0.5, rand(0, TAU), 0, 'YXZ');
    this.scene.add(mesh);
    this.tracers.push({ mesh, t: 0, life: 0.25 });
  }

  /** Flat beam / laser / slash streak from (x0, z0) to (x1, z1). */
  beam(x0, z0, x1, z1, color = '#9ad8ff', width = 0.25, life = 0.2, y = 0.7) {
    const len = Math.hypot(x1 - x0, z1 - z0) || 0.01;
    const geo = new THREE.BoxGeometry(width, width * 0.5, len);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    mesh.rotation.y = Math.atan2(x1 - x0, z1 - z0);
    this.scene.add(mesh);
    this.tracers.push({ mesh, t: 0, life });
  }

  /** Swipe arc on the ground (melee cones). */
  arc(x, z, angle, r, half, color = '#ffffff', life = 0.18) {
    const geo = new THREE.RingGeometry(r * 0.35, r, 16, 1, -half, half * 2).rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
    mesh.position.set(x, 0.15, z);
    mesh.rotation.y = angle - Math.PI / 2;
    this.scene.add(mesh);
    this.tracers.push({ mesh, t: 0, life });
  }

  number(x, y, z, val, color = '#fff', big = false) {
    if (this.nums.length > 60) return;
    let el = this.numPool.pop();
    if (!el) {
      el = document.createElement('div');
      el.className = 'dmg';
      this.numLayer.appendChild(el);
    }
    el.textContent = typeof val === 'number' ? Math.round(val) : val;
    el.style.color = color;
    el.style.fontSize = big ? '22px' : '15px';
    el.style.display = 'block';
    this.nums.push({ el, x: x + rand(-0.3, 0.3), y, z: z + rand(-0.3, 0.3), t: 0, life: big ? 0.9 : 0.6 });
  }

  update(dt) {
    // particles
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;
      p.rot += dt * 6;
      const k = p.life / p.max;
      const s = p.grow ? p.s * (1.6 - k) : p.s * (0.3 + 0.7 * k);
      _e.set(p.rot, p.rot * 0.7, 0);
      _q.setFromEuler(_e);
      _m.compose(_v.set(p.x, p.y, p.z), _q, _s.set(s, s, s));
      this.pmesh.setMatrixAt(n, _m);
      this.pmesh.setColorAt(n, _c.setRGB(p.r, p.g, p.b));
      n++;
    }
    this.pmesh.count = n;
    this.pmesh.instanceMatrix.needsUpdate = true;
    if (this.pmesh.instanceColor) this.pmesh.instanceColor.needsUpdate = true;

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = r.t / r.life;
      r.mesh.scale.setScalar(r.r * (0.3 + 0.7 * Math.sqrt(k)));
      r.mesh.material.opacity = 0.9 * (1 - k);
      if (k >= 1) { this.scene.remove(r.mesh); r.mesh.material.dispose(); this.rings.splice(i, 1); }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      const k = f.t / f.life;
      f.mesh.scale.set(f.r * (0.4 + 0.6 * k), f.r * 0.6 * (0.4 + 0.6 * k), f.r * (0.4 + 0.6 * k));
      f.mesh.material.opacity = 0.8 * (1 - k);
      if (k >= 1) { this.scene.remove(f.mesh); f.mesh.material.dispose(); this.flashes.splice(i, 1); }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.t += dt;
      t.mesh.material.opacity = 0.9 * (1 - t.t / t.life);
      if (t.t >= t.life) { this.scene.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose(); this.tracers.splice(i, 1); }
    }

    // damage numbers
    const w = innerWidth, h = innerHeight;
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const d = this.nums[i];
      d.t += dt;
      if (d.t >= d.life) {
        d.el.style.display = 'none';
        this.numPool.push(d.el);
        this.nums.splice(i, 1);
        continue;
      }
      _v.set(d.x, d.y + d.t * 1.8, d.z).project(this.camera);
      const k = d.t / d.life;
      d.el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h}px) translate(-50%, -50%) scale(${k < 0.15 ? 0.6 + k * 4 : 1})`;
      d.el.style.opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
    }
  }

  dispose() {
    this.scene.remove(this.pmesh);
    for (const r of this.rings) this.scene.remove(r.mesh);
    for (const f of this.flashes) this.scene.remove(f.mesh);
    for (const t of this.tracers) this.scene.remove(t.mesh);
    for (const d of this.nums) d.el.remove();
    for (const el of this.numPool) el.remove();
  }
}
