import { sfx } from '../../audio.js';
import { TAU, rand } from '../../util.js';
import { pctUp, scUp, addUp, DMG, CD, AREA, DUR, permanentUptime, angleTo, line, nova, chill, buff, AURA_UPS } from '../common.js';

/**
 * Lucy "The Ghost" — the Spy. Precise, sneaky, crit-hungry. Lots of control
 * (slows, sleeps) and gadgets.
 *
 * Talent / gear hooks (run.flags, all off by default):
 *   execChain     n   — Garrote executes jump to up to n more wounded thugs (Back Alley 5pc)
 *   trapRearm     f   — Tripwire and Caltrops re-arm once, the re-armed one deals +f (Smuggler 5pc)
 *   quickTraps    f   — Tripwires arm instantly, trigger radius ×f (Smuggler 3pc)
 *   knifeReturn   f   — Throwing Knives fly back to Lucy for ×f damage (Card Sharp 5pc)
 *   cloakBreak    f   — when Cloak ends, Garrote strikes for free for ×f damage (From the Shadows)
 *   cloakOutCrit  s   — every hit crits for s seconds after Cloak ends (Shadow Clan 5pc)
 *
 * Pairings reach the helpers below through the partner's def (talents.js and
 * gear.js stay free of browser imports): caltrops/tripwire.place(run, a, x, z, o)
 * and cloak.wrap(run, a, seconds).
 */

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
    const t = run.mobs.target(p.x, p.z, g.stat('range') * 1.5, 'nearest');
    if (t) garroteStrike(run, g, t, run.flags.cloakBreak);
  }
}

/** Garrote on mob t (×mult damage when it doesn't execute). Executes chain on with flags.execChain. */
export function garroteStrike(run, a, t, mult = 1) {
  if (t.dead) return;
  const ex = a.stat('execute');
  const exec = t.tier === 0 && t.hp / t.maxHp <= ex;
  const dmg = exec ? t.hp + 1 : a.stat('damage') * mult;
  if (exec && run.stats.execHeal) run.heal(run.stats.execHeal);
  run.hit(t, dmg, a, { knock: 0 });
  const p = run.player, d = Math.hypot(t.x - p.x, t.z - p.z);
  run.combat.shadow({ x: p.x, z: p.z, angle: angleTo(run, t), len: Math.max(0, d - 0.8), dur: 0.14, color: '#c32020' });
  run.fx.burst(t.x, 1, t.z, '#c32020', 10, 4);
  run.player.aim(t.x, t.z, 0.2);
  // Back Alley: the wire moves on to the next wounded thug
  let jumps = exec ? run.flags.execChain ?? 0 : 0, cur = t;
  while (jumps-- > 0) {
    let best = null, bd = Infinity;
    run.mobs.each(cur.x, cur.z, a.stat('range'), (m) => {
      if (m.dead || m.tier !== 0 || m.hp / m.maxHp > ex) return;
      const q = (m.x - cur.x) ** 2 + (m.z - cur.z) ** 2;
      if (q < bd) { bd = q; best = m; }
    });
    if (!best) break;
    if (run.stats.execHeal) run.heal(run.stats.execHeal);
    run.combat.shadow({ x: cur.x, z: cur.z, angle: Math.atan2(best.x - cur.x, best.z - cur.z), len: Math.max(0, Math.sqrt(bd) - 0.8), dur: 0.14, color: '#c32020' });
    run.hit(best, (best.hp + 1) / Math.max(0.1, 1 - (best.armor ?? 0)), a, { knock: 0, noCrit: true });
    run.fx.burst(best.x, 1, best.z, '#c32020', 10, 4);
    cur = best;
  }
}

/** A Caltrops patch at (x, z). Re-scatters once when it runs out with flags.trapRearm. */
export function caltropsAt(run, a, x, z, o = {}) {
  const life = o.life ?? a.stat('duration'), mult = o.mult ?? 1;
  run.zone({ x, z, r: o.r ?? a.stat('area'), life, dps: a.stat('damage') * mult, slow: 0.45, kind: 'glass', color: '#b8c0cc', ability: a });
  if (run.flags.trapRearm && !o.rearmed) {
    run.later(life, () => { if (!run.ended) caltropsAt(run, a, x, z, { ...o, rearmed: true, mult: mult * (1 + run.flags.trapRearm) }); });
  }
}

