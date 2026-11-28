import { sfx } from '../../audio.js';
import { TAU, rand } from '../../util.js';
import { pctUp, scUp, addUp, DMG, CD, AREA, DUR, permanentUptime, angleTo, cone, nova, buff, AURA_UPS, slamOnWall } from '../common.js';

/**
 * Tiny Tony Two-Fists — the Brawler. No guns, ever. Up close and personal: big
 * swings, knockback into walls (slams), throws, and a Rage meter that fills as
 * he gives and takes a beating. See heroes/lenny/abilities.js for the format.
 * A full meter fires his signature move, Berserk (TONY_SIGNATURE): the Total
 * Meltdown stomps, then 6s of fury where every hit can slam.
 *
 * Flags read here (talents / gear, all default off):
 *   tonyRageGain   +x Rage gained          tonyRageDmg   extra damage per Rage point
 *   tonyGrudge     Rage drains later/slower tonyJuiceRage extra Rage per Juice Box
 *   tonyKnock      +x melee knockback       tonySlamPct   +x slam damage
 *   tonySlamStun   slammed thugs are stunned for x s
 *   tonySlamWave   slams splash x of the slam's damage on thugs around the impact
 *   tonyGrabReach  ×x Headlock grab reach   tonyThrowSlam thrown thugs slam for double
 *   tonyLandWave   Headlock landings knock everything in 2× area away (x of its damage)
 *   tonyDoubleGrab Headlock throws two thugs
 *   tonyShortTemper Berserk is ready this much Rage early (Short Temper)
 *   tonyLetItOut   Berserk refills Iron Belly's shield to x of its size (Let It Out)
 *   + the older ones: tonyCombo, tonyShockwave, tonyWideSwing, tonyRageSpin, tonyQuake,
 *     tonyRushStun, tonyQuakeTrail, tonyWreckingBall, tonyBellyBank, tonyThorns, tonyTagTeam
 */

// ── Rage ────────────────────────────────────────────────────────────────────

/** Add Rage (talent bonus, doubled while Juice Box Rage is up). */
/** Rage fill cap: about one full meter per RAGE_FILL_S seconds at most, with a small burst bank. */
const RAGE_FILL_S = 35, RAGE_BANK = 15;
function rage(run, n) {
  if (run.res?.id !== 'rage' || !(n > 0) || run.buffs.tony_berserk) return;
  const c = run.counters;
  c.rageBank ??= RAGE_BANK;
  const want = n * (1 + (run.flags.tonyRageGain ?? 0)) * (run.buffs.roid_rage ? 2 : 1);
  const got = Math.min(want, c.rageBank);
  c.rageBank -= got;
  run.gainRes(got);
}

/** Damage per Rage point (0.2% each → +20% at full). */
const rageDmg = (run) => 0.002 + (run.flags.tonyRageDmg ?? 0);

/** Is Berserk (the signature's 6s fury) running? */
const berserk = (run) => !!run.buffs.tony_berserk;

/** Rage that counts for the passive bonus: all of it while Berserk. */
const rageNow = (run) => (berserk(run) ? run.res.max : run.res.value);

/**
 * Per-frame Rage upkeep: rage from damage taken (HP lost + shield soaked), from
 * the hands-off abilities (Lariat, Little Brother), and the hidden buff that turns
 * the meter into damage.
 */
