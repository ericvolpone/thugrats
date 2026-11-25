/**
 * Lenny's permanent gear — one piece per map, earned by clearing it.
 * Each clear upgrades the piece one tier (grey → orange), capped by the
 * difficulty you cleared on (Normal: green, Hard: purple, Nightmare: orange).
 * apply(ctx, tier) uses the same ctx as talents.
 */
export const LENNY_GEAR = [
  {
    id: 'dons_fedora', slot: 'Head', name: "The Don's Fedora", icon: '🎩', map: 'little_italy',
    desc: (t) => `Snub-Nose +${10 + 10 * t}% damage.${t >= 2 ? ' Bullets pierce +1.' : ''}${t >= 4 ? ' Trigger Man: Double Tap +10%.' : ''}`,
    apply(c, t) {
      c.abil('pistol', 'damage', 'pct', 10 + 10 * t);
      if (t >= 2) c.abil('pistol', 'pierce', 'add', 1);
      if (t >= 4) c.flagAdd('doubleTap', 0.1);
    },
  },
  {
    id: 'lead_bib', slot: 'Chest', name: 'Lead-Lined Bib', icon: '🦺', map: 'the_docks',
    desc: (t) => `Frenzy lasts +${(0.5 + 0.5 * t).toFixed(1)}s. Take ${8 + 6 * t}% less damage while Frenzied.${t >= 3 ? ' Start every run with Frenzy.' : ''}`,
    apply(c, t) {
      c.abil('frenzy', 'duration', 'add', 0.5 + 0.5 * t);
      c.stat('frenzyArmor', 0.08 + 0.06 * t);
      if (t >= 3) c.flag('startFrenzy', true);
    },
  },
  {
    id: 'loaded_booties', slot: 'Feet', name: 'Loaded Booties', icon: '🥾', map: 'casino_row',
    desc: (t) => `+${5 + 5 * t} luck, +${4 + 4 * t}% move speed. Explosive abilities +${5 + 5 * t}% area.`,
    apply(c, t) {
      c.stat('luck', 5 + 5 * t);
      c.stat('speedPct', 0.04 + 0.04 * t);
      c.abil('#explosive', 'area', 'pct', 5 + 5 * t);
    },
  },
];
