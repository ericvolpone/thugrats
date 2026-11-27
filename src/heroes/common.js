/**
 * Shared upgrade builders for every hero's ability kit (see heroes/lenny/abilities.js
 * for what the fields mean).
 */
import * as THREE from 'three';

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

// ── pairing procs (talent / gear links, see ctx.link in game/stats.js) ─────
// They use the partner ability's own stats, so its upgrades scale the combo,
// and the damage is credited to it.

/**
 * Free cast: the partner fires right now at mob/point `t` without spending its
 * cooldown. Falls back to its own targeting when it doesn't aim at things.
 */
export function freeCast(run, a, t) {
  let tgt = a.def.ready(run, a);
  if (!tgt || (Array.isArray(tgt) && !tgt.length)) return false;
  if (t && Array.isArray(tgt)) tgt = [t, ...tgt.filter((x) => x !== t)];
  else if (t && typeof tgt === 'object' && 'x' in tgt) tgt = t;
  return a.def.fire(run, a, tgt) !== false;
}

/** The partner's explosion at (x, z): `dmg` and `area` scale its damage / radius. */
export function explodeAt(run, a, x, z, { dmg = 1, area = 1, small = false } = {}) {
  run.explode(x, z, a.stat('area') * area, a.stat('damage') * dmg, a, { noProc: true, small });
}

/** Burning ground with the partner's damage per second. */
export function fireAt(run, a, x, z, { r = a.stat('area'), life = 3, dps = a.stat('damage') } = {}) {
  run.zone({ x, z, r, life, dps: dps * (1 + run.stats.burnDmg), kind: 'fire', ability: a });
}

/** A bullet from (x, z) at the nearest other thug, credited to `a`. */
export function boltFrom(run, a, x, z, { dmg = a.stat('damage'), skip = null, range = 10, color, pierce = 0 } = {}) {
  let best = null, bd = range * range;
  run.mobs.each(x, z, range, (m) => {
    if (m === skip || m.dead) return;
    const d = (m.x - x) ** 2 + (m.z - z) ** 2;
    if (d < bd) { bd = d; best = m; }
  });
  if (!best) return null;
  run.shoot({ x, z, y: 0.8, angle: Math.atan2(best.x - x, best.z - z), speed: 36, dmg, range: range + 2, pierce, ability: a, kind: 'bullet', color });
  return best;
}

/** n bullets in a ring around (x, z). */
export function ringShot(run, a, x, z, n, dmg, color) {
  for (let i = 0; i < n; i++) run.shoot({ x, z, y: 0.7, angle: (i / n) * Math.PI * 2, speed: 30, dmg, range: 9, ability: a, kind: 'bullet', color });
}

// ── statuses on thugs (marks, shock, acid, chill, frozen...) ───────────────
// m.st[key] = {n, until}: stacks that expire `dur` seconds after the last add.

/** Add `n` stacks of `key` (capped at `max`) for `dur` seconds; returns the new count. */
export function addStatus(run, m, key, n = 1, dur = 5, max = 10) {
  if (m.dead) return 0;
  m.st ??= {};
  const s = m.st[key];
  const cur = s && s.until > run.time ? s.n : 0;
  const v = Math.min(max, cur + n);
  m.st[key] = { n: v, until: run.time + dur };
  return v;
}

/** Current stacks of `key` on a thug (0 if none / expired). */
export function statusN(run, m, key) {
  const s = m.st?.[key];
  return s && s.until > run.time ? s.n : 0;
}

/** Remove a status; returns how many stacks it had. */
export function clearStatus(run, m, key) {
  const n = statusN(run, m, key);
  if (m.st) delete m.st[key];
  return n;
}

/** Tint a thug for `dur` seconds (shows a status). */
const _tints = new Map();
export function tint(run, m, color, dur = 1) {
  let c = _tints.get(color);
  if (!c) { c = new THREE.Color(color); _tints.set(color, c); }
  m.tintColor = c;
  m.tintUntil = run.time + dur;
}

/**
 * Wall slam: if `m` hits a wall (anything it can't stand on) within `window`
 * seconds while still flying from knockback, it takes `dmg` (credited to `a`).
 * Call it right after a run.hit with knock. onSlam(m) runs when it connects.
 */
export function slamOnWall(run, m, a, dmg, window = 0.5, onSlam) {
  if (m.dead || m.tier >= 2) return;
  m.slam = { dmg, ability: a, until: run.time + window, onSlam };
}