function rageTick(run, dt) {
  const r = run.res, c = run.counters, p = run.player, f = run.flags;
  // the fill cap refills over time (faster with Short Fuse / Juice Box)
  c.rageBank = Math.min(RAGE_BANK, (c.rageBank ?? RAGE_BANK) + dt * (100 / RAGE_FILL_S) * (1 + (f.tonyRageGain ?? 0) * 0.5) * (run.buffs.roid_rage ? 2 : 1));
  r.decayDelay = f.tonyGrudge ? 6 : 3;
  r.decay = f.tonyGrudge ? 4 : 8;
  if (run.buffs.roid_rage) r.idle = 0; // juiced: no draining
  // getting hit makes him mad
  let taken = 0;
  const log = run.log?.taken;
  if (log) for (const k in log) taken += log[k];
  const lost = taken - (c.rageTaken ?? taken);
  c.rageTaken = taken;
  const soak = Math.max(0, (c.rageShield ?? p.shield) - p.shield);
  c.rageShield = p.shield;
  const d = lost + soak;
  if (d > 0) rage(run, 2 + (d / run.stats.maxHp) * 120);
  // the always-on fists / bros: a trickle while they're connecting
  c.rageT = (c.rageT ?? 0) + dt;
  if (c.rageT >= 0.5) {
    c.rageT = 0;
    for (const id of ['lariat', 'little_bro']) {
      const v = run.dmgBy[id] ?? 0, key = `rageDmg_${id}`;
      if (v > (c[key] ?? 0)) rage(run, 1);
      c[key] = v;
    }
  }
  // the meter is power: +damage per point, and less damage taken at full (or Berserk)
  if (!run.buffs._tonyRage) {
    run.buffs._tonyRage = {
      t: Infinity, max: Infinity,
      stats: (s, b, rr) => {
        const res = rr.res;
        if (!res) return;
        s.dmg += rageNow(rr) * rageDmg(rr);
        if (rageNow(rr) >= res.max) s.armor += 0.1;
      },
    };
  }
  // seeing red: a full meter steams, Berserk glows
  if (berserk(run)) {
    if (Math.random() < dt * 25) run.fx.burst(p.x + rand(-0.5, 0.5), rand(0.4, 1.8), p.z + rand(-0.5, 0.5), '#ff2a1a', 2, 3, 0.5, 0.8, -3);
  } else if (r.value >= r.max && Math.random() < dt * 10) run.fx.burst(p.x, 1.6, p.z, '#ff3b2a', 1, 2, 0.4, 0.7, -3);
}

/** What Rage gives right now, for the HUD (under the HP bar). */
function rageBonus(run) {
  const r = run.res;
  if (!r) return '';
  const pct = Math.round(rageNow(run) * rageDmg(run) * 100);
  const full = rageNow(run) >= r.max;
  return `+${pct}% dmg${full ? ' · -10% dmg taken' : ''}`;
}

export const TONY_START = 'haymaker';

export const TONY_RESOURCE = {
  id: 'rage', name: 'Rage', icon: '💢', color: '#ff3b2a', max: 100, start: 0, decay: 8, decayDelay: 3,
  desc: 'Rage fills when Tony lands hits, slams thugs into walls and gets hurt. It drains if he stops fighting for 3s. '
    + 'While it fills, every point gives +0.2% damage (+20% at 100). '
    + 'At 100 Rage he goes BERSERK: stomps that fling everything into the walls, then 6s at full Rage power where every hit can slam. '
    + 'Folding Chair can spend some Rage on a Chair Shot; Juice Box Rage tops it up.',
  label: (run) => (berserk(run) ? `BERSERK ${Math.ceil(run.buffs.tony_berserk.t)}s` : `${Math.floor(run.res.value)} / ${run.res.max}`),
  bonus: rageBonus,
  tick: rageTick,
};

// ── slams and throws ────────────────────────────────────────────────────────

/** Knockback with Heavy Hands. */
const kn = (run, k) => k * (1 + (run.flags.tonyKnock ?? 0)) * (berserk(run) ? BERSERK_KNOCK : 1);

/**
 * Wall slam: after a knockback hit, `frac` of `a`'s damage if the thug then hits a
 * wall. Slams feed Rage and the slam talents / sets.
 */
function slam(run, m, a, frac, window = 0.5) {
  if (!m || m.dead || m.tier >= 2) return;
  slamFor(run, m, a, a.stat('damage') * frac, window);
}

/** Wall slam for a flat `base` damage (Brick Wall applies); Berserk widens the window. */
function slamFor(run, m, a, base, window = 0.5) {
  if (!m || m.dead || m.tier >= 2) return;
  const f = run.flags;
  const dmg = base * (1 + (f.tonySlamPct ?? 0));
  if (berserk(run)) window = Math.max(window, 1);
  slamOnWall(run, m, a, dmg, window, (mm) => {
    rage(run, 3);
    if (f.tonySlamStun && !mm.dead) mm.rootT = Math.max(mm.rootT, f.tonySlamStun * (mm.tier >= 1 ? 0.5 : 1));
    if (f.tonySlamWave) {
      for (const o of run.mobs.near(mm.x, mm.z, 2.2)) {
        if (o !== mm && !o.dead) run.hit(o, dmg * f.tonySlamWave, a, { knock: 3, fromX: mm.x, fromZ: mm.z, noCrit: true });
      }
      run.fx.ring(mm.x, mm.z, 2.2, '#d8d2c8', 0.25);
    }
  });
}

/** Thugs Tony can get his arms around: nearest first, no bosses. */
function grabbable(run, n = 1) {
  const reach = 3.5 * (run.flags.tonyGrabReach ?? 1);
  const out = [];
  for (const m of run.mobs.candidates(run.player.x, run.player.z, reach, 'nearest')) {
    if (m.tier < 2) out.push(m);
    if (out.length >= n) break;
  }
  return out;
}

