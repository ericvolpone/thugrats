import { sfx } from '../../audio.js';
import { TAU, rand } from '../../util.js';
import { pctUp, scUp, addUp, DMG, CD, AREA, DUR, permanentUptime, angleTo, nova, buff, AURA_UPS } from '../common.js';
import { MARK_COLOR, MARK_DMG, SHADOW_RATE, SHADOW_BANK, markMob, cashMarks, marksOn, markExec, shadowGain } from './talents.js';

/**
 * Lucy "The Ghost" — the Assassin: stealth, poison, execute.
 *
 * Signature: MARKS (core in talents.js). Poison (Poison Dart, Sleeping Gas),
 * traps (Caltrops, Tripwire) and Shuriken Ring stack Marks on thugs (purple
 * tint). Executes (Shadow Step, Garrote, Curtain Call) cash them in: every Mark
 * raises the execute line (+4%) or, when it doesn't execute, adds +20% damage,
 * and builds SHADOW (the hero resource, ~30–60s to fill; +crit damage while it
 * builds). A full meter fires her signature, VANISH (GHOST_SIGNATURE): Cloak,
 * then Shadow Step strikes chained through every Marked thug on screen, then
 * 3 Marks on everyone left. While Cloaked, every Mark source adds one more Mark
 * and Shadow Step strikes one more thug.
 *
 * Talent / gear hooks (run.flags, all off by default):
 *   execChain     n   — Garrote executes jump to up to n more wounded thugs (Back Alley 5pc)
 *   trapRearm     f   — Tripwire and Caltrops re-arm once, the re-armed one deals +f (Smuggler 5pc)
 *   quickTraps    f   — Tripwires arm instantly, trigger radius ×f (Smuggler 3pc)
 *   knifeReturn   f   — Throwing Knives fly back to Lucy for ×f damage (Card Sharp 5pc)
 *   cloakBreak    f   — when Cloak ends, Garrote strikes for free for ×f damage (From the Shadows)
 *   cloakOutCrit  s   — every hit crits for s seconds after Cloak ends (Shadow Clan 5pc)
 *   ambush        b   — Smoke Bomb gives crit and Marks thugs in the smoke (Ambush)
 *   poisonTips    b   — Knives and Shuriken poison and Mark (Poison Tips)
 *   execElite     f   — elites can be executed below f × the execute line
 *   vanishCloak   s   — Vanish's Cloak lasts s seconds longer (Ghost Protocol)
 *   vanishCount   n   — Vanish chains through n more Marked thugs (Twin Shadows)
 *   + the Mark / Shadow flags listed in talents.js (markMax, markDur, markExec, markHeal, cashCd, trapMarks, poisonMark, shadowGain)
 *
 * Pairings reach the helpers below through the partner's def (talents.js and
 * gear.js stay free of browser imports): caltrops/tripwire.place(run, a, x, z, o)
 * and cloak.wrap(run, a, seconds).
 */

export const GHOST_START = 'shadow_step';

const SHADOW_CRIT = 0.003; // +0.3% crit damage per point of Shadow

/**
 * Lucy's resource. Cashing in Marks builds it (talents.js: cashMarks → MARK_SHADOW
 * per Mark, but never faster than SHADOW_RATE/s on average, so it takes 30–60s
 * however many Marks are flying). Full = Vanish. Nothing spends it any more.
 */
export const GHOST_RESOURCE = {
  id: 'shadow', name: 'Shadow', icon: '🌑', color: MARK_COLOR, max: 100, start: 0, decay: 2, decayDelay: 8,
  desc: 'Shadow fills up when you cash in Marks: Shadow Step, Garrote and Curtain Call cash in the Marks on the thugs they hit. When it is full, Lucy uses VANISH. While it fills, every point is +0.3% crit damage (+30% when full). It slowly fades if you go 8s without cashing in a Mark.',
  bonus: (run) => `+${Math.round((run.res?.value ?? 0) * SHADOW_CRIT * 100)}% crit dmg`,
  tick(run, dt = 0) {
    const r = run.res;
    if (!r) return;
    // the rate limiter: cashMarks draws Shadow from this bank, which refills at SHADOW_RATE/s
    r.bank = Math.min(SHADOW_BANK, (r.bank ?? SHADOW_BANK) + SHADOW_RATE * shadowGain(run) * dt);
    const v = r.value;
    if (v <= 0) { delete run.buffs.shadow_meter; return; }
    // a hidden, constantly refreshed buff carries the crit damage into computeStats
    run.buffs.shadow_meter = { t: 0.5, max: 0.5, stats: (s) => { s.critDmg += (run.res?.value ?? 0) * SHADOW_CRIT; } };
  },
};

