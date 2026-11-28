import { explodeAt, fireAt, freeCast } from '../common.js';

/**
 * Boom-Boom's talent trees (format: heroes/lenny/talents.js). 3 branches × 8 rows.
 * Row r needs 3·r points already spent in that branch.
 * Rows 6-8 (row 5-7 here) are pairing talents: `pair` names the partner ability
 * that must be in your run for them to do anything (see ctx.link).
 *
 * The kit's signature is THE CHAIN (heroes/boom/abilities.js): blasts set off his
 * placed charges early as chain links. Flags read there: chainBonus, chainReach,
 * fuseGain, shortFuse, pipeTrigger, fireSpreadChance. While a chained blast
 * goes off, run.counters.boomLink is its link number. Charge helpers come from
 * the partner defs (sticky_bomb.def.stick, c4.def.plant, detonator.def.chainAt).
 * Signature flags (Big Red Button / Detonator): wiredNet (Detonator sets charges off
 * as chain links), ringGum (extra gum-bombs in the Button's ring, needs Sticky Bomb).
 */
const rnd = (a, b) => a + Math.random() * (b - a);

/** A bottle rocket from (x, z) at a nearby thug, credited to Bottle Rockets `p`. */
function rocketsFrom(run, p, x, z, n) {
  const ts = run.mobs.targets(x, z, p.stat('range') * 0.8, n, 'nearest');
  if (!ts.length) return;
  for (let i = 0; i < n; i++) {
    const t = ts[i % ts.length];
    run.shoot({ x, z, y: 1, angle: Math.atan2(t.x - x, t.z - z) + rnd(-0.2, 0.2), speed: p.stat('speed'), dmg: p.stat('damage') * 0.4, range: p.stat('range'), size: 1.2, color: '#ff4fa3', ability: p,
      onHit: (m, b) => { b.left = 0; explodeAt(run, p, b.x, b.z, { small: true }); } });
  }
}

/** Sticks a gum-bomb charge (Sticky Bomb `p`) on the toughest live thug near (x, z). */
function stickNear(run, p, x, z, r, { dmg = 1, skip = null, onBlow, fuse } = {}) {
  const t = run.mobs.targets(x, z, r, 4, 'strongest').find((m) => !m.dead && (skip instanceof Set ? !skip.has(m) : m !== skip));
  if (!t) return null;
  p.def.stick(run, p, t, { dmg, onBlow, fuse });
  run.fx.beam(x, z, t.x, t.z, '#ff8fd0', 0.08, 0.2, 0.9);
  return t;
}

export const BOOM_TREES = [
  { id: 'bigbang', name: 'Big Bang', icon: '💥', color: '#ffb02e', blurb: 'Bigger blasts, longer chains.' },
  { id: 'pyro', name: 'Pyro', icon: '🔥', color: '#ff5a3a', blurb: 'Burn it all down, and let it spread.' },
  { id: 'sapper', name: 'Sapper', icon: '🧰', color: '#9ad87a', blurb: 'Charges, wires and the big plunger.' },
];

