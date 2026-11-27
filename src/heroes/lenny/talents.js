import { freeCast, explodeAt, fireAt, boltFrom } from '../common.js';

/**
 * Lenny's talent tree. 3 branches × 8 rows. Row r needs 3·r points already
 * spent in that branch. One point per hero level (49 at level 50).
 * Rows 6-8 are pairing talents: `pair` names the partner ability that must be
 * in your run for them to do anything (see ctx.link).
 *
 * apply(ctx, rank) runs at the start of every run:
 *   ctx.stat(key, v)               add to a run stat (see game/stats.js)
 *   ctx.abil(match, stat, kind, v) modify abilities; match = ability id or '#tag'
 *                                  kind 'pct' (+v%) or 'add' (+v flat)
 *   ctx.flag(name, v)              set a behaviour flag read by abilities
 *   ctx.link(from, to, on, chance, proc, {icd})  pairing proc (see game/stats.js)
 *   ctx.amp(fn)                    conditional damage multiplier
 */
export const LENNY_TREES = [
  { id: 'trigger', name: 'Trigger Man', icon: '🔫', color: '#ff6b5a', blurb: 'Guns, crits and a whole lot of lead.' },
  { id: 'demo', name: 'Demolitions', icon: '💣', color: '#ffb02e', blurb: 'Explosives, fire, collateral damage.' },
  { id: 'family', name: 'Family Business', icon: '🤵', color: '#6fd0ff', blurb: 'Money, luck, and friends who owe you favours.' },
];