// ── Vanish (signature) ──────────────────────────────────────────────────────

const VANISH_DEF = {
  id: 'vanish', name: 'Vanish', icon: '🌑', tags: ['melee', 'execute'],
  base: { damage: 60, execute: 0.15, range: 16, count: 12, power: 0.3, duration: 3, area: 10 },
};

/**
 * The run's Vanish damage source: enough of an ability (def, stat) for run.hit,
 * damage credit ('vanish') and the #execute / #melee talent links. Not owned,
 * so it never levels; damage follows run.stats.dmg like any ability.
 */
function vanishSrc(run) {
  if (run._vanish?.run !== run) {
    run._vanish = { def: VANISH_DEF, run, level: 1, cd: 0, cdMax: 0, wait: 0, history: [],
      stat: (k) => (VANISH_DEF.base[k] ?? 0) * (k === 'damage' ? run.stats.dmg : 1) };
  }
  return run._vanish;
}

/** Thugs Vanish would chain through: Marked, alive, in range, nearest-first path from Lucy. */
function vanishChain(run, src) {
  const p = run.player, n = src.stat('count') + (run.flags.vanishCount ?? 0);
  const pool = run.mobs.near(p.x, p.z, src.stat('range')).filter((m) => !m.dead && m.spawnT >= 0.3 && marksOn(run, m) > 0);
  const out = [];
  let x = p.x, z = p.z;
  while (out.length < n && pool.length) {
    let bi = 0, bd = Infinity;
    pool.forEach((m, i) => { const d = (m.x - x) ** 2 + (m.z - z) ** 2; if (d < bd) { bd = d; bi = i; } });
    const m = pool.splice(bi, 1)[0];
    out.push(m);
    x = m.x; z = m.z;
  }
  return out;
}

export const GHOST_SIGNATURE = {
  id: 'vanish', name: 'Vanish', icon: '🌑',
  short: 'Cloak + strike every Marked thug',
  desc: 'When Shadow is full, Lucy vanishes: she is Cloaked for 3s, her shadow strikes every Marked thug on screen (up to 12) and cashes in their Marks (executes under the line, +4% per Mark, heavy damage otherwise), then every thug left nearby gets 3 Marks.',
  // full meter and someone to hit
  ready: (run) => run.res.value >= run.res.max && run.mobs.count(run.player.x, run.player.z, 14) > 0,
  fire(run) {
    const p = run.player, src = vanishSrc(run);
    const cloak = run.abilityById('cloak');
    cloakBuff(run, cloak ?? src, src.stat('duration') + (run.flags.vanishCloak ?? 0));
    run.fx.burst(p.x, 0.8, p.z, '#bfc8ff', 28, 5, 0.9, 2, -1);
    run.fx.ring(p.x, p.z, 3, MARK_COLOR, 0.35);
    sfx('frenzy', 0.1);
    // as hard as Shadow Step (×1.5) when she has it, so it keeps up with the run
    const step = run.abilityById('shadow_step');
    const dmg = Math.max(src.stat('damage'), step ? step.stat('damage') * 1.5 : 0);
    const chain = vanishChain(run, src), gap = 0.07;
    const end = chain.length * gap + 0.1;
    run.res.hold = run.time + end + 0.2; // cashing in its own Marks doesn't refill the meter
    let x = p.x, z = p.z;
    chain.forEach((m, i) => {
      const fx = x, fz = z;
      x = m.x; z = m.z;
      run.later(i * gap, () => {
        if (run.ended || m.dead) return;
        const d = Math.hypot(m.x - fx, m.z - fz);
        run.combat.shadow({ x: fx, z: fz, angle: Math.atan2(m.x - fx, m.z - fz), len: Math.max(0, d - 0.7), dur: 0.14, color: MARK_COLOR });
        run.fx.burst(m.x, 1, m.z, MARK_COLOR, 10, 4);
        assassinate(run, src, m, dmg);
        sfx('select', 0.04);
      });
    });
    // then everyone still standing nearby gets 3 Marks (Cloak's +1 included)
    run.later(end, () => {
      if (run.ended) return;
      const n = run.buffs.cloak ? 2 : 3;
      for (const m of run.mobs.near(run.player.x, run.player.z, src.stat('area'))) markMob(run, m, n);
      run.fx.ring(run.player.x, run.player.z, src.stat('area'), MARK_COLOR, 0.45);
    });
  },
};

