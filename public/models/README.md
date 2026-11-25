# Replacing procedural models with Blender models

Every model in Thugrats is generated in code, but any of them can be swapped for a
`.glb` exported from Blender **without touching game code**. Drop the file in this
folder and list it in `manifest.json`:

```json
{
  "heroes": { "lenny": "lenny.glb" },
  "mobs":   { "mallcop": "mallcop.glb", "commissioner": "commissioner.glb" },
  "props":  { "car": "sedan.glb" }
}
```

Ids are the same ones the code uses: hero ids in `src/heroes/index.js`, mob/boss
model ids in `src/assets/mobModels.js`, prop ids registered with `registerProp`.
Anything not listed (or that fails to load) falls back to the procedural model.

## Conventions

- **Units:** 1 Blender unit = 1 game metre. Babies are ~1.15 m tall, grown-ups ~1.8 m.
- **Origin** at the feet, model **facing +Z** (glTF forward). Blender's glTF
  exporter with "+Y Up" handles the axis swap.
- **Heroes** keep their full node hierarchy and are animated one of two ways:
  - **Clips** named `Idle`, `Run`, `Shoot`, `Die` (case-insensitive) are played
    and cross-faded automatically.
  - **No clips:** name the bones/empties like the procedural rig and the game
    animates them: `hips`, `torso`, `head`, `hat`, `armL`, `armR`, `legL`, `legR`.
  - Put an empty named `muzzle` where bullets should come out, and (optionally)
    one named `cigarTip` for the smoke puffs.
- **Mobs and props** are drawn with GPU instancing, so all meshes in the file are
  merged into one geometry. Use **vertex colours** or plain material base colours
  (textures are ignored). Mobs are animated by whole-body transforms (bob, waddle,
  lunge), so keep them as a single rigid shape.

## Getting a starting file

In the browser console on the running game:

```js
thugrats.exportGLB('lenny')
```

downloads the procedural Lenny as `lenny.glb`, with all rig nodes named, ready to
import into Blender and remodel.
