/**
 * Boom-Boom's gear sets: one per map, dropped by that map's Crime Titans (see
 * data/gear.js). Bonuses at 2 / 3 / 5 pieces worn; k (×1 → ×2) grows with the
 * average tier of the pieces you wear from the set.
 * 5-piece behaviours live in heroes/boom/abilities.js behind run.flags.
 */
const r = (v) => Math.round(v);

export const BOOM_GEAR = [
  {
    id: 'fuse_box', map: 'little_italy', name: 'Fuse Box', icon: '🧨', focus: '#thrown', focusName: 'Thrown bombs',
    pieces: ['Singed Coppola Cap', 'Match-Striker Mittens', 'Fuse-Spool Bib', 'Powder-Keg Diaper', 'Cobblestone Booties'],
    bonus: {
      2: { desc: (k) => `Stick of Dynamite and Pipe Bomb +${r(25 * k)}% damage.`,
        apply: (c, k) => { c.abil('dynamite_stick', 'damage', 'pct', 25 * k); c.abil('pipe_bomb', 'damage', 'pct', 25 * k); } },
      3: { desc: () => 'Stick of Dynamite throws +1 stick and Pipe Bomb blasts are 25% bigger.',
        apply: (c) => { c.abil('dynamite_stick', 'count', 'add', 1); c.abil('pipe_bomb', 'area', 'pct', 25); } },
      5: { desc: (k) => `Split Fuse: every Dynamite stick and Pipe Bomb splits in 2 when it goes off. The second charge hops a few metres away and blows for ${r(50 * k)}% damage.`,
        apply: (c, k) => c.flag('fuseSplit', 0.5 * k) },
    },
  },
  {
    id: 'shipwrecker', map: 'the_docks', name: 'Shipwrecker', icon: '⚓', focus: '#projectile', focusName: 'Bazooka & Rockets',
    pieces: ["Harbour Pilot's Cap", 'Torpedo Mittens', 'Life-Ring Bib', 'Bilge Diaper', 'Depth-Charge Booties'],
    bonus: {
      2: { desc: (k) => `Toy Bazooka and Bottle Rockets +${r(25 * k)}% damage.`,
        apply: (c, k) => { c.abil('bazooka', 'damage', 'pct', 25 * k); c.abil('rockets', 'damage', 'pct', 25 * k); } },
      3: { desc: () => 'Bottle Rockets +2 rockets and Toy Bazooka blasts are 25% bigger.',
        apply: (c) => { c.abil('rockets', 'count', 'add', 2); c.abil('bazooka', 'area', 'pct', 25); } },
      5: { desc: (k) => `Heat-Seekers: Bazooka and Bottle Rockets home in on thugs and deal +${r(20 * k)}% more damage.`,
        apply: (c, k) => { c.flag('homingRockets', true); c.abil('bazooka', 'damage', 'pct', 20 * k); c.abil('rockets', 'damage', 'pct', 20 * k); } },
    },
  },
  {
    id: 'fireworks_show', map: 'casino_row', name: 'Fireworks Show', icon: '🎆', focus: 'firecrackers', focusName: 'Firecrackers',
    pieces: ['Sparkler Top Hat', 'Roman-Candle Mittens', 'Sequin Bib', 'Jackpot Diaper', 'Tap-Dance Booties'],
    bonus: {
      2: { desc: (k) => `Firecrackers +${r(30 * k)}% damage.`, apply: (c, k) => c.abil('firecrackers', 'damage', 'pct', 30 * k) },
      3: { desc: () => 'Firecrackers throws +4 crackers and they pop 20% bigger.',
        apply: (c) => { c.abil('firecrackers', 'count', 'add', 4); c.abil('firecrackers', 'area', 'pct', 20); } },
      5: { desc: (k) => `Grand Display: with Firecrackers in the run, every kill pops a firework on the body (${r(120 * k)}% of Firecrackers' damage, 30% bigger).`,
        apply: (c, k) => c.link('*', 'firecrackers', 'kill', 1, (run, p, ev) => {
          run.explode(ev.x, ev.z, p.stat('area') * 1.3, p.stat('damage') * 1.2 * k, p, { small: true, noProc: true, color: ['#ff4fa3', '#ffd23f', '#58c4ff'][r(Math.random() * 2)] });
        }, { icd: 0.05 }) },
    },
  },
  {
    id: 'paper_lantern', map: 'chinatown', name: 'Paper Lantern', icon: '🏮', focus: '#fire', focusName: 'Napalm & Gas Can',
    pieces: ['Lantern Hat', 'Joss-Stick Mittens', 'Red Silk Bib', 'Firecracker-Red Diaper', 'Dragon-Dance Booties'],
    bonus: {
      2: { desc: (k) => `Fire abilities +${r(30 * k)}% damage.`, apply: (c, k) => c.abil('#fire', 'damage', 'pct', 30 * k) },
      3: { desc: () => 'Napalm and Gas Can puddles are 20% bigger and slow thugs in them by 25%.',
        apply: (c) => { c.abil('#fire', 'area', 'pct', 20); c.flag('lanternSlow', 0.25); } },
      5: { desc: (k) => `Wildfire: Napalm and Gas Can set thugs alight (they keep burning for 2s at ${r(60 * k)}% of the puddle's damage), and burning thugs spread the flames to a neighbour.`,
        apply: (c, k) => c.flag('fireSpread', 0.6 * k) },
    },
  },
  {
    id: 'funhouse', map: 'coney_island', name: 'Funhouse', icon: '🎡', focus: 'rc_car', focusName: 'RC Car & Big One',
    pieces: ['Bumper-Car Helmet', 'Prize-Claw Mittens', 'Cotton-Candy Bib', 'Tilt-a-Whirl Diaper', 'Roller-Skate Booties'],
    bonus: {
      2: { desc: (k) => `RC Car Bomb and The Big One +${r(30 * k)}% damage.`,
        apply: (c, k) => { c.abil('rc_car', 'damage', 'pct', 30 * k); c.abil('big_one', 'damage', 'pct', 30 * k); } },
      3: { desc: () => 'RC Car Bomb sends +1 car and The Big One gets +20% Recharge Rate.',
        apply: (c) => { c.abil('rc_car', 'count', 'add', 1); c.abil('big_one', 'cooldown', 'pct', 20); } },
      5: { desc: (k) => `Bumper Cars: every RC Car that blows up comes back once — a fresh car drives out at the nearest crowd 0.6s later (${r(70 * k)}% damage).`,
        apply: (c, k) => c.flag('funhouse', 0.7 * k) },
    },
  },
];