/** Lucy's Kit tab (hideout). */
export const GHOST_OVERVIEW = {
  tagline: 'Mark them, cash them in, vanish.',
  playstyle: 'Lucy tags thugs with Marks, then finishes them with executes. She is fragile: let poison, traps and stars do the tagging while Shadow Step and Garrote pick off the tagged.',
  meter: 'Marks are purple stacks on a thug (up to 5, they wear off after 6s). Poison Dart, Sleeping Gas, Caltrops, Tripwire, Shuriken Ring, Decoy and Shadow Step put them on. Executes (Shadow Step, Garrote, Curtain Call) cash them in: each Mark raises the kill-outright line by 4% or adds +20% damage. Every Mark cashed in fills Shadow (about 30–60s to fill, +crit damage as it grows). Full Shadow = VANISH: a 3s Cloak, a shadow strike on every Marked thug on screen, and 3 fresh Marks on everyone left.',
  tips: [
    'Stack Marks before you cash in: a thug with 5 Marks is executed under 30%+ HP instead of 10%.',
    'Vanish only strikes Marked thugs, so let your Mark sources tag the whole pack first. In Manual mode, hold it for a big crowd (a full meter waits and keeps its crit bonus).',
    'Everything Marks one extra time while Cloaked, so Vanish leaves the pack ready for your next executes.',
    'Elites and bosses can\'t be executed (Marks still add damage), so save the cash-ins for packs of regulars.',
  ],
  pairs: [
    { a: 'Poison Dart', b: 'Garrote', why: 'Darts leave 2 Marks on the toughest thugs; Garrote cashes them in for a near-certain execute.' },
    { a: 'Shuriken Ring', b: 'Shadow Step', why: 'The stars tag everything around you nonstop, and Shadow Step blinks through the most Marked.' },
    { a: 'Cloak', b: 'Shadow Step', why: 'While Cloaked, Shadow Step strikes one more thug and every Mark source adds an extra Mark.' },
    { a: 'Tripwire', b: 'Curtain Call', why: 'A sprung wire Marks a whole pack; Curtain Call pops the most Marked thug and spreads its Marks to the rest.' },
  ],
};

// ── shared pieces, also used by talents.js / gear.js pairings ───────────────

/** Calls fn once buff `b` (run.buffs[id]) runs out. Not when it is recast over (the new one has its own watch). */
function whenBuffEnds(run, id, b, fn) {
  const tick = () => {
    if (run.ended) return;
    if (run.buffs[id] === b) return run.later(0.1, tick);
    if (!run.buffs[id]) fn();
  };
  run.later(0.1, tick);
}

/** Puts Cloak (ability `a`) on Lucy for `t` seconds; extends it if it's already up. */
export function cloakBuff(run, a, t = a.stat('duration')) {
  const cur = run.buffs.cloak;
  if (cur) { cur.t = Math.max(cur.t, t); cur.max = Math.max(cur.max, cur.t); return cur; }
  const pw = a.stat('power');
  const b = (run.buffs.cloak = { t, max: t, src: 'cloak', fx: '#bfc8ff', stats: (s) => { s.crit += pw; s.critDmg += pw * 2; s.dodge += 0.15; } });
  if (run.flags.cloakBreak || run.flags.cloakOutCrit) whenBuffEnds(run, 'cloak', b, () => cloakEnded(run));
  return b;
}

function cloakEnded(run) {
  const p = run.player;
  if (p.dead) return;
  const out = run.flags.cloakOutCrit;
  if (out) run.buffs.shadow_strike = { t: out, max: out, fx: '#ff5a7a', stats: (s) => { s.crit += 1; } };
  const g = run.flags.cloakBreak && run.abilityById('garrote');
  if (g) {
    const t = pickPrey(run, g, p.x, p.z, g.stat('range') * 1.5, 1)[0];
    if (t) garroteStrike(run, g, t, run.flags.cloakBreak);
  }
}

