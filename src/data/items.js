/**
 * In-run items (lost when the run ends). 7 slots: 2 Rings, 1 Crime Title,
 * 2 Reputations, 2 Contraband. Contraband is per ability and lives in
 * data/contraband.js (bought at the Black Market).
 * `v` is the power a common roll gives; higher tiers roll bigger
 * and every roll shrinks the more power the item already has (tiers.scaledGain),
 * so an early purple matters far more than a fifth grey.
 * room(run, it) — optional: how much more power still does something (chance
 * items stop at 100%, luck at 150...). Rolls are clipped to it, and an item with
 * no room left is retired from offers for free (run.maxed).
 *
 * Some Crime Titles change how a KIND of ability plays. `needs` (a tag, or a
 * test on an ability def) keeps them out of offers unless you hold a matching
 * ability, or still have a free slot and a matching ability you could get.
 * `relevant` does the same for other items (no +area offers for a kit with no
 * area). abil(v, a, k) -> [pct, flat] adds to ability a's stat k (like an upgrade).
 *
 * Hooks (optional): stats(v, s) · onKill(run, it, mob) · onHit(run, it, mob, hit)
 * · onHurt(run, it, amount) -> amount · tick(run, it, dt)
 */
import { CONTRA_BY_ID } from './contraband.js';

export const SLOTS = { ring: 2, title: 1, rep: 2, stash: 2 };
/** Luck stops counting past this. */
export const MAX_LUCK = 150;
/** Crit chance stops counting past this (every 100% over the first is one more crit tier: see Run.hit). */
export const MAX_CRIT = 4;
const fearDmg = (v) => 0.12 + v * 0.1;
const fearSlow = (v) => Math.min(0.5, 0.3 + v * 0.04);
const arsonBurn = (v) => 0.6 + Math.max(0, v - 100) / 100;
export const SLOT_NAMES = { ring: 'Ring', title: 'Crime Title', rep: 'Reputation', stash: 'Contraband' };

const has = (a, tag) => a.def.tags.includes(tag);
const pct = (v) => `${v >= 10 ? Math.round(v) : +v.toFixed(1)}%`;

