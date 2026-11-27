import { cone, nova } from '../common.js';

/**
 * Tiny Tony's talent tree (format: heroes/lenny/talents.js). 3 branches × 8 rows.
 * Row r needs 3·r points already spent in that branch. Rows 6-8 are pairing
 * talents: `pair` names the partner ability that must be in your run for them
 * to do anything (see ctx.link in game/stats.js). Procs use the partner's stats
 * and credit the damage to it.
 */

/** A Ground Pound (partner `p`) at (x, z), `size`/`dmg` scale its area/damage. */
function poundAt(run, p, x, z, size = 1, dmg = 1) {
  nova(run, p, { x, z, r: p.stat('area') * size, dmg: p.stat('damage') * dmg, knock: 8, root: p.stat('duration') * size, color: '#e8c89a' });
  run.fx.burst(x, 0.3, z, '#b49a78', Math.round(20 * size), 6);
  if (run.flags.tonyQuake) run.zone({ x, z, r: p.stat('area') * size * 0.8, life: 3, dps: p.stat('damage') * dmg * 0.35, slow: 0.4, kind: 'cement', color: '#7a6a55', ability: p });
  run.shake(0.15 * size);
}

/** A Bottle Smash (partner `p`) shattering right at (x, z): blast + shards. */
function bottleAt(run, p, x, z) {
  run.explode(x, z, p.stat('area'), p.stat('damage'), p, { small: true, noProc: true, color: '#e6fff0' });
  const n = p.stat('count');
  for (let i = 0; i < n; i++) run.shoot({ x, z, y: 0.5, angle: (i / n) * Math.PI * 2 + Math.random() * 0.4, speed: 24, dmg: p.stat('damage') * 0.45, range: 6, size: 0.7, color: '#c8ffe0', ability: p });
}

export const TONY_TREES = [
  { id: 'bruiser', name: 'Bruiser', icon: '🥊', color: '#ff6b5a', blurb: 'Fists, combos and bigger swings.' },
  { id: 'iron', name: 'Iron Diaper', icon: '🛡️', color: '#8fb8ff', blurb: 'Soak it all up and dish it back.' },
  { id: 'barfight', name: 'Bar Fight', icon: '🍼', color: '#ffb02e', blurb: 'Bottles, chairs, stink and chaos.' },
];

