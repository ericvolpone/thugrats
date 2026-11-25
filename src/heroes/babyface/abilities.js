import { sfx } from '../../audio.js';
import { TAU, rand } from '../../util.js';
import { pctUp, scUp, addUp, DMG, CD, AREA, DUR, permanentUptime, angleTo, line, nova, cone, buff } from '../common.js';

/**
 * Babyface Moretti — the Hitman. Slow, enormous shots at the biggest targets,
 * plus tools for when the crowd gets too close.
 */
const rifleShot = (run, a, t, mult = 1, extra = {}) => {
  const m = run.player.muzzlePos();
  run.shoot({ x: m.x, z: m.z, y: m.y, angle: Math.atan2(t.x - m.x, t.z - m.z), speed: 70, dmg: a.stat('damage') * mult, range: a.stat('range') * 1.3,
    pierce: a.stat('pierce'), size: 1.4, color: '#fff2c0', ability: a, knock: 3, ...extra });
};

export const BABYFACE_ABILITIES = [
  {
    id: 'rifle', name: 'Sniper Rifle', icon: '🔭', tags: ['gun', 'projectile'],
    desc: 'One huge shot at the toughest thug in sight. Punches through the ones in front.',
    base: { damage: 62, cooldown: 1.5, range: 22, pierce: 2, count: 1 },
    upgrades: [DMG, pctUp('cooldown', 'Fire Rate', 12), addUp('pierce', 'Pierce', [0, 1, 1, 2, 2], null, 8), addUp('count', 'Extra Shot', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.targets(run.player.x, run.player.z, a.stat('range'), a.stat('count'), 'strongest'),
    fire(run, a, ts) {
      const n = a.stat('count');
      for (let i = 0; i < n; i++) run.later(i * 0.12, () => { const t = ts[i % ts.length]; if (!t.dead) rifleShot(run, a, t); });
      if (Math.random() < (run.flags.doubleTap ?? 0)) run.later(0.2, () => !ts[0].dead && rifleShot(run, a, ts[0]));
      run.player.aim(ts[0].x, ts[0].z, 0.4);
      run.shake(0.08);
      sfx('snipe', 0.05);
    },
  },
  {
    id: 'sawed_off', name: 'Sawed-Off', icon: '💥', tags: ['gun', 'projectile'],
    desc: 'Both barrels into whoever gets too close. Big knockback.',
    base: { damage: 15, cooldown: 2, range: 7, speed: 34, count: 7 },
    upgrades: [DMG, { ...scUp('count', 'Pellets', 2), int: true }, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'nearest'),
    fire(run, a, t) {
      const base = angleTo(run, t), n = a.stat('count');
      for (let i = 0; i < n; i++) run.shoot({ x: run.player.x, z: run.player.z, y: 0.7, angle: base + rand(-0.38, 0.38), speed: a.stat('speed') * rand(0.85, 1.1), dmg: a.stat('damage'), range: a.stat('range') * 1.2, size: 0.8, color: '#ffcf6b', ability: a, knock: 5 });
      run.player.aim(t.x, t.z, 0.3);
      sfx('bigshot', 0.05);
    },
  },
  {
    id: 'hit_list', name: 'Hit List', icon: '📋', tags: ['gun'],
    desc: 'Marks several of the biggest thugs. Snipers on the rooftops take them out.',
    base: { damage: 90, cooldown: 9, range: 26, count: 3 },
    upgrades: [DMG, CD, addUp('count', 'Names', [1, 1, 1, 2, 2], null, 10)],
    ready: (run, a) => run.mobs.targets(run.player.x, run.player.z, a.stat('range'), a.stat('count'), 'strongest'),
    fire(run, a, ts) {
      ts.forEach((t, i) => run.mark(t, 0.8 + i * 0.18, () => {
        if (t.dead) return;
        run.hit(t, a.stat('damage'), a);
        run.fx.tracer(t.x, t.z);
        sfx('snipe', 0.05);
      }));
    },
  },
  {
    id: 'focus', name: 'Deep Breath', icon: '🫁', tags: ['buff'],
    desc: 'Steadies his aim: every ability cools down faster and crits more while it lasts.',
    base: { cooldown: 16, duration: 5, power: 0.35 },
    upgrades: [DUR, scUp('power', 'Focus', 0.08, (v) => `+${Math.round(v * 100)}% focus speed`), CD],
    useless: permanentUptime,
    ready: (run) => run.mobs.count(run.player.x, run.player.z, 14) >= 3,
    fire(run, a) {
      const pw = a.stat('power');
      buff(run, a, { fx: '#ffffff', rate: pw, stats: (s) => { s.crit += 0.15; } });
      sfx('frenzy', 0.1);
    },
  },
  {
    id: 'uzi', name: 'Uzi', icon: '🔫', tags: ['gun', 'projectile'],
    desc: 'Sprays a burst at the nearest thugs.',
    base: { damage: 8, cooldown: 2.6, range: 12, speed: 42, count: 10 },
    upgrades: [DMG, { ...scUp('count', 'Bullets', 3), int: true }, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'nearest'),
    fire(run, a) {
      const n = a.stat('count');
      for (let i = 0; i < n; i++) run.later(i * 0.04, () => {
        const t = run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'nearest');
        if (!t) return;
        run.shoot({ x: run.player.x, z: run.player.z, y: 0.7, angle: angleTo(run, t) + rand(-0.12, 0.12), speed: a.stat('speed'), dmg: a.stat('damage'), range: a.stat('range') * 1.2, size: 0.7, color: '#ffe38a', ability: a });
        sfx('tommy', 0.03);
      });
    },
  },
  {
    id: 'claymore', name: 'Claymore', icon: '🧱', tags: ['explosive', 'trap'],
    desc: 'Plants a directional mine. When it trips it blasts a cone of ball bearings.',
    base: { damage: 55, cooldown: 3.5, area: 6, count: 2 },
    upgrades: [DMG, AREA, addUp('count', 'Max Mines', [0, 1, 1, 1, 2], null, 6), CD],
    ready: (run, a) => run.traps.filter((t) => t.ability === a).length < a.stat('count') && run.mobs.count(run.player.x, run.player.z, 12) > 0,
    fire(run, a) {
      const p = run.player, ang = rand(0, TAU);
      run.trap({ x: p.x + Math.sin(ang) * 1.5, z: p.z + Math.cos(ang) * 1.5, ability: a, trigger: 2.2, onTrigger: (x, z) => {
        const t = run.mobs.target(x, z, 4, 'nearest');
        const dir = t ? Math.atan2(t.x - x, t.z - z) : ang;
        cone(run, a, { x, z, angle: dir, r: a.stat('area'), half: 0.65, dmg: a.stat('damage'), knock: 7, color: '#ffb347' });
        run.fx.explosion(x, z, 1.2);
      } });
    },
  },
  {
    id: 'flashbang', name: 'Flashbang', icon: '⚪', tags: ['thrown', 'control'],
    desc: 'Blinds a whole crowd. Everything in the flash is stunned.',
    base: { damage: 10, cooldown: 9, range: 12, area: 4.2, duration: 1.6 },
    upgrades: [AREA, pctUp('duration', 'Stun', 20), CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      run.lob({ tx: t.x, tz: t.z, dur: 0.5, kind: 'c4', onLand: (x, z) => {
        nova(run, a, { x, z, r: a.stat('area'), dmg: a.stat('damage'), knock: 0, root: a.stat('duration'), color: '#ffffff' });
        run.fx.explosion(x, z, a.stat('area') * 0.6, '#ffffff');
      } });
    },
  },
  {
    id: 'car_bomb', name: 'Car Bomb', icon: '🚙', tags: ['explosive', 'vehicle'],
    desc: 'Rolls a rigged car into the crowd. It explodes at the end of the run.',
    base: { damage: 50, cooldown: 10, range: 16, area: 5 },
    upgrades: [DMG, AREA, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      run.car({ x: t.x, z: t.z, angle: rand(0, TAU), dmg: a.stat('damage') * 0.5, width: 2.4, ability: a });
      run.later(0.74, () => { run.explode(t.x, t.z, a.stat('area'), a.stat('damage'), a); run.shake(0.3); });
    },
  },
  {
    id: 'body_double', name: 'Body Double', icon: '🕴️', tags: ['summon', 'gun'],
    desc: 'Hires a lookalike with a pistol who shoots whatever is nearest.',
    base: { damage: 18, cooldown: 14, duration: 12, count: 1 },
    upgrades: [DMG, DUR, addUp('count', 'Doubles', [0, 0, 1, 1, 2], null, 4), CD],
    ready: (run) => run.mobs.count(run.player.x, run.player.z, 15) > 0,
    fire(run, a) {
      for (let i = 0; i < a.stat('count'); i++) {
        run.spawnGoon({ ability: a, life: a.stat('duration'), model: 'babyface_double', reach: 8, seek: 14, rate: 0.6,
          onAttack: (g, t, dmg) => run.shoot({ x: g.x, z: g.z, y: 0.7, angle: Math.atan2(t.x - g.x, t.z - g.z), speed: 40, dmg, range: 12, ability: a, color: '#fff2c0' }) });
      }
    },
  },
  {
    id: 'silver_bullet', name: 'Silver Bullet', icon: '🥈', tags: ['gun'],
    desc: 'Saved for special occasions. Massive damage to the single biggest target; bonus vs bosses.',
    base: { damage: 300, cooldown: 14, range: 24 },
    upgrades: [DMG, CD],
    ready: (run, a) => { const t = run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest'); return t && t.tier >= 1 ? t : null; },
    fire(run, a, t) {
      const m = run.player.muzzlePos();
      run.fx.beam(m.x, m.z, t.x, t.z, '#e6ecff', 0.18, 0.35, 0.9);
      run.hit(t, a.stat('damage') * (t.tier >= 2 ? 1.5 : 1), a);
      run.player.aim(t.x, t.z, 0.5);
      run.shake(0.2);
      sfx('snipe');
    },
  },
  {
    id: 'ricochet', name: 'Trick Shot', icon: '🎱', tags: ['gun', 'projectile'],
    desc: 'A bullet that bounces from thug to thug.',
    base: { damage: 30, cooldown: 2.4, range: 14, count: 1, bounce: 4 },
    upgrades: [DMG, addUp('bounce', 'Bounces', [1, 1, 2, 2, 3], null, 14), CD, addUp('count', 'Extra Bullet', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'nearest'),
    fire(run, a, t) {
      for (let i = 0; i < a.stat('count'); i++) {
        run.shoot({ x: run.player.x, z: run.player.z, y: 0.7, angle: angleTo(run, t) + i * 0.3, speed: 36, dmg: a.stat('damage'), range: a.stat('range') * 1.2, bounce: a.stat('bounce'), color: '#9affd0', ability: a });
      }
      sfx('shot', 0.05);
    },
  },
  {
    id: 'rain_of_lead', name: 'Rain of Lead', icon: '🌧️', tags: ['gun', 'aoe'],
    desc: 'Every hitman in town opens up on one spot at once.',
    base: { damage: 24, cooldown: 11, range: 16, area: 5, count: 14 },
    upgrades: [DMG, { ...scUp('count', 'Shots', 4), int: true }, CD, AREA],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const n = a.stat('count'), x = t.x, z = t.z;
      run.fx.ring(x, z, a.stat('area'), '#ff4040', 0.6);
      for (let i = 0; i < n; i++) run.later(0.3 + i * 0.05, () => {
        const ang = rand(0, TAU), r = Math.sqrt(Math.random()) * a.stat('area');
        const hx = x + Math.sin(ang) * r, hz = z + Math.cos(ang) * r;
        run.fx.tracer(hx, hz);
        for (const m of run.mobs.near(hx, hz, 1.4)) run.hit(m, a.stat('damage'), a);
      });
    },
  },
];
