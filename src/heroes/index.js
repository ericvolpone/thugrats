import { LENNY_ABILITIES, LENNY_START, LENNY_RESOURCE, LENNY_SIGNATURE, LENNY_OVERVIEW } from './lenny/abilities.js';
import { LENNY_TALENTS, LENNY_TREES } from './lenny/talents.js';
import { LENNY_GEAR } from './lenny/gear.js';
import { TONY_ABILITIES, TONY_START, TONY_RESOURCE, TONY_SIGNATURE, TONY_OVERVIEW } from './tony/abilities.js';
import { TONY_TALENTS, TONY_TREES } from './tony/talents.js';
import { TONY_GEAR } from './tony/gear.js';
import { BOOM_ABILITIES, BOOM_START, BOOM_RESOURCE, BOOM_SIGNATURE, BOOM_OVERVIEW } from './boom/abilities.js';
import { BOOM_TALENTS, BOOM_TREES } from './boom/talents.js';
import { BOOM_GEAR } from './boom/gear.js';
import { GHOST_ABILITIES, GHOST_START, GHOST_RESOURCE, GHOST_SIGNATURE, GHOST_OVERVIEW } from './ghost/abilities.js';
import { GHOST_TALENTS, GHOST_TREES } from './ghost/talents.js';
import { GHOST_GEAR } from './ghost/gear.js';
import { BABYFACE_ABILITIES, BABYFACE_START, BABYFACE_RESOURCE, BABYFACE_SIGNATURE, BABYFACE_OVERVIEW } from './babyface/abilities.js';
import { BABYFACE_TALENTS, BABYFACE_TREES } from './babyface/talents.js';
import { BABYFACE_GEAR } from './babyface/gear.js';
import { PROF_ABILITIES, PROF_START, PROF_RESOURCE, PROF_SIGNATURE, PROF_OVERVIEW } from './prof/abilities.js';
import { PROF_TALENTS, PROF_TREES } from './prof/talents.js';
import { PROF_GEAR } from './prof/gear.js';
import { expandSets } from '../data/gear.js';
import { buildContraband } from '../data/contraband.js';
import { registerHero } from '../assets/models.js';
import { buildBaby } from '../assets/baby.js';

/**
 * Hero roster. Each hero: model look, base stats, the starting ability, the
 * full ability pool (a run can hold 5), three talent trees and five gear sets
 * (one per map, see data/gear.js).
 */
export const BASE_STATS = {
  maxHp: 100, regen: 0.4, armor: 0, speed: 6.4, pickup: 4, crit: 0.05, critDmg: 0.5,
  luck: 0, haste: 0, area: 0, duration: 0, dmg: 1, xpGain: 1, goldGain: 1, dodge: 0,
  projectiles: 0, bigDmg: 0, burnDmg: 0, fearRadius: 0, chestRate: 1, rerolls: 2,
  chestDiscount: 0, startGold: 0, pickupPct: 0, speedPct: 0, frenzyArmor: 0,
  // lifesteal: fraction of damage dealt that heals you (all hits / melee / crits / auras; capped at 6% max HP per second)
  lifesteal: 0, meleeLeech: 0, critLeech: 0, auraLeech: 0, frenzyLeech: 0,
  // ability-kind Crime Title effects
  // item quirks: fear damage / slow, damage per 100 max HP, overflow healing → shield
  fearDmg: 0, fearSlow: 0, hpDmg: 0, overshield: 0,
  projBurst: 0, blastArea: 0, blastBurn: 0, burnVuln: 0, ctrlDmg: 0, nitro: 0, trapRoot: 0, extraJumps: 0, execHeal: 0,
};

