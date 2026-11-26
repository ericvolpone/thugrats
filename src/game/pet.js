import * as THREE from 'three';
import { mobGeometry, MATS } from '../assets/models.js';
import { petRange, petSpeed } from '../data/account.js';
import { Save } from '../save.js';

/**
 * Biscuit the bulldog (account Rep unlock). Ignores walls. Runs to any magnet in
 * range first, otherwise the nearest XP gem, coin or goodie within its leash range of the player and "fetches" it — the pickup then
 * flies to the player like anything inside the normal pickup range.
 */
export class Pet {
  constructor(run) {
    this.run = run;
    this.range = petRange(Save.acct('pet_range'));
    this.speed = petSpeed(Save.acct('pet_speed'));
    this.mesh = new THREE.Mesh(mobGeometry('pet_bulldog'), MATS.flat);
    const p = run.player;
    this.x = p.x + 1.5;
    this.z = p.z + 1.5;
    this.facing = 0;
    this.phase = 0;
    this.target = null;
    this.radius = 0.35;
    this.retarget = 0;
    run.scene.add(this.mesh);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.07, depthWrite: false }));
    this.ring.position.y = 0.05;
    run.scene.add(this.ring);
  }

  pickTarget() {
    const run = this.run, p = run.player;
    const r2 = this.range * this.range;
    let best = null, bd = Infinity;
    const consider = (o, bias = 0) => {
      if (o.pull) return;
      const dp = (o.x - p.x) ** 2 + (o.z - p.z) ** 2;
      if (dp > r2) return;
      const d = (o.x - this.x) ** 2 + (o.z - this.z) ** 2 - bias;
      if (d < bd) { bd = d; best = o; }
    };
    for (const g of run.pickups.gems) consider(g, g.v >= 5 ? 20 : 0);
    for (const c of run.pickups.coins) consider(c, 10);
    // magnets first (they bring everything else), then goodies
    for (const s of run.pickups.specials) consider(s, s.kind === 'magnet' ? 1e6 : 60);
    this.target = best;
  }

  update(dt) {
    const run = this.run, p = run.player;
    this.retarget -= dt;
    if (!this.target || this.target.pull || this.retarget <= 0) {
      this.retarget = 0.4;
      this.pickTarget();
    }
    let tx, tz, sp = this.speed;
    if (this.target) {
      tx = this.target.x;
      tz = this.target.z;
    } else {
      // heel: trot a step behind the player
      tx = p.x - Math.sin(p.facing) * 1.6 + 0.8;
      tz = p.z - Math.cos(p.facing) * 1.6;
      sp = Math.max(this.speed, run.stats.speed * 1.1);
    }
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
    let moving = false;
    if (d > (this.target ? 0.1 : 0.6)) {
      const step = Math.min(d, sp * dt * (this.target ? 1 : Math.min(1, d / 2)));
      this.x += (dx / d) * step;
      this.z += (dz / d) * step;
      this.facing = Math.atan2(dx, dz);
      moving = true;
    }
    if (this.target && d < 0.9) {
      this.target.pull = true;
      run.fx.burst(this.target.x, 0.4, this.target.z, '#fff2c0', 3, 2, 0.3, 0.6);
      this.target = null;
    }
    // teleport back if left far behind
    if (Math.hypot(p.x - this.x, p.z - this.z) > this.range + 15) {
      this.x = p.x + 1;
      this.z = p.z + 1;
    }
    // no collision: Biscuit squeezes under fences and through stalls to fetch
    this.phase += dt * (moving ? 18 : 3);
    this.mesh.position.set(this.x, Math.abs(Math.sin(this.phase)) * (moving ? 0.12 : 0.02), this.z);
    this.mesh.rotation.set(moving ? 0.1 : 0, this.facing, Math.sin(this.phase) * (moving ? 0.12 : 0.03));
    this.ring.position.set(p.x, 0.05, p.z);
    this.ring.scale.setScalar(this.range);
  }

  dispose() {
    this.run.scene.remove(this.mesh, this.ring);
  }
}
