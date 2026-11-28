import { sfx } from '../../audio.js';
import { TAU, rand } from '../../util.js';
import { pctUp, scUp, addUp, DMG, CD, AREA, DUR, angleTo } from '../common.js';

/**
 * Boom-Boom Bianchi — Demolitions, "the Fuse". Everything is delayed and chains.
 *
 * THE CHAIN (core rule of the kit): Boom's charges sit on the street before they
 * go off: fizzing Dynamite, Pipe Bombs (proximity), C4 bricks (remote) and
 * Sticky Bombs (ride on a thug). Any blast from his kit sets off every live
 * charge inside it a beat later, early, as the next LINK of the chain. Each link
 * deals +20% damage (stacking, up to 6 links) and fills the FUSE meter.
 * Fire spreads too: burning thugs pass the flames to their neighbours, and a
 * charge sitting in Napalm cooks off.
 *
 * FUSE (BOOM_RESOURCE): fills from chain links (+8), his own blasts (+2, small
 * pops +0.4) and kills (+0.4), throttled by a fill budget (~100 per 30s) so a
 * busy fight fills it every ~30-60s. Every point is +0.3% explosion damage. At a
 * full meter the signature, BIG RED BUTTON (BOOM_SIGNATURE), sets off every
 * charge on the map and flings a ring of gum-bombs that chain. The Detonator is
 * a plain cooldown ability (no Fuse needed).
 *
 * While a chained blast goes off, run.counters.boomLink holds its link number
 * (0 = the blast that started it), so talent links / amps on 'explode' can
 * read it. Talents get helpers through the defs (never import this file there):
 *   sticky_bomb.def.stick(run, a, mob, {dmg, fuse, onBlow})  plant a gum-bomb charge
 *   c4.def.plant(run, a, x, z, {extra})                       plant a C4 brick
 *   detonator.def.chainAt(run, a, x, z, {dmg, area, link})    a chain-aware blast
 */

const CHAIN_BONUS = 0.2; // damage per link
const MAX_LINK = 6;
const CHAIN_HOP = 0.12; // seconds for the blast to reach the next charge
const FUSE_PER_LINK = 8;
const FUSE_PER_BLAST = 2; // any big blast of his
const FUSE_PER_POP = 0.4; // small blasts (firecrackers, rockets, split fuses)
const FUSE_PER_KILL = 0.4;
const FUSE_RATE = 100 / 30; // fill budget per second: a full meter takes at least ~30s
const FUSE_BANK = 12; // budget that can pile up (a big chain lands at once)
const FUSE_DMG = 0.003; // per Fuse point on every explosion
const FUSE_QUIET = 2; // seconds after the Big Red Button during which nothing builds Fuse

export const BOOM_START = 'dynamite_stick';

const noop = () => {};
const fuseVal = (run) => (run.res?.id === 'fuse' ? run.res.value : 0);

/** Add Fuse, throttled by the fill budget (so it can't refill in a couple of seconds late-game). */
function gainFuse(run, n) {
  const r = run.res;
  if (!r || r.id !== 'fuse' || n <= 0 || run.time < (r.quiet ?? 0)) return;
  const g = Math.min(n * (1 + (run.flags.fuseGain ?? 0)), r.budget ?? FUSE_BANK);
  if (g <= 0) return;
  r.budget = (r.budget ?? FUSE_BANK) - g;
  run.gainRes(g);
}

export const BOOM_RESOURCE = {
  id: 'fuse', name: 'Fuse', icon: '⛓️', color: '#ffb02e', max: 100, start: 0, decay: 3, decayDelay: 5,
  desc: 'Fuse fills while things blow up: +8 every time one of your blasts sets off another of your charges (a chain link), plus a little for every blast and every kill. '
    + 'Each point gives +0.3% damage to your explosions (up to +30% when full). When it is full, the Big Red Button goes off and the meter starts over. '
    + 'It drains slowly after 5s without a blast.',
  bonus: (run) => `+${Math.round(fuseVal(run) * FUSE_DMG * 100)}% blast dmg`,
  tick(run, dt) {
    const r = run.res;
    r.budget = Math.min(FUSE_BANK, (r.budget ?? FUSE_BANK) + FUSE_RATE * (1 + 0.5 * (run.flags.fuseGain ?? 0)) * dt);
    const k = run.kills - (r.kills ?? run.kills);
    r.kills = run.kills;
    if (k > 0) gainFuse(run, k * FUSE_PER_KILL);
  },
};

// ── the charge network (per run) ────────────────────────────────────────────

const STATE = new WeakMap();

/** Boom's per-run state; starts the charge / wildfire ticker on first use. */
function state(run) {
  let s = STATE.get(run);
  if (!s) {
    s = { charges: [], n: 0 };
    STATE.set(run, s);
    run.later(0.1, () => tick(run, s));
  }
  return s;
}

