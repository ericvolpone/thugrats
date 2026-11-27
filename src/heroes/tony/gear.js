import { nova, chill, slamOnWall } from '../common.js';

/**
 * Tony's gear sets: one per map, dropped by that map's Crime Titans (see
 * data/gear.js). Bonuses at 2 / 3 / 5 pieces worn; k (×1 → ×2) grows with the
 * average tier of the pieces you wear from the set.
 */
const r = (v) => Math.round(v);

/**
 * Dragon Dance (5): a hidden, never-ending buff whose stats() hook runs every
 * frame (see computeStats). It builds momentum while Tony walks and loses it
 * when he stops, and grows Spinning Lariat's radius with it.
 */
function dragonDance(run, k) {
  if (run.buffs._tonyDance) return;
  run.buffs._tonyDance = {
    t: Infinity, max: Infinity, m: 0, on: 0, last: run.time,
    stats: (s, b, rr) => {
      const dt = rr.time - b.last;
      b.last = rr.time;
      const a = rr.abilityById('lariat');
      if (!a || dt <= 0) return;
      b.m = Math.max(0, Math.min(1, b.m + (rr.player.moving ? dt / 2 : -dt)));
      const want = b.m * 0.5 * k;
      a.inc.area = (a.inc.area ?? 0) + want - b.on;
      b.on = want;
      if (b.m > 0.5 && Math.random() < dt * 12) rr.fx.burst(rr.player.x, 0.6, rr.player.z, '#ff4a2a', 1, 2, 0.4, 0.7, -2);
    },
  };
}