export const LENNY_TALENTS = [
  // ── Trigger Man ──
  { id: 'steady_hands', tree: 'trigger', row: 0, col: 0, max: 5, name: 'Steady Hands', icon: '🎯',
    desc: (r) => `Gun abilities deal +${4 * r}% damage.`, apply: (c, r) => c.abil('#gun', 'damage', 'pct', 4 * r) },
  { id: 'quick_draw', tree: 'trigger', row: 0, col: 2, max: 3, name: 'Quick Draw', icon: '⚡',
    desc: (r) => `Snub-Nose fires ${6 * r}% faster.`, apply: (c, r) => c.abil('pistol', 'cooldown', 'pct', 6 * r) },
  { id: 'hollow_points', tree: 'trigger', row: 1, col: 0, max: 3, name: 'Hollow Points', icon: '🩸',
    desc: (r) => `+${3 * r}% crit chance.`, apply: (c, r) => c.stat('crit', 0.03 * r) },
  { id: 'extended_mag', tree: 'trigger', row: 1, col: 2, max: 2, name: 'Extended Mag', icon: '📦',
    desc: (r) => `Chicago Typewriter fires +${2 * r} bullets.`, apply: (c, r) => c.abil('tommy', 'count', 'add', 2 * r) },
  { id: 'ricochet', tree: 'trigger', row: 2, col: 0, max: 1, name: 'Ricochet', icon: '↩️',
    desc: () => 'Snub-Nose bullets bounce to one more thug.', apply: (c) => c.flag('ricochet', true) },
  { id: 'bloodlust', tree: 'trigger', row: 2, col: 2, max: 3, name: 'Bloodlust', icon: '😤',
    desc: (r) => `Frenzy lasts ${r}s longer, and while it's up you heal for ${2 * r}% of damage dealt.`, apply: (c, r) => { c.abil('frenzy', 'duration', 'add', r); c.stat('frenzyLeech', 0.02 * r); } },
  { id: 'double_tap', tree: 'trigger', row: 3, col: 1, max: 3, name: 'Double Tap', icon: '✌️',
    desc: (r) => `${8 * r}% chance the Snub-Nose fires twice.`, apply: (c, r) => c.flag('doubleTap', 0.08 * r) },
  { id: 'akimbo', tree: 'trigger', row: 4, col: 1, max: 1, name: 'Akimbo', icon: '🔫', capstone: true,
    desc: () => 'A second Snub-Nose: always fires one extra bullet at a different target.', apply: (c) => c.flag('akimbo', true) },
  { id: 'covering_fire', tree: 'trigger', row: 5, col: 0, max: 3, name: 'Covering Fire', icon: '🎻', pair: 'tommy',
    desc: (r) => `Snub-Nose hits have a ${4 * r}% chance to fire a free Chicago Typewriter burst at the target.`,
    apply: (c, r) => c.link('pistol', 'tommy', 'hit', 0.04 * r, (run, p, ev) => freeCast(run, p, ev.m), { icd: 0.6 }) },
  { id: 'called_shot', tree: 'trigger', row: 5, col: 2, max: 3, name: 'Called Shot', icon: '📞', pair: 'contract',
    desc: (r) => `Hollow Point kills have a ${12 * r}% chance to reset Hit Contract's cooldown.`,
    apply: (c, r) => c.link('power_shot', 'contract', 'kill', 0.12 * r, (run, p) => { p.cd = 0; }, { icd: 1 }) },
  { id: 'frenzied_fire', tree: 'trigger', row: 6, col: 1, max: 3, name: 'Frenzied Fire', icon: '😡', pair: 'frenzy',
    desc: (r) => `While Frenzy is up, Snub-Nose hits have a ${12 * r}% chance to split off a bullet at another thug.`,
    apply: (c, r) => c.link('pistol', 'frenzy', 'hit', (run) => (run.buffs.frenzy ? 0.12 * r : 0), (run, p, ev) => boltFrom(run, ev.src, ev.x, ev.z, { skip: ev.m, dmg: ev.src.stat('damage') * 0.8 }), { icd: 0.05 }) },
  { id: 'marked_for_death', tree: 'trigger', row: 7, col: 1, max: 1, name: 'Marked for Death', icon: '🎯', capstone: true, pair: 'contract',
    desc: () => 'Hit Contract targets are marked for 6s: every gun ability deals +40% damage to them, and when one dies the Contract marks the next big thug right away.',
    apply: (c) => {
      c.flag('markForDeath', true);
      c.amp((run, m, a) => (m.markedUntil > run.time && a?.def?.tags?.includes('gun') ? 0.4 : 0));
      c.link('*', 'contract', 'kill', (run, ev) => (ev.m.markedUntil > run.time ? 1 : 0), (run, p, ev) => {
        const t = run.mobs.target(ev.x, ev.z, p.stat('range'), 'strongest');
        if (t) p.def.fire(run, p, t);
      }, { icd: 0.5 });
    } },

  // ── Demolitions ──
  { id: 'big_boom', tree: 'demo', row: 0, col: 0, max: 5, name: 'Big Boom', icon: '💥',
    desc: (r) => `Explosive abilities have +${5 * r}% area.`, apply: (c, r) => c.abil('#explosive', 'area', 'pct', 5 * r) },
  { id: 'short_fuse', tree: 'demo', row: 0, col: 2, max: 3, name: 'Short Fuse', icon: '⏱️',
    desc: (r) => `Explosive and thrown abilities get +${5 * r}% Recharge Rate.`, apply: (c, r) => { c.abil('#explosive', 'cooldown', 'pct', 5 * r); c.abil('#thrown', 'cooldown', 'pct', 5 * r); } },
  { id: 'shrapnel', tree: 'demo', row: 1, col: 0, max: 3, name: 'Shrapnel', icon: '🔩',
    desc: (r) => `Explosions throw ${2 * r} pieces of shrapnel.`, apply: (c, r) => c.flag('shrapnel', 2 * r) },
  { id: 'pyromaniac', tree: 'demo', row: 1, col: 2, max: 2, name: 'Pyromaniac', icon: '🔥',
    desc: (r) => `Burns deal +${25 * r}% damage.`, apply: (c, r) => c.stat('burnDmg', 0.25 * r) },
  { id: 'cluster_bomb', tree: 'demo', row: 2, col: 0, max: 1, name: 'Cluster Bomb', icon: '🍍',
    desc: () => 'Pineapples split into 3 mini-grenades when they explode.', apply: (c) => c.flag('clusterBomb', true) },
  { id: 'blast_proof', tree: 'demo', row: 2, col: 2, max: 3, name: 'Blast-Proof Onesie', icon: '🧷',
    desc: (r) => `Take ${4 * r}% less damage.`, apply: (c, r) => c.stat('armor', 0.04 * r) },
  { id: 'chain_reaction', tree: 'demo', row: 3, col: 1, max: 3, name: 'Chain Reaction', icon: '⛓️',
    desc: (r) => `Thugs killed by explosions have a ${10 * r}% chance to explode too.`, apply: (c, r) => c.flag('chainReaction', 0.1 * r) },
  { id: 'demolition_man', tree: 'demo', row: 4, col: 1, max: 1, name: 'Explosive Rounds', icon: '🧨', capstone: true,
    desc: () => 'Snub-Nose bullets explode on impact for 45% damage in a small area.', apply: (c) => c.flag('explosiveRounds', true) },
  { id: 'cocktail_hour', tree: 'demo', row: 5, col: 0, max: 3, name: 'Cocktail Hour', icon: '🍸', pair: 'molotov',
    desc: (r) => `Pineapple explosions have a ${15 * r}% chance to leave a burning Molotov puddle.`,
    apply: (c, r) => c.link('pineapple', 'molotov', 'explode', 0.15 * r, (run, p, ev) => fireAt(run, p, ev.x, ev.z, { r: p.stat('area') * 0.8, life: p.stat('duration') * 0.6 }), { icd: 0.3 }) },
  { id: 'concrete_mix', tree: 'demo', row: 5, col: 2, max: 3, name: 'Concrete Mix', icon: '🧱', pair: 'cement',
    desc: (r) => `Thugs rooted or slowed take +${12 * r}% damage from explosives (needs Cement Shoes in the run).`,
    apply: (c, r) => c.amp((run, m, a) => ((m.rootT > 0 || m.slowT > 0) && a?.def?.tags?.includes('explosive') && run.abilityById('cement') ? 0.12 * r : 0)) },
  { id: 'getaway_car', tree: 'demo', row: 6, col: 1, max: 3, name: 'Getaway Car', icon: '🚙', pair: 'dynamite',
    desc: (r) => `Drive-By hits have a ${15 * r}% chance to drop a live Dynamite bundle on the thug (Dynamite's damage, doesn't count toward its trap limit).`,
    apply: (c, r) => c.link('driveby', 'dynamite', 'hit', 0.15 * r, (run, p, ev) => run.trap({ x: ev.x, z: ev.z, ability: p, extra: true, trigger: 1.6, onTrigger: (x, z) => explodeAt(run, p, x, z) }), { icd: 0.15 }) },
  { id: 'powder_keg', tree: 'demo', row: 7, col: 1, max: 1, name: 'Powder Keg', icon: '🛢️', capstone: true, pair: 'molotov',
    desc: () => 'Thugs that die while burning (Molotov, fire, ignites) explode, using Molotov\'s damage ×3 in a small blast.',
    apply: (c) => c.link('*', 'molotov', 'kill', (run, ev) => (ev.src?.def?.tags?.includes('fire') || ev.m.burnT > 0 ? 1 : 0), (run, p, ev) => explodeAt(run, p, ev.x, ev.z, { dmg: 3, area: 0.9 }), { icd: 0.08 }) },

  // ── Family Business ──
  { id: 'thick_diaper', tree: 'family', row: 0, col: 0, max: 5, name: 'Thick Diaper', icon: '🧻',
    desc: (r) => `+${10 * r} max HP.`, apply: (c, r) => c.stat('maxHp', 10 * r) },
  { id: 'protection_money', tree: 'family', row: 0, col: 2, max: 3, name: 'Protection Money', icon: '💵',
    desc: (r) => `+${10 * r}% gold, start runs with ${15 * r} gold.`, apply: (c, r) => { c.stat('goldGain', 0.1 * r); c.stat('startGold', 15 * r); } },
  { id: 'lucky_charm', tree: 'family', row: 1, col: 0, max: 3, name: 'Lucky Rabbit Foot', icon: '🐇',
    desc: (r) => `+${6 * r} luck.`, apply: (c, r) => c.stat('luck', 6 * r) },
  { id: 'sticky_fingers', tree: 'family', row: 1, col: 2, max: 2, name: 'Sticky Fingers', icon: '🧲',
    desc: (r) => `+${25 * r}% pickup range.`, apply: (c, r) => c.stat('pickupPct', 0.25 * r) },
  { id: 'connections', tree: 'family', row: 2, col: 0, max: 1, name: 'Connections', icon: '📞',
    desc: () => '+2 rerolls per run and chests cost 25% less.', apply: (c) => { c.stat('rerolls', 2); c.stat('chestDiscount', 0.25); } },
  { id: 'nap_time', tree: 'family', row: 2, col: 2, max: 3, name: 'Nap Time', icon: '😴',
    desc: (r) => `+${(0.4 * r).toFixed(1)} HP regen per second.`, apply: (c, r) => c.stat('regen', 0.4 * r) },
  { id: 'street_smarts', tree: 'family', row: 3, col: 1, max: 3, name: 'Street Smarts', icon: '🧠',
    desc: (r) => `+${6 * r}% XP.`, apply: (c, r) => c.stat('xpGain', 0.06 * r) },
  { id: 'godfather', tree: 'family', row: 4, col: 1, max: 1, name: 'The Godfather', icon: '🤵', capstone: true,
    desc: () => 'A permanent bodyguard follows you all run. Hired Goon upgrades make him stronger.', apply: (c) => c.flag('godfather', true) },
  { id: 'overtime', tree: 'family', row: 5, col: 0, max: 3, name: 'Overtime', icon: '⏰', pair: 'tantrum',
    desc: (r) => `Hired Goon hits have a ${6 * r}% chance to throw a Tantrum where they land (Tantrum's damage, 70% of its size).`,
    apply: (c, r) => c.link('goon', 'tantrum', 'hit', 0.06 * r, (run, p, ev) => {
      const rr = p.stat('area') * 0.7;
      for (const m of run.mobs.near(ev.x, ev.z, rr)) run.hit(m, p.stat('damage'), p, { knock: p.stat('knock'), fromX: ev.x, fromZ: ev.z });
      run.fx.ring(ev.x, ev.z, rr, '#ffffff', 0.35);
    }, { icd: 0.5 }) },
  { id: 'money_talks', tree: 'family', row: 5, col: 2, max: 3, name: 'Money Talks', icon: '💰', pair: 'frenzy',
    desc: (r) => `Make It Rain kills add ${(0.2 * r).toFixed(1)}s to Frenzy, or start a 2s Frenzy if it isn't up.`,
    apply: (c, r) => c.link('make_it_rain', 'frenzy', 'kill', 1, (run, p) => {
      const b = run.buffs.frenzy;
      if (b) b.t = Math.min(b.max + 3, b.t + 0.2 * r);
      else run.buffs.frenzy = { t: 2, max: 2, power: p.stat('power') };
    }, { icd: 0.1 }) },
  { id: 'shakedown', tree: 'family', row: 6, col: 1, max: 3, name: 'Shakedown', icon: '🤑', pair: 'make_it_rain',
    desc: (r) => `Tantrum flings ${2 * r} extra cash stacks that orbit you for 5s (Make It Rain's damage).`,
    apply: (c, r) => c.link('tantrum', 'make_it_rain', 'fire', 1, (run, p) => run.orbit({ ...p.def.aura, ability: p, life: 5, count: 2 * r, r: p.stat('area') * 1.35, spin: -3 })) },
  { id: 'family_reunion', tree: 'family', row: 7, col: 1, max: 1, name: 'Family Reunion', icon: '👨‍👦‍👦', capstone: true, pair: 'goon',
    desc: () => 'Hired Goon calls one more cousin, and every time your Snub-Nose fires, each goon takes a shot too (Snub-Nose damage).',
    apply: (c) => {
      c.abil('goon', 'count', 'add', 1);
      c.link('pistol', 'goon', 'fire', 1, (run, p, ev) => {
        for (const g of run.combat.goons) boltFrom(run, ev.src, g.x, g.z, { range: 12 });
      }, { icd: 0.2 });
    } },
];
