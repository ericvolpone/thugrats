import { freeCast, boltFrom, ringShot } from '../common.js';

/**
 * Babyface's talent tree (format: heroes/lenny/talents.js). 3 branches × 8 rows.
 * Row r needs 3·r points already spent in that branch.
 * Rows 5-7 are pairing talents: `pair` names the partner ability that must be
 * in your run for them to do anything (see ctx.link). Row 7 is the capstone.
 *
 * apply(ctx, rank) runs at the start of every run:
 *   ctx.stat(key, v)               add to a run stat (see game/stats.js)
 *   ctx.abil(match, stat, kind, v) modify abilities; match = ability id or '#tag'
 *                                  kind 'pct' (+v%) or 'add' (+v flat)
 *   ctx.flag(name, v)              set a behaviour flag read by abilities
 *   ctx.link(from, to, on, chance, proc, {icd})  pairing proc (see game/stats.js)
 *   ctx.amp(fn)                    conditional damage multiplier
 */

/** Is this thug on the Hit List right now? (abilities.js sets m.listedUntil when run.flags.listMark is on) */
const listed = (run, m) => m.listedUntil > run.time;
/** Add Focus (Babyface's meter, run.res; no-op if it isn't wired). */
const focus = (run, n) => { if (run.res?.id === 'focus') run.gainRes(n); };

// Talent ids are kept per slot from the old tree so spent points carry over,
// even where the talent in that slot is new (h_double, h_mines, h_boom, h_tripwire,
// h_stand_in, h_rain, h_scatter).

export const BABYFACE_TREES = [
  { id: 'marksman', name: 'Marksman', icon: '🔭', color: '#ffd36b', blurb: 'One shot, one nap.' },
  { id: 'cleaner', name: 'Cleaner', icon: '🧹', color: '#ff6b5a', blurb: 'Close work, clean getaways. Never flinch.' },
  { id: 'professional', name: 'Professional', icon: '💼', color: '#8fd0ff', blurb: 'Planning, contacts, getting paid.' },
];

