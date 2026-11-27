/** Is this thug on the Hit List right now? (abilities.js sets m.listedUntil when run.flags.listMark is on) */
const listed = (run, m) => m.listedUntil > run.time;

/**
 * Babyface's gear sets: one per map, dropped by that map's Crime Titans (see
 * data/gear.js). Bonuses at 2 / 3 / 5 pieces worn; k (×1 → ×2) grows with the
 * average tier of the pieces you wear from the set.
 */
const r = (v) => Math.round(v);

export const BABYFACE_GEAR = [
  {
    id: 'wiseguy', map: 'little_italy', name: 'Wiseguy', icon: '🎩', focus: 'rifle', focusName: 'Sniper Rifle',
    pieces: ['White Fedora', 'Kid-Leather Mittens', 'Pinstripe Bib', 'Double-Breasted Diaper', 'Two-Tone Booties'],
    bonus: {
      2: { desc: (k) => `Sniper Rifle +${r(30 * k)}% damage.`, apply: (c, k) => c.abil('rifle', 'damage', 'pct', 30 * k) },
      3: { desc: (k) => `Sniper Rifle pierces +2, and every thug a shot hits makes the rest of that shot deal +${r(20 * k)}% damage (up to +100%).`,
        apply: (c, k) => { c.abil('rifle', 'pierce', 'add', 2); c.flag('pierceRamp', 0.2 * k); } },
      5: { desc: (k) => `Made Man: once a Sniper Rifle shot runs out of pierce it ricochets to ${r(2 * k)} more thugs.`,
        apply: (c, k) => c.flag('rifleRicochet', r(2 * k)) },
    },
  },
  {
    // id kept so worn pieces carry over; the set moved from Claymore / Car Bomb to Double Tap
    id: 'cleanup_crew', map: 'the_docks', name: 'Cleanup Crew', icon: '🧹', focus: 'double_tap', focusName: 'Double Tap',
    pieces: ['Knit Watch Cap', 'Rope-Burn Mittens', 'Rubber Apron Bib', 'Bilge Diaper', 'Wader Booties'],
    bonus: {
      2: { desc: (k) => `Double Tap +${r(30 * k)}% damage and +${r(15 * k)}% Recharge Rate.`,
        apply: (c, k) => { c.abil('double_tap', 'damage', 'pct', 30 * k); c.abil('double_tap', 'cooldown', 'pct', 15 * k); } },
      3: { desc: (k) => `Double Tap goes for Spotted thugs when its last target is gone, and every Double Tap hit on a Spotted thug restores ${r(4 * k)} Focus. Spotter +1 target.`,
        apply: (c, k) => { c.flag('tapSpotted', true); c.flagAdd('tapFocus', r(4 * k)); c.abil('spotter', 'count', 'add', 1); } },
      5: { desc: (k) => `Confirm the Kill: Double Tap fires a third shot, any Double Tap kill readies the next one within 0.5s, and precision hits on Spotted thugs deal +${r(25 * k)}% more crit damage.`,
        apply: (c, k) => { c.flag('tapThird', true); c.flag('tapReset', true); c.flagAdd('spotCrit', 0.25 * k); } },
    },
  },
  {
    id: 'dealer', map: 'casino_row', name: 'Dealer', icon: '🃏', focus: 'hit_list', focusName: 'Hit List',
    pieces: ['Green Eyeshade', 'Card-Shark Mittens', 'Bow-Tie Bib', 'High-Stakes Diaper', 'Patent-Leather Booties'],
    bonus: {
      2: { desc: (k) => `Hit List +1 name and +${r(25 * k)}% damage.`,
        apply: (c, k) => { c.abil('hit_list', 'count', 'add', 1); c.abil('hit_list', 'damage', 'pct', 25 * k); } },
      3: { desc: (k) => `Thugs on the Hit List take +${r(15 * k)}% damage from everything for 8s.`,
        apply: (c, k) => { c.flag('listMark', true); c.amp((run, m) => (listed(run, m) ? 0.15 * k : 0)); } },
      5: { desc: (k) => `House Always Wins: every Hit List name that dies (to anything) takes ${(3 * k).toFixed(1)}s off Silver Bullet's cooldown. Silver Bullet can shoot any listed thug and deals +50% damage to them.`,
        apply: (c, k) => {
          c.flag('listMark', true);
          c.flag('silverListed', true);
          c.link('*', 'silver_bullet', 'kill', (run, ev) => (listed(run, ev.m) ? 1 : 0), (run, p) => { p.cd = Math.max(0, p.cd - 3 * k); }, { icd: 0 });
          c.amp((run, m, a) => (a?.def?.id === 'silver_bullet' && listed(run, m) ? 0.5 : 0));
        } },
    },
  },
  {
    id: 'tea_house', map: 'chinatown', name: 'Tea House', icon: '🍵', focus: 'uzi', focusName: 'Uzi',
    pieces: ['Silk Skullcap', 'Mahjong Mittens', 'Teahouse Bib', 'Lotus Diaper', 'Cloth Slipper Booties'],
    bonus: {
      2: { desc: (k) => `Uzi +${r(3 * k)} bullets per burst, Sawed-Off +${r(2 * k)} pellets.`,
        apply: (c, k) => { c.abil('uzi', 'count', 'add', r(3 * k)); c.abil('sawed_off', 'count', 'add', r(2 * k)); } },
      3: { desc: (k) => `Uzi bullets and Sawed-Off pellets pierce ${r(k)} thug${r(k) > 1 ? 's' : ''}.`, apply: (c, k) => c.flag('closePierce', r(k)) },
      5: { desc: (k) => `Two Hands: every Uzi burst and Sawed-Off blast is fired again from the other hand at a different thug (${r(50 * k)}% damage).`,
        apply: (c, k) => c.flag('dualWield', 0.5 * k) },
    },
  },
  {
    id: 'shooting_gallery', map: 'coney_island', name: 'Shooting Gallery', icon: '🎯', focus: 'ricochet', focusName: 'Trick Shot',
    pieces: ['Paper Prize Hat', 'Air-Rifle Mittens', 'Ring-Toss Bib', 'Cotton-Candy Diaper', 'Boardwalk Booties'],
    bonus: {
      2: { desc: (k) => `Trick Shot +${r(30 * k)}% damage.`, apply: (c, k) => c.abil('ricochet', 'damage', 'pct', 30 * k) },
      3: { desc: (k) => `Every bounce adds +${r(15 * k)}% to the Trick Shot bullet's damage (up to +100%).`, apply: (c, k) => c.flag('trickRamp', 0.15 * k) },
      5: { desc: (k) => `Sharpshooter: Trick Shot +${Math.floor(1 + k)} bounces, and every bounce hit (each thug after the first) is a guaranteed crit.`,
        apply: (c, k) => { c.abil('ricochet', 'bounce', 'add', Math.floor(1 + k)); c.flag('trickCrit', true); } },
    },
  },
];
