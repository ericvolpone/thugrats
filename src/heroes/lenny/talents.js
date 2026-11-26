/**
 * Lenny's talent tree. 3 branches × 5 rows. Row r needs 3·r points already
 * spent in that branch. One point per hero level.
 *
 * apply(ctx, rank) runs at the start of every run:
 *   ctx.stat(key, v)               add to a run stat (see game/stats.js)
 *   ctx.abil(match, stat, kind, v) modify abilities; match = ability id or '#tag'
 *                                  kind 'pct' (+v%) or 'add' (+v flat)
 *   ctx.flag(name, v)              set a behaviour flag read by abilities
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
];
