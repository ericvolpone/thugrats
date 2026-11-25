import * as THREE from 'three';
import { damp } from '../util.js';

/**
 * Drives a hero model. Two modes:
 *  - glTF clips: if the model ships clips named Idle / Run / Shoot / Die
 *    (case-insensitive), they are cross-faded by an AnimationMixer.
 *  - procedural: rotates named rig nodes (hips, torso, head, armL, armR, legL,
 *    legR, hat). Works for the code-built models and for any Blender model
 *    that uses the same node names.
 *
 * state = { move: 0..1, aiming: bool, shoot: 0..1 recoil pulse, hurt: 0..1, dead: bool }
 */
export class HeroAnimator {
  constructor(root, nodes, clips = [], scene = null) {
    this.root = root;
    this.n = nodes;
    this.t = Math.random() * 10;
    this.walk = 0;
    this.phase = 0;
    this.aimArm = 0;
    this.deadT = 0;
    this.base = {};
    for (const [k, o] of Object.entries(nodes)) {
      this.base[k] = { p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone() };
    }
    if (clips.length && scene) {
      this.mixer = new THREE.AnimationMixer(scene);
      this.actions = {};
      for (const c of clips) this.actions[c.name.toLowerCase()] = this.mixer.clipAction(c);
      this.current = null;
    }
  }

  play(name) {
    const a = this.actions?.[name];
    if (!a || this.current === a) return;
    a.reset().fadeIn(0.15).play();
    this.current?.fadeOut(0.15);
    this.current = a;
  }

  update(dt, s) {
    this.t += dt;
    if (this.mixer) {
      this.play(s.dead ? 'die' : s.move > 0.1 ? 'run' : 'idle');
      if (s.shoot > 0.9 && this.actions.shoot) this.actions.shoot.reset().setLoop(THREE.LoopOnce).play();
      this.mixer.update(dt);
      return;
    }
    const n = this.n, b = this.base;
    const set = (k, fn) => { if (n[k]) fn(n[k], b[k]); };

    if (s.dead) {
      this.deadT = Math.min(1, this.deadT + dt * 3);
      set('hips', (o, B) => { o.rotation.x = -this.deadT * 1.4; o.position.y = B.p.y * (1 - this.deadT * 0.6); });
      return;
    }
    this.deadT = 0;

    this.walk = damp(this.walk, s.move, 10, dt);
    this.phase += dt * (6 + 8 * this.walk);
    const w = this.walk;
    const sw = Math.sin(this.phase);
    const bob = Math.abs(Math.cos(this.phase));
    const breathe = Math.sin(this.t * 2.2) * 0.02;

    set('hips', (o, B) => {
      o.position.y = B.p.y + bob * 0.07 * w + breathe * 0.5;
      o.rotation.z = sw * 0.12 * w; // toddler waddle
      o.rotation.x = 0.12 * w;
    });
    set('torso', (o, B) => {
      o.scale.set(B.s.x * (1 - breathe), B.s.y * (1 + breathe), B.s.z * (1 - breathe));
      o.rotation.y = -sw * 0.15 * w;
    });
    set('head', (o, B) => {
      o.rotation.z = -sw * 0.08 * w + Math.sin(this.t * 0.7) * 0.04 * (1 - w);
      o.rotation.x = -0.1 * w + s.hurt * 0.3;
    });
    set('legL', (o) => { o.rotation.x = s.air ? -0.7 : sw * 0.8 * w; });
    set('legR', (o) => { o.rotation.x = s.air ? 0.4 : -sw * 0.8 * w; });
    set('armL', (o, B) => { o.rotation.x = B.r.x - sw * 0.7 * w; o.rotation.z = B.r.z + 0.1 + (s.air ? -0.9 : 0); });

    this.aimArm = damp(this.aimArm, s.aiming ? 1 : 0, 14, dt);
    set('armR', (o, B) => {
      const swing = sw * 0.7 * w * (1 - this.aimArm);
      // aiming: arm straight forward (-90° on x), recoil kicks it up
      o.rotation.x = B.r.x + swing - this.aimArm * (1.45 + s.shoot * 0.5);
      o.rotation.z = B.r.z;
    });
    set('hat', (o, B) => { o.position.y = B.p.y + bob * 0.03 * w + s.hurt * 0.08; });
  }
}
