import { freeCast, statusN } from '../common.js';

/**
 * Professor Pudding's gear sets: one per map, dropped by that map's Crime Titans
 * (see data/gear.js). Bonuses at 2 / 3 / 5 pieces worn; k (×1 → ×2) grows with
 * the average tier of the pieces you wear from the set.
 *
 * Each set feeds the status-combo lab (heroes/prof/abilities.js). Flags read
 * there: teslaReach, teslaFork, freezeRoot, shatterShards, reactDeathRay,
 * acidMerge. Helpers come through a partner's def: p.def.lab.dose(...).
 */
const r = (v) => Math.round(v);

const ACID = ['acid_rain', 'slime'];
/** Is thug `m` soaked in acid (the status, or standing in an Acid Rain / Slime Puddle pool)? */
const inAcid = (run, m) => statusN(run, m, 'acid') > 0 || run.combat.zones.some((zn) => ACID.includes(zn.ability?.def?.id) && zn.t < zn.life && Math.hypot(zn.x - m.x, zn.z - m.z) < zn.r + m.radius);

export const PROF_GEAR = [
  {
    id: 'sparky_lab_coat', map: 'little_italy', name: 'Sparky Lab Coat', icon: '🥼', focus: 'tesla', focusName: 'Tesla Coil',
    pieces: ['Copper-Coil Beret', 'Rubber Ravioli Mittens', 'Checkered Lab Bib', 'Grounded Diaper', 'Cobblestone Spark Booties'],
    bonus: {
      2: { desc: (k) => `Tesla Coil fires ${r(25 * k)}% faster.`, apply: (c, k) => c.abil('tesla', 'cooldown', 'pct', 25 * k) },
      3: { desc: () => 'Tesla Coil jumps 1 more time and its arcs reach 50% farther.', apply: (c) => { c.abil('tesla', 'count', 'add', 1); c.flag('teslaReach', 1.5); } },
      5: { desc: (k) => `Forked Lightning: every thug the Tesla Coil hits forks a side arc to up to 2 more nearby thugs (${r(40 * k)}% of Tesla Coil's damage), SHOCKING them too.`,
        apply: (c, k) => c.flag('teslaFork', 0.4 * k) },
    },
  },
  {
    id: 'diving_bell', map: 'the_docks', name: 'Diving Bell', icon: '🤿', focus: '#beam', focusName: 'Freeze & Shrink Rays',
    pieces: ['Brass Diving Helmet', 'Lobster-Claw Mittens', 'Ballast Bib', 'Waterproof Diaper', 'Lead-Weight Booties'],
    bonus: {
      2: { desc: (k) => `Freeze Ray and Shrink Ray get +${r(20 * k)}% Recharge Rate.`, apply: (c, k) => c.abil('#beam', 'cooldown', 'pct', 20 * k) },
      3: { desc: () => 'Freeze Ray freezes thugs solid for 0.6s (elites 0.25s, bosses 0.1s).', apply: (c) => c.flag('freezeRoot', 0.6) },
      5: { desc: (k) => `Cold Shoulder: every Shatter reaction also throws 6 ice shards (${r(35 * k)}% of the reaction's power each).`,
        apply: (c, k) => c.flag('shatterShards', k) },
    },
  },
  {
    id: 'slot_machine', map: 'casino_row', name: 'Slot Machine', icon: '🎰', focus: 'death_ray', focusName: 'Orbital Death Ray',
    pieces: ['Lucky-Seven Visor', 'One-Armed Bandit Mittens', 'Jackpot Bib', 'High-Stakes Diaper', 'Cherry-Reel Booties'],
    bonus: {
      2: { desc: (k) => `Orbital Death Ray +${r(35 * k)}% area.`, apply: (c, k) => c.abil('death_ray', 'area', 'pct', 35 * k) },
      3: { desc: () => 'Every 6th status reaction calls a free Orbital Death Ray on the thug with the most statuses.',
        apply: (c) => c.flag('reactDeathRay', 6) },
      5: { desc: (k) => `Jackpot: every Science cast has a ${r(12 * k)}% chance (doubled while Eureka is 75%+ full) to roll again and fire a second time for free.`,
        apply: (c, k) => c.link('#science', null, 'fire', (run) => 0.12 * k * (run.res && run.res.value >= run.res.max * 0.75 ? 2 : 1), (run, p, ev) => {
          const a = ev.src;
          run.fx.burst(run.player.x, 2.2, run.player.z, '#ffd23f', 10, 3, 0.5);
          run.later(0.3, () => { if (!run.player.dead && run.abilities.includes(a)) freeCast(run, a, null); });
        }, { icd: 0.4 }) },
    },
  },
  {
    id: 'alchemist', map: 'chinatown', name: 'Alchemist', icon: '⚗️', focus: 'acid_rain', focusName: 'Acid Rain',
    pieces: ['Jade Alembic Hat', 'Herbalist Mittens', 'Silk Apron Bib', 'Paper-Lantern Diaper', 'Apothecary Slipper Booties'],
    bonus: {
      2: { desc: (k) => `Acid Rain and Slime Puddle last ${r(30 * k)}% longer.`, apply: (c, k) => { c.abil('acid_rain', 'duration', 'pct', 30 * k); c.abil('slime', 'duration', 'pct', 30 * k); } },
      3: { desc: (k) => `Corrosion: thugs carrying ACID or standing in Acid Rain or a Slime Puddle take +${r(15 * k)}% damage from everything.`,
        apply: (c, k) => c.amp((run, m) => (inAcid(run, m) ? 0.15 * k : 0)) },
      5: { desc: (k) => `Transmutation: a new Acid Rain or Slime Puddle that lands on one of its own pools merges into it, growing it (up to ×${(1.5 + 0.25 * k).toFixed(2)} size), refreshing its time and stacking its acid (up to ×${(1 + 0.5 * k).toFixed(1)} damage).`,
        apply: (c, k) => c.flag('acidMerge', k) },
    },
  },
  {
    id: 'robotics_fair', map: 'coney_island', name: 'Robotics Fair', icon: '🎡', focus: 'robo', focusName: 'Robo-Nanny',
    pieces: ['Propeller Beanie', 'Claw-Machine Mittens', 'Prize-Ribbon Bib', 'Bumper-Car Diaper', 'Roller-Coaster Booties'],
    bonus: {
      2: { desc: (k) => `Robo-Nanny robots last ${r(40 * k)}% longer.`, apply: (c, k) => c.abil('robo', 'duration', 'pct', 40 * k) },
      3: { desc: () => 'Robo-Nanny builds 1 more robot and Drone Swarm gets 1 more drone.', apply: (c) => { c.abil('robo', 'count', 'add', 1); c.abil('drones', 'count', 'add', 1); } },
      5: { desc: (k) => `Assembly Line: every robot Robo-Nanny builds also builds ${r(2 * k)} drone${r(2 * k) > 1 ? 's' : ''} that orbit you for the robot's lifetime (Robo-Nanny's damage), SHOCKING what they ram.`,
        apply: (c, k) => c.link('robo', null, 'fire', 1, (run, p, ev) => {
          const a = ev.src;
          run.orbit({ model: 'drone', color: '#9aa4b4', spark: '#9ad8ff', knock: 1, spin: -5, ability: a, life: a.stat('duration'), count: r(2 * k) * a.stat('count'), r: 2.4,
            onHit: (m) => a.def.lab?.dose(run, m, 'shock', a) });
        }, { icd: 0 }) },
    },
  },
];