export const BOOM_TALENTS = [
  // ── Big Bang ──
  { id: 'b_powder', tree: 'bigbang', row: 0, col: 0, max: 5, name: 'Extra Powder', icon: '🧂',
    desc: (r) => `Explosive abilities deal +${4 * r}% damage.`, apply: (c, r) => c.abil('#explosive', 'damage', 'pct', 4 * r) },
  { id: 'b_radius', tree: 'bigbang', row: 0, col: 2, max: 3, name: 'Blast Radius', icon: '⭕',
    desc: (r) => `Explosive abilities have +${6 * r}% area.`, apply: (c, r) => c.abil('#explosive', 'area', 'pct', 6 * r) },
  { id: 'b_shrapnel', tree: 'bigbang', row: 1, col: 0, max: 3, name: 'Shrapnel', icon: '🔩',
    desc: (r) => `Explosions throw ${2 * r} pieces of shrapnel.`, apply: (c, r) => c.flag('shrapnel', 2 * r) },
  { id: 'b_fuse', tree: 'bigbang', row: 1, col: 2, max: 3, name: 'Short Fuse', icon: '⏱️',
    desc: (r) => `Explosive abilities get +${4 * r}% Recharge Rate, and Dynamite and Sticky Bomb fuses burn ${8 * r}% faster.`,
    apply: (c, r) => { c.abil('#explosive', 'cooldown', 'pct', 4 * r); c.flagAdd('shortFuse', 0.08 * r); } },
  { id: 'b_chain', tree: 'bigbang', row: 2, col: 0, max: 3, name: 'Chain Reaction', icon: '⛓️',
    desc: (r) => `Thugs killed by explosions have a ${10 * r}% chance to explode too.`, apply: (c, r) => c.flag('chainReaction', 0.1 * r) },
  { id: 'b_sticks', tree: 'bigbang', row: 2, col: 2, max: 1, name: 'Bundle', icon: '🧨',
    desc: () => 'Stick of Dynamite throws +1 stick.', apply: (c) => c.abil('dynamite_stick', 'count', 'add', 1) },
  { id: 'b_crit', tree: 'bigbang', row: 3, col: 1, max: 3, name: 'Det Cord', icon: '➰',
    desc: (r) => `Chain links deal +${5 * r}% more damage each, and blasts reach charges ${(0.5 * r).toFixed(1)}m further away.`,
    apply: (c, r) => { c.flagAdd('chainBonus', 0.05 * r); c.flagAdd('chainReach', 0.5 * r); } },
  { id: 'b_megaton', tree: 'bigbang', row: 4, col: 1, max: 1, name: 'Megaton', icon: '☢️', capstone: true,
    desc: () => 'Every explosion is 25% bigger.', apply: (c) => c.flag('megaton', true) },
  { id: 'b_cluster_rockets', tree: 'bigbang', row: 5, col: 0, max: 3, name: 'Cluster Rockets', icon: '🎇', pair: 'rockets',
    desc: (r) => `Toy Bazooka explosions split off ${1 + r} Bottle Rockets at nearby thugs (Bottle Rockets' damage).`,
    apply: (c, r) => c.link('bazooka', 'rockets', 'explode', 1, (run, p, ev) => rocketsFrom(run, p, ev.x, ev.z, 1 + r), { icd: 0.25 }) },
  { id: 'b_party_sticks', tree: 'bigbang', row: 5, col: 2, max: 3, name: 'Party Sticks', icon: '🎉', pair: 'firecrackers',
    desc: (r) => `Stick of Dynamite explosions have a ${15 * r}% chance to scatter 4 Firecrackers around the blast (Firecrackers' damage).`,
    apply: (c, r) => c.link('dynamite_stick', 'firecrackers', 'explode', 0.15 * r, (run, p, ev) => {
      for (let i = 0; i < 4; i++) {
        run.lob({ x: ev.x, z: ev.z, tx: ev.x + rnd(-3, 3), tz: ev.z + rnd(-3, 3), dur: rnd(0.35, 0.55), kind: 'firework', small: true,
          onLand: (x, z) => run.explode(x, z, p.stat('area'), p.stat('damage'), p, { small: true, noProc: true, color: ['#ff4fa3', '#ffd23f', '#58c4ff'][i % 3] }) });
      }
    }, { icd: 0.3 }) },
  { id: 'b_bombs_away', tree: 'bigbang', row: 6, col: 1, max: 3, name: 'Bombs Away', icon: '🍬', pair: 'sticky_bomb',
    desc: (r) => `Mortar shells have a ${8 * r}% chance to plant a Sticky Bomb on the toughest thug near the impact (Sticky Bomb's damage; it's a charge, so the next shell can chain it).`,
    apply: (c, r) => c.link('mortar', 'sticky_bomb', 'explode', 0.08 * r, (run, p, ev) => stickNear(run, p, ev.x, ev.z, 6), { icd: 0.5 }) },
  { id: 'b_chain2', tree: 'bigbang', row: 7, col: 1, max: 1, name: 'Chain Reaction II', icon: '⛓️‍💥', capstone: true, pair: 'c4',
    desc: () => 'Thugs killed by explosives have a 30% chance (elites: always) to blow up for 70% of the killing ability\'s damage, and those blasts can chain again. One in four chain blasts leaves a C4 brick (C4\'s damage, outside its charge limit, 6 at most) for the clacker or the next chain.',
    apply: (c) => c.link('#explosive', null, 'kill', (run, ev) => (ev.m.tier === 1 ? 1 : ev.m.tier === 0 ? 0.3 : 0), (run, p, ev) => {
      const a = ev.src, { x, z } = ev;
      run.later(0.1, () => {
        run.explode(x, z, 3.2, a.stat('damage') * 0.7, a, { noShrapnel: true });
        const c4 = run.abilityById('c4');
        if (c4 && Math.random() < 0.25 && run.traps.filter((t) => t.extra && t.ability === c4).length < 6) {
          c4.def.plant(run, c4, x + rnd(-1, 1), z + rnd(-1, 1), { extra: true });
        }
      });
    }, { icd: 0.06 }) },

  // ── Pyro ──
  { id: 'b_burn', tree: 'pyro', row: 0, col: 0, max: 5, name: 'Accelerant', icon: '🔥',
    desc: (r) => `Burns deal +${12 * r}% damage.`, apply: (c, r) => c.stat('burnDmg', 0.12 * r) },
  { id: 'b_gas', tree: 'pyro', row: 0, col: 2, max: 3, name: 'Leaky Jar', icon: '💧',
    desc: (r) => `Fire puddles last ${0.5 * r}s longer.`, apply: (c, r) => { c.abil('#fire', 'duration', 'add', 0.5 * r); } },
  { id: 'b_jar', tree: 'pyro', row: 1, col: 0, max: 3, name: 'Family Recipe', icon: '🫙',
    desc: (r) => `Napalm Jar puddles are ${10 * r}% bigger.`, apply: (c, r) => c.abil('napalm', 'area', 'pct', 10 * r) },
  { id: 'b_proof', tree: 'pyro', row: 1, col: 2, max: 3, name: 'Asbestos Onesie', icon: '🧯',
    desc: (r) => `Take ${4 * r}% less damage.`, apply: (c, r) => c.stat('armor', 0.04 * r) },
  { id: 'b_hp', tree: 'pyro', row: 2, col: 0, max: 3, name: 'Hot-Blooded', icon: '❤️‍🔥',
    desc: (r) => `+${12 * r} max HP.`, apply: (c, r) => c.stat('maxHp', 12 * r) },
  { id: 'b_ignite', tree: 'pyro', row: 2, col: 2, max: 3, name: 'Spark', icon: '✨',
    desc: (r) => `+${10 * r}% area for fire abilities.`, apply: (c, r) => c.abil('#fire', 'area', 'pct', 10 * r) },
  { id: 'b_heat', tree: 'pyro', row: 3, col: 1, max: 3, name: 'Dry Season', icon: '🌡️',
    desc: (r) => `Burning thugs are ${10 * r}% more likely to spread the flames to a neighbour, and +${2 * r}% damage.`,
    apply: (c, r) => { c.flagAdd('fireSpreadChance', 0.1 * r); c.stat('dmg', 0.02 * r); } },
  { id: 'b_napalm', tree: 'pyro', row: 4, col: 1, max: 1, name: 'Napalm Blasts', icon: '🌋', capstone: true,
    desc: () => 'Explosions have a 35% chance to leave a burning puddle.', apply: (c) => c.flag('napalmBlasts', true) },
  { id: 'b_jam_pipes', tree: 'pyro', row: 5, col: 0, max: 3, name: "Grandma's Jam Pipes", icon: '🫙', pair: 'napalm',
    desc: (r) => `Pipe Bomb explosions have a ${[0, 35, 70, 100][r]}% chance to leave a Napalm puddle (Napalm's damage, 90% of its size, 60% of its duration).`,
    apply: (c, r) => c.link('pipe_bomb', 'napalm', 'explode', [0, 0.35, 0.7, 1][r], (run, p, ev) => fireAt(run, p, ev.x, ev.z, { r: p.stat('area') * 0.9, life: p.stat('duration') * 0.6 }), { icd: 0.5 }) },
  { id: 'b_firestarter', tree: 'pyro', row: 5, col: 2, max: 3, name: 'Firestarter', icon: '🔥', pair: 'napalm',
    desc: (r) => `Stick of Dynamite blasts have a ${30 * r}% chance to set every thug they hit alight (Napalm's damage ×2 over 2s), and the flames spread from there.`,
    apply: (c, r) => c.link('dynamite_stick', 'napalm', 'explode', 0.3 * r, (run, p, ev) => {
      for (const m of run.mobs.near(ev.x, ev.z, ev.r)) if (!m.dead) run.ignite(m, p.stat('damage') * 2, 2);
      run.fx.ring(ev.x, ev.z, ev.r, '#ff7a1a', 0.3);
    }, { icd: 0.3 }) },
  { id: 'b_hot_gum', tree: 'pyro', row: 6, col: 1, max: 3, name: 'Hot Gum', icon: '🍭', pair: 'napalm',
    desc: (r) => `Sticky Bomb explosions have a ${20 * r}% chance to jump a burning gum-bomb to a nearby thug: 60% of Sticky Bomb's damage, and everything in the blast burns for Napalm's damage ×2 over 3s.`,
    apply: (c, r) => c.link('sticky_bomb', 'napalm', 'explode', 0.2 * r, (run, p, ev) => {
      const a = ev.src;
      stickNear(run, a, ev.x, ev.z, 6, { dmg: 0.6, skip: ev.m, onBlow: (x, z) => {
        for (const m of run.mobs.near(x, z, a.stat('area'))) if (!m.dead) run.ignite(m, p.stat('damage') * 2, 3);
      } });
    }, { icd: 0.4 }) },
  { id: 'b_scorched', tree: 'pyro', row: 7, col: 1, max: 1, name: 'Scorched Earth', icon: '🏜️', capstone: true, pair: 'napalm',
    desc: () => 'Every big explosion leaves Napalm fire behind (70% of Napalm\'s damage per second, 2.5s), and fire abilities deal +30% damage.',
    apply: (c) => {
      c.link('#explosive', 'napalm', 'explode', (run, ev) => (ev.small ? 0 : 1), (run, p, ev) => fireAt(run, p, ev.x, ev.z, { r: Math.min(ev.r * 0.7, p.stat('area')), life: 2.5, dps: p.stat('damage') * 0.7 }), { icd: 0.2 });
      c.abil('#fire', 'damage', 'pct', 30);
    } },

  // ── Sapper ──
  { id: 'b_traps', tree: 'sapper', row: 0, col: 0, max: 3, name: 'Well Stocked', icon: '📦',
    desc: (r) => `C4 Charges: +${r} max charges.`, apply: (c, r) => c.abil('c4', 'count', 'add', r) },
  { id: 'b_luck', tree: 'sapper', row: 0, col: 2, max: 3, name: 'Live Wire', icon: '✂️',
    desc: (r) => `Fuse builds ${20 * r}% more from everything and fills up to ${10 * r}% faster, and +${3 * r} luck.`,
    apply: (c, r) => { c.flagAdd('fuseGain', 0.2 * r); c.stat('luck', 3 * r); } },
  { id: 'b_pickup', tree: 'sapper', row: 1, col: 0, max: 2, name: 'Hair Trigger', icon: '🪤',
    desc: (r) => `Pipe Bombs go off when a thug gets within ${30 * r}% more distance, and +${15 * r}% pickup range.`,
    apply: (c, r) => { c.flagAdd('pipeTrigger', 0.3 * r); c.stat('pickupPct', 0.15 * r); } },
  { id: 'b_rc', tree: 'sapper', row: 1, col: 2, max: 3, name: 'Turbo Batteries', icon: '🔋',
    desc: (r) => `RC Car Bomb and Bottle Rockets deal +${15 * r}% damage.`, apply: (c, r) => { c.abil('rc_car', 'damage', 'pct', 15 * r); c.abil('rockets', 'damage', 'pct', 15 * r); } },
  { id: 'b_xp', tree: 'sapper', row: 2, col: 0, max: 3, name: 'Night School', icon: '📚',
    desc: (r) => `+${6 * r}% XP.`, apply: (c, r) => c.stat('xpGain', 0.06 * r) },
  { id: 'b_haste', tree: 'sapper', row: 2, col: 2, max: 3, name: 'Busy Hands', icon: '🤲',
    desc: (r) => `+${3 * r}% Recharge Rate on all abilities.`, apply: (c, r) => c.stat('haste', 0.03 * r) },
  { id: 'b_reroll', tree: 'sapper', row: 3, col: 1, max: 1, name: 'Blueprints', icon: '📐',
    desc: () => '+2 rerolls per run.', apply: (c) => c.stat('rerolls', 2) },
  { id: 'b_mortar', tree: 'sapper', row: 4, col: 1, max: 1, name: 'Artillery Support', icon: '🎯', capstone: true,
    desc: () => 'Mortar Strike fires 4 more shells and gets +25% Recharge Rate.', apply: (c) => { c.abil('mortar', 'count', 'add', 4); c.abil('mortar', 'cooldown', 'pct', 25); } },
  { id: 'b_wired', tree: 'sapper', row: 5, col: 0, max: 3, name: 'Wired Network', icon: '🔌', pair: 'detonator',
    desc: (r) => `Charges set off by the Detonator count as chain links (+20% damage, and they build Fuse). When a chain reaches its third link, ${10 * r}% chance the Detonator goes off for free (no cooldown used, 4s between).`,
    apply: (c, r) => {
      c.flag('wiredNet', true);
      c.link('#explosive', 'detonator', 'explode', (run) => ((run.counters.boomLink ?? 0) >= 2 ? 0.1 * r : 0), (run, p) => freeCast(run, p), { icd: 4 });
    } },
  { id: 'b_warmup', tree: 'sapper', row: 5, col: 2, max: 3, name: 'Warm-Up Lap', icon: '🏁', pair: 'big_one',
    desc: (r) => `RC Car Bomb explosions take ${(0.5 * r).toFixed(1)}s off The Big One's cooldown, and The Big One needs ${2 * r} fewer thugs around to go off.`,
    apply: (c, r) => {
      c.flagAdd('bigOneCrowd', 2 * r);
      c.link('rc_car', 'big_one', 'explode', 1, (run, p) => { p.cd = Math.max(0, p.cd - 0.5 * r); }, { icd: 0.25 });
    } },
  { id: 'b_wired_gum', tree: 'sapper', row: 6, col: 1, max: 3, name: 'Gum on the Wire', icon: '🍬', pair: 'sticky_bomb',
    desc: (r) => `Each time the Detonator goes off, it also slaps a Sticky Bomb on the ${r === 1 ? 'toughest thug' : `${r} toughest thugs`} near your charges (Sticky Bomb's damage ×0.8, 1s fuse), ready for the next chain. The Big Red Button flings ${2 * r} more gum-bombs in its ring.`,
    apply: (c, r) => {
      c.flagAdd('ringGum', 2 * r);
      c.link('detonator', 'sticky_bomb', 'fire', 1, (run, p, ev) => {
        const list = Array.isArray(ev.tgt) ? ev.tgt : [];
        const used = new Set();
        for (const ch of list) {
          if (used.size >= r) break;
          const t = stickNear(run, p, ch.x, ch.z, 5, { dmg: 0.8, fuse: 1, skip: used });
          if (t) used.add(t);
        }
      }, { icd: 0 });
    } },
  { id: 'b_doomsday', tree: 'sapper', row: 7, col: 1, max: 1, name: 'Doomsday', icon: '☢️', capstone: true, pair: 'big_one',
    desc: () => 'The Big One gets +25% area, goes off a second time 1s later (60% damage), and its blast instantly recharges every other explosive ability.',
    apply: (c) => {
      c.abil('big_one', 'area', 'pct', 25);
      c.link('big_one', null, 'fire', 1, (run, p, ev) => {
        const a = ev.src;
        run.later(0.65, () => { for (const o of run.abilities) if (o !== a && o.def.tags.includes('explosive')) o.cd = Math.min(o.cd, 0.1); });
        run.later(1.6, () => { const { x, z } = run.player; run.fx.ring(x, z, a.stat('area'), '#ffef5a', 0.6); explodeAt(run, a, x, z, { dmg: 0.6 }); run.shake(0.4); });
      }, { icd: 0 });
    } },
];
