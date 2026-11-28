import { freeCast, explodeAt, ringShot, statusN } from '../common.js';

/**
 * Professor Pudding's talent trees (format: heroes/lenny/talents.js). 3 branches
 * × 8 rows. Rows 6-8 are pairing talents: `pair` names the partner ability that
 * must be in your run for them to do anything (see ctx.link). Procs use the
 * partner's stats and credit their damage to it.
 *
 * The Prof's signature is status combos (heroes/prof/abilities.js). This file
 * can't import that one, so it reaches the lab through a partner's def:
 * p.def.lab.dose(run, m, key, p) and p.def.lab.react(run, m, k1, k2, p, opts).
 * Flags read there: singularity, robotUprising, supercharged, deepFreeze,
 * stickyPudding, statusDur, reactDmg, reactEureka, madGenius, labNotes.
 */

const alive = (m) => m && !m.dead && m.hp > 0;

/** The live Slime Puddle zone thug `m` is standing in, if any. */
const puddleAt = (run, m) => run.combat.zones.find((zn) => zn.ability?.def?.id === 'slime' && zn.t < zn.life && Math.hypot(zn.x - m.x, zn.z - m.z) < zn.r + m.radius);

export const PROF_TREES = [
  { id: 'mad', name: 'Mad Science', icon: '⚗️', color: '#b07aff', blurb: 'Lightning, ice, shrinking and things best left alone.' },
  { id: 'robotics', name: 'Robotics', icon: '🤖', color: '#7ad0ff', blurb: 'Machines that mix the chemicals for you.' },
  { id: 'brain', name: 'Big Brain', icon: '🧠', color: '#ff8fd0', blurb: 'Reactions, Eureka and learning.' },
];

