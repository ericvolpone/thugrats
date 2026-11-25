import * as THREE from 'three';
import { createHeroModel } from '../assets/models.js';
import { dampAngle } from '../util.js';

const _v = new THREE.Vector3();
const GRAVITY = 30;
const JUMP_V = 11.8; // apex ≈ 2.3m: clears mobs, lands on cars, dumpsters, crates

/** The hero in a run: movement, facing/aiming, model + animation. */
export class Player {
  constructor(run, hero) {
    this.run = run;
    this.hero = hero;
    this.model = createHeroModel(hero.model);
    this.root = this.model.root;
    this.root.scale.setScalar(1.15);
    run.scene.add(this.root);
    this.x = 0;
    this.z = 0;
    this.radius = 0.55;
    this.facing = 0;
    this.moving = false;
    this.aimT = 0;
    this.aimX = 0;
    this.aimZ = 0;
    this.recoil = 0;
    this.hurtT = 0;
    this.hp = 100;
    this.shield = 0;
    this.dead = false;
    this.smokeT = 0;
    // vertical: y = feet height, ground = surface under us
    this.y = 0;
    this.vy = 0;
    this.ground = 0;
    this.grounded = true;

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35, depthWrite: false }));
    shadow.position.y = 0.04;
    this.shadow = shadow;
    run.scene.add(shadow);
    // pickup radius indicator
    this.pickupRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.08, depthWrite: false }));
    this.pickupRing.position.y = 0.05;
    run.scene.add(this.pickupRing);
  }

  /** Turn to face (x,z) for `t` seconds (abilities call this when they shoot). */
  aim(x, z, t = 0.35) {
    this.aimX = x;
    this.aimZ = z;
    this.aimT = Math.max(this.aimT, t);
    this.recoil = 1;
  }

  muzzlePos() {
    const n = this.model.nodes.muzzle;
    if (n) {
      n.getWorldPosition(_v);
      return { x: _v.x, y: Math.max(0.4, _v.y), z: _v.z };
    }
    return { x: this.x + Math.sin(this.facing) * 0.5, y: 0.7, z: this.z + Math.cos(this.facing) * 0.5 };
  }

  /** move = world-space {x, z} direction (|v| <= 1), jump = pressed this frame. */
  update(dt, move, jump = false) {
    const run = this.run;
    const sp = run.stats.speed;
    const mag = Math.hypot(move.x, move.z);
    this.moving = !this.dead && mag > 0.05;
    if (this.moving) {
      this.x += move.x * sp * dt;
      this.z += move.z * sp * dt;
    }
    run.world.collide(this, this.radius, this.y);

    // jumping / falling / standing on props
    if (jump && this.grounded && !this.dead) {
      this.vy = JUMP_V;
      this.grounded = false;
      run.fx.burst(this.x, this.y + 0.1, this.z, '#d8d2c8', 5, 2, 0.3, 0.7);
    }
    this.vy -= GRAVITY * dt;
    this.y += this.vy * dt;
    this.ground = run.world.groundAt(this.x, this.z, this.y);
    if (this.y <= this.ground) {
      if (!this.grounded && this.vy < -6) run.fx.burst(this.x, this.ground + 0.1, this.z, '#d8d2c8', 6, 2.5, 0.3, 0.7);
      this.y = this.ground;
      this.vy = 0;
      this.grounded = true;
    } else if (this.y > this.ground + 0.05) {
      this.grounded = false;
    }
    this.aimT -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.hurtT = Math.max(0, this.hurtT - dt * 3);
    let target = this.facing;
    if (this.aimT > 0) target = Math.atan2(this.aimX - this.x, this.aimZ - this.z);
    else if (this.moving) target = Math.atan2(move.x, move.z);
    this.facing = dampAngle(this.facing, target, this.aimT > 0 ? 22 : 12, dt);

    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.facing;
    this.model.animator.update(dt, {
      move: this.moving && this.grounded ? Math.min(1, mag) : 0,
      aiming: this.aimT > 0,
      shoot: this.recoil,
      hurt: this.hurtT,
      dead: this.dead,
      air: !this.grounded,
    });
    this.shadow.position.set(this.x, this.ground + 0.04, this.z);
    this.shadow.scale.setScalar(Math.max(0.4, 1 - (this.y - this.ground) * 0.25));
    const pr = run.stats.pickup;
    this.pickupRing.position.set(this.x, this.ground + 0.05, this.z);
    this.pickupRing.scale.setScalar(pr);

    // cigar smoke
    this.smokeT -= dt;
    const tip = this.model.nodes.cigarTip;
    if (tip && this.smokeT <= 0) {
      this.smokeT = 0.35;
      tip.getWorldPosition(_v);
      run.fx.smoke(_v.x, _v.y + 0.05, _v.z);
    }
  }

  dispose() {
    this.run.scene.remove(this.root, this.shadow, this.pickupRing);
  }
}
