import { sfx } from '../../audio.js';
import { TAU, rand } from '../../util.js';
import { pctUp, scUp, addUp, DMG, CD, AREA, DUR, permanentUptime, angleTo, line, nova, cone, buff } from '../common.js';

/**
 * Babyface Moretti — the Hitman. Slow, enormous shots at the biggest targets,
 * plus tools for when the crowd gets too close.
 */
const rifleShot = (run, a, t, mult = 1, extra = {}) => {
  const m = run.player.muzzlePos(), f = run.flags;
  // Held Breath: pierce everything while Deep Breath is up
  const pierce = f.breathPierce && run.buffs.focus ? 99 : a.stat('pierce');
  // Wiseguy (3): each thug hit makes the rest of the shot hit harder · One Shot One Kill: execute
  const ramp = f.pierceRamp ?? 0, exec = f.oneShot ?? 0;
  const onHit = ramp || exec ? (mob, b) => {
    if (exec && !mob.dead && mob.tier < 3 && mob.hp / mob.maxHp < (mob.tier >= 2 ? exec / 2 : exec)) run.hit(mob, mob.hp + 1, a, { noCrit: true, color: '#ff3030' });
    if (ramp) b.dmg *= 1 + ramp;
    extra.onHit?.(mob, b);
  } : extra.onHit;
  run.shoot({ x: m.x, z: m.z, y: m.y, angle: Math.atan2(t.x - m.x, t.z - m.z), speed: 70, dmg: a.stat('damage') * mult, range: a.stat('range') * 1.3,
    pierce, size: 1.4, color: '#fff2c0', ability: a, knock: 3, ...extra, bounce: f.rifleRicochet ?? 0, onHit });
};

/** Is this thug on the Hit List right now? (only tracked when run.flags.listMark is on) */
export const listed = (run, m) => m.listedUntil > run.time;

/** The Claymore's cone blast. `link` = how deep in a Cleanup Crew chain this mine is. */
function claymoreBlast(run, a, x, z, ang, link = 0) {
  const t = run.mobs.target(x, z, 4, 'nearest');
  const dir = t ? Math.atan2(t.x - x, t.z - z) : ang;
  const boost = 1 + link * (run.flags.trapChainDmg ?? 0);
  cone(run, a, { x, z, angle: dir, r: a.stat('area'), half: 0.65, dmg: a.stat('damage') * boost, knock: 7, color: '#ffb347' });
  run.fx.explosion(x, z, 1.2);
  if (run.flags.trapChain) chainClaymores(run, x, z, link + 1);
}

/** Plant a Claymore at (x, z). extra = from a talent/set (doesn't count toward Max Mines). */
export function plantClaymore(run, a, x, z, { extra = false, ang = rand(0, TAU) } = {}) {
  run.trap({ x, z, ability: a, extra, trigger: 2.2, onTrigger: (tx, tz, link = 0) => claymoreBlast(run, a, tx, tz, ang, link) });
}

/** Cleanup Crew (5): every Claymore within run.flags.trapChain of (x, z) goes off, one after another. */
export function chainClaymores(run, x, z, link = 1) {
  const R = run.flags.trapChain ?? 0;
  if (!R) return;
  for (const t of [...run.traps]) {
    if (t.ability?.def?.id !== 'claymore' || (t.x - x) ** 2 + (t.z - z) ** 2 > R * R) continue;
    const i = run.traps.indexOf(t);
    if (i < 0) continue;
    run.traps.splice(i, 1);
    run.scene.remove(t.mesh);
    run.fx.beam(x, z, t.x, t.z, '#ffb347', 0.08, 0.15, 0.3);
    run.later(0.12, () => t.onTrigger(t.x, t.z, link));
  }
}

