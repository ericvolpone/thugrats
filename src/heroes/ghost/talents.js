import { chill, addStatus, statusN, clearStatus, tint } from '../common.js';

/**
 * Lucy's talent trees (format: heroes/lenny/talents.js). Rows 0–4 are the
 * classic stat / tweak talents with a capstone at row 4; rows 5–6 are
 * pairings (`pair` = the partner ability that must be owned this run, wired
 * with ctx.link / ctx.amp, see game/stats.js) and row 7 is a second capstone:
 *   Assassin — Shuriken → Knives, Caltrops → Knives, Executes → Cloak; Death by a Thousand Cuts
 *   Shadow   — Tripwire → Smoke, Decoy → Caltrops, Cloak → Garrote; Vanish
 *   Gadgets  — Poison Dart → Sleeping Gas, Knives → Poison Dart, Executes → Tripwire; Puppet Master
 *
 * This file also holds the core of Lucy's signature mechanic, MARKS, because
 * talents, gear and abilities all need it and this file has no browser
 * imports (abilities.js imports it from here).
 */

// ── Marks ───────────────────────────────────────────────────────────────────
// Stacks on a thug (m.st.mark, see addStatus). Poison, traps and Shuriken Ring
// put them on; executes (Garrote, Shadow Step, Curtain Call) cash them in for a
// higher execute line and bonus damage, and Lucy gains Shadow for each one.
// Flags (all off by default): markMax +n max stacks, markDur +s duration,
// markExec +f execute line per Mark, markHeal HP per Mark cashed,
// cashCd seconds of cooldown refunded per Mark cashed, trapMarks +n per trap mark,
// poisonMark chance of +1 Mark on poison marks.

export const MARK_COLOR = '#b05cff';
export const MARK_EXEC = 0.04; // execute line per Mark
export const MARK_DMG = 0.2; // bonus damage per Mark when it doesn't execute
export const MARK_SHADOW = 6; // Shadow per Mark cashed

export const markMax = (run) => 5 + (run.flags.markMax ?? 0);
export const markDur = (run) => 6 + (run.flags.markDur ?? 0);
export const marksOn = (run, m) => statusN(run, m, 'mark');
export const markExec = (run) => MARK_EXEC + (run.flags.markExec ?? 0);

/** Put `n` Marks on thug m (one more while Cloaked). o.poison / o.trap: source kind for talents. Returns the new count. */
export function markMob(run, m, n = 1, o = {}) {
  if (!m || m.dead || m.hp <= 0) return 0;
  if (run.buffs.cloak) n += 1;
  if (o.trap) n += run.flags.trapMarks ?? 0;
  if (o.poison && run.flags.poisonMark && Math.random() < run.flags.poisonMark) n += 1;
  const max = markMax(run), dur = markDur(run);
  const before = statusN(run, m, 'mark');
  const v = addStatus(run, m, 'mark', n, dur, max);
  tint(run, m, MARK_COLOR, dur);
  if (v >= max && before < max) run.fx.burst(m.x, (m.height ?? 1.8) + 0.3, m.z, MARK_COLOR, 6, 2, 0.4);
  return v;
}

/**
 * Cash in every Mark on thug m (ability `a` did it): clears them, gives Shadow,
 * pays the flag rewards. Returns how many there were.
 */
export function cashMarks(run, m, a) {
  const n = clearStatus(run, m, 'mark');
  if (m.tintColor?.getHexString?.() === MARK_COLOR.slice(1)) m.tintUntil = 0;
  if (n <= 0) return 0;
  run.gainRes(n * MARK_SHADOW);
  if (run.flags.markHeal) run.heal(run.flags.markHeal * n);
  if (run.flags.cashCd && a) {
    // fire() runs before the cooldown is set, so take the refund off a frame later
    const cut = run.flags.cashCd * n;
    run.later(0, () => { a.cd = Math.max(0, a.cd - cut); });
  }
  run.fx.burst(m.x, (m.height ?? 1.8) * 0.7, m.z, MARK_COLOR, 4 + n * 3, 3.5, 0.45);
  return n;
}

export const GHOST_TREES = [
  { id: 'assassin', name: 'Assassin', icon: '🗡️', color: '#ff5a7a', blurb: 'Crits, executes and quiet kills.' },
  { id: 'shadow', name: 'Shadow', icon: '🌫️', color: '#a0a8ff', blurb: 'Smoke, dodges and slipping away.' },
  { id: 'gadgets', name: 'Gadgets', icon: '⌚', color: '#7ae0c8', blurb: 'Poisons, traps and toys from Q-tip.' },
];