export const ITEMS = [
  // ── Rings: straightforward stats ──
  { id: 'brass_ring', slot: 'ring', name: 'Brass Knuckle Ring', icon: '👊', v: 20,
    desc: (v) => `+${pct(v)} damage`, stats: (v, s) => { s.dmg += v / 100; } },
  { id: 'pinky_ring', slot: 'ring', name: 'Pinky Ring', icon: '💍', v: 8,
    desc: (v) => `+${pct(v)} crit chance. Past 100%, crits can crit again (double crit ×1.5, triple ×1.25 more...)`, stats: (v, s) => { s.crit += v / 100; },
    room: (run) => (MAX_CRIT - run.stats.crit) * 100 },
  { id: 'dice_ring', slot: 'ring', name: 'Loaded Dice Ring', icon: '🎲', v: 20,
    desc: (v) => `+${Math.round(v)} luck`, stats: (v, s) => { s.luck += v; },
    room: (run) => MAX_LUCK - run.stats.luck },
  { id: 'gold_ring', slot: 'ring', name: 'Gold Tooth Ring', icon: '🦷', v: 30,
    desc: (v) => `+${pct(v)} gold, +${pct(v / 2)} pickup range`, stats: (v, s) => { s.goldGain += v / 100; s.pickup *= 1 + v / 200; } },
  { id: 'mood_ring', slot: 'ring', name: 'Mood Ring', icon: '🔮', v: 18,
    desc: (v) => `+${pct(v)} area`, stats: (v, s) => { s.area += v / 100; }, relevant: (d) => d.base.area != null },
  { id: 'teething_ring', slot: 'ring', name: 'Teething Ring', icon: '⭕', v: 30,
    // the more max HP you have (from anywhere), the harder you hit
    desc: (v) => `+${Math.round(v)} max HP, +${(v / 40).toFixed(1)} HP/s, and +${pct(v / 8)} damage per 100 max HP you have`,
    stats: (v, s) => { s.maxHp += v; s.regen += v / 40; s.hpDmg += v / 800; } },
  { id: 'diamond_ring', slot: 'ring', name: 'Ice Ring', icon: '💎', v: 12,
    desc: (v) => `+${pct(v)} Recharge Rate`, stats: (v, s) => { s.haste += v / 100; }, relevant: (d) => d.base.cooldown != null },

  // ── Crime Titles: one build-defining effect (1 slot, so pick the one your build wants) ──
  { id: 'kingpin', slot: 'title', name: 'Kingpin', icon: '👑', v: 45,
    desc: (v) => `+${pct(v)} damage to elites, bosses and titans. They pay tribute when they die: ${Math.round(v / 5)} extra gold from elites, ${Math.round(v / 5) * 5} from bosses and titans`,
    stats: (v, s) => { s.bigDmg += v / 100; },
    onKill: (run, it, m) => {
      if (m.tier < 1) return;
      const gold = Math.round(it.power / 5) * (m.tier >= 2 ? 5 : 1);
      for (let i = 0, n = Math.min(12, Math.ceil(gold / 3)); i < n; i++) run.pickups.coin(m.x + (Math.random() - 0.5) * 2, m.z + (Math.random() - 0.5) * 2, gold / n);
    } },
  { id: 'hitman', slot: 'title', name: 'Hitman', icon: '🎯', v: 40,
    desc: (v) => `+${pct(v)} crit damage, +${pct(v / 5)} crit chance`, stats: (v, s) => { s.critDmg += v / 100; s.crit += v / 500; } },
  { id: 'bagman', slot: 'title', name: 'Bagman', icon: '💰', v: 2,
    // the damage cap grows with the item (18× its per-25-gold rate): ~36% on a grey, ~260% after six blues
    desc: (v) => `+${pct(v)} damage per 25 gold you carry (max ${pct(v * 18)}), +${pct(v * 10)} gold`,
    stats: (v, s, run) => { s.goldGain += v / 10; s.dmg += Math.min(v * 0.18, (run.gold / 25) * (v / 100)); } },
  { id: 'getaway', slot: 'title', name: 'Getaway Driver', icon: '🏎️', v: 10,
    desc: (v) => `+${pct(v)} move speed, +${pct(v * 1.5)} damage while moving`,
    stats: (v, s, run) => { s.speed *= 1 + v / 100; if (run.player.moving) s.dmg += (v * 1.5) / 100; } },
  { id: 'arsonist', slot: 'title', name: 'Arsonist', icon: '🔥', v: 20,
    // past 100% ignite chance, the extra goes into the burn instead
    desc: (v) => `${pct(Math.min(100, v))} chance on hit to ignite: ${pct(arsonBurn(v) * 100)} of the hit as burn over 3s${v < 100 ? ' (past 100% chance, the burn grows instead)' : ''}`,
    onHit: (run, it, mob, hit) => { if (!hit.isBurn && Math.random() < it.power / 100) run.ignite(mob, hit.amount * arsonBurn(it.power), 3); } },

  // ── Reputations: procs & quirks (always offered) ──
  { id: 'street_cred', slot: 'rep', name: 'Street Cred', icon: '😎', v: 0.6,
    desc: (v) => `Kills grant +${pct(v)} damage, stacking 30×. Stacks fade if you stop killing.`,
    stats: (v, s, run, it) => { s.dmg += ((it.stacks ?? 0) * v) / 100; },
    onKill: (run, it) => { it.stacks = Math.min(30, (it.stacks ?? 0) + 1); it.idle = 0; },
    tick: (run, it, dt) => { it.idle = (it.idle ?? 0) + dt; if (it.idle > 2 && it.stacks > 0) { it.stacks = Math.max(0, it.stacks - dt * 4); } } },
  { id: 'feared', slot: 'rep', name: 'Feared', icon: '😱', v: 0.9,
    desc: (v) => `Enemies within ${(2.5 + v).toFixed(1)}m are slowed ${pct(fearSlow(v) * 100)} and take +${pct(fearDmg(v) * 100)} damage`,
    stats: (v, s) => { s.fearRadius = Math.max(s.fearRadius, 2.5 + v); s.fearDmg = Math.max(s.fearDmg, fearDmg(v)); s.fearSlow = Math.max(s.fearSlow, fearSlow(v)); } },
  { id: 'snitch', slot: 'rep', name: 'Snitch Network', icon: '🐀', v: 18,
    desc: (v) => `+${pct(v)} XP, chests show up ${pct(v)} more often`, stats: (v, s) => { s.xpGain += v / 100; s.chestRate += v / 100; } },
  { id: 'untouchable', slot: 'rep', name: 'Untouchable', icon: '🫥', v: 8,
    desc: (v) => `${pct(v)} chance to dodge a hit (max 60%). Every dodge hits back (${Math.round(20 + v * 2)} damage) and gives +${pct(v * 2)} crit chance for 2s`,
    stats: (v, s) => { s.dodge += v / 100; },
    onDodge: (run, it, src) => {
      const pw = it.power;
      run.buffs.untouchable = { t: 2, max: 2, fx: '#9ad8ff', stats: (s) => { s.crit += (pw * 2) / 100; } };
      if (src && src.hp != null && !src.dead) run.hit(src, (20 + pw * 2) * run.stats.dmg, null, { knock: 4, color: '#9ad8ff' });
    },
    room: (run) => (0.6 - run.stats.dodge) * 100 },
  { id: 'loan_shark', slot: 'rep', name: 'Loan Shark', icon: '🦈', v: 12,
    desc: (v) => `${pct(v)} chance on kill to heal 3 HP; 60% of those also pay 1 gold`,
    onKill: (run, it) => { if (Math.random() < it.power / 100) { run.heal(3); if (Math.random() < 0.6) run.addGold(1, true); } },
    room: (run, it) => 100 - (it?.power ?? 0) },
  { id: 'made_man', slot: 'rep', name: 'Made Man', icon: '🤌', v: 0.06,
    desc: (v) => `Every kill shaves ${v.toFixed(2)}s off all ability cooldowns`,
    onKill: (run, it) => { for (const a of run.abilities) a.cd = Math.max(0, a.cd - it.power); } },
  { id: 'omerta', slot: 'rep', name: 'Omertà', icon: '🤐', v: 25,
    desc: (v) => `Every 12s gain a ${Math.round(v)} HP shield. While any shield holds: +${pct(v * 0.4)} damage`,
    stats: (v, s, run) => { if (run.player.shield > 0) s.dmg += (v * 0.4) / 100; },
    tick: (run, it, dt) => { it.t = (it.t ?? 0) + dt; if (it.t >= 12) { it.t = 0; run.player.shield = Math.max(run.player.shield, it.power); } } },
  { id: 'blood_money', slot: 'rep', name: 'Blood Money', icon: '🩸', v: 2.5,
    desc: (v) => `Heal for ${pct(v)} of all damage you deal (max 6% of max HP per second). Healing you can't use becomes a shield (up to 25% of max HP)`,
    stats: (v, s) => { s.lifesteal += v / 100; s.overshield = 1; },
    room: (run, it) => 20 - (it?.power ?? 0) },

  // ── Crime Titles for one kind of ability (only offered when your kit can use them) ──
  { id: 'drum_mag', slot: 'title', name: 'Drum Magazine', icon: '🥁', v: 11, needs: 'gun',
    desc: (v) => `Gun abilities: +${pct(v)} Recharge Rate and +${Math.round(v / 15)} pierce`,
    abil: (v, a, k) => has(a, 'gun') && (k === 'cooldown' ? [v / 100, 0] : k === 'pierce' ? [0, Math.round(v / 15)] : null) },
  { id: 'hollow_tips', slot: 'title', name: 'Hollow Tips', icon: '🔩', v: 11, needs: 'projectile',
    desc: (v) => `Projectile hits have a ${pct(v)} chance to burst, hitting everything nearby for 60% of the damage`,
    stats: (v, s) => { s.projBurst += v / 100; }, room: (run, it) => 100 - (it?.power ?? 0) },
  { id: 'det_cord', slot: 'title', name: 'Det Cord', icon: '🧶', v: 9, needs: 'explosive',
    desc: (v) => `Explosions are ${pct(v)} bigger and leave burning ground for 2s (${pct(v * 1.5)} of the blast per second)`,
    stats: (v, s) => { s.blastArea += v / 100; s.blastBurn += (v * 1.5) / 100; } },
  { id: 'grappa', slot: 'title', name: "Grandpa's Grappa", icon: '🍶', v: 15, needs: 'fire',
    desc: (v) => `+${pct(v)} burn damage. Burning thugs take +${pct(v / 2)} damage from everything.`,
    stats: (v, s) => { s.burnDmg += v / 100; s.burnVuln += v / 200; } },
  { id: 'lead_pipe', slot: 'title', name: 'Lead Pipe', icon: '🔧', v: 14, needs: 'melee',
    desc: (v) => `Melee abilities: +${pct(v)} damage, +${pct(v / 2)} area, and they heal you for ${pct(v / 8)} of it`,
    abil: (v, a, k) => has(a, 'melee') && (k === 'damage' ? [v / 100, 0] : k === 'area' ? [v / 200, 0] : null),
    stats: (v, s) => { s.meleeLeech += v / 800; } },
  { id: 'rolodex', slot: 'title', name: 'Rolodex', icon: '📇', v: 15, needs: 'summon',
    desc: (v) => `Summons: +${pct(v)} damage and duration, and +${Math.round(v / 20)} extra summon${v >= 30 ? 's' : ''}`,
    abil: (v, a, k) => has(a, 'summon') && (k === 'damage' || k === 'duration' ? [v / 100, 0] : k === 'count' ? [0, Math.round(v / 20)] : null) },
  { id: 'spinning_top', slot: 'title', name: 'Spinning Top', icon: '🪀', v: 11, needs: 'aura',
    desc: (v) => `Auras: +${pct(v)} damage and radius, and +${Math.round(v / 15)} orbiting object${v >= 23 ? 's' : ''}`,
    abil: (v, a, k) => has(a, 'aura') && (k === 'damage' || k === 'area' ? [v / 100, 0] : k === 'count' ? [0, Math.round(v / 15)] : null) },
  { id: 'bear_trap', slot: 'title', name: 'Bear Trap Spool', icon: '🪤', v: 15, needs: 'trap',
    desc: (v) => `Traps: +${pct(v)} damage and area, +${Math.round(v / 20)} max traps. Triggered traps root for ${(v / 20).toFixed(0)}s.`,
    abil: (v, a, k) => has(a, 'trap') && (k === 'damage' || k === 'area' ? [v / 100, 0] : k === 'count' ? [0, Math.round(v / 20)] : null),
    stats: (v, s) => { s.trapRoot = Math.max(s.trapRoot ?? 0, v / 20); } },
  { id: 'sugar_cube', slot: 'title', name: 'Sugar Cube', icon: '🧊', v: 11, needs: 'buff',
    desc: (v) => `Self-buffs last ${pct(v)} longer. While one is up: +${pct(v)} move speed and damage.`,
    abil: (v, a, k) => has(a, 'buff') && k === 'duration' && [v / 100, 0],
    stats: (v, s, run) => { for (const id in run.buffs) if (run.buffs[id].src) { s.speedPct += v / 100; s.dmg += v / 100; break; } } },
  { id: 'chalk', slot: 'title', name: 'Chalk Outline', icon: '✏️', v: 11, needs: 'control',
    desc: (v) => `Rooted, slowed and stunned thugs take +${pct(v)} damage. Control abilities last ${pct(v / 2)} longer.`,
    stats: (v, s) => { s.ctrlDmg += v / 100; },
    abil: (v, a, k) => has(a, 'control') && k === 'duration' && [v / 200, 0] },
  { id: 'nitro', slot: 'title', name: 'Nitro Can', icon: '🛢️', v: 15, needs: 'vehicle',
    desc: (v) => `Vehicles: +${pct(v)} damage and they explode at the end of their run (${pct(v * 3)} of their damage)`,
    abil: (v, a, k) => has(a, 'vehicle') && k === 'damage' && [v / 100, 0],
    stats: (v, s) => { s.nitro = Math.max(s.nitro, (v * 3) / 100); } },
  { id: 'tesla_battery', slot: 'title', name: 'Car Battery', icon: '🔋', v: 11, needs: 'science',
    desc: (v) => `Science gadgets: +${pct(v)} damage and Recharge Rate. Chains and robots jump +${Math.round(v / 15)} extra target${v >= 23 ? 's' : ''}.`,
    abil: (v, a, k) => has(a, 'science') && (k === 'damage' || k === 'cooldown' ? [v / 100, 0] : null),
    stats: (v, s) => { s.extraJumps = Math.round(v / 15); } },
  { id: 'toe_tag', slot: 'title', name: 'Toe Tag', icon: '🏷️', v: 3, needs: (d) => d.base.execute != null,
    desc: (v) => `Executes reach +${pct(v)} more HP, and every execute heals ${Math.round(v)} HP`,
    abil: (v, a, k) => k === 'execute' && (a.def.base.execute != null) && [0, v / 100],
    stats: (v, s) => { s.execHeal = v; }, room: (run, it) => 30 - (it?.power ?? 0) },
  { id: 'rat_poison', slot: 'title', name: 'Rat Poison', icon: '☠️', v: 14, needs: 'poison',
    desc: (v) => `Poison abilities: +${pct(v)} damage and +${pct(v)} duration`,
    abil: (v, a, k) => has(a, 'poison') && (k === 'damage' || k === 'duration' || k === 'power' ? [v / 100, 0] : null) },
  { id: 'pitching_arm', slot: 'title', name: 'Little League Arm', icon: '⚾', v: 11, needs: 'thrown',
    desc: (v) => `Thrown abilities: +${pct(v)} damage, +${pct(v)} range and +${pct(v / 2)} area`,
    abil: (v, a, k) => has(a, 'thrown') && (k === 'damage' || k === 'range' ? [v / 100, 0] : k === 'area' ? [v / 200, 0] : null) },
  { id: 'kevlar', slot: 'title', name: 'Kevlar Onesie', icon: '🦺', v: 15, needs: 'defense',
    desc: (v) => `Defensive abilities: +${pct(v)} power and Recharge Rate, and you take ${pct(v / 5)} less damage`,
    abil: (v, a, k) => has(a, 'defense') && (k === 'power' || k === 'cooldown' ? [v / 100, 0] : null),
    stats: (v, s) => { s.armor += v / 500; } },
];

