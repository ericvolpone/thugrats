import { boltFrom, ringShot, chill, freeCast, nova } from '../heroes/common.js';

/**
 * Contraband: one supercharge per ability, bought at the Black Market with a
 * Crime Titan contract. You're only ever offered Contraband for abilities you
 * hold this run, so every card is for your build; abilities you've levelled
 * more (vs. your run level) show up more often.
 *
 * A Contraband is two things, both per copy (copies stack linearly):
 *  - a SUPERCHARGE: a big bundle of every upgrade the ability can roll
 *    (percent upgrades ×BOOST of a common roll, damage ×DMG_BOOST, flat upgrades
 *    at their Legendary value, ignoring the usual upgrade caps);
 *  - a TWIST: one hand-picked extra (a proc on hit / crit / kill / fire /
 *    explode with the ability's own stats, or a flat bonus).
 *
 * Built per hero at startup (heroes/index.js → h.contraband); the defs look like
 * run items (slot 'stash') so the HUD, logs and item code treat them the same.
 */
const BOOST = 2;
const DMG_BOOST = 3;

const R = '#ff3b3b';
const dmg = (a, m, v) => a.stat('damage') * m * v;

// ── twist building blocks: proc(run, a, ev, v), ev = {m?, x, z, ...} ─────────
const P = {
  /** blast for m× the ability's damage (radius r, or the ability's area × r when area=true) */
  blast: (m, r) => (run, a, ev, v) => run.explode(ev.x, ev.z, r, dmg(a, m, v), a, { noProc: true, small: true, color: R }),
  burn: (m, r, life) => (run, a, ev, v) => run.zone({ x: ev.x, z: ev.z, r, life, dps: dmg(a, m, v) * (1 + run.stats.burnDmg), kind: 'fire', ability: a }),
  bolt: (m) => (run, a, ev, v) => boltFrom(run, a, ev.x, ev.z, { dmg: dmg(a, m, v), skip: ev.m, color: R }),
  ring: (n, m) => (run, a, ev, v) => ringShot(run, a, ev.x, ev.z, n, dmg(a, m, v), R),
  slow: (amt, t) => (run, a, ev) => { if (ev.m && !ev.m.dead) chill(ev.m, amt, t); },
  root: (t) => (run, a, ev) => { const m = ev.m; if (m && !m.dead) m.rootT = Math.max(m.rootT ?? 0, m.tier >= 2 ? t * 0.25 : t); },
  ignite: (m, t) => (run, a, ev, v) => { if (ev.m && !ev.m.dead) run.ignite(ev.m, dmg(a, m, v), t); },
  refund: (s) => (run, a, ev, v) => { a.cd = Math.max(0, a.cd - s * v); },
  heal: (n) => (run, a, ev, v) => run.heal(n * v),
  shield: (n) => (run, a, ev, v) => { run.player.shield = Math.max(run.player.shield, n * v); },
  gold: (n) => (run, a, ev, v) => run.addGold(n * v, true),
  /** cast it again for free after `t` seconds */
  echo: (t) => (run, a) => run.later(t, () => { if (!run.ended && run.abilities.includes(a)) freeCast(run, a, null); }),
  /** every other ability of yours recharges `s` seconds */
  haste: (s) => (run, a, ev, v) => { for (const b of run.abilities) if (b !== a) b.cd = Math.max(0, b.cd - s * v); },
  nova: (base, r) => (run, a, ev, v) => nova(run, a, { r, dmg: base * run.stats.dmg * v, knock: 6, color: R }),
};

/**
 * Per ability: name, twist text (k = stacks) and the twist itself.
 *   on: 'hit'|'crit'|'kill'|'fire'|'explode', chance (default 1), icd (default 0.2s), fn: P.*
 *   extra: {stat: flat per copy} for twists that are just a bigger number
 */
