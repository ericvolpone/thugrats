/**
 * Rarity tiers shared by ability upgrades, run items and permanent gear.
 * Index 0..4 = grey, green, blue, purple, orange.
 */
export const TIERS = [
  { id: 'common', name: 'Common', color: '#a8a8a8', weight: 52 },
  { id: 'uncommon', name: 'Uncommon', color: '#2fd34b', weight: 28 },
  { id: 'rare', name: 'Rare', color: '#2f8cff', weight: 13 },
  { id: 'epic', name: 'Epic', color: '#b14cff', weight: 5.5 },
  { id: 'legendary', name: 'Legendary', color: '#ff9a1f', weight: 1.5 },
];

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