/** Compact HUD readouts: short(v, run, it) -> 'abbreviated value / value'. */
const n = (v) => Math.round(v);
const SHORT = {
  brass_ring: (v) => `+${n(v)}% DMG`,
  pinky_ring: (v) => `+${n(v)}% CRIT`,
  dice_ring: (v) => `+${n(v)} LCK`,
  gold_ring: (v) => `+${n(v)}% GOLD / +${n(v / 2)}% PICKUP`,
  mood_ring: (v) => `+${n(v)}% AREA`,
  teething_ring: (v) => `+${n(v)} HP / +${(v / 8).toFixed(1)}% DMG PER 100 HP`,
  diamond_ring: (v) => `+${n(v)}% RECHARGE`,
  kingpin: (v) => `+${n(v)}% DMG VS BIG / ${n(v / 5)}G TRIBUTE`,
  hitman: (v) => `+${n(v)}% CRIT DMG / +${n(v / 5)}% CRIT`,
  bagman: (v, run) => `+${n(Math.min(v * 18, ((run?.gold ?? 0) / 25) * v))}% DMG / +${n(v * 10)}% GOLD`,
  getaway: (v) => `+${n(v)}% SPD / +${n(v * 1.5)}% DMG MOVING`,
  arsonist: (v) => `${n(Math.min(100, v))}% IGNITE / ${n(arsonBurn(v) * 100)}% BURN`,
  street_cred: (v, run, it) => `+${n((it?.stacks ?? 0) * v)}% DMG (${Math.floor(it?.stacks ?? 0)}/30)`,
  feared: (v) => `${(2.5 + v).toFixed(1)}M FEAR / +${n(fearDmg(v) * 100)}% DMG`,
  snitch: (v) => `+${n(v)}% XP / +${n(v)}% CHESTS`,
  untouchable: (v) => `${n(v)}% DODGE / +${n(v * 2)}% CRIT ON DODGE`,
  loan_shark: (v) => `${n(v)}% HEAL ON KILL`,
  made_man: (v) => `-${v.toFixed(2)}S CD / KILL`,
  omerta: (v) => `${n(v)} SHIELD / 12S / +${n(v * 0.4)}% DMG SHIELDED`,
  blood_money: (v) => `${(+v.toFixed(1))}% LIFESTEAL`,
  drum_mag: (v) => `+${n(v)}% GUN RECHARGE / +${Math.round(v / 15)} GUN PIERCE`,
  hollow_tips: (v) => `${n(v)}% PROJ BURST`,
  det_cord: (v) => `+${n(v)}% BLAST / ${n(v * 1.5)}% BURN`,
  grappa: (v) => `+${n(v)}% BURN / +${n(v / 2)}% VS BURNING`,
  lead_pipe: (v) => `+${n(v)}% MELEE DMG / +${n(v / 2)}% AREA`,
  rolodex: (v) => `+${n(v)}% SUMMON DMG / +${Math.round(v / 20)} SUMMON`,
  spinning_top: (v) => `+${n(v)}% AURA DMG / +${Math.round(v / 15)} ORBIT`,
  bear_trap: (v) => `+${n(v)}% TRAP DMG / +${Math.round(v / 20)} TRAPS`,
  sugar_cube: (v) => `+${n(v)}% BUFF DUR`,
  chalk: (v) => `+${n(v)}% VS CC`,
  nitro: (v) => `+${n(v)}% CAR DMG / ${n(v * 3)}% BLAST`,
  tesla_battery: (v) => `+${n(v)}% SCIENCE DMG / +${Math.round(v / 15)} JUMP`,
  toe_tag: (v) => `+${n(v)}% EXECUTE`,
};
/** What "maxed" means for items with a room() cap (shown in tooltips). */
const CAP = {
  pinky_ring: `${MAX_CRIT * 100}% crit chance`, dice_ring: `${MAX_LUCK} luck`, untouchable: '60% dodge',
  loan_shark: '100% chance', blood_money: '20% lifesteal', hollow_tips: '100% burst chance', toe_tag: '+30% execute',
};
/** Which ability tags a Contraband item works with (for tooltips/cards). */
const NEEDS_LABEL = { toe_tag: 'execute' };
/**
 * Which of your abilities an item changes (for hover highlights). Items that only
 * touch the hero (HP, gold, XP, dodge...) affect none.
 */
