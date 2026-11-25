/** Tony's signature gear — one piece per map, earned by clearing it. */
export const TONY_GEAR = [
  {
    id: 'tony_beanie', slot: 'Head', name: 'Lucky Beanie', icon: '🧢', map: 'little_italy',
    desc: (t) => `Haymaker +${10 + 10 * t}% damage.${t >= 2 ? ' +10% melee area.' : ''}${t >= 4 ? ' +1 Haymaker swing.' : ''}`,
    apply(c, t) {
      c.abil('haymaker', 'damage', 'pct', 10 + 10 * t);
      if (t >= 2) c.abil('#melee', 'area', 'pct', 10);
      if (t >= 4) c.abil('haymaker', 'count', 'add', 1);
    },
  },
  {
    id: 'tony_onesie', slot: 'Chest', name: 'Padded Onesie', icon: '🦺', map: 'the_docks',
    desc: (t) => `+${20 + 15 * t} max HP, take ${3 + 2 * t}% less damage.${t >= 3 ? ' Iron Belly +40% shield.' : ''}`,
    apply(c, t) {
      c.stat('maxHp', 20 + 15 * t);
      c.stat('armor', 0.03 + 0.02 * t);
      if (t >= 3) c.abil('iron_belly', 'power', 'pct', 40);
    },
  },
  {
    id: 'tony_gloves', slot: 'Feet', name: 'Boxing Booties', icon: '🥾', map: 'casino_row',
    desc: (t) => `+${4 + 3 * t}% move speed, Bull Rush cools down ${8 + 6 * t}% faster.${t >= 2 ? ' +8 luck.' : ''}`,
    apply(c, t) {
      c.stat('speedPct', 0.04 + 0.03 * t);
      c.abil('bull_rush', 'cooldown', 'pct', 8 + 6 * t);
      if (t >= 2) c.stat('luck', 8);
    },
  },
];
