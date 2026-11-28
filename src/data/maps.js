/**
 * Maps. A map is won by killing its final titan; titans are summoned at their
 * altar once their conditions are met. Bosses spawn on a timer at one of the
 * boss spawn points. After `duration` seconds the Feds arrive (enrage).
 *
 * Titan conditions (all must hold):
 *   { level: n }   reach level n        { gold: n }   pay n gold (bribe, consumed)
 *   { bosses: n }  kill n bosses        { titans: n } kill the other n titans
 */
/**
 * Difficulties. hp / dmg scale the thugs, spawn their numbers, heroXp the hero XP
 * you bank, gear the Crime Titans' set-piece drop chance (TITAN_DROPS × gear).
 * The top tiers add rules (all optional, default 1 / off):
 *   speed   thug move speed ×        heal   all your healing × (regen, lifesteal, pickups)
 *   elite   elite chance ×           boss   boss timer × (lower = sooner)
 *   feds    minutes before the Feds  blast  elites (and some thugs) drop a live grenade when they die
 * `rules` is the list shown on the difficulty button.
 */
export const DIFFICULTIES = [
  { id: 'normal', name: 'Normal', hp: 1, dmg: 1, spawn: 1, heroXp: 1, gear: 1, color: '#7fd67f', rules: [] },
  { id: 'hard', name: 'Hard', hp: 1.9, dmg: 1.5, spawn: 1.15, heroXp: 1.6, gear: 1.5, color: '#ffb347', rules: [] },
  { id: 'nightmare', name: 'Nightmare', hp: 3.4, dmg: 2.2, spawn: 1.3, heroXp: 2.4, gear: 2, speed: 1.05, elite: 1.5, color: '#ff5c5c',
    rules: ['Thugs 5% faster', '50% more elites'] },
  { id: 'vendetta', name: 'Vendetta', hp: 6, dmg: 3.2, spawn: 1.5, heroXp: 3.6, gear: 2.5, speed: 1.12, heal: 0.6, elite: 2.2, boss: 0.8, blast: 1, color: '#c06cff',
    rules: ['Thugs 12% faster', 'Healing −40%', '2.2× elites', 'Bosses 20% sooner', 'Elites drop a live grenade when they die'] },
  { id: 'inferno', name: 'Inferno', hp: 10, dmg: 4.5, spawn: 1.75, heroXp: 5, gear: 3, speed: 1.2, heal: 0.4, elite: 3, boss: 0.65, feds: 10, blast: 2, color: '#ff3b8a',
    rules: ['Thugs 20% faster', 'Healing −60%', '3× elites', 'Bosses 35% sooner', 'Feds at 10:00', 'Elites and 1 in 12 thugs drop live grenades'] },
];

