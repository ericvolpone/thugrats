#!/usr/bin/env node
/**
 * Summarise recorded playtest runs (see src/game/runlog.js).
 *
 *   npm run runs                      every run in playtests/runs/
 *   npm run runs -- --hero babyface   only one hero (also --map, --last N)
 *   npm run runs -- export.json       also read a file from thugrats.exportRuns()
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : null; };
const files = args.filter((a, i) => a.endsWith('.json') && !args[i - 1]?.startsWith('--'));

const dir = path.resolve('playtests/runs');
let runs = [];
if (fs.existsSync(dir)) {
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) runs.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  runs.push(...(Array.isArray(d) ? d : [d]));
}
// drop duplicates (a run can be in both the folder and an export)
runs = [...new Map(runs.map((r) => [r.startedAt + r.hero, r])).values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
if (opt('hero')) runs = runs.filter((r) => r.hero === opt('hero'));
if (opt('map')) runs = runs.filter((r) => r.map === opt('map'));
if (opt('last')) runs = runs.slice(-Number(opt('last')));
if (!runs.length) { console.log('No runs recorded yet. Play a run with `npm run dev` and it lands in playtests/runs/.'); process.exit(0); }

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const big = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)));

console.log(`\n${runs.length} run(s)\n`);
console.log(`${pad('when', 17)}${pad('hero', 10)}${pad('map', 14)}${pad('diff', 10)}${pad('outcome', 9)}${lpad('time', 7)}${lpad('lvl', 5)}${lpad('kills', 7)}  top damage`);
for (const r of runs) {
  const top = r.abilities[0];
  console.log(`${pad(r.startedAt.slice(0, 16).replace('T', ' '), 17)}${pad(r.hero, 10)}${pad(r.map, 14)}${pad(r.difficulty, 10)}${pad(r.cleared ? `${r.outcome}*` : r.outcome, 9)}${lpad(mmss(r.time), 7)}${lpad(r.level, 5)}${lpad(r.kills, 7)}  ${top ? `${top.name} ${top.share}% (${top.upgrades} ups)` : '-'}`);
}
console.log('  * = map cleared');

// per hero → per ability, averaged over the runs that had it
const byHero = {};
for (const r of runs) for (const a of r.abilities) {
  const h = (byHero[r.hero] ??= {});
  const s = (h[a.id] ??= { name: a.name, runs: 0, share: 0, ups: 0, dps: 0, acq: 0 });
  s.runs++; s.share += a.share; s.ups += a.upgrades; s.dps += a.dps; s.acq += a.acquired;
}
for (const [hero, abs] of Object.entries(byHero)) {
  const n = runs.filter((r) => r.hero === hero).length;
  console.log(`\n── ${hero} (${n} run${n > 1 ? 's' : ''}) — averages over runs that had the ability`);
  console.log(`${pad('ability', 24)}${lpad('runs', 5)}${lpad('dmg %', 8)}${lpad('ups', 6)}${lpad('% / up', 8)}${lpad('dps', 9)}${lpad('got at', 8)}`);
  for (const s of Object.values(abs).sort((a, b) => b.share / b.runs - a.share / a.runs)) {
    const share = s.share / s.runs, ups = s.ups / s.runs;
    console.log(`${pad(s.name.slice(0, 23), 24)}${lpad(s.runs, 5)}${lpad(share.toFixed(1), 8)}${lpad(ups.toFixed(1), 6)}${lpad((share / Math.max(1, ups + 1)).toFixed(1), 8)}${lpad(big(s.dps / s.runs), 9)}${lpad(mmss(s.acq / s.runs), 8)}`);
  }
}
console.log('\n"% / up" = damage share per pick spent on it (taking it counts as one). High = overperforming for its investment.');

const taken = {};
for (const r of runs) for (const [k, v] of Object.entries(r.damageTaken ?? {})) taken[k] = (taken[k] ?? 0) + v;
const tt = Object.entries(taken).sort((a, b) => b[1] - a[1]).slice(0, 8);
if (tt.length) console.log(`\nMost damage taken from: ${tt.map(([k, v]) => `${k} ${big(v)}`).join(' · ')}\n`);
