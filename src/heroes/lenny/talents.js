import { freeCast, boltFrom, ringShot, addStatus, statusN, tint } from '../common.js';

/**
 * Lenny's talent tree. 3 branches × 8 rows. Row r needs 3·r points already
 * spent in that branch. One point per hero level (49 at level 50).
 * Rows 5-7 are pairing talents: `pair` names the partner ability that must be
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
  { id: 'rackets', name: 'Racketeering', icon: '🤝', color: '#f2c037', blurb: 'Buy-ins, shakedowns and fear. Gold is power.' },
  { id: 'family', name: 'Family Business', icon: '🤵', color: '#6fd0ff', blurb: 'Luck, the crew, and friends who owe you favours.' },
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

  // ── Racketeering (Buy In, Protection Racket, Make an Example) ──
  { id: 'deep_pockets', tree: 'rackets', row: 0, col: 0, max: 5, name: 'Deep Pockets', icon: '👛',
    desc: (r) => `Buy-ins cost ${6 * r}% less gold.`, apply: (c, r) => c.flagAdd('buyInDiscount', 0.06 * r) },
  { id: 'collection_day', tree: 'rackets', row: 0, col: 2, max: 3, name: 'Collection Day', icon: '📒',
    desc: (r) => `Protection Racket: +${20 * r}% coin chance and +${8 * r}% radius.`,
    apply: (c, r) => { c.abil('racket', 'payout', 'pct', 20 * r); c.abil('racket', 'area', 'pct', 8 * r); } },
  { id: 'intimidation', tree: 'rackets', row: 1, col: 0, max: 3, name: 'Intimidation', icon: '😠',
    desc: (r) => `Make an Example +${10 * r}% area, and terror lasts ${(0.4 * r).toFixed(1)}s longer.`,
    apply: (c, r) => { c.abil('make_example', 'area', 'pct', 10 * r); c.flagAdd('terrorDur', 0.4 * r); } },
  { id: 'hush_money', tree: 'rackets', row: 1, col: 2, max: 2, name: 'Hush Money', icon: '🤫',
    desc: (r) => `When you get hit holding 10+ gold, pay 1 gold and heal back ${25 * r}% of the hit (once per second).`,
    apply: (c, r) => c.link('*', null, 'hurt', (run, ev) => (run.gold >= 10 && ev.dmg > 0 ? 1 : 0), (run, p, ev) => {
      run.gold -= 1;
      run.heal(ev.dmg * 0.25 * r);
      run.fx.number(run.player.x, 2.3, run.player.z, '-1 💰', '#ffd23f');
    }, { icd: 1 }) },
  { id: 'public_execution', tree: 'rackets', row: 2, col: 0, max: 1, name: 'Public Execution', icon: '⚰️',
    desc: () => 'Make an Example executes its example outright if he is under 30% HP (not bosses or titans).', apply: (c) => c.flag('publicExec', true) },
  { id: 'muscle', tree: 'rackets', row: 2, col: 2, max: 3, name: 'Muscle', icon: '💪',
    desc: (r) => `Thugs shaken down by Protection Racket take +${4 * r}% more damage.`, apply: (c, r) => c.abil('racket', 'vuln', 'add', 0.04 * r) },
  { id: 'compound_interest', tree: 'rackets', row: 3, col: 1, max: 3, name: 'Compound Interest', icon: '📈',
    desc: (r) => `Each buy-in stack gives +${(1.5 * r).toFixed(1)}% more damage (+${(8 + 1.5 * r).toFixed(1)}% per stack, favours +${((8 + 1.5 * r) * 1.5).toFixed(1)}%).`,
    apply: (c, r) => c.flagAdd('buyInDmg', 0.015 * r) },
  { id: 'untouchable_boss', tree: 'rackets', row: 4, col: 1, max: 1, name: 'Untouchable', icon: '🎩', capstone: true,
    desc: () => 'Nobody hits the Boss: every buy-in also cuts the damage you take by 3% (up to 15%).',
    apply: (c) => { c.flag('buyInArmor', 0.03); c.flag('buyInArmorCap', 0.15); } },
  { id: 'pay_up', tree: 'rackets', row: 5, col: 0, max: 3, name: 'Pay Up', icon: '🫴', pair: 'racket',
    desc: (r) => `Make an Example shakes down everything it hits for ${r + 1}s (Protection Racket's extra damage), and each thug it hits has a ${5 * r}% chance to cough up a coin.`,
    apply: (c, r) => c.link('make_example', 'racket', 'hit', 1, (run, p, ev) => {
      if (ev.m.dead) return;
      addStatus(run, ev.m, 'racket', 1, r + 1, 1);
      tint(run, ev.m, '#f2c037', r + 1);
      if (Math.random() < 0.05 * r) run.pickups.coin(ev.m.x, ev.m.z, 1);
    }, { icd: 0 }) },
  { id: 'concrete_persuasion', tree: 'rackets', row: 5, col: 2, max: 3, name: 'Concrete Persuasion', icon: '🧱', pair: 'cement',
    desc: (r) => `Protection Racket pulses have a ${8 * r}% chance to throw a free Cement Shoes at the thickest crowd.`,
    apply: (c, r) => c.link('racket', 'cement', 'fire', 0.08 * r, (run, p) => freeCast(run, p), { icd: 3 }) },
  { id: 'collections_run', tree: 'rackets', row: 6, col: 1, max: 3, name: 'Collections Run', icon: '🚙', pair: 'driveby',
    desc: (r) => `Protection Racket pulses have a ${5 * r}% chance to call in a free Drive-By through the crowd.`,
    apply: (c, r) => c.link('racket', 'driveby', 'fire', 0.05 * r, (run, p) => freeCast(run, p), { icd: 2 }) },
  { id: 'the_vig', tree: 'rackets', row: 7, col: 1, max: 1, name: 'The Vig', icon: '💵', capstone: true, pair: 'make_it_rain',
    desc: () => 'Thugs that die while shaken down burst into 6 golden bills that fly outward (Make It Rain\'s damage ×2 each).',
    apply: (c) => c.link('*', 'make_it_rain', 'kill', (run, ev) => (statusN(run, ev.m, 'racket') ? 1 : 0),
      (run, p, ev) => ringShot(run, p, ev.x, ev.z, 6, p.stat('damage') * 2, '#ffd700'), { icd: 0.25 }) },

  // ── Family Business ──
  { id: 'thick_diaper', tree: 'family', row: 0, col: 0, max: 5, name: 'Thick Diaper', icon: '🧻',
    desc: (r) => `+${10 * r} max HP.`, apply: (c, r) => c.stat('maxHp', 10 * r) },
  { id: 'protection_money', tree: 'family', row: 0, col: 2, max: 3, name: 'Protection Money', icon: '💵',
    desc: (r) => `+${10 * r}% gold, start runs with ${15 * r} gold.`, apply: (c, r) => { c.stat('goldGain', 0.1 * r); c.stat('startGold', 15 * r); } },
  { id: 'lucky_charm', tree: 'family', row: 1, col: 0, max: 3, name: 'Lucky Rabbit Foot', icon: '🐇',
    desc: (r) => `+${6 * r} luck.`, apply: (c, r) => c.stat('luck', 6 * r) },
  { id: 'button_men', tree: 'family', row: 1, col: 2, max: 2, name: 'Button Men', icon: '🕴️',
    desc: (r) => `Made Men deal +${15 * r}% damage and stay ${(1.5 * r).toFixed(1)}s longer.`,
    apply: (c, r) => { c.abil('made_men', 'damage', 'pct', 15 * r); c.abil('made_men', 'duration', 'add', 1.5 * r); } },
  { id: 'connections', tree: 'family', row: 2, col: 0, max: 1, name: 'Connections', icon: '📞',
    desc: () => '+2 rerolls per run and chests cost 25% less.', apply: (c) => { c.stat('rerolls', 2); c.stat('chestDiscount', 0.25); } },
  { id: 'nap_time', tree: 'family', row: 2, col: 2, max: 3, name: 'Nap Time', icon: '😴',
    desc: (r) => `+${(0.4 * r).toFixed(1)} HP regen per second.`, apply: (c, r) => c.stat('regen', 0.4 * r) },
  { id: 'owed_favours', tree: 'family', row: 3, col: 1, max: 3, name: 'Owed Favours', icon: '📇',
    desc: (r) => `Favours (Hired Goon, Drive-By, Hit Contract) get +${6 * r}% Recharge Rate.`,
    apply: (c, r) => { for (const id of ['goon', 'driveby', 'contract']) c.abil(id, 'cooldown', 'pct', 6 * r); } },
  { id: 'godfather', tree: 'family', row: 4, col: 1, max: 1, name: 'The Godfather', icon: '🤵', capstone: true,
    desc: () => 'A permanent bodyguard follows you all run. Hired Goon upgrades make him stronger.', apply: (c) => c.flag('godfather', true) },
  { id: 'overtime', tree: 'family', row: 5, col: 0, max: 3, name: 'Overtime', icon: '⏰', pair: 'make_example',
    desc: (r) => `Hired Goon hits have a ${6 * r}% chance to Make an Example where they land (70% of its damage and size, terrifies).`,
    apply: (c, r) => c.link('goon', 'make_example', 'hit', 0.06 * r, (run, p, ev) => p.def.example(run, p, ev.x, ev.z, 0.7), { icd: 0.5 }) },
  { id: 'money_talks', tree: 'family', row: 5, col: 2, max: 3, name: 'Money Talks', icon: '💰', pair: 'frenzy',
    desc: (r) => `Make It Rain kills add ${(0.2 * r).toFixed(1)}s to Frenzy, or start a 2s Frenzy if it isn't up.`,
    apply: (c, r) => c.link('make_it_rain', 'frenzy', 'kill', 1, (run, p) => {
      const b = run.buffs.frenzy;
      if (b) b.t = Math.min(b.max + 3, b.t + 0.2 * r);
      else run.buffs.frenzy = { t: 2, max: 2, power: p.stat('power') };
    }, { icd: 0.1 }) },
  { id: 'flash_the_cash', tree: 'family', row: 6, col: 1, max: 3, name: 'Flash the Cash', icon: '🤑', pair: 'make_it_rain',
    desc: (r) => `Make an Example flings ${2 * r} extra cash stacks that orbit you for 5s (Make It Rain's damage).`,
    apply: (c, r) => c.link('make_example', 'make_it_rain', 'fire', 1, (run, p) => run.orbit({ ...p.def.aura, ability: p, life: 5, count: 2 * r, r: p.stat('area') * 1.35, spin: -3 })) },
  { id: 'family_reunion', tree: 'family', row: 7, col: 1, max: 1, name: 'Family Reunion', icon: '👨‍👦‍👦', capstone: true, pair: 'goon',
    desc: () => 'Hired Goon calls one more cousin, and every time your Snub-Nose fires, every goon (Hired Goons, Made Men, bodyguards) takes a shot too (Snub-Nose damage).',
    apply: (c) => {
      c.abil('goon', 'count', 'add', 1);
      c.link('pistol', 'goon', 'fire', 1, (run, p, ev) => {
        for (const g of run.combat.goons) boltFrom(run, ev.src, g.x, g.z, { range: 12 });
      }, { icd: 0.2 });
    } },
];