export const TONY_GEAR = [
  {
    id: 'corner_bar', map: 'little_italy', name: 'Corner Bar', icon: '🍺', focus: 'haymaker', focusName: 'Haymaker',
    pieces: ['Bartender\'s Flat Cap', 'Brass Knuckle Mittens', 'Beer-Stained Bib', 'Barstool Diaper', 'Last-Call Booties'],
    bonus: {
      2: { desc: (k) => `Haymaker swings ${r(20 * k)}% faster and has +${r(10 * k)}% area.`,
        apply: (c, k) => { c.abil('haymaker', 'cooldown', 'pct', 20 * k); c.abil('haymaker', 'area', 'pct', 10 * k); } },
      3: { desc: () => 'Haymaker swings are 50% wider (a big roundhouse).', apply: (c) => c.flag('tonyWideSwing', true) },
      5: { desc: (k) => `Every 4th Haymaker also sends a shockwave all around Tony: 1.8× Haymaker's reach, ×${(1.5 * k).toFixed(1)} its damage, stuns 0.5s and knocks thugs into the walls (slams).`,
        apply: (c, k) => c.flag('tonyShockwave', 1.5 * k) },
    },
  },
  {
    id: 'dock_worker', map: 'the_docks', name: 'Dock Worker', icon: '⚓', focus: 'headlock', focusName: 'Headlock',
    pieces: ['Stevedore Beanie', 'Cargo Net Mittens', 'Rope-Burn Bib', 'Bilge Diaper', 'Gangplank Booties'],
    bonus: {
      2: { desc: (k) => `Headlock gets +${r(20 * k)}% Recharge Rate and throws ${r(15 * k)}% farther.`,
        apply: (c, k) => { c.abil('headlock', 'cooldown', 'pct', 20 * k); c.abil('headlock', 'range', 'pct', 15 * k); } },
      3: { desc: () => 'Cargo Hook: Headlock grabs from 50% farther away, and a thrown thug that hits a wall slams for double.',
        apply: (c) => { c.flag('tonyGrabReach', 1.5); c.flag('tonyThrowSlam', true); } },
      5: { desc: (k) => `Man Overboard: every Headlock landing sends out a shockwave. Everything within twice the landing area takes ×${(0.5 * k).toFixed(1)} Headlock's damage and is blasted away into the walls (slams).`,
        apply: (c, k) => c.flag('tonyLandWave', 0.5 * k) },
    },
  },
  {
    id: 'bouncer', map: 'casino_row', name: 'The Bouncer', icon: '🕴️', focus: 'clap_back', focusName: 'Clap Back',
    pieces: ['Velvet Rope Cap', 'No-Entry Mittens', 'Guest-List Bib', 'Doorman\'s Diaper', 'Kick-Out Booties'],
    bonus: {
      2: { desc: (k) => `Iron Belly shields for +${r(30 * k)}% and recharges ${r(15 * k)}% faster.`,
        apply: (c, k) => { c.abil('iron_belly', 'power', 'pct', 30 * k); c.abil('iron_belly', 'cooldown', 'pct', 15 * k); } },
      3: { desc: () => 'Iron Belly flexes with a small Clap Back (needs Clap Back: 50% of its damage, area and stun).',
        apply: (c) => c.link('iron_belly', 'clap_back', 'fire', 1, (run, p) => {
          nova(run, p, { r: p.stat('area') * 0.5, dmg: p.stat('damage') * 0.5, knock: 3, root: p.stat('duration') * 0.5, color: '#fff6a0' });
        }, { icd: 0 }) },
      5: { desc: (k) => `Running a Tab: ${r(40 * k)}% of all damage you take goes on the tab. When it reaches 10% of your max HP, Tony throws everyone out: a shockwave (radius 7) for 5× the tab, stunning 1s (anyone thrown into a wall takes another 2× the tab), and heals 25% of it.`,
        apply: (c, k) => c.link('*', null, 'hurt', 1, (run, p, ev) => {
          const cn = run.counters;
          cn.tonyTab = (cn.tonyTab ?? 0) + ev.dmg * 0.4 * k;
          if (cn.tonyTab < run.stats.maxHp * 0.1) return;
          const tab = cn.tonyTab;
          cn.tonyTab = 0;
          const src = run.abilityById('clap_back') ?? run.abilityById('iron_belly') ?? null;
          nova(run, src, { r: 7, dmg: tab * 5 * run.stats.dmg, knock: 9, root: 1, color: '#ffd23f',
            onHit: (m) => slamOnWall(run, m, src, tab * 2 * run.stats.dmg) });
          run.heal(tab * 0.25);
          run.shake(0.25);
        }, { icd: 0 }) },
    },
  },
  {
    id: 'dragon_dance', map: 'chinatown', name: 'Dragon Dance', icon: '🐲', focus: 'lariat', focusName: 'Spinning Lariat',
    pieces: ['Lion-Head Cap', 'Firecracker Mittens', 'Red Silk Bib', 'Lucky Dragon Diaper', 'Paper-Lantern Booties'],
    bonus: {
      2: { desc: (k) => `Spinning Lariat +1 fist and +${r(20 * k)}% damage.`,
        apply: (c, k) => { c.abil('lariat', 'count', 'add', 1); c.abil('lariat', 'damage', 'pct', 20 * k); } },
      3: { desc: () => 'Spinning Lariat hits slow thugs by 35% for 1.5s.',
        apply: (c) => c.link('lariat', null, 'hit', 1, (run, p, ev) => chill(ev.m, 0.35, 1.5), { icd: 0 }) },
      5: { desc: (k) => `The dance: while you keep moving, Spinning Lariat builds up over 2s to +${r(50 * k)}% radius and +${r(30 * k)}% damage. It winds back down when you stop.`,
        apply: (c, k) => {
          c.link('lariat', null, 'hit', 1, (run) => dragonDance(run, k), { icd: 1 });
          c.amp((run, m, a) => (a?.def?.id === 'lariat' ? (run.buffs._tonyDance?.m ?? 0) * 0.3 * k : 0));
        } },
    },
  },
  {
    id: 'strongman', map: 'coney_island', name: 'Strongman', icon: '🏋️', focus: 'bull_rush', focusName: 'Bull Rush',
    pieces: ['Carny Bowler', 'Barbell Mittens', 'Leopard-Print Bib', 'Singlet Diaper', 'Boardwalk Booties'],
    bonus: {
      2: { desc: (k) => `Bull Rush gets +${r(20 * k)}% Recharge Rate and charges ${r(15 * k)}% farther.`,
        apply: (c, k) => { c.abil('bull_rush', 'cooldown', 'pct', 20 * k); c.abil('bull_rush', 'range', 'pct', 15 * k); } },
      3: { desc: () => 'Bull Rush stuns everyone it bowls over for 0.6s. Ground Pound has +20% area and cracks the street: a slowing, damaging rubble patch for 3s.',
        apply: (c) => { c.flag('tonyRushStun', 0.6); c.abil('ground_pound', 'area', 'pct', 20); c.flag('tonyQuake', true); } },
      5: { desc: (k) => `Bull Rush cracks the street: its path becomes a quake trail for 3s that slows by 40% and deals ${r(25 * k)}% of Bull Rush's damage per second.`,
        apply: (c, k) => c.flag('tonyQuakeTrail', 0.25 * k) },
    },
  },
];
