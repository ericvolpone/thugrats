/**
 * Shared upgrade builders for every hero's ability kit (see heroes/lenny/abilities.js
 * for what the fields mean).
 */
export const pctUp = (stat, label, v, fmt) => ({ stat, label, kind: 'pct', v, fmt });
export const scUp = (stat, label, v, fmt) => ({ stat, label, kind: 'add', v, fmt });
export const addUp = (stat, label, values, fmt, max) => ({ stat, label, kind: 'add', values, fmt, max });

export const DMG = pctUp('damage', 'Damage', 20);
export const CD = pctUp('cooldown', 'Recharge Rate', 12);
export const AREA = pctUp('area', 'Area', 15);
export const DUR = pctUp('duration', 'Duration', 18);

/**
 * Auras (orbiting cash, fists, stars, drones) are always on: no cooldown or
 * duration, just damage, radius and how many things spin. `label` names the count.
 */
export const AURA_UPS = (label) => [DMG, pctUp('area', 'Radius', 15), addUp('count', label, [1, 1, 1, 2, 2], null, 10)];

/** For buffs/orbits that can't overlap: once duration covers the cooldown, more of either is wasted. */
export const permanentUptime = (a, stat) => (stat === 'cooldown' || stat === 'duration') && a.stat('duration') >= a.stat('cooldown');

// ── attack helpers shared by every kit ──────────────────────────────────────

export const angleTo = (run, t) => Math.atan2(t.x - run.player.x, t.z - run.player.z);

/** Melee swipe: hits everything in a cone of half-angle `half` out to `r`. */
export function cone(run, a, { x = run.player.x, z = run.player.z, angle, r, half = 0.7, dmg, knock = 3, color = '#ffffff', onHit }) {
  let n = 0;
  for (const m of run.mobs.near(x, z, r + 0.6)) {
    const dx = m.x - x, dz = m.z - z;
    let d = Math.atan2(dx, dz) - angle;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) > half && Math.hypot(dx, dz) > m.radius + 0.8) continue;
    run.hit(m, dmg, a, { knock, fromX: x, fromZ: z });
    onHit?.(m);
    n++;
  }
  run.fx.arc(x, z, angle, r, half, color);
  return n;
}

/** Straight line hit (beams, charges, shockwaves). */
export function line(run, a, { x = run.player.x, z = run.player.z, angle, len, width = 0.8, dmg, knock = 2, color = '#9ad8ff', onHit, y = 0.7 }) {
  const sx = Math.sin(angle), cz = Math.cos(angle);
  for (const m of run.mobs.near(x + (sx * len) / 2, z + (cz * len) / 2, len / 2 + width + 1)) {
    const dx = m.x - x, dz = m.z - z;
    const along = dx * sx + dz * cz;
    if (along < -0.5 || along > len) continue;
    if (Math.abs(dx * cz - dz * sx) > width + m.radius) continue;
    run.hit(m, dmg, a, { knock, fromX: m.x - sx, fromZ: m.z - cz });
    onHit?.(m);
  }
  run.fx.beam(x, z, x + sx * len, z + cz * len, color, width * 1.2, 0.22, y);
}

/** Damage that arcs from target to target (lightning). */
export function chain(run, a, first, { jumps, range = 6, dmg, falloff = 0.85, color = '#9ad8ff', onHit }) {
  const hit = new Set();
  jumps += run.stats.extraJumps ?? 0;
  let cur = first, px = run.player.x, pz = run.player.z, d = dmg;
  for (let i = 0; i <= jumps && cur; i++) {
    hit.add(cur.id);
    run.fx.beam(px, pz, cur.x, cur.z, color, 0.14, 0.18, 1);
    run.hit(cur, d, a, { knock: 0.5 });
    onHit?.(cur);
    px = cur.x; pz = cur.z;
    d *= falloff;
    let best = null, bd = range * range;
    run.mobs.each(px, pz, range, (m) => {
      if (hit.has(m.id) || m.dead) return;
      const q = (m.x - px) ** 2 + (m.z - pz) ** 2;
      if (q < bd) { bd = q; best = m; }
    });
    cur = best;
  }
}

/** Ring blast around a point. */
export function nova(run, a, { x = run.player.x, z = run.player.z, r, dmg, knock = 6, color = '#ffffff', root = 0, onHit }) {
  for (const m of run.mobs.near(x, z, r)) {
    run.hit(m, dmg, a, { knock, fromX: x, fromZ: z });
    if (root) m.rootT = Math.max(m.rootT, m.tier >= 2 ? root * 0.25 : root);
    onHit?.(m);
  }
  run.fx.ring(x, z, r, color, 0.35);
}

/** Timed slow on a mob. */
export function chill(m, amount, t) {
  m.slow = Math.max(m.slowT > 0 ? m.slow : 0, m.tier >= 2 ? amount * 0.4 : amount);
  m.slowT = Math.max(m.slowT, t);
}

/** A timed self-buff (see run.buffs). */
export function buff(run, a, extra) {
  run.buffs[a.def.id] = { t: a.stat('duration'), max: a.stat('duration'), src: a.def.id, ...extra };
}