const T = {
  // ── Lenny ──
  pistol: { name: 'Gold-Plated .38', text: (k) => `Kills ricochet a bullet into the next thug (${60 * k}% damage)`, on: 'kill', icd: 0.1, fn: P.bolt(0.6) },
  frenzy: { name: 'Triple Espresso', text: (k) => `Going into a Frenzy heals ${12 * k} HP`, on: 'fire', fn: P.heal(12) },
  power_shot: { name: 'Armor-Piercing Rounds', text: (k) => `Kills explode for ${50 * k}% damage`, on: 'kill', icd: 0.1, fn: P.blast(0.5, 2.4) },
  tommy: { name: 'Hundred-Round Drum', text: (k) => `15% of hits spray a bullet at another thug (${50 * k}% damage)`, on: 'hit', chance: 0.15, icd: 0.08, fn: P.bolt(0.5) },
  racket: { name: 'Union Dues', text: () => 'Thugs in the racket are slowed 25%', on: 'hit', icd: 0, fn: P.slow(0.25, 1.2) },
  make_example: { name: 'Horse Head', text: (k) => `Everyone it hits is frozen in fear for ${(1.2).toFixed(1)}s; kills heal ${2 * k} HP`, on: 'hit', icd: 0, fn: (run, a, ev, v) => { P.root(1.2)(run, a, ev); if (ev.m.hp <= 0) run.heal(2 * v); } },
  cement: { name: 'Quick-Dry Mix', text: (k) => `Kills shatter the block, exploding for ${60 * k}% damage`, on: 'kill', icd: 0.1, fn: P.blast(0.6, 2.6) },
  goon: { name: 'Union Muscle', text: (k) => `Goon kills shake down ${k} gold (35%)`, on: 'kill', chance: 0.35, icd: 0, fn: P.gold(1) },
  made_men: { name: 'The Whole Family', text: (k) => `40% of Made Men kills ricochet a shot (${60 * k}% damage)`, on: 'kill', chance: 0.4, icd: 0.1, fn: P.bolt(0.6) },
  driveby: { name: 'Burning Rubber', text: (k) => `Kills leave burning rubber (${40 * k}% damage per second, 2.5s)`, on: 'kill', icd: 0.15, fn: P.burn(0.4, 2, 2.5) },
  make_it_rain: { name: 'Counterfeit Press', text: (k) => `20% of kills drop ${k} extra gold`, on: 'kill', chance: 0.2, icd: 0, fn: P.gold(1) },
  contract: { name: 'Open Contract', text: (k) => `Kills recharge the contract ${3 * k}s`, on: 'kill', icd: 0, fn: P.refund(3) },
  // ── Tony ──
  haymaker: { name: 'Horseshoe in the Glove', text: (k) => `Crits explode for ${60 * k}% damage`, on: 'crit', icd: 0.15, fn: P.blast(0.6, 2.4) },
  ground_pound: { name: 'Aftershock', text: () => 'Every Ground Pound is followed by a free second one', on: 'fire', icd: 0.5, fn: P.echo(0.45) },
  headlock: { name: 'Suplex', text: (k) => `Kills explode for ${60 * k}% damage`, on: 'kill', icd: 0.1, fn: P.blast(0.6, 2.6) },
  bottle: { name: 'Broken Glass', text: (k) => `25% of hits leave glass on the street (${25 * k}% damage per second, 2s)`, on: 'hit', chance: 0.25, icd: 0.1, fn: P.burn(0.25, 1.6, 2) },
  bull_rush: { name: 'Freight Train', text: (k) => `Kills recharge Bull Rush ${(0.5 * k).toFixed(1)}s`, on: 'kill', icd: 0, fn: P.refund(0.5) },
  roid_rage: { name: 'Family-Size Juice Box', text: (k) => `Chugging it heals ${20 * k} HP`, on: 'fire', fn: P.heal(20) },
  lariat: { name: 'Twister', text: () => '10% of hits dizzy the thug (40% slow, 1.5s)', on: 'hit', chance: 0.1, icd: 0, fn: P.slow(0.4, 1.5) },
  folding_chair: { name: 'Steel Chair', text: (k) => `Hits spray 6 bits of chair (${35 * k}% damage each)`, on: 'hit', icd: 0.3, fn: P.ring(6, 0.35) },
  iron_belly: { name: 'Six-Pack Abs', text: (k) => `Tensing up sends out a shockwave (${30 * k} damage)`, on: 'fire', fn: P.nova(30, 3.6) },
  clap_back: { name: 'Thunderclap', text: (k) => `Kills recharge Clap Back ${(0.4 * k).toFixed(1)}s`, on: 'kill', icd: 0, fn: P.refund(0.4) },
  little_bro: { name: 'Twin Brothers', text: (k) => `+${k} more Little Brother`, extra: { count: 1 } },
  // ── Boom ──
  dynamite_stick: { name: 'Bundle of Six', text: (k) => `Blasts throw 4 bits of shrapnel (${30 * k}% damage each)`, on: 'explode', icd: 0.15, fn: P.ring(4, 0.3) },
  pipe_bomb: { name: 'Nail Bomb', text: (k) => `Blasts spray 8 nails (${30 * k}% damage each)`, on: 'explode', icd: 0.1, fn: P.ring(8, 0.3) },
  c4: { name: 'Plastique', text: (k) => `Blasts leave fire (${25 * k}% damage per second, 2s)`, on: 'explode', icd: 0.1, fn: P.burn(0.25, 2.2, 2) },
  sticky_bomb: { name: 'Superglue', text: (k) => `Blasts leave burning gum (${40 * k}% damage per second, 3s)`, on: 'explode', icd: 0.1, fn: P.burn(0.4, 2.5, 3) },
  detonator: { name: "Dead Man's Switch", text: (k) => `Half of its blasts set off a second one (${40 * k}% damage)`, on: 'explode', chance: 0.5, icd: 0.1, fn: P.blast(0.4, 2.2) },
  napalm: { name: 'Jellied Gasoline', text: (k) => `10% of hits set the thug on fire (${50 * k}% damage over 3s)`, on: 'hit', chance: 0.1, icd: 0, fn: P.ignite(0.5, 3) },
  firecrackers: { name: 'Black Cats', text: (k) => `35% of pops shoot a spark at a thug (${50 * k}% damage)`, on: 'explode', chance: 0.35, icd: 0.05, fn: P.bolt(0.5) },
  bazooka: { name: 'Tandem Warhead', text: (k) => `Every rocket blows twice (second blast ${60 * k}% damage)`, on: 'explode', icd: 0.1, fn: (run, a, ev, v) => run.later(0.3, () => P.blast(0.6, ev.r * 0.8)(run, a, ev, v)) },
  rockets: { name: 'Grand Finale', text: (k) => `Kills pop again (${40 * k}% damage)`, on: 'kill', icd: 0.08, fn: P.blast(0.4, 2) },
  mortar: { name: 'Creeping Barrage', text: (k) => `+${2 * k} shells, and a quarter of them leave fire`, extra: { count: 2 }, on: 'explode', chance: 0.25, icd: 0.1, fn: P.burn(0.3, 2, 2.5) },
  big_one: { name: 'Tsar Baby', text: (k) => `Leaves a huge fire (${30 * k}% damage per second, 4s)`, on: 'explode', icd: 1, fn: (run, a, ev, v) => P.burn(0.3, ev.r * 0.7, 4)(run, a, ev, v) },
  rc_car: { name: 'Monster Truck', text: (k) => `Kills recharge the car ${k}s`, on: 'kill', icd: 0, fn: P.refund(1) },
  // ── Ghost ──
  shadow_step: { name: 'Blink Dagger', text: (k) => `Kills recharge Shadow Step ${(0.5 * k).toFixed(1)}s`, on: 'kill', icd: 0, fn: P.refund(0.5) },
  knives: { name: 'Balanced Blades', text: (k) => `Crits throw another knife at a thug (${80 * k}% damage)`, on: 'crit', icd: 0.08, fn: P.bolt(0.8) },
  smoke: { name: 'Ninja Smoke', text: (k) => `Vanishing into smoke heals ${15 * k} HP`, on: 'fire', fn: P.heal(15) },
  poison_dart: { name: 'Curare', text: () => 'Darts slow thugs 30% for 2s', on: 'hit', icd: 0, fn: P.slow(0.3, 2) },
  caltrops: { name: 'Rusty Nails', text: () => '30% of hits lame the thug (40% slow, 2s)', on: 'hit', chance: 0.3, icd: 0, fn: P.slow(0.4, 2) },
  garrote: { name: 'Piano Wire', text: (k) => `Kills recharge the Garrote ${k}s`, on: 'kill', icd: 0, fn: P.refund(1) },
  decoy: { name: 'Mannequin Bomb', text: (k) => `The decoy's blast sprays 8 splinters (${30 * k}% damage each)`, on: 'explode', icd: 0.2, fn: P.ring(8, 0.3) },
  cloak: { name: 'Smoke and Mirrors', text: (k) => `Cloaking gives a ${25 * k} HP shield`, on: 'fire', fn: P.shield(25) },
  tripwire: { name: 'Razor Wire', text: () => 'Triggered wires hold thugs in place for 1.2s', on: 'hit', icd: 0, fn: P.root(1.2) },
  sleep_gas: { name: 'Chloroform', text: () => '6% of gas ticks knock the thug out cold (1.5s)', on: 'hit', chance: 0.06, icd: 0, fn: P.root(1.5) },
  shuriken: { name: 'Razor Stars', text: (k) => `8% of hits fling a star at another thug (${100 * k}% damage)`, on: 'hit', chance: 0.08, icd: 0.05, fn: P.bolt(1) },
  curtain_call: { name: 'Encore', text: (k) => `Kills recharge Curtain Call ${(0.5 * k).toFixed(1)}s`, on: 'kill', icd: 0, fn: P.refund(0.5) },
  // ── Babyface ──
  rifle: { name: 'Match-Grade Barrel', text: (k) => `Crits blow a hole: ${40 * k}% damage around the target`, on: 'crit', icd: 0.1, fn: P.blast(0.4, 2.2) },
  double_tap: { name: 'Triple Tap', text: (k) => `35% of hits put a third round in another thug (${60 * k}% damage)`, on: 'hit', chance: 0.35, icd: 0.1, fn: P.bolt(0.6) },
  spotter: { name: 'Laser Sight', text: (k) => `+${10 * k}% more damage taken by spotted thugs`, extra: { power: 0.1 } },
  silver_bullet: { name: 'Blessed Silver', text: (k) => `Kills recharge the Silver Bullet ${4 * k}s`, on: 'kill', icd: 0, fn: P.refund(4) },
  hit_list: { name: 'Little Black Book', text: (k) => `Every name crossed off pays ${3 * k} gold`, on: 'kill', icd: 0, fn: P.gold(3) },
  focus: { name: 'Steady Hands', text: (k) => `Taking a Deep Breath recharges your other abilities ${k}s`, on: 'fire', fn: P.haste(1) },
  ricochet: { name: 'Banked Shot', text: (k) => `Kills bank one more shot into a thug (${60 * k}% damage)`, on: 'kill', icd: 0.08, fn: P.bolt(0.6) },
  sawed_off: { name: 'Double-Barrel', text: () => '20% of pellets stagger the thug (0.6s)', on: 'hit', chance: 0.2, icd: 0, fn: P.root(0.6) },
  uzi: { name: 'Extended Clip', text: (k) => `Crits spray a bullet at another thug (${50 * k}% damage)`, on: 'crit', icd: 0.06, fn: P.bolt(0.5) },
  flashbang: { name: 'Stun Grenade', text: () => 'Blinded thugs are also slowed 50% for 3s', on: 'hit', icd: 0, fn: P.slow(0.5, 3) },
  body_double: { name: 'Stunt Double', text: (k) => `+${k} more Body Double`, extra: { count: 1 } },
  // ── Prof ──
  pudding_blaster: { name: 'Extra Thick', text: (k) => `Kills splatter for ${40 * k}% damage`, on: 'kill', icd: 0.1, fn: P.blast(0.4, 2.2) },
  tesla: { name: 'Overcharged Coil', text: (k) => `Half of kills arc to another thug (${50 * k}% damage)`, on: 'kill', chance: 0.5, icd: 0.05, fn: P.bolt(0.5) },
  freeze_ray: { name: 'Absolute Zero', text: (k) => `Kills shatter into 6 ice shards (${30 * k}% damage each)`, on: 'kill', icd: 0.15, fn: P.ring(6, 0.3) },
  acid_rain: { name: 'Monsoon', text: () => '5% of drops make the thug slip (30% slow, 1.5s)', on: 'hit', chance: 0.05, icd: 0, fn: P.slow(0.3, 1.5) },
  slime: { name: 'Extra Sticky', text: () => '10% of ticks glue the thug in place (1s)', on: 'hit', chance: 0.1, icd: 0, fn: P.root(1) },
  shrink_ray: { name: 'Shrinkier Ray', text: (k) => `Kills recharge the Shrink Ray ${k}s`, on: 'kill', icd: 0, fn: P.refund(1) },
  robo: { name: 'Robo-Nanny 2.0', text: (k) => `+${k} more Robo-Nanny`, extra: { count: 1 } },
  drones: { name: 'Drone Carrier', text: (k) => `6% of hits fire a missile at another thug (${100 * k}% damage)`, on: 'hit', chance: 0.06, icd: 0.05, fn: P.bolt(1) },
  black_hole: { name: 'Event Horizon', text: (k) => `Kills inside it spaghettify, blasting for ${30 * k}% damage`, on: 'kill', icd: 0.1, fn: P.blast(0.3, 2) },
  death_ray: { name: 'Ion Cannon', text: (k) => `Kills leave molten ground (${40 * k}% damage per second, 3s)`, on: 'kill', icd: 0.1, fn: P.burn(0.4, 2, 3) },
  force_field: { name: 'Permafrost', text: () => 'Thugs it hits are chilled 40% for 2s', on: 'hit', icd: 0, fn: P.slow(0.4, 2) },
  grand_experiment: { name: 'Peer Review', text: () => '35% chance to run the experiment again a second later', on: 'fire', chance: 0.35, icd: 1, fn: P.echo(1) },
};

