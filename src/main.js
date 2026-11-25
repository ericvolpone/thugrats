import * as THREE from 'three';
import './assets/mobModels.js';
import './assets/props.js';
import { loadManifest, exportHeroGLB } from './assets/models.js';
import { heroById } from './heroes/index.js';
import { mapById } from './data/maps.js';
import { Input } from './input.js';
import { Run } from './game/run.js';
import { Hud } from './ui/hud.js';
import { HomeScreen } from './ui/home.js';
import { PadNav } from './ui/padnav.js';
import { Save } from './save.js';
import { IS_TOUCH, LITE } from './device.js';

document.body.classList.toggle('touch', IS_TOUCH);

const renderer = new THREE.WebGLRenderer({ antialias: !LITE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, LITE ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.domElement.id = 'game';
document.body.prepend(renderer.domElement);

await loadManifest();

const input = new Input();
const fade = document.getElementById('fade');
const fadeTo = (v) => new Promise((r) => { fade.style.opacity = v; setTimeout(r, 360); });
let busy = false;
async function transition(fn) {
  if (busy) return;
  busy = true;
  await fadeTo(1);
  await fn();
  resize();
  await fadeTo(0);
  busy = false;
}

let run = null;
let last = null; // {heroId, mapId, diff}

const hud = new Hud({
  onHome: () => transition(goHome),
  onRetry: () => transition(() => startRun(last.heroId, last.mapId, last.diff)),
});

const home = new HomeScreen({
  onPlay: (heroId, mapId, diff) => transition(() => startRun(heroId, mapId, diff)),
});

function startRun(heroId, mapId, diff) {
  run?.dispose();
  last = { heroId, mapId, diff };
  home.hide();
  run = new Run({ hero: heroById(heroId), map: mapById(mapId), diff, input, ui: hud.api });
  hud.attach(run);
  input.setTouchEnabled(true);
  active = 'run';
  renderer.compile(run.scene, run.camera);
}

function goHome() {
  run?.dispose();
  run = null;
  hud.detach();
  input.setTouchEnabled(false);
  home.show();
  active = 'home';
}

let active = 'home';
home.show();

const padNav = new PadNav({
  input,
  onPause: () => { if (active === 'run' && run && !run.ended && !run.choice) hud.togglePause(); },
  onBack: (layer) => { if (layer === 'pause') hud.togglePause(false); },
});

function resize() {
  if (!innerWidth || !innerHeight) return;
  renderer.setSize(innerWidth, innerHeight);
  const aspect = innerWidth / innerHeight;
  home.resize(aspect);
  run?.resize(aspect);
}
addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 300));
resize();

document.getElementById('loading').remove();
fadeTo(0);

let prev = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  padNav.update(dt, active === 'run');
  if (active === 'run' && run) {
    run.update(busy ? 0 : dt);
    hud.update(dt);
    renderer.render(run.scene, run.camera);
  } else {
    home.update(dt);
    renderer.render(home.scene, home.camera);
  }
  input.endFrame();
});

// Debug helpers: thugrats.xp(500), thugrats.time(300), thugrats.gold(500) ...
window.thugrats = {
  renderer, Save,
  get run() { return run; },
  exportGLB: exportHeroGLB,
  heroXp: (n, hero = home.heroId) => { Save.addHeroXp(hero, n); home.render(); },
  xp: (n) => run?.addXp(n, true),
  gold: (n) => run?.addGold(n, true),
  time: (s) => { if (run) { run.time += s; run.nextWave = Math.max(run.nextWave, run.time + 5); } },
  ability: (id) => run?.addAbility(run.hero.abilities.find((a) => a.id === id)),
  god: () => { if (run) run.hurtPlayer = () => {}; },
  touch: IS_TOUCH,
  play: (mapId = 'little_italy', diff = 0, hero = home.heroId) => transition(() => startRun(hero, mapId, diff)),
};
