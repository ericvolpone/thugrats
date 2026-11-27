import { sfx } from '../../audio.js';
import { TAU, rand } from '../../util.js';
import { pctUp, scUp, addUp, DMG, CD, AREA, DUR, angleTo, line, nova, chain, chill, freeCast, ringShot, addStatus, statusN, clearStatus, tint, AURA_UPS } from '../common.js';

/**
 * Professor Pudding — the Mad Scientist. Signature: STATUS COMBOS.
 *
 * Every science ability is an ingredient that doses thugs with an element:
 *   ⚡ shock    Tesla Coil, Drone Swarm, Robo-Nanny, Orbital Death Ray
 *   ❄️ frozen   Freeze Ray, Cryo Field
 *   🧪 acid     Acid Rain, Slime Puddle
 *   🍮 pudding  Pudding Blaster
 *   🔬 shrunk   Shrink Ray (a catalyst: amplifies any reaction on that thug)
 *
 * When a thug that already carries one element gets dosed with a different one,
 * the two REACT (see REACTIONS / react()): both are used up, a reaction goes off
 * with its own effect and a floating label, and the Prof gains Eureka
 * (PROF_RESOURCE). Reactions on a shrunk thug are amplified.
 *
 * Talents and gear can't import this file; they reach the lab through any prof
 * ability def: `p.def.lab.dose(run, m, key, p)`, `p.def.lab.react(run, m, k1, k2, p)`.
 * Flags read here (all default off): statusDur, reactDmg, reactEureka,
 * shatterShards, reactDeathRay, brittleVuln, madGenius, stickyPudding,
 * deepFreeze, freezeRoot, supercharged, teslaReach, teslaFork, acidMerge,
 * singularity, robotUprising.
 */

const alive = (m) => m && !m.dead && m.hp > 0;

// ── the lab: statuses and reactions ─────────────────────────────────────────

/** The elements (and the catalyst) with their tint colours. */
export const STATUS = {
  shock: { name: 'Shock', color: '#9ad8ff' },
  frozen: { name: 'Frozen', color: '#bff0ff' },
  acid: { name: 'Acid', color: '#b8ff5a' },
  pudding: { name: 'Pudding', color: '#e8b86b' },
  shrunk: { name: 'Shrunk', color: '#ff8fd0' },
};
const ELEMENTS = ['shock', 'frozen', 'acid', 'pudding'];

/** The six reactions, one per pair of elements. Keyed by the two keys sorted. */
const pairKey = (a, b) => (a < b ? `${a}+${b}` : `${b}+${a}`);
export const REACTIONS = {
  [pairKey('shock', 'frozen')]: { id: 'shatter', name: 'SHATTER', color: '#bff0ff', desc: 'ice blast around the thug' },
  [pairKey('shock', 'acid')]: { id: 'electrolysis', name: 'ELECTROLYSIS', color: '#c8ff6a', desc: 'arcs to every acid-soaked thug nearby' },
  [pairKey('frozen', 'acid')]: { id: 'brittle', name: 'BRITTLE', color: '#e0fff0', desc: 'armor gone, takes +30% damage' },
  [pairKey('frozen', 'pudding')]: { id: 'flan', name: 'FLASH FLAN', color: '#ffe6b0', desc: 'frozen solid' },
  [pairKey('acid', 'pudding')]: { id: 'curdle', name: 'CURDLE', color: '#d8e06a', desc: 'splashes acid onto thugs around' },
  [pairKey('shock', 'pudding')]: { id: 'cling', name: 'STATIC CLING', color: '#ffd27a', desc: 'yanks thugs together and zaps them' },
};

/** How strong a dose from ability `a` is (its damage, normalised per ability by def.pot). */
const potOf = (a) => (a ? a.stat('damage') * (a.def.pot ?? 1) : 20);
const statusDur = (run, key) => (4 + (run.flags.statusDur ?? 0)) * (key === 'pudding' && run.flags.stickyPudding ? 2 : 1);

