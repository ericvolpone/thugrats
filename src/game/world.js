import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PROPS } from '../assets/props.js';
import { MATS } from '../assets/models.js';
import { paint, C, mulberry32 } from '../util.js';
import { MAP_DEFAULTS } from '../data/maps.js';

/**
 * Builds a map's arena: ground + streets, a ring of buildings around the edge,
 * a few city blocks to dodge around, props, titan altars and boss spawn pads.
 * Also owns static collision (rects + circles).
 */
export class World {
  constructor(scene, map) {
    this.scene = scene;
    this.map = map;
    this.half = MAP_DEFAULTS.half;
    this.rects = []; // {x0,z0,x1,z1}
    this.circles = []; // {x,z,r}
    this.group = new THREE.Group();
    scene.add(this.group);
    const th = map.theme;
    const rnd = mulberry32(map.id.length * 977 + map.name.charCodeAt(0));

    // ── ground ──
    const H = this.half + 30;
    const ground = new THREE.PlaneGeometry(H * 2, H * 2, 40, 40).rotateX(-Math.PI / 2);
    const g0 = C(th.ground);
    const parts = [paint(ground, () => g0, 0.08)];
    // streets: a grid every 44 units
    const st = C(th.street), line = C(th.line), side = C(th.sidewalk);
    for (let k = -88; k <= 88; k += 44) {
      for (const axis of [0, 1]) {
        const sw = new THREE.PlaneGeometry(axis ? 14 : H * 2, axis ? H * 2 : 14).rotateX(-Math.PI / 2).translate(axis ? k : 0, 0.01, axis ? 0 : k);
        parts.push(paint(sw, side, 0.05));
        const road = new THREE.PlaneGeometry(axis ? 10 : H * 2, axis ? H * 2 : 10).rotateX(-Math.PI / 2).translate(axis ? k : 0, 0.02, axis ? 0 : k);
        parts.push(paint(road, st, 0.04));
        for (let d = -H; d < H; d += 6) {
          const dash = new THREE.PlaneGeometry(axis ? 0.25 : 2.6, axis ? 2.6 : 0.25).rotateX(-Math.PI / 2).translate(axis ? k : d, 0.03, axis ? d : k);
          parts.push(paint(dash, line, 0));
        }
      }
    }
    const groundMesh = new THREE.Mesh(mergeGeometries(parts), MATS.flat);
    this.group.add(groundMesh);

    // ── buildings ──
    const bparts = [];
    const windows = th.windows ?? '#ffd77a';
    const addBuilding = (x, z, w, d, h, seed) => {
      const col = th.buildings[Math.floor(rnd() * th.buildings.length)];
      bparts.push(PROPS.building(w, d, h, col, seed, windows).translate(x, 0, z));
      this.rects.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    };
    // perimeter wall of buildings
    const B = this.half + 6;
    let seed = 1;
    for (let u = -B; u < B; u += 12) {
      const h1 = 7 + rnd() * 9, h2 = 7 + rnd() * 9, h3 = 7 + rnd() * 9, h4 = 7 + rnd() * 9;
      addBuilding(u + 6, -B, 12, 12, h1, seed++);
      addBuilding(u + 6, B, 12, 12, h2, seed++);
      addBuilding(-B, u + 6, 12, 12, h3, seed++);
      addBuilding(B, u + 6, 12, 12, h4, seed++);
    }
    // a few blocks inside (never near spawn / altars / boss pads)
    const keepClear = [[0, 0, 22], ...map.titans.map((t) => [...t.pos, 14]), ...map.bossSpawns.map((b) => [...b, 10])];
    const clear = (x, z, r) => keepClear.every(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) > cr + r);
    for (const bx of [-66, -22, 22, 66]) {
      for (const bz of [-66, -22, 22, 66]) {
        if (rnd() < 0.45) continue;
        const w = 8 + rnd() * 8, d = 8 + rnd() * 8;
        const x = bx + (rnd() - 0.5) * 10, z = bz + (rnd() - 0.5) * 10;
        if (!clear(x, z, Math.max(w, d) * 0.7)) continue;
        addBuilding(x, z, w, d, 5 + rnd() * 8, seed++);
      }
    }
    this.group.add(new THREE.Mesh(mergeGeometries(bparts), MATS.flat));

