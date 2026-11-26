# Thugrats

A browser roguelite auto-shooter (Megabonk / Azeroth Survivors style) where every
hero is a baby with a criminal trope. Six playable heroes: **Lenny "Nickles"** (mobster,
guns), **Tiny Tony Two-Fists** (brute, melee/tank), **Boom-Boom Bianchi** (demolitions),
**Lucy "The Ghost"** (spy, crits/control), **Babyface Moretti** (hitman, sniper) and
**Professor Pudding** (mastermind, gadgets/summons). Each has 12-13 abilities, three
talent trees and three signature gear pieces.

Three.js (WebGL 2) + Vite. All art is procedural low-poly geometry, swappable for
Blender `.glb` files at runtime (see [public/models/README.md](public/models/README.md)).
Works on desktop and phones (portrait or landscape).

## Run

```bash
npm install
npm run dev
```

Abilities fire on their own; you move, turn the camera and jump.

| | Keyboard / mouse | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | WASD / arrows | left stick | drag on the left part of the screen |
| Turn camera | Q / E, or drag the mouse | right stick | drag on the right part |
| Jump | Space | A | JUMP button |
| Menus & cards | click, 1/2/3, R reroll, B banish | D-pad/stick + A, X reroll, Y banish, B back, LB/RB tabs | tap |
| Pause | Esc / P | Start | ❚❚ |

Jumping clears ground telegraphs and enemy shots if timed right, and lands you on
cars, dumpsters, crates, benches and slot machines. Rats and dogs can't reach you up
there; grown-ups and birds still can. Buildings and shipping containers are too tall.

## The loop

- **Hideout (home screen):** your crew (Lenny + locked teasers), hero level and XP,
  and tabs for **Play** (maps × difficulty), **Talents**, **Gear** and **Kit**.
- **A run:** start with one ability. Mobs pour in from every side and walk at you.
  Kills drop XP gems and gold. Each level gives +3 max HP, +1% damage, +1 luck and
  three cards, each about a **different** ability: a new one (up to 5) or an upgrade
  to one you own. Cards ignore input for 1 s after they pop up, so a stray click or
  jump mid-fight can't take one.