/** Timed +damage-taken (rides on run.hit's m.shrunk / m.shrunkUntil). */
function vuln(run, m, amt, dur) {
  const on = m.shrunkUntil > run.time;
  m.shrunk = Math.max(on ? m.shrunk : 0, amt);
  m.shrunkUntil = Math.max(on ? m.shrunkUntil : 0, run.time + dur);
}

/** Is thug `m` standing in one of the Prof's acid pools? */
const ACID_POOLS = ['acid_rain', 'slime'];
const inAcid = (run, m) => run.combat.zones.some((zn) => ACID_POOLS.includes(zn.ability?.def?.id) && zn.t < zn.life && Math.hypot(zn.x - m.x, zn.z - m.z) < zn.r + m.radius);

/** One floating reaction label per 0.12s at most (they'd drown the damage numbers). */
function label(run, m, text, color) {
  const c = run.counters;
  if ((c.profLabelT ?? -1) > run.time) return;
  c.profLabelT = run.time + 0.12;
  run.fx.number(m.x, (m.height ?? 1.4) + 1.1, m.z, text, color, true);
}

let depth = 0; // reactions that dose (Curdle, Grand Experiment) can set off more, two deep at most

/**
 * Dose thug `m` with status `key` from ability `a`. If it already carries a
 * different element, the two react instead. Returns the reaction id or null.
 */
function dose(run, m, key, a, pot = potOf(a)) {
  if (!alive(m) || !STATUS[key]) return null;
  if (key !== 'shrunk' && depth < 2) {
    for (const other of ELEMENTS) {
      if (other !== key && statusN(run, m, other)) return react(run, m, key, other, a, { pot: pot + (m.st[other].pot ?? pot) });
    }
  }
  addStatus(run, m, key, 1, statusDur(run, key), 1);
  m.st[key].pot = pot;
  tint(run, m, STATUS[key].color, statusDur(run, key));
  return null;
}

/** Credit-safe hit: skips dead thugs. */
const zap = (run, m, dmg, a, o) => { if (alive(m)) run.hit(m, dmg, a, o); };

/**
 * React elements k1 + k2 on thug `m` (both are used up). `a` is the ability that
 * set it off (gets the credit). opts.pot overrides the power (sum of both doses),
 * opts.amp forces an amplified reaction, opts.gain = false skips the Eureka.
 */