/** Can thug m be executed at execute line `line` (fraction of max HP)? Regulars only; elites with flags.execElite. */
function canExecute(run, m, line) {
  if (m.dead) return false;
  const k = m.hp / m.maxHp;
  if (m.tier === 0) return k <= line;
  return m.tier === 1 && !!run.flags.execElite && k <= line * run.flags.execElite;
}

/** Kill m outright (armor can't save it), credited to `a`. */
function executeMob(run, a, m) {
  if (run.stats.execHeal) run.heal(run.stats.execHeal);
  run.fx.burst(m.x, 1, m.z, '#c32020', 12, 4);
  run.hit(m, (m.hp + 1) / Math.max(0.1, 1 - (m.armor ?? 0)), a, { knock: 0, noCrit: true });
}

/**
 * The core of every execute: cash in m's Marks, then execute it if it's under
 * a.execute + 4% per Mark, else hit it for `dmg` +20% per Mark.
 * Returns {n, exec}: Marks cashed and whether it was executed.
 */
export function assassinate(run, a, m, dmg = a.stat('damage')) {
  if (m.dead) return { n: 0, exec: false };
  const n = cashMarks(run, m, a);
  const line = a.stat('execute') + n * markExec(run);
  if (canExecute(run, m, line)) { executeMob(run, a, m); return { n, exec: true }; }
  run.hit(m, dmg * (1 + MARK_DMG * n), a, { knock: 0 });
  return { n, exec: false };
}

/**
 * Up to `n` thugs within `range` of (x, z) worth stalking: most Marks first,
 * then the most wounded, then the nearest. `skip` = a Set of mobs to leave out.
 */
function pickPrey(run, a, x, z, range, n, skip) {
  const out = [];
  run.mobs.each(x, z, range, (m) => {
    if (m.dead || m.spawnT < 0.5 || skip?.has(m)) return;
    const d = Math.hypot(m.x - x, m.z - z);
    m._prey = marksOn(run, m) * 10 + (1 - m.hp / m.maxHp) * 6 - d * 0.15;
    out.push(m);
  });
  out.sort((p, q) => q._prey - p._prey);
  return out.slice(0, n);
}

/** Garrote on mob t (×mult damage when it doesn't execute). Executes chain on with flags.execChain. */
export function garroteStrike(run, a, t, mult = 1) {
  if (t.dead) return;
  const p = run.player, d = Math.hypot(t.x - p.x, t.z - p.z);
  run.combat.shadow({ x: p.x, z: p.z, angle: angleTo(run, t), len: Math.max(0, d - 0.8), dur: 0.14, color: '#c32020' });
  run.fx.burst(t.x, 1, t.z, '#c32020', 10, 4);
  run.player.aim(t.x, t.z, 0.2);
  const { exec } = assassinate(run, a, t, a.stat('damage') * mult);
  // Back Alley: the wire moves on to the next thug under the line (its Marks count)
  let jumps = exec ? run.flags.execChain ?? 0 : 0, cur = t;
  while (jumps-- > 0) {
    let best = null, bd = Infinity;
    run.mobs.each(cur.x, cur.z, a.stat('range'), (m) => {
      if (m.dead || !canExecute(run, m, a.stat('execute') + marksOn(run, m) * markExec(run))) return;
      const q = (m.x - cur.x) ** 2 + (m.z - cur.z) ** 2;
      if (q < bd) { bd = q; best = m; }
    });
    if (!best) break;
    run.combat.shadow({ x: cur.x, z: cur.z, angle: Math.atan2(best.x - cur.x, best.z - cur.z), len: Math.max(0, Math.sqrt(bd) - 0.8), dur: 0.14, color: '#c32020' });
    cashMarks(run, best, a);
    executeMob(run, a, best);
    cur = best;
  }
}

/** Shadow Step: a shadow of Lucy blinks from (x, z) to t and strikes. Unmarked survivors get 2 Marks. */
function stepStrike(run, a, x, z, t) {
  const d = Math.hypot(t.x - x, t.z - z);
  run.combat.shadow({ x, z, angle: Math.atan2(t.x - x, t.z - z), len: Math.max(0, d - 0.7), dur: 0.16, color: MARK_COLOR });
  run.fx.burst(t.x, 1, t.z, MARK_COLOR, 10, 4);
  const tx = t.x, tz = t.z;
  const { n } = assassinate(run, a, t);
  if (!n && !t.dead && t.hp > 0) markMob(run, t, 2);
  // the landing slash nicks everyone close and Marks them
  for (const o of run.mobs.near(tx, tz, 1.9)) {
    if (o === t || o.dead) continue;
    run.hit(o, a.stat('damage') * 0.45, a, { knock: 1.5, fromX: tx, fromZ: tz });
    if (!o.dead) markMob(run, o, 1);
  }
  run.fx.ring(tx, tz, 1.9, MARK_COLOR, 0.25);
}

