import { LENNY_ABILITIES } from './lenny/abilities.js';
import { LENNY_TALENTS, LENNY_TREES } from './lenny/talents.js';
import { LENNY_GEAR } from './lenny/gear.js';
import { registerHero } from '../assets/models.js';
import { buildBaby } from '../assets/baby.js';

/**
 * Hero roster. Each hero: model options, base stats, the starting ability, the
 * full ability pool (a run can hold 5), a talent tree and per-map gear.
 * Locked heroes are teasers for the roster screen.
 */
export const BASE_STATS = {
  maxHp: 100, regen: 0.4, armor: 0, speed: 6.4, pickup: 4, crit: 0.05, critDmg: 0.5,
  luck: 0, haste: 0, area: 0, duration: 0, dmg: 1, xpGain: 1, goldGain: 1, dodge: 0,
  projectiles: 0, bigDmg: 0, burnDmg: 0, fearRadius: 0, chestRate: 1, rerolls: 2,
  chestDiscount: 0, startGold: 0, pickupPct: 0, speedPct: 0, frenzyArmor: 0,
};

const lennyLook = { hat: 'fedora', mouth: 'cigar', prop: 'pistol', chain: true, hatColor: '#2b2b33', band: '#111' };
registerHero('lenny', (o) => buildBaby({ ...lennyLook, ...o }));
registerHero('goon', (o) => buildBaby({ hat: 'beanie', hatColor: '#3a3a3a', band: '#222', prop: 'bat', mouth: 'pacifier', pacifier: '#333', shirt: '#e8e8e8', skin: '#e8b48f', ...o }));

export const HEROES = [
  {
    id: 'lenny', name: 'Lenny "Nickles"', title: 'The Mobster',
    blurb: 'Eighteen months old, runs half of Mulberry Street. Never seen without his fedora, his cigar or his .38.',
    model: 'lenny', stats: { maxHp: 120 }, start: 'pistol',
    abilities: LENNY_ABILITIES, talents: LENNY_TALENTS, trees: LENNY_TREES, gear: LENNY_GEAR,
  },
  // ── teasers ──
  { id: 'tony', name: 'Tiny Tony Two-Fists', title: 'The Brute', locked: true, look: { hat: 'beanie', hatColor: '#6b1f1f', mouth: 'pacifier', prop: 'none', shirt: '#ffffff' } },
  { id: 'boom', name: 'Boom-Boom Bianchi', title: 'Demolitions', locked: true, look: { hat: 'cap', hatColor: '#c8a020', mouth: 'none', prop: 'none', vest: '#5a6a3a' } },
  { id: 'ghost', name: 'Lucy "The Ghost"', title: 'The Spy', locked: true, look: { hat: 'beanie', hatColor: '#111', mouth: 'none', prop: 'none', shirt: '#222' } },
  { id: 'babyface', name: 'Babyface Moretti', title: 'The Hitman', locked: true, look: { hat: 'fedora', hatColor: '#ddd', band: '#900', mouth: 'pacifier', pacifier: '#900', prop: 'pistol' } },
  { id: 'prof', name: 'Professor Pudding', title: 'The Mastermind', locked: true, look: { hat: 'none', mouth: 'pacifier', pacifier: '#5af', prop: 'none', vest: '#5a3a6a' } },
];
for (const h of HEROES) if (h.locked) registerHero(h.id, (o) => buildBaby({ ...h.look, ...o }));

export const heroById = (id) => HEROES.find((h) => h.id === id);
