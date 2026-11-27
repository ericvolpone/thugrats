# Thugrats

A browser roguelite auto-shooter (Megabonk / Azeroth Survivors style) where every
hero is a baby with a criminal trope. Six playable heroes: **Lenny "Nickles"** (mobster,
guns), **Tiny Tony Two-Fists** (brute, melee/tank), **Boom-Boom Bianchi** (demolitions),
**Lucy "The Ghost"** (spy, crits/control), **Babyface Moretti** (hitman, sniper) and
**Professor Pudding** (mastermind, gadgets/summons). Each has 12-13 abilities, three
8-row talent trees and five 5-piece gear sets (one per map).

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
cars, dumpsters, crates, benches and slot machines, but it's not a safe spot: thugs hop
up after you (anything up to 1.8 m; small critters a bit less). Buildings and shipping
containers are too tall for anyone. Buildings and walls between the camera and your
hero are cut away with a dithered see-through hole, so they never hide the fight.

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
- **Cards** show the ability's kind (GUN · PROJECTILE, MELEE · AURA...) in the top
  left, so you can see what talents and Contraband boost it. A card that would max
  an upgrade or item gets a glowing **MAXED OUT** border.
- **Hover** any ability or item (HUD or pause screen) for everything about it: stats,
  every upgrade with its current total and cap, and what maxes it. Hovering an item,
  Contraband or upgrade card also glows the abilities it affects.
- **Desktop HUD:** abilities sit in columns with their modifiers listed under the icon,
  items run down the left side, and a live damage meter in the bottom right shows
  each source's total (since the last reset) and its DPS over the last 30 seconds.
- **Banish:** 3 per run, shared between abilities and items. Banishing rerolls the
  cards for free.
- **Caps:** chance-based items stop at 100% (dodge at 60%) and luck at 150. A maxed
  item is retired from offers for free, without using a banish.
- **Lifesteal** comes from some talents (Frenzy, melee, crits, drones) and the Blood
  Money reputation; it heals at most 6% of max HP per second.