/** A Caltrops patch at (x, z). Marks thugs on it once a second. Re-scatters once when it runs out with flags.trapRearm. */
export function caltropsAt(run, a, x, z, o = {}) {
  const life = o.life ?? a.stat('duration'), mult = o.mult ?? 1;
  run.zone({ x, z, r: o.r ?? a.stat('area'), life, dps: a.stat('damage') * mult, slow: 0.45, kind: 'glass', color: '#b8c0cc', ability: a,
    onTick: markTicker(run, 1, { trap: true }) });
  if (run.flags.trapRearm && !o.rearmed) {
    run.later(life, () => { if (!run.ended) caltropsAt(run, a, x, z, { ...o, rearmed: true, mult: mult * (1 + run.flags.trapRearm) }); });
  }
}

/** A Tripwire at (x, z). `extra` wires don't count toward the wire limit. Everyone it trips gets 2 Marks. */
export function layTripwire(run, a, x, z, o = {}) {
  const mult = o.mult ?? 1, quick = run.flags.quickTraps ?? 0;
  run.trap({ x, z, ability: a, extra: !!o.extra, trigger: 1.5 * (quick || 1), onTrigger: (tx, tz) => {
    nova(run, a, { x: tx, z: tz, r: a.stat('area'), dmg: a.stat('damage') * mult, knock: 1, root: a.stat('duration'), color: '#bfc8ff',
      onHit: (m) => markMob(run, m, 2, { trap: true }) });
    run.fx.burst(tx, 0.5, tz, '#d8e0ff', 14, 3);
    if (run.flags.trapRearm && !o.rearmed) layTripwire(run, a, tx, tz, { extra: true, rearmed: true, mult: mult * (1 + run.flags.trapRearm) });
  } });
  if (quick && !o.rearmed) run.traps[run.traps.length - 1].arm = 0;
}

/** zone.onTick that Marks every thug inside once a second. */
function markTicker(run, n, o) {
  return (zn, dt) => {
    zn.markT = (zn.markT ?? 0.3) - dt;
    if (zn.markT > 0) return;
    zn.markT = 1;
    run.mobs.each(zn.x, zn.z, zn.r, (m) => markMob(run, m, n, o));
  };
}

/** Poison Tips: poison 60% of a hit over 3s, and Mark it. */
function tipPoison(run, m, dmg) {
  if (!run.flags.poisonTips || m.dead || m.hp <= 0) return;
  run.ignite(m, dmg * 0.6, 3);
  markMob(run, m, 1, { poison: true });
}