/** Rain of Lead: `n` shots over the ability's area around (x, z). */
export function rainAt(run, a, x, z, n) {
  run.fx.ring(x, z, a.stat('area'), '#ff4040', 0.6);
  for (let i = 0; i < n; i++) run.later(0.3 + i * 0.05, () => {
    const ang = rand(0, TAU), r = Math.sqrt(Math.random()) * a.stat('area');
    const hx = x + Math.sin(ang) * r, hz = z + Math.cos(ang) * r;
    run.fx.tracer(hx, hz);
    for (const m of run.mobs.near(hx, hz, 1.4)) run.hit(m, a.stat('damage'), a);
  });
}

export const BABYFACE_ABILITIES = [
  {
    id: 'rifle', name: 'Sniper Rifle', icon: '🔭', tags: ['gun', 'projectile'],
    desc: 'One huge shot at the toughest thug in sight. Punches through the ones in front.',
    base: { damage: 62, cooldown: 1.5, range: 22, pierce: 2, count: 1 },
    upgrades: [DMG, pctUp('cooldown', 'Fire Rate', 12), addUp('pierce', 'Pierce', [0, 1, 1, 2, 2], null, 8), addUp('count', 'Extra Shot', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => {
      const n = a.stat('count'), r = a.stat('range');
      const ts = run.mobs.targets(run.player.x, run.player.z, r, n, 'strongest');
      // Lock On: Hit List targets first, from a little farther away
      if (run.flags.listLock) {
        const hl = run.mobs.targets(run.player.x, run.player.z, r * 1.25, 60, 'strongest').filter((m) => listed(run, m));
        if (hl.length) return [...hl, ...ts.filter((m) => !hl.includes(m))].slice(0, n);
      }
      return ts;
    },
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
      const n = a.stat('count'), f = run.flags;
      const blast = (tt, mult) => {
        const base = angleTo(run, tt);
        for (let i = 0; i < n; i++) run.shoot({ x: run.player.x, z: run.player.z, y: 0.7, angle: base + rand(-0.38, 0.38), speed: a.stat('speed') * rand(0.85, 1.1), dmg: a.stat('damage') * mult, range: a.stat('range') * 1.2, size: 0.8, color: '#ffcf6b', ability: a, knock: 5, pierce: f.closePierce ?? 0 });
      };
      blast(t, 1);
      // Tea House (5): the off-hand barrel at a different thug
      if (f.dualWield) {
        const t2 = run.mobs.targets(run.player.x, run.player.z, a.stat('range') * 1.3, 2, 'nearest').find((m) => m !== t) ?? t;
        run.later(0.08, () => blast(t2.dead ? t : t2, f.dualWield));
      }
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
      if (run.flags.listMark) for (const t of ts) t.listedUntil = run.time + 8;
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
    ready: (run, a) => run.crowd(a, 14, 3),
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
      const n = a.stat('count'), f = run.flags;
      for (let i = 0; i < n; i++) run.later(i * 0.04, () => {
        const t = run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'nearest');
        if (!t) return;
        run.shoot({ x: run.player.x, z: run.player.z, y: 0.7, angle: angleTo(run, t) + rand(-0.12, 0.12), speed: a.stat('speed'), dmg: a.stat('damage'), range: a.stat('range') * 1.2, size: 0.7, color: '#ffe38a', ability: a, pierce: f.closePierce ?? 0 });
        sfx('tommy', 0.03);
      });
      // Tea House (5): the off-hand Uzi sprays the second-nearest thug
      if (f.dualWield) for (let i = 0; i < n; i++) run.later(0.02 + i * 0.04, () => {
        const ts = run.mobs.targets(run.player.x, run.player.z, a.stat('range'), 2, 'nearest');
        const t = ts[1] ?? ts[0];
        if (!t) return;
        run.shoot({ x: run.player.x, z: run.player.z, y: 0.7, angle: angleTo(run, t) + rand(-0.12, 0.12), speed: a.stat('speed'), dmg: a.stat('damage') * f.dualWield, range: a.stat('range') * 1.2, size: 0.7, color: '#ffb0d0', ability: a, pierce: f.closePierce ?? 0 });
      });
    },
  },
  {
    id: 'claymore', name: 'Claymore', icon: '🧱', tags: ['explosive', 'trap'],
    plant: plantClaymore, // for talents/sets: p.def.plant(run, p, x, z, {extra, ang})
    desc: 'Plants a directional mine. When it trips it blasts a cone of ball bearings.',
    base: { damage: 55, cooldown: 3.5, area: 6, count: 2 },
    upgrades: [DMG, AREA, addUp('count', 'Max Mines', [0, 1, 1, 1, 2], null, 6), CD],
    ready: (run, a) => run.traps.filter((t) => t.ability === a && !t.extra).length < a.stat('count') && run.mobs.count(run.player.x, run.player.z, 12) > 0,
    fire(run, a) {
      const p = run.player, ang = rand(0, TAU);
      plantClaymore(run, a, p.x + Math.sin(ang) * 1.5, p.z + Math.cos(ang) * 1.5, { ang });
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
        // Blinding Light: thugs stay blinded a while after the stun wears off
        const blind = run.flags.flashBlind ? (m) => { m.blindUntil = run.time + a.stat('duration') + run.flags.flashBlind; } : undefined;
        nova(run, a, { x, z, r: a.stat('area'), dmg: a.stat('damage'), knock: 0, root: a.stat('duration'), color: '#ffffff', onHit: blind });
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
      run.later(0.74, () => {
        run.explode(t.x, t.z, a.stat('area'), a.stat('damage'), a);
        run.shake(0.3);
        if (run.flags.trapChain) chainClaymores(run, t.x, t.z); // Cleanup Crew (5)
      });
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
    ready: (run, a) => {
      const t = run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest');
      if (t && t.tier >= 1) return t;
      // Dealer (5): Silver Bullet will also take a Hit List name of any size
      if (run.flags.silverListed) return run.mobs.targets(run.player.x, run.player.z, a.stat('range'), 60, 'strongest').find((m) => listed(run, m)) ?? null;
      return null;
    },
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
      const f = run.flags, manual = f.trickRamp || f.trickCrit;
      for (let i = 0; i < a.stat('count'); i++) {
        // Shooting Gallery: the bullet deals its own damage so bounces can ramp / crit
        // (dmg 0 makes the engine's hit a no-op; onHit does the real one).
        let d = a.stat('damage'), hits = 0;
        const onHit = manual ? (m, b) => {
          if (m.dead) return;
          const o = { knock: 0.8, fromX: b.x - b.vx, fromZ: b.z - b.vz };
          if (f.trickCrit && hits > 0) run.hit(m, d * (1 + run.stats.critDmg), a, { ...o, noCrit: true, color: '#ffd23f' });
          else run.hit(m, d, a, o);
          hits++;
          if (f.trickRamp) d *= 1 + f.trickRamp;
        } : undefined;
        run.shoot({ x: run.player.x, z: run.player.z, y: 0.7, angle: angleTo(run, t) + i * 0.3, speed: 36, dmg: manual ? 0 : a.stat('damage'), range: a.stat('range') * 1.2, bounce: a.stat('bounce'), color: '#9affd0', ability: a, onHit });
      }
      sfx('shot', 0.05);
    },
  },
  {
    id: 'rain_of_lead', name: 'Rain of Lead', icon: '🌧️', tags: ['gun', 'aoe'],
    rainAt, // for talents/sets: p.def.rainAt(run, p, x, z, n)
    desc: 'Every hitman in town opens up on one spot at once.',
    base: { damage: 24, cooldown: 11, range: 16, area: 5, count: 14 },
    upgrades: [DMG, { ...scUp('count', 'Shots', 4), int: true }, CD, AREA],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      rainAt(run, a, t.x, t.z, a.stat('count'));
    },
  },
];
