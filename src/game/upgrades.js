import { rollTier, scaledGain, CONTRA_TIER } from '../data/tiers.js';
import { ITEMS, SLOTS } from '../data/items.js';
import { shuffle, pick } from '../util.js';

export const MAX_ABILITIES = 5;

/** Weighted pick of `n` distinct entries ({w}) from `pool`. */
function pickDistinct(pool, n, forced = []) {
  const out = [...forced];
  const left = pool.filter((p) => !out.includes(p));
  while (out.length < n && left.length) {
    let total = 0;
    for (const p of left) total += p.w;
    let r = Math.random() * total;
    let i = 0;
    for (; i < left.length - 1; i++) { r -= left[i].w; if (r <= 0) break; }
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}

/** Size of the next roll of an item (see items.js), clipped to the power that still helps. */
export function itemGain(def, owned, tier, run) {
  // Contraband stacks linearly: every copy is one more full dose
  const g = def.slot === 'stash' ? def.v : scaledGain(def.v, owned?.power ?? 0, tier);
  return def.room && run ? Math.max(0, Math.min(g, def.room(run, owned))) : g;
}

/** True when more of this item would do nothing (chance at 100%, luck at the cap...). */
export function itemMaxed(run, def, owned) {
  return !!def.room && def.room(run, owned) <= def.v * 0.05;
}

/** Would taking `gain` more of this item max it out (and retire it)? */
export function itemWouldMax(run, def, owned, gain) {
  return !!def.room && def.room(run, owned) - gain <= def.v * 0.05;
}

/**
 * Level-up offer: 3 cards, each about a DIFFERENT ability. First the subjects
 * are picked (abilities you own that still have something worth upgrading, plus
 * new abilities while you have free slots), then each owned one gets a rarity
 * roll (luck) and an upgrade that exists at that rarity.
 */
export function levelOffers(run, n = 3) {
  const luck = run.stats.luck;
  const owned = run.abilities.filter((a) => !run.banished.has(a.def.id));
  const free = run.abilities.length < MAX_ABILITIES;
  const pool = [];
  for (const a of owned) {
    if (a.def.upgrades.some((u) => [0, 1, 2, 3, 4].some((t) => a.canOffer(u, t)))) pool.push({ a, w: 1 });
  }
  if (free) {
    for (const d of run.hero.abilities) {
      if (run.abilityById(d.id) || run.banished.has(d.id)) continue;
      pool.push({ def: d, w: run.abilities.length < 3 ? 1.2 : 0.7 });
    }
  }
  // early on, always show at least one new ability
  const forced = run.abilities.length < 3 ? shuffle(pool.filter((p) => p.def)).slice(0, 1) : [];
  const subjects = shuffle(pickDistinct(pool, n, forced));

  const cards = subjects.map((s) => {
    if (s.def) return { type: 'newAbility', def: s.def };
    let tier = rollTier(luck);
    let ups = s.a.def.upgrades.filter((u) => s.a.canOffer(u, tier));
    // flat upgrades can be tier-gated: fall back to the best tier that has one
    while (!ups.length && tier > 0) ups = s.a.def.upgrades.filter((u) => s.a.canOffer(u, --tier));
    if (!ups.length) for (tier = 1; tier <= 4 && !ups.length; tier++) ups = s.a.def.upgrades.filter((u) => s.a.canOffer(u, tier));
    const up = pick(ups);
    tier = Math.min(4, tier);
    const gain = s.a.gainFor(up, tier);
    return { type: 'abilityUp', ability: s.a, up, tier, gain, maxes: s.a.wouldMax(up, gain) };
  });
  while (cards.length < n) cards.push({ type: 'gold', amount: 20 + run.level * 3, tier: 0 });
  return cards;
}

/**
 * Item offer (chests, bosses): 3 different items, new ones for open slots or
 * upgrades of ones you hold. Reputations are always in the pool. minTier:
 * bosses never give grey. only = 'stash': the Black Market (Contraband only);
 * otherwise Contraband is never offered.
 */
export function itemOffers(run, n = 3, minTier = 0, only = null) {
  const luck = run.stats.luck;
  const pool = [];
  for (const def of ITEMS) {
    if ((def.slot === 'stash') !== (only === 'stash')) continue;
    if (run.banished.has(def.id) || run.maxed.has(def.id)) continue;
    if (def.needs && !run.abilities.some((a) => (typeof def.needs === 'function' ? def.needs(a) : a.def.tags.includes(def.needs)))) continue;
    const ownedInst = run.findItem(def.id);
    if (itemMaxed(run, def, ownedInst)) continue;
    if (ownedInst) {
      pool.push({ def, owned: ownedInst, w: 3 });
    } else if (run.items[def.slot].length < SLOTS[def.slot]) pool.push({ def, owned: null, w: def.slot === 'rep' ? 1.4 : 1 });
  }
  // Black Market: owned Contraband is no likelier than new (a random choice of any that fit)
  if (only === 'stash') for (const c of pool) c.w = 1;
  // make sure at least one reputation shows up whenever one is available
  const rep = only ? [] : shuffle(pool.filter((c) => c.def.slot === 'rep')).slice(0, 1);
  const cards = shuffle(pickDistinct(pool, n, rep)).map((c) => {
    const tier = c.def.slot === 'stash' ? CONTRA_TIER : rollTier(luck, minTier);
    const gain = itemGain(c.def, c.owned, tier, run);
    return { type: 'item', def: c.def, owned: c.owned, tier, gain, maxes: itemWouldMax(run, c.def, c.owned, gain) };
  });
  while (cards.length < n) cards.push({ type: 'gold', amount: 40 + run.level * 4, tier: 0 });
  return cards;
}

/** What a card's banish would remove from the pool ('ability' | 'item' | null). */
export function banishKind(card) {
  if (card.type === 'newAbility' || card.type === 'abilityUp') return 'ability';
  if (card.type === 'item') return 'item';
  return null;
}

export function banishId(card) {
  return card.def?.id ?? card.ability?.def.id;
}