/** Where to throw thug `t`: the thickest knot of others within `range` (not right next to him). */
function throwSpot(run, t, range) {
  const c = run.mobs.candidates(t.x, t.z, range, 'nearest');
  const step = Math.max(1, Math.floor(c.length / 30));
  let best = null, bn = 0;
  for (let i = 0; i < c.length; i += step) {
    const m = c[i];
    if (m === t || m._d2 < 4) continue;
    const n = run.mobs.count(m.x, m.z, 3) + m.tier * 2;
    if (n > bn) { bn = n; best = m; }
  }
  return best ? { x: best.x, z: best.z } : null;
}

/**
 * Headlock throw: thug `t` is hurled at a crowd (real knockback, so walls stop it
 * and slam it). It lands when it runs into another thug, a wall or runs out of
 * steam: everything it lands on is hit, knocked flat and can slam; the thrown
 * thug takes 125% and is stunned. o.dmg scales the damage (free throws).
 */
function throwMob(run, a, t, o = {}) {
  if (!t || t.dead || t.tier >= 2) return false;
  const f = run.flags, p = run.player;
  const mult = o.dmg ?? 1;
  const range = a.stat('range');
  const spot = throwSpot(run, t, range);
  let dx, dz, d;
  if (spot) {
    dx = spot.x - t.x; dz = spot.z - t.z;
    d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    d = Math.min(range, d);
  } else {
    // nobody to throw him at: over the shoulder, away from Tony
    const ang = Math.atan2(t.x - p.x, t.z - p.z);
    dx = Math.sin(ang); dz = Math.cos(ang);
    d = range * 0.6;
  }
  // knockback decays as e^-8t, so a push of 8·d carries him about d
  const k = d * 8 * (t.tier >= 1 ? 0.8 : 1);
  t.kx = dx * k; t.kz = dz * k;
  t.rootT = Math.max(t.rootT, 0.6);
  if (!t.def?.fly) { t.vy = Math.max(t.vy ?? 0, 6); t.grounded = false; }
  slam(run, t, a, 0.8 * mult * (f.tonyThrowSlam ? 2 : 1), 0.6);
  run.fx.burst(t.x, 1, t.z, '#ffe0c0', 8, 3);
  p.aim(t.x, t.z, 0.3);
  sfx('hit');
  const sx = t.x, sz = t.z;
  let steps = 0;
  const step = () => {
    steps++;
    let land = t.dead || steps >= 8 || (steps >= 2 && Math.hypot(t.kx, t.kz) < 3);
    if (!land && Math.hypot(t.x - sx, t.z - sz) > 1.2) {
      run.mobs.each(t.x, t.z, t.radius + 0.4, (m) => { if (m !== t) land = true; });
    }
    if (!land) { run.later(0.05, step); return; }
    landAt(run, a, t, mult);
  };
  run.later(0.05, step);
  return true;
}

/** The landing: thrown thug `t` comes down on whoever is under him. */
function landAt(run, a, t, mult) {
  const f = run.flags;
  const x = t.x, z = t.z, r = a.stat('area'), dmg = a.stat('damage') * mult;
  a.landing = { x, z, t: run.time }; // for pairings (Pile On)
  if (!t.dead) { t.kx *= 0.2; t.kz *= 0.2; }
  let n = 0;
  for (const m of run.mobs.near(x, z, r)) {
    if (m === t || m.dead) continue;
    run.hit(m, dmg, a, { knock: kn(run, 7), fromX: x, fromZ: z });
    if (!m.dead) {
      m.rootT = Math.max(m.rootT, m.tier >= 1 ? 0.2 : 0.5);
      slam(run, m, a, 0.5 * mult);
    }
    n++;
  }
  if (!t.dead) {
    run.hit(t, dmg * 1.25, a, {});
    if (!t.dead) t.rootT = Math.max(t.rootT, a.stat('duration') * (t.tier >= 1 ? 0.4 : 1));
  }
  // Dock Worker (5): the landing knocks everything around away into the walls
  const wave = f.tonyLandWave ?? 0;
  if (wave) {
    for (const m of run.mobs.near(x, z, r * 2)) {
      if (m === t || m.dead) continue;
      run.hit(m, dmg * wave, a, { knock: kn(run, 11), fromX: x, fromZ: z, noCrit: true });
      slam(run, m, a, 0.6 * mult);
    }
    run.fx.ring(x, z, r * 2, '#9ad8ff', 0.4);
  }
  run.fx.burst(x, 0.4, z, '#d8c8a8', 18, 6);
  run.fx.ring(x, z, r, '#ffcf9a', 0.35);
  run.shake(0.15);
  sfx('tantrum', 0.08);
  rage(run, 4 + Math.min(n, 6));
}

