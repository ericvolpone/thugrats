import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { MobManager } from './mobs.js';
import { Combat } from './combat.js';
import { Pickups } from './pickups.js';
import { Pet } from './pet.js';
import { repForRun, heroXpBonus } from '../data/account.js';
import { FX } from './fx.js';
import { Telegraphs } from './telegraphs.js';
import { buildLoadout, computeStats, AbilityInst } from './stats.js';
import { TITAN_DROPS, GEAR_SLOTS } from '../data/gear.js';
import { levelOffers, itemOffers, contraOffers, itemGain, itemMaxed, banishKind, banishId } from './upgrades.js';
import { MOBS, BOSSES } from '../data/mobs.js';
import { DIFFICULTIES, MAP_DEFAULTS } from '../data/maps.js';
import { Save } from '../save.js';
import { RunLog } from './runlog.js';
import { setSeeThrough } from './seeThrough.js';
import { Evac, EVAC_BONUS } from './evac.js';
import { sfx } from '../audio.js';
import { rand, TAU, pick, weighted, clamp } from '../util.js';

/** XP needed to go from in-run level L to L+1. */
export const xpFor = (L) => Math.round(6 + 6 * (L - 1) + 0.8 * (L - 1) ** 2);

/**
 * One run on one map. Owns the scene and every system; abilities and items talk
 * to the world through the methods on this class (hit, explode, shoot, lob...).
 */
/** Damage number colours by crit tier: crit, double, triple, quadruple+. */
const CRIT_COLORS = ['#ffd23f', '#ff9a1f', '#ff3b3b', '#c45cff'];

/** How long level-up / loot cards ignore input after they appear. */
const PICK_LOCK_MS = 1000;

export class Run {
  constructor({ hero, map, diff, input, ui }) {
    this.hero = hero;
    this.map = map;
    this.diffIndex = diff;
    this.diff = DIFFICULTIES[diff];
    this.input = input;
    this.ui = ui;
    // the top difficulties bring the Feds in sooner
    this.cfg = { ...MAP_DEFAULTS, duration: (this.diff.feds ?? MAP_DEFAULTS.duration / 60) * 60 };

    const th = map.theme;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(th.sky);
    this.scene.fog = new THREE.Fog(th.fog, 38, 85);
    this.scene.add(new THREE.HemisphereLight(th.hemi[0], th.hemi[1], 1.9));
    const sun = new THREE.DirectionalLight(th.sun, 1.6);
    sun.position.set(-30, 50, 20);
    this.scene.add(sun);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 200);
    this.camDist = 1;
    this.camYaw = 0; // 0 = looking north (−Z)
    this.camY = 0;
    this.shakeAmt = 0;

    // state
    this.time = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNext = xpFor(1);
    this.gold = 0;
    this.goldTotal = 0;
    this.kills = 0;
    this.bossKills = 0;
    this.titanKills = 0;
    this.chestsOpened = 0;
    this.contracts = 0; // completed Crime Titan contracts, spent at the Black Market
    this.levelBonus = { hp: 0, dmg: 0, luck: 0 };
    this.banished = new Set(); // ability / item ids never offered again this run
    this.banishes = 3; // shared between abilities and items
    this.maxed = new Set(); // items retired for free once more of them would do nothing
    this.buffs = {};
    this.items = { ring: [], title: [], rep: [], stash: [] };
    this.abilItems = []; // held items that change ability stats (some Titles, Contraband)
    this.runLinks = { hit: [], crit: [], kill: [], fire: [], explode: [], hurt: [] }; // Contraband twists
    this.abilities = [];
    this.timers = [];
    this.queue = [];
    this.choice = null;
    this.paused = false;
    this.ended = false;
    this.result = null;
    this.dmgBy = {};
    this.fedsArrived = false;
    this.leech = 0;
    this.clearedAt = null; // run time the final Crime Titan died
    this.evac = null; // the chopper, once the map is cleared
    this.evacuating = false;
    this.log = new RunLog(this); // playtest recorder (runlog.js)
    this.gearDrops = []; // pieces dropped by Crime Titans this run
    this.counters = {}; // per-run counters for talents / set bonuses (every Nth shot...)
    // hero resource (Rage, Focus...): hero.resource = {id, name, icon, color, max, start?, decay?, decayDelay?, tick?(run, dt)}
    this.res = hero.resource ? { ...hero.resource, value: hero.resource.start ?? 0, idle: 0 } : null;
    this.procDepth = 0;

    this.loadout = buildLoadout(hero);
    this.flags = { ...this.loadout.flags };

    this.world = new World(this.scene, map);
    this.fx = new FX(this);
    this.telegraphs = new Telegraphs(this.scene);
    this.player = new Player(this, hero);
    this.mobs = new MobManager(this);
    this.mobs.prepare(map.roster.map((r) => r.mob));
    this.combat = new Combat(this);
    this.pickups = new Pickups(this);
    this.pet = Save.acct('pet') ? new Pet(this) : null;
    this.stats = computeStats(this);
    this.player.hp = this.stats.maxHp;
    this.gold = this.stats.startGold;
    this.rerolls = this.stats.rerolls;

    // after the first ascension you pick your starting ability in the hideout
    const prof = Save.hero(hero.id);
    this.startId = (prof.asc > 0 && hero.abilities.some((a) => a.id === prof.startAbility && !a.noStart)) ? prof.startAbility : hero.start;
    this.addAbility(hero.abilities.find((a) => a.id === this.startId));
    if (this.flags.startFrenzy) this.addAbility(hero.abilities.find((a) => a.id === 'frenzy'));
    if (this.flags.godfather) this.combat.spawnGoon({ permanent: true, ability: null });
    for (let i = 0; i < (this.flags.permGoons ?? 0); i++) this.combat.spawnGoon({ permanent: true, ability: null });