/** Live charges (optionally only one kind / one ability). */
function charges(run, kind, a) {
  return state(run).charges.filter((c) => !c.done && (!kind || c.kind === kind) && (!a || c.a === a));
}

/** Sticky charges follow their thug; once it drops, the gum stays where it fell. */
function follow(c) {
  if (c.mob && !c.mob.dead) { c.x = c.mob.x; c.z = c.mob.z; }
  else if (c.mob) c.mob = null;
  return c;
}

function addCharge(run, c) {
  const s = state(run);
  c.born = run.time;
  s.charges.push(c);
  return c;
}

/**
 * Set off charge `c` now as chain link `link`. Always called from a timer, the
 * ticker or an ability's fire (never from inside combat's update loops).
 */
function detonate(run, c, link = 0, mult = 1) {
  if (c.done) return;
  c.done = true;
  const s = state(run);
  const i = s.charges.indexOf(c);
  if (i >= 0) s.charges.splice(i, 1);
  follow(c);
  if (c.trap) {
    const j = run.traps.indexOf(c.trap);
    if (j >= 0) run.traps.splice(j, 1);
    run.combat.scene.remove(c.trap.mesh);
  }
  if (c.markRef) c.markRef.t = 0; // the red reticle clears next frame (its callback is a no-op)
  if (c.trapRoot && run.stats.trapRoot) {
    for (const m of run.mobs.near(c.x, c.z, 4)) m.rootT = Math.max(m.rootT, m.tier >= 2 ? 0.25 : run.stats.trapRoot);
  }
  c.blow(link, mult);
}

/** A blast of radius r at (x, z): every live charge it reaches goes off a beat later as link+1. */
function chainFrom(run, x, z, r, link) {
  const s = state(run);
  if (!s.charges.length) return;
  const reach = r + 0.6 + (run.flags.chainReach ?? 0);
  run.later(CHAIN_HOP, () => {
    let i = 0;
    for (const c of [...s.charges]) {
      if (c.done || c.lit) continue;
      follow(c);
      if ((c.x - x) ** 2 + (c.z - z) ** 2 > reach * reach) continue;
      c.lit = true;
      run.fx.beam(x, z, c.x, c.z, '#ffd23f', 0.08, 0.2, 0.4);
      run.later(i++ * 0.05, () => detonate(run, c, link + 1));
    }
  });
}

/**
 * One of Boom's explosions: chain bonus + Fuse bonus, then the chain spreads.
 * o: {mult, rMult, link, small, color, noChain}
 */
function boom(run, a, x, z, o = {}) {
  const { mult = 1, rMult = 1, link = 0, small = false, color } = o;
  const L = Math.min(link, MAX_LINK);
  const bonus = 1 + L * (CHAIN_BONUS + (run.flags.chainBonus ?? 0));
  const dmg = a.stat('damage') * mult * bonus * (1 + fuseVal(run) * FUSE_DMG);
  const r = a.stat('area') * rMult;
  const prev = run.counters.boomLink ?? 0;
  run.counters.boomLink = link;
  try { run.explode(x, z, r, dmg, a, { small, color }); } finally { run.counters.boomLink = prev; }
  gainFuse(run, small ? FUSE_PER_POP : FUSE_PER_BLAST);
  if (link > 0) {
    gainFuse(run, FUSE_PER_LINK);
    run.fx.number(x, 2.4, z, `CHAIN ×${link + 1}`, '#ffb02e', link >= 3);
  }
  if (!small && run.flags.napalmBlasts && Math.random() < 0.35) {
    run.zone({ x, z, r: r * 0.6, life: 2.5, dps: a.stat('damage') * 0.25 * (1 + run.stats.burnDmg), kind: 'fire', ability: a });
  }
  if (!o.noChain) {
    const effR = r * (run.flags.megaton ? 1.25 : 1) * (1 + run.stats.blastArea);
    chainFrom(run, x, z, effR, link);
  }
}

/** Every 0.1s: sticky charges follow, fuses burn down, pipe bombs watch for thugs; fire spreads every 0.5s. */
function tick(run, s) {
  if (run.ended) return;
  s.n++;
  for (const c of [...s.charges]) {
    if (c.done) continue;
    follow(c);
    if (c.at != null && run.time >= c.at) { detonate(run, c, 0); continue; }
    if (c.prox && run.time >= c.armAt && run.mobs.count(c.x, c.z, c.prox) > 0) { detonate(run, c, 0); continue; }
    // fizzing fuse
    if (!c.trap && Math.random() < 0.6) run.fx.burst(c.x, c.mob ? c.mob.height + 0.4 : 0.4, c.z, Math.random() < 0.5 ? '#ffd23f' : '#ff7a1a', 1, 1.2, 0.3, 0.5, 0);
    if (c.prox && s.n % 6 === 0) run.fx.ring(c.x, c.z, c.prox, '#ff5030', 0.3);
    if (c.kind === 'sticky' && !c.mob && s.n % 4 === 0) run.fx.ring(c.x, c.z, 0.8, '#ff8fd0', 0.3);
  }
  if (s.n % 5 === 0) spreadFire(run);
  run.later(0.1, () => tick(run, s));
}