- **Items (7 slots):** 2 Rings, 1 Crime Title, 2 Reputations from loot, plus 2
  Contraband. On desktop they're listed down the left side with a short readout
  (`+72 LCK`, `+25% GUN RECHARGE / +1 GUN PIERCE`).
  - **Chests** show up every ~45s and from elites (25%). They all cost gold: the price
    floats over them, rises gently each time, and the 📦 chip next to your gold shows
    it (green border: you can afford one, red: you can't). Unopened chests vanish after
    90s (the last 15s count down and blink).
  - Boss kills give a guaranteed loot pick. Picking an item you own levels it up.
    Reputations are always in the pool.
- **Contraband & the Black Market:** each map has a shady stall near the start ($ on
  the minimap). Killing a Crime Titan completes a contract (📜); bring it to the stall
  and pick one of two random Contraband. Contraband has its own red rarity and stacks
  linearly: getting one you already own doubles its effect (×3 triples it...). Contraband changes how one kind of ability plays (Drum
  Magazine for guns, Det Cord for explosives, Lead Pipe for melee, Spinning Top for
  auras, Bear Trap Spool, Rolodex, Sugar Cube, Chalk Outline, Nitro Can, Car Battery,
  Toe Tag, Hollow Tips, Grandpa's Grappa) and only shows up for kinds you own.
- **Magnets** pull every gem and coin on the map to you. Every boss drops one, elites
  drop one 5% of the time and any thug about 1 in 800. Biscuit fetches magnets first.
- **Bosses** spawn every 2:30 at a pad shown on the minimap (30 s warning) and
  give a full level plus a guaranteed loot pick.
- **Crime Titans (3 per map)** are summoned by standing in their altar's beam once their
  conditions are met (reach level X, bribe N gold, kill bosses, kill the other
  titans). Killing the **final Crime Titan** clears the map (the clear is banked on
  the spot).
- **Evac:** after the clear an evac chopper lands somewhere on the map (H on the
  minimap). Stand on its pad for 2 s to get out with **+25% hero XP and Rep**, or stay
  and see how far into the Feds you can last: overtime still earns XP and Rep, but
  dying (or quitting) forfeits the evac bonus. The clear and its gear are kept either way.
- At **12:00 the Feds arrive**: everything gets nastier every second.
- **Rep (account-wide):** every run earns Rep (time survived, bosses, titans, clears,
  difficulty). Spend it in the hideout's **Rep** tab: adopt **Biscuit the Bulldog**,
  who ignores walls and fetches magnets, gems and gold far outside your pickup range (upgrade his leash and
  speed), and buy up to +50% run XP, +50% run gold and +20% move speed.
- **After the run:** hero XP → hero levels → talent points (one per level, 49 at
  level 50).
- **Ascension:** heroes cap at level 50. At 50 the hideout offers **Ascend**: back to
  level 1 with every talent kept, ✦ ascension level +1 and **+5 gear upgrade tokens**,
  and from then on you pick your **starting ability** in the Play tab. Levels after an
  ascension cost 40% of the first climb (`ASC_XP_MULT` in `src/save.js`). Overclocking
  is planned for ascension levels.
- **Talents:** 3 trees × 8 rows, about 93 ranks per hero, so 49 points means real
  choices. Rows 6–8 are **pairing talents** (🔗): one ability sets off another (Snub-Nose
  hits fire a free Typewriter burst, Pineapples leave Molotov puddles...), so they only
  work in runs where you take both. Procs use the partner's own stats, so leveling the
  pair pays off twice, and their damage shows under the partner in the meter.
- **Gear (per hero):** five slots (Hat, Mittens, Bib, Diaper, Booties). Every hero has
  one 5-piece **set per map**, built around one of their playstyles. A map's Crime
  Titans drop that map's pieces for the hero you're playing: titan 1 has a 25% chance
  at pieces 1–2, titan 2 25% at pieces 3–4, the final titan 35% at piece 5 (always a
  piece you're missing). Each piece gives its slot's stat plus damage to the set's
  focus. Wearing **2, 3 or 5** pieces of a set turns on its bonuses (mix 2 + 3 from two
  sets for both partial bonuses); the 5-piece bonus is a unique mechanic (golden
  bullets, permanent goons...). Upgrade tokens raise a piece Common → Legendary, which
  scales its stats and, through the average rarity of the set, its set bonuses (up to ×2).
  The Gear tab is a grid of sets × slots; the Play tab shows which pieces each map's
  titans still owe you.

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

Mobs walk straight at you, hop low obstacles, and when a wall is in the way (or they
stop making progress) they follow a flow field around buildings and fences
(`src/game/flow.js`: a BFS over 2 m cells from your position).

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

**Talents:** Trigger Man (guns → *Akimbo*, pairs into *Marked for Death*), Demolitions
(explosives → *Explosive Rounds*, pairs into *Powder Keg*), Family Business
(economy/survival → *The Godfather*, pairs into *Family Reunion*).
**Gear sets:** The Don's Finest (Little Italy, Snub-Nose: golden bullets), Longshoreman
(The Docks, explosives leave fire), High Roller (Casino Row, Make It Rain scales with
gold), Tong Enforcer (Chinatown, Tantrum fires a ring of bullets), Carnival Crew (Coney
Island, two permanent goons).

## Code map

```
src/
  main.js              renderer, screen switching, main loop, debug helpers
  assets/              model library (procedural + glTF override), baby rig, mobs, props
  data/                tiers (rarity + diminishing returns), mobs/bosses/titans, maps &
                       difficulties, run items, gear framework (slots, sets, titan drops),
                       account (Rep) upgrades
  heroes/              hero registry, common.js (upgrade builders + cone/line/chain/nova helpers),
                       <hero>/{abilities,talents,gear}.js for lenny, tony, boom, ghost, babyface, prof
                       (gear.js = the hero's 5 map sets)
  game/
    run.js             one run: director, titans, XP/gold, damage pipeline, rewards
    stats.js           loadout (talents + gear, pairing links/amps), per-frame stats, AbilityInst
    mobs.js            instanced mobs, spatial grid, AI (hopping), targeting priorities
    flow.js            flow-field pathing around tall obstacles
    seeThrough.js      dithered cutout for buildings between the camera and the hero
    bossBrain.js       boss/titan mechanics → telegraphs.js (ground warnings)
    combat.js          bullets, lobs, zones, traps, cars, orbits, marks, goons
    world.js           arena drawing + collision helpers; layouts.js = one layout per map
    evac.js            the evac chopper after the final Crime Titan
    runlog.js          playtest recorder (scripts/runs-report.mjs summarises the logs)
    pickups.js, fx.js, player.js, pet.js, upgrades.js (card offers, banish)
  ui/                  home.js (hideout), hud.js (HUD, minimap, cards, end screen)
```

**Adding a hero:** make `src/heroes/<id>/` with abilities/talents/gear in the same
shape as Lenny's and add an entry to `HEROES` with a `look` for `buildBaby` (hats,
glasses, props...). Abilities are small objects with `base` stats, `upgrades`, a
`ready()` targeting check and a `fire()` that calls the run API (`shoot`, `lob`,
`explode`, `zone`, `car`, `orbit`, `mark`, `spawnGoon`, `hit`...).

## Playtest logs

Every run records a JSON log for balancing: each pick with what else was offered
(rarity, roll size, time, level), rerolls and banishes, damage per ability every 10 s,
final ability stats and upgrade history, items, damage taken by source, and how the
run ended (`evac`, `died`, `quit`) plus the build (git hash).

- With `npm run dev`, each log is written to `playtests/runs/` (git-ignored).
- `npm run runs` summarises them: every run, then per hero each ability's average
  damage share, upgrades taken, and **damage share per pick** (high = punching above
  its investment). Filter with `-- --hero babyface`, `--map the_docks`, `--last 10`.
- The browser also keeps the last 40 logs, including runs on the deployed site:
  `thugrats.exportRuns()` downloads them, and `npm run runs -- thugrats-runs-….json`
  reads the download.

## Debug (browser console)

```js
thugrats.play('the_docks', 1, 'ghost')   // start a run (map id, difficulty 0-2, hero id)
thugrats.god()                  // no damage this run
thugrats.xp(200)  thugrats.gold(500)  thugrats.time(120)  thugrats.ability('driveby')
thugrats.heroXp(1000)           // hero levels for talent testing (level 50 → Ascend)
thugrats.clear()                // count the map as cleared and call the evac chopper
thugrats.runs()  thugrats.exportRuns()   // playtest logs kept in this browser
thugrats.exportGLB('lenny')     // download a model for Blender
thugrats.Save.wipe()            // reset progress
```
