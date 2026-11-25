import { BASE_STATS } from '../heroes/index.js';
import { Save } from '../save.js';

/**
 * Builds the run's permanent layer from hero base stats + talents + gear:
 *   stats  — base numbers before in-run items/levels
 *   mods   — ability modifiers [{match, stat, kind, v}]
 *   flags  — behaviour switches (akimbo, ricochet, ...)
 */
export function buildLoadout(hero) {
  const stats = { ...BASE_STATS, ...hero.stats };
  const mods = [];
  const flags = {};
  const ctx = {
    stat: (k, v) => { stats[k] = (stats[k] ?? 0) + v; },
    abil: (match, stat, kind, v) => mods.push({ match, stat, kind, v }),
    flag: (k, v) => { flags[k] = v; },
    flagAdd: (k, v) => { flags[k] = (flags[k] ?? 0) + v; },
  };
  const prof = Save.hero(hero.id);
  for (const t of hero.talents ?? []) {
    const r = prof.talents[t.id] ?? 0;
    if (r > 0) t.apply(ctx, r);
  }
  for (const g of hero.gear ?? []) {
    const tier = Save.gearTier(hero.id, g.id);
    if (tier >= 0) g.apply(ctx, tier);
  }
  return { stats, mods, flags };
}

/** Recomputed every frame: loadout + level-ups + items (some items are dynamic). */
export function computeStats(run) {
  const s = { ...run.loadout.stats };
  s.maxHp += run.levelBonus.hp;
  s.dmg += run.levelBonus.dmg;
  for (const it of run.allItems()) it.def.stats?.(it.power, s, run, it);
  s.pickup *= 1 + s.pickupPct;
  s.speed *= 1 + s.speedPct;
  if (run.buffs.frenzy) s.armor += s.frenzyArmor;
  s.armor = Math.min(0.75, s.armor);
  s.dodge = Math.min(0.6, s.dodge);
  s.crit = Math.min(1, s.crit);
  return s;
}

/** An ability owned in a run. stat(k) is the final, fully-modified value. */
export class AbilityInst {
  constructor(def, run) {
    this.def = def;
    this.run = run;
    this.inc = {};
    this.add = {};
    this.level = 1;
    this.cd = 0.4;
    this.cdMax = 1;
    this.history = []; // [{label, tier}]
    // talent/gear modifiers that match this ability
    this.mods = run.loadout.mods.filter((m) => m.match === def.id || (m.match[0] === '#' && def.tags.includes(m.match.slice(1))));
    for (const m of this.mods) {
      if (m.kind === 'pct') this.inc[m.stat] = (this.inc[m.stat] ?? 0) + m.v / 100;
      else this.add[m.stat] = (this.add[m.stat] ?? 0) + m.v;
    }
  }

  stat(k) {
    const b = this.def.base[k] ?? 0;
    const inc = this.inc[k] ?? 0;
    const add = this.add[k] ?? 0;
    const s = this.run.stats;
    switch (k) {
      case 'damage': return (b + add) * (1 + inc) * s.dmg;
      case 'cooldown': return b / (1 + inc + s.haste);
      case 'area': return (b + add) * (1 + inc) * (1 + s.area);
      case 'duration': return (b + add) * (1 + inc) * (1 + s.duration);
      case 'count': return Math.max(1, Math.round(b + add + (this.def.tags.includes('projectile') ? s.projectiles : 0)));
      case 'pierce': return Math.round(b + add);
      default: return b * (1 + inc) + add;
    }
  }

  applyUpgrade(up, tier) {
    const v = up.values[tier];
    if (up.kind === 'pct') this.inc[up.stat] = (this.inc[up.stat] ?? 0) + v / 100;
    else this.add[up.stat] = (this.add[up.stat] ?? 0) + v;
    this.level++;
    this.history.push({ label: up.label, tier });
  }
}

export function upgradeText(up, tier) {
  const v = up.values[tier];
  if (up.fmt) return up.fmt(v);
  if (up.kind === 'pct') return `+${v}% ${up.label}`;
  return `+${v} ${up.label}`;
}