/** Burning thugs pass the flames to a neighbour (a bit weaker each hop). */
function spreadFire(run) {
  const f = run.flags;
  const chance = 0.25 + (f.fireSpreadChance ?? 0) + (f.fireSpread ? 0.25 : 0);
  const max = 5 + (f.fireSpread ? 5 : 0);
  const mult = Math.min(0.9, 0.6 + (f.fireSpread ?? 0));
  const p = run.player, bd = 1 + run.stats.burnDmg;
  let spread = 0;
  for (const m of run.mobs.near(p.x, p.z, 24)) {
    if (spread >= max) break;
    if (m.dead || m.burnT <= 0.2 || m.burnDps <= 0 || Math.random() > chance) continue;
    let n = null;
    run.mobs.each(m.x, m.z, 2.4, (o) => { if (!n && o !== m && !o.dead && o.burnT <= 0) n = o; });
    if (!n) continue;
    run.ignite(n, (m.burnDps * mult / bd) * 2, 2);
    run.fx.beam(m.x, m.z, n.x, n.z, '#ff7a1a', 0.06, 0.15, 0.6);
    spread++;
  }
}

// ── placing charges ─────────────────────────────────────────────────────────

/** A lit charge lying on the street that goes off `fuse` seconds later (Dynamite, split fuses). */
function fizz(run, a, x, z, fuse, o = {}) {
  run.fx.ring(x, z, a.stat('area') * (o.mult ?? 1) * 0.5, '#ff7a1a', fuse);
  return addCharge(run, {
    kind: o.kind ?? 'dynamite', a, x, z, at: run.time + fuse,
    blow: (link, mult) => {
      boom(run, a, x, z, { link, mult: mult * (o.mult ?? 1), rMult: o.rMult ?? 1 });
      o.onBlow?.(x, z);
    },
  });
}

/** Fuse Box 5-piece: a second charge hops off the blast and fizzes for a moment. */
const splitFuse = (run, a, x, z, kind) => {
  const ang = rand(0, TAU), d = rand(2, 3.5);
  run.lob({ x, z, tx: x + Math.sin(ang) * d, tz: z + Math.cos(ang) * d, dur: 0.4, kind, small: true,
    onLand: (sx, sz) => fizz(run, a, sx, sz, 0.3, { kind: 'split', mult: run.flags.fuseSplit }) });
};

/** A C4 brick at (x, z): never goes off on its own (remote / chain / Detonator only). */
function plantC4(run, a, x, z, o = {}) {
  run.trap({ x, z, ability: a, extra: !!o.extra, trigger: 0, onTrigger: noop });
  const trap = run.traps[run.traps.length - 1];
  trap.arm = Infinity; // combat never trips it; the clacker, a chain or the Detonator does
  const c = addCharge(run, { kind: 'c4', a, x, z, trap, extra: !!o.extra, trapRoot: true,
    blow: (link, mult) => boom(run, a, c.x, c.z, { link, mult }) });
  trap.onTrigger = () => run.later(0, () => detonate(run, c, 0));
  return c;
}

/** A gum-bomb on thug m: rides along, then goes off. If the thug drops first, the gum stays on the street. */
function stick(run, a, m, o = {}) {
  if (!m || m.dead) return null;
  const fuse = o.fuse ?? 1.2 * (1 - (run.flags.shortFuse ?? 0));
  run.mark(m, fuse, noop);
  const markRef = run.combat.marks[run.combat.marks.length - 1];
  const c = addCharge(run, { kind: 'sticky', a, mob: m, x: m.x, z: m.z, at: run.time + fuse, markRef,
    blow: (link, mult) => {
      boom(run, a, c.x, c.z, { link, mult: mult * (o.dmg ?? 1) });
      o.onBlow?.(c.x, c.z);
    } });
  return c;
}

// ── fire ────────────────────────────────────────────────────────────────────

/** A burning Napalm puddle: sets thugs alight (the flames then spread) and cooks off charges in it. */
function puddle(run, a, x, z, r, life) {
  const o = { x, z, r, life, dps: a.stat('damage') * (1 + run.stats.burnDmg), kind: 'fire', ability: a };
  if (run.flags.lanternSlow) o.slow = run.flags.lanternSlow;
  const burn = a.stat('damage') * 1.2 * (1 + (run.flags.fireSpread ?? 0));
  o.onTick = (zn, dt) => {
    zn.igT = (zn.igT ?? 0) - dt;
    if (zn.igT > 0) return;
    zn.igT = 0.5;
    for (const m of run.mobs.near(zn.x, zn.z, zn.r)) if (!m.dead && m.burnT < 1) run.ignite(m, burn, 2);
    for (const c of state(run).charges) {
      if (c.done || c.lit || (c.x - zn.x) ** 2 + (c.z - zn.z) ** 2 > zn.r * zn.r) continue;
      c.lit = true;
      run.later(0.35, () => detonate(run, c, 1)); // cooked off: counts as a chain link
    }
  };
  run.zone(o);
}

