import { seeThroughMaterial } from './seeThrough.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PROPS } from '../assets/props.js';
import { MATS } from '../assets/models.js';
import { paint, C, mulberry32 } from '../util.js';
import { MAP_DEFAULTS } from '../data/maps.js';
import { LAYOUTS } from './layouts.js';

/** Prop colliders: [half-width, half-depth, top height, shape]. Under ~2.1m can be jumped onto. */
const COLLIDE = {
  dumpster: [1.2, 0.8, 1.4, 'rect'], car: [1.1, 2.2, 1.45, 'rect'], container: [1.6, 3.8, 3, 'rect'], crate: [0.6, 0.6, 1], barrel: [0.45, 0.45, 1.1],
  slot: [0.6, 0.55, 1.8], bench: [1, 0.3, 0.6, 'rect'], lamp: [0.35, 0.35, 4.2], hydrant: [0.35, 0.35, 0.85], palm: [0.35, 0.35, 4.5], trashcan: [0.4, 0.4, 1],
  bollard: [0.35, 0.35, 0.85], fountain: [2.8, 2.8, 1.1], cafe: [0.6, 0.6, 0.8], stall: [1.5, 0.7, 1, 'rect'], vespa: [0.3, 0.8, 1.1, 'rect'],
  planter: [0.6, 0.6, 0.6, 'rect'], forklift: [0.7, 1.1, 2.2, 'rect'], roulette: [1.5, 0.8, 0.95, 'rect'], dice: [2, 2, 4, 'rect'],
  mahjong: [0.8, 0.8, 0.8], bonsai: [0.5, 0.5, 2], umbrella: [0.25, 0.25, 2.4], booth: [1.5, 0.8, 1, 'rect'], carousel: [5.2, 5.2, 99],
};

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
    this.rects = []; // {x0,z0,x1,z1,h,kind}
    this.circles = []; // {x,z,r,h}
    this.mm = []; // minimap ground features {x0,z0,x1,z1,color} | {x,z,r,color}
    this.group = new THREE.Group();
    scene.add(this.group);
    const th = (this.th = map.theme);
    this.rnd = mulberry32(map.id.length * 977 + map.name.charCodeAt(0));
    this.seed = 1;
    this.gparts = [];
    this.bparts = [];
    this.pparts = [];

    // ground
    const H = this.half + 30;
    const g0 = C(th.ground);
    this.gparts.push(paint(new THREE.PlaneGeometry(H * 2, H * 2, 40, 40).rotateX(-Math.PI / 2), () => g0, 0.08));

    // never build on the spawn, altars or boss pads
    this.keepClear = [[...(map.spawn ?? [0, 0]), 5], ...map.titans.map((t) => [...t.pos, 9]), ...map.bossSpawns.map((b) => [...b, 6])];

    (LAYOUTS[map.layout ?? map.id] ?? LAYOUTS.little_italy)(this, this.rnd);

    this.group.add(new THREE.Mesh(mergeGeometries(this.gparts), MATS.flat));
    // buildings and props get the see-through cutout (seeThrough.js) so they never hide the hero
    if (this.bparts.length) this.group.add(new THREE.Mesh(mergeGeometries(this.bparts), seeThroughMaterial()));
    if (this.pparts.length) this.group.add(new THREE.Mesh(mergeGeometries(this.pparts), seeThroughMaterial()));
    this.gparts = this.bparts = this.pparts = null;
    this.buildAltars(map);
  }

  // ── layout helpers (used by game/layouts.js) ──────────────────────────────
  clear(x, z, r) {
    return this.keepClear.every(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) > cr + r);
  }

  rectClear(x0, z0, x1, z1, pad = 0) {
    return this.keepClear.every(([cx, cz, cr]) => {
      const nx = Math.max(x0, Math.min(cx, x1)), nz = Math.max(z0, Math.min(cz, z1));
      return Math.hypot(cx - nx, cz - nz) > cr + pad;
    });
  }

  /** Flat ground rectangle (y = layer height to avoid z-fighting). */
  patch(x0, z0, x1, z1, color, y = 0.01, mm = true) {
    this.gparts.push(paint(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2), C(color), 0.04));
    if (mm) this.mm.push({ x0, z0, x1, z1, color });
  }

  disc(x, z, r, color, y = 0.01) {
    this.gparts.push(paint(new THREE.CircleGeometry(r, 32).rotateX(-Math.PI / 2).translate(x, y, z), C(color), 0.03));
    this.mm.push({ x, z, r, color });
  }

  /** Road with sidewalks and centre dashes. axis = direction it runs. */
  road(x0, z0, x1, z1, axis = 'x', color = this.th.street, lineColor = this.th.line) {
    const side = this.th.sidewalk;
    if (axis === 'x') {
      this.patch(x0, z0 - 2, x1, z1 + 2, side, 0.01);
      this.patch(x0, z0, x1, z1, color, 0.02, false);
      const zc = (z0 + z1) / 2;
      for (let x = x0; x < x1; x += 6) this.patch(x, zc - 0.12, x + 2.6, zc + 0.12, lineColor, 0.03, false);
    } else {
      this.patch(x0 - 2, z0, x1 + 2, z1, side, 0.01);
      this.patch(x0, z0, x1, z1, color, 0.02, false);
      const xc = (x0 + x1) / 2;
      for (let z = z0; z < z1; z += 6) this.patch(xc - 0.12, z, xc + 0.12, z + 2.6, lineColor, 0.03, false);
    }
  }

  /** Impassable water (collision is an invisible tall rect). */
  water(x0, z0, x1, z1) {
    this.patch(x0, z0, x1, z1, this.th.water ?? '#1d4a66', 0.012, false);
    for (let i = 0; i < (x1 - x0) * (z1 - z0) / 60; i++) {
      const x = x0 + this.rnd() * (x1 - x0), z = z0 + this.rnd() * (z1 - z0);
      this.patch(x, z, x + 1.5 + this.rnd() * 2, z + 0.15, '#4f86a8', 0.014, false);
    }
    this.mm.push({ x0, z0, x1, z1, color: '#2a5f86' });
    this.rects.push({ x0, z0, x1, z1, h: 99, kind: 'water' });
  }

  pier(x0, z0, x1, z1) {
    for (let z = z0; z < z1; z += 1.2) this.patch(x0, z, x1, z + 1.1, (z / 1.2) % 2 < 1 ? '#7a5a3a' : '#6b4f33', 0.02, false);
    this.mm.push({ x0, z0, x1, z1, color: '#7a5a3a' });
    for (const x of [x0, x1]) for (let z = z0 + 2; z < z1; z += 5) this.prop('bollard', x + (x === x0 ? 0.5 : -0.5), z);
  }

  /** Koi pond: low stone rim, dark water, a few orange fish and lily pads. */
  pond(x, z, r) {
    this.bparts.push(paint(new THREE.CylinderGeometry(r + 0.4, r + 0.6, 0.45, 24).translate(x, 0.22, z), C('#8a8478')));
    this.bparts.push(paint(new THREE.CylinderGeometry(r - 0.1, r - 0.1, 0.05, 24).translate(x, 0.42, z), C('#1f4a4a')));
    for (let i = 0; i < 9; i++) {
      const a = this.rnd() * Math.PI * 2, rr = this.rnd() * (r - 1);
      const koi = i < 5;
      this.bparts.push(paint((koi ? new THREE.BoxGeometry(0.25, 0.05, 0.7) : new THREE.CylinderGeometry(0.45, 0.45, 0.03, 8)).rotateY(a).translate(x + Math.sin(a) * rr, 0.47, z + Math.cos(a) * rr), C(koi ? (i % 2 ? '#ff7a1a' : '#f4f1ea') : '#3a8a3a')));
    }
    this.circles.push({ x, z, r: r + 0.5, h: 99 });
    this.mm.push({ x, z, r, color: '#2a6a6a' });
  }

  /** Solid water feature (casino fountain show). */
  pool(x, z, r) {
    this.bparts.push(paint(new THREE.CylinderGeometry(r, r + 0.3, 0.8, 28).translate(x, 0.4, z), C('#d8c8e8')));
    this.bparts.push(paint(new THREE.CylinderGeometry(r - 0.4, r - 0.4, 0.05, 28).translate(x, 0.75, z), C('#3aa0e0')));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, rr = i ? r * 0.55 : 0;
      this.bparts.push(paint(new THREE.CylinderGeometry(0.12, 0.3, i ? 3 : 6, 6).translate(x + Math.sin(a) * rr, (i ? 3 : 6) / 2 + 0.7, z + Math.cos(a) * rr), C('#cfefff')));
    }
    this.circles.push({ x, z, r: r + 0.2, h: 99 });
    this.mm.push({ x, z, r, color: '#3aa0e0' });
  }

  building(x, z, w, d, h, color, windows = this.th.windows ?? '#ffd77a') {
    if (!this.rectClear(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 1)) return false;
    this.bparts.push(PROPS.building(w, d, h, color, this.seed++, windows).translate(x, 0, z));
    this.rects.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, h: 99, kind: 'building' });
    return true;
  }

  /** A row of narrow, mismatched houses filling a w×d footprint (split along its long side). */
  rowhouses(x, z, w, d) {
    const along = w >= d ? 'x' : 'z';
    const len = along === 'x' ? w : d;
    let u = -len / 2;
    while (u < len / 2 - 1) {
      const seg = Math.min(len / 2 - u, 4 + this.rnd() * 3);
      const c = u + seg / 2;
      const h = 5 + this.rnd() * 5;
      const col = this.th.buildings[Math.floor(this.rnd() * this.th.buildings.length)];
      if (along === 'x') this.building(x + c, z, seg, d, h, col);
      else this.building(x, z + c, w, seg, h, col);
      u += seg;
    }
  }

  /** Big casino: tall block, neon trim stripes, a marquee. */
  casino(x, z, w, d, h, color, neon) {
    if (!this.building(x, z, w, d, h, color, neon)) return;
    for (const y of [h * 0.33, h * 0.66, h - 0.3]) this.bparts.push(paint(new THREE.BoxGeometry(w + 0.4, 0.35, d + 0.4).translate(x, y, z), C(neon), 0));
    const face = x < 0 ? x + w / 2 : x - w / 2;
    this.bparts.push(PROPS.neon(neon, '#140a1c', d * 0.6, 4, h * 0.6).rotateY(Math.PI / 2).translate(face + (x < 0 ? 0.5 : -0.5), 0, z));
  }

  crane(x, z) {
    this.pparts.push(PROPS.crane().translate(x, 0, z));
    for (const [dx, dz] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) this.circles.push({ x: x + dx, z: z + dz, r: 0.6, h: 99 });
  }

  /** Building ring around the arena edge (or three sides). */
  perimeter(depth = 12, o = {}) {
    const B = this.half + depth / 2;
    const pal = o.palette ?? this.th.buildings;
    for (let u = -B - depth; u < B + depth; u += depth) {
      const sides = [[u + depth / 2, -B], [-B, u + depth / 2], [B, u + depth / 2]];
      if (!o.skipSouth) sides.push([u + depth / 2, B]);
      for (const [x, z] of sides) {
        const col = pal[Math.floor(this.rnd() * pal.length)];
        this.bparts.push(PROPS.building(depth, depth, 7 + this.rnd() * 9, col, this.seed++, this.th.windows ?? '#ffd77a').translate(x, 0, z));
        this.rects.push({ x0: x - depth / 2, z0: z - depth / 2, x1: x + depth / 2, z1: z + depth / 2, h: 99, kind: 'building' });
      }
    }
  }

  /** Visual-only prop (no collision). */
  deco(kind, ...args) {
    if (kind === 'lights') { this.pparts.push(PROPS.lights(...args)); return; }
    if (kind === 'lanterns') { this.pparts.push(PROPS.lanterns(...args)); return; }
    if (kind === 'gate') {
      // pillars collide, the street under it stays open
      const [x, z, rot, w = 12] = args;
      this.bparts.push(PROPS.gate(w).rotateY(rot).translate(x, 0, z));
      const cx = Math.cos(rot) * w / 2, cz = -Math.sin(rot) * w / 2;
      this.circles.push({ x: x + cx, z: z + cz, r: 0.6, h: 99 }, { x: x - cx, z: z - cz, r: 0.6, h: 99 });
      return;
    }
    if (kind === 'pagoda') {
      const [x, z, w = 8] = args;
      if (!this.rectClear(x - w / 2 - 0.5, z - w / 2 - 0.5, x + w / 2 + 0.5, z + w / 2 + 0.5, 1)) return;
      this.bparts.push(PROPS.pagoda(w).translate(x, 0, z));
      this.rects.push({ x0: x - w / 2 - 0.5, z0: z - w / 2 - 0.5, x1: x + w / 2 + 0.5, z1: z + w / 2 + 0.5, h: 99, kind: 'building' });
      return;
    }
    if (kind === 'ferris') {
      const [x, z, rot = 0, r = 11] = args;
      this.bparts.push(PROPS.ferris(r).rotateY(rot).translate(x, 0, z));
      const hub = r + 1.5, spread = Math.tan(0.32) * hub / 2;
      for (const s of [-1, 1]) for (const dz of [-1.4, 1.4]) {
        const lx = s * spread, lz = dz;
        this.circles.push({ x: x + lx * Math.cos(rot) + lz * Math.sin(rot), z: z - lx * Math.sin(rot) + lz * Math.cos(rot), r: 0.7, h: 99 });
      }
      return;
    }
    if (kind === 'coaster') {
      // a run of track bents from (x0,z0) to (x1,z1); posts collide
      const [x0, z0, x1, z1, h = 5] = args;
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 6)), rot = Math.atan2(x1 - x0, z1 - z0);
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n, x = x0 + (x1 - x0) * k, z = z0 + (z1 - z0) * k;
        const hh = h + Math.sin(k * Math.PI * 2 + x0) * 1.5;
        this.pparts.push(PROPS.coaster(len / n + 0.1, hh).rotateY(rot).translate(x, 0, z));
        this.circles.push({ x, z, r: 0.4, h: 99 });
      }
      return;
    }
    if (kind === 'ship') { const [x, z, rot] = args; this.bparts.push(PROPS.ship().rotateY(rot).translate(x, 0, z)); return; }
    if (kind === 'neon') {
      const [x, z, rot, color, w, h, y] = args;
      this.pparts.push(PROPS.neon(color, '#140a1c', w, h, y).rotateY(rot).translate(x, 0, z));
      this.circles.push({ x: x + Math.cos(rot) * w / 3, z: z - Math.sin(rot) * w / 3, r: 0.3, h: 99 }, { x: x - Math.cos(rot) * w / 3, z: z + Math.sin(rot) * w / 3, r: 0.3, h: 99 });
      return;
    }
    if (kind === 'tank') {
      const [x, z, r, h, color] = args;
      if (!this.clear(x, z, r)) return;
      this.bparts.push(paint(new THREE.CylinderGeometry(r, r, h, 20).translate(x, h / 2, z), C(color), 0.05), paint(new THREE.CylinderGeometry(r * 0.96, r, 0.6, 20).translate(x, h + 0.3, z), C('#9aa0a8')));
      this.circles.push({ x, z, r, h: 99 });
      return;
    }
    if (kind === 'fence') {
      const [x, z, rot, len] = args;
      if (!this.clear(x, z, len / 2)) return;
      this.pparts.push(PROPS.fence(len).rotateY(rot).translate(x, 0, z));
      const hw = rot ? 0.15 : len / 2, hd = rot ? len / 2 : 0.15;
      this.rects.push({ x0: x - hw, z0: z - hd, x1: x + hw, z1: z + hd, h: 1.3, kind: 'prop' });
    }
  }

  /** Place a prop with its collider. Returns false if the spot is taken. */
  prop(kind, x, z, rot = 0, ...args) {
    const c = COLLIDE[kind];
    const r = c ? Math.max(c[0], c[1]) : 0.4;
    if (!this.clear(x, z, r)) return false;
    let geo;
    if (kind === 'container' && args[1]) {
      geo = mergeGeometries([PROPS.container(args[0]), PROPS.container(args[0] === '#2c6bb8' ? '#c8a020' : '#2c6bb8').translate(0, 3, 0)]);
    } else geo = PROPS[kind](...args);
    this.pparts.push(geo.rotateY(rot).translate(x, 0, z));
    if (c) {
      const [hw, hd] = Math.round(rot / (Math.PI / 2)) % 2 ? [c[1], c[0]] : c;
      const h = kind === 'container' && args[1] ? 6 : c[2];
      if (c[3] === 'rect') this.rects.push({ x0: x - hw, z0: z - hd, x1: x + hw, z1: z + hd, h, kind: 'prop' });
      else this.circles.push({ x, z, r: Math.max(hw, hd), h });
    }
    return true;
  }

  /** Random street furniture on free ground. */
  scatter(kinds, n, o = {}) {
    const lim = this.half - 6;
    for (let i = 0; i < n * 3 && n > 0; i++) {
      const kind = kinds[Math.floor(this.rnd() * kinds.length)];
      const x = (this.rnd() * 2 - 1) * lim, z = (this.rnd() * 2 - 1) * lim;
      if (o.maxZ != null && z > o.maxZ) continue;
      if (this.solidAt(x, z, 3) || this.circles.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 2.5)) continue;
      const rot = Math.floor(this.rnd() * 4) * (Math.PI / 2);
      const args = kind === 'car' ? [['#8a1c1c', '#1c3a8a', '#d9d4c3', '#2a2a2a', '#3a6b3a'][Math.floor(this.rnd() * 5)]]
        : kind === 'container' ? [['#b8452c', '#2c6bb8', '#3a8a4a', '#c8a020'][Math.floor(this.rnd() * 4)]] : [];
      if (this.prop(kind, x, z, rot, ...args)) n--;
    }
  }

  buildAltars(map) {
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

  /** Would a walker on the ground bump into something at (x, z)? (rects + circles) */
  blockedAt(x, z) {
    for (const r of this.rects) if (r.h > 0.3 && x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return true;
    for (const c of this.circles) if (c.h > 0.3 && c.r > 0.5 && (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return true;
    return false;
  }

  /** Can the player walk up to (x, z)? Nothing taller than a step (or water) within `pad`. */
  freeAt(x, z, pad = 1) {
    const lim = this.half - 3;
    if (Math.abs(x) > lim || Math.abs(z) > lim) return false;
    for (const r of this.rects) if (r.h > 0.3 && x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad) return false;
    for (const c of this.circles) if (c.h > 0.3 && Math.hypot(x - c.x, z - c.z) < c.r + pad) return false;
    return true;
  }

  /** Nearest free spot to (x, z), spiralling outwards (falls back to (x, z)). */
  freeSpot(x, z, pad = 1) {
    if (this.freeAt(x, z, pad)) return [x, z];
    for (let r = 1; r < 30; r += 0.75) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + r;
        const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
        if (this.freeAt(px, pz, pad)) return [px, pz];
      }
    }
    return [x, z];
  }

  /** Is (x,z) inside a building/large prop? pad grows the test. */
  solidAt(x, z, pad = 0, y = 0.7) {
    for (const r of this.rects) {
      if (r.h > y && x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad) return true;
    }
    return false;
  }

  /** Top of the tallest collider covering (x, z) (0 = open ground). */
  topAt(x, z) {
    let h = 0;
    for (const r of this.rects) if (r.h > h && x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) h = r.h;
    for (const c of this.circles) if (c.h > h && (x - c.x) ** 2 + (z - c.z) ** 2 <= c.r * c.r) h = c.h;
    return h;
  }

  /**
   * Height of the surface under (x, z) that something at height y can stand on
   * (tops up to `step` above y count, so you can land on what you clear).
   */
  groundAt(x, z, y = 0, step = 0.25) {
    let g = 0;
    for (const r of this.rects) {
      if (r.h > y + step || r.h <= g) continue;
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) g = r.h;
    }
    for (const c of this.circles) {
      if (c.h > y + step || c.h <= g) continue;
      if ((x - c.x) ** 2 + (z - c.z) ** 2 <= c.r * c.r) g = c.h;
    }
    return g;
  }

  /**
   * Push a circle-bodied entity {x,z,radius} out of all colliders and the arena
   * edge. Colliders whose top is below `y` are ignored (you're above them).
   */
  collide(e, rad = e.radius, y = 0) {
    for (const r of this.rects) {
      if (r.h <= y + 0.05) continue;
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
      if (c.h <= y + 0.05) continue;
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