// ── Folding Chair helper (also used by pairings via def) ────────────────────

const CHAIR_NEED = 50, CHAIR_COST = 20;

/**
 * Folding Chair on thug `t`. With 50+ Rage it spends 20 for a Chair Shot: double
 * damage, huge knockback and a hard slam. `free` = a pairing proc (never spends).
 */
function chairOn(run, a, t, mult = 1, free = false) {
  if (!t || t.dead) return false;
  const shot = !free && run.res?.id === 'rage' && run.res.value >= CHAIR_NEED && run.spendRes(CHAIR_COST);
  const dmg = a.stat('damage') * mult * (shot ? 2 : 1);
  run.hit(t, dmg, a, { knock: kn(run, shot ? 16 : 6) });
  if (!t.dead) {
    const stun = a.stat('duration') * (shot ? 1.5 : 1);
    t.rootT = Math.max(t.rootT, t.tier >= 2 ? stun * 0.3 : stun);
    slam(run, t, a, shot ? 0.8 : 0.3, shot ? 0.7 : 0.5);
  }
  if (!shot) rage(run, 3);
  run.fx.burst(t.x, 1.4, t.z, shot ? '#ff6a4a' : '#c0c4cc', shot ? 24 : 16, 5);
  run.fx.ring(t.x, t.z, shot ? 2.4 : 1.6, shot ? '#ff3b2a' : '#ffffff', 0.3);
  run.player.aim(t.x, t.z, 0.3);
  run.shake(shot ? 0.25 : 0.15);
  sfx('bigshot');
  return true;
}

