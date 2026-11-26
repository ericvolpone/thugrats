/**
 * Gear: permanent, per hero. Three slots (Head, Chest, Feet), one piece equipped
 * in each. Every slot has three options: the hero's signature piece (earned by
 * clearing its map, see heroes/<id>/gear.js) and the two shared pieces below,
 * which drop at random from runs.
 *
 * Tier t (0..4) is the piece's rarity; apply(ctx, t) uses the talents ctx.
 */
export const GEAR_SLOTS = ['Head', 'Chest', 'Feet'];

export const SHARED_GEAR = [
  {
    id: 'propeller_beanie', slot: 'Head', name: 'Propeller Beanie', icon: '🧢',
    desc: (t) => `+${4 + 3 * t}% move speed, +${15 + 10 * t}% pickup range.`,
    apply(c, t) { c.stat('speedPct', 0.04 + 0.03 * t); c.stat('pickupPct', 0.15 + 0.1 * t); },
  },
  {
    id: 'backwards_cap', slot: 'Head', name: 'Backwards Cap', icon: '🧑‍🎤',
    desc: (t) => `+${3 + 2 * t}% crit chance, +${10 + 8 * t}% crit damage.`,
    apply(c, t) { c.stat('crit', 0.03 + 0.02 * t); c.stat('critDmg', 0.1 + 0.08 * t); },
  },
  {
    id: 'bulletproof_bib', slot: 'Chest', name: 'Bulletproof Bib', icon: '🛡️',
    desc: (t) => `+${15 + 12 * t} max HP, take ${3 + 2 * t}% less damage.`,
    apply(c, t) { c.stat('maxHp', 15 + 12 * t); c.stat('armor', 0.03 + 0.02 * t); },
  },
  {
    id: 'bling_bib', slot: 'Chest', name: 'Bling Bib', icon: '📿',
    desc: (t) => `+${10 + 8 * t}% gold, +${5 + 4 * t} luck.`,
    apply(c, t) { c.stat('goldGain', 0.1 + 0.08 * t); c.stat('luck', 5 + 4 * t); },
  },
  {
    id: 'light_up_sneakers', slot: 'Feet', name: 'Light-Up Sneakers', icon: '👟',
    desc: (t) => `+${4 + 3 * t}% Recharge Rate, +${3 + 2 * t}% move speed.`,
    apply(c, t) { c.stat('haste', 0.04 + 0.03 * t); c.stat('speedPct', 0.03 + 0.02 * t); },
  },
  {
    id: 'fuzzy_slippers', slot: 'Feet', name: 'Fuzzy Slippers', icon: '🧦',
    desc: (t) => `+${(0.4 + 0.3 * t).toFixed(1)} HP regen/s, +${2 + 2 * t}% dodge.`,
    apply(c, t) { c.stat('regen', 0.4 + 0.3 * t); c.stat('dodge', 0.02 + 0.02 * t); },
  },
];

/** Chance that a finished run drops a gear piece (besides a clear's signature piece). */
export function gearDropChance({ minutes, bossKills, victory }) {
  if (victory) return 0.75;
  if (minutes < 3) return 0;
  return Math.min(0.6, 0.1 + minutes * 0.02 + bossKills * 0.08);
}
