import { boltFrom } from '../common.js';

/**
 * Lucy's gear sets: one per map, dropped by that map's Crime Titans (see
 * data/gear.js). Bonuses at 2 / 3 / 5 pieces worn; k (×1 → ×2) grows with the
 * average tier of the pieces you wear from the set. The 5-piece behaviours are
 * flags read in ghost/abilities.js (execChain, trapRearm, knifeReturn,
 * cloakOutCrit, and the Mark flags cashCd / trapMarks in talents.js) or links
 * (Fun House Mirror). Shadow Clan's Cloak hooks also fire on Vanish's Cloak.
 */
const r = (v) => Math.round(v);

export const GHOST_GEAR = [
  {
    id: 'ghost_back_alley', map: 'little_italy', name: 'Back Alley', icon: '🧶', focus: 'garrote', focusName: 'Garrote',
    pieces: ['Alley Cat Beanie', 'Fingerless Mittens', 'Checkered Napkin Bib', 'Cellar Door Diaper', 'Cobblestone Booties'],
    bonus: {
      2: { desc: (k) => `Garrote +${r(25 * k)}% Recharge Rate and +${r(20 * k)}% reach.`,
        apply: (c, k) => { c.abil('garrote', 'cooldown', 'pct', 25 * k); c.abil('garrote', 'range', 'pct', 20 * k); } },
      3: { desc: () => 'Garrote executes 5% higher and every execute heals 4 HP. Each Mark cashed in takes 0.15s off that ability\'s cooldown.',
        apply: (c) => { c.abil('garrote', 'execute', 'add', 0.05); c.stat('execHeal', 4); c.flagAdd('cashCd', 0.15); } },
      5: { desc: (k) => `Executes chain: a Garrote execute slips on to up to ${r(1 + k)} more thugs in reach under the execute line (their Marks count) and executes them too.`,
        apply: (c, k) => c.flag('execChain', r(1 + k)) },
    },
  },
  {
    id: 'ghost_smuggler', map: 'the_docks', name: 'Smuggler', icon: '📦', focus: '#trap', focusName: 'Traps',
    pieces: ['Contraband Watch Cap', 'Rope-Burn Mittens', 'Life-Vest Bib', 'Bilge Diaper', 'Gumboot Booties'],
    bonus: {
      2: { desc: (k) => `Traps (Tripwire, Caltrops) +${r(25 * k)}% area and +${r(20 * k)}% duration.`,
        apply: (c, k) => { c.abil('#trap', 'area', 'pct', 25 * k); c.abil('#trap', 'duration', 'pct', 20 * k); } },
      3: { desc: () => 'Tripwires arm instantly and spring from 50% farther away. +1 Tripwire. Traps leave one more Mark each time they Mark a thug.',
        apply: (c) => { c.flag('quickTraps', 1.5); c.abil('tripwire', 'count', 'add', 1); c.flagAdd('trapMarks', 1); } },
      5: { desc: (k) => `Traps re-arm once: a sprung Tripwire strings itself again and spent Caltrops re-scatter, the second time for +${r(50 * k)}% damage.`,
        apply: (c, k) => c.flag('trapRearm', 0.5 * k) },
    },
  },
  {
    id: 'ghost_card_sharp', map: 'casino_row', name: 'Card Sharp', icon: '🃏', focus: 'knives', focusName: 'Throwing Knives',
    pieces: ["Dealer's Visor", 'Sleight-of-Hand Mittens', 'Poker Face Bib', 'Stacked Deck Diaper', 'Shuffle Booties'],
    bonus: {
      2: { desc: (k) => `Throwing Knives +${r(2 * k)} knives and +${r(15 * k)}% Recharge Rate. Shuriken Ring +1 star.`,
        apply: (c, k) => { c.abil('knives', 'count', 'add', r(2 * k)); c.abil('knives', 'cooldown', 'pct', 15 * k); c.abil('shuriken', 'count', 'add', 1); } },
      3: { desc: () => 'Throwing Knives +1 pierce. Knife and Shuriken crits slice every thug within 2 for 35% of the hit.',
        apply: (c) => {
          c.abil('knives', 'pierce', 'add', 1);
          const slice = (run, p, ev) => {
            for (const m of run.mobs.near(ev.x, ev.z, 2)) if (m !== ev.m) run.hit(m, ev.dmg * 0.35, ev.src, { noCrit: true, knock: 0.5, fromX: ev.x, fromZ: ev.z });
            run.fx.ring(ev.x, ev.z, 2, '#dfe6ee', 0.2);
          };
          c.link('knives', null, 'crit', 1, slice, { icd: 0.1 });
          c.link('shuriken', null, 'crit', 1, slice, { icd: 0.2 });
        } },
      5: { desc: (k) => `Boomerang knives: Throwing Knives fly back to you at the end of their throw, hitting everything again for ${r(60 * k)}% damage.`,
        apply: (c, k) => c.flag('knifeReturn', 0.6 * k) },
    },
  },
  {
    id: 'ghost_shadow_clan', map: 'chinatown', name: 'Shadow Clan', icon: '🥷', focus: '#buff', focusName: 'Cloak & Smoke', focusStat: 'duration',
    pieces: ['Night Silk Hood', 'Shadow-Wrap Mittens', 'Lantern Silk Bib', 'Midnight Diaper', 'Split-Toe Tabi Booties'],
    bonus: {
      2: { desc: (k) => `Cloak and Smoke Bomb last +${r(25 * k)}% longer and recharge +${r(10 * k)}% faster.`,
        apply: (c, k) => { c.abil('#buff', 'duration', 'pct', 25 * k); c.abil('#buff', 'cooldown', 'pct', 10 * k); } },
      3: { desc: () => 'Smoke Bomb also wraps you in a 2s Cloak (needs Cloak in the run; extends one already up).',
        apply: (c) => c.link('smoke', 'cloak', 'fire', 1, (run, p) => p.def.wrap(run, p, 2), { icd: 0 }) },
      5: { desc: (k) => `Strike from nowhere: for ${(1 + k).toFixed(1)}s after Cloak ends, every hit you land is a crit (Vanish's Cloak counts).`,
        apply: (c, k) => c.flag('cloakOutCrit', 1 + k) },
    },
  },
  {
    id: 'ghost_fun_house', map: 'coney_island', name: 'Fun House Mirror', icon: '🪞', focus: 'decoy', focusName: 'Cardboard Decoy',
    pieces: ['Fun House Wig', 'Puppet-String Mittens', 'Mirror-Shard Bib', 'Hall-of-Mirrors Diaper', 'Squeaky Clown Booties'],
    bonus: {
      2: { desc: (k) => `Cardboard Decoy +${r(30 * k)}% duration, +${r(25 * k)}% blast area and +${r(15 * k)}% Recharge Rate.`,
        apply: (c, k) => { c.abil('decoy', 'duration', 'pct', 30 * k); c.abil('decoy', 'area', 'pct', 25 * k); c.abil('decoy', 'cooldown', 'pct', 15 * k); } },
      3: { desc: () => 'Thugs within 4 of a Decoy are distracted and take +20% damage.',
        apply: (c) => c.amp((run, m) => {
          if (m.tier >= 2) return 0;
          for (const d of run.combat.decoys) if ((m.x - d.x) ** 2 + (m.z - d.z) ** 2 < 16) return 0.2;
          return 0;
        }) },
      5: { desc: (k) => `Mirror images: whenever a projectile ability fires (Knives, Darts), every Decoy fires a copy at the nearest thug for ${r(50 * k)}% of its damage.`,
        apply: (c, k) => c.link('#projectile', null, 'fire', 1, (run, p, ev) => {
          const a = ev.src;
          for (const d of run.combat.decoys) boltFrom(run, a, d.x, d.z, { dmg: a.stat('damage') * 0.5 * k, range: 10, color: '#ffd98a' });
        }, { icd: 0.15 }) },
    },
  },
];