export const TONY_TALENTS = [
  // ── Bruiser ──
  { id: 't_knuckles', tree: 'bruiser', row: 0, col: 0, max: 5, name: 'Bare Knuckles', icon: '✊',
    desc: (r) => `Melee abilities deal +${4 * r}% damage and heal you for ${r}% of it.`, apply: (c, r) => { c.abil('#melee', 'damage', 'pct', 4 * r); c.stat('meleeLeech', 0.01 * r); } },
  { id: 't_jab', tree: 'bruiser', row: 0, col: 2, max: 3, name: 'Quick Jab', icon: '⚡',
    desc: (r) => `Haymaker swings ${6 * r}% faster.`, apply: (c, r) => c.abil('haymaker', 'cooldown', 'pct', 6 * r) },
  { id: 't_reach', tree: 'bruiser', row: 1, col: 0, max: 3, name: 'Long Arms', icon: '🦍',
    desc: (r) => `Melee abilities have +${6 * r}% area.`, apply: (c, r) => c.abil('#melee', 'area', 'pct', 6 * r) },
  { id: 't_sucker', tree: 'bruiser', row: 1, col: 2, max: 3, name: 'Sucker Punch', icon: '😵',
    desc: (r) => `+${3 * r}% crit chance, +${10 * r}% crit damage.`, apply: (c, r) => { c.stat('crit', 0.03 * r); c.stat('critDmg', 0.1 * r); } },
  { id: 't_charge', tree: 'bruiser', row: 2, col: 0, max: 2, name: 'Stampede', icon: '🐂',
    desc: (r) => `Bull Rush deals +${25 * r}% damage and is ${10 * r}% longer.`, apply: (c, r) => { c.abil('bull_rush', 'damage', 'pct', 25 * r); c.abil('bull_rush', 'range', 'pct', 10 * r); } },
  { id: 't_lariat', tree: 'bruiser', row: 2, col: 2, max: 2, name: 'Big Spin', icon: '🌀',
    desc: (r) => `Spinning Lariat has +${r} fist${r > 1 ? 's' : ''}.`, apply: (c, r) => c.abil('lariat', 'count', 'add', r) },
  { id: 't_bully', tree: 'bruiser', row: 3, col: 1, max: 3, name: 'Bully', icon: '👊',
    desc: (r) => `+${8 * r}% damage to elites, bosses and titans.`, apply: (c, r) => c.stat('bigDmg', 0.08 * r) },
  { id: 't_two_fists', tree: 'bruiser', row: 4, col: 1, max: 1, name: 'Two Fists', icon: '🥊', capstone: true,
    desc: () => 'Haymaker always throws one extra swing (the other fist).', apply: (c) => c.flag('tonyCombo', true) },
  { id: 't_trample', tree: 'bruiser', row: 5, col: 0, max: 3, name: 'Trample', icon: '🦶', pair: 'ground_pound',
    desc: (r) => `Bull Rush has a ${25 * r}% chance to end in a Ground Pound where the charge stops (Ground Pound's damage and stun, 80% of its size).`,
    apply: (c, r) => c.link('bull_rush', 'ground_pound', 'fire', 0.25 * r, (run, p, ev) => {
      const e = ev.src.rushEnd;
      if (e) run.later(0.3, () => poundAt(run, p, e.x, e.z, 0.8));
    }, { icd: 0.5 }) },
  { id: 't_one_two', tree: 'bruiser', row: 5, col: 2, max: 3, name: 'One-Two Clap', icon: '👏', pair: 'clap_back',
    desc: (r) => `Haymaker crits have a ${10 * r}% chance to set off a Clap Back shockwave on the target (Clap Back's damage and stun, 50% of its area).`,
    apply: (c, r) => c.link('haymaker', 'clap_back', 'crit', 0.1 * r, (run, p, ev) => {
      nova(run, p, { x: ev.x, z: ev.z, r: p.stat('area') * 0.5, dmg: p.stat('damage'), knock: 3, root: p.stat('duration'), color: '#fff6a0' });
    }, { icd: 0.8 }) },
  { id: 't_juiced_swing', tree: 'bruiser', row: 6, col: 1, max: 3, name: 'Juiced Swing', icon: '🌪️', pair: 'roid_rage',
    desc: (r) => `While Juice Box Rage is up, Haymaker swings hit all the way around you (360°) and deal +${10 * r}% damage.`,
    apply: (c, r) => {
      c.flag('tonyRageSpin', true);
      c.amp((run, m, a) => (a?.def?.id === 'haymaker' && run.buffs.roid_rage ? 0.1 * r : 0));
    } },
  { id: 't_wrecking_ball', tree: 'bruiser', row: 7, col: 1, max: 1, name: 'Wrecking Ball', icon: '🏐', capstone: true, pair: 'bull_rush',
    desc: () => 'Bull Rush swings back: the shadow charges back the way it came, bowling everyone over again. It deals +50% damage to stunned thugs, and every melee kill knocks 0.4s off its cooldown.',
    apply: (c) => {
      c.flag('tonyWreckingBall', true);
      c.amp((run, m, a) => (a?.def?.id === 'bull_rush' && m.rootT > 0 ? 0.5 : 0));
      c.link('#melee', 'bull_rush', 'kill', 1, (run, p) => { p.cd = Math.max(0, p.cd - 0.4); }, { icd: 0.05 });
    } },

  // ── Iron Diaper ──
  { id: 't_beef', tree: 'iron', row: 0, col: 0, max: 5, name: 'Big Boned', icon: '🍖',
    desc: (r) => `+${14 * r} max HP.`, apply: (c, r) => c.stat('maxHp', 14 * r) },
  { id: 't_thick', tree: 'iron', row: 0, col: 2, max: 3, name: 'Thick Skin', icon: '🦏',
    desc: (r) => `Take ${4 * r}% less damage.`, apply: (c, r) => c.stat('armor', 0.04 * r) },
  { id: 't_naps', tree: 'iron', row: 1, col: 0, max: 3, name: 'Power Nap', icon: '😴',
    desc: (r) => `+${(0.5 * r).toFixed(1)} HP regen per second.`, apply: (c, r) => c.stat('regen', 0.5 * r) },
  { id: 't_belly', tree: 'iron', row: 1, col: 2, max: 3, name: 'Six-Pack', icon: '🛡️', 
    desc: (r) => `Iron Belly shields for +${20 * r}% and recharges ${6 * r}% faster.`, apply: (c, r) => { c.abil('iron_belly', 'power', 'pct', 20 * r); c.abil('iron_belly', 'cooldown', 'pct', 6 * r); } },
  { id: 't_stubborn', tree: 'iron', row: 2, col: 0, max: 2, name: 'Stubborn', icon: '🐐',
    desc: (r) => `${5 * r}% chance to shrug off a hit.`, apply: (c, r) => c.stat('dodge', 0.05 * r) },
  { id: 't_juice', tree: 'iron', row: 2, col: 2, max: 3, name: 'Extra Juice', icon: '🧃',
    desc: (r) => `Juice Box Rage lasts ${r}s longer.`, apply: (c, r) => c.abil('roid_rage', 'duration', 'add', r) },
  { id: 't_quake', tree: 'iron', row: 3, col: 1, max: 1, name: 'Aftershock', icon: '🌋',
    desc: () => 'Ground Pound cracks the street: a slowing, damaging rubble patch for 3s.', apply: (c) => c.flag('tonyQuake', true) },
  { id: 't_thorns', tree: 'iron', row: 4, col: 1, max: 1, name: 'Spiky Onesie', icon: '🦔', capstone: true,
    desc: () => 'Shields are 30% stronger. Every hit you take deals 200% of it back to whoever dealt it.', apply: (c) => { c.flag('tonyThorns', true); c.flag('thorns', 2); } },
  { id: 't_belly_bounce', tree: 'iron', row: 5, col: 0, max: 3, name: 'Belly Bounce', icon: '🫃', pair: 'clap_back',
    desc: (r) => `Damage you take, and damage Iron Belly's shield soaks, winds up Clap Back: its next clap deals +${30 * r}% of that stored damage extra (up to +150% of Clap Back's damage).`,
    apply: (c, r) => {
      c.flag('tonyBellyBank', 0.3 * r);
      c.link('*', 'clap_back', 'hurt', 1, (run, p, ev) => { run.counters.tonyBank = (run.counters.tonyBank ?? 0) + ev.dmg; }, { icd: 0 });
    } },
  { id: 't_sewer_slam', tree: 'iron', row: 5, col: 2, max: 3, name: 'Sewer Slam', icon: '🕳️', pair: 'ground_pound',
    desc: (r) => `Manhole Cover hits have a ${8 * r}% chance to slam down a mini Ground Pound on the thug (Ground Pound's damage ×60%, half its size and stun).`,
    apply: (c, r) => c.link('manhole', 'ground_pound', 'hit', 0.08 * r, (run, p, ev) => poundAt(run, p, ev.x, ev.z, 0.5, 0.6), { icd: 0.5 }) },
  { id: 't_encore', tree: 'iron', row: 6, col: 1, max: 3, name: 'Encore', icon: '🔁', pair: 'bull_rush',
    desc: (r) => `Clap Back has a ${30 * r}% chance to reset Bull Rush's cooldown: clap, then charge the dizzy ones.`,
    apply: (c, r) => c.link('clap_back', 'bull_rush', 'fire', 0.3 * r, (run, p) => { p.cd = 0; }, { icd: 0.5 }) },
  { id: 't_immovable', tree: 'iron', row: 7, col: 1, max: 1, name: 'Immovable', icon: '🗿', capstone: true, pair: 'iron_belly',
    desc: () => 'Iron Belly shields are 50% stronger. While you stand still, melee abilities deal +25% damage and every melee hit tops your shield up by 2% of Iron Belly\'s shield (up to its full size).',
    apply: (c) => {
      c.abil('iron_belly', 'power', 'pct', 50);
      c.amp((run, m, a) => (!run.player.moving && a?.def?.tags?.includes('melee') ? 0.25 : 0));
      c.link('#melee', 'iron_belly', 'hit', (run) => (run.player.moving ? 0 : 1), (run, p) => {
        const cap = p.stat('power') * (run.flags.tonyThorns ? 1.3 : 1);
        if (run.player.shield < cap) run.player.shield = Math.min(cap, run.player.shield + p.stat('power') * 0.02);
      }, { icd: 0.1 });
    } },

  // ── Bar Fight ──
  { id: 't_arm', tree: 'barfight', row: 0, col: 0, max: 5, name: 'Good Arm', icon: '💪',
    desc: (r) => `Thrown abilities deal +${5 * r}% damage.`, apply: (c, r) => c.abil('#thrown', 'damage', 'pct', 5 * r) },
  { id: 't_quick', tree: 'barfight', row: 0, col: 2, max: 3, name: 'Last Call', icon: '⏱️',
    desc: (r) => `+${3 * r}% Recharge Rate on all abilities.`, apply: (c, r) => c.stat('haste', 0.03 * r) },
  { id: 't_glass', tree: 'barfight', row: 1, col: 0, max: 2, name: 'Broken Glass', icon: '🍼',
    desc: (r) => `Bottle Smash throws +${2 * r} shards.`, apply: (c, r) => c.abil('bottle', 'count', 'add', 2 * r) },
  { id: 't_stink', tree: 'barfight', row: 1, col: 2, max: 3, name: 'Ripe', icon: '💩',
    desc: (r) => `Stink Bomb clouds are ${8 * r}% bigger and last ${r}s longer.`, apply: (c, r) => { c.abil('stink_bomb', 'area', 'pct', 8 * r); c.abil('stink_bomb', 'duration', 'add', r); } },
  { id: 't_luck', tree: 'barfight', row: 2, col: 0, max: 3, name: 'Lucky Punch', icon: '🍀',
    desc: (r) => `+${6 * r} luck.`, apply: (c, r) => c.stat('luck', 6 * r) },
  { id: 't_chair', tree: 'barfight', row: 2, col: 2, max: 2, name: 'Steel Chair', icon: '🪑',
    desc: (r) => `Folding Chair deals +${30 * r}% damage.`, apply: (c, r) => c.abil('folding_chair', 'damage', 'pct', 30 * r) },
  { id: 't_tab', tree: 'barfight', row: 3, col: 1, max: 3, name: 'Running a Tab', icon: '💵',
    desc: (r) => `+${8 * r}% gold and XP.`, apply: (c, r) => { c.stat('goldGain', 0.08 * r); c.stat('xpGain', 0.08 * r); } },
  { id: 't_brothers', tree: 'barfight', row: 4, col: 1, max: 1, name: 'The Whole Family', icon: '👨‍👦‍👦', capstone: true,
    desc: () => 'Little Brother always brings one more brother.', apply: (c) => c.abil('little_bro', 'count', 'add', 1) },
  { id: 't_chair_shot', tree: 'barfight', row: 5, col: 0, max: 3, name: 'Chair and a Chaser', icon: '🥃', pair: 'bottle',
    desc: (r) => `Folding Chair hits have a ${30 * r}% chance to smash a free Bottle over the thug's head (Bottle Smash's blast and shards).`,
    apply: (c, r) => c.link('folding_chair', 'bottle', 'hit', 0.3 * r, (run, p, ev) => bottleAt(run, p, ev.x, ev.z), { icd: 0.5 }) },
  { id: 't_stinky_mitts', tree: 'barfight', row: 5, col: 2, max: 3, name: 'Stinky Mitts', icon: '🧤', pair: 'stink_bomb',
    desc: (r) => `Spinning Lariat hits have a ${10 * r}% chance to leave a puff of stink (Stink Bomb's damage per second and slow, 40% of its size and duration).`,
    apply: (c, r) => c.link('lariat', 'stink_bomb', 'hit', 0.1 * r, (run, p, ev) => {
      run.zone({ x: ev.x, z: ev.z, r: p.stat('area') * 0.4, life: p.stat('duration') * 0.4, dps: p.stat('damage'), slow: 0.35, kind: 'gas', ability: p });
    }, { icd: 0.35 }) },
  { id: 't_monkey_see', tree: 'barfight', row: 6, col: 1, max: 3, name: 'Monkey See', icon: '🐒', pair: 'little_bro',
    desc: (r) => `When Haymaker swings, every Little Brother throws a haymaker of his own at his thug (${40 * r}% of Little Brother's damage, 70% of Haymaker's reach).`,
    apply: (c, r) => c.link('haymaker', 'little_bro', 'fire', 1, (run, p, ev) => {
      for (const g of run.combat.goons) {
        const t = g.target;
        if (g.ability !== p || !t || t.dead) continue;
        g.swing = 1;
        cone(run, p, { x: g.x, z: g.z, angle: Math.atan2(t.x - g.x, t.z - g.z), r: ev.src.stat('area') * 0.7, half: 0.8, dmg: p.stat('damage') * 0.4 * r, knock: 4, color: '#9ac8ff' });
      }
    }, { icd: 0.3 }) },
  { id: 't_tag_team', tree: 'barfight', row: 7, col: 1, max: 1, name: 'Tag Team', icon: '🤼', capstone: true, pair: 'little_bro',
    desc: () => 'Little Brother brings one more bro, and bros punch every 0.3s instead of every 0.5s. Every bro punch has a 20% chance to tag Tony in: Haymaker is ready again instantly.',
    apply: (c) => {
      c.abil('little_bro', 'count', 'add', 1);
      c.flag('tonyTagTeam', true);
      c.link('little_bro', 'haymaker', 'hit', 0.2, (run, p) => { p.cd = 0; }, { icd: 0.4 });
    } },
];
