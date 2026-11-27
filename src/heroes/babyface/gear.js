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
      3: { desc: (k) => `Sniper Rifle pierces +2, and every thug a shot hits makes the rest of that shot deal +${r(20 * k)}% damage.`,
        apply: (c, k) => { c.abil('rifle', 'pierce', 'add', 2); c.flag('pierceRamp', 0.2 * k); } },
      5: { desc: (k) => `Made Man: once a Sniper Rifle shot runs out of pierce it ricochets to ${r(2 * k)} more thugs.`,
        apply: (c, k) => c.flag('rifleRicochet', r(2 * k)) },
    },
  },
  {
    id: 'cleanup_crew', map: 'the_docks', name: 'Cleanup Crew', icon: '🧹', focus: '#explosive', focusName: 'Claymore & Car Bomb',
    pieces: ['Knit Watch Cap', 'Rope-Burn Mittens', 'Rubber Apron Bib', 'Bilge Diaper', 'Wader Booties'],
    bonus: {
      2: { desc: (k) => `Claymore and Car Bomb +${r(25 * k)}% damage. Claymore +1 max mine.`,
        apply: (c, k) => { c.abil('#explosive', 'damage', 'pct', 25 * k); c.abil('claymore', 'count', 'add', 1); } },
      3: { desc: (k) => `Tripped traps root thugs around them for ${(0.8 * k).toFixed(1)}s, and Claymore gets +${r(20 * k)}% Recharge Rate.`,
        apply: (c, k) => { c.stat('trapRoot', 0.8 * k); c.abil('claymore', 'cooldown', 'pct', 20 * k); } },
      5: { desc: (k) => `Daisy Chain: when a Claymore or Car Bomb goes off, every Claymore within ${r(6 * k)}m goes off too, one after another. Each link in the chain hits 15% harder.`,
        apply: (c, k) => { c.flag('trapChain', 6 * k); c.flag('trapChainDmg', 0.15); } },
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
      3: { desc: (k) => `Every bounce adds +${r(15 * k)}% to the Trick Shot bullet's damage.`, apply: (c, k) => c.flag('trickRamp', 0.15 * k) },
      5: { desc: (k) => `Sharpshooter: Trick Shot +${Math.floor(1 + k)} bounces, and every bounce hit (each thug after the first) is a guaranteed crit.`,
        apply: (c, k) => { c.abil('ricochet', 'bounce', 'add', Math.floor(1 + k)); c.flag('trickCrit', true); } },
    },
  },
];