const fmtNum = (v) => (Math.abs(v) < 1 ? +v.toFixed(2) : Math.round(v * 10) / 10);

/** The supercharge bundle of an ability, per copy: [{stat, kind: 'pct'|'add', v, label, up}]. */
function bundle(def) {
  const out = [];
  for (const up of def.upgrades) {
    let v;
    if (up.values) v = up.values[4];
    else v = up.v * (up.stat === 'damage' && up.kind === 'pct' ? DMG_BOOST : BOOST);
    if (!(v > 0)) continue;
    out.push({ stat: up.stat, kind: up.kind, v, up });
  }
  return out;
}

function bundleText(b, k) {
  return b.map(({ up, kind, v }) => {
    const g = v * k;
    if (up.fmt) return up.fmt(g);
    return kind === 'pct' ? `+${Math.round(g)}% ${up.label}` : `+${fmtNum(g)} ${up.label}`;
  }).join(', ');
}

export const CONTRA_BY_ID = new Map();

/** Contraband defs for a hero (one per ability). */
export function buildContraband(hero) {
  return hero.abilities.map((def) => {
    const t = T[def.id] ?? { name: `Supercharged ${def.name}`, text: () => '' };
    const b = bundle(def);
    const c = {
      id: `cb_${def.id}`, slot: 'stash', contra: true, ability: def.id, name: t.name, icon: def.icon, v: 1,
      needsLabel: def.name,
      desc: (k) => `<b>${def.name}:</b> ${bundleText(b, k)}${t.text(k) ? `. <b>${t.text(k)}.</b>` : ''}`,
      short: (k) => `${def.name.toUpperCase()} ×${Math.round(k)}`,
      affects: (a) => a.def.id === def.id,
      abil: (k, a, stat) => {
        if (a.def.id !== def.id) return null;
        let inc = 0, add = 0;
        for (const x of b) if (x.stat === stat) { if (x.kind === 'pct') inc += (x.v * k) / 100; else add += x.v * k; }
        if (t.extra?.[stat]) add += t.extra[stat] * k;
        return inc || add ? [inc, add] : null;
      },
      twist: t.on ? { on: t.on, chance: t.chance ?? 1, icd: t.icd ?? 0.2, fn: t.fn } : null,
    };
    CONTRA_BY_ID.set(c.id, c);
    return c;
  });
}
