import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { MobManager } from './mobs.js';
import { Combat } from './combat.js';
import { Pickups } from './pickups.js';
import { FX } from './fx.js';
import { Telegraphs } from './telegraphs.js';
import { buildLoadout, computeStats, AbilityInst } from './stats.js';
import { levelOffers, itemOffers } from './upgrades.js';
import { MOBS, BOSSES } from '../data/mobs.js';
import { DIFFICULTIES, MAP_DEFAULTS } from '../data/maps.js';
import { Save } from '../save.js';
import { sfx } from '../audio.js';
import { rand, TAU, pick, weighted, clamp } from '../util.js';

/** XP needed to go from in-run level L to L+1. */
export const xpFor = (L) => Math.round(6 + 6 * (L - 1) + 0.8 * (L - 1) ** 2);

/**
 * One run on one map. Owns the scene and every system; abilities and items talk
 * to the world through the methods on this class (hit, explode, shoot, lob...).
 */
export class Run {
  constructor({ hero, map, diff, input, ui }) {
    this.hero = hero;
    this.map = map;
    this.diffIndex = diff;
    this.diff = DIFFICULTIES[diff];
    this.input = input;
    this.ui = ui;
    this.cfg = MAP_DEFAULTS;

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
    this.levelBonus = { hp: 0, dmg: 0 };
    this.buffs = {};
    this.items = { ring: [], title: [], rep: [] };
    this.abilities = [];
    this.timers = [];
    this.queue = [];
    this.choice = null;
    this.paused = false;
    this.ended = false;
    this.result = null;
    this.dmgBy = {};
    this.fedsArrived = false;

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
    this.stats = computeStats(this);
    this.player.hp = this.stats.maxHp;
    this.gold = this.stats.startGold;
    this.rerolls = this.stats.rerolls;

    this.addAbility(hero.abilities.find((a) => a.id === hero.start));
    if (this.flags.startFrenzy) this.addAbility(hero.abilities.find((a) => a.id === 'frenzy'));
    if (this.flags.godfather) this.combat.spawnGoon({ permanent: true, ability: null });

    // director
    this.spawnAcc = 0;
    this.nextWave = 60;
    this.nextBoss = this.cfg.firstBoss;
    this.bossWarn = null; // {x, z, t}
    this.nextChest = rand(...this.cfg.chestEvery) * 0.6;
    this.titans = map.titans.map((t, i) => ({ ...t, i, def: BOSSES[t.boss], state: 'locked', stand: 0, mob: null }));
  }

