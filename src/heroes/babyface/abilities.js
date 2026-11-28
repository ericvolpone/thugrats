import { sfx } from '../../audio.js';
import { rand } from '../../util.js';
import { pctUp, scUp, addUp, DMG, CD, AREA, DUR, permanentUptime, angleTo, nova, buff, addStatus, statusN, tint } from '../common.js';

/**
 * Babyface Moretti — the Professional. Few, huge, guaranteed hits.
 *
 * Meter: FOCUS (run.res, see BABYFACE_RESOURCE). It builds while he goes a
 * moment without getting hurt (full in ~40s) and a hit knocks some off. Nothing
 * spends it: held Focus adds crit chance to precision shots, and at FOCUSED_AT+
 * every FOCUS_EVERY-th Sniper Rifle volley (and every Silver Bullet) is a
 * Focused shot: guaranteed crit, +50% damage, heavier round.
 *
 * Signature: DEADEYE (BABYFACE_SIGNATURE) at full Focus: 4s of rapid Sniper
 * Rifle fire at the toughest thugs, every shot a crit that Spots its target.
 *
 * Weak spots: precision shots (abilities with `precision: true`) deal +15% to
 * elites, bosses and titans, and Spotter marks thugs 'weak' (status) so they
 * take more precision damage and much bigger crits.
 *
 * Precision abilities carry a small base `crit` so run.hit reads ability.stat('crit')
 * (it ignores a base crit of 0); precisionHit() raises it briefly for forced crits.
 */

export const BABYFACE_START = 'rifle';

export const FOCUSED_AT = 40; // Focus needed for Focused shots (nothing is spent)
const FOCUS_EVERY = 3; // every Nth Sniper Rifle volley is Focused (at FOCUSED_AT+)
const FOCUS_RATE = 2.5; // Focus per second while calm: empty → full in ~40s
const CALM_DELAY = 1.5; // seconds unhurt before Focus builds
const FLINCH = 10; // Focus lost when hurt
const DEADEYE_DUR = 4; // seconds of Deadeye
const DEADEYE_GAP = 0.25; // seconds between Deadeye shots
const FOCUS_DMG = 0.5; // Focused shot bonus damage
const BIG_WEAK = 0.15; // precision bonus vs elites / bosses / titans
const SPOT_CRIT = 0.5; // extra crit damage on spotted thugs (precision hits)
const SPOT_DMG = 0.25; // default spotted bonus if Spotter isn't owned (talent spots)

export const BABYFACE_RESOURCE = {
  id: 'focus', name: 'Focus', icon: '🎯', color: '#ffd23f', max: 100, start: 40,
  desc: `Fills while you avoid getting hurt: after ${CALM_DELAY}s without a hit it climbs steadily (empty to full in about ${Math.round(100 / FOCUS_RATE)}s, 50% faster while a Body Double is out). Each hit you take knocks off ${FLINCH}. Nothing spends it.\n`
    + '• Held Focus: precision shots get extra crit chance (up to +25% when full).\n'
    + `• ${FOCUSED_AT}+ Focus: every ${FOCUS_EVERY}rd Sniper Rifle shot and every Silver Bullet is a Focused shot (guaranteed crit, +${FOCUS_DMG * 100}% damage).\n`
    + '• Full Focus: DEADEYE.',
  /** What Focus is doing for you right now (HUD, next to the meter). */
  bonus(run) {
    if (run.buffs.deadeye) return 'Deadeye: every shot crits';
    const crit = `+${Math.round(heldCrit(run) * 100)}% crit`;
    if (!run.abilityById('rifle') && !run.abilityById('silver_bullet')) return crit;
    if (focusOf(run) < FOCUSED_AT) return `${crit} · Focused shots at ${FOCUSED_AT}`;
    const left = focusEvery(run) - 1 - (run.res.charge ?? 0);
    return run.buffs.focus?.freeFocus || left <= 0 || !run.abilityById('rifle') ? `${crit} · Focused shot ready` : `${crit} · Focused in ${left}`;
  },
  tick(run, dt) {
    const r = run.res, f = run.flags, p = run.player;
    if (!r.init) {
      r.init = true;
      r.calm = 0;
      r.lastHurtT = 0;
      if (f.focusStart) r.value = r.max;
    }
    // run.hurtPlayer sets player.hurtT = 1 and it only fades after that, so any rise means a hit landed
    const h = p.hurtT ?? 0;
    if (h > 0.5 && h >= r.lastHurtT) {
      r.calm = 0;
      if (!(r.guardUntil > run.time)) r.value = Math.max(0, r.value - FLINCH * Math.max(0, 1 - (f.steadyNerves ?? 0)));
    }
    r.lastHurtT = h;
    r.calm += dt;
    if (r.calm < CALM_DELAY) return;
    let rate = FOCUS_RATE * (1 + (f.focusRate ?? 0));
    if (run.combat?.goons?.some((g) => g.ability?.def?.id === 'body_double')) rate *= 1.5;
    r.value = Math.min(r.max, r.value + rate * dt);
  },
};

