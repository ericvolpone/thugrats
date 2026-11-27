import { sfx } from '../../audio.js';
import { TAU, rand } from '../../util.js';
import { pctUp, scUp, addUp, DMG, CD, AREA, DUR, permanentUptime, angleTo, line, nova, chain, chill, buff, AURA_UPS } from '../common.js';

/**
 * Lab Coat 5-piece (flags.teslaFork = damage fraction): every thug a Tesla arc
 * hits forks a side arc to up to 2 more nearby thugs. `seen` keeps forks from
 * zapping the same thug twice in one cast.
 */
function forkArc(run, a, from, dmg, seen) {
  let n = 0;
  run.mobs.each(from.x, from.z, 4.5, (m) => {
    if (n >= 2 || m === from || m.dead || m.hp <= 0 || seen.has(m.id)) return;
    seen.add(m.id);
    n++;
    run.fx.beam(from.x, from.z, m.x, m.z, '#c8ecff', 0.08, 0.14, 1);
    run.hit(m, dmg, a, { knock: 0.3 });
  });
}

/**
 * A slime/acid pool. Alchemist 5-piece (flags.acidMerge = k): a new pool that
 * lands on one of the same ability's live pools merges into it instead, growing
 * it, refreshing its time and stacking its acid (both capped).
 */
function pool(run, a, o) {
  const k = run.flags.acidMerge;
  if (k) {
    const zn = run.combat.zones.find((z) => z.ability === a && z.life - z.t > 0.3 && Math.hypot(z.x - o.x, z.z - o.z) < z.r + o.r * 0.5);
    if (zn) {
      zn.r = Math.min(o.r * (1.5 + 0.25 * k), Math.max(zn.r, Math.hypot(zn.r, o.r * 0.7)));
      zn.life = zn.t + Math.max(zn.life - zn.t, o.life);
      zn.dps = Math.min(o.dps * (1 + 0.5 * k), Math.max(zn.dps, o.dps) + o.dps * 0.25 * k);
      run.fx.ring(zn.x, zn.z, zn.r, '#b8ff5a', 0.4);
      return;
    }
  }
  run.zone(o);
}

/**
 * Professor Pudding — the Mastermind. Weird science: lightning, freeze rays,
 * gravity, slime and little robots.
 */
