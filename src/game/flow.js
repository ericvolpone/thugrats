/**
 * Flow field toward the player for ground mobs. The arena is cut into 2m cells;
 * a cell is a wall if something taller than a mob can hop (HOP_MAX) covers its
 * centre. Low props (cars, crates, fences, benches) are passable: mobs hop them.
 * A BFS from the player's cell gives every cell its step distance, and a mob
 * walks toward the neighbouring cell with the smallest distance. Rebuilt when
 * the player changes cell (at most every REBUILD seconds).
 *
 * Mobs only follow the field when walking straight at the player isn't working
 * (a wall in the way, or no progress for a while); see MobManager.update.
 */
export const HOP_MAX = 1.8;
const CELL = 2;
const REBUILD = 0.3;
const FAR = 0xffff;
// 8 neighbours: dx, dz, cost (diagonals only when both sides are open)
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export class FlowField {
  constructor(world) {
    this.world = world;
    this.half = world.half;
    this.n = Math.ceil((this.half * 2) / CELL);
    this.wall = new Uint8Array(this.n * this.n);
    this.dist = new Uint16Array(this.n * this.n).fill(FAR);
    this.queue = new Int32Array(this.n * this.n);
    this.pc = -1;
    this.t = 0;
    const pad = 0.4;
    for (let cz = 0; cz < this.n; cz++) {
      for (let cx = 0; cx < this.n; cx++) {
        const x = (cx + 0.5) * CELL - this.half, z = (cz + 0.5) * CELL - this.half;
        let w = Math.abs(x) > this.half - 1.5 || Math.abs(z) > this.half - 1.5;
        if (!w) for (const r of world.rects) if (r.h > HOP_MAX && x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad) { w = true; break; }
        if (!w) for (const c of world.circles) if (c.h > HOP_MAX && (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + pad) ** 2) { w = true; break; }
        this.wall[cz * this.n + cx] = w ? 1 : 0;
      }
    }
  }

  cellOf(x, z) {
    const cx = Math.floor((x + this.half) / CELL), cz = Math.floor((z + this.half) / CELL);
    if (cx < 0 || cz < 0 || cx >= this.n || cz >= this.n) return -1;
    return cz * this.n + cx;
  }

  isWall(x, z) {
    const c = this.cellOf(x, z);
    return c < 0 || this.wall[c] === 1;
  }

  update(dt, px, pz) {
    this.t -= dt;
    const c = this.cellOf(px, pz);
    if (c < 0 || c === this.pc || this.t > 0) return;
    this.pc = c;
    this.t = REBUILD;
    const { n, wall, dist, queue } = this;
    dist.fill(FAR);
    let head = 0, tail = 0;
    dist[c] = 0;
    queue[tail++] = c;
    while (head < tail) {
      const i = queue[head++];
      const cx = i % n, cz = (i / n) | 0, d = dist[i] + 1;
      for (let k = 0; k < 8; k++) {
        const nx = cx + NB[k][0], nz = cz + NB[k][1];
        if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
        const j = nz * n + nx;
        if (wall[j] || dist[j] <= d) continue;
        if (k >= 4 && (wall[cz * n + nx] || wall[nz * n + cx])) continue; // no corner cutting
        dist[j] = d;
        queue[tail++] = j;
      }
    }
  }

  /** Unit direction [x, z] to walk from (x, z) toward the player, or null if unknown. */
  dir(x, z) {
    const c = this.cellOf(x, z);
    if (c < 0) return null;
    const { n, wall, dist } = this;
    const cx = c % n, cz = (c / n) | 0;
    let best = dist[c], bx = 0, bz = 0;
    for (let k = 0; k < 8; k++) {
      const nx = cx + NB[k][0], nz = cz + NB[k][1];
      if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
      const j = nz * n + nx;
      if (k >= 4 && (wall[cz * n + nx] || wall[nz * n + cx])) continue;
      if (dist[j] < best) { best = dist[j]; bx = nx; bz = nz; }
    }
    if (best >= dist[c] || best === FAR) return null;
    const tx = (bx + 0.5) * CELL - this.half, tz = (bz + 0.5) * CELL - this.half;
    const dx = tx - x, dz = tz - z, l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  }

  /** Is there a wall cell on the straight line between two points? */
  blockedLine(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.ceil(d / (CELL * 0.75));
    for (let i = 1; i < steps; i++) {
      const k = i / steps;
      if (this.isWall(x0 + (x1 - x0) * k, z0 + (z1 - z0) * k)) return true;
    }
    return false;
  }
}