export const TONY_ABILITIES = [
  {
    id: 'haymaker', name: 'Haymaker', icon: '🥊', tags: ['melee'],
    desc: 'A wild swing at whoever is closest. Hits everything in front of him and knocks them back; thugs knocked into a wall take a slam.',
    base: { damage: 22, cooldown: 0.75, area: 3.2, range: 4.2, count: 1 },
    upgrades: [DMG, pctUp('cooldown', 'Punch Speed', 12), AREA, addUp('count', 'Extra Swing', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range') + a.stat('area') * 0.3, 'nearest'),
    fire(run, a, t) {
      const n = a.stat('count') + (run.flags.tonyCombo ? 1 : 0);
      // Corner Bar (5): every 4th Haymaker also throws a shockwave all around
      const wave = run.flags.tonyShockwave && run.every('tonyShockwave', 4) ? run.flags.tonyShockwave : 0;
      for (let i = 0; i < n; i++) {
        run.later(i * 0.16, () => {
          if (t.dead) t = run.mobs.target(run.player.x, run.player.z, a.stat('range') + a.stat('area') * 0.3, 'nearest') ?? t;
          const ang = angleTo(run, t) + (i % 2 ? 0.3 : -0.3) * Math.min(1, i);
          // Juiced Swing: 360° while juiced · Corner Bar (3): wider roundhouse
          const half = run.flags.tonyRageSpin && run.buffs.roid_rage ? Math.PI : run.flags.tonyWideSwing ? 1.2 : 0.8;
          let hits = 0;
          cone(run, a, { angle: ang, r: a.stat('area'), half, dmg: a.stat('damage'), knock: kn(run, 6), color: '#ffe0c0',
            onHit: (m) => { hits++; slam(run, m, a, 0.5); } });
          rage(run, Math.min(3, hits));
          run.player.aim(t.x, t.z, 0.2);
          sfx('hit', 0.05);
        });
      }
      if (wave) {
        run.later(n * 0.16, () => {
          nova(run, a, { r: a.stat('area') * 1.8, dmg: a.stat('damage') * wave, knock: kn(run, 10), root: 0.5, color: '#ffd27a',
            onHit: (m) => slam(run, m, a, 0.6) });
          run.fx.burst(run.player.x, 0.3, run.player.z, '#ffd27a', 18, 7);
          run.shake(0.2);
          sfx('tantrum', 0.1);
        });
      }
    },
  },
  {
    id: 'ground_pound', name: 'Ground Pound', icon: '💢', tags: ['melee', 'aoe', 'control'],
    desc: 'Jumps and belly-flops. Damages, stuns and blows everything around away; anything blown into a wall takes a slam.',
    base: { damage: 34, cooldown: 6, area: 4.6, duration: 0.8 },
    upgrades: [DMG, AREA, CD, pctUp('duration', 'Stun', 20)],
    ready: (run, a) => run.crowd(a, a.stat('area'), 3),
    fire(run, a) {
      const p = run.player;
      let hits = 0;
      nova(run, a, { r: a.stat('area'), dmg: a.stat('damage'), knock: kn(run, 8), root: a.stat('duration'), color: '#e8c89a',
        onHit: (m) => { hits++; slam(run, m, a, 0.6); } });
      rage(run, Math.min(6, hits));
      run.fx.burst(p.x, 0.3, p.z, '#b49a78', 24, 7);
      if (run.flags.tonyQuake) run.zone({ x: p.x, z: p.z, r: a.stat('area') * 0.8, life: 3, dps: a.stat('damage') * 0.35, slow: 0.4, kind: 'cement', color: '#7a6a55', ability: a });
      run.shake(0.25);
      sfx('tantrum');
    },
  },
  {
    id: 'headlock', name: 'Headlock', icon: '🤼', tags: ['melee', 'thrown', 'control'],
    desc: 'Grabs the nearest thug in a headlock and hurls him into the thickest crowd. Everyone he lands on is hit and knocked flat, he takes even more and stays down, and if he hits a wall on the way he takes a slam.',
    base: { damage: 40, cooldown: 4.5, range: 10, area: 2.8, duration: 1 },
    upgrades: [DMG, CD, AREA, pctUp('range', 'Throw Distance', 15)],
    ready: (run) => grabbable(run, 1)[0] ?? null,
    fire(run, a, t) {
      if (!throwMob(run, a, t)) return false;
      // Suplex City: a second thug in the other arm
      if (run.flags.tonyDoubleGrab) {
        const o = grabbable(run, 2).find((m) => m !== t);
        if (o) run.later(0.15, () => throwMob(run, a, o, { dmg: 0.8 }));
      }
    },
    throwMob, // for pairings (Clothesline)
  },
  {
    id: 'bottle', name: 'Bottle Smash', icon: '🍼', tags: ['thrown'],
    desc: 'Lobs a glass milk bottle. It shatters and sprays shards in every direction.',
    base: { damage: 22, cooldown: 2.6, range: 12, area: 2.6, count: 6 },
    upgrades: [DMG, CD, { ...scUp('count', 'Shards', 2), int: true }, AREA],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      run.lob({ tx: t.x, tz: t.z, dur: 0.55, kind: 'bottle', onLand: (x, z) => {
        rage(run, Math.min(3, run.mobs.count(x, z, a.stat('area'))));
        run.explode(x, z, a.stat('area'), a.stat('damage'), a, { small: true, color: '#e6fff0' });
        const n = a.stat('count');
        for (let i = 0; i < n; i++) run.shoot({ x, z, y: 0.5, angle: (i / n) * TAU + rand(0, 0.4), speed: 24, dmg: a.stat('damage') * 0.45, range: 6, size: 0.7, color: '#c8ffe0', ability: a });
        sfx('hit');
      } });
    },
  },
  {
    id: 'bull_rush', name: 'Bull Rush', icon: '🐂', tags: ['melee'],
    desc: 'A shadow of Tony charges headfirst through a crowd, bowling everyone over in a line and into the walls.',
    base: { damage: 40, cooldown: 5.5, range: 9, area: 1.3 },
    upgrades: [DMG, CD, pctUp('range', 'Charge Length', 15), AREA],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const p = run.player;
      const ang = angleTo(run, t);
      const len = a.stat('range');
      const w = a.stat('area'), dmg = a.stat('damage');
      const sx = p.x, sz = p.z, end = { x: p.x + Math.sin(ang) * len, z: p.z + Math.cos(ang) * len };
      a.rushEnd = end; // for pairings (Trample)
      const stun = run.flags.tonyRushStun ?? 0; // Strongman (3)
      // a shadow copy does the charge; everything it runs into gets bowled over once
      const charge = (x0, z0, dir, color) => {
        const hit = new Set();
        let hits = 0;
        run.combat.shadow({ x: x0, z: z0, angle: dir, len, dur: 0.3, color, onStep: (x, z) => {
          for (const m of run.mobs.near(x, z, w + 0.8)) {
            if (hit.has(m.id) || m.dead) continue;
            hit.add(m.id);
            run.hit(m, dmg, a, { knock: kn(run, 9), fromX: x - Math.sin(dir), fromZ: z - Math.cos(dir) });
            if (m.dead) continue;
            slam(run, m, a, 0.6);
            if (stun) m.rootT = Math.max(m.rootT, m.tier >= 2 ? stun * 0.25 : stun);
            if (hits++ < 6) rage(run, 1);
          }
        } });
      };
      charge(sx, sz, ang, '#ffcf9a');
      // Wrecking Ball: the shadow charges back the way it came
      if (run.flags.tonyWreckingBall) {
        run.later(0.3, () => {
          charge(end.x, end.z, ang + Math.PI, '#ff9a5a');
          run.fx.beam(end.x, end.z, sx, sz, '#ff9a5a', w * 1.2, 0.3, 0.4);
        });
      }
      // Strongman (5): the path becomes a quake trail
      const trail = run.flags.tonyQuakeTrail ?? 0;
      if (trail) {
        for (let d = 1.2; d <= len; d += 2.4) {
          run.zone({ x: sx + Math.sin(ang) * d, z: sz + Math.cos(ang) * d, r: Math.max(1.4, w * 1.3), life: 3, dps: dmg * trail, slow: 0.4, kind: 'cement', color: '#7a6a55', ability: a });
        }
      }
      run.fx.beam(p.x, p.z, end.x, end.z, '#ffcf9a', w * 1.2, 0.3, 0.4);
      run.fx.burst(p.x, 0.3, p.z, '#b49a78', 14, 5);
      sfx('tantrum', 0.1);
    },
  },
  {
    id: 'roid_rage', name: 'Juice Box Rage', icon: '🧃', tags: ['buff'],
    desc: 'Downs a juice box: +25 Rage on the spot, then for a while he hits harder, takes less damage, heals, gains Rage twice as fast and his Rage doesn\'t drain.',
    base: { cooldown: 18, duration: 6, power: 0.3 },
    upgrades: [DUR, scUp('power', 'Juice', 0.08, (v) => `+${Math.round(v * 100)}% juiced damage`), CD],
    useless: permanentUptime,
    ready: (run, a) => run.crowd(a, 8, 4),
    fire(run, a) {
      run.gainRes(25 + (run.flags.tonyJuiceRage ?? 0)); // before the buff: not doubled
      const pw = a.stat('power');
      buff(run, a, { fx: '#ff7a3a', stats: (s) => { s.dmg += pw; s.armor += 0.15; s.regen += 3 + pw * 10; } });
      run.fx.ring(run.player.x, run.player.z, 3, '#ff7a3a', 0.5);
      sfx('frenzy');
    },
  },
  {
    id: 'lariat', name: 'Spinning Lariat', icon: '🌀', tags: ['melee', 'orbit', 'aura'],
    desc: 'Boxing gloves on strings whirl around him nonstop, smacking anything close. Keeps his Rage simmering.',
    base: { damage: 6, count: 2, area: 2.2 },
    upgrades: AURA_UPS('Fists'),
    aura: { model: 'glove', color: '#d8302a', spark: '#ffb0a0', spin: 6, knock: 5 },
  },
  {
    id: 'folding_chair', name: 'Folding Chair', icon: '🪑', tags: ['melee', 'control'],
    desc: 'Brings a chair down on the biggest guy around and stuns him. With 50+ Rage it spends 20 for a Chair Shot: double damage, and the thug goes flying into the nearest wall.',
    base: { damage: 120, cooldown: 7, range: 6, duration: 1.4 },
    upgrades: [DMG, CD, pctUp('duration', 'Stun', 20), pctUp('range', 'Reach', 15)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest'),
    fire: (run, a, t) => chairOn(run, a, t),
    chairOn, // for pairings
  },
  {
    id: 'iron_belly', name: 'Iron Belly', icon: '🛡️', tags: ['defense'],
    desc: 'Flexes his belly. Gains a shield that soaks damage, and every hit it soaks makes him madder (Rage).',
    base: { cooldown: 10, power: 30 },
    upgrades: [scUp('power', 'Shield', 10, (v) => `+${Math.round(v)} shield`), CD],
    ready: (run, a) => run.player.shield < a.stat('power') * 0.5 && run.mobs.count(run.player.x, run.player.z, 10) > 0,
    fire(run, a) {
      const p = run.player;
      if (run.flags.tonyBellyBank) run.counters.tonyBank = (run.counters.tonyBank ?? 0) + soaked(run);
      p.shield = Math.max(p.shield, a.stat('power') * (1 + (run.flags.tonyThorns ? 0.3 : 0)));
      if (run.flags.tonyBellyBank) run.counters.tonyShieldMark = p.shield;
      run.counters.rageShield = p.shield; // a fresh shield isn't a soaked hit
      run.fx.ring(p.x, p.z, 1.6, '#9ad8ff', 0.4);
      sfx('select');
    },
  },
  {
    id: 'clap_back', name: 'Clap Back', icon: '👏', tags: ['aoe', 'control'],
    desc: 'Claps so hard everything nearby gets dizzy (stunned) and takes a hit.',
    base: { damage: 16, cooldown: 8, area: 6, duration: 1.5 },
    upgrades: [AREA, CD, pctUp('duration', 'Stun', 20), DMG],
    ready: (run, a) => run.crowd(a, a.stat('area'), 6),
    fire(run, a) {
      let dmg = a.stat('damage');
      // Belly Bounce: release the damage stored since the last clap
      const bank = run.flags.tonyBellyBank;
      if (bank) {
        const c = run.counters;
        const stored = (c.tonyBank ?? 0) + soaked(run);
        c.tonyBank = 0;
        if (stored > 0) {
          dmg += Math.min(stored * bank, dmg * 1.5);
          run.fx.ring(run.player.x, run.player.z, a.stat('area') * 0.6, '#ffb03a', 0.4);
        }
      }
      let hits = 0;
      nova(run, a, { r: a.stat('area'), dmg, knock: 2, root: a.stat('duration'), color: '#fff6a0', onHit: () => hits++ });
      rage(run, Math.min(6, hits));
      sfx('tantrum');
    },
  },
  {
    id: 'little_bro', name: 'Little Brother', icon: '👶', tags: ['summon'],
    desc: 'Calls in Little Sal, who punches whatever Tony is punching.',
    base: { damage: 20, cooldown: 14, duration: 12, count: 1 },
    upgrades: [DMG, DUR, addUp('count', 'Extra Bro', [0, 0, 1, 1, 2], null, 4), CD],
    ready: (run) => run.mobs.count(run.player.x, run.player.z, 15) > 0,
    fire(run, a) {
      for (let i = 0; i < a.stat('count'); i++) run.spawnGoon({ ability: a, life: a.stat('duration'), model: 'tony_bro', rate: run.flags.tonyTagTeam ? 0.3 : 0.5 });
    },
  },
];

/**
 * Belly Bounce bookkeeping: how much of Tony's shield got soaked since the last
 * sample (the shield only goes down by taking hits).
 */
function soaked(run) {
  const c = run.counters, sh = run.player.shield;
  const d = Math.max(0, (c.tonyShieldMark ?? sh) - sh);
  c.tonyShieldMark = sh;
  return d;
}

// ── signature: Berserk ──────────────────────────────────────────────────────

const BERSERK_TIME = 6, BERSERK_KNOCK = 1.5, BERSERK_RATE = 0.4, BERSERK_SLAM = 0.5;

/**
 * The stomps aren't an owned ability, so they hit through this stand-in: it has
 * the stat() an ability has (scaled by run level and Tony's stats), and its id
 * credits the damage to the signature in the damage meter.
 */
const STOMP_DEF = {
  id: 'berserk', name: 'Berserk', icon: '🤬', tags: ['melee', 'aoe', 'control'],
  base: { damage: 55, area: 5.5, duration: 1, count: 3 },
};
function stomper(run) {
  if (!run.tonyStomp) {
    run.tonyStomp = {
      def: STOMP_DEF, run, level: 1, inc: {}, add: {},
      stat(k) {
        const b = STOMP_DEF.base[k] ?? 0, s = run.stats;
        switch (k) {
          case 'damage': return b * (1 + 0.05 * (run.level - 1)) * s.dmg;
          case 'area': return b * (1 + s.area);
          case 'duration': return b * (1 + s.duration);
          default: return b;
        }
      },
    };
  }
  return run.tonyStomp;
}

/**
 * Berserk's "every hit slams": a run-wide hit pairing, added the first time Tony
 * goes Berserk. While it's up, any hit that doesn't already have a slam lined up
 * gets one for BERSERK_SLAM of the hit's damage.
 */
function hookBerserkSlams(run) {
  if (run.tonyBerserkHook) return;
  run.tonyBerserkHook = true;
  run.loadout.links.hit.push({ from: '*', to: null, chance: 1, icd: 0, next: 0, proc: (rr, p, ev) => {
    const m = ev.m;
    if (!berserk(rr) || !m || m.dead || m.tier >= 2 || !(ev.dmg > 0)) return;
    if (m.slam && m.slam.until >= rr.time) return;
    slamFor(rr, m, ev.src, ev.dmg * BERSERK_SLAM, 1);
  } });
}

/** Rage Berserk needs: 100, less with Short Temper. */
const berserkAt = (run) => run.res.max - (run.flags.tonyShortTemper ?? 0);

export const TONY_SIGNATURE = {
  id: 'berserk', name: 'Berserk', icon: '🤬',
  short: 'Meltdown stomps + 6s of wall slams',
  desc: `At full Rage, Tony loses it. Total Meltdown: 3 stomps around him that stun and fling everything into the walls. `
    + `Then ${BERSERK_TIME}s of Berserk: Rage counts as full (+20% damage, -10% damage taken), knockback is 50% stronger, `
    + `every hit can wall-slam, and all his abilities recharge 40% faster. The meter starts refilling right away.`,
  ready: (run) => run.res?.id === 'rage' && run.res.value >= berserkAt(run) && !berserk(run),
  fire(run) {
    const a = stomper(run), f = run.flags;
    hookBerserkSlams(run);
    // the fury: buff fx gives the red glow, rate speeds up every cooldown
    run.buffs.tony_berserk = { t: BERSERK_TIME, max: BERSERK_TIME, src: 'berserk', fx: '#ff3b2a', rate: BERSERK_RATE };
    // Total Meltdown: the stomps
    const n = a.stat('count');
    for (let i = 0; i < n; i++) {
      run.later(i * 0.3, () => {
        const p = run.player;
        if (p.dead) return;
        nova(run, a, { r: a.stat('area'), dmg: a.stat('damage'), knock: kn(run, 12), root: a.stat('duration'), color: '#ff3b2a',
          onHit: (m) => slam(run, m, a, 0.6, 1) });
        run.fx.burst(p.x, 0.3, p.z, '#ff6a4a', 26, 8);
        run.fx.ring(p.x, p.z, a.stat('area') * 0.6, '#ffd27a', 0.3);
        run.shake(0.3);
        sfx('tantrum');
      });
    }
    // Let It Out: blowing off steam refills Iron Belly's shield
    const belly = f.tonyLetItOut && run.abilityById('iron_belly');
    if (belly) {
      const sh = belly.stat('power') * f.tonyLetItOut;
      if (run.player.shield < sh) run.player.shield = sh;
      run.counters.rageShield = run.player.shield; // a refill isn't a soaked hit
      if (f.tonyBellyBank) run.counters.tonyShieldMark = run.player.shield;
      run.fx.ring(run.player.x, run.player.z, 1.6, '#9ad8ff', 0.4);
    }
    run.fx.ring(run.player.x, run.player.z, 3.5, '#ff3b2a', 0.5);
    sfx('frenzy');
  },
};

export const TONY_OVERVIEW = {
  tagline: 'A huge, angry baby who punches thugs into walls.',
  playstyle: 'Get in close and stay there. Tony has no guns: his swings, throws and stomps knock thugs back, '
    + 'and a thug knocked into a wall takes a big extra hit (a wall slam). Fight near walls and corners, '
    + 'let the crowd come to you, and keep swinging to keep your Rage up.',
  meter: 'Rage (💢, under your HP) fills when you land hits, slam thugs into walls and take damage, and drains if you stop fighting for 3s. '
    + 'Every point is +0.2% damage, shown next to the bar. At 100 Rage Tony goes BERSERK: three stomps that fling everything into the walls, '
    + 'then 6s where every hit can slam, knockback is stronger and abilities recharge faster. '
    + 'In Auto mode it goes off by itself; in Manual mode press Y / F / ★ when the bar says READY.',
  tips: [
    'Walls are your friend: fight with your back near a wall or in a narrow street so knocked-back thugs slam.',
    'Getting hit builds Rage too. Iron Belly shields let you soak hits and get mad without dying.',
    'In Manual mode, save Berserk for a big pack or a Crime Titan: a full meter waiting for you doesn\'t drain.',
    'Juice Box Rage gives +25 Rage on the spot: drink it near full to go Berserk sooner.',
  ],
  pairs: [
    { a: 'Headlock', b: 'Ground Pound', why: 'Throw a thug into the crowd, then belly-flop where he lands (Pile On talent).' },
    { a: 'Iron Belly', b: 'Clap Back', why: 'The shield soaks hits and builds Rage; Clap Back stuns the crowd that hit you (Belly Bounce talent, Bouncer set).' },
    { a: 'Haymaker', b: 'Juice Box Rage', why: 'While juiced, Haymaker swings all the way around you and Rage fills twice as fast (Juiced Swing talent).' },
    { a: 'Bull Rush', b: 'Ground Pound', why: 'The charge bowls a line of thugs into the walls and can end in a free Ground Pound (Trample talent).' },
  ],
};