// ── vehicles / rockets ─────────────────────────────────────────────────────

/** Shipwrecker 5-piece: steer the bullet just fired toward the nearest live thug. */
const homeIn = (run, before) => {
  const list = run.combat.bullets;
  if (list.length <= before) return;
  const b = list[list.length - 1];
  let steps = 0;
  const step = () => {
    if (b.left <= 0 || ++steps > 60) return;
    const t = run.mobs.target(b.x, b.z, 9, 'nearest');
    if (t && !t.dead) {
      let d = Math.atan2(t.x - b.x, t.z - b.z) - b.angle;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      b.angle += Math.max(-0.4, Math.min(0.4, d));
      b.vx = Math.sin(b.angle) * b.speed;
      b.vz = Math.cos(b.angle) * b.speed;
    }
    run.later(0.05, step);
  };
  run.later(0.04, step);
};
const shootRocket = (run, o) => {
  const before = run.combat.bullets.length;
  run.shoot(o);
  if (run.flags.homingRockets) homeIn(run, before);
};

/** One RC car run at mob t; with the Funhouse 5-piece it comes back once. */
const driveCar = (run, a, t, mult = 1, respawn = !!run.flags.funhouse) => {
  const ang = rand(0, TAU), tx = t.x, tz = t.z;
  run.car({ x: tx, z: tz, angle: ang, dmg: a.stat('damage') * mult, width: 1.6, ability: a });
  run.later(0.72, () => {
    boom(run, a, tx + rand(-1, 1), tz + rand(-1, 1), { mult: 1.2 * mult });
    if (respawn && run.flags.funhouse) {
      run.later(0.6, () => {
        const t2 = run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster');
        if (t2) driveCar(run, a, t2, run.flags.funhouse, false);
      });
    }
  });
};