    // ── props ──
    const pparts = [];
    const colliding = { dumpster: [1.2, 0.8], car: [1.1, 2.2], container: [1.6, 3.8], crate: [0.6, 0.6], barrel: [0.45, 0.45], slot: [0.6, 0.55], bench: [1, 0.3] };
    for (let i = 0; i < 140; i++) {
      const kind = th.props[Math.floor(rnd() * th.props.length)];
      const x = (rnd() * 2 - 1) * (this.half - 6), z = (rnd() * 2 - 1) * (this.half - 6);
      if (!clear(x, z, 3) || this.solidAt(x, z, 3)) continue;
      const rot = Math.floor(rnd() * 4) * (Math.PI / 2);
      let geo;
      if (kind === 'car') geo = PROPS.car(['#8a1c1c', '#1c3a8a', '#d9d4c3', '#2a2a2a', '#3a6b3a'][Math.floor(rnd() * 5)]);
      else if (kind === 'container') geo = PROPS.container(['#b8452c', '#2c6bb8', '#3a8a4a', '#c8a020'][Math.floor(rnd() * 4)]);
      else geo = PROPS[kind]();
      pparts.push(geo.rotateY(rot).translate(x, 0, z));
      const c = colliding[kind];
      if (c) {
        const [hw, hd] = rot % Math.PI ? [c[1], c[0]] : c;
        if (kind === 'car' || kind === 'container' || kind === 'dumpster') this.rects.push({ x0: x - hw, z0: z - hd, x1: x + hw, z1: z + hd });
        else this.circles.push({ x, z, r: Math.max(hw, hd) });
      } else if (kind === 'lamp' || kind === 'hydrant' || kind === 'palm' || kind === 'trashcan' || kind === 'bollard') {
        this.circles.push({ x, z, r: 0.35 });
      }
    }
    if (pparts.length) this.group.add(new THREE.Mesh(mergeGeometries(pparts), MATS.flat));

    // ── altars + boss pads ──
    this.altars = map.titans.map((t, i) => {
      const mesh = new THREE.Mesh(PROPS.altar(['#b14cff', '#ff4fd8', '#ff9a1f'][i % 3]), MATS.flat);
      mesh.position.set(t.pos[0], 0, t.pos[1]);
      this.group.add(mesh);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 40, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: '#c08cff', transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.set(t.pos[0], 20, t.pos[1]);
      this.group.add(beam);
      const fill = new THREE.Mesh(new THREE.CircleGeometry(3, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.5, depthWrite: false }));
      fill.position.set(t.pos[0], 0.3, t.pos[1]);
      fill.scale.setScalar(0.001);
      this.group.add(fill);
      return { mesh, beam, fill };
    });
    for (const [x, z] of map.bossSpawns) {
      const pad = new THREE.Mesh(paint(new THREE.CylinderGeometry(2.2, 2.4, 0.12, 10), (q) => (Math.hypot(q.x, q.z) > 1.7 ? C('#d8c04a') : C('#5a5a62'))), MATS.flat);
      pad.position.set(x, 0.06, z);
      this.group.add(pad);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const bar = new THREE.Mesh(paint(new THREE.BoxGeometry(1.4, 0.5, 0.15).translate(0, 0.45, 0), (p) => (Math.floor((p.x + 0.7) * 2.5) % 2 ? C('#f2f2f2') : C('#e23a2a'))), MATS.flat);
        bar.position.set(x + Math.sin(a) * 3.2, 0, z + Math.cos(a) * 3.2);
        bar.rotation.y = a;
        this.group.add(bar);
      }
    }
  }

  /** Is (x,z) inside a building/large prop? pad grows the test. */
  solidAt(x, z, pad = 0) {
    for (const r of this.rects) {
      if (x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad) return true;
    }
    return false;
  }

  /** Push a circle-bodied entity {x,z,radius} out of all colliders and the arena edge. */
  collide(e, rad = e.radius) {
    for (const r of this.rects) {
      if (e.x < r.x0 - rad || e.x > r.x1 + rad || e.z < r.z0 - rad || e.z > r.z1 + rad) continue;
      const cx = Math.max(r.x0, Math.min(e.x, r.x1));
      const cz = Math.max(r.z0, Math.min(e.z, r.z1));
      let dx = e.x - cx, dz = e.z - cz;
      const d = Math.hypot(dx, dz);
      if (d === 0) {
        // centre inside the rect: push out along the shallowest side
        const l = e.x - r.x0, rr = r.x1 - e.x, t = e.z - r.z0, b = r.z1 - e.z;
        const m = Math.min(l, rr, t, b);
        if (m === l) e.x = r.x0 - rad; else if (m === rr) e.x = r.x1 + rad; else if (m === t) e.z = r.z0 - rad; else e.z = r.z1 + rad;
      } else if (d < rad) {
        e.x = cx + (dx / d) * rad;
        e.z = cz + (dz / d) * rad;
      }
    }
    for (const c of this.circles) {
      const dx = e.x - c.x, dz = e.z - c.z;
      const d = Math.hypot(dx, dz), m = c.r + rad;
      if (d < m && d > 0) { e.x = c.x + (dx / d) * m; e.z = c.z + (dz / d) * m; }
    }
    const lim = this.half - 1;
    e.x = Math.max(-lim, Math.min(lim, e.x));
    e.z = Math.max(-lim, Math.min(lim, e.z));
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}
