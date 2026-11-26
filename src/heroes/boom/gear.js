/** Boom-Boom's signature gear — one piece per map, earned by clearing it. */
export const BOOM_GEAR = [
  {
    id: 'boom_hardhat', slot: 'Head', name: 'Dented Hard Hat', icon: '⛑️', map: 'little_italy',
    desc: (t) => `Explosive abilities +${8 + 8 * t}% damage.${t >= 2 ? ' Take 8% less damage.' : ''}${t >= 4 ? ' Explosions throw 2 shrapnel.' : ''}`,
    apply(c, t) {
      c.abil('#explosive', 'damage', 'pct', 8 + 8 * t);
      if (t >= 2) c.stat('armor', 0.08);
      if (t >= 4) c.flagAdd('shrapnel', 2);
    },
  },
  {
    id: 'boom_vest', slot: 'Chest', name: 'Bandolier Bib', icon: '🦺', map: 'the_docks',
    desc: (t) => `Stick of Dynamite +${8 + 6 * t}% Recharge Rate.${t >= 2 ? ' +1 C4 charge.' : ''}${t >= 3 ? ' +1 stick.' : ''}`,
    apply(c, t) {
      c.abil('dynamite_stick', 'cooldown', 'pct', 8 + 6 * t);
      if (t >= 2) c.abil('c4', 'count', 'add', 1);
      if (t >= 3) c.abil('dynamite_stick', 'count', 'add', 1);
    },
  },
  {
    id: 'boom_boots', slot: 'Feet', name: 'Steel-Toe Booties', icon: '🥾', map: 'casino_row',
    desc: (t) => `+${15 + 10 * t} max HP, +${3 + 3 * t}% move speed.${t >= 2 ? ' Burns +20%.' : ''}`,
    apply(c, t) {
      c.stat('maxHp', 15 + 10 * t);
      c.stat('speedPct', 0.03 + 0.03 * t);
      if (t >= 2) c.stat('burnDmg', 0.2);
    },
  },
];
