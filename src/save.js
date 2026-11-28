/**
 * Persistent profile (localStorage). Everything outside a run lives here:
 * per-hero level / xp / talents / gear, map clears and difficulty unlocks.
 */
const KEY = 'thugrats.save.v1';

/**
 * hero: level/xp (resets on ascension), peak (highest level ever, sets talent points),
 * asc (ascension level), tokens (gear upgrade tokens), gear {pieceId: tier 0..4},
 * equip {slot: pieceId}, startAbility (chosen after the first ascension).
 */
const blankHero = () => ({ level: 1, xp: 0, peak: 1, asc: 0, tokens: 0, talents: {}, gear: {}, equip: {}, clears: {}, startAbility: null, runs: 0, bestKills: 0 });

/** v1 -> v2: old gear retired (no refund); ascension fields added.
 *  v2 -> v3: hero identity rework. Every hero starts over (levels, talents, gear,
 *  clears, ascension); Rep and the Rep upgrades you bought are kept. Map clears
 *  are per hero from now on. */
function migrate(raw) {
  if (raw.v === 1) {
    for (const h of Object.values(raw.heroes ?? {})) {
      h.gear = {};
      h.equip = {};
      h.peak = Math.max(h.peak ?? 1, h.level ?? 1);
      h.asc ??= 0;
      h.tokens ??= 0;
    }
    raw.v = 2;
  }
  if (raw.v === 2) {
    raw.heroes = {};
    raw.clears = {};
    raw.v = 3;
  }
  return raw;
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.v >= 1 && raw.v <= 3) return { rep: 0, repTotal: 0, account: {}, ...migrate(raw) };
  } catch { /* corrupt or blocked storage */ }
  return { v: 3, heroes: {}, clears: {}, rep: 0, repTotal: 0, account: {}, settings: { sfx: 0.8, music: 0.5, shake: true } };
}

let data = load();

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* private mode etc. */ }
}

export const HERO_MAX_LEVEL = 50;
/** Talent points cap out at level 50 (one per level after the first). */
export const MAX_TALENT_POINTS = HERO_MAX_LEVEL - 1;
/** After an ascension, levels cost this share of the first climb (~40k XP per ascension). */
export const ASC_XP_MULT = 0.4;
/** Gear upgrade tokens granted by each ascension. */
export const ASC_TOKENS = 5;
/** XP needed to go from hero level L to L+1 (cheaper once you've ascended). */
export const heroXpToNext = (L, asc = 0) => Math.round((120 + 80 * (L - 1)) * (asc > 0 ? ASC_XP_MULT : 1));

export const Save = {
  get data() { return data; },
  hero(id) {
    if (!data.heroes[id]) data.heroes[id] = blankHero();
    const h = data.heroes[id];
    h.gear ??= {}; h.equip ??= {}; h.clears ??= {}; h.asc ??= 0; h.tokens ??= 0; h.peak ??= h.level;
    return h;
  },
  /** Returns the number of levels gained. */
  addHeroXp(id, xp) {
    const h = this.hero(id);
    let gained = 0;
    h.xp += Math.round(xp);
    while (h.level < HERO_MAX_LEVEL && h.xp >= heroXpToNext(h.level, h.asc)) {
      h.xp -= heroXpToNext(h.level, h.asc);
      h.level++;
      gained++;
    }
    h.peak = Math.max(h.peak, h.level);
    if (h.level >= HERO_MAX_LEVEL) h.xp = 0;
    write();
    return gained;
  },
  talentPoints(id) {
    const h = this.hero(id);
    const spent = Object.values(h.talents).reduce((a, b) => a + b, 0);
    const total = Math.min(MAX_TALENT_POINTS, h.peak - 1);
    return { total, spent, free: total - spent };
  },
  /** Level 50 -> level 1, one ascension higher, +5 gear tokens. Talents are kept. */
  ascend(id) {
    const h = this.hero(id);
    if (h.level < HERO_MAX_LEVEL) return false;
    h.level = 1;
    h.xp = 0;
    h.asc++;
    h.tokens += ASC_TOKENS;
    write();
    return true;
  },
  setStartAbility(id, abilityId) {
    this.hero(id).startAbility = abilityId;
    write();
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
  // ── gear (per hero): gear[pieceId] = tier 0..4, equip[slot] = pieceId ──
  gearTier(heroId, pieceId) {
    return this.hero(heroId).gear[pieceId] ?? -1;
  },
  /** Unlock a piece (Common) if it isn't owned yet. */
  unlockGear(heroId, pieceId) {
    const h = this.hero(heroId);
    if (h.gear[pieceId] != null) return false;
    h.gear[pieceId] = 0;
    write();
    return true;
  },
  /** Spend a token to raise a piece one tier. */
  upgradeGear(heroId, pieceId) {
    const h = this.hero(heroId);
    const t = h.gear[pieceId];
    if (t == null || t >= 4 || h.tokens <= 0) return false;
    h.gear[pieceId] = t + 1;
    h.tokens--;
    write();
    return true;
  },
  /** The piece worn in a slot (only if owned). */
  equipped(heroId, slot) {
    const id = this.hero(heroId).equip[slot];
    return id && this.gearTier(heroId, id) >= 0 ? id : null;
  },
  equip(heroId, slot, pieceId) {
    const h = this.hero(heroId);
    h.equip = { ...h.equip, [slot]: pieceId };
    if (!pieceId) delete h.equip[slot];
    write();
  },
  /** clears[mapId] = highest difficulty index cleared (any hero) */
  /** Highest difficulty this hero has cleared on a map (-1 = never). Progress is per hero. */
  bestClear(heroId, mapId) {
    return this.hero(heroId).clears[mapId] ?? -1;
  },
  recordClear(heroId, mapId, diff) {
    const h = this.hero(heroId);
    h.clears[mapId] = Math.max(this.bestClear(heroId, mapId), diff);
    write();
  },
  /** Any hero's best clear on a map (account-wide, old behaviour). */
  anyClear(mapId) {
    return data.clears[mapId] ?? -1;
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
  /** Signature moves fire on their own at a full meter unless set to manual (Y / F / ★). */
  sigManual() { return !!data.settings.sigManual; },
  setSigManual(on) { data.settings.sigManual = !!on; write(); },
  saveSettings() { write(); },
  wipe() {
    data = { v: 3, heroes: {}, clears: {}, rep: 0, repTotal: 0, account: {}, settings: data.settings };
    write();
  },
  write,
};