// ── Focus helpers ────────────────────────────────────────────────────────────

const isFocus = (run) => run.res?.id === 'focus';
/** Focus held right now (0 without the meter). */
export const focusOf = (run) => (isFocus(run) ? run.res.value : 0);
/** Add Focus (no-op without the meter). */
export const gainFocus = (run, n) => { if (isFocus(run)) run.gainRes(n); };
/** Crit chance held Focus gives precision shots: Focus / 4 %, so +25% when full. */
const heldCrit = (run) => (focusOf(run) / 400) * (1 + (run.flags.heldCrit ?? 0));
/** Every how many rifle volleys a Focused shot comes (Patience: every 2nd). */
const focusEvery = (run) => Math.max(1, FOCUS_EVERY - (run.flags.focusEveryLess ?? 0));
/** Silver Bullet: Focused at FOCUSED_AT+ Focus (always while Deep Breath is up). Spends nothing. */
const silverFocused = (run) => isFocus(run) && (!!run.buffs.focus?.freeFocus || focusOf(run) >= FOCUSED_AT);
/**
 * Sniper Rifle: is this volley Focused? Counts volleys (run.res.charge); every
 * focusEvery-th one is Focused at FOCUSED_AT+ Focus. If Focus is low when it comes
 * up, the charge waits and the first volley after reaching FOCUSED_AT is Focused.
 * Every volley is Focused while Deep Breath is up. Spends nothing.
 */
function rifleFocused(run) {
  if (!isFocus(run)) return false;
  const r = run.res, n = focusEvery(run);
  if (run.buffs.focus?.freeFocus) return true;
  if ((r.charge ?? 0) >= n - 1 && r.value >= FOCUSED_AT) { r.charge = 0; return true; }
  r.charge = Math.min(n - 1, (r.charge ?? 0) + 1);
  return false;
}

// ── weak spots ──────────────────────────────────────────────────────────────

/** Is this thug Spotted (weak spot showing)? */
export const spotted = (run, m) => statusN(run, m, 'weak') > 0;
/** Spotted damage bonus for precision shots: Spotter's power, or the default. */
const spotPower = (run) => (run.abilityById('spotter')?.stat('power') ?? SPOT_DMG) + (run.flags.spotDmg ?? 0);

/** Spot a thug for `dur` seconds (big thugs 50% longer). Exposed on Spotter's def as `spot`. */
export function spot(run, a, m, dur = a?.stat?.('duration') ?? 5) {
  if (!m || m.dead) return;
  const d = dur * (m.tier >= 1 ? 1.5 : 1);
  addStatus(run, m, 'weak', 1, d, 1);
  tint(run, m, '#ff3030', d);
  run.fx.burst(m.x, m.height * 0.8, m.z, '#ff3030', 6, 2.5, 0.35, 0.8);
}

/** Who did the last precision shot hit (for Double Tap)? */
const LAST = new WeakMap();
const setLast = (run, m) => { if (m && !m.dead) LAST.set(run, { m, t: run.time }); };
const lastTarget = (run) => {
  const l = LAST.get(run);
  return l && !l.m.dead && run.time - l.t < 2.5 ? l.m : null;
};

