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
    id: 'longshoreman', map: 'the_docks', name: "Dockworkers' Union", icon: '⚓', focus: 'racket', focusName: 'Protection Racket', focusStat: 'area',
    pieces: ['Knit Watch Cap', 'Cargo Hook Mittens', 'Oilskin Bib', 'Canvas Diaper', 'Steel-Toe Booties'],
    bonus: {
      2: { desc: (k) => `Protection Racket +${r(20 * k)}% radius.`, apply: (c, k) => c.abil('racket', 'area', 'pct', 20 * k) },
      3: { desc: () => 'Shaken-down thugs are slowed 20% more, and Protection Racket coughs up coins 30% more often.',
        apply: (c) => { c.flagAdd('racketSlow', 0.2); c.abil('racket', 'payout', 'pct', 30); } },
      5: { desc: (k) => `Union Dues: Protection Racket's extra damage is ${r(50 * k)}% higher, and a pulse that shakes down 4+ thugs always pays a coin.`,
        apply: (c, k) => { c.abil('racket', 'vuln', 'pct', 50 * k); c.flag('unionDues', true); } },
    },
  },
  {
    id: 'high_roller', map: 'casino_row', name: 'High Roller', icon: '🎰', focus: 'make_it_rain', focusName: 'Make It Rain',
    pieces: ['Gold Visor', 'Card-Counting Mittens', 'Velvet Bib', 'Money-Clip Diaper', 'Snakeskin Booties'],
    bonus: {
      2: { desc: (k) => `+${r(12 * k)} luck. Make It Rain +1 cash stack.`, apply: (c, k) => { c.stat('luck', 12 * k); c.abil('make_it_rain', 'count', 'add', 1); } },
      3: { desc: () => 'Make It Rain crits have a 30% chance to drop a gold coin.',
        apply: (c) => c.link('make_it_rain', null, 'crit', 0.3, (run, p, ev) => run.pickups.coin(ev.x, ev.z, 1), { icd: 0.2 }) },
      5: { desc: (k) => `Jackpot: Make It Rain deals +${r(15 * k)}% damage per buy-in you've made this run, on top of the buy-in's own damage.`,
        apply: (c, k) => c.amp((run, m, a) => (a?.def?.id === 'make_it_rain' ? 0.15 * k * (run.counters.buyIns ?? 0) : 0)) },
    },
  },
  {
    id: 'tong_enforcer', map: 'chinatown', name: 'Tong Enforcer', icon: '🐉', focus: 'make_example', focusName: 'Make an Example',
    pieces: ['Silk Skullcap', 'Jade Knuckle Mittens', 'Embroidered Bib', 'Dragon Diaper', 'Kung-Fu Booties'],
    bonus: {
      2: { desc: (k) => `Make an Example +${r(25 * k)}% area.`, apply: (c, k) => c.abil('make_example', 'area', 'pct', 25 * k) },
      3: { desc: () => 'Terror lasts 1.5s longer, and Cement Shoes hits terrify thugs too (needs Make an Example).',
        apply: (c) => {
          c.flagAdd('terrorDur', 1.5);
          c.link('cement', 'make_example', 'hit', 1, (run, p, ev) => p.def.terrify(run, p, ev.m), { icd: 0 });
        } },
      5: { desc: (k) => `Make an Example fires a ring of 10 bullets outward (${r(60 * k)}% of its damage each).`,
        apply: (c, k) => c.link('make_example', null, 'fire', 1, (run, p, ev) => ringShot(run, ev.src, run.player.x, run.player.z, 10, ev.src.stat('damage') * 0.6 * k, '#b48cff'), { icd: 0 }) },
    },
  },
  {
    id: 'carnival_crew', map: 'coney_island', name: 'Carnival Crew', icon: '🎪', focus: '#summon', focusName: 'Crew',
    pieces: ['Straw Boater', 'Ring-Toss Mittens', 'Striped Bib', 'Big-Top Diaper', 'Clown Booties'],
    bonus: {
      2: { desc: (k) => `Hired Goon and Made Men +${r(30 * k)}% damage and last +${r(30 * k)}% longer.`, apply: (c, k) => { c.abil('#summon', 'damage', 'pct', 30 * k); c.abil('#summon', 'duration', 'pct', 30 * k); } },
      3: { desc: (k) => `Drive-By +1 car and +${r(25 * k)}% damage.`, apply: (c, k) => { c.abil('driveby', 'count', 'add', 1); c.abil('driveby', 'damage', 'pct', 25 * k); } },
      5: { desc: () => 'Two carnival cousins follow you all run (permanent bodyguards; Hired Goon upgrades make them stronger).', apply: (c) => c.flagAdd('permGoons', 2) },
    },
  },
];
