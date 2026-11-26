import { sfx } from '../../audio.js';
import { TAU, rand } from '../../util.js';

/**
 * Lenny "Nickles" — ability kit. Every ability fires on its own when ready()
 * returns a target (anything truthy). a.stat(key) gives the fully modified value
 * (upgrades, talents, gear, run stats).
 *
 * upgrades: stat = which stat grows · kind 'pct' adds % (cooldown = faster),
 * 'add' adds flat.
 *   v       common roll; higher tiers roll bigger (tiers.TIER_MULT) and every roll
 *           shrinks the more of that stat the ability already has.
 *   values  flat per-tier amounts instead (0 = not offered at that tier), for
 *           whole-number upgrades like extra bullets. `max` caps the total.
 * useless(a, stat) — return true to stop offering a stat that no longer helps.
 */
import { pctUp, scUp, addUp, DMG, CD, AREA, DUR, AURA_UPS, permanentUptime } from '../common.js';

/** Fire one bullet from Lenny's gun at angle `ang`. */
function bullet(run, a, ang, extra = {}) {
  const m = run.player.muzzlePos();
  run.shoot({
    x: m.x, z: m.z, y: m.y, angle: ang,
    speed: a.stat('speed'), dmg: a.stat('damage'), range: a.stat('range') * 1.25,
    pierce: a.stat('pierce'), bounce: run.flags.ricochet && a.def.id === 'pistol' ? 1 : 0,
    explode: run.flags.explosiveRounds && a.def.id === 'pistol' ? { r: 1.8 * (1 + run.stats.area), dmg: 0.45 } : null,
    ability: a, kind: 'bullet', ...extra,
  });
}