export const PROF_ABILITIES = [
  {
    id: 'pudding_blaster', name: 'Pudding Blaster', icon: '🍮', tags: ['projectile', 'science'],
    desc: 'Fires wobbly blobs of pudding that splash everyone near the impact.',
    base: { damage: 16, cooldown: 0.7, range: 13, speed: 24, area: 1.8, count: 1 },
    upgrades: [DMG, pctUp('cooldown', 'Fire Rate', 12), AREA, addUp('count', 'Extra Blob', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.targets(run.player.x, run.player.z, a.stat('range'), a.stat('count'), 'nearest'),
    fire(run, a, ts) {
      const n = a.stat('count');
      for (let i = 0; i < n; i++) {
        const t = ts[i % ts.length], m = run.player.muzzlePos();
        run.shoot({ x: m.x, z: m.z, y: m.y, angle: Math.atan2(t.x - m.x, t.z - m.z) + (ts.length < n ? (i - (n - 1) / 2) * 0.15 : 0), speed: a.stat('speed'), dmg: a.stat('damage'), range: a.stat('range') * 1.25, size: 1.6, color: '#e8b86b', ability: a,
          explode: { r: a.stat('area'), dmg: 0.45, color: '#f2d29a' }, onHit: run.flags.stickyPudding ? (mob) => chill(mob, 0.35, 1.5) : null });
      }
      run.player.aim(ts[0].x, ts[0].z);
      sfx('shot', 0.04);
    },
  },
  {
    id: 'tesla', name: 'Tesla Coil', icon: '⚡', tags: ['lightning', 'science'],
    desc: 'Lightning jumps from thug to thug.',
    base: { damage: 30, cooldown: 2.2, range: 12, count: 4 },
    upgrades: [DMG, addUp('count', 'Jumps', [1, 1, 2, 2, 3], null, 14), CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'nearest'),
    fire(run, a, t) {
      const fork = run.flags.teslaFork, seen = fork ? new Set() : null;
      chain(run, a, t, { jumps: a.stat('count') + (run.flags.supercharged ? 3 : 0), range: 6 * (run.flags.teslaReach ?? 1), dmg: a.stat('damage'), falloff: run.flags.supercharged ? 0.95 : 0.85, color: '#9ad8ff',
        onHit: fork ? (m) => { seen.add(m.id); forkArc(run, a, m, a.stat('damage') * fork, seen); } : undefined });
      sfx('shot', 0.05);
    },
  },
  {
    id: 'freeze_ray', name: 'Freeze Ray', icon: '🧊', tags: ['beam', 'science', 'control'],
    desc: 'A beam of cold toward the biggest crowd. Damages and slows everything it touches.',
    base: { damage: 26, cooldown: 3.2, range: 14, area: 0.9, duration: 2.5 },
    upgrades: [DMG, CD, AREA, DUR],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      line(run, a, { angle: angleTo(run, t), len: a.stat('range'), width: a.stat('area'), dmg: a.stat('damage'), knock: 0, color: '#bff0ff',
        onHit: (m) => {
          chill(m, 0.55, a.stat('duration'));
          m.frozenUntil = run.time + a.stat('duration'); // marker only: read by shatter talents / Diving Bell set
          if (run.flags.deepFreeze && Math.random() < 0.2) m.rootT = Math.max(m.rootT, m.tier ? 0.3 : 1.2);
          if (run.flags.freezeRoot) m.rootT = Math.max(m.rootT, m.tier >= 2 ? 0.1 : m.tier ? 0.25 : run.flags.freezeRoot);
        } });
      run.player.aim(t.x, t.z, 0.3);
    },
  },
  {
    id: 'black_hole', name: 'Pocket Black Hole', icon: '🕳️', tags: ['science', 'control'],
    desc: 'A tiny black hole that sucks thugs in and crushes them.',
    base: { damage: 12, cooldown: 10, range: 14, area: 5, duration: 3.5 },
    upgrades: [AREA, DUR, CD, pctUp('damage', 'Crush', 20)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const sing = run.flags.singularity;
      run.zone({ x: t.x, z: t.z, r: a.stat('area'), life: a.stat('duration'), dps: a.stat('damage'), pull: sing ? 10 : 6, kind: 'void', ability: a,
        onTick: (zn) => { if (Math.random() < 0.6) run.fx.burst(zn.x + rand(-zn.r, zn.r), 0.4, zn.z + rand(-zn.r, zn.r), '#b07aff', 1, 1, 0.4, 0.7, 0); } });
      // Singularity capstone: when it collapses it implodes and shrinks whatever is left
      if (sing) {
        const x = t.x, z = t.z, r = a.stat('area') * 1.2;
        run.later(a.stat('duration'), () => {
          run.explode(x, z, r, a.stat('damage') * 8, a, { color: '#b07aff' });
          for (const m of run.mobs.near(x, z, r)) {
            m.shrunk = Math.max(m.shrunkUntil > run.time ? m.shrunk : 0, 0.25);
            m.shrunkUntil = Math.max(m.shrunkUntil ?? 0, run.time + 3);
          }
        });
      }
    },
  },
  {
    id: 'death_ray', name: 'Orbital Death Ray', icon: '🛰️', tags: ['science'],
    desc: 'Points a satellite at the biggest target. A beam from space lands a moment later.',
    base: { damage: 150, cooldown: 9, range: 24, area: 3 },
    upgrades: [DMG, CD, AREA],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest'),
    fire(run, a, t) {
      run.mark(t, 1.0, () => {
        run.fx.tracer(t.x, t.z);
        run.explode(t.x, t.z, a.stat('area'), a.stat('damage'), a, { color: '#ff70d0' });
        sfx('snipe');
      });
    },
  },
  {
    id: 'robo', name: 'Robo-Nanny', icon: '🤖', tags: ['summon', 'science'],
    desc: 'Builds a little robot that zaps nearby thugs.',
    base: { damage: 16, cooldown: 13, duration: 12, count: 1 },
    upgrades: [DMG, DUR, addUp('count', 'Robots', [0, 0, 1, 1, 2], null, 5), CD],
    ready: (run) => run.mobs.count(run.player.x, run.player.z, 15) > 0,
    fire(run, a) {
      const up = run.flags.robotUprising;
      for (let i = 0; i < a.stat('count'); i++) {
        const g = run.combat.spawnGoon({ ability: a, life: a.stat('duration'), model: 'robot', reach: 5, seek: 12, rate: up ? 0.35 : 0.55,
          onAttack: (g, t, dmg) => { run.fx.beam(g.x, g.z, t.x, t.z, '#9ad8ff', 0.1, 0.12, 0.9); run.hit(t, dmg, a, { knock: 0.5 }); if (run.flags.supercharged) chain(run, a, t, { jumps: 1, range: 4, dmg: dmg * 0.6 }); } });
        // Robot Uprising capstone: robots self-destruct when their time runs out
        if (up) run.later(Math.max(0.1, g.life - 0.05), () => { if (run.combat.goons.includes(g)) run.explode(g.x, g.z, 3, a.stat('damage') * 5, a, { color: '#9ad8ff' }); });
      }
    },
  },
  {
    id: 'slime', name: 'Slime Puddle', icon: '🟢', tags: ['science', 'thrown', 'control'],
    desc: 'Lab slime. Thugs stuck in it are slowed and slowly dissolved.',
    base: { damage: 10, cooldown: 5, range: 12, area: 3.4, duration: 5 },
    upgrades: [pctUp('damage', 'Acid', 20), AREA, DUR, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      run.lob({ tx: t.x, tz: t.z, dur: 0.6, kind: 'slime', onLand: (x, z) => pool(run, a, { x, z, r: a.stat('area'), life: a.stat('duration'), dps: a.stat('damage'), slow: 0.5, kind: 'slime', ability: a }) });
    },
  },
  {
    id: 'drones', name: 'Drone Swarm', icon: '🛸', tags: ['orbit', 'science', 'aura'],
    desc: 'Little drones buzz around him nonstop, ramming anything close.',
    base: { damage: 5, count: 2, area: 3.2 },
    upgrades: AURA_UPS('Drones'),
    aura: { model: 'drone', color: '#9aa4b4', spark: '#9ad8ff', spin: 4.5, knock: 2 },
  },
  {
    id: 'force_field', name: 'Force Field', icon: '🔵', tags: ['defense', 'science'],
    desc: 'A bubble that blocks damage and pushes back thugs that touch it.',
    base: { cooldown: 12, power: 35, area: 2.6, damage: 10 },
    upgrades: [scUp('power', 'Shield', 12, (v) => `+${Math.round(v)} shield`), CD, AREA],
    ready: (run, a) => run.player.shield < a.stat('power') * 0.4 && run.mobs.count(run.player.x, run.player.z, 8) > 0,
    fire(run, a) {
      const p = run.player;
      p.shield = Math.max(p.shield, a.stat('power'));
      nova(run, a, { r: a.stat('area'), dmg: a.stat('damage'), knock: 9, color: '#58c4ff' });
      sfx('select');
    },
  },
  {
    id: 'big_brain', name: 'Big Brain Time', icon: '🧠', tags: ['buff'],
    desc: 'Thinks really hard. Every other ability cools down much faster for a while.',
    base: { cooldown: 18, duration: 5, power: 0.5 },
    upgrades: [DUR, scUp('power', 'Brainpower', 0.1, (v) => `+${Math.round(v * 100)}% Recharge Rate`), CD],
    useless: permanentUptime,
    ready: (run, a) => run.crowd(a, 12, 4),
    fire(run, a) {
      buff(run, a, { fx: '#ff8fd0', rate: a.stat('power') });
      run.fx.ring(run.player.x, run.player.z, 3, '#ff8fd0', 0.5);
      sfx('frenzy', 0.1);
    },
  },
  {
    id: 'acid_rain', name: 'Acid Rain', icon: '☔', tags: ['science', 'aoe'],
    desc: 'Seeds a little cloud that drips acid on everything below.',
    base: { damage: 14, cooldown: 9, range: 14, area: 4.5, duration: 4 },
    upgrades: [DMG, AREA, DUR, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const x = t.x, z = t.z;
      pool(run, a, { x, z, r: a.stat('area'), life: a.stat('duration'), dps: a.stat('damage') * 1.4, kind: 'slime', color: '#b8ff5a', ability: a,
        onTick: (zn) => { if (Math.random() < 0.8) { const g = rand(0, TAU), r = Math.sqrt(Math.random()) * zn.r; run.fx.burst(x + Math.sin(g) * r, 3, z + Math.cos(g) * r, '#c8ff6a', 1, 0.5, 0.5, 0.6, 14); } } });
    },
  },
  {
    id: 'shrink_ray', name: 'Shrink Ray', icon: '🔬', tags: ['beam', 'science'],
    desc: 'Zaps the biggest thug. Shrunk targets take a lot more damage for a while.',
    base: { damage: 75, cooldown: 5, range: 16, duration: 4, power: 0.3 },
    upgrades: [DMG, CD, DUR, scUp('power', 'Vulnerability', 0.08, (v) => `+${Math.round(v * 100)}% damage taken`)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest'),
    fire(run, a, t) {
      const m = run.player.muzzlePos();
      run.fx.beam(m.x, m.z, t.x, t.z, '#ff4fa3', 0.15, 0.25, 0.9);
      run.hit(t, a.stat('damage'), a);
      t.shrunkUntil = run.time + a.stat('duration');
      t.shrunk = a.stat('power');
      run.fx.burst(t.x, 1, t.z, '#ff8fd0', 12, 3);
    },
  },
];
