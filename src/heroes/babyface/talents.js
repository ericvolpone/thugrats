import { TAU, rand } from '../../util.js';
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

/** Talent-planted Claymores alive right now (capped so they can't carpet the map). */
const extraMines = (run, p) => run.traps.filter((t) => t.ability === p && t.extra).length;
const MAX_EXTRA_MINES = 8;
/** Is this thug on the Hit List right now? (abilities.js sets m.listedUntil when run.flags.listMark is on) */
const listed = (run, m) => m.listedUntil > run.time;

export const BABYFACE_TREES = [
  { id: 'marksman', name: 'Marksman', icon: '🔭', color: '#ffd36b', blurb: 'One shot, one nap.' },
  { id: 'cleaner', name: 'Cleaner', icon: '🧹', color: '#ff6b5a', blurb: 'Close-range cleanup and loud exits.' },
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
  { id: 'h_double', tree: 'marksman', row: 4, col: 1, max: 1, name: 'Double Tap', icon: '✌️', capstone: true,
    desc: () => '30% chance the Sniper Rifle fires a second shot.', apply: (c) => c.flag('doubleTap', 0.3) },
  { id: 'h_silver_lining', tree: 'marksman', row: 5, col: 0, max: 3, name: 'Silver Lining', icon: '🥈', pair: 'silver_bullet',
    desc: (r) => `Sniper Rifle crits take ${(0.6 * r).toFixed(1)}s off Silver Bullet's cooldown.`,
    apply: (c, r) => c.link('rifle', 'silver_bullet', 'crit', 1, (run, p) => { p.cd = Math.max(0, p.cd - 0.6 * r); }, { icd: 0.2 }) },
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
    desc: () => 'Sniper Rifle shots execute thugs left under 20% HP (bosses under 10%, never titans), and every Rifle kill cuts its remaining cooldown by 40%.',
    apply: (c) => {
      c.flag('oneShot', 0.2);
      c.link('rifle', null, 'kill', 1, (run, p, ev) => { ev.src.cd *= 0.6; }, { icd: 0.15 });
    } },

  // ── Cleaner ──
  { id: 'h_shells', tree: 'cleaner', row: 0, col: 0, max: 5, name: 'Buckshot', icon: '💥',
    desc: (r) => `Sawed-Off and Uzi deal +${5 * r}% damage.`, apply: (c, r) => { c.abil('sawed_off', 'damage', 'pct', 5 * r); c.abil('uzi', 'damage', 'pct', 5 * r); } },
  { id: 'h_armor', tree: 'cleaner', row: 0, col: 2, max: 3, name: 'Kevlar Onesie', icon: '🦺',
    desc: (r) => `Take ${4 * r}% less damage.`, apply: (c, r) => c.stat('armor', 0.04 * r) },
  { id: 'h_hp', tree: 'cleaner', row: 1, col: 0, max: 3, name: 'Tough Guy', icon: '❤️',
    desc: (r) => `+${12 * r} max HP.`, apply: (c, r) => c.stat('maxHp', 12 * r) },
  { id: 'h_mines', tree: 'cleaner', row: 1, col: 2, max: 2, name: 'Mine Field', icon: '🧱',
    desc: (r) => `+${r} Claymore.`, apply: (c, r) => c.abil('claymore', 'count', 'add', r) },
  { id: 'h_boom', tree: 'cleaner', row: 2, col: 0, max: 3, name: 'Loud Exit', icon: '💣',
    desc: (r) => `Explosive abilities have +${8 * r}% area.`, apply: (c, r) => c.abil('#explosive', 'area', 'pct', 8 * r) },
  { id: 'h_regen', tree: 'cleaner', row: 2, col: 2, max: 3, name: 'Band-Aids', icon: '🩹',
    desc: (r) => `+${(0.4 * r).toFixed(1)} HP regen per second.`, apply: (c, r) => c.stat('regen', 0.4 * r) },
  { id: 'h_flash', tree: 'cleaner', row: 3, col: 1, max: 2, name: 'Extra Bright', icon: '⚪',
    desc: (r) => `Flashbang stuns ${0.4 * r}s longer.`, apply: (c, r) => c.abil('flashbang', 'duration', 'add', 0.4 * r) },
  { id: 'h_doubles', tree: 'cleaner', row: 4, col: 1, max: 1, name: 'The Twins', icon: '🕴️', capstone: true,
    desc: () => 'Body Double hires one more lookalike.', apply: (c) => c.abil('body_double', 'count', 'add', 1) },
  { id: 'h_last_round', tree: 'cleaner', row: 5, col: 0, max: 3, name: 'Last Round', icon: '🔚', pair: 'sawed_off',
    desc: (r) => `${Math.round(100 * r / 3)}% chance an Uzi burst ends with a free Sawed-Off blast at the nearest thug.`,
    apply: (c, r) => c.link('uzi', 'sawed_off', 'fire', r / 3, (run, p, ev) => run.later(ev.src.stat('count') * 0.04 + 0.05, () => freeCast(run, p)), { icd: 0.8 }) },
  { id: 'h_tripwire', tree: 'cleaner', row: 5, col: 2, max: 3, name: 'Tripwire', icon: '🪤', pair: 'claymore',
    desc: (r) => `Each thug stunned by Flashbang has a ${15 * r}% chance to get a Claymore planted at its feet (Claymore's damage, doesn't count toward Max Mines, up to ${MAX_EXTRA_MINES} at once).`,
    apply: (c, r) => c.link('flashbang', 'claymore', 'hit', 0.15 * r, (run, p, ev) => {
      if (ev.m.dead || extraMines(run, p) >= MAX_EXTRA_MINES) return;
      p.def.plant(run, p, ev.m.x, ev.m.z, { extra: true });
    }, { icd: 0 }) },
  { id: 'h_stand_in', tree: 'cleaner', row: 6, col: 1, max: 3, name: 'Stand-In', icon: '📞', pair: 'rain_of_lead',
    desc: (r) => `When Body Double clocks in, the lookalike calls a Rain of Lead on the biggest crowd (${40 + 20 * r}% of its shots).`,
    apply: (c, r) => c.link('body_double', 'rain_of_lead', 'fire', 1, (run, p) => {
      const t = run.mobs.target(run.player.x, run.player.z, p.stat('range'), 'cluster');
      if (t) p.def.rainAt(run, p, t.x, t.z, Math.max(1, Math.round(p.stat('count') * (0.4 + 0.2 * r))));
    }, { icd: 1 }) },
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
  { id: 'h_rain', tree: 'professional', row: 4, col: 1, max: 1, name: 'Whole Crew', icon: '🌧️', capstone: true,
    desc: () => 'Rain of Lead fires 8 more shots over a 25% bigger area.', apply: (c) => { c.abil('rain_of_lead', 'count', 'add', 8); c.abil('rain_of_lead', 'area', 'pct', 25); } },
  { id: 'h_spray', tree: 'professional', row: 5, col: 0, max: 3, name: 'Spray and Pray', icon: '🎱', pair: 'uzi',
    desc: (r) => `Each Trick Shot hit has a ${12 * r}% chance to spit a 4-bullet Uzi burst from that thug at the next one (Uzi's damage).`,
    apply: (c, r) => c.link('ricochet', 'uzi', 'hit', 0.12 * r, (run, p, ev) => {
      const x = ev.x, z = ev.z, skip = ev.m;
      for (let i = 0; i < 4; i++) run.later(i * 0.04, () => boltFrom(run, p, x, z, { skip, range: 10, color: '#ffe38a' }));
    }, { icd: 0.2 }) },
  { id: 'h_scatter', tree: 'professional', row: 5, col: 2, max: 3, name: 'Party Favors', icon: '🎁', pair: 'claymore',
    desc: (r) => `Car Bomb explosions scatter ${r + 1} Claymores around the wreck (Claymore's damage, don't count toward Max Mines).`,
    apply: (c, r) => c.link('car_bomb', 'claymore', 'explode', 1, (run, p, ev) => {
      const n = r + 1, a0 = rand(0, TAU);
      for (let i = 0; i < n && extraMines(run, p) < MAX_EXTRA_MINES; i++) {
        const ang = a0 + (i / n) * TAU, d = rand(1.5, 3.5);
        p.def.plant(run, p, ev.x + Math.sin(ang) * d, ev.z + Math.cos(ang) * d, { extra: true, ang });
      }
    }, { icd: 1 }) },
  { id: 'h_blinding', tree: 'professional', row: 6, col: 1, max: 3, name: 'Blinding Light', icon: '😵', pair: 'flashbang',
    desc: (r) => `Flashbang leaves thugs blinded for 2s after the stun. Sniper Rifle crits on blinded thugs deal +${20 * r}% extra damage.`,
    apply: (c, r) => {
      c.flag('flashBlind', 2);
      c.link('rifle', 'flashbang', 'crit', (run, ev) => (ev.m.blindUntil > run.time ? 1 : 0), (run, p, ev) => {
        if (!ev.m.dead) run.hit(ev.m, ev.dmg * 0.2 * r, ev.src, { noCrit: true, color: '#ffd23f' });
      }, { icd: 0 });
    } },
  { id: 'h_courtesy', tree: 'professional', row: 7, col: 1, max: 1, name: 'Professional Courtesy', icon: '🤝', capstone: true, pair: 'hit_list',
    desc: () => 'Hit List marks +1 name. Every Hit List kill cuts the remaining cooldown of all your other abilities by 40% and drops 2 gold.',
    apply: (c) => {
      c.abil('hit_list', 'count', 'add', 1);
      c.link('hit_list', null, 'kill', 1, (run, p, ev) => {
        for (const a of run.abilities) if (!a.def.aura && a !== ev.src) a.cd *= 0.6;
        run.pickups.coin(ev.x, ev.z, 2);
      }, { icd: 0.25 });
    } },
];