const deals = (a) => a.def.base.damage != null;
const tag = (t) => (a) => a.def.tags.includes(t);
const AFFECTS = {
  brass_ring: deals, pinky_ring: deals, hitman: deals, kingpin: deals, bagman: deals, getaway: deals, arsonist: deals,
  street_cred: deals, feared: deals, blood_money: deals,
  mood_ring: (a) => a.def.base.area != null,
  diamond_ring: (a) => a.def.base.cooldown != null, made_man: (a) => a.def.base.cooldown != null,
  hollow_tips: tag('projectile'), toe_tag: (a) => a.def.base.execute != null,
};
SHORT.rat_poison = (v) => `+${n(v)}% POISON`;
SHORT.pitching_arm = (v) => `+${n(v)}% THROWN`;
SHORT.kevlar = (v) => `+${n(v)}% DEFENSE`;
for (const it of ITEMS) {
  it.affects = AFFECTS[it.id] ?? (it.needs && typeof it.needs === 'string' ? tag(it.needs) : () => false);
  it.short = SHORT[it.id] ?? ((v) => it.desc(v));
  it.cap = CAP[it.id];
  if (it.needs) it.needsLabel = NEEDS_LABEL[it.id] ?? it.needs;
  // the offer filter tests ability defs (owned or still obtainable)
  const nd = it.needs ?? it.relevant;
  if (nd) it.fits = typeof nd === 'function' ? nd : (d) => d.tags.includes(nd);
}

export const itemById = (id) => ITEMS.find((i) => i.id === id) ?? CONTRA_BY_ID.get(id);