export const GHOST_TALENTS = [
  // ── Assassin ──
  { id: 'g_aim', tree: 'assassin', row: 0, col: 0, max: 5, name: 'Steady Aim', icon: '🎯',
    desc: (r) => `+${3 * r}% crit chance.`, apply: (c, r) => c.stat('crit', 0.03 * r) },
  { id: 'g_vital', tree: 'assassin', row: 0, col: 2, max: 3, name: 'Vital Spots', icon: '💘',
    desc: (r) => `+${15 * r}% crit damage.`, apply: (c, r) => c.stat('critDmg', 0.15 * r) },
  { id: 'g_quiet', tree: 'assassin', row: 1, col: 0, max: 3, name: 'Light Step', icon: '🌘',
    desc: (r) => `Shadow Step +${8 * r}% Recharge Rate.`, apply: (c, r) => c.abil('shadow_step', 'cooldown', 'pct', 8 * r) },
  { id: 'g_garrote', tree: 'assassin', row: 1, col: 2, max: 3, name: 'Piano Wire', icon: '🧶',
    desc: (r) => `Each Mark cashed in raises the execute line by another +${r}%. Melee hits heal you for ${3 * r}% of their damage.`,
    apply: (c, r) => { c.flagAdd('markExec', 0.01 * r); c.stat('meleeLeech', 0.03 * r); } },
  { id: 'g_bounce', tree: 'assassin', row: 2, col: 0, max: 1, name: 'Twin Shadows', icon: '👥',
    desc: () => 'Shadow Step strikes one more thug.', apply: (c) => c.abil('shadow_step', 'count', 'add', 1) },
  { id: 'g_big', tree: 'assassin', row: 2, col: 2, max: 3, name: 'Contract Killer', icon: '📜',
    desc: (r) => `+${8 * r}% damage to elites, bosses and titans.`, apply: (c, r) => c.stat('bigDmg', 0.08 * r) },
  { id: 'g_knives', tree: 'assassin', row: 3, col: 1, max: 2, name: 'Knife Collection', icon: '🔪',
    desc: (r) => `Throwing Knives throw +${2 * r} knives.`, apply: (c, r) => c.abil('knives', 'count', 'add', 2 * r) },
  { id: 'g_ambush', tree: 'assassin', row: 4, col: 1, max: 1, name: 'Ambush', icon: '🌑', capstone: true,
    desc: () => 'Smoke Bomb also gives +25% crit chance while it lasts, and Marks every thug in the smoke once a second.', apply: (c) => c.flag('ambush', true) },
  { id: 'g_juggler', tree: 'assassin', row: 5, col: 0, max: 3, name: 'Star Juggler', icon: '🤹', pair: 'knives',
    desc: (r) => `Shuriken Ring hits have a ${5 * r}% chance to throw a Throwing Knife at the thug (Knives' damage and pierce).`,
    apply: (c, r) => c.link('shuriken', 'knives', 'hit', 0.05 * r, (run, p, ev) => {
      const pl = run.player;
      run.shoot({ x: pl.x, z: pl.z, y: 0.8, angle: Math.atan2(ev.x - pl.x, ev.z - pl.z), speed: p.stat('speed'), dmg: p.stat('damage'), range: p.stat('range'), pierce: p.stat('pierce'), size: 0.9, color: '#dfe6ee', ability: p });
    }, { icd: 0.25 }) },
  { id: 'g_hobble', tree: 'assassin', row: 5, col: 2, max: 3, name: 'Hamstring', icon: '🦵', pair: 'caltrops',
    desc: (r) => `Thugs that step on Caltrops stay slowed 30% for 1.5s after, and Throwing Knives deal +${15 * r}% damage to slowed or rooted thugs (needs Caltrops in the run).`,
    apply: (c, r) => {
      c.link('caltrops', 'knives', 'hit', 1, (run, p, ev) => chill(ev.m, 0.3, 1.5), { icd: 0 });
      c.amp((run, m, a) => (a?.def?.id === 'knives' && (m.slowT > 0 || m.rootT > 0) && run.abilityById('caltrops') ? 0.15 * r : 0));
    } },
  { id: 'g_clean_getaway', tree: 'assassin', row: 6, col: 1, max: 3, name: 'Clean Getaway', icon: '🫥', pair: 'cloak',
    desc: (r) => `Kills by executes (Garrote, Shadow Step, Curtain Call) add ${(0.4 * r).toFixed(1)}s to Cloak, or put up a ${(0.5 * r).toFixed(1)}s Cloak if it isn't on.`,
    apply: (c, r) => c.link('#execute', 'cloak', 'kill', 1, (run, p) => {
      const b = run.buffs.cloak;
      if (b) { b.t = Math.min(b.max + 3, b.t + 0.4 * r); }
      else p.def.wrap(run, p, 0.5 * r);
    }, { icd: 0.1 }) },
  { id: 'g_cuts', tree: 'assassin', row: 7, col: 1, max: 1, name: 'Death by a Thousand Cuts', icon: '🩸', capstone: true,
    desc: () => 'Every crit leaves a Mark, thugs can carry 2 more Marks, and each Mark makes its thug take +5% damage. A regular or elite thug at full Marks under 25% HP bleeds out on the spot (its Marks cashed in).',
    apply: (c) => {
      c.flagAdd('markMax', 2);
      c.link('*', null, 'crit', 1, (run, p, ev) => {
        const m = ev.m;
        if (m.dead || m.hp <= 0) return;
        const n = markMob(run, m, 1);
        if (n >= markMax(run) && m.tier < 2 && m.hp / m.maxHp < 0.25) {
          cashMarks(run, m, null);
          run.fx.burst(m.x, 1, m.z, '#c32020', 14, 4);
          run.hit(m, (m.hp + 1) / Math.max(0.1, 1 - (m.armor ?? 0)), ev.src, { noCrit: true, knock: 0 });
        }
      }, { icd: 0 });
      c.amp((run, m) => 0.05 * marksOn(run, m));
    } },

  // ── Shadow ──
  { id: 'g_dodge', tree: 'shadow', row: 0, col: 0, max: 5, name: 'Light Feet', icon: '🩰',
    desc: (r) => `+${2 * r}% dodge.`, apply: (c, r) => c.stat('dodge', 0.02 * r) },
  { id: 'g_speed', tree: 'shadow', row: 0, col: 2, max: 3, name: 'Sprinter', icon: '👟',
    desc: (r) => `+${4 * r}% move speed.`, apply: (c, r) => c.stat('speedPct', 0.04 * r) },
  { id: 'g_smoke', tree: 'shadow', row: 1, col: 0, max: 3, name: 'Thick Smoke', icon: '💨',
    desc: (r) => `Smoke Bomb lasts ${0.7 * r}s longer.`, apply: (c, r) => c.abil('smoke', 'duration', 'add', 0.7 * r) },
  { id: 'g_hp', tree: 'shadow', row: 1, col: 2, max: 3, name: 'Snack Stash', icon: '🍪',
    desc: (r) => `+${10 * r} max HP, +${(0.3 * r).toFixed(1)} HP/s.`, apply: (c, r) => { c.stat('maxHp', 10 * r); c.stat('regen', 0.3 * r); } },
  { id: 'g_cloak', tree: 'shadow', row: 2, col: 0, max: 3, name: 'Invisible Ink', icon: '🫥',
    desc: (r) => `Cloak +${8 * r}% Recharge Rate.`, apply: (c, r) => c.abil('cloak', 'cooldown', 'pct', 8 * r) },
  { id: 'g_decoy', tree: 'shadow', row: 2, col: 2, max: 2, name: 'Better Cardboard', icon: '🎭',
    desc: (r) => `Cardboard Decoy explodes for +${40 * r}% damage.`, apply: (c, r) => c.abil('decoy', 'damage', 'pct', 40 * r) },
  { id: 'g_pickup', tree: 'shadow', row: 3, col: 1, max: 2, name: 'Long Shadows', icon: '🌒',
    desc: (r) => `Marks last ${2 * r}s longer, and every Mark cashed in heals ${r} HP.`, apply: (c, r) => { c.flagAdd('markDur', 2 * r); c.flagAdd('markHeal', r); } },
  { id: 'g_ghost', tree: 'shadow', row: 4, col: 1, max: 1, name: 'Ghost Protocol', icon: '👻', capstone: true,
    desc: () => '+12% dodge and +1 reroll every run.', apply: (c) => { c.stat('dodge', 0.12); c.stat('rerolls', 1); } },
  { id: 'g_smoke_signal', tree: 'shadow', row: 5, col: 0, max: 3, name: 'Smoke Signal', icon: '🪢', pair: 'smoke',
    desc: (r) => `Tripwires that spring have a ${25 * r}% chance to puff a Smoke Bomb cloud there (Smoke's size ×0.7, half its duration; slows thugs).`,
    apply: (c, r) => c.link('tripwire', 'smoke', 'hit', (run) => {
      // one roll per wire, not one per thug it trips
      if (run.counters.g_smoke_signal === run.time) return 0;
      run.counters.g_smoke_signal = run.time;
      return 0.25 * r;
    }, (run, p, ev) => {
      run.zone({ x: ev.x, z: ev.z, r: p.stat('area') * 0.7, life: p.stat('duration') * 0.5, slow: 0.5, kind: 'smoke', ability: p });
      run.fx.burst(ev.x, 0.6, ev.z, '#8a8f99', 14, 4, 0.9, 2, -1);
    }, { icd: 0.6 }) },
  { id: 'g_cardboard_jacks', tree: 'shadow', row: 5, col: 2, max: 3, name: 'Jack-in-the-Box', icon: '📦', pair: 'caltrops',
    desc: (r) => `When Cardboard Decoy pops it scatters ${r} Caltrops patch${r > 1 ? 'es' : ''} around it (Caltrops' damage, 70% of its size).`,
    apply: (c, r) => c.link('decoy', 'caltrops', 'explode', 1, (run, p, ev) => {
      for (let i = 0; i < r; i++) {
        const ang = (i / r) * Math.PI * 2 + Math.random(), d = r > 1 ? 1.6 : 0;
        p.def.place(run, p, ev.x + Math.sin(ang) * d, ev.z + Math.cos(ang) * d, { r: p.stat('area') * 0.7 });
      }
    }, { icd: 0.3 }) },
  { id: 'g_from_shadows', tree: 'shadow', row: 6, col: 1, max: 3, name: 'From the Shadows', icon: '🥷', pair: 'garrote',
    desc: (r) => `When Cloak runs out, Lucy Garrotes the nearest thug for free (executes as usual, otherwise ×${(1 + 0.5 * r).toFixed(1)} damage).`,
    apply: (c, r) => c.flag('cloakBreak', 1 + 0.5 * r) },
  { id: 'g_vanish', tree: 'shadow', row: 7, col: 1, max: 1, name: 'Vanish', icon: '🎩', capstone: true, pair: 'cloak',
    desc: () => 'When a hit drops you under 35% HP, you vanish: Cloak goes up for free, thugs within 6 lose you (frozen 1.5s) and Smoke Bomb pops if you have it. Once every 30s.',
    apply: (c) => c.link('*', 'cloak', 'hurt', (run, ev) => { const h = run.player.hp - ev.dmg; return h > 0 && h < run.stats.maxHp * 0.35 ? 1 : 0; }, (run, p) => {
      const pl = run.player;
      p.def.wrap(run, p);
      for (const m of run.mobs.near(pl.x, pl.z, 6)) if (m.tier < 2) m.rootT = Math.max(m.rootT, 1.5);
      const sm = run.abilityById('smoke');
      if (sm) { sm.def.fire(run, sm); sm.cd = sm.cdMax = sm.stat('cooldown'); }
      run.fx.burst(pl.x, 0.8, pl.z, '#bfc8ff', 24, 5, 0.9, 2, -1);
    }, { icd: 30 }) },

  // ── Gadgets ──
  { id: 'g_poison', tree: 'gadgets', row: 0, col: 0, max: 5, name: 'Nightshade', icon: '☠️',
    desc: (r) => `Poisons and burns deal +${10 * r}% damage.`, apply: (c, r) => c.stat('burnDmg', 0.1 * r) },
  { id: 'g_cd', tree: 'gadgets', row: 0, col: 2, max: 3, name: 'Fresh Batteries', icon: '🔋',
    desc: (r) => `+${3 * r}% Recharge Rate on all abilities.`, apply: (c, r) => c.stat('haste', 0.03 * r) },
  { id: 'g_traps', tree: 'gadgets', row: 1, col: 0, max: 2, name: 'Spool of Wire', icon: '🪢',
    desc: (r) => `+${r} Tripwire.`, apply: (c, r) => c.abil('tripwire', 'count', 'add', r) },
  { id: 'g_area', tree: 'gadgets', row: 1, col: 2, max: 3, name: 'Wide Spread', icon: '⭕',
    desc: (r) => `Control abilities have +${8 * r}% area.`, apply: (c, r) => c.abil('#control', 'area', 'pct', 8 * r) },
  { id: 'g_laser', tree: 'gadgets', row: 2, col: 0, max: 3, name: 'Toxic Tags', icon: '🏷️',
    desc: (r) => `Poison (Poison Dart, Sleeping Gas) has a ${20 * r}% chance to leave one extra Mark.`, apply: (c, r) => c.flagAdd('poisonMark', 0.2 * r) },
  { id: 'g_luck', tree: 'gadgets', row: 2, col: 2, max: 3, name: 'Insider Info', icon: '🗂️',
    desc: (r) => `+${6 * r} luck.`, apply: (c, r) => c.stat('luck', 6 * r) },
  { id: 'g_xp', tree: 'gadgets', row: 3, col: 1, max: 3, name: 'Debriefing', icon: '📝',
    desc: (r) => `+${6 * r}% XP.`, apply: (c, r) => c.stat('xpGain', 0.06 * r) },
  { id: 'g_tips', tree: 'gadgets', row: 4, col: 1, max: 1, name: 'Poison Tips', icon: '🧪', capstone: true,
    desc: () => 'Throwing Knives and Shuriken Ring poison what they hit for 60% of the hit over 3s, and the poison Marks them.', apply: (c) => c.flag('poisonTips', true) },
  { id: 'g_knockout_dart', tree: 'gadgets', row: 5, col: 0, max: 3, name: 'Knockout Dart', icon: '😪', pair: 'sleep_gas',
    desc: (r) => `Poison Dart hits have a ${12 * r}% chance to burst into a small Sleeping Gas cloud (Gas's damage, 60% of its size and duration).`,
    apply: (c, r) => c.link('poison_dart', 'sleep_gas', 'hit', 0.12 * r, (run, p, ev) => {
      run.zone({ x: ev.x, z: ev.z, r: p.stat('area') * 0.6, life: p.stat('duration') * 0.6, dps: p.stat('damage'), slow: 0.8, kind: 'gas', color: '#b28cff', ability: p });
    }, { icd: 0.8 }) },
  { id: 'g_laced', tree: 'gadgets', row: 5, col: 2, max: 3, name: 'Laced Steel', icon: '💉', pair: 'poison_dart',
    desc: (r) => `Throwing Knives hits have a ${10 * r}% chance to poison the thug with 40% of Poison Dart's poison and Mark it.`,
    apply: (c, r) => c.link('knives', 'poison_dart', 'hit', 0.1 * r, (run, p, ev) => {
      if (ev.m.dead || ev.m.hp <= 0) return;
      run.ignite(ev.m, p.stat('power') * run.stats.dmg * 0.4, 4);
      markMob(run, ev.m, 1, { poison: true });
    }, { icd: 0.05 }) },
  { id: 'g_laser_wire', tree: 'gadgets', row: 6, col: 1, max: 3, name: 'Body Trap', icon: '🪤', pair: 'tripwire',
    desc: (r) => `Kills by executes (Garrote, Shadow Step, Curtain Call) have a ${20 * r}% chance to string a Tripwire on the body (doesn't count toward the wire limit).`,
    apply: (c, r) => c.link('#execute', 'tripwire', 'kill', 0.2 * r, (run, p, ev) => {
      if (ev.x != null) p.def.place(run, p, ev.x, ev.z, { extra: true });
    }, { icd: 0.6 }) },
  { id: 'g_puppet', tree: 'gadgets', row: 7, col: 1, max: 1, name: 'Puppet Master', icon: '🎎', capstone: true,
    desc: () => 'Slowed, rooted or sleeping thugs take +20% damage. When one dies, every thug within 5 is yanked to the spot and tied up for 1s (bosses just stumble). Every 1.5s at most.',
    apply: (c) => {
      c.stat('ctrlDmg', 0.2);
      c.link('*', null, 'kill', (run, ev) => (ev.m.rootT > 0 || ev.m.slowT > 0 || ev.m.zoneSlow > 0 ? 1 : 0), (run, p, ev) => {
        for (const m of run.mobs.near(ev.x, ev.z, 5)) {
          const dx = ev.x - m.x, dz = ev.z - m.z, d = Math.hypot(dx, dz) || 1;
          if (m.tier < 2) { m.kx += (dx / d) * 6; m.kz += (dz / d) * 6; m.rootT = Math.max(m.rootT, 1); }
          else chill(m, 0.5, 1);
        }
        run.fx.ring(ev.x, ev.z, 5, '#7ae0c8', 0.35);
      }, { icd: 1.5 });
    } },
];
