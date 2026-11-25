/**
 * Rarity tiers shared by ability upgrades, run items and permanent gear.
 * Index 0..4 = grey, green, blue, purple, orange.
 */
export const TIERS = [
  { id: 'common', name: 'Common', color: '#a8a8a8', weight: 49 },
  { id: 'uncommon', name: 'Uncommon', color: '#2fd34b', weight: 28 },
  { id: 'rare', name: 'Rare', color: '#2f8cff', weight: 15 },
  { id: 'epic', name: 'Epic', color: '#b14cff', weight: 6.2 },
  { id: 'legendary', name: 'Legendary', color: '#ff9a1f', weight: 1.8 },
];

/** How much bigger each tier's roll is than a common one. */
export const TIER_MULT = [1, 1.5, 2.2, 3, 4];

/**
 * Diminishing returns. `u` = how much of this stat you already have, counted in
 * common-rolls (a legendary first pick is u = 4). The next roll is multiplied by
 * this: 1 → 0.88 → 0.67 at u = 2.5 → 0.4 at u = 5 → 0.17 at u = 10. Early
 * high-rarity rolls are what make a build; stacking commons tails off.
 */
export const decay = (u) => 1 / (1 + 0.1 * u + 0.04 * u * u);

/** Size of the next roll of a stat whose common roll is `base`, given `have` already. */
export function scaledGain(base, have, tier) {
  return base * TIER_MULT[tier] * decay(Math.max(0, have) / base);
}

/**
 * Roll a tier. Luck pushes weight toward the higher tiers: each point of luck
 * multiplies tier i's weight by (1 + luck * 0.02 * i), so 50 luck roughly
 * doubles blue and triples orange.
 * minTier/maxTier clamp the result (e.g. bosses never drop grey).
 */
export function rollTier(luck = 0, minTier = 0, maxTier = 4) {
  let total = 0;
  const w = TIERS.map((t, i) => {
    if (i < minTier || i > maxTier) return 0;
    const v = t.weight * (1 + Math.max(0, luck) * 0.02 * i);
    total += v;
    return v;
  });
  let r = Math.random() * total;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0 && w[i] > 0) return i;
  }
  return minTier;
}

export const tierColor = (i) => TIERS[Math.max(0, Math.min(4, i))].color;