/** A Tripwire at (x, z). `extra` wires don't count toward the wire limit. */
export function layTripwire(run, a, x, z, o = {}) {
  const mult = o.mult ?? 1, quick = run.flags.quickTraps ?? 0;
  run.trap({ x, z, ability: a, extra: !!o.extra, trigger: 1.5 * (quick || 1), onTrigger: (tx, tz) => {
    nova(run, a, { x: tx, z: tz, r: a.stat('area'), dmg: a.stat('damage') * mult, knock: 1, root: a.stat('duration'), color: '#bfc8ff' });
    run.fx.burst(tx, 0.5, tz, '#d8e0ff', 14, 3);
    if (run.flags.trapRearm && !o.rearmed) layTripwire(run, a, tx, tz, { extra: true, rearmed: true, mult: mult * (1 + run.flags.trapRearm) });
  } });
  if (quick && !o.rearmed) run.traps[run.traps.length - 1].arm = 0;
}
export const GHOST_ABILITIES = [
  {
    id: 'silenced', name: 'Silenced Pistol', icon: '🔇', tags: ['gun', 'projectile'],
    desc: 'Quiet, quick shots at the nearest thug. Extra crit chance.',
    base: { damage: 12, cooldown: 0.36, range: 14, speed: 44, count: 1, pierce: 0, crit: 0.1 },
    upgrades: [DMG, pctUp('cooldown', 'Fire Rate', 12), addUp('pierce', 'Pierce', [0, 0, 1, 1, 2], null, 4), addUp('count', 'Extra Shot', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.targets(run.player.x, run.player.z, a.stat('range'), a.stat('count'), 'nearest'),
    fire(run, a, ts) {
      const n = a.stat('count');
      for (let i = 0; i < n; i++) {
        const t = ts[i % ts.length];
        const m = run.player.muzzlePos();
        run.shoot({ x: m.x, z: m.z, y: m.y, angle: Math.atan2(t.x - m.x, t.z - m.z) + (ts.length < n ? (i - (n - 1) / 2) * 0.1 : 0), speed: a.stat('speed'), dmg: a.stat('damage'), range: a.stat('range') * 1.25,
          pierce: a.stat('pierce'), bounce: run.flags.ghostRicochet ? 1 : 0, color: '#c8e6ff', ability: a,
          onHit: run.flags.poisonTips ? (mob) => run.ignite(mob, a.stat('damage') * 0.6, 3) : null });
      }
      run.player.aim(ts[0].x, ts[0].z);
      sfx('shot', 0.03);
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
      for (let i = 0; i < n; i++) run.shoot({ x: run.player.x, z: run.player.z, y: 0.8, angle: base + (i - (n - 1) / 2) * 0.13, speed: a.stat('speed'), dmg: a.stat('damage'), range: a.stat('range') * 1.2, pierce: a.stat('pierce'), size: 0.9, color: '#dfe6ee', ability: a });
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
            run.shoot({ x: ex, z: ez, y: 0.8, angle: Math.atan2(p.x - ex, p.z - ez), speed: sp, dmg, range: Math.hypot(p.x - ex, p.z - ez) + 1, pierce, size: 0.9, color: '#ffd36b', ability: a });
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
      run.zone({ x: p.x, z: p.z, r: a.stat('area'), life: a.stat('duration'), slow: 0.5, kind: 'smoke', ability: a });
      buff(run, a, { fx: '#9aa0aa', stats: (s) => { s.dodge += pw; if (run.flags.ambush) s.crit += 0.25; } });
      run.fx.burst(p.x, 0.6, p.z, '#8a8f99', 26, 5, 0.9, 2, -1);
      sfx('select');
    },
  },
  {
    id: 'poison_dart', name: 'Poison Dart', icon: '🎯', tags: ['projectile', 'poison'],
    desc: 'Blowgun darts at the toughest thugs. The poison does far more than the dart.',
    base: { damage: 8, cooldown: 1.6, range: 15, speed: 36, count: 2, power: 75 },
    upgrades: [scUp('power', 'Poison', 22, (v) => `+${Math.round(v)} poison damage`), CD, addUp('count', 'Darts', [0, 1, 1, 1, 2], null, 6)],
    ready: (run, a) => run.mobs.targets(run.player.x, run.player.z, a.stat('range'), a.stat('count'), 'strongest'),
    fire(run, a, ts) {
      for (let i = 0; i < a.stat('count'); i++) {
        const t = ts[i % ts.length];
        run.shoot({ x: run.player.x, z: run.player.z, y: 0.9, angle: angleTo(run, t), speed: a.stat('speed'), dmg: a.stat('damage'), range: a.stat('range') * 1.2, size: 0.6, color: '#8bff6a', ability: a,
          onHit: (m) => run.ignite(m, a.stat('power') * run.stats.dmg, 4) });
      }
    },
  },
  {
    id: 'caltrops', name: 'Caltrops', icon: '📌', tags: ['control', 'trap'],
    desc: 'Scatters jacks behind her. Thugs that step on them are slowed and hurt.',
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
    desc: 'Sneaks behind the nearest wounded thug and finishes them. Executes regular thugs under the threshold; heavy damage otherwise.',
    base: { damage: 70, cooldown: 2.4, range: 6, execute: 0.35 },
    upgrades: [DMG, CD, addUp('execute', 'Execute', [0.03, 0.05, 0.07, 0.09, 0.12], (v) => `+${Math.round(v * 100)}% execute threshold`, 0.4), pctUp('range', 'Reach', 15)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'nearest'),
    fire(run, a, t) {
      garroteStrike(run, a, t);
    },
  },
  {
    id: 'decoy', name: 'Cardboard Decoy', icon: '🎭', tags: ['summon'],
    desc: 'Props up a cardboard cut-out of herself. Thugs nearby go beat on it instead of her (bosses aren\'t fooled), then it explodes.',
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
        run.explode(d.x, d.z, a.stat('area'), a.stat('damage'), a);
        run.fx.burst(d.x, 1, d.z, '#c8a060', 18, 5);
      } });
      run.fx.burst(x, 0.8, z, '#c8a060', 16, 3);
    },
  },
  {
    id: 'cloak', name: 'Cloak', icon: '🫥', tags: ['buff'],
    desc: 'Turns nearly invisible. Huge crit chance and crit damage while it lasts.',
    base: { cooldown: 15, duration: 4, power: 0.3 },
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
    desc: 'Strings a wire. The first thug to cross it trips everyone nearby into a nap.',
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
    desc: 'A canister of knockout gas. Thugs inside are slowed to a crawl and poisoned.',
    base: { damage: 6, cooldown: 8, range: 12, area: 3.6, duration: 4 },
    upgrades: [AREA, DUR, CD, pctUp('damage', 'Poison', 20)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      run.lob({ tx: t.x, tz: t.z, dur: 0.6, kind: 'gas', color: '#c8a0ff', onLand: (x, z) => {
        run.zone({ x, z, r: a.stat('area'), life: a.stat('duration'), dps: a.stat('damage'), slow: 0.8, kind: 'gas', color: '#b28cff', ability: a });
      } });
    },
  },
  {
    id: 'shuriken', name: 'Shuriken Ring', icon: '✴️', tags: ['orbit', 'aura'],
    desc: 'Throwing stars circle her nonstop at high speed.',
    base: { damage: 5, count: 3, area: 2.8 },
    upgrades: AURA_UPS('Stars'),
    aura: { model: 'shuriken', color: '#c9d2dc', spark: '#ffffff', spin: 7, knock: 1 },
  },
  {
    id: 'laser_watch', name: 'Laser Watch', icon: '⌚', tags: ['beam'],
    desc: 'A wristwatch laser. Cuts a line through everything toward the biggest target.',
    base: { damage: 45, cooldown: 4, range: 16, area: 0.6 },
    upgrades: [DMG, CD, pctUp('range', 'Length', 15), AREA],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest'),
    fire(run, a, t) {
      line(run, a, { angle: angleTo(run, t), len: a.stat('range'), width: a.stat('area'), dmg: a.stat('damage'), knock: 1, color: '#ff3a6a' });
      run.player.aim(t.x, t.z, 0.3);
      sfx('snipe', 0.1);
    },
  },
];
