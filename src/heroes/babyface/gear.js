/** Babyface's signature gear — one piece per map, earned by clearing it. */
export const BABYFACE_GEAR = [
  {
    id: 'bf_fedora', slot: 'Head', name: 'White Fedora', icon: '🎩', map: 'little_italy',
    desc: (t) => `Sniper Rifle +${10 + 10 * t}% damage.${t >= 2 ? ' +1 pierce.' : ''}${t >= 4 ? ' +10% Double Tap.' : ''}`,
    apply(c, t) {
      c.abil('rifle', 'damage', 'pct', 10 + 10 * t);
      if (t >= 2) c.abil('rifle', 'pierce', 'add', 1);
      if (t >= 4) c.flagAdd('doubleTap', 0.1);
    },
  },
  {
    id: 'bf_suit', slot: 'Chest', name: 'Three-Piece Onesie', icon: '🤵', map: 'the_docks',
    desc: (t) => `+${3 + 2 * t}% crit chance. Take ${3 + 2 * t}% less damage.${t >= 3 ? ' Hit List +1 name.' : ''}`,
    apply(c, t) {
      c.stat('crit', 0.03 + 0.02 * t);
      c.stat('armor', 0.03 + 0.02 * t);
      if (t >= 3) c.abil('hit_list', 'count', 'add', 1);
    },
  },
  {
    id: 'bf_shoes', slot: 'Feet', name: 'Spats', icon: '👞', map: 'casino_row',
    desc: (t) => `+${4 + 3 * t}% move speed, +${8 + 6 * t}% gold.${t >= 2 ? ' +8 luck.' : ''}`,
    apply(c, t) {
      c.stat('speedPct', 0.04 + 0.03 * t);
      c.stat('goldGain', 0.08 + 0.06 * t);
      if (t >= 2) c.stat('luck', 8);
    },
  },
];
