/**
 * Maps. A map is won by killing its final titan; titans are summoned at their
 * altar once their conditions are met. Bosses spawn on a timer at one of the
 * boss spawn points. After `duration` seconds the Feds arrive (enrage).
 *
 * Titan conditions (all must hold):
 *   { level: n }   reach level n        { gold: n }   pay n gold (bribe, consumed)
 *   { bosses: n }  kill n bosses        { titans: n } kill the other n titans
 */
export const DIFFICULTIES = [
  { id: 'normal', name: 'Normal', hp: 1, dmg: 1, spawn: 1, heroXp: 1, gearMin: 0, gearCap: 1, color: '#7fd67f' },
  { id: 'hard', name: 'Hard', hp: 1.9, dmg: 1.5, spawn: 1.15, heroXp: 1.6, gearMin: 1, gearCap: 3, color: '#ffb347' },
  { id: 'nightmare', name: 'Nightmare', hp: 3.4, dmg: 2.2, spawn: 1.3, heroXp: 2.4, gearMin: 2, gearCap: 4, color: '#ff5c5c' },
];

export const MAPS = [
  {
    id: 'little_italy',
    name: 'Little Italy',
    blurb: 'Back alleys, red sauce and a whole precinct that wants you in time-out.',
    theme: {
      ground: '#4a4a52', street: '#3a3a42', line: '#e8d26a', sidewalk: '#8b8680',
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
      { boss: 'lunch_lady', pos: [-70, -55], cond: { level: 12 } },
      { boss: 'detective', pos: [72, -50], cond: { gold: 300 } },
      { boss: 'commissioner', pos: [0, 82], cond: { titans: 2, level: 20 } },
    ],
    bossSpawns: [[-55, 30], [55, 35], [0, -70], [-20, 60]],
    gear: 'dons_fedora',
  },
  {
    id: 'the_docks',
    name: 'The Docks',
    blurb: 'Fog, shipping containers and seagulls with a grudge.',
    requires: 'little_italy',
    theme: {
      ground: '#4d5560', street: '#3c434c', line: '#f2f2f2', sidewalk: '#6d7884',
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
      { boss: 'big_tuna', pos: [-72, 50], cond: { bosses: 1 } },
      { boss: 'customs_chief', pos: [70, 55], cond: { gold: 350 } },
      { boss: 'admiral', pos: [0, -82], cond: { titans: 2, level: 22 } },
    ],
    bossSpawns: [[-50, -30], [50, -35], [0, 65], [30, 10]],
    gear: 'lead_bib',
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
      { boss: 'dealer_supreme', pos: [-70, -60], cond: { gold: 400 } },
      { boss: 'the_king', pos: [72, -55], cond: { level: 16 } },
      { boss: 'big_lou', pos: [0, 82], cond: { titans: 2, bosses: 2 } },
    ],
    bossSpawns: [[-55, 25], [55, 25], [0, -65], [25, 55]],
    gear: 'loaded_booties',
  },
];

export const MAP_DEFAULTS = {
  half: 110, // arena is 220 x 220
  duration: 12 * 60, // seconds before the Feds arrive
  bossEvery: 150,
  firstBoss: 150,
  chestEvery: [35, 55],
};

export const mapById = (id) => MAPS.find((m) => m.id === id);