export const HEROES = [
  {
    id: 'lenny', icon: '🎩', name: 'Lenny "Nickles"', title: 'The Boss',
    blurb: 'Eighteen months old, runs half of Mulberry Street. Every coin in his pocket is a favour owed: the richer he gets, the harder his crew hits.',
    look: { hat: 'fedora', mouth: 'cigar', prop: 'pistol', chain: true, hatColor: '#2b2b33', band: '#111', suspenders: '#2b2b33', scar: true, watch: '#f2c037', shoes: '#2a2a2e', soles: '#f4f1ea', hair: '#2a1a10' },
    stats: { maxHp: 120 }, start: LENNY_START, resource: LENNY_RESOURCE, signature: LENNY_SIGNATURE, overview: LENNY_OVERVIEW,
    abilities: LENNY_ABILITIES, talents: LENNY_TALENTS, trees: LENNY_TREES, gear: LENNY_GEAR,
  },
  {
    id: 'tony', icon: '🥊', name: 'Tiny Tony Two-Fists', title: 'The Brawler',
    blurb: 'Biggest baby in the nursery. No guns, ever: just fists, chairs, headlocks and a temper. The madder he gets, the harder he hits.',
    look: { hat: 'beanie', hatColor: '#6b1f1f', band: '#3a0f0f', mouth: 'pacifier', pacifier: '#d8302a', prop: 'none', shirt: '#f4f1ea', gloves: '#d8302a', skin: '#e8b48f', scale: 1.12, belt: '#c8281e', shoes: '#d8302a', freckles: true, tabs: '#d8302a' },
    stats: { maxHp: 165, armor: 0.08, speed: 6.0, regen: 0.8 }, start: TONY_START, resource: TONY_RESOURCE, signature: TONY_SIGNATURE, overview: TONY_OVERVIEW,
    abilities: TONY_ABILITIES, talents: TONY_TALENTS, trees: TONY_TREES, gear: TONY_GEAR,
  },
  {
    id: 'boom', icon: '🧨', name: 'Boom-Boom Bianchi', title: 'The Fuse',
    blurb: 'Lost his eyebrows twice before he could walk. Nothing he lights goes off alone: every bang sets off the next one.',
    look: { hat: 'hardhat', hatColor: '#f2c037', band: '#c8a020', mouth: 'none', prop: 'dynamite', vest: '#5a6a3a', goggles: '#9ad8ff', skin: '#f0c09a', bandolier: '#5a3a22', shoes: '#6b4a2a', soles: '#3a2a1a', hair: '#c8601e', freckles: true, tabs: '#f2c037' },
    stats: { maxHp: 110, area: 0.05 }, start: BOOM_START, resource: BOOM_RESOURCE, signature: BOOM_SIGNATURE, overview: BOOM_OVERVIEW,
    abilities: BOOM_ABILITIES, talents: BOOM_TALENTS, trees: BOOM_TREES, gear: BOOM_GEAR,
  },
  {
    id: 'ghost', icon: '🕶️', name: 'Lucy "The Ghost"', title: 'The Assassin',
    blurb: 'Nobody has ever seen her leave the crib. The thugs she Marks never see her at all.',
    look: { hat: 'beret', hatColor: '#141418', band: '#141418', mouth: 'none', prop: 'silencer', shirt: '#24242c', mask: '#101014', skin: '#f6d0b4', shoes: '#101014', soles: '#101014', belt: '#2a2a30', pin: '#c8c8d0', buttons: '#3a3a44', hair: '#101014', tabs: '#24242c' },
    stats: { maxHp: 95, speed: 6.9, crit: 0.1, dodge: 0.05 }, start: GHOST_START, resource: GHOST_RESOURCE, signature: GHOST_SIGNATURE, overview: GHOST_OVERVIEW,
    abilities: GHOST_ABILITIES, talents: GHOST_TALENTS, trees: GHOST_TREES, gear: GHOST_GEAR,
  },
  {
    id: 'babyface', icon: '🔭', name: 'Babyface Moretti', title: 'The Professional',
    blurb: 'Never flinches, never misses twice. Waits for the moment, finds the weak spot, takes one shot. Then a second, to be sure.',
    look: { hat: 'fedora', hatColor: '#e8e4da', band: '#901818', mouth: 'pacifier', pacifier: '#901818', prop: 'rifle', shirt: '#2a2a32', shades: '#111', tie: '#901818', collar: '#f4f1ea', shoes: '#e8e4da', soles: '#2a2a32', feather: '#901818', watch: '#d8d8d8', hair: '#3a2a1a' },
    stats: { maxHp: 105, critDmg: 0.75 }, start: BABYFACE_START, resource: BABYFACE_RESOURCE, signature: BABYFACE_SIGNATURE, overview: BABYFACE_OVERVIEW,
    abilities: BABYFACE_ABILITIES, talents: BABYFACE_TALENTS, trees: BABYFACE_TREES, gear: BABYFACE_GEAR,
  },
  {
    id: 'prof', icon: '🧠', name: 'Professor Pudding', title: 'The Mad Scientist',
    blurb: 'Shock it, freeze it, melt it, shrink it, then watch what happens when they mix. The pudding is load-bearing.',
    look: { hat: 'brain', hatColor: '#f2a6b8', band: '#d98098', mouth: 'pacifier', pacifier: '#5af', prop: 'raygun', vest: '#e8e8f0', glasses: '#222', skin: '#f2c3a0', tie: '#55aaff', shoes: '#e8e8f0', soles: '#55aaff', freckles: true, eyes: '#2a5a9a', tabs: '#ff8fd0' },
    stats: { maxHp: 100, haste: 0.05 }, start: PROF_START, resource: PROF_RESOURCE, signature: PROF_SIGNATURE, overview: PROF_OVERVIEW,
    abilities: PROF_ABILITIES, talents: PROF_TALENTS, trees: PROF_TREES, gear: PROF_GEAR,
  },
];

for (const h of HEROES) {
  h.model = h.id;
  h.sets = expandSets(h.gear); // one 5-piece set per map (heroes/<id>/gear.js)
  h.contraband = buildContraband(h); // one supercharge per ability (data/contraband.js)
  h.pieces = h.sets.flatMap((s) => s.pieceList);
  registerHero(h.id, (o) => buildBaby({ ...h.look, ...o }));
}

// summons
registerHero('goon', (o) => buildBaby({ hat: 'beanie', hatColor: '#3a3a3a', band: '#222', prop: 'bat', mouth: 'pacifier', pacifier: '#333', shirt: '#e8e8e8', skin: '#e8b48f', ...o }));
registerHero('tony_bro', (o) => buildBaby({ hat: 'beanie', hatColor: '#1f3f6b', band: '#0f1f3a', mouth: 'pacifier', pacifier: '#58c4ff', prop: 'none', gloves: '#2f6fd8', skin: '#e8b48f', scale: 0.85, ...o }));
registerHero('babyface_double', (o) => buildBaby({ hat: 'fedora', hatColor: '#3a3a40', band: '#901818', mouth: 'none', prop: 'pistol', shirt: '#2a2a32', shades: '#111', ...o }));
registerHero('robot', (o) => buildBaby({ hat: 'cap', hatColor: '#9aa4b4', band: '#5a6474', mouth: 'none', prop: 'raygun', skin: '#b8c0cc', cheek: '#9ad8ff', diaper: '#7a8494', glasses: '#58c4ff', scale: 0.9, ...o }));

export const heroById = (id) => HEROES.find((h) => h.id === id);