const cluster = (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster');

export const BOOM_ABILITIES = [
  {
    id: 'dynamite_stick', name: 'Stick of Dynamite', icon: '🧨', tags: ['explosive', 'thrown'],
    desc: 'Lights a stick and tosses it at the nearest crowd. It fizzes on the street for half a second, then blows (another blast sets it off early).',
    base: { damage: 28, cooldown: 1.4, range: 13, area: 2.6, count: 1 },
    upgrades: [DMG, CD, AREA, addUp('count', 'Extra Stick', [0, 0, 1, 1, 1], null, 4)],
    ready: cluster,
    fire(run, a, t) {
      const fuse = 0.5 * (1 - (run.flags.shortFuse ?? 0));
      for (let i = 0; i < a.stat('count'); i++) {
        const tx = t.x + (i ? rand(-2.5, 2.5) : 0), tz = t.z + (i ? rand(-2.5, 2.5) : 0);
        run.lob({ tx, tz, dur: 0.5, kind: 'dynamite', onLand: (x, z) => fizz(run, a, x, z, fuse + i * 0.08, {
          onBlow: run.flags.fuseSplit ? (bx, bz) => splitFuse(run, a, bx, bz, 'dynamite') : null,
        }) });
      }
      run.player.aim(t.x, t.z, 0.25);
    },
  },
  {
    id: 'pipe_bomb', name: 'Pipe Bomb', icon: '🔩', tags: ['explosive', 'thrown', 'trap'],
    desc: 'Lobs a nail-packed pipe onto the street. It waits, and blows in a huge blast the moment a thug walks up to it (or after 6s).',
    base: { damage: 80, cooldown: 6, range: 14, area: 4.8, duration: 6 },
    upgrades: [DMG, AREA, CD],
    ready: cluster,
    fire(run, a, t) {
      run.lob({ tx: t.x, tz: t.z, dur: 0.8, kind: 'pipe', onLand: (x, z) => {
        const prox = 1.6 * (1 + (run.flags.pipeTrigger ?? 0));
        run.fx.ring(x, z, a.stat('area'), '#ff5030', 0.6);
        addCharge(run, { kind: 'pipe', a, x, z, prox, armAt: run.time + 0.4, at: run.time + a.stat('duration'), trapRoot: true,
          blow: (link, mult) => {
            boom(run, a, x, z, { link, mult });
            run.shake(0.3);
            if (run.flags.fuseSplit) splitFuse(run, a, x, z, 'pipe');
          } });
      } });
    },
  },
  {
    id: 'c4', name: 'C4 Charges', icon: '📦', tags: ['explosive', 'trap'],
    desc: 'Plants C4 bricks on the street toward the crowd. They never go off on their own: once a pack walks over them he squeezes the clacker and every brick blows at once.',
    base: { damage: 60, cooldown: 2.6, area: 3.8, count: 3, range: 12 },
    upgrades: [DMG, AREA, addUp('count', 'Max Charges', [0, 1, 1, 2, 2], null, 8), CD],
    ready(run, a) {
      const mine = charges(run, 'c4', a).filter((c) => !c.extra);
      const area = a.stat('area') * 0.7;
      const full = mine.length >= a.stat('count');
      // squeeze the clacker when a pack (or, with no room left, anyone) is on a brick
      if (mine.some((c) => run.mobs.count(c.x, c.z, area) >= (full ? 1 : 3))) return { clack: true };
      if (full) return null;
      const t = cluster(run, a);
      return t ? { place: t } : null;
    },
    fire(run, a, tgt) {
      if (tgt.clack) {
        const all = charges(run, 'c4', a);
        if (!all.length) return false;
        all.forEach((c, i) => run.later(i * 0.03, () => detonate(run, c, 0)));
        run.fx.burst(run.player.x, 1.2, run.player.z, '#ffd23f', 6, 2);
        return;
      }
      const p = run.player, t = tgt.place;
      const ang = angleTo(run, t), d = Math.min(Math.hypot(t.x - p.x, t.z - p.z) * 0.7, 6);
      const tx = p.x + Math.sin(ang) * d + rand(-1.5, 1.5), tz = p.z + Math.cos(ang) * d + rand(-1.5, 1.5);
      run.lob({ tx, tz, dur: 0.4, kind: 'c4', small: true, onLand: (x, z) => plantC4(run, a, x, z) });
    },
    plant: plantC4,
  },
  {
    id: 'sticky_bomb', name: 'Sticky Bomb', icon: '🍬', tags: ['explosive'],
    desc: 'Sticks a gum-bomb on the toughest thug. It rides along into the crowd and blows 1.2s later; if the thug drops first, the gum stays stuck to the street.',
    base: { damage: 110, cooldown: 4.5, range: 14, area: 3.4 },
    upgrades: [DMG, CD, AREA],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest'),
    fire(run, a, t) {
      if (!stick(run, a, t)) return false;
      run.fx.beam(run.player.x, run.player.z, t.x, t.z, '#ff8fd0', 0.08, 0.2, 0.9);
    },
    stick,
  },
  {
    // noStart: it only sets off charges other abilities put down, so it can't open a run
    id: 'detonator', noStart: true, name: 'Detonator', icon: '🔌', tags: ['explosive'],
    desc: 'Leans on the plunger: every charge he has out nearby goes off at once, each with an extra blast of its own, +10% damage for each other charge wired in (up to +100%). No Fuse needed.',
    base: { damage: 30, cooldown: 8, area: 2.6, range: 14 },
    upgrades: [DMG, CD, AREA],
    ready(run, a) {
      const p = run.player, R = a.stat('range');
      const list = charges(run).filter((c) => (follow(c).x - p.x) ** 2 + (c.z - p.z) ** 2 <= R * R);
      if (list.length < (a.wait > 2.5 ? 1 : 2)) return null;
      return list.some((c) => run.mobs.count(c.x, c.z, 3) > 0) ? list : null;
    },
    fire(run, a, list) {
      list = (Array.isArray(list) ? list : []).filter((c) => c.blow && !c.done); // freeCast may slip a mob in
      if (!list.length) return false;
      const mult = 1 + 0.1 * Math.min(10, list.length - 1);
      const link = run.flags.wiredNet ? 1 : 0; // Wired Network: the plunger counts as a chain link
      const p = run.player;
      run.fx.ring(p.x, p.z, 1.6, '#ffd23f', 0.4);
      list.forEach((c, i) => {
        run.fx.beam(p.x, p.z, c.x, c.z, '#ffd23f', 0.05, 0.25, 0.3);
        c.lit = true;
        run.later(0.08 + i * 0.02, () => {
          if (c.done) return;
          detonate(run, c, link, mult);
          boom(run, a, c.x, c.z, { noChain: true });
        });
      });
      sfx('bigshot', 0.1);
    },
    /** A chain-aware blast with partner `a`'s stats (for talents): sets off charges it reaches. */
    chainAt: (run, a, x, z, { dmg = 1, area = 1, link = 0, small = false } = {}) => boom(run, a, x, z, { mult: dmg, rMult: area, link, small }),
  },
  {
    id: 'napalm', name: 'Napalm Jar', icon: '🫙', tags: ['fire', 'thrown'],
    desc: 'Grandma\'s "jam". The jar smashes on the crowd and rolls on, leaving a trail of burning puddles. Thugs in it catch fire and pass the flames to their neighbours, and charges in it cook off.',
    base: { damage: 14, cooldown: 5.5, range: 13, area: 3.2, duration: 5, count: 2 },
    upgrades: [pctUp('damage', 'Burn Damage', 20), AREA, DUR, CD, addUp('count', 'Trail Puddle', [0, 1, 1, 1, 2], null, 6)],
    ready: cluster,
    fire(run, a, t) {
      const ang = angleTo(run, t);
      state(run);
      run.lob({ tx: t.x, tz: t.z, dur: 0.7, kind: 'molotov', onLand: (x, z) => {
        const r = a.stat('area'), life = a.stat('duration');
        puddle(run, a, x, z, r, life);
        run.fx.burst(x, 0.4, z, '#ff7a1a', 16, 5);
        const n = a.stat('count'), step = r * 0.95;
        for (let i = 1; i <= n; i++) {
          run.later(i * 0.12, () => {
            const px = x + Math.sin(ang) * step * i + rand(-0.4, 0.4), pz = z + Math.cos(ang) * step * i + rand(-0.4, 0.4);
            puddle(run, a, px, pz, r * 0.6, life * 0.8);
            run.fx.burst(px, 0.3, pz, '#ff9a2a', 6, 3);
          });
        }
      } });
    },
  },
  {
    id: 'firecrackers', name: 'Firecrackers', icon: '🎆', tags: ['explosive', 'thrown'],
    desc: 'Throws a fistful of firecrackers that pop all over the place. Every pop is a spark: any charge it lands near goes off.',
    base: { damage: 12, cooldown: 3, range: 11, area: 1.6, count: 6 },
    upgrades: [DMG, { ...scUp('count', 'Crackers', 2), int: true }, CD, AREA],
    ready: cluster,
    fire(run, a, t) {
      const n = a.stat('count');
      for (let i = 0; i < n; i++) {
        run.later(i * 0.05, () => run.lob({ tx: t.x + rand(-3.5, 3.5), tz: t.z + rand(-3.5, 3.5), dur: rand(0.4, 0.7), kind: 'firework', small: true,
          onLand: (x, z) => boom(run, a, x, z, { small: true, color: ['#ff4fa3', '#ffd23f', '#58c4ff'][i % 3] }) }));
      }
      sfx('tommy', 0.05);
    },
  },
  {
    id: 'bazooka', name: 'Toy Bazooka', icon: '🚀', tags: ['explosive', 'projectile'],
    desc: 'Fires a rocket at the biggest target. Explodes on the first thing it hits.',
    base: { damage: 70, cooldown: 3.5, range: 18, speed: 26, area: 3, count: 1 },
    upgrades: [DMG, CD, AREA, addUp('count', 'Extra Rocket', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest'),
    fire(run, a, t) {
      const base = angleTo(run, t), n = a.stat('count');
      for (let i = 0; i < n; i++) {
        shootRocket(run, { x: run.player.x, z: run.player.z, y: 0.9, angle: base + (i - (n - 1) / 2) * 0.2, speed: a.stat('speed'), dmg: a.stat('damage') * 0.4, range: a.stat('range') * 1.3, size: 2.2, color: '#ff7a3a', ability: a,
          onHit: (m, b) => { b.left = 0; boom(run, a, b.x, b.z, { mult: 0.8 }); } });
      }
      run.player.aim(t.x, t.z, 0.3);
      sfx('bigshot');
    },
  },
  {
    id: 'rockets', name: 'Bottle Rockets', icon: '🎇', tags: ['explosive', 'projectile'],
    desc: 'A volley of bottle rockets that wobble toward random thugs. One in three streaks at a charge he has out instead and lights it.',
    base: { damage: 20, cooldown: 4, range: 14, speed: 22, area: 2, count: 5 },
    upgrades: [DMG, { ...scUp('count', 'Rockets', 2), int: true }, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'nearest'),
    fire(run, a) {
      const p = run.player, n = a.stat('count'), R = a.stat('range');
      const ts = run.mobs.targets(p.x, p.z, R, n * 2, 'nearest');
      if (!ts.length) return false;
      // charges with thugs around them, nearest first
      const lit = charges(run).filter((c) => (follow(c).x - p.x) ** 2 + (c.z - p.z) ** 2 <= R * R && run.mobs.count(c.x, c.z, 3) > 0);
      for (let i = 0; i < n; i++) {
        const c = i % 3 === 2 ? lit.shift() : null;
        if (c) {
          const d = Math.hypot(c.x - p.x, c.z - p.z);
          c.lit = true;
          run.later(i * 0.07, () => {
            run.shoot({ x: p.x, z: p.z, y: 1, angle: Math.atan2(c.x - p.x, c.z - p.z), speed: a.stat('speed'), dmg: a.stat('damage') * 0.4, range: d, size: 1.2, color: '#ffd23f', ability: a, onHit: (m, b) => { b.left = 0; } });
            run.later(d / a.stat('speed'), () => detonate(run, c, 1));
          });
          continue;
        }
        const t = ts[Math.floor(Math.random() * ts.length)];
        run.later(i * 0.07, () => shootRocket(run, { x: p.x, z: p.z, y: 1, angle: angleTo(run, t) + rand(-0.25, 0.25), speed: a.stat('speed'), dmg: a.stat('damage') * 0.4, range: R * 1.3, size: 1.2, color: '#ff4fa3', ability: a,
          onHit: (m, b) => { b.left = 0; boom(run, a, b.x, b.z, { small: true, color: '#ff8fd0' }); } }));
      }
      sfx('tommy');
    },
  },
  {
    id: 'mortar', name: 'Mortar Strike', icon: '🎯', tags: ['explosive'],
    desc: 'Calls in shells from a toy mortar across the street. They rain down on a wide area, and the spotter aims the first ones at his charges.',
    base: { damage: 34, cooldown: 9, range: 16, area: 2.8, count: 6 },
    upgrades: [DMG, { ...scUp('count', 'Shells', 2), int: true }, CD, AREA],
    ready: cluster,
    fire(run, a, t) {
      const n = a.stat('count');
      const spots = charges(run).filter((c) => (follow(c).x - t.x) ** 2 + (c.z - t.z) ** 2 < 64).slice(0, Math.floor(n / 2));
      for (let i = 0; i < n; i++) {
        const c = spots[i];
        const ang = rand(0, TAU), r = rand(0, 5);
        const x = c ? c.x : t.x + Math.sin(ang) * r, z = c ? c.z : t.z + Math.cos(ang) * r;
        run.later(0.25 + i * 0.12, () => {
          run.fx.ring(x, z, a.stat('area'), '#ff5030', 0.35);
          run.later(0.35, () => boom(run, a, x, z));
        });
      }
    },
  },
  {
    id: 'big_one', name: 'The Big One', icon: '☢️', tags: ['explosive', 'aoe'],
    desc: 'Pulls the big red lever. A massive blast centred on Boom-Boom (he\'s fine, mostly) that sets off every charge in reach.',
    base: { damage: 90, cooldown: 22, area: 8 },
    upgrades: [DMG, CD, AREA],
    // Warm-Up Lap talent: with RC Car Bomb in the run it needs fewer thugs around
    ready: (run, a) => run.crowd(a, a.stat('area'), run.flags.bigOneCrowd && run.abilityById('rc_car') ? Math.max(2, 10 - run.flags.bigOneCrowd) : 10),
    fire(run, a) {
      const p = run.player;
      run.fx.ring(p.x, p.z, a.stat('area'), '#ffef5a', 0.9);
      run.later(0.6, () => { boom(run, a, p.x, p.z); run.fx.explosion(p.x, p.z, a.stat('area') * 0.7, '#fff3a0'); run.shake(0.5); });
    },
  },
  {
    id: 'rc_car', name: 'RC Car Bomb', icon: '🏎️', tags: ['explosive', 'vehicle'],
    desc: 'A remote-control car rigged with explosives. Drives through the crowd and blows up.',
    base: { damage: 36, cooldown: 7, range: 16, area: 4, count: 1 },
    upgrades: [DMG, CD, AREA, addUp('count', 'Extra Car', [0, 0, 1, 1, 2], null, 4)],
    ready: cluster,
    fire(run, a, t) {
      for (let i = 0; i < a.stat('count'); i++) {
        run.later(i * 0.3, () => driveCar(run, a, t));
      }
    },
  },
];

// ── signature: Big Red Button ───────────────────────────────────────────────

const RING = 8; // gum-bombs flung around him
const RING_FLAT = 110 * 0.7; // ring damage aims at ~70% of a base Sticky Bomb, whatever lends its stats

/** The ability the Button's ring borrows stats from: Sticky Bomb if he has it, else his hardest-hitting explosive. */
function ringSource(run) {
  const sticky = run.abilityById('sticky_bomb');
  if (sticky) return sticky;
  const boomers = run.abilities.filter((o) => o.def.tags.includes('explosive'));
  const pool = boomers.length ? boomers : run.abilities;
  return pool.reduce((b, o) => (!b || o.stat('damage') > b.stat('damage') ? o : b), null);
}

/** Fling the ring of gum-bombs; they land and go off one after another around him, each a link further down the chain. */
function buttonRing(run) {
  const a = ringSource(run);
  if (!a) return;
  const p = run.player, base = a.def.base ?? {};
  const mult = Math.max(0.7, RING_FLAT / Math.max(1, base.damage ?? RING_FLAT));
  const rMult = Math.min(1.6, Math.max(0.9, 3.4 / Math.max(1, base.area ?? 3.4)));
  // Gum on the Wire (with Sticky Bomb): extra gum in the ring
  const n = RING + (run.abilityById('sticky_bomb') ? (run.flags.ringGum ?? 0) : 0);
  const off = rand(0, TAU), cx = p.x, cz = p.z;
  for (let i = 0; i < n; i++) {
    const ang = off + (i / n) * TAU, d = rand(3.5, 5);
    run.lob({ x: cx, z: cz, tx: cx + Math.sin(ang) * d, tz: cz + Math.cos(ang) * d, dur: 0.35, kind: 'sticky', small: true, color: '#ff8fd0',
      onLand: (x, z) => {
        // stick to a thug right there if there is one, else the gum sits on the street
        const m = run.mobs.target(x, z, 1.6, 'nearest');
        const c = addCharge(run, { kind: 'sticky', a, mob: m && !m.dead ? m : null, x, z, ring: true,
          blow: (link, k) => boom(run, a, c.x, c.z, { link, mult: k * mult, rMult }) });
        run.fx.ring(x, z, 0.8, '#ff8fd0', 0.3);
        // it goes round the ring like a lit fuse: each gum-bomb is one more link down the chain
        run.later(0.12 + i * 0.07, () => detonate(run, c, Math.min(MAX_LINK, 1 + i)));
      } });
  }
}

export const BOOM_SIGNATURE = {
  id: 'big_red_button', name: 'Big Red Button', icon: '🔴',
  short: 'Every charge on the map blows at once',
  desc: 'Slams the Big Red Button: every charge he has out, anywhere on the map, goes off at once with an extra blast of its own, '
    + '+50% damage plus +15% for each other charge wired in (up to +200%). Then he flings a ring of 8 gum-bombs around himself '
    + 'that go off one after another, each a link further down the chain. Fires when Fuse is full.',
  fire(run) {
    const p = run.player, s = state(run);
    if (run.res) run.res.quiet = run.time + FUSE_QUIET; // the Button's own chain doesn't refill the meter
    const fuse = 100 * FUSE_DMG; // the meter was full: keep its damage bonus for this blast
    const list = s.charges.filter((c) => !c.done && c.blow);
    const mult = (1.5 + 0.15 * Math.min(10, Math.max(0, list.length - 1))) * (1 + fuse);
    run.fx.ring(p.x, p.z, 2.4, '#ff3030', 0.5);
    run.fx.explosion(p.x, p.z, 1.6, '#ff3030');
    run.shake(0.4);
    sfx('bigshot', 0.1);
    list.forEach((c, i) => {
      follow(c);
      c.lit = true;
      run.fx.beam(p.x, p.z, c.x, c.z, '#ff3030', 0.06, 0.3, 0.35);
      run.later(0.1 + Math.min(i, 24) * 0.025, () => {
        if (c.done) return;
        detonate(run, c, 0, mult);
        if (i < 20 && c.a) boom(run, c.a, c.x, c.z, { mult: 0.6 * mult, noChain: true }); // the extra blast
      });
    });
    if (list.length >= 3) run.fx.number(p.x, 2.8, p.z, `${list.length} CHARGES!`, '#ff5030', true);
    buttonRing(run);
  },
};

/** Hideout Kit tab. */
export const BOOM_OVERVIEW = {
  tagline: 'Nothing he lights goes off alone.',
  playstyle: 'Boom-Boom leaves charges all over the street: Dynamite, Pipe Bombs, C4 bricks and gum-bombs stuck on thugs. '
    + 'Any of his blasts sets off the charges near it a moment later, and every hop of that chain hits harder. '
    + 'Line your charges up in the crowd and let one bang set off the rest.',
  meter: 'Fuse fills as things blow up, fastest when one blast sets off another (a chain link). '
    + 'Each point is a little extra explosion damage. When it is full, the Big Red Button goes off: '
    + 'every charge on the map blows at once, then a ring of gum-bombs pops around you. '
    + 'In Manual mode you press it yourself (Y / F / ★), so you can wait until the street is full of charges.',
  tips: [
    'More charges out means a bigger Button: C4, Pipe Bombs and Sticky Bombs all count, anywhere on the map.',
    'The ring of gum-bombs lands right around you, so the Button is also your panic button when you get swarmed.',
    'Chains build Fuse much faster than single blasts. Put charges close together so one bang reaches the next.',
    'The Detonator is separate from the Button: it sets off nearby charges on its own cooldown, no Fuse needed.',
  ],
  pairs: [
    { a: 'c4', b: 'detonator', why: 'C4 never goes off on its own, so it piles up for the Detonator and the Big Red Button to cash in.' },
    { a: 'sticky_bomb', b: 'big_red_button', why: 'With Sticky Bomb in the run the Button\'s ring hits as hard as real gum-bombs (and Gum on the Wire adds more).' },
    { a: 'napalm', b: 'pipe_bomb', why: 'Charges sitting in fire cook off as chain links, so a pipe in a puddle is free Fuse.' },
    { a: 'mortar', b: 'c4', why: 'The spotter aims the first shells at your charges, so every strike chains your bricks.' },
  ],
};
