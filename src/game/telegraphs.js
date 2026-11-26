import * as THREE from 'three';

/**
 * Ground warnings for boss/titan mechanics. A dim area shows the danger zone
 * and a brighter fill grows until it resolves; then onResolve() runs.
 * Shapes: circle {x,z,r} · donut {x,z,inner,outer} · cone {x,z,angle,len,arc}
 * · line {x,z,angle,len,width}. Angles: 0 = +Z, atan2(dx, dz) convention.
 */
// One material per telegraph: soft glowing rim, faint hazard stripes, a fill
// that sweeps out as it charges, a fast pulse in the last moments and a hot
// flash when it goes off. uv is planar for discs/rings/cones; for lines u runs
// across the width and v along the length.
const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `
uniform vec3 uColor; uniform float uK; uniform float uTime; uniform float uFlash; uniform float uInner; uniform float uLine; uniform float uAlpha;
varying vec2 vUv;
void main() {
  float r, edge, fillD;
  if (uLine > 0.5) {
    float across = abs(vUv.x - 0.5) * 2.0;
    r = across;
    edge = max(smoothstep(0.7, 1.0, across), smoothstep(0.93, 1.0, vUv.y));
    fillD = vUv.y;
  } else {
    r = length(vUv - 0.5) * 2.0;
    float span = max(0.0001, 1.0 - uInner);
    float t = clamp((r - uInner) / span, 0.0, 1.0);
    edge = smoothstep(0.72, 1.0, t) + (uInner > 0.0 ? 1.0 - smoothstep(0.0, 0.12, t) : 0.0);
    fillD = t;
  }
  float stripes = step(0.5, fract((vUv.x + vUv.y) * 14.0 - uTime * 1.5)) * 0.08;
  float filled = 1.0 - smoothstep(uK - 0.04, uK, fillD);
  float front = (1.0 - smoothstep(0.0, 0.06, abs(fillD - uK))) * step(0.02, uK);
  float late = smoothstep(0.75, 1.0, uK);
  float pulse = late * (0.5 + 0.5 * sin(uTime * 28.0));
  float a = 0.14 + stripes + edge * (0.55 + 0.35 * pulse) + filled * (0.22 + 0.18 * late) + front * 0.5;
  vec3 col = mix(uColor, vec3(1.0, 0.85, 0.5), front * 0.6 + pulse * 0.25 * edge);
  col = mix(col, vec3(1.0, 0.97, 0.85), uFlash);
  a = mix(a, 0.9 - 0.3 * r, uFlash);
  gl_FragColor = vec4(col, a * uAlpha);
}`;

const FLASH_T = 0.22;

export class Telegraphs {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.flashes = [];
    this.time = 0;
  }

  material(shape, o) {
    return new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(o.color ?? '#ff3a24') }, uK: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 }, uAlpha: { value: 1 },
        uInner: { value: shape === 'donut' ? o.inner / o.outer : 0 }, uLine: { value: shape === 'line' ? 1 : 0 },
      },
    });
  }

  add(shape, o, delay, onResolve) {
    let geo;
    switch (shape) {
      case 'circle': geo = new THREE.CircleGeometry(o.r, 48); break;
      case 'donut': geo = new THREE.RingGeometry(o.inner, o.outer, 64); break;
      case 'cone': {
        const arc = (o.arc * Math.PI) / 180;
        geo = new THREE.CircleGeometry(o.len, 32, -arc / 2, arc);
        break;
      }
      case 'line': geo = new THREE.PlaneGeometry(o.width, o.len).translate(0, o.len / 2, 0); break;
      default: return null;
    }
    geo.rotateX(-Math.PI / 2);
    // after rotateX, the +Y extent becomes -Z; flip so it extends toward +Z
    if (shape === 'line') geo.rotateY(Math.PI);
    const mat = this.material(shape, o);
    const g = new THREE.Mesh(geo, mat);
    g.position.set(o.x, 0.07, o.z);
    if (shape === 'cone') g.rotation.y = o.angle - Math.PI / 2;
    if (shape === 'line') g.rotation.y = o.angle;
    g.renderOrder = 2;
    this.scene.add(g);
    const t = { shape, ...o, delay, t: 0, g, mat, geo, onResolve };
    this.list.push(t);
    this.layout(t);
    return t;
  }

  layout(t) {
    const u = t.mat.uniforms;
    u.uK.value = Math.min(1, t.t / t.delay);
    u.uTime.value = this.time;
  }

  /** Is point (x,z) with radius pad inside telegraph t? */
  static contains(t, x, z, pad = 0) {
    const dx = x - t.x, dz = z - t.z;
    const d = Math.hypot(dx, dz);
    switch (t.shape) {
      case 'circle': return d <= t.r + pad;
      case 'donut': return d >= t.inner - pad * 0.5 && d <= t.outer + pad;
      case 'cone': {
        if (d > t.len + pad) return false;
        if (d < 1) return true;
        let da = Math.atan2(dx, dz) - t.angle;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        return Math.abs(da) <= (t.arc * Math.PI) / 360 + pad / Math.max(1, d);
      }
      case 'line': {
        const s = Math.sin(t.angle), c = Math.cos(t.angle);
        const along = dx * s + dz * c;
        const perp = Math.abs(dx * c - dz * s);
        return along >= -pad && along <= t.len + pad && perp <= t.width / 2 + pad;
      }
      default: return false;
    }
  }

  update(dt) {
    this.time += dt;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      t.t += dt;
      this.layout(t);
      if (t.t >= t.delay) {
        t.onResolve?.(t);
        this.remove(i, true);
      }
    }
    // the moment it hits: a hot flash that pops slightly outward and fades
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      const k = f.t / FLASH_T;
      const u = f.mat.uniforms;
      u.uFlash.value = 1;
      u.uAlpha.value = Math.max(0, 1 - k) ** 1.5;
      u.uTime.value = this.time;
      f.g.position.y = 0.09;
      f.g.scale.setScalar(1 + k * 0.06);
      if (f.t >= FLASH_T) {
        this.scene.remove(f.g);
        f.geo.dispose();
        f.mat.dispose();
        this.flashes.splice(i, 1);
      }
    }
  }

  remove(i, flash = false) {
    const t = this.list[i];
    this.list.splice(i, 1);
    if (flash) { this.flashes.push({ g: t.g, geo: t.geo, mat: t.mat, t: 0 }); return; }
    this.scene.remove(t.g);
    t.geo.dispose();
    t.mat.dispose();
  }

  clearFor(owner) {
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].owner === owner) this.remove(i);
  }

  dispose() {
    while (this.list.length) this.remove(0);
    for (const f of this.flashes) { this.scene.remove(f.g); f.geo.dispose(); f.mat.dispose(); }
    this.flashes = [];
  }
}
