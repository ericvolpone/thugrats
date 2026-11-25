/**
 * In-run items (lost when the run ends). 5 slots: 2 Rings, 1 Crime Title,
 * 2 Reputations. `v` is the power a common roll gives; higher tiers roll bigger
 * and every roll shrinks the more power the item already has (tiers.scaledGain),
 * so an early purple matters far more than a fifth grey.
 * maxed(run, it) — optional: stop offering the item once more of it is wasted.
 *
 * Hooks (optional): stats(v, s) · onKill(run, it, mob) · onHit(run, it, mob, hit)
 * · onHurt(run, it, amount) -> amount · tick(run, it, dt)
 */
export const SLOTS = { ring: 2, title: 1, rep: 2 };
export const SLOT_NAMES = { ring: 'Ring', title: 'Crime Title', rep: 'Reputation' };

const pct = (v) => `${v >= 10 ? Math.round(v) : +v.toFixed(1)}%`;

export const ITEMS = [
  // ── Rings: straightforward stats ──
  { id: 'brass_ring', slot: 'ring', name: 'Brass Knuckle Ring', icon: '👊', v: 20,
    desc: (v) => `+${pct(v)} damage`, stats: (v, s) => { s.dmg += v / 100; } },
  { id: 'pinky_ring', slot: 'ring', name: 'Pinky Ring', icon: '💍', v: 8,
    desc: (v) => `+${pct(v)} crit chance`, stats: (v, s) => { s.crit += v / 100; },
    maxed: (run) => run.stats.crit >= 1 },
  { id: 'dice_ring', slot: 'ring', name: 'Loaded Dice Ring', icon: '🎲', v: 20,
    desc: (v) => `+${Math.round(v)} luck`, stats: (v, s) => { s.luck += v; } },
  { id: 'gold_ring', slot: 'ring', name: 'Gold Tooth Ring', icon: '🦷', v: 30,
    desc: (v) => `+${pct(v)} gold, +${pct(v / 2)} pickup range`, stats: (v, s) => { s.goldGain += v / 100; s.pickup *= 1 + v / 200; } },
  { id: 'mood_ring', slot: 'ring', name: 'Mood Ring', icon: '🔮', v: 18,
    desc: (v) => `+${pct(v)} area`, stats: (v, s) => { s.area += v / 100; } },
  { id: 'teething_ring', slot: 'ring', name: 'Teething Ring', icon: '⭕', v: 30,
    desc: (v) => `+${Math.round(v)} max HP, +${(v / 40).toFixed(1)} HP/s`, stats: (v, s) => { s.maxHp += v; s.regen += v / 40; } },
  { id: 'diamond_ring', slot: 'ring', name: 'Ice Ring', icon: '💎', v: 12,
    desc: (v) => `+${pct(v)} cooldown speed`, stats: (v, s) => { s.haste += v / 100; } },

  // ── Crime Titles: one build-defining effect ──
  { id: 'kingpin', slot: 'title', name: 'Kingpin', icon: '👑', v: 35,
    desc: (v) => `+${pct(v)} damage to elites, bosses and titans`, stats: (v, s) => { s.bigDmg += v / 100; } },
  { id: 'hitman', slot: 'title', name: 'Hitman', icon: '🎯', v: 40,
    desc: (v) => `+${pct(v)} crit damage, +${pct(v / 5)} crit chance`, stats: (v, s) => { s.critDmg += v / 100; s.crit += v / 500; } },
  { id: 'bagman', slot: 'title', name: 'Bagman', icon: '💰', v: 2,
    desc: (v) => `+${pct(v)} damage per 25 gold you carry (max 60%), +${pct(v * 10)} gold`,
    stats: (v, s, run) => { s.goldGain += v / 10; s.dmg += Math.min(0.6, (run.gold / 25) * (v / 100)); } },
  { id: 'getaway', slot: 'title', name: 'Getaway Driver', icon: '🏎️', v: 10,
    desc: (v) => `+${pct(v)} move speed, +${pct(v * 1.5)} damage while moving`,
    stats: (v, s, run) => { s.speed *= 1 + v / 100; if (run.player.moving) s.dmg += (v * 1.5) / 100; } },
  { id: 'arsonist', slot: 'title', name: 'Arsonist', icon: '🔥', v: 20,
    desc: (v) => `${pct(v)} chance on hit to ignite: 60% of the hit as burn over 3s`,
    onHit: (run, it, mob, hit) => { if (!hit.isBurn && Math.random() < it.power / 100) run.ignite(mob, hit.amount * 0.6, 3); },
    maxed: (run, it) => it.power >= 100 },

  // ── Reputations: procs & quirks (always offered) ──
  { id: 'street_cred', slot: 'rep', name: 'Street Cred', icon: '😎', v: 0.6,
    desc: (v) => `Kills grant +${pct(v)} damage, stacking 30×. Stacks fade if you stop killing.`,
    stats: (v, s, run, it) => { s.dmg += ((it.stacks ?? 0) * v) / 100; },
    onKill: (run, it) => { it.stacks = Math.min(30, (it.stacks ?? 0) + 1); it.idle = 0; },
    tick: (run, it, dt) => { it.idle = (it.idle ?? 0) + dt; if (it.idle > 2 && it.stacks > 0) { it.stacks = Math.max(0, it.stacks - dt * 4); } } },
  { id: 'feared', slot: 'rep', name: 'Feared', icon: '😱', v: 0.9,
    desc: (v) => `Enemies within ${(2.5 + v).toFixed(1)}m are slowed 30% and take +12% damage`,
    stats: (v, s) => { s.fearRadius = Math.max(s.fearRadius, 2.5 + v); } },
  { id: 'snitch', slot: 'rep', name: 'Snitch Network', icon: '🐀', v: 18,
    desc: (v) => `+${pct(v)} XP, chests show up ${pct(v)} more often`, stats: (v, s) => { s.xpGain += v / 100; s.chestRate += v / 100; } },
  { id: 'untouchable', slot: 'rep', name: 'Untouchable', icon: '🫥', v: 8,
    desc: (v) => `${pct(v)} chance to dodge a hit (max 60%)`, stats: (v, s) => { s.dodge += v / 100; },
    maxed: (run) => run.stats.dodge >= 0.6 },
  { id: 'loan_shark', slot: 'rep', name: 'Loan Shark', icon: '🦈', v: 12,
    desc: (v) => `${pct(v)} chance on kill to heal 3 HP and gain 1 gold`,
    onKill: (run, it) => { if (Math.random() < it.power / 100) { run.heal(3); run.addGold(1, true); } } },
  { id: 'made_man', slot: 'rep', name: 'Made Man', icon: '🤌', v: 0.06,
    desc: (v) => `Every kill shaves ${v.toFixed(2)}s off all ability cooldowns`,
    onKill: (run, it) => { for (const a of run.abilities) a.cd -= it.power; } },
  { id: 'omerta', slot: 'rep', name: 'Omertà', icon: '🤐', v: 25,
    desc: (v) => `Every 12s gain a ${Math.round(v)} HP shield`,
    tick: (run, it, dt) => { it.t = (it.t ?? 0) + dt; if (it.t >= 12) { it.t = 0; run.player.shield = Math.max(run.player.shield, it.power); } } },
];

export const itemById = (id) => ITEMS.find((i) => i.id === id);