function react(run, m, k1, k2, a, opts = {}) {
  const R = REACTIONS[pairKey(k1, k2)];
  if (!R || !alive(m)) return null;
  const pot = opts.pot ?? (m.st?.[k1]?.pot ?? potOf(a)) + (m.st?.[k2]?.pot ?? potOf(a));
  clearStatus(run, m, k1);
  clearStatus(run, m, k2);
  const amp = !!(opts.amp || statusN(run, m, 'shrunk') || run.buffs.eureka?.amp);
  const P = pot * (1 + (run.flags.reactDmg ?? 0)) * (amp ? 1.6 : 1); // reaction power
  const S = amp ? 1.35 : 1; // reaction size
  const x = m.x, z = m.z;
  depth++;
  try {
    switch (R.id) {
      case 'shatter': {
        run.explode(x, z, 2.4 * S, P * 0.7, a, { small: true, color: '#bff0ff' });
        run.fx.burst(x, 0.8, z, '#e8fbff', 18, 6, 0.5);
        const k = run.flags.shatterShards;
        if (k) ringShot(run, a, x, z, 6, P * 0.35 * k, '#bff0ff');
        break;
      }
      case 'electrolysis': {
        zap(run, m, P * 0.9, a, { knock: 0.5, color: R.color });
        let n = 0;
        const cap = 12 + (run.flags.electroMax ?? 0);
        for (const o of run.mobs.near(x, z, 7 * S)) {
          if (o === m || n >= cap || !(statusN(run, o, 'acid') || inAcid(run, o))) continue;
          n++;
          clearStatus(run, o, 'acid');
          run.fx.beam(x, z, o.x, o.z, n % 2 ? '#c8ff6a' : '#9ad8ff', 0.1, 0.2, 0.6);
          zap(run, o, P * 0.7, a, { knock: 0.3, color: R.color });
        }
        break;
      }
      case 'brittle': {
        zap(run, m, P * 0.5, a, { color: R.color });
        if (alive(m)) {
          const dur = 5 * S;
          vuln(run, m, (0.3 + (run.flags.brittleVuln ?? 0)) * (amp ? 1.5 : 1), dur);
          if (m.brittleArmor == null) { m.brittleArmor = m.armor ?? 0; m.armor = 0; }
          m.brittleUntil = run.time + dur;
          run.later(dur + 0.05, () => {
            if (m.brittleArmor != null && !(m.brittleUntil > run.time)) { m.armor = m.brittleArmor; m.brittleArmor = null; }
          });
          tint(run, m, R.color, dur);
        }
        run.fx.burst(x, 1, z, '#e0fff0', 12, 3, 0.4);
        break;
      }
      case 'flan': {
        zap(run, m, P * 0.8, a, { color: R.color });
        if (alive(m)) {
          m.rootT = Math.max(m.rootT ?? 0, (m.tier >= 2 ? 0.25 : m.tier ? 0.6 : 1.8) * S);
          m.frozenUntil = run.time + 1.8 * S;
          tint(run, m, R.color, 1.8 * S);
        }
        for (const o of run.mobs.near(x, z, 2.2 * S)) if (o !== m) chill(o, 0.5, 2);
        run.fx.ring(x, z, 2.2 * S, '#ffe6b0', 0.35);
        break;
      }
      case 'curdle': {
        zap(run, m, P * 0.5, a, { color: R.color });
        run.zone({ x, z, r: 2.2 * S, life: 3, dps: P * 0.3, slow: 0.4, kind: 'slime', color: '#d8e06a', ability: a });
        let n = 0;
        for (const o of run.mobs.near(x, z, 2.8 * S)) {
          if (o === m || n++ >= 6) continue;
          dose(run, o, 'acid', a, pot * 0.4);
        }
        break;
      }
      case 'cling': {
        let n = 0;
        for (const o of run.mobs.near(x, z, 4.5 * S)) {
          if (o === m || n >= 8) continue;
          n++;
          const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz) || 1;
          if (o.tier < 2) { o.kx += (dx / d) * 7; o.kz += (dz / d) * 7; }
          run.fx.beam(x, z, o.x, o.z, '#ffd27a', 0.07, 0.18, 0.9);
          zap(run, o, P * 0.4, a, { color: R.color });
        }
        zap(run, m, P * 0.6, a, { color: R.color });
        break;
      }
    }
  } finally {
    depth--;
  }
  if (alive(m)) tint(run, m, R.color, 0.5);
  label(run, m, `${amp ? 'MEGA ' : ''}${R.name}!`, R.color);
  if (opts.gain !== false) {
    const g = (amp ? 5 : 3) * (1 + (run.flags.reactEureka ?? 0));
    run.gainRes(g);
  }
  // Slot Machine (3): every Nth reaction calls a free Orbital Death Ray
  const every = run.flags.reactDeathRay;
  if (every && run.every('profReactRay', every)) {
    const dr = run.abilityById('death_ray');
    if (dr) freeCast(run, dr, null);
  }
  sfx('hit', 0.08);
  return R.id;
}

/** EUREKA! A burst of inspiration: every ability recharges faster for a while. */
function eurekaMoment(run, dur = 4) {
  run.buffs.eureka = { t: dur, max: dur, src: 'eureka', fx: '#ffd23f', rate: 0.4, amp: !!run.flags.madGenius };
  run.fx.ring(run.player.x, run.player.z, 3.5, '#ffd23f', 0.6);
  run.fx.number(run.player.x, 2.6, run.player.z, 'EUREKA!', '#ffd23f', true);
  sfx('frenzy', 0.1);
}

/**
 * Pocket Black Hole's mixing bowl: twice a second, up to `cap` thugs inside zone
 * `zn` each catch an element from another thug inside (and react).
 */