/**
 * A precision hit: weak-spot bonuses, held-Focus crit chance, Focused shots.
 * o.focused = Focused shot (guaranteed crit, +50% damage); o.forceCrit = crit
 * without the bonus; o.noCrit as usual; other fields go to run.hit.
 */
export function precisionHit(run, m, dmg, a, o = {}) {
  if (!m || m.dead || dmg <= 0) return false;
  const { focused = false, forceCrit = focused, ...ho } = o;
  const f = run.flags, s = run.stats, weak = spotted(run, m);
  let mult = 1;
  if (m.tier >= 1) mult += BIG_WEAK + (f.bigWeak ?? 0);
  if (weak) mult += spotPower(run);
  if (focused) mult += FOCUS_DMG + (f.focusDmg ?? 0);
  // ability-scoped crit (run.hit reads ability.stat('crit') when base.crit is set)
  const add = a.add, c0 = add.crit, cd0 = s.critDmg;
  if (a.def.base.crit) add.crit = (c0 ?? 0) + (forceCrit ? 1 : heldCrit(run));
  if (weak) s.critDmg += SPOT_CRIT + (f.spotCrit ?? 0);
  try {
    run.hit(m, dmg * mult, a, ho);
  } finally {
    if (c0 === undefined) delete add.crit; else add.crit = c0;
    s.critDmg = cd0;
  }
  setLast(run, m);
  if (focused) run.fx.burst(m.x, m.height * 0.8, m.z, '#ffd23f', 8, 4, 0.4, 1);
  return true;
}

// ── Sniper Rifle ────────────────────────────────────────────────────────────

/** Is this thug on the Hit List right now? (only tracked when run.flags.listMark is on) */
export const listed = (run, m) => m.listedUntil > run.time;

/**
 * One rifle round. The bullet itself does no damage (dmg 0 makes the engine's hit a
 * no-op); onHit does a precision hit so weak spots, Focus and ramps apply.
 */
function rifleShot(run, a, t, focused = false, deadeye = false) {
  const m = run.player.muzzlePos(), f = run.flags;
  // Held Breath: pierce everything while Deep Breath is up. Focused shots punch through 2 more.
  const pierce = f.breathPierce && run.buffs.focus ? 99 : a.stat('pierce') + (focused ? 2 : 0);
  // Wiseguy (3): each thug hit makes the rest of the shot hit harder · One Shot One Kill: execute
  const ramp = f.pierceRamp ?? 0, exec = f.oneShot ?? 0;
  const base = a.stat('damage');
  const gold = focused || deadeye;
  let d = base, hits = 0;
  run.shoot({ x: m.x, z: m.z, y: m.y, angle: Math.atan2(t.x - m.x, t.z - m.z), speed: deadeye ? 130 : focused ? 95 : 70, dmg: 0, range: a.stat('range') * 1.3,
    pierce, size: gold ? 2.1 : 1.4, color: gold ? '#ffd23f' : '#fff2c0', ability: a, knock: 0, bounce: f.rifleRicochet ?? 0,
    onHit: (mob, b) => {
      if (mob.dead) return;
      // Deadeye: every hit of the shot is a guaranteed crit
      precisionHit(run, mob, d, a, { focused, forceCrit: focused || deadeye, knock: focused ? 5 : 3, fromX: b.x - b.vx, fromZ: b.z - b.vz });
      if (exec && !mob.dead && mob.tier < 3 && mob.hp / mob.maxHp < (mob.tier >= 2 ? exec / 2 : exec)) {
        run.hit(mob, mob.hp + 1, a, { noCrit: true, color: '#ff3030' });
        gainFocus(run, f.execFocus ?? 0);
      }
      // additive per thug hit, capped at +100% (multiplying ran away with pierce-everything)
      if (ramp) d = base * (1 + Math.min(1, ramp * ++hits));
    } });
}

// ── Body Double ─────────────────────────────────────────────────────────────

