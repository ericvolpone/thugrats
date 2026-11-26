import { BASE_STATS } from '../heroes/index.js';
import { Save } from '../save.js';
import { scaledGain } from '../data/tiers.js';
import { GEAR_SLOTS } from '../data/gear.js';
import { MAX_LUCK } from '../data/items.js';

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
  // account-wide Rep upgrades
  stats.xpGain += Save.acct('run_xp') * 0.05;
  stats.goldGain += Save.acct('run_gold') * 0.05;
  stats.speedPct += Save.acct('move_speed') * 0.02;
  const prof = Save.hero(hero.id);
  for (const t of hero.talents ?? []) {
    const r = prof.talents[t.id] ?? 0;
    if (r > 0) t.apply(ctx, r);
  }
  for (const slot of GEAR_SLOTS) {
    const id = Save.equipped(hero.id, slot, hero.gear ?? []);
    const g = id && hero.gear.find((x) => x.id === id);
    if (g) g.apply(ctx, Save.gearTier(hero.id, g.id));
  }
  return { stats, mods, flags };
}

/** Recomputed every frame: loadout + level-ups + items (some items are dynamic). */
export function computeStats(run) {
  const s = { ...run.loadout.stats };
  s.maxHp += run.levelBonus.hp;
  s.dmg += run.levelBonus.dmg;
  s.luck += run.levelBonus.luck ?? 0;
  for (const it of run.allItems()) it.def.stats?.(it.power, s, run, it);
  for (const id in run.buffs) run.buffs[id].stats?.(s, run.buffs[id], run);
  s.pickup *= 1 + s.pickupPct;
  s.speed *= 1 + s.speedPct;
  if (run.buffs.frenzy) { s.armor += s.frenzyArmor; s.lifesteal += s.frenzyLeech; }
  s.armor = Math.min(0.75, s.armor);
  s.dodge = Math.min(0.6, s.dodge);
  s.crit = Math.min(1, s.crit);
  s.luck = Math.min(MAX_LUCK, s.luck);
  return s;
}

/** An ability owned in a run. stat(k) is the final, fully-modified value. */
export class AbilityInst {
  constructor(def, run) {
    this.def = def;
    this.run = run;
    this.inc = {};
    this.add = {};
    this.acc = {}; // per-stat total of scaled upgrades taken (for diminishing returns)
    this.level = 1;
    this.cd = 0.4;
    this.cdMax = def.base.cooldown ?? 1;
    this.wait = 0; // seconds spent off cooldown waiting for a target
    this.poll = 0;
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
    let inc = this.inc[k] ?? 0;
    let add = this.add[k] ?? 0;
    for (const it of this.run.items.stash) {
      const r = it.def.abil?.(it.power, this, k);
      if (r) { inc += r[0]; add += r[1]; }
    }
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

  /**
   * Size of an upgrade roll for this ability. Upgrades with `values` are flat,
   * tier-gated (extra bullet, pierce...). Upgrades with `v` scale with rarity and
   * shrink the more of that stat this ability already has (see tiers.decay).
   */
  gainFor(up, tier) {
    if (up.values) return up.values[tier];
    let g = scaledGain(up.v, this.acc[up.stat] ?? 0, tier);
    if (up.int) g = Math.max(1, Math.round(g));
    return g;
  }

  /** Can this upgrade still be offered at this tier? */
  canOffer(up, tier) {
    if (up.values && !(up.values[tier] > 0)) return false;
    if (up.max != null && (this.add[up.stat] ?? 0) >= up.max) return false;
    if (this.def.useless?.(this, up.stat)) return false;
    return true;
  }

  applyUpgrade(up, tier, gain = this.gainFor(up, tier)) {
    if (up.kind === 'pct') this.inc[up.stat] = (this.inc[up.stat] ?? 0) + gain / 100;
    else this.add[up.stat] = (this.add[up.stat] ?? 0) + gain;
    if (!up.values) this.acc[up.stat] = (this.acc[up.stat] ?? 0) + gain;
    this.level++;
    this.history.push({ label: up.label, tier });
  }
}

export function upgradeText(up, gain) {
  if (up.fmt) return up.fmt(gain);
  const v = Math.round(gain * 10) / 10;
  if (up.kind === 'pct') return `+${Math.round(gain)}% ${up.label}`;
  return `+${v} ${up.label}`;
}