export const GHOST_ABILITIES = [
  {
    id: 'shadow_step', name: 'Shadow Step', icon: '🌘', tags: ['melee', 'execute'],
    desc: 'Her shadow blinks between the most Marked (or most wounded) thugs nearby and strikes each, cashing in its Marks: executes regular thugs under the line (+4% per Mark), heavy damage otherwise. A thug with no Marks gets 2, and every landing slashes and Marks those close by. While Cloaked she strikes one more thug.',
    base: { damage: 40, cooldown: 1.2, range: 9, execute: 0.1, count: 2 },
    upgrades: [DMG, CD, pctUp('range', 'Reach', 15), addUp('count', 'Steps', [0, 0, 1, 0, 1], null, 4)],
    ready: (run, a) => pickPrey(run, a, run.player.x, run.player.z, a.stat('range'), a.stat('count')),
    fire(run, a, ts) {
      const p = run.player, hit = new Set();
      let x = p.x, z = p.z, n = a.stat('count') + (run.buffs.cloak ? 1 : 0);
      const list = ts.filter((t) => !t.dead);
      if (!list.length) return false;
      for (let i = 0; i < n; i++) {
        let t = list[i];
        if (!t) t = pickPrey(run, a, x, z, a.stat('range') * 0.8, 1, hit)[0];
        if (!t) break;
        hit.add(t);
        stepStrike(run, a, x, z, t);
        x = t.x; z = t.z;
      }
      p.aim(list[0].x, list[0].z, 0.2);
      sfx('select', 0.05);
    },
  },
  {
    id: 'knives', name: 'Throwing Knives', icon: '🔪', tags: ['projectile', 'thrown'],
    desc: 'A fan of knives that slice through anyone in the way.',
    base: { damage: 16, cooldown: 2.2, range: 11, speed: 30, count: 5, pierce: 2 },
    upgrades: [DMG, { ...scUp('count', 'Knives', 2), int: true }, CD, addUp('pierce', 'Pierce', [0, 1, 1, 2, 2], null, 6)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const base = angleTo(run, t), n = a.stat('count');
      const onHit = run.flags.poisonTips ? (m) => tipPoison(run, m, a.stat('damage')) : null;
      for (let i = 0; i < n; i++) run.shoot({ x: run.player.x, z: run.player.z, y: 0.8, angle: base + (i - (n - 1) / 2) * 0.13, speed: a.stat('speed'), dmg: a.stat('damage'), range: a.stat('range') * 1.2, pierce: a.stat('pierce'), size: 0.9, color: '#dfe6ee', ability: a, onHit });
      // Card Sharp: at the end of their flight the knives turn round and fly back to Lucy
      if (run.flags.knifeReturn) {
        const x0 = run.player.x, z0 = run.player.z, len = a.stat('range') * 1.2, sp = a.stat('speed');
        const dmg = a.stat('damage') * run.flags.knifeReturn, pierce = a.stat('pierce');
        run.later(len / sp, () => {
          if (run.ended) return;
          const p = run.player;
          for (let i = 0; i < n; i++) {
            const ang = base + (i - (n - 1) / 2) * 0.13;
            const ex = x0 + Math.sin(ang) * len, ez = z0 + Math.cos(ang) * len;
            run.shoot({ x: ex, z: ez, y: 0.8, angle: Math.atan2(p.x - ex, p.z - ez), speed: sp, dmg, range: Math.hypot(p.x - ex, p.z - ez) + 1, pierce, size: 0.9, color: '#ffd36b', ability: a, onHit });
          }
        });
      }
      sfx('shot', 0.05);
    },
  },
  {
    id: 'smoke', name: 'Smoke Bomb', icon: '💨', tags: ['control', 'buff'],
    desc: 'Vanishes in smoke: thugs inside are slowed and Lucy dodges a lot more for a while.',
    base: { cooldown: 12, area: 4.2, duration: 4, power: 0.35 },
    upgrades: [DUR, AREA, CD, scUp('power', 'Evasion', 0.06, (v) => `+${Math.round(v * 100)}% dodge in smoke`)],
    useless: permanentUptime,
    ready: (run, a) => run.crowd(a, 3, 2),
    fire(run, a) {
      const p = run.player, pw = a.stat('power');
      run.zone({ x: p.x, z: p.z, r: a.stat('area'), life: a.stat('duration'), slow: 0.5, kind: 'smoke', ability: a,
        onTick: run.flags.ambush ? markTicker(run, 1) : undefined });
      buff(run, a, { fx: '#9aa0aa', stats: (s) => { s.dodge += pw; if (run.flags.ambush) s.crit += 0.25; } });
      run.fx.burst(p.x, 0.6, p.z, '#8a8f99', 26, 5, 0.9, 2, -1);
      sfx('select');
    },
  },
  {
    id: 'poison_dart', name: 'Poison Dart', icon: '🎯', tags: ['projectile', 'poison'],
    desc: 'Blowgun darts at the toughest thugs. The poison does far more than the dart, and every dart leaves 2 Marks.',
    base: { damage: 8, cooldown: 1.6, range: 15, speed: 36, count: 2, power: 75 },
    upgrades: [scUp('power', 'Poison', 22, (v) => `+${Math.round(v)} poison damage`), CD, addUp('count', 'Darts', [0, 1, 1, 1, 2], null, 6)],
    ready: (run, a) => run.mobs.targets(run.player.x, run.player.z, a.stat('range'), a.stat('count'), 'strongest'),
    fire(run, a, ts) {
      for (let i = 0; i < a.stat('count'); i++) {
        const t = ts[i % ts.length];
        run.shoot({ x: run.player.x, z: run.player.z, y: 0.9, angle: angleTo(run, t), speed: a.stat('speed'), dmg: a.stat('damage'), range: a.stat('range') * 1.2, size: 0.6, color: '#8bff6a', ability: a,
          onHit: (m) => {
            if (m.dead || m.hp <= 0) return;
            run.ignite(m, a.stat('power') * run.stats.dmg, 4);
            markMob(run, m, 2, { poison: true });
          } });
      }
    },
  },
  {
    id: 'caltrops', name: 'Caltrops', icon: '📌', tags: ['control', 'trap'],
    desc: 'Scatters jacks behind her. Thugs that step on them are slowed, hurt and Marked once a second.',
    base: { damage: 12, cooldown: 4, area: 2.6, duration: 6 },
    upgrades: [DMG, AREA, DUR, CD],
    ready: (run) => run.mobs.count(run.player.x, run.player.z, 10) > 0,
    fire(run, a) {
      caltropsAt(run, a, run.player.x, run.player.z);
    },
    place: caltropsAt, // (run, a, x, z, o) for pairings
  },
  {
    id: 'garrote', name: 'Garrote', icon: '🧶', tags: ['melee', 'execute'],
    desc: 'Sneaks behind the most Marked or wounded thug in reach and cashes in its Marks: executes regular thugs under the line (+4% per Mark), heavy damage (+20% per Mark) otherwise.',
    base: { damage: 70, cooldown: 2.4, range: 6, execute: 0.3 },
    upgrades: [DMG, CD, addUp('execute', 'Execute', [0.03, 0.05, 0.07, 0.09, 0.12], (v) => `+${Math.round(v * 100)}% execute threshold`, 0.4), pctUp('range', 'Reach', 15)],
    ready: (run, a) => pickPrey(run, a, run.player.x, run.player.z, a.stat('range'), 1)[0] ?? null,
    fire(run, a, t) {
      garroteStrike(run, a, t);
    },
  },
  {
    id: 'decoy', name: 'Cardboard Decoy', icon: '🎭', tags: ['summon'],
    desc: 'Props up a cardboard cut-out of herself. Thugs nearby go beat on it instead of her (bosses aren\'t fooled), then it explodes and Marks everyone it caught twice.',
    base: { damage: 40, cooldown: 12, duration: 6, area: 3.6 },
    upgrades: [DMG, DUR, CD, AREA],
    ready: (run, a) => run.crowd(a, 6, 5),
    fire(run, a) {
      const p = run.player;
      // set it down a couple of steps toward the crowd so they pile up away from her
      const t = run.mobs.target(p.x, p.z, 8, 'cluster');
      const ang = t ? Math.atan2(t.x - p.x, t.z - p.z) : p.facing;
      const [x, z] = run.world.freeSpot(p.x + Math.sin(ang) * 2.5, p.z + Math.cos(ang) * 2.5, 0.6);
      run.combat.decoy({ x, z, life: a.stat('duration'), lure: 9, ability: a, onEnd: (d) => {
        const r = a.stat('area');
        run.explode(d.x, d.z, r, a.stat('damage'), a);
        for (const m of run.mobs.near(d.x, d.z, r * (1 + run.stats.blastArea))) markMob(run, m, 2);
        run.fx.burst(d.x, 1, d.z, '#c8a060', 18, 5);
      } });
      run.fx.burst(x, 0.8, z, '#c8a060', 16, 3);
    },
  },
  {
    id: 'cloak', name: 'Cloak', icon: '🫥', tags: ['buff'],
    desc: 'Turns nearly invisible. Huge crit chance and crit damage while it lasts, and every Mark source adds one more Mark. Shadow Step strikes one more thug while it lasts.',
    base: { cooldown: 15, duration: 4.5, power: 0.3 },
    upgrades: [DUR, CD, scUp('power', 'Lethality', 0.08, (v) => `+${Math.round(v * 100)}% cloak crit`)],
    useless: permanentUptime,
    ready: (run, a) => run.crowd(a, 10, 3),
    fire(run, a) {
      cloakBuff(run, a);
      sfx('frenzy', 0.1);
    },
    wrap: cloakBuff, // (run, a, seconds) for pairings
  },
  {
    id: 'tripwire', name: 'Tripwire', icon: '🪢', tags: ['trap', 'control'],
    desc: 'Strings a wire. The first thug to cross it trips everyone nearby into a nap and leaves them 2 Marks.',
    base: { damage: 20, cooldown: 4.5, area: 4, count: 2, duration: 2 },
    upgrades: [AREA, pctUp('duration', 'Sleep', 20), addUp('count', 'Max Wires', [0, 1, 1, 1, 2], null, 6), DMG],
    ready: (run, a) => run.traps.filter((t) => t.ability === a && !t.extra).length < a.stat('count') && run.mobs.count(run.player.x, run.player.z, 12) > 0,
    fire(run, a) {
      const p = run.player, ang = rand(0, TAU);
      layTripwire(run, a, p.x + Math.sin(ang) * 2, p.z + Math.cos(ang) * 2);
    },
    place: layTripwire, // (run, a, x, z, o) for pairings
  },
  {
    id: 'sleep_gas', name: 'Sleeping Gas', icon: '😪', tags: ['control', 'thrown', 'poison'],
    desc: 'A canister of knockout gas. Thugs inside are slowed to a crawl, poisoned and Marked once a second.',
    base: { damage: 6, cooldown: 8, range: 12, area: 3.6, duration: 4 },
    upgrades: [AREA, DUR, CD, pctUp('damage', 'Poison', 20)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      run.lob({ tx: t.x, tz: t.z, dur: 0.6, kind: 'gas', color: '#c8a0ff', onLand: (x, z) => {
        if (run.ended) return;
        run.zone({ x, z, r: a.stat('area'), life: a.stat('duration'), dps: a.stat('damage'), slow: 0.8, kind: 'gas', color: '#b28cff', ability: a,
          onTick: markTicker(run, 1, { poison: true }) });
      } });
    },
  },
  {
    id: 'shuriken', name: 'Shuriken Ring', icon: '✴️', tags: ['orbit', 'aura'],
    desc: 'Throwing stars circle her nonstop. Light cuts, but every star that lands leaves a Mark.',
    base: { damage: 4, count: 3, area: 2.8 },
    upgrades: AURA_UPS('Stars'),
    aura: {
      model: 'shuriken', color: '#c9d2dc', spark: MARK_COLOR, spin: 7, knock: 0.5,
      // called by combat.js as orbit.onHit(m), `this` = the orbit (which carries the ability)
      onHit(m) {
        const a = this.ability, run = a?.run;
        if (!run || m.dead || m.hp <= 0) return;
        markMob(run, m, 1);
        tipPoison(run, m, a.stat('damage'));
      },
    },
  },
  {
    id: 'curtain_call', noStart: true, name: 'Curtain Call', icon: '🥀', tags: ['execute', 'aoe'],
    desc: 'A snap of the fingers at the most Marked thug in reach: its Marks are cashed in (each one a stab of damage; regular thugs under the line, +4% per Mark, drop dead) and scatter like petals: every thug within 3.5 of it gets that many Marks (up to 3).',
    base: { damage: 22, cooldown: 4.5, range: 10, execute: 0.08, area: 3.5 },
    upgrades: [DMG, CD, AREA, addUp('execute', 'Execute', [0.02, 0.03, 0.04, 0.05, 0.06], (v) => `+${Math.round(v * 100)}% execute threshold`, 0.3)],
    ready(run, a) {
      // wants a thug with 3+ Marks, settles for fewer the longer it waits
      const t = pickPrey(run, a, run.player.x, run.player.z, a.stat('range'), 1)[0];
      const want = Math.max(1, Math.ceil(3 * Math.max(0.2, 1 - (a.wait ?? 0) / 4)));
      return t && marksOn(run, t) >= want ? t : null;
    },
    fire(run, a, t) {
      if (!t || t.dead) return false;
      const p = run.player, x = t.x, z = t.z;
      const n = cashMarks(run, t, a);
      run.fx.beam(p.x, p.z, x, z, MARK_COLOR, 0.08, 0.2, 1);
      if (canExecute(run, t, a.stat('execute') + n * markExec(run))) executeMob(run, a, t);
      else run.hit(t, a.stat('damage') * Math.max(1, n), a, { knock: 0.5 });
      const spread = Math.min(3, n);
      if (spread > 0) {
        for (const m of run.mobs.near(x, z, a.stat('area'))) if (m !== t) markMob(run, m, spread);
      }
      run.fx.ring(x, z, a.stat('area'), MARK_COLOR, 0.35);
      run.fx.burst(x, 1, z, '#d0306a', 10 + n * 3, 4);
      sfx('snipe', 0.08);
    },
  },
];