/** Hire one lookalike for `life` seconds. Exposed on Body Double's def as `callIn`. */
function callIn(run, a, life = a.stat('duration')) {
  return run.spawnGoon({ ability: a, life, model: 'babyface_double', reach: 8, seek: 14, rate: 0.6,
    onAttack: (g, t, dmg) => !t.dead && run.shoot({ x: g.x, z: g.z, y: 0.7, angle: Math.atan2(t.x - g.x, t.z - g.z), speed: 40, dmg, range: 12, ability: a, color: '#fff2c0' }) });
}

export const BABYFACE_ABILITIES = [
  {
    id: 'rifle', name: 'Sniper Rifle', icon: '🔭', tags: ['gun', 'projectile'], precision: true,
    desc: `One huge shot at the toughest thug in sight, punching through the ones in front. At ${FOCUSED_AT}+ Focus every ${FOCUS_EVERY}rd shot is a Focused shot: guaranteed crit, +50% damage, a heavier round.`,
    base: { damage: 62, cooldown: 1.5, range: 22, pierce: 2, count: 1, crit: 0.05 },
    upgrades: [DMG, pctUp('cooldown', 'Fire Rate', 12), addUp('pierce', 'Pierce', [0, 1, 1, 2, 2], null, 8), addUp('count', 'Extra Shot', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => {
      const n = a.stat('count'), r = a.stat('range');
      const ts = run.mobs.targets(run.player.x, run.player.z, r, n, 'strongest');
      // Lock On: Hit List targets first, from a little farther away
      if (run.flags.listLock) {
        const hl = run.mobs.targets(run.player.x, run.player.z, r * 1.25, 60, 'strongest').filter((m) => listed(run, m));
        if (hl.length) return [...hl, ...ts.filter((m) => !hl.includes(m))].slice(0, n);
      }
      return ts;
    },
    fire(run, a, ts) {
      const n = a.stat('count');
      const focused = rifleFocused(run); // one Focused round per volley: the first
      for (let i = 0; i < n; i++) run.later(i * 0.12, () => { const t = ts[i % ts.length]; if (!t.dead) rifleShot(run, a, t, focused && i === 0); });
      setLast(run, ts[0]);
      run.player.aim(ts[0].x, ts[0].z, 0.4);
      run.shake(focused ? 0.16 : 0.08);
      sfx(focused ? 'bigshot' : 'snipe', 0.05);
    },
  },
  {
    id: 'double_tap', name: 'Double Tap', icon: '✌️', tags: ['gun'], precision: true,
    desc: 'Two quick shots into the same thug: the last one your precision shots hit, if it\'s still standing. Both shots share one crit roll.',
    base: { damage: 34, cooldown: 3, range: 18, crit: 0.05 },
    upgrades: [DMG, CD, pctUp('range', 'Range', 15)],
    ready: (run, a) => {
      const p = run.player, r = a.stat('range');
      const l = lastTarget(run);
      if (l && (l.x - p.x) ** 2 + (l.z - p.z) ** 2 < r * r) return l;
      // Cleanup Crew (3): spotted thugs next
      if (run.flags.tapSpotted) {
        const s = run.mobs.targets(p.x, p.z, r, 30, 'strongest').find((m) => spotted(run, m));
        if (s) return s;
      }
      return run.mobs.target(p.x, p.z, r, 'strongest');
    },
    fire(run, a, t) {
      const f = run.flags, shots = f.tapThird ? 3 : 2;
      // one crit roll for the whole tap
      const crit = Math.random() < Math.min(1, run.stats.crit + a.stat('crit') + heldCrit(run));
      for (let i = 0; i < shots; i++) run.later(i * 0.13, () => {
        if (t.dead) return;
        const m = run.player.muzzlePos();
        run.fx.beam(m.x, m.z, t.x, t.z, crit ? '#ffd23f' : '#fff2c0', 0.08, 0.12, m.y);
        const weak = spotted(run, t);
        precisionHit(run, t, a.stat('damage'), a, crit ? { forceCrit: true, knock: 1.5 } : { noCrit: true, knock: 1.5 });
        if (weak) gainFocus(run, f.tapFocus ?? 0);
        // Cleanup Crew (5): a kill readies the next Double Tap
        if (t.dead && f.tapReset) a.cd = Math.min(a.cd, 0.5);
        run.player.aim(t.x, t.z, 0.25);
        sfx('shot', 0.03);
      });
    },
  },
  {
    id: 'spotter', name: 'Spotter', icon: '🔍', tags: ['control'], spot, // for talents/sets: p.def.spot(run, p, m, dur?)
    desc: 'Picks out the biggest thugs in sight and finds their weak spots. Spotted thugs take extra damage and +50% crit damage from precision shots. Elites, bosses and titans stay spotted 50% longer.',
    base: { cooldown: 7, range: 24, count: 3, duration: 6, power: 0.25 },
    upgrades: [addUp('count', 'Targets', [1, 1, 1, 2, 2], null, 8), DUR, CD, scUp('power', 'Weak Spot', 0.06, (v) => `+${Math.round(v * 100)}% weak-spot damage`)],
    ready: (run, a) => {
      const all = run.mobs.targets(run.player.x, run.player.z, a.stat('range'), 40, 'strongest');
      const fresh = all.filter((m) => !spotted(run, m));
      return (fresh.length ? fresh : all).slice(0, a.stat('count'));
    },
    fire(run, a, ts) {
      ts.forEach((t, i) => run.mark(t, 0.35 + i * 0.1, () => { if (!t.dead) spot(run, a, t); }));
      sfx('click', 0.1);
    },
  },
  {
    id: 'silver_bullet', name: 'Silver Bullet', icon: '🥈', tags: ['gun'], precision: true,
    desc: `Saved for special occasions. Massive damage to the single biggest target, +50% vs bosses and titans. Always a Focused shot at ${FOCUSED_AT}+ Focus.`,
    base: { damage: 300, cooldown: 14, range: 24, crit: 0.05 },
    upgrades: [DMG, CD],
    ready: (run, a) => {
      const t = run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'strongest');
      if (t && t.tier >= 1) return t;
      // Dealer (5): Silver Bullet will also take a Hit List name of any size
      if (run.flags.silverListed) return run.mobs.targets(run.player.x, run.player.z, a.stat('range'), 60, 'strongest').find((m) => listed(run, m)) ?? null;
      return null;
    },
    fire(run, a, t) {
      const m = run.player.muzzlePos(), focused = silverFocused(run);
      run.fx.beam(m.x, m.z, t.x, t.z, focused ? '#ffd23f' : '#e6ecff', focused ? 0.26 : 0.18, 0.35, 0.9);
      precisionHit(run, t, a.stat('damage') * (t.tier >= 2 ? 1.5 : 1), a, { focused, knock: 4 });
      run.player.aim(t.x, t.z, 0.5);
      run.shake(focused ? 0.3 : 0.2);
      sfx('snipe');
    },
  },
  {
    id: 'hit_list', name: 'Hit List', icon: '📋', tags: ['gun'], precision: true,
    desc: 'Marks several of the biggest thugs. Snipers on the rooftops put a precision round in each.',
    base: { damage: 90, cooldown: 9, range: 26, count: 3, crit: 0.05 },
    upgrades: [DMG, CD, addUp('count', 'Names', [1, 1, 1, 2, 2], null, 10)],
    ready: (run, a) => run.mobs.targets(run.player.x, run.player.z, a.stat('range'), a.stat('count'), 'strongest'),
    fire(run, a, ts) {
      if (run.flags.listMark) for (const t of ts) t.listedUntil = run.time + 8;
      ts.forEach((t, i) => run.mark(t, 0.8 + i * 0.18, () => {
        if (t.dead) return;
        run.fx.tracer(t.x, t.z);
        precisionHit(run, t, a.stat('damage'), a);
        sfx('snipe', 0.05);
      }));
    },
  },
  {
    id: 'focus', name: 'Deep Breath', icon: '🫁', tags: ['buff'],
    desc: 'In, hold, out. +15 Focus, and while it lasts every Sniper Rifle and Silver Bullet shot is Focused and all your abilities recharge faster.',
    base: { cooldown: 16, duration: 5, power: 0.25 },
    upgrades: [DUR, scUp('power', 'Calm', 0.07, (v) => `+${Math.round(v * 100)}% recharge speed`), CD],
    useless: permanentUptime,
    ready: (run, a) => run.crowd(a, 14, 3),
    fire(run, a) {
      gainFocus(run, 15);
      buff(run, a, { fx: '#ffffff', rate: a.stat('power'), freeFocus: true });
      sfx('frenzy', 0.1);
    },
  },
  {
    id: 'ricochet', name: 'Trick Shot', icon: '🎱', tags: ['gun', 'projectile'], precision: true,
    desc: 'A bullet that bounces from thug to thug. Every bounce is a precision hit.',
    base: { damage: 30, cooldown: 2.4, range: 14, count: 1, bounce: 4, crit: 0.05 },
    upgrades: [DMG, addUp('bounce', 'Bounces', [1, 1, 2, 2, 3], null, 14), CD, addUp('count', 'Extra Bullet', [0, 0, 0, 1, 1], null, 3)],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'nearest'),
    fire(run, a, t) {
      const f = run.flags;
      for (let i = 0; i < a.stat('count'); i++) {
        // the bullet deals no damage itself (dmg 0); onHit does a precision hit so bounces can ramp / crit
        const base = a.stat('damage');
        let d = base, hits = 0;
        const onHit = (m, b) => {
          if (m.dead) return;
          // Shooting Gallery (5): every bounce after the first is a guaranteed crit
          precisionHit(run, m, d, a, { knock: 0.8, fromX: b.x - b.vx, fromZ: b.z - b.vz, forceCrit: !!(f.trickCrit && hits > 0) });
          hits++;
          if (f.trickRamp) d = base * (1 + Math.min(1, f.trickRamp * hits)); // additive, capped at +100%
        };
        run.shoot({ x: run.player.x, z: run.player.z, y: 0.7, angle: angleTo(run, t) + i * 0.3, speed: 36, dmg: 0, range: a.stat('range') * 1.2, bounce: a.stat('bounce'), color: '#9affd0', ability: a, onHit });
      }
      sfx('shot', 0.05);
    },
  },
  {
    id: 'sawed_off', name: 'Sawed-Off', icon: '💥', tags: ['gun', 'projectile'],
    desc: 'The panic button. Both barrels into whoever gets too close, with big knockback.',
    base: { damage: 15, cooldown: 2, range: 7, speed: 34, count: 7 },
    upgrades: [DMG, { ...scUp('count', 'Pellets', 2), int: true }, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'nearest'),
    fire(run, a, t) {
      const n = a.stat('count'), f = run.flags;
      const blast = (tt, mult) => {
        const base = angleTo(run, tt);
        for (let i = 0; i < n; i++) run.shoot({ x: run.player.x, z: run.player.z, y: 0.7, angle: base + rand(-0.38, 0.38), speed: a.stat('speed') * rand(0.85, 1.1), dmg: a.stat('damage') * mult, range: a.stat('range') * 1.2, size: 0.8, color: '#ffcf6b', ability: a, knock: 5, pierce: f.closePierce ?? 0 });
      };
      blast(t, 1);
      // Tea House (5): the off-hand barrel at a different thug
      if (f.dualWield) {
        const t2 = run.mobs.targets(run.player.x, run.player.z, a.stat('range') * 1.3, 2, 'nearest').find((m) => m !== t) ?? t;
        run.later(0.08, () => blast(t2.dead ? t : t2, f.dualWield));
      }
      // Breathing Room: clearing space steadies him
      gainFocus(run, f.sawFocus ?? 0);
      run.player.aim(t.x, t.z, 0.3);
      sfx('bigshot', 0.05);
    },
  },
  {
    id: 'uzi', name: 'Uzi', icon: '🔫', tags: ['gun', 'projectile'],
    desc: 'Sprays a burst at the nearest thugs. Not professional, but it works.',
    base: { damage: 8, cooldown: 2.6, range: 12, speed: 42, count: 10 },
    upgrades: [DMG, { ...scUp('count', 'Bullets', 3), int: true }, CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'nearest'),
    fire(run, a) {
      const n = a.stat('count'), f = run.flags;
      for (let i = 0; i < n; i++) run.later(i * 0.04, () => {
        const t = run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'nearest');
        if (!t) return;
        run.shoot({ x: run.player.x, z: run.player.z, y: 0.7, angle: angleTo(run, t) + rand(-0.12, 0.12), speed: a.stat('speed'), dmg: a.stat('damage'), range: a.stat('range') * 1.2, size: 0.7, color: '#ffe38a', ability: a, pierce: f.closePierce ?? 0 });
        sfx('tommy', 0.03);
      });
      // Tea House (5): the off-hand Uzi sprays the second-nearest thug
      if (f.dualWield) for (let i = 0; i < n; i++) run.later(0.02 + i * 0.04, () => {
        const ts = run.mobs.targets(run.player.x, run.player.z, a.stat('range'), 2, 'nearest');
        const t = ts[1] ?? ts[0];
        if (!t) return;
        run.shoot({ x: run.player.x, z: run.player.z, y: 0.7, angle: angleTo(run, t) + rand(-0.12, 0.12), speed: a.stat('speed'), dmg: a.stat('damage') * f.dualWield, range: a.stat('range') * 1.2, size: 0.7, color: '#ffb0d0', ability: a, pierce: f.closePierce ?? 0 });
      });
    },
  },
  {
    id: 'flashbang', name: 'Flashbang', icon: '⚪', tags: ['thrown', 'control'],
    desc: 'Blinds a whole crowd. Everything in the flash is stunned: sitting ducks.',
    base: { damage: 10, cooldown: 9, range: 12, area: 4.2, duration: 1.6 },
    upgrades: [AREA, pctUp('duration', 'Stun', 20), CD],
    ready: (run, a) => run.mobs.target(run.player.x, run.player.z, a.stat('range'), 'cluster'),
    fire(run, a, t) {
      run.lob({ tx: t.x, tz: t.z, dur: 0.5, kind: 'c4', onLand: (x, z) => {
        // Blinding Light: thugs stay blinded a while after the stun wears off
        const blind = run.flags.flashBlind ? (m) => { m.blindUntil = run.time + a.stat('duration') + run.flags.flashBlind; } : undefined;
        nova(run, a, { x, z, r: a.stat('area'), dmg: a.stat('damage'), knock: 0, root: a.stat('duration'), color: '#ffffff', onHit: blind });
        run.fx.explosion(x, z, a.stat('area') * 0.6, '#ffffff');
      } });
    },
  },
  {
    id: 'body_double', name: 'Body Double', icon: '🕴️', tags: ['summon', 'gun'], callIn, // for talents/sets: p.def.callIn(run, p, life?)
    desc: 'Hires a lookalike with a pistol who shoots whatever is nearest. While one is on the clock, Focus builds 50% faster.',
    base: { damage: 18, cooldown: 14, duration: 12, count: 1 },
    upgrades: [DMG, DUR, addUp('count', 'Doubles', [0, 0, 1, 1, 2], null, 4), CD],
    ready: (run) => run.mobs.count(run.player.x, run.player.z, 15) > 0,
    fire(run, a) {
      for (let i = 0; i < a.stat('count'); i++) callIn(run, a);
    },
  },
];