export const BABYFACE_TALENTS = [
  // ── Marksman ──
  { id: 'h_scope', tree: 'marksman', row: 0, col: 0, max: 5, name: 'Good Scope', icon: '🔭',
    desc: (r) => `Sniper Rifle +${5 * r}% damage.`, apply: (c, r) => c.abil('rifle', 'damage', 'pct', 5 * r) },
  { id: 'h_bolt', tree: 'marksman', row: 0, col: 2, max: 3, name: 'Smooth Bolt', icon: '⚙️',
    desc: (r) => `Sniper Rifle fires ${6 * r}% faster.`, apply: (c, r) => c.abil('rifle', 'cooldown', 'pct', 6 * r) },
  { id: 'h_head', tree: 'marksman', row: 1, col: 0, max: 3, name: 'Headshots', icon: '🎯',
    desc: (r) => `+${4 * r}% crit chance.`, apply: (c, r) => c.stat('crit', 0.04 * r) },
  { id: 'h_critdmg', tree: 'marksman', row: 1, col: 2, max: 3, name: 'Hollow Tips', icon: '🩸',
    desc: (r) => `+${15 * r}% crit damage. Crits heal you for ${r}% of their damage.`, apply: (c, r) => { c.stat('critDmg', 0.15 * r); c.stat('critLeech', 0.01 * r); } },
  { id: 'h_pierce', tree: 'marksman', row: 2, col: 0, max: 2, name: 'Armor-Piercing', icon: '➡️',
    desc: (r) => `Sniper Rifle pierces +${2 * r}.`, apply: (c, r) => c.abil('rifle', 'pierce', 'add', 2 * r) },
  { id: 'h_big', tree: 'marksman', row: 2, col: 2, max: 3, name: 'Big Game', icon: '🐘',
    desc: (r) => `+${8 * r}% damage to elites, bosses and titans.`, apply: (c, r) => c.stat('bigDmg', 0.08 * r) },
  { id: 'h_list', tree: 'marksman', row: 3, col: 1, max: 2, name: 'Long List', icon: '📋',
    desc: (r) => `Hit List marks +${r} more name${r > 1 ? 's' : ''}.`, apply: (c, r) => c.abil('hit_list', 'count', 'add', r) },
  { id: 'h_double', tree: 'marksman', row: 4, col: 1, max: 1, name: 'Patience', icon: '⏳', capstone: true,
    desc: () => 'The Sniper Rifle fires 35% slower but deals +60% damage, and at 40+ Focus every 2nd Rifle shot is Focused (instead of every 3rd).',
    apply: (c) => { c.abil('rifle', 'cooldown', 'pct', -35); c.abil('rifle', 'damage', 'pct', 60); c.flagAdd('focusEveryLess', 1); } },
  { id: 'h_silver_lining', tree: 'marksman', row: 5, col: 0, max: 3, name: 'Silver Lining', icon: '🥈', pair: 'silver_bullet',
    desc: (r) => `Sniper Rifle crits take ${(0.6 * r).toFixed(1)}s off Silver Bullet's cooldown, and Silver Bullet kills restore ${4 * r} Focus.`,
    apply: (c, r) => {
      c.link('rifle', 'silver_bullet', 'crit', 1, (run, p) => { p.cd = Math.max(0, p.cd - 0.6 * r); }, { icd: 0.2 });
      c.link('silver_bullet', null, 'kill', 1, (run) => focus(run, 4 * r), { icd: 0.1 });
    } },
  { id: 'h_lock_on', tree: 'marksman', row: 5, col: 2, max: 3, name: 'Lock On', icon: '🎯', pair: 'hit_list',
    desc: (r) => `The Sniper Rifle aims at Hit List names first (from 25% farther away) and deals +${12 * r}% damage to them for 8s after they're marked.`,
    apply: (c, r) => {
      c.flag('listMark', true);
      c.flag('listLock', true);
      c.amp((run, m, a) => (a?.def?.id === 'rifle' && listed(run, m) ? 0.12 * r : 0));
    } },
  { id: 'h_held_breath', tree: 'marksman', row: 6, col: 1, max: 3, name: 'Held Breath', icon: '🫁', pair: 'focus',
    desc: (r) => `While Deep Breath is up, Sniper Rifle shots pierce every thug in their path and deal +${10 * r}% damage.`,
    apply: (c, r) => {
      c.flag('breathPierce', true);
      c.amp((run, m, a) => (a?.def?.id === 'rifle' && run.buffs.focus ? 0.1 * r : 0));
    } },
  { id: 'h_one_shot', tree: 'marksman', row: 7, col: 1, max: 1, name: 'One Shot, One Kill', icon: '💀', capstone: true,
    desc: () => 'Sniper Rifle shots execute thugs left under 20% HP (bosses under 10%, never titans) and each execute restores 3 Focus. Every Rifle kill cuts its remaining cooldown by 40%.',
    apply: (c) => {
      c.flag('oneShot', 0.2);
      c.flag('execFocus', 3);
      c.link('rifle', null, 'kill', 1, (run, p, ev) => { ev.src.cd *= 0.6; }, { icd: 0.15 });
    } },

  // ── Cleaner ──
  { id: 'h_shells', tree: 'cleaner', row: 0, col: 0, max: 5, name: 'Buckshot', icon: '💥',
    desc: (r) => `Sawed-Off and Uzi deal +${5 * r}% damage.`, apply: (c, r) => { c.abil('sawed_off', 'damage', 'pct', 5 * r); c.abil('uzi', 'damage', 'pct', 5 * r); } },
  { id: 'h_armor', tree: 'cleaner', row: 0, col: 2, max: 3, name: 'Kevlar Onesie', icon: '🦺',
    desc: (r) => `Take ${4 * r}% less damage.`, apply: (c, r) => c.stat('armor', 0.04 * r) },
  { id: 'h_hp', tree: 'cleaner', row: 1, col: 0, max: 3, name: 'Tough Guy', icon: '❤️',
    desc: (r) => `+${12 * r} max HP.`, apply: (c, r) => c.stat('maxHp', 12 * r) },
  { id: 'h_mines', tree: 'cleaner', row: 1, col: 2, max: 2, name: 'Steady Nerves', icon: '🧊',
    desc: (r) => `Getting hurt knocks off ${25 * r}% less Focus.`, apply: (c, r) => c.flagAdd('steadyNerves', 0.25 * r) },
  { id: 'h_boom', tree: 'cleaner', row: 2, col: 0, max: 3, name: 'Breathing Room', icon: '😮‍💨',
    desc: (r) => `Each Sawed-Off blast restores ${r} Focus.`, apply: (c, r) => c.flagAdd('sawFocus', r) },
  { id: 'h_regen', tree: 'cleaner', row: 2, col: 2, max: 3, name: 'Band-Aids', icon: '🩹',
    desc: (r) => `+${(0.4 * r).toFixed(1)} HP regen per second.`, apply: (c, r) => c.stat('regen', 0.4 * r) },
  { id: 'h_flash', tree: 'cleaner', row: 3, col: 1, max: 2, name: 'Extra Bright', icon: '⚪',
    desc: (r) => `Flashbang stuns ${0.4 * r}s longer.`, apply: (c, r) => c.abil('flashbang', 'duration', 'add', 0.4 * r) },
  { id: 'h_doubles', tree: 'cleaner', row: 4, col: 1, max: 1, name: 'The Twins', icon: '🕴️', capstone: true,
    desc: () => 'Body Double hires one more lookalike.', apply: (c) => c.abil('body_double', 'count', 'add', 1) },
  { id: 'h_last_round', tree: 'cleaner', row: 5, col: 0, max: 3, name: 'Last Round', icon: '🔚', pair: 'sawed_off',
    desc: (r) => `${Math.round(100 * r / 3)}% chance an Uzi burst ends with a free Sawed-Off blast at the nearest thug.`,
    apply: (c, r) => c.link('uzi', 'sawed_off', 'fire', r / 3, (run, p, ev) => run.later(ev.src.stat('count') * 0.04 + 0.05, () => freeCast(run, p)), { icd: 0.8 }) },
  { id: 'h_tripwire', tree: 'cleaner', row: 5, col: 2, max: 3, name: 'Dead to Rights', icon: '🔍', pair: 'spotter',
    desc: (r) => `Each thug stunned by Flashbang has a ${25 * r}% chance to be Spotted (Spotter's duration), and each one spotted this way restores 1 Focus.`,
    apply: (c, r) => c.link('flashbang', 'spotter', 'hit', 0.25 * r, (run, p, ev) => {
      if (ev.m.dead) return;
      p.def.spot(run, p, ev.m);
      focus(run, 1);
    }, { icd: 0 }) },
  { id: 'h_stand_in', tree: 'cleaner', row: 6, col: 1, max: 3, name: 'Stand-In', icon: '🕴️', pair: 'body_double',
    desc: (r) => `Once every ${12 - 2 * r}s, getting hurt calls in a Body Double for 4s and that hit costs you no Focus.`,
    apply: (c, r) => c.link('*', 'body_double', 'hurt', 1, (run, p) => {
      if (run.res) run.res.guardUntil = run.time + 0.2; // BABYFACE_RESOURCE.tick skips the flinch
      p.def.callIn(run, p, 4);
    }, { icd: 12 - 2 * r }) },
  { id: 'h_clean_sweep', tree: 'cleaner', row: 7, col: 1, max: 1, name: 'Clean Sweep', icon: '🧹', capstone: true,
    desc: () => 'Thugs killed by the Sawed-Off or Uzi burst into a ring of 6 ball bearings (60% of the killing gun\'s damage each). Sweeps can set off more sweeps.',
    apply: (c) => {
      const sweep = (run, p, ev) => ringShot(run, ev.src, ev.x, ev.z, 6, ev.src.stat('damage') * 0.6, '#cfcfcf');
      c.link('sawed_off', null, 'kill', 1, sweep, { icd: 0.1 });
      c.link('uzi', null, 'kill', 1, sweep, { icd: 0.15 });
    } },

  // ── Professional ──
  { id: 'h_fee', tree: 'professional', row: 0, col: 0, max: 5, name: 'Upfront Fee', icon: '💵',
    desc: (r) => `+${8 * r}% gold.`, apply: (c, r) => c.stat('goldGain', 0.08 * r) },
  { id: 'h_cd', tree: 'professional', row: 0, col: 2, max: 3, name: 'Punctual', icon: '⏱️',
    desc: (r) => `+${3 * r}% Recharge Rate on all abilities.`, apply: (c, r) => c.stat('haste', 0.03 * r) },
  { id: 'h_luck', tree: 'professional', row: 1, col: 0, max: 3, name: 'Lucky Coin', icon: '🪙',
    desc: (r) => `+${6 * r} luck.`, apply: (c, r) => c.stat('luck', 6 * r) },
  { id: 'h_xp', tree: 'professional', row: 1, col: 2, max: 3, name: 'Reputation', icon: '📈',
    desc: (r) => `+${6 * r}% XP.`, apply: (c, r) => c.stat('xpGain', 0.06 * r) },
  { id: 'h_contacts', tree: 'professional', row: 2, col: 0, max: 1, name: 'Contacts', icon: '📞',
    desc: () => '+2 rerolls per run and chests cost 25% less.', apply: (c) => { c.stat('rerolls', 2); c.stat('chestDiscount', 0.25); } },
  { id: 'h_focus', tree: 'professional', row: 2, col: 2, max: 3, name: 'Meditation', icon: '🧘',
    desc: (r) => `Deep Breath lasts ${r}s longer.`, apply: (c, r) => c.abil('focus', 'duration', 'add', r) },
  { id: 'h_silver', tree: 'professional', row: 3, col: 1, max: 3, name: 'Melted Spoons', icon: '🥄',
    desc: (r) => `Silver Bullet +${10 * r}% Recharge Rate.`, apply: (c, r) => c.abil('silver_bullet', 'cooldown', 'pct', 10 * r) },
  { id: 'h_rain', tree: 'professional', row: 4, col: 1, max: 1, name: 'Composure', icon: '🧘‍♂️', capstone: true,
    desc: () => 'Focus builds 30% faster, and every run starts with full Focus: Deadeye is ready for the first thugs you meet.', apply: (c) => { c.flagAdd('focusRate', 0.3); c.flag('focusStart', true); } },
  { id: 'h_spray', tree: 'professional', row: 5, col: 0, max: 3, name: 'Spray and Pray', icon: '🎱', pair: 'uzi',
    desc: (r) => `Each Trick Shot hit has a ${12 * r}% chance to spit a 4-bullet Uzi burst from that thug at the next one (Uzi's damage).`,
    apply: (c, r) => c.link('ricochet', 'uzi', 'hit', 0.12 * r, (run, p, ev) => {
      const x = ev.x, z = ev.z, skip = ev.m;
      for (let i = 0; i < 4; i++) run.later(i * 0.04, () => boltFrom(run, p, x, z, { skip, range: 10, color: '#ffe38a' }));
    }, { icd: 0.2 }) },
  { id: 'h_scatter', tree: 'professional', row: 5, col: 2, max: 3, name: 'Second Opinion', icon: '✌️', pair: 'double_tap',
    desc: (r) => `Hit List and Silver Bullet hits have a ${20 * r}% chance to follow up with a free Double Tap on the same thug, restoring 3 Focus.`,
    apply: (c, r) => {
      const follow = (run, p, ev) => {
        if (ev.m.dead) return;
        if (freeCast(run, p, ev.m)) focus(run, 3);
      };
      c.link('hit_list', 'double_tap', 'hit', 0.2 * r, follow, { icd: 0.4 });
      c.link('silver_bullet', 'double_tap', 'hit', 0.2 * r, follow, { icd: 0.4 });
    } },
  { id: 'h_blinding', tree: 'professional', row: 6, col: 1, max: 3, name: 'Blinding Light', icon: '😵', pair: 'flashbang',
    desc: (r) => `Flashbang leaves thugs blinded for 2s after the stun. Sniper Rifle crits on blinded thugs deal +${20 * r}% extra damage.`,
    apply: (c, r) => {
      c.flag('flashBlind', 2);
      c.link('rifle', 'flashbang', 'crit', (run, ev) => (ev.m.blindUntil > run.time ? 1 : 0), (run, p, ev) => {
        if (!ev.m.dead) run.hit(ev.m, ev.dmg * 0.2 * r, ev.src, { noCrit: true, color: '#ffd23f' });
      }, { icd: 0 });
    } },
  { id: 'h_courtesy', tree: 'professional', row: 7, col: 1, max: 1, name: 'Professional Courtesy', icon: '🤝', capstone: true, pair: 'hit_list',
    desc: () => 'Hit List marks +1 name. Every Hit List kill cuts the remaining cooldown of all your other abilities by 40%, restores 5 Focus and drops 2 gold.',
    apply: (c) => {
      c.abil('hit_list', 'count', 'add', 1);
      c.link('hit_list', null, 'kill', 1, (run, p, ev) => {
        for (const a of run.abilities) if (!a.def.aura && a !== ev.src) a.cd *= 0.6;
        focus(run, 5);
        run.pickups.coin(ev.x, ev.z, 2);
      }, { icd: 0.25 });
    } },
];
