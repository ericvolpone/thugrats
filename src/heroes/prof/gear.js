/** Professor Pudding's signature gear — one piece per map, earned by clearing it. */
export const PROF_GEAR = [
  {
    id: 'prof_goggles', slot: 'Head', name: 'Lab Goggles', icon: '🥽', map: 'little_italy',
    desc: (t) => `Science abilities +${8 + 8 * t}% damage.${t >= 2 ? ' +6% Recharge Rate.' : ''}${t >= 4 ? ' Tesla Coil +2 jumps.' : ''}`,
    apply(c, t) {
      c.abil('#science', 'damage', 'pct', 8 + 8 * t);
      if (t >= 2) c.stat('haste', 0.06);
      if (t >= 4) c.abil('tesla', 'count', 'add', 2);
    },
  },
  {
    id: 'prof_coat', slot: 'Chest', name: 'Tiny Lab Coat', icon: '🥼', map: 'the_docks',
    desc: (t) => `+${15 + 12 * t} max HP. Robo-Nanny +${15 + 10 * t}% damage.${t >= 3 ? ' +1 robot.' : ''}`,
    apply(c, t) {
      c.stat('maxHp', 15 + 12 * t);
      c.abil('robo', 'damage', 'pct', 15 + 10 * t);
      if (t >= 3) c.abil('robo', 'count', 'add', 1);
    },
  },
  {
    id: 'prof_shoes', slot: 'Feet', name: 'Rocket Booties', icon: '🚀', map: 'casino_row',
    desc: (t) => `+${5 + 3 * t}% move speed, +${6 + 4 * t}% XP.${t >= 2 ? ' +8 luck.' : ''}`,
    apply(c, t) {
      c.stat('speedPct', 0.05 + 0.03 * t);
      c.stat('xpGain', 0.06 + 0.04 * t);
      if (t >= 2) c.stat('luck', 8);
    },
  },
];
