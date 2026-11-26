/**
 * In-run items (lost when the run ends). 5 slots: 2 Rings, 1 Crime Title,
 * 2 Reputations. `v` is the power a common roll gives; higher tiers roll bigger
 * and every roll shrinks the more power the item already has (tiers.scaledGain),
 * so an early purple matters far more than a fifth grey.
 * room(run, it) — optional: how much more power still does something (chance
 * items stop at 100%, luck at 150...). Rolls are clipped to it, and an item with
 * no room left is retired from offers for free (run.maxed).
 *
 * Contraband (stash) items change how a KIND of ability plays and are only
 * offered once you own one with the tag in `needs`. abil(v, a, k) -> [pct, flat]
 * adds to ability a's stat k (like an upgrade).
 *
 * Hooks (optional): stats(v, s) · onKill(run, it, mob) · onHit(run, it, mob, hit)
 * · onHurt(run, it, amount) -> amount · tick(run, it, dt)
 */
export const SLOTS = { ring: 2, title: 1, rep: 2, stash: 2 };
/** Luck stops counting past this. */
export const MAX_LUCK = 150;
export const SLOT_NAMES = { ring: 'Ring', title: 'Crime Title', rep: 'Reputation', stash: 'Contraband' };

const has = (a, tag) => a.def.tags.includes(tag);
const pct = (v) => `${v >= 10 ? Math.round(v) : +v.toFixed(1)}%`;

