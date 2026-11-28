import { sfx } from '../../audio.js';
import { TAU, rand } from '../../util.js';

/**
 * Lenny "Nickles" — the Boss: money and crew. Every ability fires on its own
 * when ready() returns a target (anything truthy). a.stat(key) gives the fully
 * modified value (upgrades, talents, gear, run stats).
 *
 * upgrades: stat = which stat grows · kind 'pct' adds % (cooldown = faster),
 * 'add' adds flat.
 *   v       common roll; higher tiers roll bigger (tiers.TIER_MULT) and every roll
 *           shrinks the more of that stat the ability already has.
 *   values  flat per-tier amounts instead (0 = not offered at that tier), for
 *           whole-number upgrades like extra bullets. `max` caps the total.
 * useless(a, stat) — return true to stop offering a stat that no longer helps.
 *
 * Meter — BUY IN (gold is power): the meter shows the gold you hold toward the
 * next buy-in price. Lenny's signature, Buy In, spends that price for a
 * permanent damage stack (+8% to all his abilities for the rest of the run;
 * favours — Hired Goon, Drive-By, Hit Contract, the Godfather's bodyguards —
 * get 1.5× that). Each buy-in raises the next price ×1.5, so gold is a real
 * choice: chests now, or a buy-in that pays off for the whole run.
 *
 * Thug statuses (common.addStatus):
 *   racket  shaken down by Protection Racket: takes +Racket `vuln` damage.
 *   afraid  terrified by Make an Example: slowed, takes +Example `power` damage.
 * Both, and buy-in stacks, are one damage amp (lennyAmp) that ensureLenny()
 * installs into the run the first time any Lenny ability polls (or the meter ticks).
 */
import { pctUp, scUp, addUp, DMG, CD, AREA, DUR, AURA_UPS, permanentUptime, chill, addStatus, statusN, tint } from '../common.js';

// ── Buy In ──────────────────────────────────────────────────────────────────
export const BUYIN_PRICE = 100;  // gold for the first buy-in (before talents)
export const BUYIN_GROWTH = 1.5; // each buy-in raises the next price this much
export const BUYIN_DMG = 0.08;   // damage per buy-in stack (before talents)
export const FAVOUR_MULT = 1.5;  // favours get this much of every stack
const FAVOURS = new Set(['goon', 'driveby', 'contract', 'godfather']);
let OWN = null; // ability ids of this kit (filled below)

/** Buy-ins bought so far this run. */
export const buyIns = (run) => run.counters.buyIns ?? 0;
/** Gold the next buy-in costs (talents: buyInDiscount, a fraction off every price). */
export function buyInPrice(run) {
  const off = Math.min(0.6, run.flags.buyInDiscount ?? 0);
  return Math.max(1, Math.round(BUYIN_PRICE * BUYIN_GROWTH ** buyIns(run) * (1 - off)));
}
/** Damage one stack gives a normal ability (talents: buyInDmg adds to it). */
export const stackDmg = (run) => BUYIN_DMG + (run.flags.buyInDmg ?? 0);
/** Total buy-in damage for a normal ability (0.24 = +24%). */
export const buyInBonus = (run) => buyIns(run) * stackDmg(run);
/** Armour from buy-ins (Untouchable): buyInArmor per stack, up to buyInArmorCap. */
export const buyInArmor = (run) => Math.min(run.flags.buyInArmorCap ?? 0.15, buyIns(run) * (run.flags.buyInArmor ?? 0));

const pct = (v) => Math.round(v * 100);

/** Damage amp for every hit in a Lenny run: buy-ins, shakedowns and terror. */
function lennyAmp(run, m, a) {
  let v = 0;
  const id = a?.def?.id;
  if (id && OWN.has(id)) v += buyInBonus(run) * (FAVOURS.has(id) ? FAVOUR_MULT : 1);
  if (m.st) {
    if (statusN(run, m, 'racket')) v += run.abilityById('racket')?.stat('vuln') ?? 0.15;
    if (statusN(run, m, 'afraid')) v += run.abilityById('make_example')?.stat('power') ?? 0.15;
  }
  return v;
}

/** Hook Lenny's amp (and the Untouchable buy-in armour) into this run, once. */
export function ensureLenny(run) {
  if (run.counters._lenny) return;
  run.counters._lenny = 1;
  run.loadout.amps.push(lennyAmp);
  // Untouchable (Racketeering capstone): every buy-in also cuts the damage you take
  if (run.flags.buyInArmor) {
    run.buffs.lenny_buyin = { t: Infinity, max: Infinity, stats: (s, b, r) => { s.armor += buyInArmor(r); } };
  }
}

