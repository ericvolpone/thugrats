import { TIERS } from '../data/tiers.js';
import { Save } from '../save.js';

/**
 * Playtest recorder. Every run writes one JSON log for balancing:
 * what was offered and picked (with rarity and roll size, timestamped), damage
 * per ability over time, damage taken by source, final ability stats and items.
 *
 * Where it goes:
 *  - `npm run dev`: POSTed to the dev server, saved as playtests/runs/<date>_<hero>_<map>.json
 *    (see the runlog plugin in vite.config.js). Summarise them with `npm run runs`.
 *  - always: the last 40 logs stay in localStorage, so runs on the deployed site
 *    aren't lost. `thugrats.runs()` lists them, `thugrats.exportRuns()` downloads them.
 */
const KEY = 'thugrats-runlogs';
const KEEP = 40;
const SNAP_EVERY = 10; // seconds between damage snapshots
const r1 = (v) => Math.round(v * 10) / 10;
const tierName = (t) => TIERS[t]?.name ?? String(t);

export class RunLog {
  constructor(run) {
    this.run = run;
    this.startedAt = new Date().toISOString();
    this.events = [];
    this.snaps = [];
    this.nextSnap = SNAP_EVERY;
    this.taken = {}; // damage taken by source name
    this.acquired = {}; // ability id -> time
    this.ups = {}; // ability id -> [{t, stat, label, tier, gain}]
  }

  push(type, o) {
    const r = this.run;
    this.events.push({ t: r1(r.time), lvl: r.level, type, ...o });
  }

  /** Compact description of a card (for "what was offered"). */
  card(c) {
    if (!c) return null;
    if (c.type === 'newAbility') return { type: 'new', ability: c.def.id };
    if (c.type === 'abilityUp') return { type: 'up', ability: c.ability.def.id, stat: c.up.stat, tier: tierName(c.tier), gain: r1(c.gain) };
    if (c.type === 'item') return { type: 'item', item: c.def.id, tier: tierName(c.tier), gain: r1(c.gain) };
    if (c.type === 'gold') return { type: 'gold', amount: c.amount };
    return { type: c.type };
  }

  ability(def) {
    if (this.acquired[def.id] != null) return;
    this.acquired[def.id] = r1(this.run.time);
    this.ups[def.id] = [];
  }

  pick(choice, card) {
    const offered = (choice?.cards ?? []).map((c) => this.card(c));
    const picked = this.card(card) ?? { type: 'skip' };
    this.push('pick', { kind: choice?.kind, offered, picked });
    if (card?.type === 'newAbility') this.ability(card.def);
    if (card?.type === 'abilityUp') {
      (this.ups[card.ability.def.id] ??= []).push({ t: r1(this.run.time), stat: card.up.stat, label: card.up.label, tier: tierName(card.tier), gain: r1(card.gain) });
    }
  }

  hurt(dmg, src) {
    const k = src?.def?.name ?? src?.name ?? 'other';
    this.taken[k] = (this.taken[k] ?? 0) + dmg;
  }

  update() {
    const r = this.run;
    if (r.time < this.nextSnap) return;
    this.nextSnap += SNAP_EVERY;
    const d = {};
    for (const k in r.dmgBy) d[k] = Math.round(r.dmgBy[k]);
    this.snaps.push({ t: Math.round(r.time), lvl: r.level, hp: Math.round(r.player.hp), mobs: r.mobs.list?.length ?? undefined, dmg: d });
  }

  build(outcome) {
    const r = this.run;
    const total = Object.values(r.dmgBy).reduce((a, v) => a + v, 0) || 1;
    const STATS = ['damage', 'cooldown', 'area', 'duration', 'count', 'pierce'];
    const abilities = r.abilities.map((a) => {
      const id = a.def.id;
      const dmg = r.dmgBy[id] ?? 0;
      const since = this.acquired[id] ?? 0;
      const stats = {};
      for (const k of STATS) if (a.def.base[k] != null) stats[k] = r1(a.stat(k));
      return {
        id, name: a.def.name, tags: a.def.tags,
        acquired: since, upgrades: this.ups[id]?.length ?? 0,
        damage: Math.round(dmg), share: r1((dmg / total) * 100),
        dps: r1(dmg / Math.max(1, r.time - since)),
        stats, upgradeLog: this.ups[id] ?? [],
      };
    }).sort((a, b) => b.damage - a.damage);
    // damage from things that aren't abilities (talent procs, items, pet...)
    const other = {};
    for (const k in r.dmgBy) if (!r.abilityById(k)) other[k] = Math.round(r.dmgBy[k]);
    const items = r.allItems().map((it) => ({ id: it.def.id, slot: it.def.slot, tier: tierName(it.tier), level: it.level, power: r1(it.power) }));
    const s = r.stats;
    return {
      v: 1,
      build: typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev',
      startedAt: this.startedAt,
      endedAt: new Date().toISOString(),
      hero: r.hero.id, map: r.map.id, difficulty: r.diff.name,
      outcome, // 'evac' | 'died' | 'quit'
      cleared: !!r.clearedAt, clearedAt: r.clearedAt ? r1(r.clearedAt) : null,
      time: r1(r.time), fedsAt: r.cfg.duration, level: r.level, kills: r.kills,
      gold: Math.round(r.goldTotal), bosses: r.bossKills, titans: r.titanKills, chests: r.chestsOpened,
      totalDamage: Math.round(total),
      asc: Save.hero(r.hero.id).asc ?? 0, heroLevel: Save.hero(r.hero.id).level, startAbility: r.startId,
      talents: { ...Save.hero(r.hero.id).talents },
      gear: (r.loadout.worn ?? []).map((id) => ({ id, tier: tierName(Save.gearTier(r.hero.id, id)) })),
      sets: (r.loadout.setsOn ?? []).map((w) => ({ set: w.set.id, worn: w.count, k: r1(w.k), active: w.active })),
      gearDrops: r.gearDrops.map((p) => p.id),
      loadout: { stats: r.loadout.stats, flags: r.loadout.flags, mods: r.loadout.mods },
      finalStats: { maxHp: Math.round(s.maxHp), dmg: r1(s.dmg), haste: r1(s.haste), area: r1(s.area), luck: r1(s.luck), crit: r1(s.crit ?? 0), armor: r1(s.armor), dodge: r1(s.dodge) },
      abilities, otherDamage: other, items,
      damageTaken: Object.fromEntries(Object.entries(this.taken).map(([k, v]) => [k, Math.round(v)]).sort((a, b) => b[1] - a[1])),
      events: this.events,
      snapshots: this.snaps,
    };
  }

  /** Called once when the run ends. */
  save(outcome) {
    let log;
    try {
      log = this.build(outcome);
    } catch (e) {
      console.warn('[runlog] could not build the run log', e);
      return;
    }
    try {
      const all = JSON.parse(localStorage.getItem(KEY) || '[]');
      all.push(log);
      localStorage.setItem(KEY, JSON.stringify(all.slice(-KEEP)));
    } catch { /* storage full or blocked: the dev server copy still goes out */ }
    if (import.meta.env.DEV) {
      fetch('/__runlog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(log) })
        .then((res) => res.json())
        .then((j) => console.info(`[runlog] saved ${j.file}`))
        .catch((e) => console.warn('[runlog] dev server did not take the log (kept in localStorage)', e));
    }
    return log;
  }
}

/** Logs kept in this browser (newest last). */
export function storedRuns() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

/** Download every stored log as one JSON file. */
export function exportRuns() {
  const runs = storedRuns();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(runs, null, 1)], { type: 'application/json' }));
  a.download = `thugrats-runs-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return runs.length;
}
