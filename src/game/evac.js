import * as THREE from 'three';
import { MATS } from '../assets/models.js';
import { paint, C, TAU, rand } from '../util.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { labelSprite } from './pickups.js';
import { sfx } from '../audio.js';

/**
 * The evac chopper. Once the final Crime Titan is down the map counts as cleared
 * and a helicopter lands somewhere on the map. Stand on its pad for a couple of
 * seconds to get out (evac bonus), or ignore it and see how deep into the Feds
 * you can last; dying after the clear still keeps the clear.
 */
const LAND_TIME = 9; // seconds from "inbound" to touchdown
const BOARD_TIME = 2; // seconds on the pad to board
const PAD_R = 3.4;
const FLY_H = 34;
/** Hero XP and Rep multiplier for getting out on the chopper. */
export const EVAC_BONUS = 1.25;

function chopperGeometry() {
  const body = C('#2c3a2c'), dark = C('#1a1f1a'), glass = C('#9fd8ff'), stripe = C('#f2c037'), red = C('#d0302a');
  return mergeGeometries([
    // cabin + nose
    paint(new THREE.BoxGeometry(1.9, 1.6, 3.2).translate(0, 1.4, 0), body),
    paint(new THREE.SphereGeometry(1, 12, 8).scale(0.95, 0.8, 1).translate(0, 1.4, 1.7), body),
    paint(new THREE.SphereGeometry(0.9, 12, 8, 0, TAU, 0, Math.PI / 2).scale(0.9, 0.7, 0.9).rotateX(Math.PI / 2.4).translate(0, 1.55, 1.95), glass),
    paint(new THREE.BoxGeometry(1.92, 0.25, 3.22).translate(0, 1.0, 0), stripe),
    // side door opening
    paint(new THREE.BoxGeometry(1.94, 1.0, 1.2).translate(0, 1.45, -0.3), dark),
    // engine hump + rotor mast
    paint(new THREE.BoxGeometry(1.2, 0.5, 1.8).translate(0, 2.45, -0.4), body),
    paint(new THREE.CylinderGeometry(0.14, 0.14, 0.6, 8).translate(0, 2.95, 0), dark),
    // tail boom, fin, tail rotor hub
    paint(new THREE.CylinderGeometry(0.22, 0.4, 4.2, 8).rotateX(Math.PI / 2).translate(0, 1.85, -3.6), body),
    paint(new THREE.BoxGeometry(0.12, 1.3, 0.8).translate(0, 2.5, -5.5), body),
    paint(new THREE.BoxGeometry(0.14, 0.3, 0.5).translate(0, 3.05, -5.5), red),
    paint(new THREE.BoxGeometry(1.4, 0.1, 0.5).translate(0, 1.9, -5.2), body),
    // skids
    ...[-1, 1].flatMap((s) => [
      paint(new THREE.CylinderGeometry(0.07, 0.07, 4, 6).rotateX(Math.PI / 2).translate(s * 1.15, 0.08, 0.1), dark),
      paint(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6).translate(s * 1.05, 0.38, 0.9), dark),
      paint(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6).translate(s * 1.05, 0.38, -0.8), dark),
    ]),
  ]);
}

function rotorGeometry() {
  const blade = C('#222');
  return mergeGeometries([
    paint(new THREE.BoxGeometry(9, 0.06, 0.32), blade),
    paint(new THREE.BoxGeometry(0.32, 0.06, 9), blade),
    paint(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 8), C('#444')),
  ]);
}

