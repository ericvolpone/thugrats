/**
 * Mob stats at minute 0 on Normal. The run scales hp/damage with time and
 * difficulty. model = id in the model library (src/assets/mobModels.js or a .glb).
 *
 * speed: units/s · hp · dmg: melee hit · atkCd: seconds between melee hits ·
 * reach: melee reach beyond touching · ranged: { dmg, range, cd, speed, keep, color }
 * (keep = distance the mob tries to hold) · radius: body size · xp · gold: drop chance
 */
export const MOBS = {
  // Chinatown
  alley_cat: { name: 'Alley Cat', h: 0.7, model: 'alley_cat', speed: 6.0, hp: 10, dmg: 4, atkCd: 0.8, reach: 0.4, radius: 0.42, xp: 1, gold: 0.08 },
  tourist: { name: 'Tourist', model: 'tourist', speed: 2.9, hp: 24, dmg: 5, atkCd: 1.2, reach: 0.5, radius: 0.55, xp: 3, gold: 0.25,
    ranged: { dmg: 6, range: 12, cd: 2.4, speed: 12, keep: 9, color: '#ffffff', size: 0.3 } },
  health_inspector: { name: 'Health Inspector', model: 'health_inspector', speed: 3.5, hp: 30, dmg: 9, atkCd: 1.1, reach: 0.6, radius: 0.55, xp: 2, gold: 0.16 },
  line_cook: { name: 'Line Cook', model: 'line_cook', speed: 2.7, hp: 110, dmg: 18, atkCd: 1.5, reach: 0.9, radius: 0.75, xp: 5, gold: 0.3 },
  // Coney Island
  lifeguard: { name: 'Lifeguard', model: 'lifeguard', speed: 4.6, hp: 22, dmg: 7, atkCd: 1.0, reach: 0.6, radius: 0.55, xp: 2, gold: 0.14 },
  clown: { name: 'Party Clown', model: 'clown', speed: 3.0, hp: 30, dmg: 6, atkCd: 1.2, reach: 0.5, radius: 0.55, xp: 3, gold: 0.22,
    ranged: { dmg: 8, range: 11, cd: 2.6, speed: 9, keep: 8, color: '#ff8ad0', size: 0.4 } },
  mascot: { name: 'Hot Dog Mascot', model: 'mascot', speed: 2.5, hp: 150, dmg: 19, atkCd: 1.7, reach: 0.9, radius: 0.85, xp: 6, gold: 0.35 },
  beach_cop: { name: 'Beach Patrol', model: 'beach_cop', speed: 3.6, hp: 34, dmg: 9, atkCd: 1.2, reach: 0.6, radius: 0.55, xp: 2, gold: 0.16 },

  rat: { name: 'Sewer Rat', h: 0.7, model: 'rat', speed: 5.2, hp: 9, dmg: 4, atkCd: 0.9, reach: 0.4, radius: 0.45, xp: 1, gold: 0.08 },
  mallcop: { name: 'Mall Cop', model: 'mallcop', speed: 3.4, hp: 26, dmg: 8, atkCd: 1.2, reach: 0.6, radius: 0.55, xp: 2, gold: 0.15 },
  crossing_guard: { name: 'Crossing Guard', model: 'crossing_guard', speed: 2.6, hp: 70, dmg: 15, atkCd: 1.8, reach: 1.0, radius: 0.65, xp: 4, gold: 0.25 },
  nanny: { name: 'Nanny', model: 'nanny', speed: 3.0, hp: 22, dmg: 5, atkCd: 1.2, reach: 0.5, radius: 0.55, xp: 3, gold: 0.18,
    ranged: { dmg: 7, range: 11, cd: 2.8, speed: 10, keep: 8, color: '#e8f4ff', size: 0.25 } },
  k9: { name: 'K-9 Pup', h: 0.9, model: 'k9', speed: 6.4, hp: 15, dmg: 6, atkCd: 0.8, reach: 0.5, radius: 0.5, xp: 2, gold: 0.1 },
  riot_cop: { name: 'Riot Cop', model: 'riot_cop', speed: 2.4, hp: 140, dmg: 18, atkCd: 1.6, reach: 0.8, radius: 0.7, xp: 6, gold: 0.35, armor: 0.3 },

  seagull: { name: 'Seagull', h: 1.0, model: 'seagull', speed: 6.8, hp: 10, dmg: 4, atkCd: 0.8, reach: 0.4, radius: 0.45, xp: 1, gold: 0.08, fly: 1.2 },
  dockworker: { name: 'Dock Worker', model: 'dockworker', speed: 3.0, hp: 85, dmg: 16, atkCd: 1.6, reach: 0.9, radius: 0.75, xp: 5, gold: 0.3 },
  harbor_cop: { name: 'Harbor Patrol', model: 'harbor_cop', speed: 3.6, hp: 32, dmg: 9, atkCd: 1.2, reach: 0.6, radius: 0.55, xp: 2, gold: 0.15 },
  customs_agent: { name: 'Customs Agent', model: 'customs_agent', speed: 3.2, hp: 30, dmg: 6, atkCd: 1.2, reach: 0.5, radius: 0.55, xp: 3, gold: 0.2,
    ranged: { dmg: 10, range: 13, cd: 2.2, speed: 14, keep: 10, color: '#ffe066', size: 0.22 } },

  pigeon: { name: 'Strip Pigeon', h: 0.9, model: 'pigeon', speed: 6.0, hp: 11, dmg: 5, atkCd: 0.8, reach: 0.4, radius: 0.45, xp: 1, gold: 0.1, fly: 0.9 },
  bouncer: { name: 'Bouncer', model: 'bouncer', speed: 2.8, hp: 120, dmg: 20, atkCd: 1.7, reach: 0.9, radius: 0.8, xp: 6, gold: 0.35 },
  dealer: { name: 'Card Dealer', model: 'dealer', speed: 3.2, hp: 28, dmg: 6, atkCd: 1.2, reach: 0.5, radius: 0.55, xp: 3, gold: 0.25,
    ranged: { dmg: 6, range: 12, cd: 2.4, speed: 15, keep: 9, color: '#ff4d6d', size: 0.2, spread: 3 } },
  security: { name: 'Casino Security', model: 'security', speed: 3.8, hp: 38, dmg: 10, atkCd: 1.1, reach: 0.6, radius: 0.6, xp: 2, gold: 0.18 },
};

