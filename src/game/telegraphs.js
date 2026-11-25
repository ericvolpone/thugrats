import * as THREE from 'three';

/**
 * Ground warnings for boss/titan mechanics. A dim area shows the danger zone
 * and a brighter fill grows until it resolves; then onResolve() runs.
 * Shapes: circle {x,z,r} · donut {x,z,inner,outer} · cone {x,z,angle,len,arc}
 * · line {x,z,angle,len,width}. Angles: 0 = +Z, atan2(dx, dz) convention.
 */
export class Telegraphs {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.baseMat = new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
    this.fillMat = new THREE.MeshBasicMaterial({ color: '#ff5a2a', transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide });
    this.edgeMat = new THREE.MeshBasicMaterial({ color: '#ff3030', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
  }

  add(shape, o, delay, onResolve) {
    let geo, edge;
    switch (shape) {
      case 'circle':
        geo = new THREE.CircleGeometry(o.r, 36);
        edge = new THREE.RingGeometry(o.r - 0.12, o.r, 36);
        break;
      case 'donut':
        geo = new THREE.RingGeometry(o.inner, o.outer, 48);
        edge = new THREE.RingGeometry(o.inner, o.inner + 0.15, 48);
        break;
      case 'cone': {
        const arc = (o.arc * Math.PI) / 180;
        geo = new THREE.CircleGeometry(o.len, 24, -arc / 2, arc);
        edge = new THREE.RingGeometry(o.len - 0.15, o.len, 24, 1, -arc / 2, arc);
        break;
      }
      case 'line':
        geo = new THREE.PlaneGeometry(o.width, o.len).translate(0, o.len / 2, 0);
        edge = new THREE.PlaneGeometry(o.width, 0.2).translate(0, o.len - 0.1, 0);
        break;
      default: return null;
    }
    geo.rotateX(-Math.PI / 2);
    edge.rotateX(-Math.PI / 2);
    if (shape === 'line') {
      // after rotateX, the +Y extent becomes -Z; flip so it extends toward +Z
      geo.rotateY(Math.PI);
      edge.rotateY(Math.PI);
    }
    const g = new THREE.Group();
    g.position.set(o.x, 0.06, o.z);
    if (shape === 'cone') g.rotation.y = o.angle - Math.PI / 2;
    if (shape === 'line') g.rotation.y = o.angle;
    const base = new THREE.Mesh(geo, this.baseMat);
    const fill = new THREE.Mesh(geo, this.fillMat);
    fill.position.y = 0.01;
    const e = new THREE.Mesh(edge, this.edgeMat);
    e.position.y = 0.02;
    g.add(base, fill, e);
    g.renderOrder = 2;
    this.scene.add(g);
    const t = { shape, ...o, delay, t: 0, g, fill, geo, edgeGeo: edge, onResolve };
    this.list.push(t);
    this.layout(t);
    return t;
  }

  layout(t) {
    const k = Math.min(1, t.t / t.delay);
    if (t.shape === 'line') t.fill.scale.set(1, 1, Math.max(0.001, k));
    else t.fill.scale.set(Math.max(0.001, k), 1, Math.max(0.001, k));
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
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      t.t += dt;
      this.layout(t);
      if (t.t >= t.delay) {
        t.onResolve?.(t);
        this.remove(i);
      }
    }
  }

  remove(i) {
    const t = this.list[i];
    this.scene.remove(t.g);
    t.geo.dispose();
    t.edgeGeo.dispose();
    this.list.splice(i, 1);
  }

  clearFor(owner) {
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].owner === owner) this.remove(i);
  }

  dispose() {
    while (this.list.length) this.remove(0);
  }
}
