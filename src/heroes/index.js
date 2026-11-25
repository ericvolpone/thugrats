import { LENNY_ABILITIES } from './lenny/abilities.js';
import { LENNY_TALENTS, LENNY_TREES } from './lenny/talents.js';
import { LENNY_GEAR } from './lenny/gear.js';
import { TONY_ABILITIES } from './tony/abilities.js';
import { TONY_TALENTS, TONY_TREES } from './tony/talents.js';
import { TONY_GEAR } from './tony/gear.js';
import { BOOM_ABILITIES } from './boom/abilities.js';
import { BOOM_TALENTS, BOOM_TREES } from './boom/talents.js';
import { BOOM_GEAR } from './boom/gear.js';
import { GHOST_ABILITIES } from './ghost/abilities.js';
import { GHOST_TALENTS, GHOST_TREES } from './ghost/talents.js';
import { GHOST_GEAR } from './ghost/gear.js';
import { BABYFACE_ABILITIES } from './babyface/abilities.js';
import { BABYFACE_TALENTS, BABYFACE_TREES } from './babyface/talents.js';
import { BABYFACE_GEAR } from './babyface/gear.js';
import { PROF_ABILITIES } from './prof/abilities.js';
import { PROF_TALENTS, PROF_TREES } from './prof/talents.js';
import { PROF_GEAR } from './prof/gear.js';
import { SHARED_GEAR } from '../data/gear.js';
import { registerHero } from '../assets/models.js';
import { buildBaby } from '../assets/baby.js';

/**
 * Hero roster. Each hero: model look, base stats, the starting ability, the
 * full ability pool (a run can hold 5), three talent trees and gear (three
 * signature pieces, one per map, plus the shared pieces in data/gear.js).
 */
export const BASE_STATS = {
  maxHp: 100, regen: 0.4, armor: 0, speed: 6.4, pickup: 4, crit: 0.05, critDmg: 0.5,
  luck: 0, haste: 0, area: 0, duration: 0, dmg: 1, xpGain: 1, goldGain: 1, dodge: 0,
  projectiles: 0, bigDmg: 0, burnDmg: 0, fearRadius: 0, chestRate: 1, rerolls: 2,
  chestDiscount: 0, startGold: 0, pickupPct: 0, speedPct: 0, frenzyArmor: 0,
};

