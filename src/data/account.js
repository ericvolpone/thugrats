/**
 * Account-wide progression bought with Rep (earned by every run, any hero).
 * Each upgrade has `max` levels; cost(level) is the price of the NEXT level
 * (level = how many you already own). Effects are read by game/stats.js and
 * game/pet.js. Totals are tuned so maxing everything takes ~50+ runs.
 */
export const ACCOUNT_UPGRADES = [
  {
    id: 'pet', name: 'Biscuit the Bulldog', icon: '🐶', max: 1, group: 'Pet',
    desc: (l) => (l ? 'Biscuit fetches XP, gold and goodies for you every run.' : 'Adopt a pet bulldog that runs around fetching XP, gold and goodies you can\'t reach.'),
    cost: () => 60,
  },
  {
    id: 'pet_range', name: 'Long Leash', icon: '🦮', max: 8, group: 'Pet', requires: 'pet',
    desc: (l) => `Biscuit searches ${petRange(l)}m around you`,
    cost: (l) => 20 + 14 * l,
  },
  {
    id: 'pet_speed', name: 'Zoomies', icon: '💨', max: 8, group: 'Pet', requires: 'pet',
    desc: (l) => `Biscuit runs at ${petSpeed(l).toFixed(1)} m/s`,
    cost: (l) => 20 + 14 * l,
  },
  {
    id: 'run_xp', name: 'Street Education', icon: '📚', max: 10, group: 'Runs',
    desc: (l) => `+${l * 5}% XP in runs`,
    cost: (l) => 15 + 10 * l,
  },
  {
    id: 'run_gold', name: 'Skim Off the Top', icon: '💰', max: 10, group: 'Runs',
    desc: (l) => `+${l * 5}% gold in runs`,
    cost: (l) => 15 + 10 * l,
  },
  {
    id: 'move_speed', name: 'Running Shoes', icon: '👟', max: 10, group: 'Runs',
    desc: (l) => `+${l * 2}% move speed in runs`,
    cost: (l) => 15 + 10 * l,
  },
];

export const petRange = (l) => 10 + l * 3; // 10m → 34m
export const petSpeed = (l) => 7 + l * 0.9; // 7 → 14.2 m/s

/** Rep earned for a run. */
export function repForRun({ minutes, bossKills, titanKills, victory, diffIndex }) {
  const mult = [1, 1.5, 2][diffIndex] ?? 1;
  return Math.round((minutes * 2 + bossKills * 4 + titanKills * 8 + (victory ? 15 : 0)) * mult);
}
