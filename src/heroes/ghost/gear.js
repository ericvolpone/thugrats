/** Lucy's signature gear — one piece per map, earned by clearing it. */
export const GHOST_GEAR = [
  {
    id: 'ghost_mask', slot: 'Head', name: 'Domino Mask', icon: '🎭', map: 'little_italy',
    desc: (t) => `+${3 + 2 * t}% crit chance, +${10 + 10 * t}% crit damage.${t >= 3 ? ' Silenced Pistol +1 pierce.' : ''}`,
    apply(c, t) {
      c.stat('crit', 0.03 + 0.02 * t);
      c.stat('critDmg', 0.1 + 0.1 * t);
      if (t >= 3) c.abil('silenced', 'pierce', 'add', 1);
    },
  },
  {
    id: 'ghost_coat', slot: 'Chest', name: 'Tiny Trench Coat', icon: '🧥', map: 'the_docks',
    desc: (t) => `+${3 + 2 * t}% dodge. Smoke Bomb +${10 + 8 * t}% area.${t >= 2 ? ' +15 max HP.' : ''}`,
    apply(c, t) {
      c.stat('dodge', 0.03 + 0.02 * t);
      c.abil('smoke', 'area', 'pct', 10 + 8 * t);
      if (t >= 2) c.stat('maxHp', 15);
    },
  },
  {
    id: 'ghost_slippers', slot: 'Feet', name: 'Silent Slippers', icon: '🩴', map: 'casino_row',
    desc: (t) => `+${5 + 3 * t}% move speed, +${4 + 4 * t} luck.${t >= 3 ? ' Poisons +25%.' : ''}`,
    apply(c, t) {
      c.stat('speedPct', 0.05 + 0.03 * t);
      c.stat('luck', 4 + 4 * t);
      if (t >= 3) c.stat('burnDmg', 0.25);
    },
  },
];
