/**
 * Persistent profile (localStorage). Everything outside a run lives here:
 * per-hero level / xp / talents / gear, map clears and difficulty unlocks.
 */
const KEY = 'thugrats.save.v1';

const blankHero = () => ({ level: 1, xp: 0, talents: {}, gear: {}, runs: 0, bestKills: 0 });

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.v === 1) return { rep: 0, repTotal: 0, account: {}, ...raw };
  } catch { /* corrupt or blocked storage */ }
  return { v: 1, heroes: {}, clears: {}, rep: 0, repTotal: 0, account: {}, settings: { sfx: 0.8, music: 0.5, shake: true } };
}

let data = load();

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* private mode etc. */ }
}

/** XP needed to go from hero level L to L+1. */
export const heroXpToNext = (L) => 120 + 80 * (L - 1);
export const HERO_MAX_LEVEL = 30;

export const Save = {
  get data() { return data; },
  hero(id) {
    if (!data.heroes[id]) data.heroes[id] = blankHero();
    return data.heroes[id];
  },
  /** Returns the number of levels gained. */
  addHeroXp(id, xp) {
    const h = this.hero(id);
    let gained = 0;
    h.xp += Math.round(xp);
    while (h.level < HERO_MAX_LEVEL && h.xp >= heroXpToNext(h.level)) {
      h.xp -= heroXpToNext(h.level);
      h.level++;
      gained++;
    }
    if (h.level >= HERO_MAX_LEVEL) h.xp = 0;
    write();
    return gained;
  },
  talentPoints(id) {
    const h = this.hero(id);
    const spent = Object.values(h.talents).reduce((a, b) => a + b, 0);
    return { total: h.level - 1, spent, free: h.level - 1 - spent };
  },
  setTalent(id, talentId, rank) {
    const h = this.hero(id);
    if (rank <= 0) delete h.talents[talentId];
    else h.talents[talentId] = rank;
    write();
  },
  resetTalents(id) {
    this.hero(id).talents = {};
    write();
  },
  /** gear[gearId] = tier index (0..4) */
  gearTier(heroId, gearId) {
    const g = this.hero(heroId).gear[gearId];
    return g == null ? -1 : g;
  },
  setGear(heroId, gearId, tier) {
    this.hero(heroId).gear[gearId] = tier;
    write();
  },
  /** clears[mapId] = highest difficulty index cleared (any hero) */
  bestClear(mapId) {
    return data.clears[mapId] ?? -1;
  },
  recordClear(mapId, diff) {
    data.clears[mapId] = Math.max(this.bestClear(mapId), diff);
    write();
  },
  recordRun(heroId, kills) {
    const h = this.hero(heroId);
    h.runs++;
    h.bestKills = Math.max(h.bestKills, kills);
    write();
  },
  // ── account-wide Rep ──
  get rep() { return data.rep; },
  addRep(n) {
    data.rep += n;
    data.repTotal += n;
    write();
  },
  /** Level of an account upgrade (0 = not bought). */
  acct(id) { return data.account[id] ?? 0; },
  /** Buy the next level of an upgrade def; returns false if unaffordable. */
  buyAcct(def) {
    const lvl = this.acct(def.id);
    if (lvl >= def.max || (def.requires && !this.acct(def.requires))) return false;
    const c = def.cost(lvl);
    if (data.rep < c) return false;
    data.rep -= c;
    data.account[def.id] = lvl + 1;
    write();
    return true;
  },
  settings() { return data.settings; },
  saveSettings() { write(); },
  wipe() {
    data = { v: 1, heroes: {}, clears: {}, rep: 0, repTotal: 0, account: {}, settings: data.settings };
    write();
  },
  write,
};