    // director
    this.spawnAcc = 0;
    this.nextWave = 60;
    this.nextBoss = this.cfg.firstBoss * (this.diff.boss ?? 1);
    this.bossWarn = null; // {x, z, t}
    this.nextChest = rand(...this.cfg.chestEvery) * 0.6;
    this.titans = map.titans.map((t, i) => ({ ...t, i, def: BOSSES[t.boss], state: 'locked', stand: 0, mob: null }));
  }

  // ── accessors used by abilities/items ──────────────────────
  get traps() { return this.combat.traps; }
  get orbits() { return this.combat.orbits; }
  allItems() { return [...this.items.ring, ...this.items.title, ...this.items.rep, ...this.items.stash]; }
  findItem(id) { return this.allItems().find((i) => i.def.id === id); }
  abilityById(id) { return this.abilities.find((a) => a.def.id === id); }
  later(t, fn) { this.timers.push({ t, fn }); }
  /** Add to the hero's resource meter (Rage, Focus...). */
  gainRes(n) {
    const r = this.res;
    if (!r || n <= 0) return;
    r.value = Math.min(r.max, r.value + n);
    r.idle = 0;
  }
  /** Spend from the resource meter; false (nothing spent) if there isn't enough. */
  spendRes(n) {
    const r = this.res;
    if (!r || r.value < n) return false;
    r.value -= n;
    return true;
  }
  /** Is the hero's signature move ready? (hero.signature.ready, or a full meter) */
  sigReady() {
    const sig = this.hero.signature;
    if (!sig || !this.res || this.player.dead || this.sigLock > this.time) return false;
    return sig.ready ? sig.ready(this) : this.res.value >= this.res.max;
  }
  /**
   * Fire the hero's signature move (hero.signature.fire). By default it empties the
   * meter; signatures that manage the meter themselves set keepMeter.
   */
  useSignature() {
    if (!this.sigReady()) return false;
    const sig = this.hero.signature;
    this.sigLock = this.time + 0.6;
    if (!sig.keepMeter) this.res.value = 0;
    sig.fire(this);
    this.sigUses = (this.sigUses ?? 0) + 1;
    this.ui.banner(`${sig.icon} ${sig.name.toUpperCase()}!`, sig.short ?? '', false);
    this.log.push('signature', { id: sig.id });
    return true;
  }
  /** Count up a named counter; true every `n`th call (set bonuses like "every 10th shot"). */
  every(key, n) {
    const c = (this.counters[key] = (this.counters[key] ?? 0) + 1);
    return c % n === 0;
  }
  /**
   * Run the talent/gear pairings (loadout.links) for event `on` from ability `src`.
   * ev = {m, x, z, dmg, crit, r, tgt}. Procs can trigger other procs, two deep at most.
   */
  emit(on, src, ev) {
    if (this.procDepth > 1) return;
    this.emitList(this.loadout.links[on], src, ev);
    this.emitList(this.runLinks[on], src, ev);
  }

  emitList(list, src, ev) {
    if (!list.length) return;
    const id = src?.def?.id, tags = src?.def?.tags;
    for (const L of list) {
      if (L.from !== '*' && (L.from[0] === '#' ? !tags?.includes(L.from.slice(1)) : L.from !== id)) continue;
      if (L.next > this.time) continue;
      const partner = L.to ? this.abilityById(L.to) : null;
      if (L.to && !partner) continue;
      const ch = typeof L.chance === 'function' ? L.chance(this, ev) : L.chance;
      if (ch < 1 && Math.random() >= ch) continue;
      L.next = this.time + L.icd;
      ev.src = src;
      if (ev.m && ev.x == null) { ev.x = ev.m.x; ev.z = ev.m.z; }
      this.procDepth++;
      try { L.proc(this, partner, ev); } finally { this.procDepth--; }
    }
  }
  /**
   * Crowd check for abilities that want a pack (`need` mobs within `r`). The
   * longer an ability has been off cooldown without firing, the fewer it wants
   * (down to a fifth after ~4s), so it never sits idle forever.
   */
  crowd(a, r, need) {
    const want = Math.max(1, Math.ceil(need * Math.max(0.2, 1 - (a?.wait ?? 0) / 5)));
    return this.mobs.count(this.player.x, this.player.z, r) >= want;
  }
  shake(a) { if (Save.settings().shake) this.shakeAmt = Math.max(this.shakeAmt, a); }
  toast(msg) { this.ui.toast(msg); }

  shoot(o) { this.combat.shoot(o); }
  enemyShot(o) { this.combat.enemyShot(o); }
  lob(o) { this.combat.lob(o); }
  zone(o) { this.combat.zone(o); }
  trap(o) { this.combat.trap(o); }
  car(o) { this.combat.car(o); }
  orbit(o) { this.combat.orbit(o); }
  mark(m, d, cb) { this.combat.mark(m, d, cb); }
  spawnGoon(o) { return this.combat.spawnGoon(o); }

  mobScale(boss = false) {
    const tm = this.time / 60;
    const over = Math.max(0, (this.time - this.cfg.duration) / 60);
    const feds = 1 + over * 0.6 + over * over * 0.2;
    if (boss) return { hp: this.diff.hp * (1 + 0.1 * tm) * feds, dmg: this.diff.dmg * (1 + 0.05 * tm) * feds };
    return {
      hp: this.diff.hp * (1 + 0.12 * tm + 0.011 * tm * tm) * feds,
      dmg: this.diff.dmg * (1 + 0.07 * tm) * feds,
      xp: 1 + tm * 0.1,
    };
  }

  /** A point on the spawn ring around the player in direction `a`, kept inside the arena. */
  spawnPoint(a = rand(0, TAU)) {
    const p = this.player;
    const lim = this.world.half - 3;
    for (let tries = 0; tries < 8; tries++) {
      const r = rand(27, 33);
      const x = clamp(p.x + Math.sin(a) * r, -lim, lim);
      const z = clamp(p.z + Math.cos(a) * r, -lim, lim);
      if (!this.world.solidAt(x, z, 1)) return [x, z];
      a += 0.7;
    }
    return [clamp(p.x + Math.sin(a) * 30, -lim, lim), clamp(p.z + Math.cos(a) * 30, -lim, lim)];
  }

  // ── abilities & items ──────────────────────────────────────
  addAbility(def) {
    if (!def || this.abilityById(def.id)) return;
    const a = new AbilityInst(def, this);
    this.abilities.push(a);
    this.log.ability(def);
    return a;
  }

  addItem(def, tier, gain) {
    const own = this.findItem(def.id);
    const g = gain ?? itemGain(def, own, tier, this);
    if (own) {
      own.power += g;
      own.level++;
      own.tier = Math.max(own.tier, tier);
    } else {
      const it = { def, power: g, level: 1, tier };
      this.items[def.slot].push(it);
      // Contraband twist: a proc on its own ability, scaled by how many copies you hold
      const tw = def.twist;
      if (tw) this.runLinks[tw.on].push({ from: def.ability, to: def.ability, chance: tw.chance, icd: tw.icd, next: 0, proc: (run, a, ev) => tw.fn(run, a, ev, it.power) });
    }
    this.abilItems = this.allItems().filter((i) => i.def.abil);
    this.stats = computeStats(this);
    if (itemMaxed(this, def, this.findItem(def.id))) {
      this.maxed.add(def.id);
      this.toast(`⭐ ${def.name} is maxed out and won't be offered again`);
    }
  }

  // ── combat pipeline ────────────────────────────────────────
  hit(m, base, ability, o = {}) {
    if (m.dead || base <= 0) return;
    const s = this.stats;
    let dmg = base;
    if (m.tier >= 1) dmg *= 1 + s.bigDmg;
    if (m.fear) dmg *= 1 + (s.fearDmg || 0.12);
    if (m.shrunkUntil > this.time) dmg *= 1 + m.shrunk;
    if (s.ctrlDmg && (m.rootT > 0 || m.slowT > 0)) dmg *= 1 + s.ctrlDmg;
    if (s.burnVuln && m.burnT > 0) dmg *= 1 + s.burnVuln;
    // Crit, then overcrit: every 100% of crit chance past the first is another
    // crit tier. 150% = always crit + 50% for a double crit (×1.5 more); a triple
    // adds ×1.25, a quadruple ×1.125...
    let critN = 0;
    if (!o.noCrit) {
      let c = s.crit + (ability?.def?.base?.crit ? ability.stat('crit') : 0);
      if (Math.random() < c) {
        critN = 1;
        dmg *= 1 + s.critDmg;
        for (let extra = 0.5; (c -= 1) > 0 && critN < 6 && Math.random() < c; extra /= 2) { critN++; dmg *= 1 + extra; }
      }
    }
    const crit = critN > 0;
    for (const f of this.loadout.amps) dmg *= 1 + f(this, m, ability);
    dmg *= 1 - (m.armor ?? 0);
    m.hp -= dmg;
    m.flash = 1;
    // lifesteal (pooled; update() pays it out, at most 6% max HP per second)
    if (!o.isBurn) {
      const tags = ability?.def?.tags;
      const leech = s.lifesteal + (tags?.includes('melee') ? s.meleeLeech : 0) + (tags?.includes('aura') ? s.auraLeech : 0) + (crit ? s.critLeech : 0);
      if (leech > 0) this.leech += Math.min(dmg, m.hp + dmg) * leech;
    }
    const id = ability?.def?.id ?? (o.isBurn ? 'burn' : null);
    if (id) this.dmgBy[id] = (this.dmgBy[id] ?? 0) + dmg;
    if (o.knock && m.tier < 2) {
      const fx = o.fromX ?? this.player.x, fz = o.fromZ ?? this.player.z;
      const dx = m.x - fx, dz = m.z - fz, d = Math.hypot(dx, dz) || 1;
      const k = o.knock / (m.tier === 1 ? 2.5 : 1);
      m.kx += (dx / d) * k;
      m.kz += (dz / d) * k;
    }
    this.fx.number(m.x, m.height * 0.9 + 0.3, m.z, dmg, crit ? CRIT_COLORS[Math.min(critN, CRIT_COLORS.length) - 1] : o.color ?? '#ffffff', critN);
    if (!o.isBurn) {
      for (const it of this.allItems()) it.def.onHit?.(this, it, m, { amount: dmg, crit, ability, isBurn: false });
      sfx('hit', 0.05);
    }
    // Hollow Tips: projectile hits sometimes burst
    if (s.projBurst && !o.burst && !o.isBurn && ability?.def?.tags?.includes('projectile') && Math.random() < s.projBurst) {
      for (const n of this.mobs.near(m.x, m.z, 1.8)) if (n !== m) this.hit(n, dmg * 0.6, ability, { burst: true, noCrit: true, knock: 1, fromX: m.x, fromZ: m.z });
      this.fx.explosion(m.x, m.z, 1.4, '#cfcfcf');
    }
    if (ability && !o.isBurn) {
      this.emit('hit', ability, { m, dmg, crit });
      if (crit) this.emit('crit', ability, { m, dmg, crit, critN });
    }
    if (m.hp <= 0) this.kill(m, ability);
  }

  ignite(m, total, dur) {
    m.burnDps = Math.max(m.burnDps * (m.burnT > 0 ? 1 : 0), (total / dur) * (1 + this.stats.burnDmg));
    m.burnT = Math.max(m.burnT, dur);
  }

  explode(x, z, r, dmg, ability, o = {}) {
    if (this.flags.megaton) r *= 1.25;
    r *= 1 + this.stats.blastArea;
    if (this.stats.blastBurn && !o.small) this.zone({ x, z, r: r * 0.8, life: 2, dps: dmg * this.stats.blastBurn, kind: 'fire', ability });
    for (const m of this.mobs.near(x, z, r)) this.hit(m, dmg, ability, { knock: o.small ? 1 : 5, fromX: x, fromZ: z });
    this.fx.explosion(x, z, r, o.color);
    if (ability && !o.noProc) this.emit('explode', ability, { x, z, r, dmg, small: !!o.small });
    if (!o.small) {
      this.shake(0.18);
      sfx('boom', 0.06);
    }
    const shards = this.flags.shrapnel ?? 0;
    if (shards && !o.noShrapnel) {
      for (let i = 0; i < shards; i++) {
        this.combat.shoot({ x, z, y: 0.5, angle: rand(0, TAU), speed: 26, dmg: dmg * 0.3, range: 7, size: 0.7, color: '#cfcfcf', ability, kind: 'bullet' });
      }
    }
  }

  kill(m, ability) {
    if (m.dead) return;
    m.dead = true;
    m.deathT = 0;
    this.kills++;
    sfx('kill', 0.04);
    this.fx.burst(m.x, 0.8, m.z, m.tier >= 2 ? '#ffd23f' : '#d8d2c8', m.tier >= 2 ? 40 : 6, m.tier >= 2 ? 8 : 4, 0.5);
    const def = m.def;
    if (this.diff.blast && m.tier <= 1 && (m.tier === 1 || (this.diff.blast > 1 && Math.random() < 1 / 12))) this.deathGrenade(m);
    if (m.tier <= 1) {
      this.pickups.gem(m.x, m.z, Math.max(1, Math.round(m.xp)));
      const gc = def.gold * (m.tier === 1 ? 1 : 1);
      if (m.tier === 1) for (let i = 0; i < 5; i++) this.pickups.coin(m.x + rand(-1, 1), m.z + rand(-1, 1), 2);
      else if (Math.random() < gc) this.pickups.coin(m.x, m.z, 1);
      if (Math.random() < (m.tier === 1 ? 0.08 : 0.004)) this.pickups.special('heal', m.x, m.z);
      if (Math.random() < (m.tier === 1 ? 0.05 : 0.0012)) this.pickups.special('magnet', m.x, m.z);
      if (m.tier === 1 && Math.random() < 0.25) {
        const [x, z] = this.world.freeSpot(m.x, m.z, 1.4);
        this.pickups.chest(x, z);
      }
    }
    if (m.tier === 2) {
      this.bossKills++;
      this.ui.banner(`${def.name} is down!`, 'Free level + loot');
      for (let i = 0; i < 12; i++) this.pickups.coin(m.x + rand(-2, 2), m.z + rand(-2, 2), 3);
      this.pickups.special('magnet', m.x + 1, m.z);
      this.addXp(this.xpNext - this.xp + 0.01, true);
      this.queue.push({ kind: 'item', minTier: 1, reason: `${def.name} dropped loot` });
      sfx('victory', 0.5);
    }
    if (m.tier === 3) {
      this.titanKills++;
      const t = this.titans.find((tt) => tt.mob === m);
      if (t) {
        t.state = 'dead';
        this.world.altars[t.i].beam.material.opacity = 0;
      }
      for (let i = 0; i < 25; i++) this.pickups.coin(m.x + rand(-3, 3), m.z + rand(-3, 3), 4);
      const gear = t ? this.rollGearDrop(t.i) : null;
      this.addXp(this.xpNext - this.xp + 0.01, true);
      // loot card: what the titan left (always shown, so you know the gear roll happened)
      this.ui.loot?.({ title: `${def.name} has fallen!`, gear, final: !!def.final, gold: def.final ? 100 : 140 });
      this.choiceHold = this.time + 2.5; // let the loot card show before the free level's cards
      if (def.final) {
        // the clear is banked now; the run goes on until you evacuate (or don't make it)
        this.clearedAt = this.time;
        Save.recordClear(this.hero.id, this.map.id, this.diffIndex);
        this.contracts += 2; // two Contraband picks to gear up for the Feds
        this.pickups.market.open = true;
        this.toast('🚁 Get to the chopper (H on the minimap) to get out with a bonus. Or cash your 2 contracts at the Black Market ($) and see how long you last against the Feds.');
        sfx('victory');
        this.later(2.5, () => { if (!this.ended) this.evac = new Evac(this); });
      } else {
        this.contracts++;
        this.pickups.market.open = true;
        this.toast('📜 Contract complete! Take it to the Black Market ($ on the minimap) for Contraband.');
        for (let i = 0; i < 8; i++) this.pickups.coin(m.x + rand(-3, 3), m.z + rand(-3, 3), 5);
        sfx('victory');
      }
    }
    for (const it of this.allItems()) it.def.onKill?.(this, it, m);
    if (ability) this.emit('kill', ability, { m });
    const chain = this.flags.chainReaction ?? 0;
    if (chain && ability?.def?.tags?.includes('explosive') && m.tier < 2 && Math.random() < chain) {
      this.later(0.08, () => this.explode(m.x, m.z, 2.6, ability.stat('damage') * 0.5, ability, { noShrapnel: true }));
    }
  }

  /**
   * A Crime Titan died: maybe drop a missing piece of this hero's set for this map
   * (TITAN_DROPS). Returns {set, piece?, chance, missing[]} for the loot card.
   */
  rollGearDrop(titanIndex) {
    const rule = TITAN_DROPS[titanIndex];
    const set = this.hero.sets?.find((s) => s.map === this.map.id);
    if (!rule || !set) return null;
    const missing = rule.slots.map((i) => set.pieceList[i]).filter((p) => Save.gearTier(this.hero.id, p.id) < 0);
    // harder difficulties drop more often (Normal ×1 → Inferno ×3, capped at 100%)
    const chance = Math.min(1, rule.chance * (this.diff.gear ?? 1));
    const res = { set, chance, missing, piece: null };
    if (!missing.length || Math.random() >= chance) return res;
    const piece = pick(missing);
    Save.unlockGear(this.hero.id, piece.id);
    this.gearDrops.push(piece);
    res.piece = piece;
    res.missing = missing.filter((p) => p !== piece);
    sfx('levelup');
    return res;
  }

  /** Vendetta / Inferno: a dead thug drops a live grenade (a telegraphed blast you have to walk out of). */
  deathGrenade(m) {
    const r = m.tier === 1 ? 3.2 : 2.2, dmg = (m.dmg ?? 10) * (m.tier === 1 ? 1.4 : 1.1), x = m.x, z = m.z;
    this.telegraphs.add('circle', { x, z, r }, m.tier === 1 ? 1.3 : 1.1, (tt) => {
      const p = this.player;
      if (p.y < 1.6 && this.telegraphs.constructor.contains(tt, p.x, p.z, p.radius * 0.6)) this.hurtPlayer(dmg, null);
      this.fx.telegraphPop(tt);
      this.fx.explosion(x, z, r * 0.8, '#ff6a3a');
    });
  }

  hurtPlayer(amount, src) {
    const p = this.player;
    if (p.dead || this.ended || this.evacuating) return;
    if (Math.random() < this.stats.dodge) {
      this.fx.number(p.x, 1.8, p.z, 'dodge', '#9ad8ff');
      for (const it of this.allItems()) it.def.onDodge?.(this, it, src);
      return;
    }
    let dmg = amount * (1 - this.stats.armor);
    for (const it of this.allItems()) if (it.def.onHurt) dmg = it.def.onHurt(this, it, dmg);
    if (p.shield > 0) {
      const a = Math.min(p.shield, dmg);
      p.shield -= a;
      dmg -= a;
    }
    const thorns = this.flags.thorns ?? 0;
    if (thorns && src && src.hp != null && !src.dead && amount > 0) this.hit(src, amount * thorns * this.stats.dmg, null, { noCrit: true, color: '#ffb0a0' });
    if (dmg <= 0) return;
    this.log.hurt(Math.min(dmg, p.hp), src);
    this.emit('hurt', null, { dmg, m: src?.hp != null ? src : null });
    p.hp -= dmg;
    p.hurtT = 1;
    this.fx.number(p.x, 1.9, p.z, dmg, '#ff5a5a');
    this.ui.hurtFlash();
    sfx('hurt', 0.15);
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      sfx('defeat');
      this.later(1.6, () => this.end('died'));
    }
  }

  heal(v) {
    const p = this.player;
    if (p.dead) return;
    p.hp = Math.min(this.stats.maxHp, p.hp + v * (this.diff.heal ?? 1));
  }

  addGold(v, raw = false) {
    const g = raw ? v : Math.round(v * this.stats.goldGain * 10) / 10;
    this.gold += g;
    this.goldTotal += g;
  }

  addXp(v, raw = false) {
    this.xp += raw ? v : v * this.stats.xpGain;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpFor(this.level);
      this.levelBonus.hp += 3;
      this.levelBonus.dmg += 0.01;
      this.levelBonus.luck += 1;
      this.player.hp += 3;
      this.queue.push({ kind: 'level', reason: `Level ${this.level}!  +3 max HP, +1% damage, +1 luck` });
      sfx('levelup', 0.15);
      this.fx.ring(this.player.x, this.player.z, 3, '#58c4ff', 0.5);
    }
  }

  chestCost() {
    // every chest costs gold, so the price climbs gently: 20, 29, 40, 52, 66 ... ~200 by the 10th
    return Math.round((20 + 8 * this.chestsOpened + this.chestsOpened ** 2) * (1 - this.stats.chestDiscount));
  }

  tryOpenChest(c) {
    const cost = this.chestCost();
    if (this.gold < cost) {
      if (!c.warned || this.time - c.warned > 3) {
        c.warned = this.time;
        this.toast(`🔒 This chest costs ${cost} gold`);
      }
      return false;
    }
    this.gold -= cost;
    this.chestsOpened++;
    sfx('chest');
    this.fx.burst(c.x, 1, c.z, '#ffd23f', 24, 6);
    this.queue.push({ kind: 'item', minTier: 0, reason: `Chest opened (${cost} gold)` });
    return true;
  }

  // ── choices (level-up / loot / black market) ───────────────
  offersFor(q) {
    if (q.kind === 'level') return levelOffers(this);
    if (q.kind === 'market') return contraOffers(this, 2);
    return itemOffers(this, 3, q.minTier ?? 0);
  }

  /** Spend a contract at the Black Market for one Contraband pick. */
  tryMarket() {
    if (this.contracts <= 0) return false;
    this.contracts--;
    sfx('chest');
    this.queue.push({ kind: 'market', reason: 'Black Market: supercharge one of your abilities. Contraband you already hold doubles up.' });
    return true;
  }

  openNextChoice() {
    const q = this.queue.shift();
    const cards = this.offersFor(q);
    this.choice = { ...q, cards, lockUntil: performance.now() + PICK_LOCK_MS };
    this.paused = true;
    this.ui.showChoice(this.choice);
  }

  reroll(free = false) {
    if (!this.choice || (!free && this.rerolls <= 0) || this.choiceLocked()) return;
    if (!free) this.rerolls--;
    const q = this.choice;
    if (!free) this.log.push('reroll', { kind: q.kind, offered: q.cards.map((c) => this.log.card(c)) });
    q.cards = this.offersFor(q);
    q.banishing = false;
    this.ui.showChoice(q);
  }

  /** Toggle banish mode: the next card clicked is banished instead of taken. */
  toggleBanish() {
    const q = this.choice;
    if (!q || this.choiceLocked()) return;
    if (this.banishes <= 0 && !q.banishing) return;
    q.banishing = !q.banishing;
    this.ui.showChoice(q);
  }

  /** Remove a card's ability/item from every future offer this run, then reroll for free. */
  banish(card) {
    const kind = banishKind(card);
    if (!kind || this.banishes <= 0) return;
    this.banishes--;
    this.banished.add(banishId(card));
    this.log.push('banish', { kind: this.choice?.kind, card: this.log.card(card) });
    this.toast(`🚫 ${card.def?.name ?? card.ability.def.name} banished for this run`);
    sfx('select');
    this.reroll(true);
  }

  /** Cards can't be taken for a moment after they pop up (no accidental picks mid-fight). */
  choiceLocked() {
    return !!this.choice && performance.now() < (this.choice.lockUntil ?? 0);
  }

  choose(card) {
    if (this.choiceLocked()) return;
    if (card && this.choice?.banishing) return this.banish(card);
    this.log.pick(this.choice, card);
    if (!card) {
      this.addGold(10 + this.level * 2, true);
    } else if (card.type === 'newAbility') {
      this.addAbility(card.def);
    } else if (card.type === 'abilityUp') {
      card.ability.applyUpgrade(card.up, card.tier, card.gain);
    } else if (card.type === 'item') {
      this.addItem(card.def, card.tier, card.gain);
    } else if (card.type === 'gold') {
      this.addGold(card.amount, true);
    }
    sfx('select');
    this.choice = null;
    this.paused = false;
    this.ui.hideChoice();
  }

  // ── titans ────────────────────────────────────────────────
  titanCondText(t) {
    const c = t.cond, parts = [];
    if (c.level) parts.push({ ok: this.level >= c.level, text: `Reach level ${c.level}` });
    if (c.gold) parts.push({ ok: this.gold >= c.gold, text: `Bribe ${c.gold} gold` });
    if (c.bosses) parts.push({ ok: this.bossKills >= c.bosses, text: `Kill ${c.bosses} boss${c.bosses > 1 ? 'es' : ''}` });
    if (c.titans) parts.push({ ok: this.titanKills >= c.titans, text: `Defeat ${c.titans} Crime Titans` });
    return parts;
  }

  updateTitans(dt) {
    const p = this.player;
    for (const t of this.titans) {
      const altar = this.world.altars[t.i];
      if (t.state === 'locked' || t.state === 'ready') {
        const ok = this.titanCondText(t).every((c) => c.ok);
        if (ok && t.state === 'locked') {
          t.state = 'ready';
          this.toast(`🗿 ${t.def.name} can be summoned! Find the beam on the map.`);
        }
        if (!ok) t.state = 'locked';
        altar.beam.material.opacity = t.state === 'ready' ? 0.16 + Math.sin(this.time * 3) * 0.05 : 0;
        const inside = Math.hypot(p.x - t.pos[0], p.z - t.pos[1]) < 3;
        if (t.state === 'ready' && inside) {
          t.stand += dt;
          if (t.stand >= 1.5) this.summonTitan(t);
        } else {
          t.stand = Math.max(0, t.stand - dt * 2);
          if (inside && t.state === 'locked' && (!t.warned || this.time - t.warned > 4)) {
            t.warned = this.time;
            this.toast(`🗿 ${t.def.name}: ${this.titanCondText(t).filter((c) => !c.ok).map((c) => c.text).join(', ')}`);
          }
        }
        altar.fill.scale.setScalar(Math.max(0.001, t.stand / 1.5));
      }
    }
  }

  summonTitan(t) {
    if (t.cond.gold) this.gold -= t.cond.gold;
    t.state = 'active';
    t.stand = 0;
    this.world.altars[t.i].fill.scale.setScalar(0.001);
    this.world.altars[t.i].beam.material.opacity = 0.35;
    const a = Math.atan2(this.player.x - t.pos[0], this.player.z - t.pos[1]);
    t.mob = this.mobs.spawnBoss(t.boss, t.pos[0] - Math.sin(a) * 1, t.pos[1] - Math.cos(a) * 1, t);
    this.ui.banner(`${t.def.name}`, `CRIME TITAN — ${t.def.title}`, true);
    this.shake(0.5);
    sfx('titan');
  }

  // ── director ───────────────────────────────────────────────
  updateDirector(dt) {
    const tm = this.time / 60;
    const feds = this.time > this.cfg.duration;
    if (feds && !this.fedsArrived) {
      this.fedsArrived = true;
      this.ui.banner('THE FEDS HAVE ARRIVED', 'Everything hits harder every second. Finish the job!', true);
      sfx('titan');
    }
    const alive = this.mobs.alive;
    const target = Math.min(this.mobs.cap, (18 + tm * 22) * this.diff.spawn * (feds ? 1.5 : 1));
    const rate = (1.6 + tm * 1.15) * this.diff.spawn * (feds ? 2.5 : 1);
    this.spawnAcc += dt * rate * (alive < target ? 1 : 0.1);
    const roster = this.map.roster.filter((r) => r.from <= tm);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      const r = weighted(roster);
      const elite = Math.random() < (0.004 + tm * 0.0028) * (this.diff.elite ?? 1);
      const [x, z] = this.spawnPoint();
      const pack = !elite && Math.random() < 0.22 ? Math.floor(rand(3, 6)) : 1;
      for (let i = 0; i < pack; i++) this.mobs.spawn(r.mob, x + rand(-1.5, 1.5), z + rand(-1.5, 1.5), elite);
      if (elite && !this.seenElite) {
        this.seenElite = true;
        this.toast('💀 Elite thug (red ring): 7× HP, drops 10 gold and has a 25% chance to drop a chest');
      }
      this.spawnAcc -= pack - 1;
    }

    // encircling wave every minute
    if (this.time >= this.nextWave) {
      this.nextWave += 60;
      const r = roster[0];
      const n = Math.min(70, Math.round((20 + tm * 4) * this.diff.spawn));
      const p = this.player;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const x = p.x + Math.sin(a) * 22, z = p.z + Math.cos(a) * 22;
        if (Math.abs(x) < this.world.half - 2 && Math.abs(z) < this.world.half - 2 && !this.world.solidAt(x, z, 0.5)) this.mobs.spawn(r.mob, x, z, false);
      }
      this.toast(`⚠️ They're surrounding you!`);
    }

    // bosses
    if (!this.bossWarn && this.time >= this.nextBoss - 30) {
      const [x, z] = pick(this.map.bossSpawns);
      this.bossWarn = { x, z, at: this.nextBoss };
      this.toast(`☠️ A boss arrives in 30s (check the minimap)`);
    }
    if (this.bossWarn && this.time >= this.bossWarn.at) {
      const id = pick(this.map.bosses);
      this.mobs.spawnBoss(id, this.bossWarn.x, this.bossWarn.z);
      this.ui.banner(BOSSES[id].name, `BOSS — ${BOSSES[id].title}`);
      sfx('warn');
      this.bossWarn = null;
      this.nextBoss += this.cfg.bossEvery * (this.diff.boss ?? 1);
    }

    // chests
    this.nextChest -= dt * this.stats.chestRate;
    if (this.nextChest <= 0) {
      this.nextChest = rand(...this.cfg.chestEvery);
      if (this.pickups.chests.length < 4) {
        const p = this.player;
        for (let tries = 0; tries < 10; tries++) {
          const a = rand(0, TAU), r = rand(22, 55);
          const x = clamp(p.x + Math.sin(a) * r, -this.world.half + 5, this.world.half - 5);
          const z = clamp(p.z + Math.cos(a) * r, -this.world.half + 5, this.world.half - 5);
          if (!this.world.freeAt(x, z, 2)) continue;
          this.pickups.chest(x, z);
          this.toast('📦 A chest dropped somewhere nearby');
          break;
        }
      }
    }
  }

  // ── main loop ──────────────────────────────────────────────
  update(dt) {
    if (!this.paused && !this.choice && this.queue.length && !this.player.dead && !this.ended && this.time >= (this.choiceHold ?? 0)) this.openNextChoice();
    if (this.paused || this.ended) {
      this.updateCamera(0);
      return;
    }
    this.time += dt;
    this.stats = computeStats(this);
    const p = this.player;
    if (!p.dead) {
      const s = this.stats, hm = this.diff.heal ?? 1, leech = this.leech * hm, capped = Math.min(leech, s.maxHp * 0.06 * dt);
      const gain = s.regen * dt * hm + capped, room = s.maxHp - p.hp;
      p.hp = Math.min(s.maxHp, p.hp + gain);
      // Blood Money: healing you can't use (full HP, or over the per-second cap) tops up a shield
      if (s.overshield) {
        const over = leech - capped + Math.max(0, gain - room);
        if (over > 0) p.shield = Math.max(p.shield, Math.min(s.maxHp * 0.25, p.shield + over * 0.5));
      }
    }

    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) {
        this.timers.splice(i, 1);
        t.fn();
      }
    }

    // camera-relative movement: forward = away from the camera
    this.camYaw += this.input.turn(dt);
    const mv = p.dead ? { x: 0, y: 0 } : this.input.move();
    const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw);
    p.update(dt, { x: mv.x * cy - mv.y * sy, z: -mv.x * sy - mv.y * cy }, !p.dead && this.input.jump());
    this.pet?.update(dt);

    // buffs
    // buffs: {t, max, fx?, stats?(s, b), rate?, src?} — see computeStats
    for (const id in this.buffs) {
      const b = this.buffs[id];
      b.t -= dt;
      const col = b.fx ?? (id === 'frenzy' ? '#ff3b3b' : null);
      if (col && Math.random() < dt * 20) this.fx.burst(p.x, 0.5, p.z, col, 1, 2, 0.4, 0.7, -2);
      if (b.t <= 0) delete this.buffs[id];
    }

    // abilities
    if (!p.dead && !this.evacuating) {
      const power = this.buffs.frenzy?.power ?? 0;
      for (const a of this.abilities) {
        let rate = a.def.id === 'frenzy' ? 1 : a.def.id === 'pistol' ? 1 + power * 1.6 : 1 + power;
        for (const id in this.buffs) { const b = this.buffs[id]; if (b.rate && b.src !== a.def.id) rate += b.rate; }
        if (a.def.aura) { a.cd = 0; this.combat.aura(a); continue; }
        if (a.cd > 0) {
          a.cd -= dt * rate;
          if (a.cd > 0) continue;
          a.cd = 0;
        }
        // off cooldown: look for a target ten times a second; `wait` = how long it has been ready
        a.wait += dt;
        a.poll -= dt;
        if (a.poll > 0) continue;
        a.poll = 0.1;
        const tgt = a.def.ready(this, a);
        if (!tgt || (Array.isArray(tgt) && !tgt.length)) continue;
        const r = a.def.fire(this, a, tgt);
        if (r === false) continue;
        this.emit('fire', a, { tgt, x: tgt?.x ?? tgt?.[0]?.x, z: tgt?.z ?? tgt?.[0]?.z });
        a.cdMax = a.stat('cooldown');
        a.cd = a.cdMax;
        a.wait = 0;
      }
    }
    for (const it of this.allItems()) it.def.tick?.(this, it, dt);
    this.leech = 0;
    if (this.res) {
      const r = this.res;
      r.idle += dt;
      if (r.decay && r.idle > (r.decayDelay ?? 2) && !(this.hero.signature && this.sigReady() && Save.sigManual())) {
        r.value = Math.max(0, r.value - r.decay * dt); // a full meter waiting on a manual press doesn't drain
      }
      r.tick?.(this, dt);
      // signature move: on its own at a full meter (Auto), or on Y / F / ★ (Manual)
      const press = this.input.signature?.();
      if (this.hero.signature && this.sigReady() && (!Save.sigManual() || press)) this.useSignature();
    }

    this.updateDirector(dt);
    this.updateTitans(dt);
    this.mobs.update(dt);
    this.combat.update(dt);
    this.telegraphs.update(dt);
    this.pickups.update(dt);
    this.evac?.update(dt);
    this.fx.update(dt);
    this.log.update();
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const p = this.player;
    const k = this.camDist;
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.5);
    const s = this.shakeAmt;
    // follow the surface you're standing on, not every bit of jump height
    this.camY += ((p.ground + Math.max(0, p.y - p.ground) * 0.3) - this.camY) * Math.min(1, dt * 6);
    const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw);
    const D = 12.5 * k;
    this.camera.position.set(p.x + sy * D + rand(-s, s), 14 * k + this.camY, p.z + cy * D + rand(-s, s));
    this.camera.lookAt(p.x - sy * 1.5, 0.8 + this.camY, p.z - cy * 1.5);
    setSeeThrough(this.camera, p.x, p.y + 1, p.z, k);
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    // portrait phones: pull the camera back so you can see sideways
    this.camDist = aspect < 1 ? 1 + (1 - aspect) * 0.9 : 1;
    this.camera.updateProjectionMatrix();
  }

  // ── ending ─────────────────────────────────────────────────
  /** outcome: 'evac' (took the chopper) | 'died' | 'quit'. Clearing the map is what counts as a victory. */
  end(outcome = 'quit') {
    if (this.ended) return;
    this.ended = true;
    const victory = this.clearedAt != null;
    const evac = outcome === 'evac';
    const bonus = evac ? EVAC_BONUS : 1;
    const d = this.diff;
    const mins = this.time / 60;
    const heroXp = Math.round((this.kills * 0.5 + mins * 25 + this.bossKills * 60 + this.titanKills * 150 + (victory ? 300 : 0)) * d.heroXp * bonus * (1 + heroXpBonus(Save.acct('hero_training'))));
    const before = Save.hero(this.hero.id).level;
    const levels = Save.addHeroXp(this.hero.id, heroXp);
    Save.recordRun(this.hero.id, this.kills);
    const gear = this.gearDrops.map((piece) => ({ piece, set: piece.set }));
    const rep = Math.round(repForRun({ minutes: mins, bossKills: this.bossKills, titanKills: this.titanKills, victory, diffIndex: this.diffIndex }) * bonus);
    Save.addRep(rep);
    this.log.save(outcome);
    this.result = { victory, outcome, evac, overtime: victory ? this.time - this.clearedAt : 0, rep, heroXp, levels, before, after: before + levels, gear, time: this.time, kills: this.kills, level: this.level, gold: Math.round(this.goldTotal), dmgBy: this.dmgBy };
    this.ui.showEnd(this.result, this);
  }

  dispose() {
    this.combat.dispose();
    this.mobs.dispose();
    this.pickups.dispose();
    this.fx.dispose();
    this.telegraphs.dispose();
    this.player.dispose();
    this.pet?.dispose();
    this.evac?.dispose();
    this.world.dispose();
  }
}