/** Buy-In meter: gold held toward the next buy-in price. */
export const LENNY_RESOURCE = {
  id: 'buyin', name: 'Buy In', icon: '💰', color: '#f2c037', max: BUYIN_PRICE, start: 0,
  desc: 'Buy In: the bar is your gold toward the next buy-in price. When you can afford it, Lenny buys in: he pays that price and every ability deals +8% damage for the rest of the run (favours — Hired Goon, Drive-By, Hit Contract — get +12%). Each buy-in costs 1.5× the last. Gold spent on chests is gold not spent on buy-ins, so choose. In Manual mode you decide when to buy in.',
  tick(run) {
    ensureLenny(run);
    const r = run.res;
    if (!r) return;
    r.max = buyInPrice(run);
    r.value = Math.min(r.max, Math.max(0, Math.floor(run.gold)));
  },
  label: (run) => `${Math.max(0, Math.floor(run.gold))} / ${buyInPrice(run)} 💰`,
  bonus(run) {
    const n = buyIns(run);
    if (!n) return `next buy-in: +${pct(stackDmg(run))}% dmg`;
    const arm = buyInArmor(run);
    return `${n} buy-in${n > 1 ? 's' : ''} · +${pct(buyInBonus(run))}% dmg${arm ? ` · -${pct(arm)}% dmg taken` : ''}`;
  },
};

/** Signature: Buy In — pay the price, keep a damage stack for the rest of the run. */
export const LENNY_SIGNATURE = {
  id: 'buy_in', name: 'Buy In', icon: '💰',
  short: 'Paid up: permanent +damage',
  desc: 'When you hold enough gold, Lenny pays the buy-in price for a permanent stack: +8% damage to all his abilities for the rest of the run (favours get +12%). The next buy-in costs 1.5× more. Auto buys in as soon as you can afford it; Manual lets you save gold for chests and buy in on Y / F / ★.',
  keepMeter: true,
  ready: (run) => run.gold >= buyInPrice(run),
  fire(run) {
    ensureLenny(run);
    const price = buyInPrice(run);
    if (run.gold < price) return;
    run.gold -= price;
    run.counters.buyIns = buyIns(run) + 1;
    const n = buyIns(run);
    const p = run.player;
    // a shower of coins and a gold ring: the whole street sees the Boss pay up
    run.fx.burst(p.x, 1.2, p.z, '#ffd23f', 34, 7, 0.8, 1.3);
    run.fx.burst(p.x, 0.4, p.z, '#fff3b0', 14, 4, 0.5, 0.9, 4);
    run.fx.ring(p.x, p.z, 4.5, '#f2c037', 0.6);
    run.fx.ring(p.x, p.z, 2.2, '#ffd700', 0.4);
    run.fx.number(p.x, 2.6, p.z, `-${price} 💰  +${pct(stackDmg(run))}% dmg (×${n})`, '#ffd700', true);
    if (run.res) run.res.max = buyInPrice(run);
    run.shake?.(0.12);
    sfx('chest');
  },
};
export const LENNY_START = 'pistol';

/** Favour note for descs. */
const FAVOUR = ' Favour: buy-ins count 1.5× for it.';

// ── helpers ─────────────────────────────────────────────────────────────────

/** Fire one bullet from Lenny's gun at angle `ang`. */
function bullet(run, a, ang, extra = {}) {
  const m = run.player.muzzlePos();
  run.shoot({
    x: m.x, z: m.z, y: m.y, angle: ang,
    speed: a.stat('speed'), dmg: a.stat('damage'), range: a.stat('range') * 1.25,
    pierce: a.stat('pierce'), bounce: run.flags.ricochet && a.def.id === 'pistol' ? 1 : 0,
    ability: a, kind: 'bullet', ...extra,
  });
}

/** Terrify a thug (Make an Example): slowed and takes more damage for `dur`. */
function terrify(run, a, m, dur) {
  if (m.dead) return;
  const d = dur ?? (a.stat('duration') + (run.flags.terrorDur ?? 0));
  addStatus(run, m, 'afraid', 1, d, 1);
  chill(m, 0.4, d);
  tint(run, m, '#b48cff', d);
}

