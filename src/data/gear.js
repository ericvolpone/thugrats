import { TIER_MULT } from './tiers.js';

/**
 * Gear: permanent and per hero. Five slots, one piece worn in each. Every hero
 * has one 5-piece SET per map (heroes/<id>/gear.js), built around a playstyle or
 * ability of that hero. A map's Crime Titans drop that map's pieces for the hero
 * you're playing (TITAN_DROPS). Ascending gives upgrade tokens: one token raises
 * a piece a tier (Common → Legendary).
 *
 * A piece gives its slot's stat plus a boost to its set's focus, both scaled by
 * its tier. Wearing 2, 3 or all 5 pieces of one set turns on that set's bonuses;
 * mixing 2 + 3 of two sets gets both partial bonuses. Bonus strength k scales
 * with the average tier of the worn pieces of that set (setScale).
 *
 * Set definition:
 *   { id, map, name, icon, focus: ability id | '#tag', focusName, focusStat? (default 'damage'),
 *     pieces: [5 names in SLOT order] (optional icons: pieceIcons),
 *     bonus: { 2: {desc(k), apply(ctx, k)}, 3: {...}, 5: {...} } }
 * ctx is the talent ctx (stat / abil / flag / flagAdd / link, see game/stats.js).
 */
export const GEAR_SLOTS = ['Hat', 'Mittens', 'Bib', 'Diaper', 'Booties'];
export const SLOT_ICON = { Hat: '🧢', Mittens: '🧤', Bib: '🍼', Diaper: '🩲', Booties: '👟' };

/** Which slots each Crime Titan of a map can drop (by titan order) and the chance. */
export const TITAN_DROPS = [
  { slots: [0, 1], chance: 0.25 },
  { slots: [2, 3], chance: 0.25 },
  { slots: [4], chance: 0.35 },
];

const pct = (v) => `${Math.round(v * 10) / 10}%`;

/** The slot stat of a piece at tier t: [description, apply(ctx)]. */
const SLOT_STAT = {
  Hat: (m) => [`+${pct(1.5 * m)} crit chance`, (c) => c.stat('crit', 0.015 * m)],
  Mittens: (m) => [`+${pct(3 * m)} damage`, (c) => c.stat('dmg', 0.03 * m)],
  Bib: (m) => [`+${Math.round(12 * m)} max HP`, (c) => c.stat('maxHp', 12 * m)],
  Diaper: (m) => [`${pct(1.5 * m)} less damage taken, +${(0.15 * m).toFixed(2)} HP/s`, (c) => { c.stat('armor', 0.015 * m); c.stat('regen', 0.15 * m); }],
  Booties: (m) => [`+${pct(2.5 * m)} move speed`, (c) => c.stat('speedPct', 0.025 * m)],
};

/** Set bonus multiplier from the average tier (0..4) of the worn pieces: ×1 → ×2. */
export const setScale = (avgTier) => 1 + 0.25 * avgTier;

/** Expand a hero's set list into sets with pieces: piece = {id, set, slot, name, icon}. */
export function expandSets(sets) {
  for (const s of sets) {
    s.pieceList = GEAR_SLOTS.map((slot, i) => ({
      id: `${s.id}_${slot.toLowerCase()}`, set: s, slot, slotIndex: i,
      name: s.pieces?.[i] ?? `${s.name} ${slot}`, icon: s.pieceIcons?.[i] ?? SLOT_ICON[slot],
    }));
  }
  return sets;
}

/** What one piece gives at tier t. */
export function pieceEffect(piece, t) {
  const m = TIER_MULT[Math.max(0, t)];
  const [slotDesc, slotApply] = SLOT_STAT[piece.slot](m);
  const f = piece.set.focus;
  // focusStat: what the pieces boost on the focus (default damage; e.g. 'duration' for buffs)
  const fs = piece.set.focusStat ?? 'damage';
  const fv = Math.round((fs === 'damage' ? 6 : 5) * m);
  const label = { damage: 'damage', duration: 'duration', cooldown: 'Recharge Rate', area: 'area' }[fs] ?? fs;
  return {
    desc: `${slotDesc} · ${piece.set.focusName} +${fv}% ${label}`,
    apply(c) {
      slotApply(c);
      c.abil(f, fs, 'pct', fv);
    },
  };
}

/**
 * Worn sets for a hero: [{set, count, avgTier, k, active: [2,3,5 that are on]}].
 * `tierOf(pieceId)` and `wornIds` come from the save.
 */
export function wornSets(sets, wornIds, tierOf) {
  const out = [];
  for (const s of sets) {
    const worn = s.pieceList.filter((p) => wornIds.includes(p.id));
    if (!worn.length) continue;
    const avg = worn.reduce((a, p) => a + Math.max(0, tierOf(p.id)), 0) / worn.length;
    out.push({ set: s, count: worn.length, avgTier: avg, k: setScale(avg), active: [2, 3, 5].filter((n) => worn.length >= n && s.bonus?.[n]) });
  }
  return out;
}
