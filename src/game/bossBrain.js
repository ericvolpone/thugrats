import { rand, TAU } from '../util.js';
import { sfx } from '../audio.js';

/**
 * Boss / titan AI: walks at you and, whenever a mechanic is off cooldown,
 * casts it with a ground telegraph you have to step out of (or into, for
 * donuts). See data/mobs.js BOSSES for the mechanic list.
 */
export class BossBrain {
  constructor(run, m) {
    this.run = run;
    this.m = m;
    this.mechs = m.boss.mechanics.map((d) => ({ d, cd: d.cd * rand(0.35, 0.7) }));
    this.busyT = 0;
    this.dash = null;
    this.pose = 0;
    this.dmgScale = m.dmg / m.boss.dmg;
  }

  get busy() { return this.busyT > 0 || !!this.dash; }

  update(dt, dist) {
    const m = this.m;
    this.pose *= Math.exp(-6 * dt);
    if (this.dash) {
      const d = this.dash;
      d.left -= Math.hypot(d.vx, d.vz) * dt;
      const p = this.run.player;
      if (!d.hit && p.y < 1.8 && Math.hypot(p.x - m.x, p.z - m.z) < m.radius + p.radius + 0.3) {
        d.hit = true;
        this.run.hurtPlayer(d.dmg, m);
      }
      if (d.left <= 0) this.dash = null;
      return;
    }
    if (this.busyT > 0) {
      this.busyT -= dt;
      return;
    }
    let ready = null;
    for (const mm of this.mechs) {
      mm.cd -= dt;
      if (!ready && mm.cd <= 0 && dist < 24) ready = mm;
    }
    if (ready) {
      ready.cd = ready.d.cd * rand(0.9, 1.15) * (m.tier === 3 && m.hp < m.maxHp * 0.4 ? 0.75 : 1);
      this.cast(ready.d);
    }
  }

  tele(shape, o, delay, dmg, after) {
    const run = this.run;
    const t = run.telegraphs.add(shape, o, delay, (tt) => {
      const p = run.player;
      if (p.y < 1.6 && run.telegraphs.constructor.contains(tt, p.x, p.z, p.radius * 0.6)) run.hurtPlayer(dmg, this.m);
      run.fx.telegraphPop(tt);
      after?.(tt);
    });
    if (t) t.owner = this.m;
    return t;
  }

  cast(d) {
    const run = this.run, m = this.m, p = run.player;
    const dmg = (d.dmg ?? 0) * this.dmgScale;
    const toP = Math.atan2(p.x - m.x, p.z - m.z);
    m.facing = toP;
    sfx('warn', 0.3);
    switch (d.type) {
      case 'slam': {
        const n = d.count ?? 1;
        for (let i = 0; i < n; i++) {
          const a = rand(0, TAU), r = i ? rand(2, d.spread ?? 5) : 0;
          this.tele('circle', { x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r, r: d.radius }, d.delay, dmg, () => run.shake(0.25));
        }
        this.busyT = 0.5;
        this.pose = -0.4;
        break;
      }
      case 'rain': {
        for (let i = 0; i < d.count; i++) {
          const a = rand(0, TAU), r = i === 0 ? 0 : rand(1, d.area);
          this.tele('circle', { x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r, r: d.radius }, d.delay + i * 0.08, dmg);
        }
        this.busyT = 0.6;
        this.pose = -0.3;
        break;
      }
      case 'cone':
        this.tele('cone', { x: m.x, z: m.z, angle: toP, len: d.length, arc: d.angle }, d.delay, dmg, () => { this.pose = 0.6; run.shake(0.2); });
        this.busyT = d.delay;
        this.pose = -0.35;
        break;
      case 'charge': {
        const len = d.length;
        this.tele('line', { x: m.x, z: m.z, angle: toP, len, width: d.width }, d.delay, 0, () => {
          const sp = 30;
          this.dash = { vx: Math.sin(toP) * sp, vz: Math.cos(toP) * sp, left: len, dmg, hit: false };
          this.pose = 0.5;
        });
        this.busyT = d.delay;
        this.pose = -0.3;
        break;
      }
      case 'cross': {
        const a0 = toP + Math.PI / 4;
        for (let i = 0; i < 4; i++) {
          this.tele('line', { x: m.x, z: m.z, angle: a0 + (i * Math.PI) / 2, len: d.length, width: d.width }, d.delay, dmg / 1, null);
        }
        this.busyT = d.delay;
        this.pose = -0.4;
        break;
      }
      case 'donut':
        this.tele('donut', { x: m.x, z: m.z, inner: d.inner, outer: d.outer }, d.delay, dmg, () => run.shake(0.3));
        this.busyT = d.delay;
        this.pose = -0.5;
        break;
      case 'nova':
        this.busyT = 0.6;
        this.pose = -0.4;
        run.later(0.5, () => {
          if (m.dead) return;
          for (let i = 0; i < d.count; i++) {
            const a = (i / d.count) * TAU + rand(0, 0.2);
            run.enemyShot({ x: m.x, z: m.z, y: 1.2, angle: a, speed: d.speed, dmg, color: d.color, size: 0.45, src: m });
          }
          run.fx.ring(m.x, m.z, 3, d.color, 0.4);
        });
        break;
      case 'barrage':
        this.busyT = 0.9;
        for (let i = 0; i < d.count; i++) {
          run.later(0.3 + i * 0.08, () => {
            if (m.dead) return;
            const a = Math.atan2(p.x - m.x, p.z - m.z) + rand(-d.spread, d.spread) * 0.5;
            run.enemyShot({ x: m.x, z: m.z, y: 1.4, angle: a, speed: d.speed, dmg, color: d.color, size: 0.35, src: m });
          });
        }
        break;
      case 'summon':
        this.busyT = 0.8;
        this.pose = -0.3;
        for (let i = 0; i < d.count; i++) {
          const a = (i / d.count) * TAU;
          const x = m.x + Math.sin(a) * (m.radius + 2), z = m.z + Math.cos(a) * (m.radius + 2);
          run.mobs.spawn(d.mob, x, z, false);
          run.fx.burst(x, 0.5, z, '#b06cff', 6, 3);
        }
        break;
      default: break;
    }
  }
}