// ── Signature: Deadeye ──────────────────────────────────────────────────────

/** The rifle Deadeye shoots with: his own (upgrades and talents apply), or a stock one if he doesn't carry it. */
function deadeyeGun(run) {
  const own = run.abilityById('rifle');
  if (own) return own;
  if (!run.deadeyeGun) {
    const Inst = run.abilities[0].constructor; // AbilityInst, without importing game/stats.js (it imports heroes/index.js)
    run.deadeyeGun = new Inst(BABYFACE_ABILITIES.find((d) => d.id === 'rifle'), run);
  }
  return run.deadeyeGun;
}
const deadeyeRange = (run) => deadeyeGun(run).stat('range') * 1.25;

/** One Deadeye round: Spot the toughest thug in range, then a gold tracer and a crit rifle shot into it. */
function deadeyeShot(run) {
  const p = run.player;
  if (p.dead || run.ended || run.evacuating) return;
  const a = deadeyeGun(run);
  const t = run.mobs.target(p.x, p.z, deadeyeRange(run), 'strongest');
  if (!t) return;
  spot(run, run.abilityById('spotter'), t);
  const m = p.muzzlePos();
  run.fx.beam(m.x, m.z, t.x, t.z, '#ffd23f', 0.14, 0.18, m.y);
  run.fx.muzzle(m.x, m.y, m.z);
  rifleShot(run, a, t, false, true);
  setLast(run, t);
  p.aim(t.x, t.z, 0.3);
  run.shake(0.06);
  sfx('snipe', 0.03);
}

