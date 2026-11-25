/**
 * In-run items (lost when the run ends). 5 slots: 2 Rings, 1 Crime Title,
 * 2 Reputations. Every time you take an item card its power grows by
 * values[tier] — higher tiers (rolled with luck) grow it more.
 *
 * Hooks (optional): stats(v, s) · onKill(run, it, mob) · onHit(run, it, mob, hit)
 * · onHurt(run, it, amount) -> amount · tick(run, it, dt)
 */
export const SLOTS = { ring: 2, title: 1, rep: 2 };
export const SLOT_NAMES = { ring: 'Ring', title: 'Crime Title', rep: 'Reputation' };

const pct = (v) => `${+v.toFixed(1)}%`;

export const ITEMS = [
  // ── Rings: straightforward stats ──
  { id: 'brass_ring', slot: 'ring', name: 'Brass Knuckle Ring', icon: '👊', values: [6, 9, 12, 16, 22],
    desc: (v) => `+${pct(v)} damage`, stats: (v, s) => { s.dmg += v / 100; } },
  { id: 'pinky_ring', slot: 'ring', name: 'Pinky Ring', icon: '💍', values: [3, 4, 6, 8, 11],
    desc: (v) => `+${pct(v)} crit chance`, stats: (v, s) => { s.crit += v / 100; } },
  { id: 'dice_ring', slot: 'ring', name: 'Loaded Dice Ring', icon: '🎲', values: [6, 9, 13, 18, 25],
    desc: (v) => `+${Math.round(v)} luck`, stats: (v, s) => { s.luck += v; } },
  { id: 'gold_ring', slot: 'ring', name: 'Gold Tooth Ring', icon: '🦷', values: [12, 18, 25, 35, 50],
    desc: (v) => `+${pct(v)} gold, +${pct(v / 2)} pickup range`, stats: (v, s) => { s.goldGain += v / 100; s.pickup *= 1 + v / 200; } },
  { id: 'mood_ring', slot: 'ring', name: 'Mood Ring', icon: '🔮', values: [6, 9, 12, 16, 22],
    desc: (v) => `+${pct(v)} area`, stats: (v, s) => { s.area += v / 100; } },
  { id: 'teething_ring', slot: 'ring', name: 'Teething Ring', icon: '⭕', values: [12, 18, 25, 35, 50],
    desc: (v) => `+${Math.round(v)} max HP, +${(v / 40).toFixed(1)} HP/s`, stats: (v, s) => { s.maxHp += v; s.regen += v / 40; } },
  { id: 'diamond_ring', slot: 'ring', name: 'Ice Ring', icon: '💎', values: [5, 7, 10, 13, 18],
    desc: (v) => `+${pct(v)} cooldown speed`, stats: (v, s) => { s.haste += v / 100; } },

  // ── Crime Titles: one build-defining effect ──
  { id: 'kingpin', slot: 'title', name: 'Kingpin', icon: '👑', values: [12, 18, 25, 35, 50],
    desc: (v) => `+${pct(v)} damage to elites, bosses and titans`, stats: (v, s) => { s.bigDmg += v / 100; } },
  { id: 'hitman', slot: 'title', name: 'Hitman', icon: '🎯', values: [15, 22, 30, 42, 60],
    desc: (v) => `+${pct(v)} crit damage, +${pct(v / 5)} crit chance`, stats: (v, s) => { s.critDmg += v / 100; s.crit += v / 500; } },
  { id: 'bagman', slot: 'title', name: 'Bagman', icon: '💰', values: [1, 1.5, 2, 2.7, 3.5],
    desc: (v) => `+${pct(v)} damage per 25 gold you carry (max 60%), +${pct(v * 10)} gold`,
    stats: (v, s, run) => { s.goldGain += v / 10; s.dmg += Math.min(0.6, (run.gold / 25) * (v / 100)); } },
  { id: 'getaway', slot: 'title', name: 'Getaway Driver', icon: '🏎️', values: [6, 9, 12, 16, 22],
    desc: (v) => `+${pct(v)} move speed, +${pct(v * 1.5)} damage while moving`,
    stats: (v, s, run) => { s.speed *= 1 + v / 100; if (run.player.moving) s.dmg += (v * 1.5) / 100; } },
  { id: 'arsonist', slot: 'title', name: 'Arsonist', icon: '🔥', values: [8, 12, 16, 22, 30],
    desc: (v) => `${pct(v)} chance on hit to ignite: 60% of the hit as burn over 3s`,
    onHit: (run, it, mob, hit) => { if (!hit.isBurn && Math.random() < it.power / 100) run.ignite(mob, hit.amount * 0.6, 3); } },

  // ── Reputations: procs & quirks (always offered) ──
  { id: 'street_cred', slot: 'rep', name: 'Street Cred', icon: '😎', values: [0.3, 0.45, 0.6, 0.8, 1.1],
    desc: (v) => `Kills grant +${pct(v)} damage, stacking 30×. Stacks fade if you stop killing.`,
    stats: (v, s, run, it) => { s.dmg += ((it.stacks ?? 0) * v) / 100; },
    onKill: (run, it) => { it.stacks = Math.min(30, (it.stacks ?? 0) + 1); it.idle = 0; },
    tick: (run, it, dt) => { it.idle = (it.idle ?? 0) + dt; if (it.idle > 2 && it.stacks > 0) { it.stacks = Math.max(0, it.stacks - dt * 4); } } },
  { id: 'feared', slot: 'rep', name: 'Feared', icon: '😱', values: [3, 3.5, 4, 4.6, 5.5],
    desc: (v) => `Enemies within ${v.toFixed(1)}m are slowed 30% and take +12% damage`,
    stats: (v, s) => { s.fearRadius = Math.max(s.fearRadius, v); } },
  { id: 'snitch', slot: 'rep', name: 'Snitch Network', icon: '🐀', values: [8, 12, 16, 22, 30],
    desc: (v) => `+${pct(v)} XP, chests show up ${pct(v)} more often`, stats: (v, s) => { s.xpGain += v / 100; s.chestRate += v / 100; } },
  { id: 'untouchable', slot: 'rep', name: 'Untouchable', icon: '🫥', values: [3, 4.5, 6, 8, 11],
    desc: (v) => `${pct(v)} chance to dodge a hit`, stats: (v, s) => { s.dodge += v / 100; } },
  { id: 'loan_shark', slot: 'rep', name: 'Loan Shark', icon: '🦈', values: [5, 7, 10, 13, 18],
    desc: (v) => `${pct(v)} chance on kill to heal 3 HP and gain 1 gold`,
    onKill: (run, it) => { if (Math.random() < it.power / 100) { run.heal(3); run.addGold(1, true); } } },
  { id: 'made_man', slot: 'rep', name: 'Made Man', icon: '🤌', values: [0.03, 0.045, 0.06, 0.08, 0.11],
    desc: (v) => `Every kill shaves ${v.toFixed(2)}s off all ability cooldowns`,
    onKill: (run, it) => { for (const a of run.abilities) a.cd -= it.power; } },
  { id: 'omerta', slot: 'rep', name: 'Omertà', icon: '🤐', values: [10, 15, 22, 30, 42],
    desc: (v) => `Every 12s gain a ${Math.round(v)} HP shield`,
    tick: (run, it, dt) => { it.t = (it.t ?? 0) + dt; if (it.t >= 12) { it.t = 0; run.player.shield = Math.max(run.player.shield, it.power); } } },
];

export const itemById = (id) => ITEMS.find((i) => i.id === id);