/** Make an Example's blast at (x, z): `scale` sizes radius and damage. Returns hits. */
function example(run, a, x, z, scale = 1, dur) {
  const r = a.stat('area') * scale;
  let n = 0;
  for (const m of run.mobs.near(x, z, r)) {
    if (m.dead) continue;
    run.hit(m, a.stat('damage') * scale, a, { knock: a.stat('knock'), fromX: x, fromZ: z });
    terrify(run, a, m, dur);
    n++;
  }
  run.fx.ring(x, z, r, '#b48cff', 0.4);
  return n;
}

/** Shake a thug down (Protection Racket): it takes Racket's extra damage for `dur`. */
function shake(run, a, m, dur) {
  if (m.dead) return;
  addStatus(run, m, 'racket', 1, dur ?? a.stat('duration'), 1);
  tint(run, m, '#f2c037', dur ?? a.stat('duration'));
}

export const LENNY_ABILITIES = [
  {
    id: 'pistol', name: 'Snub-Nose .38', icon: '🔫', tags: ['gun', 'projectile'],
    desc: 'Pops the toughest thug in range.',
    base: { damage: 14, cooldown: 0.5, range: 15, speed: 38, count: 1, pierce: 0 },
    upgrades: [DMG, pctUp('cooldown', 'Fire Rate', 12), addUp('pierce', 'Pierce', [0, 0, 1, 1, 2], null, 5), addUp('count', 'Extra Bullet', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.targets(run.player.x, run.player.z, a.stat('range'), a.stat('count') + (run.flags.akimbo ? 1 : 0), 'strongest'),
    fire(run, a, targets) {
      if (!targets.length) return false;
      const n = a.stat('count') + (run.flags.akimbo ? 1 : 0);
      const shots = Math.random() < (run.flags.doubleTap ?? 0) ? 2 : 1;
      // Don's Finest (5): every 10th shot is a golden bullet
      const gold = run.flags.goldenBullet && run.every('goldenBullet', 10) ? run.flags.goldenBullet : 0;
      for (let s = 0; s < shots; s++) {
        for (let i = 0; i < n; i++) {
          const t = targets[i % targets.length];
          const lead = 0.06 * s;
          const spread = targets.length < n ? (i - (n - 1) / 2) * 0.12 : 0;
          const golden = gold && s === 0 && i === 0;
          run.later(lead, () => {
            const m = run.player.muzzlePos();
            bullet(run, a, Math.atan2(t.x - m.x, t.z - m.z) + spread, golden ? {
              dmg: a.stat('damage') * gold, color: '#ffd700', size: 1.6,
              onHit: (mob) => { if (!mob.dead && mob.tier < 3 && mob.hp / mob.maxHp < 0.25) run.hit(mob, mob.hp + 1, a, { noCrit: true, color: '#ffd700' }); },
            } : {});
          });
        }
      }
      run.player.aim(targets[0].x, targets[0].z);
      sfx('shot', 0.05);
    },
  },
  {
    id: 'frenzy', name: 'Frenzy', icon: '😤', tags: ['buff'],
    desc: 'The Boss loses his temper: faster fire rate and every other ability cools down faster while it lasts.',
    base: { cooldown: 16, duration: 5, power: 0.5, range: 12 },
    upgrades: [DUR, scUp('power', 'Fury', 0.12, (v) => `+${Math.round(v * 100)}% frenzy speed`), CD],
    useless: permanentUptime,
    ready: (run, a) => run.mobs.count(run.player.x, run.player.z, a.stat('range')) > 0,
    fire(run, a) {
      run.buffs.frenzy = { t: a.stat('duration'), max: a.stat('duration'), power: a.stat('power') };
      run.fx.ring(run.player.x, run.player.z, 3, '#ff3b3b', 0.5);
      sfx('frenzy');
    },
  },
  {
    id: 'power_shot', name: 'Hollow Point', icon: '💥', tags: ['gun', 'projectile'],
    desc: 'A huge slug that punches through every thug in a line. Aims for the biggest one.',
    base: { damage: 60, cooldown: 4.2, range: 20, speed: 55, count: 1, pierce: 99, area: 1 },
    upgrades: [pctUp('damage', 'Damage', 24), CD, pctUp('area', 'Slug Size', 18), addUp('count', 'Extra Slug', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest'),
    fire(run, a, t) {
      const m = run.player.muzzlePos();
      const base = Math.atan2(t.x - m.x, t.z - m.z);
      const n = a.stat('count');
      for (let i = 0; i < n; i++) {
        run.shoot({ x: m.x, z: m.z, y: m.y, angle: base + (i - (n - 1) / 2) * 0.18, speed: a.stat('speed'), dmg: a.stat('damage'),
          range: a.stat('range') * 1.4, pierce: 99, size: 2.2 * a.stat('area'), kind: 'slug', color: '#bff3ff', ability: a, knock: 4 });
      }
      run.player.aim(t.x, t.z, 0.4);
      run.shake(0.15);
      sfx('bigshot');
    },
  },
  {
    id: 'tommy', name: 'Chicago Typewriter', icon: '🎻', tags: ['gun', 'projectile'],
    desc: 'Pulls a tommy gun out of a violin case and sprays a cone of lead.',
    base: { damage: 7, cooldown: 3.2, range: 13, speed: 40, count: 8, spread: 0.55, pierce: 0 },
    upgrades: [DMG, { ...scUp('count', 'Bullets', 2), int: true }, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const n = a.stat('count');
      const spread = a.stat('spread');
      for (let i = 0; i < n; i++) {
        run.later(i * 0.05, () => {
          const m = run.player.muzzlePos();
          const ang = Math.atan2(t.x - m.x, t.z - m.z) + rand(-spread, spread) * 0.5;
          bullet(run, a, ang, { color: '#ffd36b' });
          run.player.aim(t.x, t.z, 0.15);
          sfx('tommy', 0.04);
        });
      }
    },
  },
  {
    id: 'racket', name: 'Protection Racket', icon: '🤝', tags: ['aura', 'control'],
    desc: 'Every second, thugs near you get shaken down: a slap, a slight slow, and they take +15% damage from everything. The crowd pays: a chance per thug to cough up a gold coin.',
    base: { damage: 4, cooldown: 1, area: 4.2, vuln: 0.15, payout: 0.05, duration: 1.4 },
    upgrades: [AREA,
      scUp('vuln', 'Shakedown', 0.05, (v) => `+${Math.round(v * 100)}% damage taken`),
      scUp('payout', 'Payout', 0.015, (v) => `+${(v * 100).toFixed(1)}% coin chance per thug`),
      DMG],
    useless: (a, stat) => (stat === 'payout' && a.stat('payout') >= 0.2) || (stat === 'vuln' && a.stat('vuln') >= 0.6),
    ready: (run, a) => run.mobs.count(run.player.x, run.player.z, a.stat('area')) > 0,
    fire(run, a) {
      const p = run.player;
      const r = a.stat('area');
      const list = run.mobs.near(p.x, p.z, r);
      if (!list.length) return false;
      const slow = 0.15 + (run.flags.racketSlow ?? 0);
      for (const m of list) {
        if (m.dead) continue;
        run.hit(m, a.stat('damage'), a, { knock: 0.5, fromX: p.x, fromZ: p.z, color: '#f2c037' });
        if (m.dead) continue;
        shake(run, a, m);
        chill(m, slow, a.stat('duration'));
      }
      // payout: one coin at most per pulse (economy stays sane)
      const ch = run.flags.unionDues && list.length >= 4 ? 1 : Math.min(0.9, a.stat('payout') * list.length);
      if (Math.random() < ch) {
        const m = list[Math.floor(Math.random() * list.length)]; // dead is fine: the coin drops where he stood
        run.pickups.coin(m.x, m.z, 1);
        run.fx.burst(m.x, 1, m.z, '#ffd23f', 6, 3, 0.4);
        sfx('gold', 0.03);
      }
      run.fx.ring(p.x, p.z, r, '#f2c037', 0.5);
    },
  },
  {
    id: 'make_example', name: 'Make an Example', icon: '😠', tags: ['aoe', 'control'],
    desc: 'Picks the toughest thug nearby and makes an example of him (×3 damage), then blasts everyone close back. Survivors are terrified for 2.5s: slowed 40% and take +20% damage. If the example dies, the terror lasts 50% longer.',
    base: { damage: 18, cooldown: 6, area: 4.8, knock: 9, duration: 2.5, power: 0.2 },
    upgrades: [DMG, AREA, CD, scUp('power', 'Terror', 0.05, (v) => `+${Math.round(v * 100)}% damage taken while terrified`)],
    useless: (a, stat) => stat === 'power' && a.stat('power') >= 0.6,
    terrify, example, // pairing helpers (talents use p.def.terrify / p.def.example)
    ready: (run, a) => run.crowd(a, a.stat('area'), 3) || run.mobs.count(run.player.x, run.player.z, 2.2) > 0,
    fire(run, a) {
      const p = run.player;
      const r = a.stat('area');
      const t = run.mobs.target(p.x, p.z, r, 'strongest');
      if (!t) return false;
      let dur = a.stat('duration') + (run.flags.terrorDur ?? 0);
      // the example
      if (run.flags.publicExec && t.tier < 2 && t.hp / t.maxHp < 0.3) run.hit(t, t.hp + 1, a, { noCrit: true, color: '#b48cff' });
      else run.hit(t, a.stat('damage') * 3, a, { knock: a.stat('knock') * 0.5, fromX: p.x, fromZ: p.z });
      run.fx.burst(t.x, 1, t.z, '#b48cff', 16, 5);
      if (t.dead) dur *= 1.5;
      for (const m of run.mobs.near(p.x, p.z, r)) {
        if (m.dead) continue;
        if (m !== t) run.hit(m, a.stat('damage'), a, { knock: a.stat('knock'), fromX: p.x, fromZ: p.z });
        terrify(run, a, m, dur);
      }
      run.fx.ring(p.x, p.z, r, '#b48cff', 0.4);
      run.fx.burst(p.x, 0.6, p.z, '#b48cff', 18, 7);
      run.shake(0.2);
      sfx('tantrum');
    },
  },
  {
    id: 'cement', name: 'Cement Shoes', icon: '🪣', tags: ['thrown', 'control'],
    desc: 'Dumps quick-dry cement: roots everything for a moment, then slows.',
    base: { damage: 16, cooldown: 7, range: 12, area: 3.6, duration: 3 },
    upgrades: [AREA, DUR, CD, DMG],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      run.lob({ tx: t.x, tz: t.z, dur: 0.6, kind: 'cement', onLand: (x, z) => {
        const r = a.stat('area');
        for (const m of run.mobs.near(x, z, r)) {
          if (m.dead) continue;
          run.hit(m, a.stat('damage'), a);
          if (!m.dead) m.rootT = Math.max(m.rootT, m.tier >= 2 ? 0.3 : 1.2);
        }
        run.zone({ x, z, r, life: a.stat('duration'), slow: 0.55, kind: 'cement', ability: a });
        run.fx.burst(x, 0.3, z, '#b9b4aa', 16, 4);
      } });
    },
  },
  {
    id: 'goon', name: 'Hired Goon', icon: '🏏', tags: ['summon'],
    desc: 'Calls in a favour: a cousin with a baseball bat shows up for a while.' + FAVOUR,
    base: { damage: 16, cooldown: 14, duration: 10, count: 1 },
    upgrades: [DMG, DUR, addUp('count', 'Extra Goon', [0, 0, 1, 1, 2], null, 4), CD],
    ready: (run, a) => run.mobs.count(run.player.x, run.player.z, 15) > 0,
    fire(run, a) {
      for (let i = 0; i < a.stat('count'); i++) run.spawnGoon({ ability: a, life: a.stat('duration') });
    },
  },
  {
    id: 'made_men', name: 'Made Men', icon: '🕴️', tags: ['summon', 'gun'],
    desc: 'Two made men in sharp suits step out of the shadows and work the crowd with their pistols for 9s.',
    base: { damage: 12, cooldown: 16, duration: 9, count: 2, range: 7, pierce: 0 },
    upgrades: [DMG, DUR, addUp('count', 'Extra Made Man', [0, 0, 0, 1, 1], null, 2), CD],
    ready: (run, a) => run.mobs.count(run.player.x, run.player.z, 14) > 0,
    fire(run, a) {
      const rng = a.stat('range');
      for (let i = 0; i < a.stat('count'); i++) {
        run.spawnGoon({
          ability: a, life: a.stat('duration'), model: 'babyface_double', reach: rng * 0.7, seek: rng + 4, rate: 0.6,
          onAttack: (g, t, dmg) => {
            if (t.dead) return;
            run.shoot({ x: g.x, z: g.z, y: 0.8, angle: Math.atan2(t.x - g.x, t.z - g.z), speed: 36, dmg, range: rng + 3,
              pierce: a.stat('pierce'), ability: a, kind: 'bullet', color: '#ffd36b' });
          },
        });
      }
      sfx('shot', 0.08);
    },
  },
  {
    id: 'driveby', name: 'Drive-By', icon: '🚗', tags: ['vehicle'],
    desc: 'Calls in a favour: Cousin Sal comes screaming through in the family sedan.' + FAVOUR,
    base: { damage: 42, cooldown: 8, range: 16, count: 1, area: 1 },
    upgrades: [DMG, CD, addUp('count', 'Extra Car', [0, 0, 1, 1, 2], null, 4)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const n = a.stat('count');
      for (let i = 0; i < n; i++) {
        run.later(i * 0.35, () => {
          const ang = rand(0, TAU);
          run.car({ x: t.x, z: t.z, angle: ang, dmg: a.stat('damage'), width: 2.4 * a.stat('area'), ability: a });
        });
      }
    },
  },
  {
    id: 'make_it_rain', name: 'Make It Rain', icon: '💸', tags: ['orbit', 'aura'],
    desc: 'Stacks of cash whirl around you nonstop, smacking anyone who gets close.',
    base: { damage: 5, count: 2, area: 2.8 },
    upgrades: AURA_UPS('Cash Stacks'),
    aura: { model: 'cash', color: '#3da35a', spark: '#7be495', spin: 3.6, knock: 3 },
  },
  {
    id: 'contract', name: 'Hit Contract', icon: '📜', tags: ['gun', 'execute'],
    desc: 'Calls in a favour: puts a price on the biggest head around and a sniper collects a second later. A contract kill pays a 3-gold bounty.' + FAVOUR,
    base: { damage: 190, cooldown: 10, range: 30, execute: 0, bounty: 3 },
    upgrades: [DMG, CD, addUp('execute', 'Execute', [0, 0, 0.05, 0.08, 0.12], (v) => `+${Math.round(v * 100)}% execute`, 0.3)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest'),
    fire(run, a, t) {
      if (run.flags.markForDeath) t.markedUntil = run.time + 6;
      run.mark(t, 1.0, () => {
        if (t.dead) return;
        const ex = a.stat('execute');
        const exec = ex > 0 && t.tier < 3 && t.hp / t.maxHp <= ex;
        const dmg = exec ? t.hp + 1 : a.stat('damage');
        if (exec && run.stats.execHeal) run.heal(run.stats.execHeal);
        run.hit(t, dmg, a, { noCrit: false });
        if (t.dead) {
          const b = Math.round(a.stat('bounty'));
          for (let i = 0; i < b; i++) run.pickups.coin(t.x + rand(-1, 1), t.z + rand(-1, 1), 1);
        }
        run.fx.tracer(t.x, t.z);
        run.fx.burst(t.x, 1, t.z, '#ff3030', 16, 6);
        sfx('snipe');
      });
    },
  },
];

OWN = new Set([...LENNY_ABILITIES.map((d) => d.id), 'godfather']);

// every ability that polls also makes sure Lenny's amp is hooked into the run
for (const d of LENNY_ABILITIES) {
  if (!d.ready) continue;
  const ready = d.ready;
  d.ready = (run, a) => { ensureLenny(run); return ready(run, a); };
}

/** Kit overview for the hideout's Kit tab. */
export const LENNY_OVERVIEW = {
  tagline: 'The Boss: money is muscle, and the crew owes him favours.',
  playstyle: 'Lenny stands his ground and lets his guns and his crew do the work: Protection Racket and Make an Example soften up the crowd so everything else hits harder. Pick up every coin you can, because gold is how the Boss grows: open chests for new items, or buy in for permanent damage.',
  meter: 'Buy In fills with the gold you are holding, toward the next buy-in price. When you can afford it, Lenny pays it for a permanent +8% damage stack (favours get +12%). Each buy-in costs 1.5× the last, so the first few come fast and later ones are a real investment.',
  tips: [
    'Chests or buy-ins? Early chests give you new tools; buy-ins pay off more the longer the run goes.',
    'In Auto, Lenny buys in the moment he can afford it. Switch to Manual in the pause menu if you want to save gold for a chest first.',
    'Protection Racket shakes coins out of the crowd. Stand in the thick of it to fund your next buy-in.',
    'Favours (Hired Goon, Drive-By, Hit Contract) get 1.5× every buy-in stack, so they grow fastest of all.',
  ],
  pairs: [
    { a: 'racket', b: 'make_it_rain', why: 'Racket keeps thugs close and shaken down while the cash stacks spin through them, and the coins it drops fund your buy-ins.' },
    { a: 'make_example', b: 'cement', why: 'Cement roots the crowd in place so Make an Example catches them all, and terrified thugs take extra damage from everything.' },
    { a: 'contract', b: 'power_shot', why: 'Both pick the biggest thug: Hollow Point softens him up and the Contract finishes him for a gold bounty.' },
    { a: 'goon', b: 'driveby', why: 'Two favours that both get 1.5× buy-ins: the goons hold the line while Sal mows down the crowd they gather.' },
  ],
};
