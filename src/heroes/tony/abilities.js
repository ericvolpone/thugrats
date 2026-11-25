import { sfx } from '../../audio.js';
import { TAU, rand } from '../../util.js';
import { pctUp, scUp, addUp, DMG, CD, AREA, DUR, permanentUptime, angleTo, cone, line, nova, chill, buff } from '../common.js';

/**
 * Tiny Tony Two-Fists — the Brute. Up close and personal: big cones, knockback,
 * stuns and a body that doesn't quit. See heroes/lenny/abilities.js for the format.
 */
export const TONY_ABILITIES = [
  {
    id: 'haymaker', name: 'Haymaker', icon: '🥊', tags: ['melee'],
    desc: 'A wild swing at whoever is closest. Hits everything in front of him.',
    base: { damage: 22, cooldown: 0.75, area: 3.2, range: 4.2, count: 1 },
    upgrades: [DMG, pctUp('cooldown', 'Punch Speed', 12), AREA, addUp('count', 'Extra Swing', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range') + a.stat('area') * 0.3, 'nearest'),
    fire(run, a, t) {
      const n = a.stat('count') + (run.flags.tonyCombo ? 1 : 0);
      for (let i = 0; i < n; i++) {
        run.later(i * 0.16, () => {
          const ang = angleTo(run, t) + (i % 2 ? 0.3 : -0.3) * Math.min(1, i);
          cone(run, a, { angle: ang, r: a.stat('area'), half: 0.8, dmg: a.stat('damage'), knock: 4, color: '#ffe0c0' });
          run.player.aim(t.x, t.z, 0.2);
          sfx('hit', 0.05);
        });
      }
    },
  },
  {
    id: 'ground_pound', name: 'Ground Pound', icon: '💢', tags: ['melee', 'aoe'],
    desc: 'Jumps and belly-flops. Damages, knocks back and stuns everything around.',
    base: { damage: 34, cooldown: 6, area: 4.6, duration: 0.8 },
    upgrades: [DMG, AREA, CD, pctUp('duration', 'Stun', 20)],
    ready: (run, a) => run.mobs.count(run.player.x, run.player.z, a.stat('area')) >= 3,
    fire(run, a) {
      const p = run.player;
      nova(run, a, { r: a.stat('area'), dmg: a.stat('damage'), knock: 8, root: a.stat('duration'), color: '#e8c89a' });
      run.fx.burst(p.x, 0.3, p.z, '#b49a78', 24, 7);
      if (run.flags.tonyQuake) run.zone({ x: p.x, z: p.z, r: a.stat('area') * 0.8, life: 3, dps: a.stat('damage') * 0.35, slow: 0.4, kind: 'cement', color: '#7a6a55', ability: a });
      run.shake(0.25);
      sfx('tantrum');
    },
  },
  {
    id: 'bottle', name: 'Bottle Smash', icon: '🍼', tags: ['thrown'],
    desc: 'Lobs a glass milk bottle. It shatters and sprays shards in every direction.',
    base: { damage: 22, cooldown: 2.6, range: 12, area: 2.6, count: 6 },
    upgrades: [DMG, CD, { ...scUp('count', 'Shards', 2), int: true }, AREA],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      run.lob({ tx: t.x, tz: t.z, dur: 0.55, kind: 'bottle', onLand: (x, z) => {
        run.explode(x, z, a.stat('area'), a.stat('damage'), a, { small: true, color: '#e6fff0' });
        const n = a.stat('count');
        for (let i = 0; i < n; i++) run.shoot({ x, z, y: 0.5, angle: (i / n) * TAU + rand(0, 0.4), speed: 24, dmg: a.stat('damage') * 0.45, range: 6, size: 0.7, color: '#c8ffe0', ability: a });
        sfx('hit');
      } });
    },
  },
  {
    id: 'bull_rush', name: 'Bull Rush', icon: '🐂', tags: ['melee'],
    desc: 'Charges headfirst through a crowd, bowling everyone over in a line.',
    base: { damage: 40, cooldown: 5.5, range: 9, area: 1.3 },
    upgrades: [DMG, CD, pctUp('range', 'Charge Length', 15), AREA],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const p = run.player;
      const ang = angleTo(run, t);
      const len = a.stat('range');
      line(run, a, { angle: ang, len, width: a.stat('area'), dmg: a.stat('damage'), knock: 9, color: '#ffcf9a', y: 0.4 });
      // Tony actually travels part of the way
      const step = Math.min(len * 0.45, Math.hypot(t.x - p.x, t.z - p.z));
      p.x += Math.sin(ang) * step;
      p.z += Math.cos(ang) * step;
      run.world.collide(p, p.radius, p.y);
      run.fx.burst(p.x, 0.3, p.z, '#b49a78', 14, 5);
      sfx('tantrum', 0.1);
    },
  },
  {
    id: 'roid_rage', name: 'Juice Box Rage', icon: '🧃', tags: ['buff'],
    desc: 'Downs a juice box. Hits harder, takes less damage and heals on every hit for a while.',
    base: { cooldown: 18, duration: 6, power: 0.3 },
    upgrades: [DUR, scUp('power', 'Rage', 0.08, (v) => `+${Math.round(v * 100)}% rage damage`), CD],
    useless: permanentUptime,
    ready: (run) => run.mobs.count(run.player.x, run.player.z, 8) >= 4,
    fire(run, a) {
      const pw = a.stat('power');
      buff(run, a, { fx: '#ff7a3a', stats: (s) => { s.dmg += pw; s.armor += 0.15; s.regen += 3 + pw * 10; } });
      run.fx.ring(run.player.x, run.player.z, 3, '#ff7a3a', 0.5);
      sfx('frenzy');
    },
  },
  {
    id: 'lariat', name: 'Spinning Lariat', icon: '🌀', tags: ['melee', 'orbit'],
    desc: 'Spins with his arms out. Gloves whirl around him, smacking anything close.',
    base: { damage: 14, cooldown: 7, duration: 4, count: 2, area: 2.2 },
    upgrades: [DMG, addUp('count', 'Fists', [1, 1, 1, 2, 2], null, 6), DUR, AREA, CD],
    useless: permanentUptime,
    ready: (run, a) => !run.orbits.some((o) => o.ability === a) && run.mobs.count(run.player.x, run.player.z, a.stat('area') + 3) > 0,
    fire(run, a) {
      run.orbit({ ability: a, count: a.stat('count'), r: a.stat('area'), life: a.stat('duration'), color: '#d8302a', spark: '#ffb0a0', spin: 6, knock: 5 });
    },
  },
  {
    id: 'folding_chair', name: 'Folding Chair', icon: '🪑', tags: ['melee'],
    desc: 'Grabs a chair and brings it down on the biggest guy around. Stuns.',
    base: { damage: 120, cooldown: 7, range: 6, duration: 1.4 },
    upgrades: [DMG, CD, pctUp('duration', 'Stun', 20), pctUp('range', 'Reach', 15)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest'),
    fire(run, a, t) {
      run.hit(t, a.stat('damage'), a, { knock: 6 });
      t.rootT = Math.max(t.rootT, t.tier >= 2 ? a.stat('duration') * 0.3 : a.stat('duration'));
      run.fx.burst(t.x, 1.4, t.z, '#c0c4cc', 16, 5);
      run.fx.ring(t.x, t.z, 1.6, '#ffffff', 0.3);
      run.player.aim(t.x, t.z, 0.3);
      run.shake(0.15);
      sfx('bigshot');
    },
  },
  {
    id: 'stink_bomb', name: 'Stink Bomb', icon: '💩', tags: ['thrown', 'aoe'],
    desc: 'A loaded diaper. The cloud poisons and slows everyone who wanders in.',
    base: { damage: 10, cooldown: 6, range: 11, area: 3.2, duration: 5 },
    upgrades: [pctUp('damage', 'Stench', 20), AREA, DUR, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      run.lob({ tx: t.x, tz: t.z, dur: 0.6, kind: 'gas', onLand: (x, z) => {
        run.zone({ x, z, r: a.stat('area'), life: a.stat('duration'), dps: a.stat('damage'), slow: 0.35, kind: 'gas', ability: a });
        run.fx.burst(x, 0.5, z, '#9adf5a', 14, 3);
      } });
    },
  },
  {
    id: 'manhole', name: 'Manhole Cover', icon: '🛞', tags: ['thrown', 'projectile'],
    desc: 'Frisbees a manhole cover straight through the pack.',
    base: { damage: 34, cooldown: 3.4, range: 14, speed: 20, area: 1, count: 1 },
    upgrades: [DMG, CD, pctUp('area', 'Size', 18), addUp('count', 'Extra Cover', [0, 0, 1, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const base = angleTo(run, t), n = a.stat('count');
      for (let i = 0; i < n; i++) {
        run.shoot({ x: run.player.x, z: run.player.z, y: 0.7, angle: base + (i - (n - 1) / 2) * 0.35, speed: a.stat('speed'), dmg: a.stat('damage'), range: a.stat('range') * 1.3, pierce: 99, size: 2.6 * a.stat('area'), color: '#5a5e66', ability: a, knock: 5 });
      }
      sfx('tantrum', 0.05);
    },
  },
  {
    id: 'iron_belly', name: 'Iron Belly', icon: '🛡️', tags: ['defense'],
    desc: 'Flexes his belly. Gains a shield that soaks damage.',
    base: { cooldown: 10, power: 30 },
    upgrades: [scUp('power', 'Shield', 10, (v) => `+${Math.round(v)} shield`), CD],
    ready: (run, a) => run.player.shield < a.stat('power') * 0.5 && run.mobs.count(run.player.x, run.player.z, 10) > 0,
    fire(run, a) {
      const p = run.player;
      p.shield = Math.max(p.shield, a.stat('power') * (1 + (run.flags.tonyThorns ? 0.3 : 0)));
      run.fx.ring(p.x, p.z, 1.6, '#9ad8ff', 0.4);
      sfx('select');
    },
  },
  {
    id: 'clap_back', name: 'Clap Back', icon: '👏', tags: ['aoe'],
    desc: 'Claps so hard everything nearby gets dizzy (stunned) and takes a hit.',
    base: { damage: 16, cooldown: 8, area: 6, duration: 1.5 },
    upgrades: [AREA, CD, pctUp('duration', 'Stun', 20), DMG],
    ready: (run, a) => run.mobs.count(run.player.x, run.player.z, a.stat('area')) >= 6,
    fire(run, a) {
      nova(run, a, { r: a.stat('area'), dmg: a.stat('damage'), knock: 2, root: a.stat('duration'), color: '#fff6a0' });
      sfx('tantrum');
    },
  },
  {
    id: 'little_bro', name: 'Little Brother', icon: '👶', tags: ['summon'],
    desc: 'Calls in Little Sal, who punches whatever Tony is punching.',
    base: { damage: 20, cooldown: 14, duration: 12, count: 1 },
    upgrades: [DMG, DUR, addUp('count', 'Extra Bro', [0, 0, 1, 1, 2], null, 4), CD],
    ready: (run) => run.mobs.count(run.player.x, run.player.z, 15) > 0,
    fire(run, a) {
      for (let i = 0; i < a.stat('count'); i++) run.spawnGoon({ ability: a, life: a.stat('duration'), model: 'tony_bro', rate: 0.5 });
    },
  },
];