export const BABYFACE_SIGNATURE = {
  id: 'deadeye', name: 'Deadeye', icon: '👁️',
  short: '4s of rapid crits at the toughest thugs',
  desc: `At full Focus: for ${DEADEYE_DUR}s the Sniper Rifle fires every ${DEADEYE_GAP}s at the toughest thug in range. Every shot is a guaranteed crit and Spots its target's weak spot. Uses your Sniper Rifle's damage and upgrades (a stock rifle if you don't carry one).`,
  /** Full Focus and something worth shooting (so Auto never wastes it on an empty street). */
  ready(run) {
    const r = run.res, p = run.player;
    if (!r || r.value < r.max || run.buffs.deadeye) return false;
    return !!run.mobs.target(p.x, p.z, deadeyeRange(run), 'strongest');
  },
  fire(run) {
    const p = run.player;
    run.buffs.deadeye = { t: DEADEYE_DUR, max: DEADEYE_DUR, src: 'deadeye', fx: '#ffd23f' };
    run.fx.ring(p.x, p.z, 4, '#ffd23f', 0.6);
    for (let i = 1; i < DEADEYE_DUR; i++) run.later(i, () => { if (!p.dead) run.fx.ring(p.x, p.z, 2.5, '#ffd23f', 0.45); });
    const n = Math.round(DEADEYE_DUR / DEADEYE_GAP);
    for (let i = 0; i < n; i++) run.later(0.15 + i * DEADEYE_GAP, () => deadeyeShot(run));
    sfx('bigshot', 0.05);
  },
};

