import { sfx } from '../../audio.js';
import { TAU, rand } from '../../util.js';
import { pctUp, scUp, addUp, DMG, CD, AREA, DUR, permanentUptime, angleTo, line, nova, buff } from '../common.js';

/**
 * Boom-Boom Bianchi — Demolitions. Everything explodes eventually.
 * run.explode(x, z, r, dmg, ability) does the damage, shrapnel and chain talents.
 */
const boom = (run, a, x, z, mult = 1, rMult = 1) => {
  run.explode(x, z, a.stat('area') * rMult, a.stat('damage') * mult, a);
  if (run.flags.napalmBlasts && Math.random() < 0.35) run.zone({ x, z, r: a.stat('area') * 0.6, life: 2.5, dps: a.stat('damage') * 0.25 * (1 + run.stats.burnDmg), kind: 'fire', ability: a });
};

export const BOOM_ABILITIES = [
  {
    id: 'dynamite_stick', name: 'Stick of Dynamite', icon: '🧨', tags: ['explosive', 'thrown'],
    desc: 'Lights a stick and tosses it at the nearest crowd.',
    base: { damage: 24, cooldown: 1.4, range: 13, area: 2.6, count: 1 },
    upgrades: [DMG, CD, AREA, addUp('count', 'Extra Stick', [0, 0, 1, 1, 1], null, 4)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      for (let i = 0; i < a.stat('count'); i++) {
        const tx = t.x + (i ? rand(-2.5, 2.5) : 0), tz = t.z + (i ? rand(-2.5, 2.5) : 0);
        run.lob({ tx, tz, dur: 0.55, kind: 'dynamite', onLand: (x, z) => boom(run, a, x, z) });
      }
      run.player.aim(t.x, t.z, 0.25);
    },
  },
  {
    id: 'pipe_bomb', name: 'Pipe Bomb', icon: '🔩', tags: ['explosive', 'thrown'],
    desc: 'A heavy bomb on a long fuse. Huge blast where it lands.',
    base: { damage: 80, cooldown: 6, range: 14, area: 4.8 },
    upgrades: [DMG, AREA, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      run.lob({ tx: t.x, tz: t.z, dur: 0.8, kind: 'pipe', onLand: (x, z) => {
        run.fx.ring(x, z, a.stat('area'), '#ff5030', 0.9);
        run.later(0.9, () => { boom(run, a, x, z); run.shake(0.3); });
      } });
    },
  },
  {
    id: 'c4', name: 'C4 Charges', icon: '📦', tags: ['explosive', 'trap'],
    desc: 'Sticks charges to the street around him. They blow when a thug steps close.',
    base: { damage: 60, cooldown: 2.6, area: 3.8, count: 3, range: 12 },
    upgrades: [DMG, AREA, addUp('count', 'Max Charges', [0, 1, 1, 2, 2], null, 8), CD],
    ready: (run, a) => run.traps.filter((t) => t.ability === a).length < a.stat('count') && run.mobs.count(run.player.x, run.player.z, a.stat('range')) > 0,
    fire(run, a) {
      const p = run.player, ang = rand(0, TAU), r = rand(1, 3);
      run.trap({ x: p.x + Math.sin(ang) * r, z: p.z + Math.cos(ang) * r, ability: a, trigger: 1.8, onTrigger: (x, z) => boom(run, a, x, z) });
    },
  },
  {
    id: 'firecrackers', name: 'Firecrackers', icon: '🎆', tags: ['explosive', 'thrown'],
    desc: 'Throws a fistful of firecrackers that pop all over the place.',
    base: { damage: 12, cooldown: 3, range: 11, area: 1.6, count: 6 },
    upgrades: [DMG, { ...scUp('count', 'Crackers', 2), int: true }, CD, AREA],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const n = a.stat('count');
      for (let i = 0; i < n; i++) {
        run.later(i * 0.05, () => run.lob({ tx: t.x + rand(-3.5, 3.5), tz: t.z + rand(-3.5, 3.5), dur: rand(0.4, 0.7), kind: 'firework', small: true,
          onLand: (x, z) => run.explode(x, z, a.stat('area'), a.stat('damage'), a, { small: true, color: ['#ff4fa3', '#ffd23f', '#58c4ff'][i % 3] }) }));
      }
      sfx('tommy', 0.05);
    },
  },
  {
    id: 'bazooka', name: 'Toy Bazooka', icon: '🚀', tags: ['explosive', 'projectile'],
    desc: 'Fires a rocket at the biggest target. Explodes on the first thing it hits.',
    base: { damage: 70, cooldown: 3.5, range: 18, speed: 26, area: 3, count: 1 },
    upgrades: [DMG, CD, AREA, addUp('count', 'Extra Rocket', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest'),
    fire(run, a, t) {
      const base = angleTo(run, t), n = a.stat('count');
      for (let i = 0; i < n; i++) {
        run.shoot({ x: run.player.x, z: run.player.z, y: 0.9, angle: base + (i - (n - 1) / 2) * 0.2, speed: a.stat('speed'), dmg: a.stat('damage') * 0.4, range: a.stat('range') * 1.3, size: 2.2, color: '#ff7a3a', ability: a,
          onHit: (m, b) => { b.left = 0; boom(run, a, b.x, b.z, 0.8); } });
      }
      run.player.aim(t.x, t.z, 0.3);
      sfx('bigshot');
    },
  },
  {
    id: 'napalm', name: 'Napalm Jar', icon: '🫙', tags: ['fire', 'thrown'],
    desc: 'Grandma\'s "jam". Leaves a big burning puddle.',
    base: { damage: 14, cooldown: 5.5, range: 13, area: 3.4, duration: 5 },
    upgrades: [pctUp('damage', 'Burn Damage', 20), AREA, DUR, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      run.lob({ tx: t.x, tz: t.z, dur: 0.7, kind: 'molotov', onLand: (x, z) => {
        run.zone({ x, z, r: a.stat('area'), life: a.stat('duration'), dps: a.stat('damage') * (1 + run.stats.burnDmg), kind: 'fire', ability: a });
        run.fx.burst(x, 0.4, z, '#ff7a1a', 16, 5);
      } });
    },
  },
  {
    id: 'mortar', name: 'Mortar Strike', icon: '🎯', tags: ['explosive'],
    desc: 'Calls in shells from a toy mortar across the street. They rain down on a wide area.',
    base: { damage: 34, cooldown: 9, range: 16, area: 2.8, count: 6 },
    upgrades: [DMG, { ...scUp('count', 'Shells', 2), int: true }, CD, AREA],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const n = a.stat('count');
      for (let i = 0; i < n; i++) {
        const ang = rand(0, TAU), r = rand(0, 5);
        const x = t.x + Math.sin(ang) * r, z = t.z + Math.cos(ang) * r;
        run.later(0.25 + i * 0.12, () => {
          run.fx.ring(x, z, a.stat('area'), '#ff5030', 0.35);
          run.later(0.35, () => boom(run, a, x, z));
        });
      }
    },
  },
  {
    id: 'sticky_bomb', name: 'Sticky Bomb', icon: '🍬', tags: ['explosive'],
    desc: 'Sticks a gum-bomb on the toughest thug. It goes off a moment later.',
    base: { damage: 110, cooldown: 4.5, range: 14, area: 3.4 },
    upgrades: [DMG, CD, AREA],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest'),
    fire(run, a, t) {
      run.mark(t, 1.1, () => boom(run, a, t.x, t.z));
      run.fx.beam(run.player.x, run.player.z, t.x, t.z, '#ff8fd0', 0.08, 0.2, 0.9);
    },
  },
  {
    id: 'rockets', name: 'Bottle Rockets', icon: '🎇', tags: ['explosive', 'projectile'],
    desc: 'A volley of bottle rockets that wobble toward random thugs.',
    base: { damage: 20, cooldown: 4, range: 14, speed: 22, area: 2, count: 5 },
    upgrades: [DMG, { ...scUp('count', 'Rockets', 2), int: true }, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'nearest'),
    fire(run, a) {
      const p = run.player, n = a.stat('count');
      const ts = run.mobs.targets(p.x, p.z, a.stat('range'), n * 2, 'nearest');
      for (let i = 0; i < n; i++) {
        const t = ts[Math.floor(Math.random() * ts.length)];
        if (!t) break;
        run.later(i * 0.07, () => run.shoot({ x: p.x, z: p.z, y: 1, angle: angleTo(run, t) + rand(-0.25, 0.25), speed: a.stat('speed'), dmg: a.stat('damage') * 0.4, range: a.stat('range') * 1.3, size: 1.2, color: '#ff4fa3', ability: a,
          onHit: (m, b) => { b.left = 0; run.explode(b.x, b.z, a.stat('area'), a.stat('damage'), a, { small: true, color: '#ff8fd0' }); } }));
      }
      sfx('tommy');
    },
  },
  {
    id: 'gas_trail', name: 'Gas Can', icon: '⛽', tags: ['fire'],
    desc: 'Leaves a trail of burning gasoline behind him as he runs.',
    base: { damage: 10, cooldown: 0.5, area: 1.4, duration: 3 },
    upgrades: [pctUp('damage', 'Burn Damage', 20), DUR, AREA],
    ready: (run) => run.player.moving && run.mobs.count(run.player.x, run.player.z, 14) > 0,
    fire(run, a) {
      run.zone({ x: run.player.x, z: run.player.z, r: a.stat('area'), life: a.stat('duration'), dps: a.stat('damage') * (1 + run.stats.burnDmg), kind: 'fire', ability: a });
    },
  },
  {
    id: 'big_one', name: 'The Big One', icon: '☢️', tags: ['explosive', 'aoe'],
    desc: 'Pulls the big red lever. A massive blast centred on Boom-Boom (he\'s fine, mostly).',
    base: { damage: 90, cooldown: 22, area: 8 },
    upgrades: [DMG, CD, AREA],
    ready: (run, a) => run.crowd(a, a.stat('area'), 10),
    fire(run, a) {
      const p = run.player;
      run.fx.ring(p.x, p.z, a.stat('area'), '#ffef5a', 0.9);
      run.later(0.6, () => { boom(run, a, p.x, p.z); run.fx.explosion(p.x, p.z, a.stat('area') * 0.7, '#fff3a0'); run.shake(0.5); });
    },
  },
  {
    id: 'rc_car', name: 'RC Car Bomb', icon: '🏎️', tags: ['explosive', 'vehicle'],
    desc: 'A remote-control car rigged with explosives. Drives through the crowd and blows up.',
    base: { damage: 36, cooldown: 7, range: 16, area: 4, count: 1 },
    upgrades: [DMG, CD, AREA, addUp('count', 'Extra Car', [0, 0, 1, 1, 2], null, 4)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      for (let i = 0; i < a.stat('count'); i++) {
        run.later(i * 0.3, () => {
          const ang = rand(0, TAU);
          run.car({ x: t.x, z: t.z, angle: ang, dmg: a.stat('damage'), width: 1.6, ability: a });
          run.later(0.72, () => boom(run, a, t.x + rand(-1, 1), t.z + rand(-1, 1), 1.2));
        });
      }
    },
  },
];