export const ITEMS = [
  // ── Rings: straightforward stats ──
  { id: 'brass_ring', slot: 'ring', name: 'Brass Knuckle Ring', icon: '👊', v: 20,
    desc: (v) => `+${pct(v)} damage`, stats: (v, s) => { s.dmg += v / 100; } },
  { id: 'pinky_ring', slot: 'ring', name: 'Pinky Ring', icon: '💍', v: 8,
    desc: (v) => `+${pct(v)} crit chance`, stats: (v, s) => { s.crit += v / 100; },
    room: (run) => (1 - run.stats.crit) * 100 },
  { id: 'dice_ring', slot: 'ring', name: 'Loaded Dice Ring', icon: '🎲', v: 20,
    desc: (v) => `+${Math.round(v)} luck`, stats: (v, s) => { s.luck += v; },
    room: (run) => MAX_LUCK - run.stats.luck },
  { id: 'gold_ring', slot: 'ring', name: 'Gold Tooth Ring', icon: '🦷', v: 30,
    desc: (v) => `+${pct(v)} gold, +${pct(v / 2)} pickup range`, stats: (v, s) => { s.goldGain += v / 100; s.pickup *= 1 + v / 200; } },
  { id: 'mood_ring', slot: 'ring', name: 'Mood Ring', icon: '🔮', v: 18,
    desc: (v) => `+${pct(v)} area`, stats: (v, s) => { s.area += v / 100; } },
  { id: 'teething_ring', slot: 'ring', name: 'Teething Ring', icon: '⭕', v: 30,
    desc: (v) => `+${Math.round(v)} max HP, +${(v / 40).toFixed(1)} HP/s`, stats: (v, s) => { s.maxHp += v; s.regen += v / 40; } },
  { id: 'diamond_ring', slot: 'ring', name: 'Ice Ring', icon: '💎', v: 12,
    desc: (v) => `+${pct(v)} Recharge Rate`, stats: (v, s) => { s.haste += v / 100; } },

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
    room: (run, it) => 100 - (it?.power ?? 0) },

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
    room: (run) => (0.6 - run.stats.dodge) * 100 },
  { id: 'loan_shark', slot: 'rep', name: 'Loan Shark', icon: '🦈', v: 12,
    desc: (v) => `${pct(v)} chance on kill to heal 3 HP and gain 1 gold`,
    onKill: (run, it) => { if (Math.random() < it.power / 100) { run.heal(3); run.addGold(1, true); } },
    room: (run, it) => 100 - (it?.power ?? 0) },
  { id: 'made_man', slot: 'rep', name: 'Made Man', icon: '🤌', v: 0.06,
    desc: (v) => `Every kill shaves ${v.toFixed(2)}s off all ability cooldowns`,
    onKill: (run, it) => { for (const a of run.abilities) a.cd = Math.max(0, a.cd - it.power); } },
  { id: 'omerta', slot: 'rep', name: 'Omertà', icon: '🤐', v: 25,
    desc: (v) => `Every 12s gain a ${Math.round(v)} HP shield`,
    tick: (run, it, dt) => { it.t = (it.t ?? 0) + dt; if (it.t >= 12) { it.t = 0; run.player.shield = Math.max(run.player.shield, it.power); } } },
  { id: 'blood_money', slot: 'rep', name: 'Blood Money', icon: '🩸', v: 2.5,
    desc: (v) => `Heal for ${pct(v)} of all damage you deal (max 6% of max HP per second)`, stats: (v, s) => { s.lifesteal += v / 100; },
    room: (run, it) => 20 - (it?.power ?? 0) },

  // ── Contraband: changes how one kind of ability plays (offered once you own one) ──
  { id: 'drum_mag', slot: 'stash', name: 'Drum Magazine', icon: '🥁', v: 15, needs: 'gun',
    desc: (v) => `Gun abilities: +${pct(v)} Recharge Rate and +${1 + Math.floor(v / 30)} pierce`,
    abil: (v, a, k) => has(a, 'gun') && (k === 'cooldown' ? [v / 100, 0] : k === 'pierce' ? [0, 1 + Math.floor(v / 30)] : null) },
  { id: 'hollow_tips', slot: 'stash', name: 'Hollow Tips', icon: '🔩', v: 15, needs: 'projectile',
    desc: (v) => `Projectile hits have a ${pct(v)} chance to burst, hitting everything nearby for 60% of the damage`,
    stats: (v, s) => { s.projBurst += v / 100; }, room: (run, it) => 100 - (it?.power ?? 0) },
  { id: 'det_cord', slot: 'stash', name: 'Det Cord', icon: '🧶', v: 12, needs: 'explosive',
    desc: (v) => `Explosions are ${pct(v)} bigger and leave burning ground for 2s (${pct(v * 1.5)} of the blast per second)`,
    stats: (v, s) => { s.blastArea += v / 100; s.blastBurn += (v * 1.5) / 100; } },
  { id: 'grappa', slot: 'stash', name: "Grandpa's Grappa", icon: '🍶', v: 20, needs: 'fire',
    desc: (v) => `+${pct(v)} burn damage. Burning thugs take +${pct(v / 2)} damage from everything.`,
    stats: (v, s) => { s.burnDmg += v / 100; s.burnVuln += v / 200; } },
  { id: 'lead_pipe', slot: 'stash', name: 'Lead Pipe', icon: '🔧', v: 18, needs: 'melee',
    desc: (v) => `Melee abilities: +${pct(v)} damage, +${pct(v / 2)} area, and they heal you for ${pct(v / 8)} of it`,
    abil: (v, a, k) => has(a, 'melee') && (k === 'damage' ? [v / 100, 0] : k === 'area' ? [v / 200, 0] : null),
    stats: (v, s) => { s.meleeLeech += v / 800; } },
  { id: 'rolodex', slot: 'stash', name: 'Rolodex', icon: '📇', v: 20, needs: 'summon',
    desc: (v) => `Summons: +${pct(v)} damage and duration, and +1 extra summon`,
    abil: (v, a, k) => has(a, 'summon') && (k === 'damage' || k === 'duration' ? [v / 100, 0] : k === 'count' ? [0, 1] : null) },
  { id: 'spinning_top', slot: 'stash', name: 'Spinning Top', icon: '🪀', v: 15, needs: 'aura',
    desc: (v) => `Auras: +${pct(v)} damage and radius, and +${1 + Math.floor(v / 25)} orbiting object${v >= 25 ? 's' : ''}`,
    abil: (v, a, k) => has(a, 'aura') && (k === 'damage' || k === 'area' ? [v / 100, 0] : k === 'count' ? [0, 1 + Math.floor(v / 25)] : null) },
  { id: 'bear_trap', slot: 'stash', name: 'Bear Trap Spool', icon: '🪤', v: 20, needs: 'trap',
    desc: (v) => `Traps: +${pct(v)} damage and area, +${1 + Math.floor(v / 30)} max traps. Triggered traps root for 1s.`,
    abil: (v, a, k) => has(a, 'trap') && (k === 'damage' || k === 'area' ? [v / 100, 0] : k === 'count' ? [0, 1 + Math.floor(v / 30)] : null),
    stats: (v, s) => { s.trapRoot = 1; } },
  { id: 'sugar_cube', slot: 'stash', name: 'Sugar Cube', icon: '🧊', v: 15, needs: 'buff',
    desc: (v) => `Self-buffs last ${pct(v)} longer. While one is up: +${pct(v)} move speed and damage.`,
    abil: (v, a, k) => has(a, 'buff') && k === 'duration' && [v / 100, 0],
    stats: (v, s, run) => { for (const id in run.buffs) if (run.buffs[id].src) { s.speedPct += v / 100; s.dmg += v / 100; break; } } },
  { id: 'chalk', slot: 'stash', name: 'Chalk Outline', icon: '✏️', v: 15, needs: 'control',
    desc: (v) => `Rooted, slowed and stunned thugs take +${pct(v)} damage. Control abilities last ${pct(v / 2)} longer.`,
    stats: (v, s) => { s.ctrlDmg += v / 100; },
    abil: (v, a, k) => has(a, 'control') && k === 'duration' && [v / 200, 0] },
  { id: 'nitro', slot: 'stash', name: 'Nitro Can', icon: '🛢️', v: 20, needs: 'vehicle',
    desc: (v) => `Vehicles: +${pct(v)} damage and they explode at the end of their run (${pct(60 + v)} of their damage)`,
    abil: (v, a, k) => has(a, 'vehicle') && k === 'damage' && [v / 100, 0],
    stats: (v, s) => { s.nitro = Math.max(s.nitro, 0.6 + v / 100); } },
  { id: 'tesla_battery', slot: 'stash', name: 'Car Battery', icon: '🔋', v: 15, needs: 'science',
    desc: (v) => `Science gadgets: +${pct(v)} damage and Recharge Rate. Chains and robots jump +1 extra target.`,
    abil: (v, a, k) => has(a, 'science') && (k === 'damage' || k === 'cooldown' ? [v / 100, 0] : null),
    stats: (v, s) => { s.extraJumps = 1; } },
  { id: 'toe_tag', slot: 'stash', name: 'Toe Tag', icon: '🏷️', v: 4, needs: (a) => a.def.base.execute != null,
    desc: (v) => `Executes reach +${pct(v)} more HP, and every execute heals 4 HP`,
    abil: (v, a, k) => k === 'execute' && (a.def.base.execute != null) && [0, v / 100],
    stats: (v, s) => { s.execHeal = 4; }, room: (run, it) => 30 - (it?.power ?? 0) },
];

export const itemById = (id) => ITEMS.find((i) => i.id === id);