/**
 * Bosses and titans. mechanics are telegraphed attacks (see game/bossBrain.js):
 *  slam   — circle(s) at your feet        cone   — wedge in front of the boss
 *  charge — line telegraph, then a dash    nova   — ring of projectiles
 *  donut  — ring around the boss (hug it)  rain   — many random circles near you
 *  cross  — 4 lines out from the boss      summon — calls in adds
 *  barrage— aimed volley of projectiles
 */
export const BOSSES = {
  officer_donut: {
    name: 'Officer Donut', title: 'Beat Cop', model: 'officer_donut', scale: 1.9, hp: 1500, dmg: 22, speed: 3.2, radius: 1.2,
    mechanics: [
      { type: 'slam', cd: 6, radius: 3.5, delay: 1.2, dmg: 28 },
      { type: 'charge', cd: 9, length: 18, width: 2.6, delay: 1.0, dmg: 32 },
    ],
  },
  harbor_master: {
    name: 'The Harbor Master', title: 'Port Authority', model: 'harbor_master', scale: 1.9, hp: 1900, dmg: 24, speed: 3.0, radius: 1.2,
    mechanics: [
      { type: 'cone', cd: 6, angle: 75, length: 10, delay: 1.0, dmg: 30 },
      { type: 'nova', cd: 9, count: 14, dmg: 14, speed: 9, color: '#7fd4ff' },
    ],
  },
  floor_manager: {
    name: 'The Floor Manager', title: 'Comped Nothing', model: 'floor_manager', scale: 1.9, hp: 2200, dmg: 25, speed: 3.4, radius: 1.2,
    mechanics: [
      { type: 'rain', cd: 8, count: 6, radius: 2.4, area: 9, delay: 1.3, dmg: 26 },
      { type: 'barrage', cd: 5, count: 5, dmg: 12, speed: 15, spread: 0.5, color: '#ff4d6d' },
    ],
  },

  maitre_d: {
    name: "The Maître D'", title: 'No Reservation', model: 'maitre_d', scale: 1.9, hp: 2000, dmg: 24, speed: 3.4, radius: 1.2,
    mechanics: [
      { type: 'barrage', cd: 5, count: 6, dmg: 12, speed: 15, spread: 0.6, color: '#f2f2f2' },
      { type: 'charge', cd: 8, length: 18, width: 2.6, delay: 1.0, dmg: 30 },
    ],
  },
  ringmaster: {
    name: 'The Ringmaster', title: 'Step Right Up', model: 'ringmaster', scale: 1.9, hp: 2100, dmg: 24, speed: 3.2, radius: 1.2,
    mechanics: [
      { type: 'nova', cd: 7, count: 16, dmg: 13, speed: 9, color: '#ff8ad0' },
      { type: 'slam', cd: 6, radius: 3.8, delay: 1.2, dmg: 28, count: 2, spread: 4 },
    ],
  },

  // ── Titans ──
  food_critic: {
    name: 'Anton Grumble', title: 'The Food Critic', model: 'food_critic', scale: 3.0, hp: 10000, dmg: 30, speed: 2.8, radius: 2, titan: true,
    mechanics: [
      { type: 'cone', cd: 6, angle: 90, length: 12, delay: 1.1, dmg: 36, label: 'Scathing Review' },
      { type: 'rain', cd: 9, count: 8, radius: 2.4, area: 10, delay: 1.4, dmg: 28, label: 'Sent Back' },
      { type: 'summon', cd: 16, mob: 'alley_cat', count: 12 },
    ],
  },
  landlord: {
    name: 'The Landlord', title: 'Rent Is Due', model: 'landlord', scale: 3.0, hp: 12000, dmg: 32, speed: 3.0, radius: 2, titan: true,
    mechanics: [
      { type: 'donut', cd: 11, inner: 4, outer: 12, delay: 1.6, dmg: 40 },
      { type: 'barrage', cd: 4, count: 7, dmg: 14, speed: 17, spread: 0.7, color: '#c9a227' },
      { type: 'summon', cd: 17, mob: 'health_inspector', count: 6 },
    ],
  },
  parade_dragon: {
    name: 'The Golden Dragon', title: 'Parade Float Gone Rogue', model: 'parade_dragon', scale: 3.5, hp: 22000, dmg: 40, speed: 3.2, radius: 2.3, titan: true, final: true,
    mechanics: [
      { type: 'charge', cd: 7, length: 26, width: 3.4, delay: 1.0, dmg: 42 },
      { type: 'cone', cd: 6, angle: 70, length: 14, delay: 1.0, dmg: 40, label: 'Firecracker Breath' },
      { type: 'nova', cd: 8, count: 22, dmg: 16, speed: 10, color: '#ff6a1a' },
      { type: 'summon', cd: 18, mob: 'line_cook', count: 5 },
    ],
  },
  strongman: {
    name: 'Iron Ivan', title: 'The Strongman', model: 'strongman', scale: 3.1, hp: 12000, dmg: 34, speed: 2.7, radius: 2.1, titan: true,
    mechanics: [
      { type: 'slam', cd: 5, radius: 4.8, delay: 1.3, dmg: 38 },
      { type: 'slam', cd: 8, radius: 3.5, delay: 1.2, dmg: 32, count: 4, spread: 6 },
      { type: 'charge', cd: 9, length: 20, width: 3, delay: 1.1, dmg: 38 },
    ],
  },
  fortune_teller: {
    name: 'Madame Zelda', title: 'Knows Your Future', model: 'fortune_teller', scale: 2.8, hp: 10000, dmg: 30, speed: 3.2, radius: 1.8, titan: true,
    mechanics: [
      { type: 'rain', cd: 7, count: 9, radius: 2.4, area: 11, delay: 1.4, dmg: 28, label: 'Bad Omens' },
      { type: 'cross', cd: 10, length: 24, width: 2.6, delay: 1.3, dmg: 36 },
      { type: 'nova', cd: 6, count: 16, dmg: 14, speed: 9, color: '#c08aff' },
    ],
  },
  captain_coney: {
    name: 'Captain Coney', title: 'Owner of the Boardwalk', model: 'captain_coney', scale: 3.5, hp: 23000, dmg: 41, speed: 2.9, radius: 2.3, titan: true, final: true,
    mechanics: [
      { type: 'donut', cd: 12, inner: 4.5, outer: 14, delay: 1.8, dmg: 45 },
      { type: 'barrage', cd: 4, count: 8, dmg: 14, speed: 18, spread: 0.8, color: '#f2c037' },
      { type: 'rain', cd: 9, count: 8, radius: 2.6, area: 11, delay: 1.5, dmg: 30, label: 'Fireworks' },
      { type: 'summon', cd: 17, mob: 'mascot', count: 4 },
    ],
  },
  lunch_lady: {
    name: 'Big Bertha', title: 'The Lunch Lady', model: 'lunch_lady', scale: 3.0, hp: 9000, dmg: 30, speed: 2.6, radius: 2, titan: true,
    mechanics: [
      { type: 'slam', cd: 5, radius: 4.5, delay: 1.3, dmg: 35 },
      { type: 'rain', cd: 9, count: 7, radius: 2.6, area: 10, delay: 1.5, dmg: 28, label: 'Sloppy Joes' },
      { type: 'summon', cd: 16, mob: 'rat', count: 10 },
    ],
  },
  detective: {
    name: 'Detective Gumshoe', title: 'Homicide Division', model: 'detective', scale: 2.8, hp: 11000, dmg: 30, speed: 3.4, radius: 1.8, titan: true,
    mechanics: [
      { type: 'charge', cd: 7, length: 22, width: 3, delay: 1.0, dmg: 38 },
      { type: 'barrage', cd: 5, count: 7, dmg: 14, speed: 17, spread: 0.7, color: '#ffe066' },
      { type: 'cone', cd: 8, angle: 90, length: 12, delay: 1.1, dmg: 36 },
    ],
  },
  commissioner: {
    name: 'The Commissioner', title: 'Head of the Force', model: 'commissioner', scale: 3.4, hp: 20000, dmg: 38, speed: 3.0, radius: 2.2, titan: true, final: true,
    mechanics: [
      { type: 'cross', cd: 9, length: 28, width: 3, delay: 1.4, dmg: 42 },
      { type: 'donut', cd: 13, inner: 4.5, outer: 14, delay: 1.8, dmg: 45 },
      { type: 'nova', cd: 7, count: 20, dmg: 16, speed: 9, color: '#ff5050' },
      { type: 'summon', cd: 18, mob: 'riot_cop', count: 5 },
    ],
  },
  big_tuna: {
    name: 'Big Tuna', title: 'Fishmonger', model: 'big_tuna', scale: 3.1, hp: 10000, dmg: 32, speed: 2.6, radius: 2.1, titan: true,
    mechanics: [
      { type: 'cone', cd: 6, angle: 100, length: 11, delay: 1.1, dmg: 36 },
      { type: 'slam', cd: 7, radius: 4, delay: 1.2, dmg: 34, count: 3, spread: 5 },
      { type: 'summon', cd: 15, mob: 'seagull', count: 12 },
    ],
  },
  customs_chief: {
    name: 'Chief Inspector Vance', title: 'Customs & Excise', model: 'customs_chief', scale: 2.8, hp: 12000, dmg: 32, speed: 3.3, radius: 1.8, titan: true,
    mechanics: [
      { type: 'barrage', cd: 4, count: 6, dmg: 14, speed: 18, spread: 0.6, color: '#ffe066' },
      { type: 'cross', cd: 10, length: 24, width: 2.6, delay: 1.3, dmg: 38 },
      { type: 'charge', cd: 8, length: 20, width: 2.8, delay: 1.0, dmg: 36 },
    ],
  },
  admiral: {
    name: 'The Admiral', title: 'Coast Guard Command', model: 'admiral', scale: 3.4, hp: 22000, dmg: 40, speed: 3.0, radius: 2.2, titan: true, final: true,
    mechanics: [
      { type: 'donut', cd: 12, inner: 4.5, outer: 14, delay: 1.8, dmg: 46 },
      { type: 'rain', cd: 8, count: 9, radius: 2.8, area: 11, delay: 1.5, dmg: 32, label: 'Artillery' },
      { type: 'nova', cd: 6, count: 22, dmg: 16, speed: 10, color: '#7fd4ff' },
      { type: 'summon', cd: 18, mob: 'harbor_cop', count: 8 },
    ],
  },
  dealer_supreme: {
    name: 'Ace Deuceman', title: 'High Roller Dealer', model: 'dealer_supreme', scale: 2.8, hp: 11000, dmg: 32, speed: 3.4, radius: 1.8, titan: true,
    mechanics: [
      { type: 'barrage', cd: 3.5, count: 9, dmg: 12, speed: 18, spread: 0.9, color: '#ff4d6d' },
      { type: 'rain', cd: 8, count: 8, radius: 2.4, area: 10, delay: 1.3, dmg: 30, label: 'Card Rain' },
      { type: 'charge', cd: 9, length: 20, width: 2.8, delay: 1.0, dmg: 36 },
    ],
  },
  the_king: {
    name: 'The King', title: 'Thank You Very Much', model: 'the_king', scale: 3.0, hp: 13000, dmg: 34, speed: 3.2, radius: 1.9, titan: true,
    mechanics: [
      { type: 'donut', cd: 11, inner: 4, outer: 13, delay: 1.6, dmg: 42 },
      { type: 'cone', cd: 6, angle: 80, length: 13, delay: 1.0, dmg: 38 },
      { type: 'nova', cd: 7, count: 18, dmg: 15, speed: 10, color: '#f2c94c' },
    ],
  },
  big_lou: {
    name: 'Big Lou', title: 'Owner of the House', model: 'big_lou', scale: 3.6, hp: 24000, dmg: 42, speed: 2.8, radius: 2.4, titan: true, final: true,
    mechanics: [
      { type: 'cross', cd: 8, length: 30, width: 3, delay: 1.3, dmg: 44 },
      { type: 'slam', cd: 6, radius: 4.5, delay: 1.2, dmg: 40, count: 3, spread: 6 },
      { type: 'barrage', cd: 4, count: 8, dmg: 14, speed: 18, spread: 0.8, color: '#f2c94c' },
      { type: 'summon', cd: 16, mob: 'bouncer', count: 5 },
    ],
  },
};