export const HEROES = [
  {
    id: 'lenny', icon: '🎩', name: 'Lenny "Nickles"', title: 'The Mobster',
    blurb: 'Eighteen months old, runs half of Mulberry Street. Never seen without his fedora, his cigar or his .38.',
    look: { hat: 'fedora', mouth: 'cigar', prop: 'pistol', chain: true, hatColor: '#2b2b33', band: '#111' },
    stats: { maxHp: 120 }, start: 'pistol',
    abilities: LENNY_ABILITIES, talents: LENNY_TALENTS, trees: LENNY_TREES, gear: LENNY_GEAR,
  },
  {
    id: 'tony', icon: '🥊', name: 'Tiny Tony Two-Fists', title: 'The Brute',
    blurb: 'Biggest baby in the nursery. Settles every argument the same way. Bruiser, tank, menace.',
    look: { hat: 'beanie', hatColor: '#6b1f1f', band: '#3a0f0f', mouth: 'pacifier', pacifier: '#d8302a', prop: 'none', shirt: '#f4f1ea', gloves: '#d8302a', skin: '#e8b48f', scale: 1.12 },
    stats: { maxHp: 165, armor: 0.08, speed: 6.0, regen: 0.8 }, start: 'haymaker',
    abilities: TONY_ABILITIES, talents: TONY_TALENTS, trees: TONY_TREES, gear: TONY_GEAR,
  },
  {
    id: 'boom', icon: '🧨', name: 'Boom-Boom Bianchi', title: 'Demolitions',
    blurb: 'Lost his eyebrows twice before he could walk. Believes every problem has an explosive solution.',
    look: { hat: 'hardhat', hatColor: '#f2c037', band: '#c8a020', mouth: 'none', prop: 'dynamite', vest: '#5a6a3a', goggles: '#9ad8ff', skin: '#f0c09a' },
    stats: { maxHp: 110, area: 0.05 }, start: 'dynamite_stick',
    abilities: BOOM_ABILITIES, talents: BOOM_TALENTS, trees: BOOM_TREES, gear: BOOM_GEAR,
  },
  {
    id: 'ghost', icon: '🕶️', name: 'Lucy "The Ghost"', title: 'The Spy',
    blurb: 'Nobody has ever seen her leave the crib. Nobody has ever seen her in it either.',
    look: { hat: 'beret', hatColor: '#141418', band: '#141418', mouth: 'none', prop: 'silencer', shirt: '#24242c', mask: '#101014', skin: '#f6d0b4' },
    stats: { maxHp: 95, speed: 6.9, crit: 0.1, dodge: 0.05 }, start: 'silenced',
    abilities: GHOST_ABILITIES, talents: GHOST_TALENTS, trees: GHOST_TREES, gear: GHOST_GEAR,
  },
  {
    id: 'babyface', icon: '🔭', name: 'Babyface Moretti', title: 'The Hitman',
    blurb: 'Takes the contract, takes the nap, takes the shot. In that order.',
    look: { hat: 'fedora', hatColor: '#e8e4da', band: '#901818', mouth: 'pacifier', pacifier: '#901818', prop: 'rifle', shirt: '#2a2a32', shades: '#111' },
    stats: { maxHp: 105, critDmg: 0.75 }, start: 'rifle',
    abilities: BABYFACE_ABILITIES, talents: BABYFACE_TALENTS, trees: BABYFACE_TREES, gear: BABYFACE_GEAR,
  },
  {
    id: 'prof', icon: '🧠', name: 'Professor Pudding', title: 'The Mastermind',
    blurb: 'Skipped walking and went straight to particle physics. The pudding is load-bearing.',
    look: { hat: 'brain', hatColor: '#f2a6b8', band: '#d98098', mouth: 'pacifier', pacifier: '#5af', prop: 'raygun', vest: '#e8e8f0', glasses: '#222', skin: '#f2c3a0' },
    stats: { maxHp: 100, haste: 0.05 }, start: 'pudding_blaster',
    abilities: PROF_ABILITIES, talents: PROF_TALENTS, trees: PROF_TREES, gear: PROF_GEAR,
  },
];

for (const h of HEROES) {
  h.model = h.id;
  h.gear = [...h.gear, ...SHARED_GEAR];
  registerHero(h.id, (o) => buildBaby({ ...h.look, ...o }));
}

// summons
registerHero('goon', (o) => buildBaby({ hat: 'beanie', hatColor: '#3a3a3a', band: '#222', prop: 'bat', mouth: 'pacifier', pacifier: '#333', shirt: '#e8e8e8', skin: '#e8b48f', ...o }));
registerHero('tony_bro', (o) => buildBaby({ hat: 'beanie', hatColor: '#1f3f6b', band: '#0f1f3a', mouth: 'pacifier', pacifier: '#58c4ff', prop: 'none', gloves: '#2f6fd8', skin: '#e8b48f', scale: 0.85, ...o }));
registerHero('babyface_double', (o) => buildBaby({ hat: 'fedora', hatColor: '#3a3a40', band: '#901818', mouth: 'none', prop: 'pistol', shirt: '#2a2a32', shades: '#111', ...o }));
registerHero('robot', (o) => buildBaby({ hat: 'cap', hatColor: '#9aa4b4', band: '#5a6474', mouth: 'none', prop: 'raygun', skin: '#b8c0cc', cheek: '#9ad8ff', diaper: '#7a8494', glasses: '#58c4ff', scale: 0.9, ...o }));

export const heroById = (id) => HEROES.find((h) => h.id === id);
