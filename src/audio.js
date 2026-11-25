// Synthesized sound effects (Web Audio). No files. Throttled so a horde
// doesn't turn into white noise.
let ctx = null, master = null, noiseBuf = null;
const lastPlay = {};

function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { capture: true });

export function setVolume(v) {
  if (master) master.gain.value = v * 0.6;
}

const ready = () => ctx && ctx.state === 'running';

function tone(type, f0, f1, dur, peak, when = 0) {
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, peak, freq, q = 1, type = 'lowpass', when = 0) {
  const t = ctx.currentTime + when;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.25), t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

const SFX = {
  shot: () => { noise(0.07, 0.18, 3200, 0.8, 'bandpass'); tone('square', 420, 120, 0.06, 0.04); },
  bigshot: () => { noise(0.2, 0.35, 1800, 0.7); tone('sawtooth', 200, 50, 0.2, 0.12); },
  tommy: () => { noise(0.05, 0.14, 2600, 1, 'bandpass'); },
  boom: () => { noise(0.6, 0.5, 900, 0.5); tone('sine', 110, 30, 0.5, 0.4); },
  hit: () => { noise(0.04, 0.08, 1500, 2, 'bandpass'); },
  kill: () => { tone('triangle', 520, 260, 0.08, 0.05); },
  xp: () => { tone('sine', 900 + Math.random() * 300, 1400, 0.06, 0.04); },
  gold: () => { tone('square', 1200, 1800, 0.05, 0.03); tone('square', 1800, 2400, 0.06, 0.025, 0.04); },
  hurt: () => { tone('sawtooth', 220, 90, 0.18, 0.12); },
  levelup: () => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f * 1.01, 0.22, 0.12, i * 0.07)); },
  chest: () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, 0.15, 0.05, i * 0.06)); },
  warn: () => { tone('sawtooth', 300, 280, 0.35, 0.08); tone('sawtooth', 300, 280, 0.35, 0.08, 0.4); },
  frenzy: () => { tone('sawtooth', 200, 800, 0.35, 0.1); },
  tantrum: () => { tone('square', 700, 200, 0.3, 0.08); noise(0.3, 0.25, 600); },
  car: () => { tone('sawtooth', 90, 160, 0.8, 0.08); noise(0.8, 0.12, 400); },
  snipe: () => { noise(0.35, 0.4, 2600, 0.4); tone('sine', 1600, 200, 0.3, 0.08); },
  select: () => { tone('triangle', 660, 990, 0.08, 0.08); },
  click: () => { tone('triangle', 500, 600, 0.04, 0.05); },
  victory: () => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, f, 0.3, 0.1, i * 0.12)); },
  defeat: () => { [392, 349, 311, 262].forEach((f, i) => tone('triangle', f, f * 0.98, 0.4, 0.1, i * 0.22)); },
  titan: () => { tone('sawtooth', 70, 40, 1.4, 0.25); noise(1.2, 0.3, 300); },
};

/** Play a named sound. minGap (seconds) throttles rapid repeats. */
export function sfx(name, minGap = 0.03) {
  if (!ready()) return;
  const now = ctx.currentTime;
  if (now - (lastPlay[name] ?? -1) < minGap) return;
  lastPlay[name] = now;
  SFX[name]?.();
}