function stir(run, zn, a, dt, cap) {
  zn.mixT = (zn.mixT ?? 0.5) - dt;
  if (zn.mixT > 0) return;
  zn.mixT = 0.5;
  const inside = run.mobs.near(zn.x, zn.z, zn.r);
  const donors = [];
  for (const m of inside) for (const k of ELEMENTS) if (statusN(run, m, k)) donors.push({ m, k, pot: m.st[k].pot ?? potOf(a) });
  if (!donors.length) return;
  let n = 0;
  for (const m of inside) {
    if (n >= cap) break;
    const d = donors[Math.floor(Math.random() * donors.length)];
    if (d.m === m || statusN(run, m, d.k) || !alive(m)) continue;
    n++;
    run.fx.beam(d.m.x, d.m.z, m.x, m.z, '#b07aff', 0.06, 0.2, 0.6);
    dose(run, m, d.k, a, d.pot);
  }
}

/** What talents and gear reach through def.lab. */
const LAB = { STATUS, REACTIONS, ELEMENTS, dose, react, stir, potOf, alive, inAcid };

/**
 * The Prof's resource. Reactions fill it. When it's full: EUREKA! (4s of +40%
 * Recharge Rate). If you own Grand Experiment it saves up for that instead.
 */
export const PROF_RESOURCE = {
  id: 'eureka', name: 'Eureka', icon: '💡', color: '#ffd23f', max: 100, start: 0,
  desc: 'Status reactions build Eureka. When it fills: EUREKA! — 4s of +40% Recharge Rate. Grand Experiment spends it instead.',
  tick(run) {
    const r = run.res;
    if (r.value >= r.max && !run.abilityById('grand_experiment')) {
      run.spendRes(r.max);
      eurekaMoment(run, 4);
    }
  },
};

export const PROF_START = 'pudding_blaster';

// ── ability helpers ─────────────────────────────────────────────────────────

/**
 * Lab Coat 5-piece (flags.teslaFork = damage fraction): every thug a Tesla arc
 * hits forks a side arc to up to 2 more nearby thugs (shocking them). `seen`
 * keeps forks from zapping the same thug twice in one cast.
 */
function forkArc(run, a, from, dmg, seen) {
  let n = 0;
  run.mobs.each(from.x, from.z, 4.5, (m) => {
    if (n >= 2 || m === from || !alive(m) || seen.has(m.id)) return;
    seen.add(m.id);
    n++;
    run.fx.beam(from.x, from.z, m.x, m.z, '#c8ecff', 0.08, 0.14, 1);
    run.hit(m, dmg, a, { knock: 0.3 });
    dose(run, m, 'shock', a);
  });
}

/**
 * A slime/acid pool. Alchemist 5-piece (flags.acidMerge = k): a new pool that
 * lands on one of the same ability's live pools merges into it instead, growing
 * it, refreshing its time and stacking its acid (both capped).
 */
function pool(run, a, o) {
  const k = run.flags.acidMerge;
  if (k) {
    const zn = run.combat.zones.find((z) => z.ability === a && z.life - z.t > 0.3 && Math.hypot(z.x - o.x, z.z - o.z) < z.r + o.r * 0.5);
    if (zn) {
      zn.r = Math.min(o.r * (1.5 + 0.25 * k), Math.max(zn.r, Math.hypot(zn.r, o.r * 0.7)));
      zn.life = zn.t + Math.max(zn.life - zn.t, o.life);
      zn.dps = Math.min(o.dps * (1 + 0.5 * k), Math.max(zn.dps, o.dps) + o.dps * 0.25 * k);
      run.fx.ring(zn.x, zn.z, zn.r, '#b8ff5a', 0.4);
      return;
    }
  }
  run.zone(o);
}

/** Zone onTick that doses everything inside with `key` twice a second. */
const dosing = (run, a, key, extra) => (zn, dt) => {
  zn.doseT = (zn.doseT ?? 0) - dt;
  if (zn.doseT <= 0) {
    zn.doseT = 0.5;
    for (const m of run.mobs.near(zn.x, zn.z, zn.r)) dose(run, m, key, a);
  }
  extra?.(zn, dt);
};

