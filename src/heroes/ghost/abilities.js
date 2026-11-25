import { sfx } from '../../audio.js';
import { TAU, rand } from '../../util.js';
import { pctUp, scUp, addUp, DMG, CD, AREA, DUR, permanentUptime, angleTo, line, nova, chill, buff } from '../common.js';

/**
 * Lucy "The Ghost" — the Spy. Precise, sneaky, crit-hungry. Lots of control
 * (slows, sleeps) and gadgets.
 */
export const GHOST_ABILITIES = [
  {
    id: 'silenced', name: 'Silenced Pistol', icon: '🔇', tags: ['gun', 'projectile'],
    desc: 'Quiet, quick shots at the nearest thug. Extra crit chance.',
    base: { damage: 12, cooldown: 0.36, range: 14, speed: 44, count: 1, pierce: 0, crit: 0.1 },
    upgrades: [DMG, pctUp('cooldown', 'Fire Rate', 12), addUp('pierce', 'Pierce', [0, 0, 1, 1, 2], null, 4), addUp('count', 'Extra Shot', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.targets(run.player.x, run.player.z, a.stat('range'), a.stat('count'), 'nearest'),
    fire(run, a, ts) {
      const n = a.stat('count');
      for (let i = 0; i < n; i++) {
        const t = ts[i % ts.length];
        const m = run.player.muzzlePos();
        run.shoot({ x: m.x, z: m.z, y: m.y, angle: Math.atan2(t.x - m.x, t.z - m.z) + (ts.length < n ? (i - (n - 1) / 2) * 0.1 : 0), speed: a.stat('speed'), dmg: a.stat('damage'), range: a.stat('range') * 1.25,
          pierce: a.stat('pierce'), bounce: run.flags.ghostRicochet ? 1 : 0, color: '#c8e6ff', ability: a,
          onHit: run.flags.poisonTips ? (mob) => run.ignite(mob, a.stat('damage') * 0.6, 3) : null });
      }
      run.player.aim(ts[0].x, ts[0].z);
      sfx('shot', 0.03);
    },
  },
  {
    id: 'knives', name: 'Throwing Knives', icon: '🔪', tags: ['projectile', 'thrown'],
    desc: 'A fan of knives that slice through anyone in the way.',
    base: { damage: 16, cooldown: 2.2, range: 11, speed: 30, count: 5, pierce: 2 },
    upgrades: [DMG, { ...scUp('count', 'Knives', 2), int: true }, CD, addUp('pierce', 'Pierce', [0, 1, 1, 2, 2], null, 6)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const base = angleTo(run, t), n = a.stat('count');
      for (let i = 0; i < n; i++) run.shoot({ x: run.player.x, z: run.player.z, y: 0.8, angle: base + (i - (n - 1) / 2) * 0.13, speed: a.stat('speed'), dmg: a.stat('damage'), range: a.stat('range') * 1.2, pierce: a.stat('pierce'), size: 0.9, color: '#dfe6ee', ability: a });
      sfx('shot', 0.05);
    },
  },
  {
    id: 'smoke', name: 'Smoke Bomb', icon: '💨', tags: ['control', 'buff'],
    desc: 'Vanishes in smoke: thugs inside are slowed and Lucy dodges a lot more for a while.',
    base: { cooldown: 12, area: 4.2, duration: 4, power: 0.35 },
    upgrades: [DUR, AREA, CD, scUp('power', 'Evasion', 0.06, (v) => `+${Math.round(v * 100)}% dodge in smoke`)],
    useless: permanentUptime,
    ready: (run) => run.mobs.count(run.player.x, run.player.z, 3) >= 2,
    fire(run, a) {
      const p = run.player, pw = a.stat('power');
      run.zone({ x: p.x, z: p.z, r: a.stat('area'), life: a.stat('duration'), slow: 0.5, kind: 'smoke', ability: a });
      buff(run, a, { fx: '#9aa0aa', stats: (s) => { s.dodge += pw; if (run.flags.ambush) s.crit += 0.25; } });
      run.fx.burst(p.x, 0.6, p.z, '#8a8f99', 26, 5, 0.9, 2, -1);
      sfx('select');
    },
  },
  {
    id: 'poison_dart', name: 'Poison Dart', icon: '🎯', tags: ['projectile', 'poison'],
    desc: 'Blowgun darts at the toughest thugs. The poison does far more than the dart.',
    base: { damage: 8, cooldown: 1.6, range: 15, speed: 36, count: 2, power: 75 },
    upgrades: [scUp('power', 'Poison', 22, (v) => `+${Math.round(v)} poison damage`), CD, addUp('count', 'Darts', [0, 1, 1, 1, 2], null, 6)],
    ready: (run, a) => run.mobs.targets(run.player.x, run.player.z, a.stat('range'), a.stat('count'), 'strongest'),
    fire(run, a, ts) {
      for (let i = 0; i < a.stat('count'); i++) {
        const t = ts[i % ts.length];
        run.shoot({ x: run.player.x, z: run.player.z, y: 0.9, angle: angleTo(run, t), speed: a.stat('speed'), dmg: a.stat('damage'), range: a.stat('range') * 1.2, size: 0.6, color: '#8bff6a', ability: a,
          onHit: (m) => run.ignite(m, a.stat('power') * run.stats.dmg, 4) });
      }
    },
  },
  {
    id: 'caltrops', name: 'Caltrops', icon: '📌', tags: ['control', 'trap'],
    desc: 'Scatters jacks behind her. Thugs that step on them are slowed and hurt.',
    base: { damage: 12, cooldown: 4, area: 2.6, duration: 6 },
    upgrades: [DMG, AREA, DUR, CD],
    ready: (run) => run.mobs.count(run.player.x, run.player.z, 10) > 0,
    fire(run, a) {
      const p = run.player;
      run.zone({ x: p.x, z: p.z, r: a.stat('area'), life: a.stat('duration'), dps: a.stat('damage'), slow: 0.45, kind: 'glass', color: '#b8c0cc', ability: a });
    },
  },
  {
    id: 'garrote', name: 'Garrote', icon: '🧶', tags: ['melee', 'execute'],
    desc: 'Sneaks behind the nearest wounded thug and finishes them. Executes regular thugs under the threshold; heavy damage otherwise.',
    base: { damage: 70, cooldown: 2.4, range: 6, execute: 0.35 },
    upgrades: [DMG, CD, addUp('execute', 'Execute', [0.03, 0.05, 0.07, 0.09, 0.12], (v) => `+${Math.round(v * 100)}% execute threshold`, 0.4), pctUp('range', 'Reach', 15)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'nearest'),
    fire(run, a, t) {
      const ex = a.stat('execute');
      const dmg = t.tier === 0 && t.hp / t.maxHp <= ex ? t.hp + 1 : a.stat('damage');
      run.hit(t, dmg, a, { knock: 0 });
      run.fx.burst(t.x, 1, t.z, '#c32020', 10, 4);
      run.player.aim(t.x, t.z, 0.2);
    },
  },
  {
    id: 'decoy', name: 'Cardboard Decoy', icon: '🎭', tags: ['summon'],
    desc: 'Leaves a cardboard cut-out of herself that thugs beat on, then it explodes.',
    base: { damage: 40, cooldown: 12, duration: 6, area: 3.6 },
    upgrades: [DMG, DUR, CD, AREA],
    ready: (run) => run.mobs.count(run.player.x, run.player.z, 6) >= 5,
    fire(run, a) {
      const p = run.player, x = p.x, z = p.z, r = 7;
      run.zone({ x, z, r, life: a.stat('duration'), pull: 2.5, kind: 'smoke', color: '#3a3f4a', ability: a, onTick: (zn) => {
        if (zn.t + 0.02 >= zn.life && !zn.done) { zn.done = true; run.explode(x, z, a.stat('area'), a.stat('damage'), a); }
      } });
      run.fx.burst(x, 0.8, z, '#c8a060', 16, 3);
    },
  },
  {
    id: 'cloak', name: 'Cloak', icon: '🫥', tags: ['buff'],
    desc: 'Turns nearly invisible. Huge crit chance and crit damage while it lasts.',
    base: { cooldown: 15, duration: 4, power: 0.3 },
    upgrades: [DUR, CD, scUp('power', 'Lethality', 0.08, (v) => `+${Math.round(v * 100)}% cloak crit`)],
    useless: permanentUptime,
    ready: (run) => run.mobs.count(run.player.x, run.player.z, 10) >= 3,
    fire(run, a) {
      const pw = a.stat('power');
      buff(run, a, { fx: '#bfc8ff', stats: (s) => { s.crit += pw; s.critDmg += pw * 2; s.dodge += 0.15; } });
      sfx('frenzy', 0.1);
    },
  },
  {
    id: 'tripwire', name: 'Tripwire', icon: '🪢', tags: ['trap', 'control'],
    desc: 'Strings a wire. The first thug to cross it trips everyone nearby into a nap.',
    base: { damage: 20, cooldown: 4.5, area: 4, count: 2, duration: 2 },
    upgrades: [AREA, pctUp('duration', 'Sleep', 20), addUp('count', 'Max Wires', [0, 1, 1, 1, 2], null, 6), DMG],
    ready: (run, a) => run.traps.filter((t) => t.ability === a).length < a.stat('count') && run.mobs.count(run.player.x, run.player.z, 12) > 0,
    fire(run, a) {
      const p = run.player, ang = rand(0, TAU);
      run.trap({ x: p.x + Math.sin(ang) * 2, z: p.z + Math.cos(ang) * 2, ability: a, trigger: 1.5, onTrigger: (x, z) => {
        nova(run, a, { x, z, r: a.stat('area'), dmg: a.stat('damage'), knock: 1, root: a.stat('duration'), color: '#bfc8ff' });
        run.fx.burst(x, 0.5, z, '#d8e0ff', 14, 3);
      } });
    },
  },
  {
    id: 'sleep_gas', name: 'Sleeping Gas', icon: '😪', tags: ['control', 'thrown', 'poison'],
    desc: 'A canister of knockout gas. Thugs inside are slowed to a crawl and poisoned.',
    base: { damage: 6, cooldown: 8, range: 12, area: 3.6, duration: 4 },
    upgrades: [AREA, DUR, CD, pctUp('damage', 'Poison', 20)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      run.lob({ tx: t.x, tz: t.z, dur: 0.6, kind: 'gas', color: '#c8a0ff', onLand: (x, z) => {
        run.zone({ x, z, r: a.stat('area'), life: a.stat('duration'), dps: a.stat('damage'), slow: 0.8, kind: 'gas', color: '#b28cff', ability: a });
      } });
    },
  },
  {
    id: 'shuriken', name: 'Shuriken Ring', icon: '✴️', tags: ['orbit'],
    desc: 'Throwing stars circle her at high speed.',
    base: { damage: 10, cooldown: 8, duration: 5, count: 3, area: 2.8 },
    upgrades: [addUp('count', 'Stars', [1, 1, 1, 2, 2], null, 8), DMG, DUR, AREA, CD],
    useless: permanentUptime,
    ready: (run, a) => !run.orbits.some((o) => o.ability === a) && run.mobs.count(run.player.x, run.player.z, a.stat('area') + 4) > 0,
    fire(run, a) {
      run.orbit({ ability: a, count: a.stat('count'), r: a.stat('area'), life: a.stat('duration'), color: '#c9d2dc', spark: '#ffffff', spin: 7, knock: 1 });
    },
  },
  {
    id: 'laser_watch', name: 'Laser Watch', icon: '⌚', tags: ['beam'],
    desc: 'A wristwatch laser. Cuts a line through everything toward the biggest target.',
    base: { damage: 45, cooldown: 4, range: 16, area: 0.6 },
    upgrades: [DMG, CD, pctUp('range', 'Length', 15), AREA],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest'),
    fire(run, a, t) {
      line(run, a, { angle: angleTo(run, t), len: a.stat('range'), width: a.stat('area'), dmg: a.stat('damage'), knock: 1, color: '#ff3a6a' });
      run.player.aim(t.x, t.z, 0.3);
      sfx('snipe', 0.1);
    },
  },
];