export const MAPS = [
  {
    id: 'little_italy',
    spawn: [0, 13],
    name: 'Little Italy',
    blurb: 'Back alleys, red sauce and a whole precinct that wants you in time-out.',
    theme: {
      ground: '#5e5650', street: '#3a3a42', line: '#e8d26a', sidewalk: '#8b8680',
      buildings: ['#8a3b2e', '#a0522d', '#6e3b2f', '#9b6b4a', '#7a2e2a'],
      sky: '#1b1424', fog: '#2a1f33', hemi: ['#ffdcb0', '#40304a'], sun: '#ffd8a8',
      props: ['dumpster', 'trashcan', 'hydrant', 'lamp', 'bench', 'car', 'crate'],
    },
    roster: [
      { mob: 'rat', from: 0, w: 10 },
      { mob: 'mallcop', from: 0.5, w: 7 },
      { mob: 'k9', from: 2, w: 5 },
      { mob: 'nanny', from: 3, w: 4 },
      { mob: 'crossing_guard', from: 4, w: 3 },
      { mob: 'riot_cop', from: 7, w: 2.5 },
    ],
    bosses: ['officer_donut'],
    titans: [
      { boss: 'lunch_lady', pos: [-55, -46], cond: { level: 12 } },
      { boss: 'detective', pos: [55, -46], cond: { gold: 300 } },
      { boss: 'commissioner', pos: [0, 60], cond: { titans: 2, level: 20 } },
    ],
    bossSpawns: [[-27, -12], [27, 14], [0, -38], [-22, 48]],
  },
  {
    id: 'the_docks',
    name: 'The Docks',
    blurb: 'Fog, shipping containers and seagulls with a grudge.',
    requires: 'little_italy',
    theme: {
      ground: '#4d5560', street: '#3c434c', line: '#f2f2f2', sidewalk: '#6d7884', water: '#1b3f5c',
      buildings: ['#5c6f7e', '#7a6a58', '#4f5d6b', '#6b5444'],
      sky: '#152030', fog: '#24364a', hemi: ['#cfe6ff', '#24303d'], sun: '#dbe9ff',
      props: ['container', 'barrel', 'crate', 'bollard', 'lamp', 'crate'],
    },
    roster: [
      { mob: 'seagull', from: 0, w: 10 },
      { mob: 'harbor_cop', from: 0.5, w: 7 },
      { mob: 'rat', from: 1.5, w: 5 },
      { mob: 'customs_agent', from: 2.5, w: 4 },
      { mob: 'dockworker', from: 4, w: 3 },
      { mob: 'k9', from: 6, w: 3 },
    ],
    bosses: ['harbor_master'],
    titans: [
      { boss: 'big_tuna', pos: [-56, -48], cond: { bosses: 1 } },
      { boss: 'customs_chief', pos: [58, -50], cond: { gold: 350 } },
      { boss: 'admiral', pos: [24, 70], cond: { titans: 2, level: 22 } },
    ],
    bossSpawns: [[-8, -16], [44, -16], [-35, 36], [12, -48]],
  },
  {
    id: 'casino_row',
    name: 'Casino Row',
    blurb: 'Neon, slot machines and a house that always wins. Until now.',
    requires: 'the_docks',
    theme: {
      ground: '#2e2436', street: '#241c2c', line: '#ff4fd8', sidewalk: '#5a4a66',
      buildings: ['#3b1d4a', '#1d2e4a', '#4a1d2e', '#2a2a2a'], windows: '#ff8af0',
      sky: '#120a1c', fog: '#2a1240', hemi: ['#ffc8ff', '#2a1a40'], sun: '#ffd0f0',
      props: ['slot', 'palm', 'lamp', 'bench', 'car', 'trashcan'],
    },
    roster: [
      { mob: 'pigeon', from: 0, w: 9 },
      { mob: 'security', from: 0.5, w: 7 },
      { mob: 'dealer', from: 2, w: 4 },
      { mob: 'rat', from: 3, w: 4 },
      { mob: 'bouncer', from: 4, w: 3 },
      { mob: 'riot_cop', from: 7, w: 2 },
    ],
    bosses: ['floor_manager'],
    titans: [
      { boss: 'dealer_supreme', pos: [-56, 66], cond: { gold: 400 } },
      { boss: 'the_king', pos: [58, -26], cond: { level: 16 } },
      { boss: 'big_lou', pos: [0, 64], cond: { titans: 2, bosses: 2 } },
    ],
    bossSpawns: [[-24, 18], [24, -24], [0, -52], [26, 36]],
  },
  {
    id: 'chinatown',
    spawn: [0, 4],
    name: 'Chinatown',
    blurb: 'Lantern-lit alleys, a night market and a parade dragon that has had enough.',
    requires: 'little_italy',
    theme: {
      ground: '#4a3a36', street: '#2e2a2c', line: '#f2c037', sidewalk: '#7a6a62',
      buildings: ['#8a2a22', '#6a3a2a', '#3a4a3a', '#7a5a3a', '#5a2a2a'], windows: '#ffb070',
      sky: '#1a0c10', fog: '#3a1418', hemi: ['#ffd0a0', '#3a1a1a'], sun: '#ffc890',
      props: ['crate', 'barrel', 'trashcan', 'lamp', 'bonsai'],
    },
    roster: [
      { mob: 'alley_cat', from: 0, w: 10 },
      { mob: 'health_inspector', from: 0.5, w: 7 },
      { mob: 'tourist', from: 2, w: 4 },
      { mob: 'rat', from: 3, w: 4 },
      { mob: 'line_cook', from: 4, w: 3 },
      { mob: 'riot_cop', from: 7, w: 2 },
    ],
    bosses: ['maitre_d'],
    titans: [
      { boss: 'food_critic', pos: [-58, 58], cond: { level: 14 } },
      { boss: 'landlord', pos: [58, 58], cond: { gold: 350 } },
      { boss: 'parade_dragon', pos: [0, -60], cond: { titans: 2, level: 21 } },
    ],
    bossSpawns: [[-30, -20], [30, -20], [0, 36], [-44, 22]],
  },
  {
    id: 'coney_island',
    spawn: [0, -8],
    name: 'Coney Island',
    blurb: 'Boardwalk, rides and a beach full of people who want you off it.',
    requires: 'the_docks',
    theme: {
      ground: '#6a6a60', street: '#7a5a3a', line: '#f2e0b0', sidewalk: '#a08060', water: '#1f6a8a',
      buildings: ['#e0e0d0', '#c84a3a', '#3a7aa8', '#e8c050', '#5aa06a'], windows: '#ffe0a0',
      sky: '#3a5a8a', fog: '#7a9ab8', hemi: ['#fff0d0', '#5a6a7a'], sun: '#fff4d8',
      props: ['umbrella', 'trashcan', 'bench', 'lamp', 'booth'],
    },
    roster: [
      { mob: 'seagull', from: 0, w: 10 },
      { mob: 'lifeguard', from: 0.5, w: 7 },
      { mob: 'beach_cop', from: 1.5, w: 5 },
      { mob: 'clown', from: 2.5, w: 4 },
      { mob: 'mascot', from: 4, w: 3 },
      { mob: 'k9', from: 6, w: 3 },
    ],
    bosses: ['ringmaster'],
    titans: [
      { boss: 'strongman', pos: [-60, -56], cond: { bosses: 1 } },
      { boss: 'fortune_teller', pos: [60, -56], cond: { level: 16 } },
      { boss: 'captain_coney', pos: [0, 50], cond: { titans: 2, gold: 300 } },
    ],
    bossSpawns: [[-34, -22], [34, -22], [-40, 30], [40, 30]],
  },
];

export const MAP_DEFAULTS = {
  half: 80, // arena is 160 x 160
  duration: 12 * 60, // seconds before the Feds arrive
  bossEvery: 150,
  firstBoss: 150,
  chestEvery: [35, 55],
};

export const mapById = (id) => MAPS.find((m) => m.id === id);