function padTexture() {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3d42';
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 4, 0, TAU); g.fill();
  g.strokeStyle = '#f2c037'; g.lineWidth = 10;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 14, 0, TAU); g.stroke();
  g.setLineDash([18, 14]); g.lineWidth = 4; g.strokeStyle = '#fff';
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 34, 0, TAU); g.stroke();
  g.fillStyle = '#fff';
  g.font = 'bold 150px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('H', S / 2, S / 2 + 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Evac {
  constructor(run) {
    this.run = run;
    const scene = run.scene, w = run.world, p = run.player;
    // somewhere open, a decent walk away from where the final titan fell
    let pos = null;
    for (let tries = 0; tries < 200 && !pos; tries++) {
      const a = rand(0, TAU), r = rand(26, 50);
      const lim = w.half - 8;
      const x = Math.max(-lim, Math.min(lim, p.x + Math.sin(a) * r));
      const z = Math.max(-lim, Math.min(lim, p.z + Math.cos(a) * r));
      if (w.freeAt(x, z, PAD_R + 1.5) && w.clear(x, z, PAD_R + 1)) pos = [x, z];
    }
    pos ??= w.freeSpot(p.x + 20, p.z, PAD_R);
    [this.x, this.z] = pos;
    this.state = 'inbound';
    this.t = 0;
    this.board = 0;

    this.pad = new THREE.Mesh(new THREE.CircleGeometry(PAD_R, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: padTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.pad.position.set(this.x, 0.03, this.z);
    this.fill = new THREE.Mesh(new THREE.RingGeometry(PAD_R - 0.35, PAD_R, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#5dff9a', transparent: true, opacity: 0.9, depthWrite: false }));
    this.fill.position.set(this.x, 0.05, this.z);
    this.fill.scale.setScalar(0.001);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(PAD_R, PAD_R, 40, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: '#f2c037', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.position.set(this.x, 20, this.z);

    this.heli = new THREE.Group();
    this.heli.add(new THREE.Mesh(chopperGeometry(), MATS.flat));
    this.rotor = new THREE.Mesh(rotorGeometry(), MATS.flat);
    this.rotor.position.y = 3.3;
    this.tail = new THREE.Mesh(paint(new THREE.BoxGeometry(0.06, 1.4, 0.18), C('#222')), MATS.flat);
    this.tail.position.set(0.18, 2.1, -5.4);
    this.heli.add(this.rotor, this.tail);
    this.heli.rotation.y = rand(0, TAU);
    this.heli.position.set(this.x, FLY_H, this.z);

    this.sign = labelSprite(320, 96);
    this.sign.position.set(this.x, 6, this.z);
    this.sign.scale.set(2.8, 0.84, 1);
    scene.add(this.pad, this.fill, this.beam, this.heli, this.sign);
    sfx('titan', 0.4);
  }

  get landed() { return this.state === 'landed' || this.state === 'boarding'; }

  update(dt) {
    const run = this.run, p = run.player;
    this.t += dt;
    this.rotor.rotation.y += dt * (this.state === 'gone' ? 0 : 22);
    this.tail.rotation.x += dt * 30;
    const k = this.t / LAND_TIME;
    if (this.state === 'inbound') {
      // swoop in and settle
      const e = 1 - Math.pow(1 - Math.min(1, k), 3);
      this.heli.position.y = FLY_H * (1 - e) + Math.sin(this.t * 3) * 0.15 * (1 - e);
      this.heli.rotation.z = Math.sin(this.t * 1.3) * 0.08 * (1 - e);
      this.sign.userData.set(`EVAC ${Math.ceil(LAND_TIME - this.t)}`, '#f2c037');
      if (k >= 1) {
        this.state = 'landed';
        this.heli.position.y = 0;
        this.heli.rotation.z = 0;
        run.toast('🚁 The chopper is down! Stand on the H to evacuate (evac bonus), or stay and fight the Feds.');
      }
    } else if (this.state === 'landed' || this.state === 'boarding') {
      this.sign.userData.set('EVAC', '#5dff9a');
      const on = !p.dead && p.y < 1.5 && Math.hypot(p.x - this.x, p.z - this.z) < PAD_R;
      this.board = on ? this.board + dt : Math.max(0, this.board - dt * 2);
      this.state = this.board > 0 ? 'boarding' : 'landed';
      this.fill.scale.setScalar(Math.max(0.001, this.board / BOARD_TIME));
      if (this.board >= BOARD_TIME) this.takeOff();
    } else if (this.state === 'leaving') {
      const u = this.t - this.leftAt;
      this.heli.position.y = u * u * 3;
      this.heli.rotation.x = -Math.min(0.25, u * 0.15);
      this.heli.position.x += Math.sin(this.heli.rotation.y) * u * dt * 6;
      this.heli.position.z += Math.cos(this.heli.rotation.y) * u * dt * 6;
      if (u > 2.6 && this.state !== 'gone') {
        this.state = 'gone';
        run.end('evac');
      }
    }
    // signal smoke while waiting
    if (this.state !== 'leaving' && this.state !== 'gone' && Math.random() < dt * 14) {
      run.fx.burst(this.x + PAD_R * 0.8, 0.3, this.z, '#5dff9a', 1, 1.5, 1.2, 1.4, -3);
    }
    this.beam.material.opacity = this.landed ? 0.12 + Math.sin(this.t * 3) * 0.05 : 0.06;
    this.sign.position.y = (this.state === 'inbound' ? 6 : 5.4) + Math.sin(this.t * 2) * 0.1;
  }

  takeOff() {
    const run = this.run, p = run.player;
    this.state = 'leaving';
    this.leftAt = this.t;
    run.evacuating = true;
    p.root.visible = false;
    if (p.shadow) p.shadow.visible = false;
    if (p.pickupRing) p.pickupRing.visible = false;
    this.fill.visible = false;
    this.sign.visible = false;
    run.ui.banner('GOT OUT CLEAN', 'The family sends its regards');
    sfx('victory');
  }

  dispose() {
    this.run.scene.remove(this.pad, this.fill, this.beam, this.heli, this.sign);
  }
}