export const LENNY_ABILITIES = [
  {
    id: 'pistol', name: 'Snub-Nose .38', icon: '🔫', tags: ['gun', 'projectile'],
    desc: 'Pops the toughest thug in range.',
    base: { damage: 14, cooldown: 0.5, range: 15, speed: 38, count: 1, pierce: 0 },
    upgrades: [DMG, pctUp('cooldown', 'Fire Rate', 12), addUp('pierce', 'Pierce', [0, 0, 1, 1, 2], null, 5), addUp('count', 'Extra Bullet', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.targets(run.player.x, run.player.z, a.stat('range'), a.stat('count') + (run.flags.akimbo ? 1 : 0), 'strongest'),
    fire(run, a, targets) {
      if (!targets.length) return false;
      const n = a.stat('count') + (run.flags.akimbo ? 1 : 0);
      const shots = Math.random() < (run.flags.doubleTap ?? 0) ? 2 : 1;
      for (let s = 0; s < shots; s++) {
        for (let i = 0; i < n; i++) {
          const t = targets[i % targets.length];
          const lead = 0.06 * s;
          const spread = targets.length < n ? (i - (n - 1) / 2) * 0.12 : 0;
          run.later(lead, () => {
            const m = run.player.muzzlePos();
            bullet(run, a, Math.atan2(t.x - m.x, t.z - m.z) + spread);
          });
        }
      }
      run.player.aim(targets[0].x, targets[0].z);
      sfx('shot', 0.05);
    },
  },
  {
    id: 'frenzy', name: 'Frenzy', icon: '😤', tags: ['buff'],
    desc: 'Goes nuts: faster fire rate and every other ability cools down faster while it lasts.',
    base: { cooldown: 16, duration: 5, power: 0.5, range: 12 },
    upgrades: [DUR, scUp('power', 'Fury', 0.12, (v) => `+${Math.round(v * 100)}% frenzy speed`), CD],
    useless: permanentUptime,
    ready: (run, a) => run.mobs.count(run.player.x, run.player.z, a.stat('range')) > 0,
    fire(run, a) {
      run.buffs.frenzy = { t: a.stat('duration'), max: a.stat('duration'), power: a.stat('power') };
      run.fx.ring(run.player.x, run.player.z, 3, '#ff3b3b', 0.5);
      sfx('frenzy');
    },
  },
  {
    id: 'power_shot', name: 'Hollow Point', icon: '💥', tags: ['gun', 'projectile'],
    desc: 'A huge slug that punches through every thug in a line. Aims for the biggest one.',
    base: { damage: 60, cooldown: 4.2, range: 20, speed: 55, count: 1, pierce: 99, area: 1 },
    upgrades: [pctUp('damage', 'Damage', 24), CD, pctUp('area', 'Slug Size', 18), addUp('count', 'Extra Slug', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest'),
    fire(run, a, t) {
      const m = run.player.muzzlePos();
      const base = Math.atan2(t.x - m.x, t.z - m.z);
      const n = a.stat('count');
      for (let i = 0; i < n; i++) {
        run.shoot({ x: m.x, z: m.z, y: m.y, angle: base + (i - (n - 1) / 2) * 0.18, speed: a.stat('speed'), dmg: a.stat('damage'),
          range: a.stat('range') * 1.4, pierce: 99, size: 2.2 * a.stat('area'), kind: 'slug', color: '#bff3ff', ability: a, knock: 4 });
      }
      run.player.aim(t.x, t.z, 0.4);
      run.shake(0.15);
      sfx('bigshot');
    },
  },
  {
    id: 'pineapple', name: 'Pineapple', icon: '🍍', tags: ['explosive', 'thrown'],
    desc: 'Lobs a grenade into the thickest crowd.',
    base: { damage: 30, cooldown: 3.2, range: 14, area: 3.2, count: 1 },
    upgrades: [DMG, AREA, CD, addUp('count', 'Extra Grenade', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const n = a.stat('count');
      for (let i = 0; i < n; i++) {
        const tx = t.x + (i ? rand(-3, 3) : 0), tz = t.z + (i ? rand(-3, 3) : 0);
        run.lob({ tx, tz, dur: 0.7, kind: 'grenade', onLand: (x, z) => {
          run.explode(x, z, a.stat('area'), a.stat('damage'), a);
          if (run.flags.clusterBomb) {
            for (let k = 0; k < 3; k++) {
              const ang = (k / 3) * TAU + rand(0, 1);
              run.lob({ x, z, tx: x + Math.sin(ang) * 3.5, tz: z + Math.cos(ang) * 3.5, dur: 0.45, kind: 'grenade', small: true,
                onLand: (x2, z2) => run.explode(x2, z2, a.stat('area') * 0.6, a.stat('damage') * 0.4, a) });
            }
          }
        } });
      }
    },
  },
  {
    id: 'tommy', name: 'Chicago Typewriter', icon: '🎻', tags: ['gun', 'projectile'],
    desc: 'Pulls a tommy gun out of a violin case and sprays a cone of lead.',
    base: { damage: 7, cooldown: 3.2, range: 13, speed: 40, count: 8, spread: 0.55, pierce: 0 },
    upgrades: [DMG, { ...scUp('count', 'Bullets', 2), int: true }, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const n = a.stat('count');
      const spread = a.stat('spread');
      for (let i = 0; i < n; i++) {
        run.later(i * 0.05, () => {
          const m = run.player.muzzlePos();
          const ang = Math.atan2(t.x - m.x, t.z - m.z) + rand(-spread, spread) * 0.5;
          bullet(run, a, ang, { color: '#ffd36b' });
          run.player.aim(t.x, t.z, 0.15);
          sfx('tommy', 0.04);
        });
      }
    },
  },
  {
    id: 'molotov', name: 'Molotov', icon: '🍾', tags: ['fire', 'thrown'],
    desc: 'A bottle of grandpa\'s grappa. Leaves a burning puddle.',
    base: { damage: 9, cooldown: 5, range: 13, area: 2.8, duration: 4 },
    upgrades: [pctUp('damage', 'Burn Damage', 20), DUR, AREA, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      run.lob({ tx: t.x, tz: t.z, dur: 0.75, kind: 'molotov', onLand: (x, z) => {
        run.zone({ x, z, r: a.stat('area'), life: a.stat('duration'), dps: a.stat('damage') * (1 + run.stats.burnDmg), kind: 'fire', ability: a });
        run.fx.burst(x, 0.4, z, '#ff7a1a', 14, 5);
      } });
    },
  },
  {
    id: 'cement', name: 'Cement Shoes', icon: '🪣', tags: ['thrown', 'control'],
    desc: 'Dumps quick-dry cement: roots everything for a moment, then slows.',
    base: { damage: 16, cooldown: 7, range: 12, area: 3.6, duration: 3 },
    upgrades: [AREA, DUR, CD, DMG],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      run.lob({ tx: t.x, tz: t.z, dur: 0.6, kind: 'cement', onLand: (x, z) => {
        const r = a.stat('area');
        for (const m of run.mobs.near(x, z, r)) {
          run.hit(m, a.stat('damage'), a);
          m.rootT = Math.max(m.rootT, m.tier >= 2 ? 0.3 : 1.2);
        }
        run.zone({ x, z, r, life: a.stat('duration'), slow: 0.55, kind: 'cement', ability: a });
        run.fx.burst(x, 0.3, z, '#b9b4aa', 16, 4);
      } });
    },
  },
  {
    id: 'driveby', name: 'Drive-By', icon: '🚗', tags: ['vehicle'],
    desc: 'Cousin Sal comes screaming through in the family sedan.',
    base: { damage: 42, cooldown: 8, range: 16, count: 1, area: 1 },
    upgrades: [DMG, CD, addUp('count', 'Extra Car', [0, 0, 1, 1, 2], null, 4)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      const n = a.stat('count');
      for (let i = 0; i < n; i++) {
        run.later(i * 0.35, () => {
          const ang = rand(0, TAU);
          run.car({ x: t.x, z: t.z, angle: ang, dmg: a.stat('damage'), width: 2.4 * a.stat('area'), ability: a });
        });
      }
    },
  },
  {
    id: 'dynamite', name: 'Dynamite Trap', icon: '🧨', tags: ['explosive', 'trap'],
    desc: 'Drops a bundle of dynamite at your feet. Goes off when a thug walks close.',
    base: { damage: 50, cooldown: 3.5, area: 3.6, count: 2, range: 10 },
    upgrades: [DMG, AREA, addUp('count', 'Max Traps', [0, 1, 1, 2, 2], null, 6), CD],
    ready: (run, a) => run.traps.filter((t) => t.ability === a).length < a.stat('count') && run.mobs.count(run.player.x, run.player.z, a.stat('range')) > 0,
    fire(run, a) {
      run.trap({ x: run.player.x, z: run.player.z, ability: a, trigger: 1.6, onTrigger: (x, z) => run.explode(x, z, a.stat('area'), a.stat('damage'), a) });
    },
  },
  {
    id: 'tantrum', name: 'Tantrum', icon: '😭', tags: ['aoe'],
    desc: 'Screams, kicks and flails. Damages and knocks back everything close.',
    base: { damage: 18, cooldown: 5, area: 4.5, knock: 9 },
    upgrades: [DMG, AREA, CD],
    ready: (run, a) => {
      const p = run.player;
      return run.crowd(a, a.stat("area"), 3) || run.mobs.count(p.x, p.z, 2.2) > 0;
    },
    fire(run, a) {
      const p = run.player;
      const r = a.stat('area');
      for (const m of run.mobs.near(p.x, p.z, r)) run.hit(m, a.stat('damage'), a, { knock: a.stat('knock'), fromX: p.x, fromZ: p.z });
      run.fx.ring(p.x, p.z, r, '#ffffff', 0.35);
      run.fx.burst(p.x, 0.6, p.z, '#9ad8ff', 18, 7);
      run.shake(0.2);
      sfx('tantrum');
    },
  },
  {
    id: 'goon', name: 'Hired Goon', icon: '🏏', tags: ['summon'],
    desc: 'Calls in a cousin with a baseball bat for a while.',
    base: { damage: 16, cooldown: 14, duration: 10, count: 1 },
    upgrades: [DMG, DUR, addUp('count', 'Extra Goon', [0, 0, 1, 1, 2], null, 4), CD],
    ready: (run, a) => run.mobs.count(run.player.x, run.player.z, 15) > 0,
    fire(run, a) {
      for (let i = 0; i < a.stat('count'); i++) run.spawnGoon({ ability: a, life: a.stat('duration') });
    },
  },
  {
    id: 'make_it_rain', name: 'Make It Rain', icon: '💸', tags: ['orbit', 'aura'],
    desc: 'Stacks of cash whirl around you nonstop, smacking anyone who gets close.',
    base: { damage: 5, count: 2, area: 2.8 },
    upgrades: AURA_UPS('Cash Stacks'),
    aura: { color: '#3da35a', spark: '#7be495', spin: 3.6, knock: 3 },
  },
  {
    id: 'contract', name: 'Hit Contract', icon: '📜', tags: ['gun'],
    desc: 'Puts a price on the biggest head around. A sniper collects a second later.',
    base: { damage: 190, cooldown: 10, range: 30, execute: 0 },
    upgrades: [DMG, CD, addUp('execute', 'Execute', [0, 0, 0.05, 0.08, 0.12], (v) => `+${Math.round(v * 100)}% execute`, 0.3)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest'),
    fire(run, a, t) {
      run.mark(t, 1.0, () => {
        if (t.dead) return;
        const ex = a.stat('execute');
        const exec = ex > 0 && t.tier < 3 && t.hp / t.maxHp <= ex;
        const dmg = exec ? t.hp + 1 : a.stat('damage');
        if (exec && run.stats.execHeal) run.heal(run.stats.execHeal);
        run.hit(t, dmg, a, { noCrit: false });
        run.fx.tracer(t.x, t.z);
        run.fx.burst(t.x, 1, t.z, '#ff3030', 16, 6);
        sfx('snipe');
      });
    },
  },
];
