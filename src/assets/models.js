import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HeroAnimator } from './animator.js';

/**
 * Model library: the one place the game asks for art.
 *
 * Every model has a procedural builder (low-poly, generated in code). If
 * public/models/manifest.json maps an id to a .glb file, that file is loaded at
 * startup and used instead — so Blender models can replace any procedural model
 * without touching game code. See public/models/README.md for the conventions
 * (named rig nodes, animation clip names, units, facing).
 *
 *   heroes: full scene graphs, animated (procedural rig or glTF clips)
 *   mobs:   one merged, vertex-coloured geometry per type, drawn with GPU instancing
 *   props:  same as mobs, static
 */
const heroBuilders = new Map();
const mobBuilders = new Map();
const propBuilders = new Map();
const gltfCache = new Map(); // id -> gltf
const geoCache = new Map(); // `${kind}:${id}` -> geometry

export const MATS = {
  flat: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
};

export const registerHero = (id, fn) => heroBuilders.set(id, fn);
export const registerMob = (id, fn) => mobBuilders.set(id, fn);
export const registerProp = (id, fn) => propBuilders.set(id, fn);

/** Load public/models/manifest.json and any .glb files it lists. Missing files are fine. */
export async function loadManifest() {
  let manifest = {};
  try {
    const res = await fetch('models/manifest.json', { cache: 'no-cache' });
    if (res.ok) manifest = await res.json();
  } catch { /* no manifest: everything stays procedural */ }
  const loader = new GLTFLoader();
  const jobs = [];
  for (const kind of ['heroes', 'mobs', 'props']) {
    for (const [id, url] of Object.entries(manifest[kind] ?? {})) {
      jobs.push(loader.loadAsync(`models/${url}`).then(
        (g) => gltfCache.set(`${kind}:${id}`, g),
        (e) => console.warn(`[models] could not load ${url}, using procedural ${id}`, e),
      ));
    }
  }
  await Promise.all(jobs);
}

/**
 * Hero model: { root, nodes, animator }. root's origin is at the feet, facing +Z.
 * opts are passed to procedural builders (palette / variant tweaks).
 */
export function createHeroModel(id, opts = {}) {
  const g = gltfCache.get(`heroes:${id}`);
  if (g) {
    const root = new THREE.Group();
    const scene = g.scene.clone(true);
    root.add(scene);
    const nodes = {};
    scene.traverse((o) => { if (o.name) nodes[o.name] = o; });
    return { root, nodes, animator: new HeroAnimator(root, nodes, g.animations, scene) };
  }
  const build = heroBuilders.get(id);
  if (!build) throw new Error(`no hero model "${id}"`);
  const { root, nodes } = build(opts);
  return { root, nodes, animator: new HeroAnimator(root, nodes) };
}

/** Bake a glTF scene into one vertex-coloured geometry (for instancing). */
function bakeGltf(scene) {
  scene.updateMatrixWorld(true);
  const parts = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    let geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (geo.index) geo = geo.toNonIndexed();
    if (!geo.attributes.color) {
      const c = o.material?.color ?? new THREE.Color(1, 1, 1);
      const arr = new Float32Array(geo.attributes.position.count * 3);
      for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    parts.push(geo);
  });
  return mergeGeometries(parts);
}

function cachedGeometry(kind, id, builders, opts) {
  const key = `${kind}:${id}`;
  if (geoCache.has(key)) return geoCache.get(key);
  let geo;
  const g = gltfCache.get(key);
  if (g) geo = bakeGltf(g.scene);
  else {
    const build = builders.get(id);
    if (!build) throw new Error(`no ${kind} model "${id}"`);
    geo = build(opts);
  }
  geo.computeBoundingSphere();
  geoCache.set(key, geo);
  return geo;
}

/** Merged geometry for a mob type (origin at feet, facing +Z, ~real size). */
export const mobGeometry = (id) => cachedGeometry('mobs', id, mobBuilders);
export const propGeometry = (id) => cachedGeometry('props', id, propBuilders);

/** Merge painted parts. Each part: [geometry, matrix?]. */
export function merge(parts) {
  const geos = parts.map((p) => (Array.isArray(p) ? p[0].applyMatrix4(p[1]) : p));
  return mergeGeometries(geos);
}

/** Debug: download a hero model as .glb (a starting point for Blender). */
export function exportHeroGLB(id) {
  const { root } = createHeroModel(id);
  new GLTFExporter().parse(root, (buf) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
    a.download = `${id}.glb`;
    a.click();
  }, (e) => console.error(e), { binary: true });
}
