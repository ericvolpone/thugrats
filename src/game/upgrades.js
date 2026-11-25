import { rollTier } from '../data/tiers.js';
import { ITEMS, SLOTS } from '../data/items.js';
import { shuffle, pick } from '../util.js';

export const MAX_ABILITIES = 5;

/**
 * Level-up offer: 3 cards. While you have free ability slots some cards are
 * brand-new abilities; the rest upgrade an ability you own with a stat rolled
 * at a rarity tier (luck pushes tiers up).
 */
export function levelOffers(run, n = 3) {
  const cards = [];
  const luck = run.stats.luck;
  const owned = run.abilities;
  const unowned = shuffle(run.hero.abilities.filter((d) => !owned.some((a) => a.def.id === d.id)));
  const used = new Set();
  for (let i = 0; i < n; i++) {
    const wantNew = owned.length < MAX_ABILITIES && unowned.length && Math.random() < (i === 0 ? (owned.length < 3 ? 1 : 0.6) : 0.35);
    if (wantNew) {
      cards.push({ type: 'newAbility', def: unowned.pop() });
      continue;
    }
    let card = null;
    for (let tries = 0; tries < 20 && !card; tries++) {
      const tier = rollTier(luck);
      const a = pick(owned);
      const ups = a.def.upgrades.filter((u) => u.values[tier] > 0 && !used.has(`${a.def.id}:${u.stat}`));
      if (!ups.length) continue;
      const up = pick(ups);
      used.add(`${a.def.id}:${up.stat}`);
      card = { type: 'abilityUp', ability: a, up, tier };
    }
    if (!card && unowned.length && owned.length < MAX_ABILITIES) card = { type: 'newAbility', def: unowned.pop() };
    if (!card) card = { type: 'gold', amount: 25, tier: 0 };
    cards.push(card);
  }
  return cards;
}

/**
 * Item offer (chests, bosses): new items for open slots or upgrades of items you
 * hold. Reputations are always in the pool. minTier: bosses never give grey.
 */
export function itemOffers(run, n = 3, minTier = 0) {
  const luck = run.stats.luck;
  const pool = [];
  for (const def of ITEMS) {
    const ownedInst = run.findItem(def.id);
    if (ownedInst) pool.push({ def, owned: ownedInst, w: 3 });
    else if (run.items[def.slot].length < SLOTS[def.slot]) pool.push({ def, owned: null, w: def.slot === 'rep' ? 1.4 : 1 });
  }
  const cards = [];
  shuffle(pool);
  // make sure at least one reputation shows up whenever one is available
  const rep = pool.find((c) => c.def.slot === 'rep');
  if (rep) cards.push(rep);
  while (cards.length < n && pool.length) {
    let total = 0;
    for (const c of pool) if (!cards.includes(c)) total += c.w;
    if (total <= 0) break;
    let r = Math.random() * total;
    for (const c of pool) {
      if (cards.includes(c)) continue;
      r -= c.w;
      if (r <= 0) { cards.push(c); break; }
    }
  }
  return shuffle(cards).map((c) => ({ type: 'item', def: c.def, owned: c.owned, tier: rollTier(luck, minTier) }));
}