/** How many elements thug `m` carries. */
const elementsOn = (run, m) => ELEMENTS.reduce((n, k) => n + (statusN(run, m, k) ? 1 : 0), 0);

/**
 * Professor Pudding's kit. `pot` = how much a dose from it is worth in a
 * reaction (× its damage), so cheap fast hits and big slow ones mix fairly.
 */
export const PROF_ABILITIES = [
  {
    id: 'pudding_blaster', name: 'Pudding Blaster', icon: '🍮', tags: ['projectile', 'science'], pot: 1.6,
    desc: 'Fires wobbly blobs of pudding that splash near the impact. 🍮 Applies PUDDING to the thug it hits.',
    base: { damage: 16, cooldown: 0.7, range: 13, speed: 24, area: 1.8, count: 1 },
    upgrades: [DMG, pctUp('cooldown', 'Fire Rate', 12), AREA, addUp('count', 'Extra Blob', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.targets(run.player.x, run.player.z, a.stat('range'), a.stat('count'), 'nearest'),
    fire(run, a, ts) {
      const n = a.stat('count');
      const sticky = run.flags.stickyPudding;
      const onHit = (mob, b) => {
        if (sticky) {
          // Sticky Pudding capstone: the splash sticks too, and slows
          for (const m of run.mobs.near(b?.x ?? mob.x, b?.z ?? mob.z, a.stat('area'))) { chill(m, 0.35, 1.5); dose(run, m, 'pudding', a); }
        } else dose(run, mob, 'pudding', a);
      };
      for (let i = 0; i < n; i++) {
        const t = ts[i % ts.length], m = run.player.muzzlePos();
        run.shoot({ x: m.x, z: m.z, y: m.y, angle: Math.atan2(t.x - m.x, t.z - m.z) + (ts.length < n ? (i - (n - 1) / 2) * 0.15 : 0), speed: a.stat('speed'), dmg: a.stat('damage'), range: a.stat('range') * 1.25, size: 1.6, color: '#e8b86b', ability: a,
          explode: { r: a.stat('area'), dmg: 0.45, color: '#f2d29a' }, onHit });
      }
      run.player.aim(ts[0].x, ts[0].z);
      sfx('shot', 0.04);
    },
  },
  {
    id: 'tesla', name: 'Tesla Coil', icon: '⚡', tags: ['lightning', 'science'], pot: 1,
    desc: 'Lightning jumps from thug to thug. ⚡ Applies SHOCK to every thug it hits.',
    base: { damage: 30, cooldown: 2.2, range: 12, count: 4 },
    upgrades: [DMG, addUp('count', 'Jumps', [1, 1, 2, 2, 3], null, 14), CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'nearest'),
    fire(run, a, t) {
      const fork = run.flags.teslaFork, seen = fork ? new Set() : null;
      chain(run, a, t, { jumps: a.stat('count') + (run.flags.supercharged ? 3 : 0), range: 6 * (run.flags.teslaReach ?? 1), dmg: a.stat('damage'), falloff: run.flags.supercharged ? 0.95 : 0.85, color: '#9ad8ff',
        onHit: (m) => {
          if (fork) { seen.add(m.id); forkArc(run, a, m, a.stat('damage') * fork, seen); }
          dose(run, m, 'shock', a);
        } });
      sfx('shot', 0.05);
    },
  },
  {
    id: 'freeze_ray', name: 'Freeze Ray', icon: '🧊', tags: ['beam', 'science', 'control'], pot: 1.2,
    desc: 'A beam of cold toward the biggest crowd. Damages and slows everything it touches. ❄️ Applies FROZEN.',
    base: { damage: 26, cooldown: 3.2, range: 14, area: 0.9, duration: 2.5 },
    upgrades: [DMG, CD, AREA, DUR],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      line(run, a, { angle: angleTo(run, t), len: a.stat('range'), width: a.stat('area'), dmg: a.stat('damage'), knock: 0, color: '#bff0ff',
        onHit: (m) => {
          if (!alive(m)) return;
          chill(m, 0.55, a.stat('duration'));
          m.frozenUntil = run.time + a.stat('duration'); // marker for talents / gear
          if (run.flags.deepFreeze && Math.random() < 0.2) m.rootT = Math.max(m.rootT, m.tier ? 0.3 : 1.2);
          if (run.flags.freezeRoot) m.rootT = Math.max(m.rootT, m.tier >= 2 ? 0.1 : m.tier ? 0.25 : run.flags.freezeRoot);
          dose(run, m, 'frozen', a);
        } });
      run.player.aim(t.x, t.z, 0.3);
    },
  },
  {
    id: 'acid_rain', name: 'Acid Rain', icon: '☔', tags: ['science', 'aoe', 'poison'], pot: 2,
    desc: 'Seeds a little cloud that drips acid on everything below. 🧪 Applies ACID to thugs under it.',
    base: { damage: 14, cooldown: 9, range: 14, area: 4.5, duration: 4 },
    upgrades: [DMG, AREA, DUR, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const x = t.x, z = t.z;
      pool(run, a, { x, z, r: a.stat('area'), life: a.stat('duration'), dps: a.stat('damage') * 1.4, kind: 'slime', color: '#b8ff5a', ability: a,
        onTick: dosing(run, a, 'acid', (zn) => { if (Math.random() < 0.8) { const g = rand(0, TAU), r = Math.sqrt(Math.random()) * zn.r; run.fx.burst(zn.x + Math.sin(g) * r, 3, zn.z + Math.cos(g) * r, '#c8ff6a', 1, 0.5, 0.5, 0.6, 14); } }) });
    },
  },
  {
    id: 'slime', name: 'Slime Puddle', icon: '🟢', tags: ['science', 'thrown', 'control', 'poison'], pot: 2.4,
    desc: 'Lab slime. Thugs stuck in it are slowed and slowly dissolved. 🧪 Applies ACID to thugs in it.',
    base: { damage: 10, cooldown: 5, range: 12, area: 3.4, duration: 5 },
    upgrades: [pctUp('damage', 'Acid', 20), AREA, DUR, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      run.lob({ tx: t.x, tz: t.z, dur: 0.6, kind: 'slime', onLand: (x, z) => pool(run, a, { x, z, r: a.stat('area'), life: a.stat('duration'), dps: a.stat('damage'), slow: 0.5, kind: 'slime', ability: a, onTick: dosing(run, a, 'acid') }) });
    },
  },
  {
    id: 'shrink_ray', name: 'Shrink Ray', icon: '🔬', tags: ['beam', 'science'], pot: 0.5,
    desc: 'Zaps the biggest thug. 🔬 Applies SHRUNK: it takes a lot more damage, and any reaction on it is amplified (×1.6 power, bigger).',
    base: { damage: 75, cooldown: 5, range: 16, duration: 4, power: 0.3 },
    upgrades: [DMG, CD, DUR, scUp('power', 'Vulnerability', 0.08, (v) => `+${Math.round(v * 100)}% damage taken`)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest'),
    fire(run, a, t) {
      const m = run.player.muzzlePos();
      run.fx.beam(m.x, m.z, t.x, t.z, '#ff4fa3', 0.15, 0.25, 0.9);
      run.hit(t, a.stat('damage'), a);
      if (!alive(t)) return;
      vuln(run, t, a.stat('power'), a.stat('duration'));
      addStatus(run, t, 'shrunk', 1, a.stat('duration'), 1);
      tint(run, t, STATUS.shrunk.color, a.stat('duration'));
      run.fx.burst(t.x, 1, t.z, '#ff8fd0', 12, 3);
    },
  },
  {
    id: 'robo', name: 'Robo-Nanny', icon: '🤖', tags: ['summon', 'science'], pot: 1.8,
    desc: 'Builds a little lab robot that zaps nearby thugs. Its zaps finish experiments: ⚡ SHOCK, or ❄️ FROZEN if the thug is already shocked.',
    base: { damage: 16, cooldown: 13, duration: 12, count: 1 },
    upgrades: [DMG, DUR, addUp('count', 'Robots', [0, 0, 1, 1, 2], null, 5), CD],
    ready: (run) => run.mobs.count(run.player.x, run.player.z, 15) > 0,
    fire(run, a) {
      const up = run.flags.robotUprising;
      for (let i = 0; i < a.stat('count'); i++) {
        const g = run.combat.spawnGoon({ ability: a, life: a.stat('duration'), model: 'robot', reach: 5, seek: 12, rate: up ? 0.35 : 0.55,
          onAttack: (g, t, dmg) => {
            if (!alive(t)) return;
            run.fx.beam(g.x, g.z, t.x, t.z, '#9ad8ff', 0.1, 0.12, 0.9);
            run.hit(t, dmg, a, { knock: 0.5 });
            dose(run, t, statusN(run, t, 'shock') ? 'frozen' : 'shock', a);
            if (run.flags.supercharged && alive(t)) chain(run, a, t, { jumps: 1, range: 4, dmg: dmg * 0.6 });
          } });
        // Robot Uprising capstone: robots self-destruct when their time runs out, shocking the blast
        if (up) run.later(Math.max(0.1, g.life - 0.05), () => {
          if (!run.combat.goons.includes(g)) return;
          run.explode(g.x, g.z, 3, a.stat('damage') * 5, a, { color: '#9ad8ff' });
          for (const m of run.mobs.near(g.x, g.z, 3)) dose(run, m, 'shock', a);
        });
      }
    },
  },
  {
    id: 'drones', name: 'Drone Swarm', icon: '🛸', tags: ['orbit', 'science', 'aura'], pot: 3,
    desc: 'Little drones buzz around him nonstop, ramming anything close. ⚡ Applies SHOCK to what they hit.',
    base: { damage: 5, count: 2, area: 3.2 },
    upgrades: AURA_UPS('Drones'),
    aura: { model: 'drone', color: '#9aa4b4', spark: '#9ad8ff', spin: 4.5, knock: 2,
      // called as orbit.onHit(m), so `this` is the orbit and this.ability its AbilityInst
      onHit(m) { const a = this.ability; if (a?.run) dose(a.run, m, 'shock', a); } },
  },
  {
    id: 'black_hole', name: 'Pocket Black Hole', icon: '🕳️', tags: ['science', 'control'], pot: 1,
    desc: 'A tiny black hole that sucks thugs in and crushes them. It is a mixing bowl: twice a second, thugs inside catch each other\'s statuses (and react).',
    base: { damage: 12, cooldown: 10, range: 14, area: 5, duration: 3.5 },
    upgrades: [AREA, DUR, CD, pctUp('damage', 'Crush', 20)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const sing = run.flags.singularity;
      run.zone({ x: t.x, z: t.z, r: a.stat('area'), life: a.stat('duration'), dps: a.stat('damage'), pull: sing ? 10 : 6, kind: 'void', ability: a,
        onTick: (zn, dt) => {
          if (Math.random() < 0.6) run.fx.burst(zn.x + rand(-zn.r, zn.r), 0.4, zn.z + rand(-zn.r, zn.r), '#b07aff', 1, 1, 0.4, 0.7, 0);
          stir(run, zn, a, dt, 6);
        } });
      // Singularity capstone: when it collapses it implodes and shrinks whatever is left
      if (sing) {
        const x = t.x, z = t.z, r = a.stat('area') * 1.2;
        run.later(a.stat('duration'), () => {
          run.explode(x, z, r, a.stat('damage') * 8, a, { color: '#b07aff' });
          for (const m of run.mobs.near(x, z, r)) {
            if (!alive(m)) continue;
            vuln(run, m, 0.25, 3);
            addStatus(run, m, 'shrunk', 1, 3, 1);
            tint(run, m, STATUS.shrunk.color, 3);
          }
        });
      }
    },
  },
  {
    id: 'death_ray', name: 'Orbital Death Ray', icon: '🛰️', tags: ['science', 'lightning'], pot: 0.3,
    desc: 'Points a satellite at the thug carrying the most statuses (or the biggest). An ion beam lands a moment later. ⚡ Applies SHOCK to everything in the blast.',
    base: { damage: 150, cooldown: 9, range: 24, area: 3 },
    upgrades: [DMG, CD, AREA],
    ready(run, a) {
      let best = null, bn = 0;
      for (const m of run.mobs.near(run.player.x, run.player.z, a.stat('range'))) {
        const n = elementsOn(run, m) * 10 + (m.tier ?? 0);
        if (n > bn) { bn = n; best = m; }
      }
      return bn >= 10 ? best : run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest');
    },
    fire(run, a, t) {
      run.mark(t, 1.0, () => {
        const x = t.x, z = t.z, r = a.stat('area');
        run.fx.tracer(x, z);
        run.explode(x, z, r, a.stat('damage'), a, { color: '#ff70d0' });
        // the blast might have taken the target with it: dose whatever is still standing
        for (const m of run.mobs.near(x, z, r * (1 + (run.stats.blastArea ?? 0)))) dose(run, m, 'shock', a);
        sfx('snipe');
      });
    },
  },
  {
    id: 'force_field', name: 'Cryo Field', icon: '🔵', tags: ['defense', 'science'], pot: 2.5,
    desc: 'A frosty bubble that blocks damage and pushes back thugs that touch it. ❄️ Applies FROZEN to everything it pushes.',
    base: { cooldown: 12, power: 35, area: 2.6, damage: 10 },
    upgrades: [scUp('power', 'Shield', 12, (v) => `+${Math.round(v)} shield`), CD, AREA],
    ready: (run, a) => run.player.shield < a.stat('power') * 0.4 && run.mobs.count(run.player.x, run.player.z, 8) > 0,
    fire(run, a) {
      const p = run.player;
      p.shield = Math.max(p.shield, a.stat('power'));
      nova(run, a, { r: a.stat('area'), dmg: a.stat('damage'), knock: 9, color: '#9fe8ff', onHit: (m) => dose(run, m, 'frozen', a) });
      sfx('select');
    },
  },
  {
    id: 'grand_experiment', noStart: true, name: 'Grand Experiment', icon: '🧪', tags: ['science', 'aoe'], pot: 1,
    desc: 'Spends a full Eureka meter: every thug around (14 at most) gets two random elements at once and they all react, amplified. Then EUREKA! (+40% Recharge Rate for a while).',
    base: { damage: 40, cooldown: 3, area: 7, duration: 4 },
    upgrades: [DMG, AREA, DUR],
    ready(run, a) {
      const cost = run.flags.madGenius ? 70 : 100;
      if (run.res ? run.res.value < Math.min(cost, run.res.max) : (run.counters.profGrandNext ?? 0) > run.time) return null;
      return run.crowd(a, a.stat('area'), 5) ? run.mobs.target(run.player.x, run.player.z, a.stat('area'), 'nearest') : null;
    },
    fire(run, a) {
      const p = run.player;
      if (run.res) { if (!run.spendRes(Math.min(run.flags.madGenius ? 70 : 100, run.res.max))) return false; }
      else run.counters.profGrandNext = run.time + 20; // no meter wired: a 20s fallback
      const keys = Object.keys(REACTIONS);
      const ms = run.mobs.targets(p.x, p.z, a.stat('area'), 14, 'nearest');
      depth++; // these reactions shouldn't spill doses onto others
      try {
        for (const m of ms) {
          if (!alive(m)) continue;
          run.fx.beam(p.x, p.z, m.x, m.z, '#ffd23f', 0.08, 0.25, 1.2);
          run.hit(m, a.stat('damage'), a, { knock: 1 });
          const [k1, k2] = keys[Math.floor(Math.random() * keys.length)].split('+');
          react(run, m, k1, k2, a, { amp: true, gain: false, pot: potOf(a) * 2 });
        }
      } finally {
        depth--;
      }
      run.fx.ring(p.x, p.z, a.stat('area'), '#ffd23f', 0.6);
      run.fx.burst(p.x, 1.5, p.z, '#ffd23f', 24, 8, 0.6);
      run.shake(0.25);
      eurekaMoment(run, a.stat('duration'));
    },
  },
];

for (const d of PROF_ABILITIES) d.lab = LAB;