export const PROF_TALENTS = [
  // ── Mad Science ──
  { id: 'p_volts', tree: 'mad', row: 0, col: 0, max: 5, name: 'More Volts', icon: '⚡',
    desc: (r) => `Science abilities deal +${4 * r}% damage.`, apply: (c, r) => c.abil('#science', 'damage', 'pct', 4 * r) },
  { id: 'p_jumps', tree: 'mad', row: 0, col: 2, max: 3, name: 'Conductive Goo', icon: '🔗',
    desc: (r) => `Tesla Coil jumps ${r} more time${r > 1 ? 's' : ''}.`, apply: (c, r) => c.abil('tesla', 'count', 'add', r) },
  { id: 'p_area', tree: 'mad', row: 1, col: 0, max: 3, name: 'Wider Beams', icon: '📡',
    desc: (r) => `Beam abilities have +${10 * r}% area.`, apply: (c, r) => c.abil('#beam', 'area', 'pct', 10 * r) },
  { id: 'p_crit', tree: 'mad', row: 1, col: 2, max: 3, name: 'Precise Measurements', icon: '📏',
    desc: (r) => `+${3 * r}% crit chance.`, apply: (c, r) => c.stat('crit', 0.03 * r) },
  { id: 'p_freeze', tree: 'mad', row: 2, col: 0, max: 1, name: 'Deep Freeze', icon: '🧊',
    desc: () => 'Freeze Ray has a 20% chance to freeze thugs solid.', apply: (c) => c.flag('deepFreeze', true) },
  { id: 'p_hole', tree: 'mad', row: 2, col: 2, max: 3, name: 'Event Horizon', icon: '🕳️',
    desc: (r) => `Pocket Black Hole +${10 * r}% area.`, apply: (c, r) => c.abil('black_hole', 'area', 'pct', 10 * r) },
  { id: 'p_big', tree: 'mad', row: 3, col: 1, max: 3, name: 'Peer Review', icon: '📑',
    desc: (r) => `+${8 * r}% damage to elites, bosses and titans.`, apply: (c, r) => c.stat('bigDmg', 0.08 * r) },
  { id: 'p_super', tree: 'mad', row: 4, col: 1, max: 1, name: 'Supercharged', icon: '🌩️', capstone: true,
    desc: () => 'Tesla Coil jumps 3 more times (shocking more thugs) and barely loses damage per jump. Robo-Nanny zaps chain once.', apply: (c) => c.flag('supercharged', true) },
  { id: 'p_conduct', tree: 'mad', row: 5, col: 0, max: 3, name: 'Conductive Custard', icon: '🍮', pair: 'tesla',
    desc: (r) => `Pudding Blaster hits have a ${8 * r}% chance to conduct: the blob also applies SHOCK (Tesla Coil strength), so it goes off as Static Cling.`,
    apply: (c, r) => c.link('pudding_blaster', 'tesla', 'hit', 0.08 * r, (run, p, ev) => {
      if (!alive(ev.m)) return;
      run.fx.burst(ev.m.x, 1, ev.m.z, '#9ad8ff', 6, 3, 0.3);
      p.def.lab.dose(run, ev.m, 'shock', p);
    }, { icd: 0.3 }) },
  { id: 'p_shatter', tree: 'mad', row: 5, col: 2, max: 3, name: 'Brittle Science', icon: '💎', pair: 'shrink_ray',
    desc: (r) => `Freeze Ray hits on shrunk thugs have a ${15 * r}% chance to set off a free amplified Shatter (Shrink Ray strength).`,
    apply: (c, r) => c.link('freeze_ray', 'shrink_ray', 'hit', (run, ev) => (statusN(run, ev.m, 'shrunk') ? 0.15 * r : 0), (run, p, ev) => {
      if (alive(ev.m)) p.def.lab.react(run, ev.m, 'shock', 'frozen', p, { amp: true });
    }, { icd: 0.3 }) },
  { id: 'p_acid_hole', tree: 'mad', row: 6, col: 1, max: 3, name: 'Accretion Drizzle', icon: '🌧️', pair: 'acid_rain',
    desc: (r) => `Pocket Black Hole has a ${25 * r}% chance to seed a free Acid Rain cloud over itself, so it stirs acid into everything it pulls in.`,
    apply: (c, r) => c.link('black_hole', 'acid_rain', 'fire', 0.25 * r, (run, p, ev) => freeCast(run, p, ev.tgt), { icd: 1 }) },
  { id: 'p_singularity', tree: 'mad', row: 7, col: 1, max: 1, name: 'Singularity', icon: '🌀', capstone: true, pair: 'black_hole',
    desc: () => 'Pocket Black Hole pulls 67% harder, and when it collapses it implodes for 8× its crush damage over 120% of its area, SHRINKING survivors for 3s (+25% damage taken, amplified reactions).',
    apply: (c) => c.flag('singularity', true) },

  // ── Robotics ──
  { id: 'p_bots', tree: 'robotics', row: 0, col: 0, max: 5, name: 'Better Circuits', icon: '🔌',
    desc: (r) => `Summon and orbit abilities deal +${5 * r}% damage.`, apply: (c, r) => { c.abil('#summon', 'damage', 'pct', 5 * r); c.abil('#orbit', 'damage', 'pct', 5 * r); } },
  { id: 'p_life', tree: 'robotics', row: 0, col: 2, max: 3, name: 'Long-Life Batteries', icon: '🔋',
    desc: (r) => `Robo-Nanny lasts ${2 * r}s longer.`, apply: (c, r) => c.abil('robo', 'duration', 'add', 2 * r) },
  { id: 'p_hp', tree: 'robotics', row: 1, col: 0, max: 3, name: 'Lab Coat', icon: '🥼',
    desc: (r) => `+${12 * r} max HP. Drone Swarm hits heal you for ${2 * r}% of their damage.`, apply: (c, r) => { c.stat('maxHp', 12 * r); c.stat('auraLeech', 0.02 * r); } },
  { id: 'p_drones', tree: 'robotics', row: 1, col: 2, max: 2, name: 'Spare Parts', icon: '🛸',
    desc: (r) => `Drone Swarm +${r} drone${r > 1 ? 's' : ''}.`, apply: (c, r) => c.abil('drones', 'count', 'add', r) },
  { id: 'p_shield', tree: 'robotics', row: 2, col: 0, max: 3, name: 'Shield Generator', icon: '🔵',
    desc: (r) => `Cryo Field +${20 * r}% shield.`, apply: (c, r) => c.abil('force_field', 'power', 'pct', 20 * r) },
  { id: 'p_armor', tree: 'robotics', row: 2, col: 2, max: 3, name: 'Tin-Foil Onesie', icon: '🥫',
    desc: (r) => `Take ${4 * r}% less damage.`, apply: (c, r) => c.stat('armor', 0.04 * r) },
  { id: 'p_pickup', tree: 'robotics', row: 3, col: 1, max: 2, name: 'Tractor Beam', icon: '🧲',
    desc: (r) => `+${30 * r}% pickup range.`, apply: (c, r) => c.stat('pickupPct', 0.3 * r) },
  { id: 'p_army', tree: 'robotics', row: 4, col: 1, max: 1, name: 'Robot Army', icon: '🤖', capstone: true,
    desc: () => 'Robo-Nanny builds one more robot.', apply: (c) => c.abil('robo', 'count', 'add', 1) },
  { id: 'p_laser', tree: 'robotics', row: 5, col: 0, max: 3, name: 'Targeting Laser', icon: '🎯', pair: 'death_ray',
    desc: (r) => `Robo-Nanny zaps have a ${5 * r}% chance to paint the target for a mini Orbital Death Ray (50% damage, 70% area) 0.6s later.`,
    apply: (c, r) => c.link('robo', 'death_ray', 'hit', 0.05 * r, (run, p, ev) => {
      const m = ev.m;
      if (!alive(m)) return;
      run.mark(m, 0.6, () => { run.fx.tracer(m.x, m.z); explodeAt(run, p, m.x, m.z, { dmg: 0.5, area: 0.7 }); });
    }, { icd: 1.2 }) },
  { id: 'p_drone_zap', tree: 'robotics', row: 5, col: 2, max: 3, name: 'Cryo Drones', icon: '🛸', pair: 'drones',
    desc: (r) => `Tesla Coil hits have a ${8 * r}% chance to make a drone zap the same thug for 400% of Drone Swarm's damage and apply FROZEN (the arc's shock then Shatters it).`,
    apply: (c, r) => c.link('tesla', 'drones', 'hit', 0.08 * r, (run, p, ev) => {
      if (!alive(ev.m)) return;
      run.fx.beam(run.player.x, run.player.z, ev.m.x, ev.m.z, '#bff0ff', 0.08, 0.12, 1.3);
      run.hit(ev.m, p.stat('damage') * 4, p, { knock: 0.5 });
      p.def.lab.dose(run, ev.m, 'frozen', p);
    }, { icd: 0.1 }) },
  { id: 'p_field_drones', tree: 'robotics', row: 6, col: 1, max: 3, name: 'Bubble Pop', icon: '🫧', pair: 'drones',
    desc: (r) => `When a Force Field shield breaks, ${4 + 2 * r} drone darts burst out of it (${300 + 100 * r}% of Drone Swarm's damage each).`,
    apply: (c, r) => c.link('force_field', 'drones', 'fire', 1, (run, p) => {
      // watch this cast's shield; a newer cast takes over the watch
      const id = (run.counters.fieldWatch = (run.counters.fieldWatch ?? 0) + 1);
      let left = 60;
      const watch = () => {
        if (run.counters.fieldWatch !== id || run.player.dead || (left -= 0.1) <= 0) return;
        if (run.player.shield > 0) { run.later(0.1, watch); return; }
        ringShot(run, p, run.player.x, run.player.z, 4 + 2 * r, p.stat('damage') * (3 + r), '#9ad8ff');
        run.fx.ring(run.player.x, run.player.z, 2.6, '#58c4ff', 0.4);
      };
      run.later(0.1, watch);
    }, { icd: 0 }) },
  { id: 'p_uprising', tree: 'robotics', row: 7, col: 1, max: 1, name: 'Robot Uprising', icon: '🦾', capstone: true, pair: 'robo',
    desc: () => 'Robo-Nanny robots zap 57% faster, and when their time runs out they self-destruct for 5× Robo-Nanny damage in a 3m blast that SHOCKS everything it leaves standing.',
    apply: (c) => c.flag('robotUprising', true) },

  // ── Big Brain ──
  { id: 'p_think', tree: 'brain', row: 0, col: 0, max: 5, name: 'Quick Thinking', icon: '💭',
    desc: (r) => `+${2 * r}% Recharge Rate on all abilities.`, apply: (c, r) => c.stat('haste', 0.02 * r) },
  { id: 'p_xp', tree: 'brain', row: 0, col: 2, max: 3, name: 'Gifted', icon: '📚',
    desc: (r) => `+${7 * r}% XP.`, apply: (c, r) => c.stat('xpGain', 0.07 * r) },
  { id: 'p_luck', tree: 'brain', row: 1, col: 0, max: 3, name: 'Probability', icon: '🎲',
    desc: (r) => `+${7 * r} luck.`, apply: (c, r) => c.stat('luck', 7 * r) },
  { id: 'p_dur', tree: 'brain', row: 1, col: 2, max: 3, name: 'Long Experiments', icon: '⏳',
    desc: (r) => `+${6 * r}% duration, and statuses on thugs last ${(0.5 * r).toFixed(1)}s longer.`, apply: (c, r) => { c.stat('duration', 0.06 * r); c.flagAdd('statusDur', 0.5 * r); } },
  { id: 'p_reroll', tree: 'brain', row: 2, col: 0, max: 1, name: 'Hypothesis', icon: '🧪',
    desc: () => '+2 rerolls per run.', apply: (c) => c.stat('rerolls', 2) },
  { id: 'p_area2', tree: 'brain', row: 2, col: 2, max: 3, name: 'Big Ideas', icon: '💡',
    desc: (r) => `+${5 * r}% area.`, apply: (c, r) => c.stat('area', 0.05 * r) },
  { id: 'p_brain', tree: 'brain', row: 3, col: 1, max: 3, name: 'Catalysis', icon: '⚗️',
    desc: (r) => `Reactions deal +${12 * r}% damage and fill Eureka ${10 * r}% faster.`, apply: (c, r) => { c.flagAdd('reactDmg', 0.12 * r); c.flagAdd('reactEureka', 0.1 * r); } },
  { id: 'p_sticky', tree: 'brain', row: 4, col: 1, max: 1, name: 'Sticky Pudding', icon: '🍮', capstone: true,
    desc: () => 'Pudding Blaster splashes stick: everything in the splash gets PUDDING and is slowed 35%, and pudding lasts twice as long.', apply: (c) => c.flag('stickyPudding', true) },
  { id: 'p_puddle', tree: 'brain', row: 5, col: 0, max: 3, name: 'Galvanic Goo', icon: '🔋', pair: 'slime',
    desc: (r) => `Tesla Coil hits on a thug standing in a Slime Puddle have a ${12 * r}% chance to electrify the puddle: every thug in it (10 at most) gets SHOCK at Slime Puddle strength, setting off Electrolysis on the acid-soaked.`,
    apply: (c, r) => c.link('tesla', 'slime', 'hit', (run, ev) => (puddleAt(run, ev.m) ? 0.12 * r : 0), (run, p, ev) => {
      const zn = puddleAt(run, ev.m);
      if (!zn) return;
      let n = 0;
      for (const m of run.mobs.near(zn.x, zn.z, zn.r)) {
        if (n++ >= 10) break;
        run.fx.beam(ev.x, ev.z, m.x, m.z, '#c8ff6a', 0.08, 0.14, 0.4);
        p.def.lab.dose(run, m, 'shock', p);
      }
    }, { icd: 0.8 }) },
  { id: 'p_eureka', tree: 'brain', row: 5, col: 2, max: 3, name: 'Lab Notes', icon: '📓', pair: 'grand_experiment',
    desc: (r) => `Every reaction Grand Experiment sets off gives +${r} extra Eureka (on top of the usual, and past the usual speed limit), so EUREKA! comes sooner.`,
    apply: (c, r) => c.flagAdd('labNotes', r) },
  { id: 'p_shrink_hole', tree: 'brain', row: 6, col: 1, max: 3, name: 'Quantum Squeeze', icon: '🔬', pair: 'black_hole',
    desc: (r) => `Shrink Ray hits have a ${15 * r}% chance to open a mini Pocket Black Hole on the shrunk thug (half its size and duration) that stirs statuses like the real one.`,
    apply: (c, r) => c.link('shrink_ray', 'black_hole', 'hit', 0.15 * r, (run, p, ev) => {
      run.zone({ x: ev.x, z: ev.z, r: p.stat('area') * 0.5, life: p.stat('duration') * 0.5, dps: p.stat('damage'), pull: 7, kind: 'void', ability: p,
        onTick: (zn, dt) => p.def.lab.stir(run, zn, p, dt, 4) });
    }, { icd: 1.5 }) },
  { id: 'p_genius', tree: 'brain', row: 7, col: 1, max: 1, name: 'Mad Genius', icon: '🧑‍🔬', capstone: true, pair: 'grand_experiment',
    desc: () => 'EUREKA! lasts 2s longer (7s), and the moment it goes off it also sets off a free Grand Experiment around you.',
    apply: (c) => c.flag('madGenius', true) },
];