  // ── accessors used by abilities/items ──────────────────────
  get traps() { return this.combat.traps; }
  get orbits() { return this.combat.orbits; }
  allItems() { return [...this.items.ring, ...this.items.title, ...this.items.rep]; }
  findItem(id) { return this.allItems().find((i) => i.def.id === id); }
  abilityById(id) { return this.abilities.find((a) => a.def.id === id); }
  later(t, fn) { this.timers.push({ t, fn }); }
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
  spawnGoon(o) { this.combat.spawnGoon(o); }

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
    return a;
  }

  addItem(def, tier) {
    const own = this.findItem(def.id);
    if (own) {
      own.power += def.values[tier];
      own.level++;
      own.tier = Math.max(own.tier, tier);
    } else {
      this.items[def.slot].push({ def, power: def.values[tier], level: 1, tier });
    }
  }

  // ── combat pipeline ────────────────────────────────────────
  hit(m, base, ability, o = {}) {
    if (m.dead || base <= 0) return;
    const s = this.stats;
    let dmg = base;
    if (m.tier >= 1) dmg *= 1 + s.bigDmg;
    if (m.fear) dmg *= 1.12;
    let crit = false;
    if (!o.noCrit && Math.random() < s.crit) {
      crit = true;
      dmg *= 1 + s.critDmg;
    }
    dmg *= 1 - (m.armor ?? 0);
    m.hp -= dmg;
    m.flash = 1;
    const id = ability?.def?.id ?? (o.isBurn ? 'burn' : null);
    if (id) this.dmgBy[id] = (this.dmgBy[id] ?? 0) + dmg;
    if (o.knock && m.tier < 2) {
      const fx = o.fromX ?? this.player.x, fz = o.fromZ ?? this.player.z;
      const dx = m.x - fx, dz = m.z - fz, d = Math.hypot(dx, dz) || 1;
      const k = o.knock / (m.tier === 1 ? 2.5 : 1);
      m.kx += (dx / d) * k;
      m.kz += (dz / d) * k;
    }
    this.fx.number(m.x, m.height * 0.9 + 0.3, m.z, dmg, crit ? '#ffd23f' : o.color ?? '#ffffff', crit);
    if (!o.isBurn) {
      for (const it of this.allItems()) it.def.onHit?.(this, it, m, { amount: dmg, crit, ability, isBurn: false });
      sfx('hit', 0.05);
    }
    if (m.hp <= 0) this.kill(m, ability);
  }

  ignite(m, total, dur) {
    m.burnDps = Math.max(m.burnDps * (m.burnT > 0 ? 1 : 0), (total / dur) * (1 + this.stats.burnDmg));
    m.burnT = Math.max(m.burnT, dur);
  }

  explode(x, z, r, dmg, ability, o = {}) {
    for (const m of this.mobs.near(x, z, r)) this.hit(m, dmg, ability, { knock: o.small ? 1 : 5, fromX: x, fromZ: z });
    this.fx.explosion(x, z, r, o.color);
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
    if (m.tier <= 1) {
      this.pickups.gem(m.x, m.z, Math.max(1, Math.round(m.xp)));
      const gc = def.gold * (m.tier === 1 ? 1 : 1);
      if (m.tier === 1) for (let i = 0; i < 5; i++) this.pickups.coin(m.x + rand(-1, 1), m.z + rand(-1, 1), 2);
      else if (Math.random() < gc) this.pickups.coin(m.x, m.z, 1);
      if (Math.random() < (m.tier === 1 ? 0.08 : 0.004)) this.pickups.special('heal', m.x, m.z);
      if (Math.random() < 0.0012) this.pickups.special('magnet', m.x, m.z);
      if (m.tier === 1 && Math.random() < 0.06) this.pickups.chest(m.x, m.z, true);
    }
    if (m.tier === 2) {
      this.bossKills++;
      this.ui.banner(`${def.name} is down!`, 'Free level + loot');
      for (let i = 0; i < 12; i++) this.pickups.coin(m.x + rand(-2, 2), m.z + rand(-2, 2), 3);
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
      this.addXp(this.xpNext - this.xp + 0.01, true);
      if (def.final) {
        this.ui.banner(`${def.name} has fallen!`, 'The map is yours');
        sfx('victory');
        this.later(2.2, () => this.end(true));
      } else {
        this.ui.banner(`${def.name} has fallen!`, 'Titan loot');
        this.queue.push({ kind: 'item', minTier: 2, reason: `${def.name}'s stash` });
        sfx('victory');
      }
    }
    for (const it of this.allItems()) it.def.onKill?.(this, it, m);
    const chain = this.flags.chainReaction ?? 0;
    if (chain && ability?.def?.tags?.includes('explosive') && m.tier < 2 && Math.random() < chain) {
      this.later(0.08, () => this.explode(m.x, m.z, 2.6, ability.stat('damage') * 0.5, ability, { noShrapnel: true }));
    }
  }

  hurtPlayer(amount, src) {
    const p = this.player;
    if (p.dead || this.ended) return;
    if (Math.random() < this.stats.dodge) {
      this.fx.number(p.x, 1.8, p.z, 'dodge', '#9ad8ff');
      return;
    }
    let dmg = amount * (1 - this.stats.armor);
    for (const it of this.allItems()) if (it.def.onHurt) dmg = it.def.onHurt(this, it, dmg);
    if (p.shield > 0) {
      const a = Math.min(p.shield, dmg);
      p.shield -= a;
      dmg -= a;
    }
    if (dmg <= 0) return;
    p.hp -= dmg;
    p.hurtT = 1;
    this.fx.number(p.x, 1.9, p.z, dmg, '#ff5a5a');
    this.ui.hurtFlash();
    sfx('hurt', 0.15);
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      sfx('defeat');
      this.later(1.6, () => this.end(false));
    }
  }

  heal(v) {
    const p = this.player;
    if (p.dead) return;
    p.hp = Math.min(this.stats.maxHp, p.hp + v);
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
      this.player.hp += 3;
      this.queue.push({ kind: 'level', reason: `Level ${this.level}!  +3 max HP, +1% damage` });
      sfx('levelup', 0.15);
      this.fx.ring(this.player.x, this.player.z, 3, '#58c4ff', 0.5);
    }
  }

  chestCost() {
    return Math.round((20 + 14 * this.chestsOpened + 2 * this.chestsOpened ** 2) * (1 - this.stats.chestDiscount));
  }

  tryOpenChest(c) {
    const cost = c.free ? 0 : this.chestCost();
    if (this.gold < cost) {
      if (!c.warned || this.time - c.warned > 3) {
        c.warned = this.time;
        this.toast(`🔒 This chest costs ${cost} gold`);
      }
      return false;
    }
    this.gold -= cost;
    if (!c.free) this.chestsOpened++;
    sfx('chest');
    this.fx.burst(c.x, 1, c.z, '#ffd23f', 24, 6);
    this.queue.push({ kind: 'item', minTier: 0, reason: c.free ? 'Dropped by an elite' : `Chest opened (${cost} gold)` });
    return true;
  }

  // ── choices (level-up / loot) ──────────────────────────────
  openNextChoice() {
    const q = this.queue.shift();
    const cards = q.kind === 'level' ? levelOffers(this) : itemOffers(this, 3, q.minTier ?? 0);
    this.choice = { ...q, cards };
    this.paused = true;
    this.ui.showChoice(this.choice);
  }

  reroll() {
    if (!this.choice || this.rerolls <= 0) return;
    this.rerolls--;
    const q = this.choice;
    q.cards = q.kind === 'level' ? levelOffers(this) : itemOffers(this, 3, q.minTier ?? 0);
    this.ui.showChoice(q);
  }

  choose(card) {
    if (!card) {
      this.addGold(10 + this.level * 2, true);
    } else if (card.type === 'newAbility') {
      this.addAbility(card.def);
    } else if (card.type === 'abilityUp') {
      card.ability.applyUpgrade(card.up, card.tier);
    } else if (card.type === 'item') {
      this.addItem(card.def, card.tier);
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
    if (c.titans) parts.push({ ok: this.titanKills >= c.titans, text: `Defeat ${c.titans} titans` });
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
    this.ui.banner(`${t.def.name}`, `TITAN — ${t.def.title}`, true);
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
      const elite = Math.random() < 0.004 + tm * 0.0028;
      const [x, z] = this.spawnPoint();
      const pack = !elite && Math.random() < 0.22 ? Math.floor(rand(3, 6)) : 1;
      for (let i = 0; i < pack; i++) this.mobs.spawn(r.mob, x + rand(-1.5, 1.5), z + rand(-1.5, 1.5), elite);
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
      this.nextBoss += this.cfg.bossEvery;
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
          if (this.world.solidAt(x, z, 2)) continue;
          this.pickups.chest(x, z);
          this.toast('📦 A chest dropped somewhere nearby');
          break;
        }
      }
    }
  }

  // ── main loop ──────────────────────────────────────────────
  update(dt) {
    if (!this.paused && !this.choice && this.queue.length && !this.player.dead && !this.ended) this.openNextChoice();
    if (this.paused || this.ended) {
      this.updateCamera(0);
      return;
    }
    this.time += dt;
    this.stats = computeStats(this);
    const p = this.player;
    if (!p.dead) {
      p.hp = Math.min(this.stats.maxHp, p.hp + this.stats.regen * dt);
    }

    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) {
        this.timers.splice(i, 1);
        t.fn();
      }
    }

    p.update(dt, p.dead ? { x: 0, y: 0 } : this.input.move());

    // buffs
    const fr = this.buffs.frenzy;
    if (fr) {
      fr.t -= dt;
      if (Math.random() < dt * 20) this.fx.burst(p.x, 0.5, p.z, '#ff3b3b', 1, 2, 0.4, 0.7, -2);
      if (fr.t <= 0) delete this.buffs.frenzy;
    }

    // abilities
    if (!p.dead) {
      const power = this.buffs.frenzy?.power ?? 0;
      for (const a of this.abilities) {
        const rate = a.def.id === 'frenzy' ? 1 : a.def.id === 'pistol' ? 1 + power * 1.6 : 1 + power;
        a.cd -= dt * rate;
        if (a.cd > 0) continue;
        const tgt = a.def.ready(this, a);
        if (!tgt || (Array.isArray(tgt) && !tgt.length)) { a.cd = 0.1; continue; }
        const r = a.def.fire(this, a, tgt);
        a.cdMax = a.stat('cooldown');
        a.cd = r === false ? 0.1 : a.cdMax;
      }
    }
    for (const it of this.allItems()) it.def.tick?.(this, it, dt);

    this.updateDirector(dt);
    this.updateTitans(dt);
    this.mobs.update(dt);
    this.combat.update(dt);
    this.telegraphs.update(dt);
    this.pickups.update(dt);
    this.fx.update(dt);
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const p = this.player;
    const k = this.camDist;
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.5);
    const s = this.shakeAmt;
    this.camera.position.set(p.x + rand(-s, s), 14 * k, p.z + 12.5 * k + rand(-s, s));
    this.camera.lookAt(p.x, 0.8, p.z - 1.5);
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    // portrait phones: pull the camera back so you can see sideways
    this.camDist = aspect < 1 ? 1 + (1 - aspect) * 0.9 : 1;
    this.camera.updateProjectionMatrix();
  }

  // ── ending ─────────────────────────────────────────────────
  end(victory) {
    if (this.ended) return;
    this.ended = true;
    const d = this.diff;
    const mins = this.time / 60;
    const heroXp = Math.round((this.kills * 0.5 + mins * 25 + this.bossKills * 60 + this.titanKills * 150 + (victory ? 300 : 0)) * d.heroXp);
    const before = Save.hero(this.hero.id).level;
    const levels = Save.addHeroXp(this.hero.id, heroXp);
    Save.recordRun(this.hero.id, this.kills);
    let gear = null;
    if (victory) {
      Save.recordClear(this.map.id, this.diffIndex);
      const gdef = this.hero.gear?.find((g) => g.id === this.map.gear);
      if (gdef) {
        const cur = Save.gearTier(this.hero.id, gdef.id);
        let next = cur < 0 ? d.gearMin : Math.min(d.gearCap, cur + 1);
        next = Math.max(next, d.gearMin);
        if (next > cur) Save.setGear(this.hero.id, gdef.id, next);
        gear = { def: gdef, from: cur, to: Math.max(cur, next), capped: next <= cur };
      }
    }
    this.result = { victory, heroXp, levels, before, after: before + levels, gear, time: this.time, kills: this.kills, level: this.level, gold: Math.round(this.goldTotal), dmgBy: this.dmgBy };
    this.ui.showEnd(this.result, this);
  }

  dispose() {
    this.combat.dispose();
    this.mobs.dispose();
    this.pickups.dispose();
    this.fx.dispose();
    this.telegraphs.dispose();
    this.player.dispose();
    this.world.dispose();
  }
}
