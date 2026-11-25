# Thugrats

A browser roguelite auto-shooter (Megabonk / Azeroth Survivors style) where every
hero is a baby with a criminal trope. First playable prototype: **Lenny "Nickles"**,
a diapered mobster with a fedora, a cigar and a snub-nose .38.

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
| Menus & cards | click, 1/2/3, R reroll | D-pad/stick + A, X reroll, B back, LB/RB tabs | tap |
| Pause | Esc / P | Start | ❚❚ |

Jumping clears ground telegraphs and enemy shots if timed right, and lands you on
cars, dumpsters, crates, benches and slot machines. Rats and dogs can't reach you up
there; grown-ups and birds still can. Buildings and shipping containers are too tall.

## The loop

- **Hideout (home screen):** your crew (Lenny + locked teasers), hero level and XP,
  and tabs for **Play** (maps × difficulty), **Talents**, **Gear** and **Kit**.
- **A run:** start with one ability. Mobs pour in from every side and walk at you.
  Kills drop XP gems and gold. Each level gives +3 max HP / +1% damage and three
  cards: a new ability (up to 5) or a rarity-rolled upgrade to one you own.
- **Rarity:** grey → green → blue → purple → orange. **Luck** pushes rolls up.
  Some upgrades (extra bullet, pierce, extra car...) only appear at higher tiers.
- **Items (5 slots):** 2 Rings, 1 Crime Title, 2 Reputations, from chests (cost
  gold, rising each time) and boss kills. Picking one you own levels it up.
  Reputations are always in the pool.
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
- **After the run:** hero XP → hero levels → talent points. Clearing a map gives that
  map's **gear** for the hero, upgraded one tier per clear, capped by difficulty
  (Normal: green, Hard: purple, Nightmare: orange).

## Lenny's kit

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
| 💸 Make It Rain | Orbiting stacks of cash |
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
  data/                tiers, mobs/bosses/titans, maps & difficulties, run items
  heroes/              hero registry; heroes/lenny/{abilities,talents,gear}.js
  game/
    run.js             one run: director, titans, XP/gold, damage pipeline, rewards
    stats.js           loadout (talents + gear), per-frame stats, AbilityInst
    mobs.js            instanced mobs, spatial grid, AI, targeting priorities
    bossBrain.js       boss/titan mechanics → telegraphs.js (ground warnings)
    combat.js          bullets, lobs, zones, traps, cars, orbits, marks, goons
    pickups.js, fx.js, world.js, player.js, upgrades.js (card offers)
  ui/                  home.js (hideout), hud.js (HUD, minimap, cards, end screen)
```

**Adding a hero:** make `src/heroes/<id>/` with abilities/talents/gear in the same
shape as Lenny's, register a model (usually `buildBaby` with a new look) and add an
entry to `HEROES`. Abilities are small objects with `base` stats, `upgrades`, a
`ready()` targeting check and a `fire()` that calls the run API (`shoot`, `lob`,
`explode`, `zone`, `car`, `orbit`, `mark`, `spawnGoon`, `hit`...).

## Debug (browser console)

```js
thugrats.play('the_docks', 1)   // start a run (map id, difficulty 0-2)
thugrats.god()                  // no damage this run
thugrats.xp(200)  thugrats.gold(500)  thugrats.time(120)  thugrats.ability('driveby')
thugrats.heroXp(1000)           // hero levels for talent testing
thugrats.exportGLB('lenny')     // download a model for Blender
thugrats.Save.wipe()            // reset progress
```
