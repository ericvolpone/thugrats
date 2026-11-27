import { ringShot } from '../common.js';

/**
 * Lenny's gear sets: one per map, dropped by that map's Crime Titans (see
 * data/gear.js). Bonuses at 2 / 3 / 5 pieces worn; k (×1 → ×2) grows with the
 * average tier of the pieces you wear from the set.
 */
const r = (v) => Math.round(v);

export const LENNY_GEAR = [
  {
    id: 'dons_finest', map: 'little_italy', name: "The Don's Finest", icon: '🎩', focus: 'pistol', focusName: 'Snub-Nose',
    pieces: ["Don's Fedora", 'Pinstripe Mittens', 'Silk Bib', 'Tailored Diaper', 'Wingtip Booties'],
    bonus: {
      2: { desc: (k) => `Snub-Nose fires ${r(20 * k)}% faster.`, apply: (c, k) => c.abil('pistol', 'cooldown', 'pct', 20 * k) },
      3: { desc: () => 'Snub-Nose bullets pierce +1 and ricochet to one more thug.', apply: (c) => { c.abil('pistol', 'pierce', 'add', 1); c.flag('ricochet', true); } },
      5: { desc: (k) => `Golden Bullet: every 10th Snub-Nose shot deals ×${(4 * k).toFixed(1)} damage and executes non-titan thugs under 25% HP.`,
        apply: (c, k) => c.flag('goldenBullet', 4 * k) },
    },
  },
  {
    id: 'longshoreman', map: 'the_docks', name: 'Longshoreman', icon: '🪝', focus: '#explosive', focusName: 'Explosives',
    pieces: ['Knit Watch Cap', 'Cargo Hook Mittens', 'Oilskin Bib', 'Canvas Diaper', 'Steel-Toe Booties'],
    bonus: {
      2: { desc: (k) => `Explosive abilities +${r(20 * k)}% area.`, apply: (c, k) => c.abil('#explosive', 'area', 'pct', 20 * k) },
      3: { desc: () => 'Every explosion throws 3 pieces of shrapnel.', apply: (c) => c.flagAdd('shrapnel', 3) },
      5: { desc: (k) => `Every explosion leaves burning ground for 2s (${r(25 * k)}% of its damage per second).`, apply: (c, k) => c.stat('blastBurn', 0.25 * k) },
    },
  },
  {
    id: 'high_roller', map: 'casino_row', name: 'High Roller', icon: '🎰', focus: 'make_it_rain', focusName: 'Make It Rain',
    pieces: ['Gold Visor', 'Card-Counting Mittens', 'Velvet Bib', 'Money-Clip Diaper', 'Snakeskin Booties'],
    bonus: {
      2: { desc: (k) => `+${r(12 * k)} luck. Make It Rain +1 cash stack.`, apply: (c, k) => { c.stat('luck', 12 * k); c.abil('make_it_rain', 'count', 'add', 1); } },
      3: { desc: () => 'Make It Rain crits have a 30% chance to drop a gold coin.',
        apply: (c) => c.link('make_it_rain', null, 'crit', 0.3, (run, p, ev) => run.pickups.coin(ev.x, ev.z, 1), { icd: 0.2 }) },
      5: { desc: (k) => `Jackpot: Make It Rain deals +1% damage per 10 gold you're holding (up to +${r(100 * k)}%).`,
        apply: (c, k) => c.amp((run, m, a) => (a?.def?.id === 'make_it_rain' ? Math.min(k, run.gold / 1000) : 0)) },
    },
  },
  {
    id: 'tong_enforcer', map: 'chinatown', name: 'Tong Enforcer', icon: '🐉', focus: 'tantrum', focusName: 'Tantrum',
    pieces: ['Silk Skullcap', 'Jade Knuckle Mittens', 'Embroidered Bib', 'Dragon Diaper', 'Kung-Fu Booties'],
    bonus: {
      2: { desc: (k) => `Tantrum +${r(25 * k)}% area.`, apply: (c, k) => c.abil('tantrum', 'area', 'pct', 25 * k) },
      3: { desc: () => 'Tantrum and Cement Shoes slow what they hit by 40% for 2s.',
        apply: (c) => {
          const slow = (run, p, ev) => { ev.m.slow = Math.max(ev.m.slowT > 0 ? ev.m.slow : 0, ev.m.tier >= 2 ? 0.16 : 0.4); ev.m.slowT = Math.max(ev.m.slowT, 2); };
          c.link('tantrum', null, 'hit', 1, slow, { icd: 0 });
          c.link('cement', null, 'hit', 1, slow, { icd: 0 });
        } },
      5: { desc: (k) => `Tantrum fires a ring of 10 bullets outward (${r(60 * k)}% of Tantrum's damage each).`,
        apply: (c, k) => c.link('tantrum', null, 'fire', 1, (run, p, ev) => ringShot(run, ev.src, run.player.x, run.player.z, 10, ev.src.stat('damage') * 0.6 * k, '#ffd36b'), { icd: 0 }) },
    },
  },
  {
    id: 'carnival_crew', map: 'coney_island', name: 'Carnival Crew', icon: '🎪', focus: 'goon', focusName: 'Hired Goon',
    pieces: ['Straw Boater', 'Ring-Toss Mittens', 'Striped Bib', 'Big-Top Diaper', 'Clown Booties'],
    bonus: {
      2: { desc: (k) => `Hired Goon +${r(30 * k)}% damage and lasts +${r(30 * k)}% longer.`, apply: (c, k) => { c.abil('goon', 'damage', 'pct', 30 * k); c.abil('goon', 'duration', 'pct', 30 * k); } },
      3: { desc: (k) => `Drive-By +1 car and +${r(25 * k)}% damage.`, apply: (c, k) => { c.abil('driveby', 'count', 'add', 1); c.abil('driveby', 'damage', 'pct', 25 * k); } },
      5: { desc: () => 'Two carnival cousins follow you all run (permanent bodyguards; Hired Goon upgrades make them stronger).', apply: (c) => c.flagAdd('permGoons', 2) },
    },
  },
];