// ── Kit tab (hideout) ───────────────────────────────────────────────────────

export const BABYFACE_OVERVIEW = {
  tagline: 'few shots, all of them crits',
  playstyle: 'Babyface hangs back and lets his guns pick off the biggest thugs in sight. Your job is to keep your distance and not get hit: staying calm fills Focus, which makes his shots crit more and eventually unleashes Deadeye.',
  meter: `Focus fills while you avoid getting hurt: about ${Math.round(100 / FOCUS_RATE)}s from empty to full if nothing touches you. Every hit knocks off ${FLINCH}. The more you hold, the more your precision shots crit (up to +25%). At ${FOCUSED_AT}+ every ${FOCUS_EVERY}rd Sniper Rifle shot and every Silver Bullet is a Focused shot: a guaranteed crit for +50% damage. When it's full, Deadeye fires.`,
  tips: [
    'Keep moving and keep thugs at arm\'s length. Every hit you take costs Focus and restarts the build.',
    'Deadeye aims at the toughest thugs, so it shines against elites, bosses and titans. In Manual mode, save it for them.',
    'Deadeye Spots everything it shoots, so Double Tap and your other precision shots hit those thugs harder afterwards.',
    'Body Double makes Focus build 50% faster while a lookalike is out, and it draws fire away from you.',
  ],
  pairs: [
    { a: 'rifle', b: 'spotter', why: 'Spotted thugs take extra damage and much bigger crits, and the Rifle always crits when Focused.' },
    { a: 'rifle', b: 'double_tap', why: 'Double Tap finishes whatever the Rifle (or Deadeye) just hit.' },
    { a: 'focus', b: 'silver_bullet', why: 'Deep Breath makes every Silver Bullet and Rifle shot Focused, and speeds up their recharge.' },
    { a: 'body_double', b: 'sawed_off', why: 'Lookalikes draw thugs off you and the Sawed-Off shoves away the rest, so Focus keeps building.' },
  ],
};