- **Rarity:** grey → green → blue → purple → orange (roll sizes ×1, 1.5, 2.2, 3, 4).
  **Luck** pushes rolls up. Every roll of a stat shrinks the more of it you already
  have, so an early purple is worth far more than a fifth grey. Whole-number upgrades
  (extra bullet, pierce, extra car...) are flat and only appear at higher tiers.
  Upgrades that no longer help (e.g. Frenzy recharge once it's up 100% of the time)
  stop being offered. "Recharge Rate" is how fast abilities come back.
- **Abilities that want a crowd** (The Big One, Ground Pound...) lower their demand
  the longer they've been ready, so they never sit idle.
- **Auras** (Make It Rain, Spinning Lariat, Shuriken Ring, Drone Swarm) are always
  on: no cooldown or duration, only damage, radius and how many things orbit.
- **Dashes** are done by a shadow copy of your hero; you never lose control.
- **Banish:** 3 per run, shared between abilities and items. Banishing rerolls the
  cards for free.
- **Caps:** chance-based items stop at 100% (dodge at 60%) and luck at 150. A maxed
  item is retired from offers for free, without using a banish.
- **Lifesteal** comes from some talents (Frenzy, melee, crits, drones) and the Blood
  Money reputation; it heals at most 6% of max HP per second.
- **Items (7 slots):** 2 Rings, 1 Crime Title, 2 Reputations, 2 Contraband, from
  chests (cost gold, rising each time), elites (25% free chest) and boss kills.
  Picking one you own levels it up. Reputations are always in the pool.
  **Contraband** changes how one kind of ability plays (Drum Magazine for guns, Det
  Cord for explosives, Lead Pipe for melee, Spinning Top for auras, Bear Trap Spool,
  Rolodex, Sugar Cube, Chalk Outline, Nitro Can, Car Battery, Toe Tag, Hollow Tips,
  Grandpa's Grappa) and is only offered once you own an ability of that kind.
- **Bosses** spawn every 2:30 at a pad shown on the minimap (30 s warning) and
  give a full level plus a guaranteed loot pick.
- **Titans (3 per map)** are summoned by standing in their altar's beam once their
  conditions are met (reach level X, bribe N gold, kill bosses, kill the other
  titans). Killing the **final titan** clears the map.
- At **12:00 the Feds arrive**: everything gets nastier every second.
- **Rep (account-wide):** every run earns Rep (time survived, bosses, titans, clears,
  difficulty). Spend it in the hideout's **Rep** tab: adopt **Biscuit the Bulldog**,
  who fetches gems and gold far outside your pickup range (upgrade his leash and
  speed), and buy up to +50% run XP, +50% run gold and +20% move speed.
- **After the run:** hero XP → hero levels → talent points.
- **Gear (per hero):** three slots (Head, Chest, Feet), one piece worn in each, three
  options per slot: the hero's signature piece for that slot (clearing a map gives
  it, one tier up per clear) and two shared pieces that drop at random from runs of
  3+ minutes and clears (new, or one tier up). Tiers are capped by difficulty
  (Normal: green, Hard: purple, Nightmare: orange).

## Maps

160 × 160 arenas, each laid out by hand in `src/game/layouts.js`. The minimap is
north-up; your arrow points where you're walking and the faint wedge is the camera.
Elites have a crimson ring (crimson diamonds on the minimap); chests are gold boxes.

- **Little Italy:** a piazza with a fountain and café tables, rowhouse alleys under
  string lights, a church, a market street, curbside parking.
- **The Docks:** warehouses, a container maze (some stacked too high to jump), gantry
  cranes on the quay, piers out into the bay (the Admiral waits on one), fuel tanks
  and a fish market.
- **Casino Row:** the Strip with palm medians, neon casinos and valet lines, a fountain
  show, an open-air casino floor, a parking lot full of jumpable cars, a wedding
  chapel and giant dice.
- **Chinatown** (after Little Italy): a lantern avenue under two paifang gates, a
  night market, a temple garden with a pagoda and koi pond, tight shophouse alleys.
- **Coney Island** (after The Docks): roller coaster, Ferris wheel, carousel, bumper
  cars, the boardwalk with game booths, the beach and a pier.
  New maps have no signature gear yet, so a clear always drops a random piece.

Mobs steer around walls instead of piling up behind them.

## Lenny's kit (other heroes: `src/heroes/<id>/`)

| Ability | What it does |
| --- | --- |
| 🔫 Snub-Nose .38 (start) | Shoots the toughest thug in range |
| 😤 Frenzy | Fire-rate buff; all other cooldowns tick faster while it lasts |
| 💥 Hollow Point | Huge piercing slug at the biggest target |
| 🍍 Pineapple | Grenade into the densest crowd |
| 🎻 Chicago Typewriter | Tommy-gun cone burst |
| 🍾 Molotov | Burning puddle |
| 🪣 Cement Shoes | Roots, then slows an area |
| 🚗 Drive-By | Cousin Sal's sedan ploughs through a crowd |
| 🧨 Dynamite Trap | Proximity mines dropped at your feet |
| 😭 Tantrum | Point-blank shockwave + knockback |
| 🏏 Hired Goon | A bat-wielding cousin fights for a while |
| 💸 Make It Rain | Always-on aura of orbiting cash |
| 📜 Hit Contract | Marks the biggest target; a sniper collects |

**Talents:** Trigger Man (guns → *Akimbo*), Demolitions (explosives → *Explosive
Rounds*), Family Business (economy/survival → *The Godfather* bodyguard).
**Gear:** The Don's Fedora (Little Italy), Lead-Lined Bib (The Docks), Loaded
Booties (Casino Row).

## Code map

```
src/
  main.js              renderer, screen switching, main loop, debug helpers
  assets/              model library (procedural + glTF override), baby rig, mobs, props
  data/                tiers (rarity + diminishing returns), mobs/bosses/titans, maps &
                       difficulties, run items, shared gear, account (Rep) upgrades
  heroes/              hero registry, common.js (upgrade builders + cone/line/chain/nova helpers),
                       <hero>/{abilities,talents,gear}.js for lenny, tony, boom, ghost, babyface, prof
  game/
    run.js             one run: director, titans, XP/gold, damage pipeline, rewards
    stats.js           loadout (talents + gear), per-frame stats, AbilityInst
    mobs.js            instanced mobs, spatial grid, AI, targeting priorities
    bossBrain.js       boss/titan mechanics → telegraphs.js (ground warnings)
    combat.js          bullets, lobs, zones, traps, cars, orbits, marks, goons
    world.js           arena drawing + collision helpers; layouts.js = one layout per map
    pickups.js, fx.js, player.js, pet.js, upgrades.js (card offers, banish)
  ui/                  home.js (hideout), hud.js (HUD, minimap, cards, end screen)
```

**Adding a hero:** make `src/heroes/<id>/` with abilities/talents/gear in the same
shape as Lenny's and add an entry to `HEROES` with a `look` for `buildBaby` (hats,
glasses, props...). Abilities are small objects with `base` stats, `upgrades`, a
`ready()` targeting check and a `fire()` that calls the run API (`shoot`, `lob`,
`explode`, `zone`, `car`, `orbit`, `mark`, `spawnGoon`, `hit`...).

## Debug (browser console)

```js
thugrats.play('the_docks', 1, 'ghost')   // start a run (map id, difficulty 0-2, hero id)
thugrats.god()                  // no damage this run
thugrats.xp(200)  thugrats.gold(500)  thugrats.time(120)  thugrats.ability('driveby')
thugrats.heroXp(1000)           // hero levels for talent testing
thugrats.exportGLB('lenny')     // download a model for Blender
thugrats.Save.wipe()            // reset progress
```
