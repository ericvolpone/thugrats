import { TIERS, tierColor } from '../data/tiers.js';
import { SLOTS, SLOT_NAMES, itemById } from '../data/items.js';

const SLOT_LABEL = { ring: 'RING', title: 'TITLE', rep: 'REP', stash: 'CONTRA' };
/** Friendly names for ability stats in tooltips. */
const STAT_NAME = { damage: 'Damage', cooldown: 'Cooldown', area: 'Area', duration: 'Duration', count: 'Count', pierce: 'Pierce', range: 'Range',
  power: 'Power', execute: 'Execute', bounce: 'Bounces', speed: 'Speed', jumps: 'Jumps', knock: 'Knockback', slow: 'Slow', crit: 'Crit' };
const fmtStat = (k, v) => {
  if (k === 'cooldown' || k === 'duration') return `${v.toFixed(1)}s`;
  if (k === 'area' || k === 'range') return `${v.toFixed(1)}m`;
  if (k === 'execute' || k === 'slow' || k === 'crit' || (k === 'power' && v < 2)) return `${Math.round(v * 100)}%`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};
/** The tags worth showing on cards (what talents and Contraband key off). */
const kindText = (def) => def.tags.filter((t) => t !== 'orbit').join(' · ').toUpperCase();
import { upgradeText } from '../game/stats.js';
import { CHEST_LIFE } from '../game/pickups.js';
import { banishKind } from '../game/upgrades.js';
import { fmtTime, fmtNum, el } from '../util.js';
import { heroXpToNext } from '../save.js';
import { sfx } from '../audio.js';

/**
 * In-run UI: HUD, minimap, level-up/loot cards, pause and end screens.
 * The Run calls the methods on `this.api` (toast, banner, showChoice...).
 */
export class Hud {
  constructor({ onQuit, onRetry, onHome }) {
    this.cb = { onQuit, onRetry, onHome };
    this.run = null;
    this.root = document.getElementById('hud');
    this.$ = (id) => document.getElementById(id);
    this.mm = this.$('minimap').getContext('2d');
    this.mmBase = null;
    this.bannerT = 0;

    this.$('pause-btn').addEventListener('click', () => this.togglePause());
    this.$('pause').addEventListener('click', (e) => {
      const act = e.target.dataset?.act;
      if (act === 'resume') this.togglePause(false);
      if (act === 'quit') { this.togglePause(false); this.run?.end(false); }
    });
    this.$('choice-reroll').addEventListener('click', () => this.run?.reroll());
    this.$('choice-skip').addEventListener('click', () => this.run?.choose(null));
    this.$('choice-banish').addEventListener('click', () => this.run?.toggleBanish());
    this.$('dm-reset').addEventListener('click', () => this.run && this.resetMeter());
    addEventListener('keydown', (e) => {
      if (!this.run || this.run.ended) return;
      if (this.run.choice) {
        const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
        if (i >= 0 && this.run.choice.cards[i]) this.run.choose(this.run.choice.cards[i]);
        if (e.code === 'KeyR') this.run.reroll();
        if (e.code === 'KeyB') this.run.toggleBanish();
        return;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') this.togglePause();
    });

    // hover tooltips for abilities/items (HUD slots and the pause screen)
    this.tip = el('div', 'tip hidden', '');
    document.body.appendChild(this.tip);
    addEventListener('mouseover', (e) => {
      const t = e.target.closest?.('[data-tip]');
      const html = t && this.run ? this.tipHtml(t.dataset.tip) : '';
      this.tip.classList.toggle('hidden', !html);
      if (html) { this.tip.innerHTML = html; this.placeTip(e); }
      const h = e.target.closest?.('[data-tip],[data-hl]');
      this.highlight(h && this.run ? this.affected(h.dataset.hl ?? h.dataset.tip) : [], !!h?.dataset.hl);
    });
    // controller / keyboard focus highlights the same way hovering does
    const onFocus = (e) => {
      const h = e.target.closest?.('[data-tip],[data-hl]');
      if (h && this.run) this.highlight(this.affected(h.dataset.hl ?? h.dataset.tip), !!h.dataset.hl);
    };
    addEventListener('focusin', onFocus);
    addEventListener('padfocus', onFocus);
    addEventListener('mousemove', (e) => { if (!this.tip.classList.contains('hidden')) this.placeTip(e); });

    // the API the Run talks to
    this.api = {
      toast: (m) => this.toast(m),
      banner: (t, s, big) => this.banner(t, s, big),
      hurtFlash: () => {
        const h = this.$('hurt');
        h.classList.add('on');
        requestAnimationFrame(() => requestAnimationFrame(() => h.classList.remove('on')));
      },
      showChoice: (c) => this.showChoice(c),
      hideChoice: () => { this.$('choice').classList.add('hidden'); this.highlight([]); },
      showEnd: (r, run) => this.showEnd(r, run),
    };
  }

  /** Indices of your abilities that a hovered thing touches. Keys as in tipHtml, plus 'itd:<item id>'. */
  affected(key) {
    const r = this.run;
    const [kind, a1, a2] = key.split(':');
    if (kind === 'ab') return [+a1];
    const def = kind === 'itd' ? itemById(a1) : kind === 'it' ? r.findItem(a1)?.def : kind === 'is' ? r.items[a1]?.[+a2]?.def : null;
    if (!def) return [];
    return r.abilities.map((a, i) => (def.affects(a) ? i : -1)).filter((i) => i >= 0);
  }

  /** Light-yellow glow on the given ability slots (HUD + pause list). lift: raise the bar over the card overlay. */
  highlight(idx, lift = false) {
    const k = idx.join();
    if (k === this.hlKey && lift === this.hlLift) return;
    this.hlKey = k;
    this.hlLift = lift;
    (this.abCols ?? []).forEach((c, i) => c.classList.toggle('hl', idx.includes(i)));
    document.querySelectorAll('#pause-build [data-tip^="ab:"]').forEach((l) => l.classList.toggle('hl', idx.includes(+l.dataset.tip.split(':')[1])));
    document.body.classList.toggle('hl-lift', lift && idx.length > 0);
  }

  /** "🔫 Snub-Nose, 💸 Make It Rain" for an item def (or a note that it's a hero stat). */
  affectsText(def) {
    const list = this.run.abilities.filter((a) => def.affects(a));
    return list.length ? list.map((a) => `${a.def.icon} ${a.def.name}`).join(', ') : 'You (not tied to an ability)';
  }

  placeTip(e) {
    const w = this.tip.offsetWidth, h = this.tip.offsetHeight;
    let x = e.clientX + 16, y = e.clientY + 16;
    if (x + w > innerWidth - 8) x = e.clientX - w - 16;
    if (y + h > innerHeight - 8) y = Math.max(8, innerHeight - h - 8);
    this.tip.style.transform = `translate(${Math.max(8, x)}px, ${y}px)`;
  }

  /** 'ab:<index>' · 'it:<item id>' · 'is:<slot>:<index>' -> tooltip HTML ('' = none). */
  tipHtml(key) {
    const r = this.run;
    const [kind, a1, a2] = key.split(':');
    if (kind === 'ab') {
      const a = r.abilities[+a1];
      if (!a) return '';
      const d = a.def;
      const stats = Object.keys(d.base).filter((k) => STAT_NAME[k]).map((k) => `<span>${STAT_NAME[k]} <b>${fmtStat(k, a.stat(k))}</b></span>`).join('');
      const ups = a.upgradeInfo().map(({ up, have, max, maxed }) => {
        const tot = up.fmt ? up.fmt(have) : up.kind === 'pct' ? `+${Math.round(have)}%` : `+${Math.round(have * 10) / 10}`;
        const cap = max != null ? ` <i>(max +${max})</i>` : '';
        return `<div class="up ${maxed ? 'mx' : ''}"><span>${up.label}</span><b>${have ? tot : '—'}${cap}</b>${maxed ? '<em>MAXED</em>' : ''}</div>`;
      }).join('');
      return `<div class="th">${d.icon} ${d.name} <small>Lv ${a.level}</small></div><div class="tk">${kindText(d)}${d.aura ? ' · ALWAYS ON' : ''}</div>
        <div class="td">${d.desc}</div><div class="ts">${stats}</div><div class="tu"><div class="tl">Upgrades</div>${ups}</div>
        ${r.banished.has(d.id) ? '<div class="tn">Banished: no more upgrades will be offered.</div>' : ''}`;
    }
    const it = kind === 'it' ? r.findItem(a1) : kind === 'is' ? r.items[a1]?.[+a2] : null;
    if (!it) return kind === 'is' ? `<div class="th">Empty ${SLOT_NAMES[a1]} slot</div><div class="td">${a1 === 'stash' ? 'Contraband is sold at the Black Market ($ on the minimap). Kill a Crime Titan to complete a contract, then trade it there.' : 'Open chests and kill elites and bosses for items.'}</div>` : '';
    const d = it.def;
    const maxed = r.maxed.has(d.id);
    return `<div class="th">${d.icon} ${d.name} <small>${d.slot === 'stash' ? `×${it.level}` : `Lv ${it.level}`}</small></div><div class="tk" style="color:${tierColor(it.tier)}">${d.slot === 'stash' ? 'Contraband' : `${TIERS[it.tier].name} ${SLOT_NAMES[d.slot]}`}${d.needsLabel ? ` · FOR ${String(d.needsLabel).toUpperCase()}` : ''}</div>
      <div class="td">${d.desc(it.power)}</div>${d.slot === 'stash' ? `<div class="tn">Stacks linearly: another copy from the Black Market adds the same again (×${it.level + 1}).</div>` : ''}<div class="ts"><span>Now <b>${d.short(it.power, r, it)}</b></span></div>
      ${d.cap ? `<div class="tn">${maxed ? '<em>MAXED</em> ' : ''}Caps at ${d.cap}. Once it does, it stops being offered (no banish used).</div>` : ''}
      ${d.needsLabel ? `<div class="tn">Only affects abilities tagged ${String(d.needsLabel).toUpperCase()}.</div>` : ''}
      <div class="tn"><b style="color:#fff3b0">Affects:</b> ${this.affectsText(d)}</div>`;
  }

  attach(run) {
    this.run = run;
    this.mmBase = null;
    this.root.classList.remove('hidden');
    this.$('end').classList.add('hidden');
    this.$('choice').classList.add('hidden');
    this.$('pause').classList.add('hidden');
    this.$('toasts').innerHTML = '';
    this.buildSlots();
    this.resetMeter();
  }

  detach() {
    this.highlight([]);
    this.run = null;
    this.tip.classList.add('hidden');
    this.root.classList.add('hidden');
    for (const id of ['end', 'choice', 'pause']) this.$(id).classList.add('hidden');
  }

  togglePause(force) {
    const r = this.run;
    if (!r || r.ended || r.choice) return;
    const on = force ?? !r.paused;
    r.paused = on;
    this.$('pause').classList.toggle('hidden', !on);
    this.highlight([]);
    if (on) this.$('pause-build').innerHTML = this.buildHtml(r);
  }

  toast(msg) {
    const t = el('div', 'toast', msg);
    const box = this.$('toasts');
    box.appendChild(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => t.remove(), 3300);
  }

  banner(title, sub = '', big = false) {
    const b = this.$('banner');
    b.querySelector('h1').textContent = title;
    b.querySelector('p').textContent = sub;
    b.classList.toggle('big', big);
    b.classList.add('on');
    this.bannerT = 2.8;
  }

  buildSlots() {
    const ab = this.$('ability-bar');
    ab.innerHTML = '';
    this.abSlots = [];
    this.abCols = [];
    this.abMods = [];
    for (let i = 0; i < 5; i++) {
      // a column: the icon, then (desktop) a fixed-height list of its modifiers
      const col = el('div', 'ab-col', '<div class="slot empty"></div><div class="ab-mods"></div>');
      col.dataset.tip = `ab:${i}`;
      ab.appendChild(col);
      this.abCols.push(col);
      this.abSlots.push(col.firstElementChild);
      this.abMods.push(col.lastElementChild);
    }
    this.hlKey = null;
    const ib = this.$('item-bar');
    ib.innerHTML = '';
    this.itSlots = [];
    for (const [slot, n] of Object.entries(SLOTS)) {
      for (let i = 0; i < n; i++) {
        // a row: the icon slot + a thin readout of what it's giving you (desktop)
        const row = el('div', 'it-row empty', `<div class="slot empty"><span class="sl">${SLOT_LABEL[slot]}</span></div><span class="it-txt"></span>`);
        row.dataset.slot = slot;
        row.dataset.i = i;
        row.dataset.tip = `is:${slot}:${i}`;
        ib.appendChild(row);
        this.itSlots.push(row);
      }
    }
    this.slotKey = '';
  }

  update(dt) {
    const r = this.run;
    if (!r) return;
    const p = r.player;
    const s = r.stats;
    this.$('xpbar').querySelector('i').style.width = `${(r.xp / r.xpNext) * 100}%`;
    this.$('xpbar').querySelector('span').textContent = `LV ${r.level}`;
    const hp = this.$('hpbar');
    hp.querySelector('i').style.width = `${(p.hp / s.maxHp) * 100}%`;
    hp.querySelector('b').style.width = `${Math.min(100, (p.shield / s.maxHp) * 100)}%`;
    hp.querySelector('span').textContent = `${Math.ceil(p.hp)} / ${Math.round(s.maxHp)}${p.shield > 0 ? ` (+${Math.ceil(p.shield)})` : ''}`;
    this.$('hud-gold').textContent = `💰 ${Math.floor(r.gold)}`;
    const cc = this.$('hud-chest'), cost = r.chestCost();
    cc.textContent = `📦 ${cost}`;
    cc.classList.toggle('ok', r.gold >= cost);
    cc.classList.toggle('no', r.gold < cost);
    this.$('hud-kills').textContent = `💀 ${fmtNum(r.kills)}`;
    const ct = this.$('hud-contracts');
    ct.classList.toggle('hidden', !r.contracts);
    ct.textContent = `📜 ${r.contracts}`;
    const tm = this.$('hud-time');
    const left = r.cfg.duration - r.time;
    tm.textContent = left > 0 ? fmtTime(left) : `FEDS +${fmtTime(-left)}`;
    tm.classList.toggle('feds', left <= 60);

    // abilities
    const key = r.abilities.map((a) => a.def.id + a.level).join() + '|' + r.allItems().map((i) => i.def.id + i.level).join();
    if (key !== this.slotKey) {
      this.slotKey = key;
      this.abSlots.forEach((sl, i) => {
        const a = r.abilities[i];
        sl.className = a ? 'slot' : 'slot empty';
        sl.innerHTML = a ? `${a.def.icon}<div class="cd"></div><span class="lv">${a.level}</span>` : '';
        this.abMods[i].innerHTML = a ? a.upgradeInfo().filter((u) => u.have).map(({ up, have, maxed }) => {
          const v = up.fmt ? up.fmt(have) : up.kind === 'pct' ? `+${Math.round(have)}%` : `+${Math.round(have * 10) / 10}`;
          return `<div class="${maxed ? 'mx' : ''}">${v} ${up.label}</div>`;
        }).join('') : '';
      });
      for (const row of this.itSlots) {
        const it = r.items[row.dataset.slot][+row.dataset.i];
        const sl = row.firstElementChild;
        row.classList.toggle('empty', !it);
        sl.className = it ? 'slot' : 'slot empty';
        sl.style.borderColor = it ? tierColor(it.tier) : '';
        sl.innerHTML = it ? `${it.def.icon}<span class="lv">${it.level}</span>` : `<span class="sl">${SLOT_LABEL[row.dataset.slot]}</span>`;
      }
    }
    // item readouts (some change every frame: Street Cred stacks, Bagman gold)
    this.txtT = (this.txtT ?? 0) - dt;
    if (this.txtT <= 0) {
      this.txtT = 0.25;
      for (const row of this.itSlots) {
        const it = r.items[row.dataset.slot][+row.dataset.i];
        const t = it ? it.def.short(it.power, r, it) : '';
        const tx = row.lastElementChild;
        if (tx.textContent !== t) { tx.textContent = t; tx.style.color = it ? tierColor(it.tier) : ''; }
      }
    }
    r.abilities.forEach((a, i) => {
      const cd = this.abSlots[i]?.querySelector('.cd');
      if (cd) cd.style.setProperty('--p', `${Math.max(0, Math.min(1, a.cd / a.cdMax)) * 100}%`);
      this.abSlots[i]?.classList.toggle('buff', !!r.buffs[a.def.id]);
    });

    // titans
    const tl = this.$('titan-list');
    tl.innerHTML = r.titans.map((t) => {
      const conds = t.state === 'dead' || t.state === 'active' ? '' : r.titanCondText(t).map((c) => `<span class="c ${c.ok ? 'ok' : ''}">${c.ok ? '✓' : '•'} ${c.text}</span>`).join(' ');
      const st = t.state === 'ready' ? ' — stand in the beam!' : t.state === 'active' ? ' — FIGHT' : '';
      return `<div class="titan-row ${t.state}"><b>🗿 ${t.def.name}</b>${t.def.final ? ' <span class="c">(final)</span>' : ''}${st}<br>${conds}</div>`;
    }).join('');

    // boss bars
    const bosses = r.mobs.list.filter((m) => m.tier >= 2 && !m.dead);
    this.$('boss-bars').innerHTML = bosses.slice(0, 3).map((m) => `<div class="boss-bar ${m.tier === 3 ? 'titan' : ''}"><div class="nm"><span>${m.def.name}</span><span>${fmtNum(Math.max(0, m.hp))}</span></div><div class="tr"><i style="width:${(Math.max(0, m.hp) / m.maxHp) * 100}%"></i></div></div>`).join('');

    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.$('banner').classList.remove('on');
    }
    this.drawMinimap();
    this.updateMeter(dt);
  }

  // ── live damage meter (bottom right) ───────────────────
  /** Name + icon for a damage source id (ability id, 'burn', 'godfather'). */
  dmgSource(id, run = this.run) {
    return run.hero.abilities.find((a) => a.id === id) ?? { name: id === 'burn' ? 'Burning' : id === 'godfather' ? 'Godfather Bodyguard' : id, icon: id === 'burn' ? '🔥' : '🤵' };
  }

  resetMeter() {
    const r = this.run;
    this.meter = { base: { ...r.dmgBy }, t0: r.time, snaps: [{ t: r.time, by: { ...r.dmgBy } }], tick: 0, snapT: 0 };
  }

  updateMeter(dt) {
    const r = this.run, m = this.meter;
    if (!m) return;
    m.snapT += dt;
    if (m.snapT >= 1) {
      m.snapT = 0;
      m.snaps.push({ t: r.time, by: { ...r.dmgBy } });
      while (m.snaps.length > 2 && r.time - m.snaps[1].t >= 30) m.snaps.shift();
    }
    m.tick -= dt;
    if (m.tick > 0) return;
    m.tick = 0.25;
    const old = m.snaps[0];
    const span = Math.max(1, r.time - old.t);
    const rows = Object.keys(r.dmgBy).map((id) => ({ id, tot: r.dmgBy[id] - (m.base[id] ?? 0), dps: (r.dmgBy[id] - (old.by[id] ?? 0)) / span }))
      .filter((x) => x.tot > 0).sort((a, b) => b.tot - a.tot).slice(0, 8);
    const top = rows[0]?.tot || 1;
    const dps = rows.reduce((a, x) => a + x.dps, 0);
    this.$('dm-total').textContent = `${fmtNum(Math.round(dps))} DPS`;
    this.$('dm-rows').innerHTML = rows.map((x) => {
      const d = this.dmgSource(x.id);
      return `<div class="dm-row"><span class="ic">${d.icon}</span><div class="dm-bar"><i style="width:${(x.tot / top) * 100}%"></i><span class="nm">${d.name}</span><span class="v">${fmtNum(Math.round(x.tot))}</span></div><span class="dps">${fmtNum(Math.round(x.dps))}</span></div>`;
    }).join('') || '<div class="dm-empty">No damage yet</div>';
  }

  drawMinimap() {
    const r = this.run, ctx = this.mm;
    const W = 300, half = r.world.half;
    const k = W / (half * 2);
    const X = (x) => (x + half) * k, Z = (z) => (z + half) * k;
    if (!this.mmBase) {
      const c = document.createElement('canvas');
      c.width = c.height = W;
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(40,36,44,0.9)';
      g.fillRect(0, 0, W, W);
      g.globalAlpha = 0.45;
      for (const f of r.world.mm) {
        g.fillStyle = f.color;
        if (f.r != null) { g.beginPath(); g.arc(X(f.x), Z(f.z), f.r * k, 0, Math.PI * 2); g.fill(); }
        else g.fillRect(X(f.x0), Z(f.z0), (f.x1 - f.x0) * k, (f.z1 - f.z0) * k);
      }
      g.globalAlpha = 1;
      for (const b of r.world.rects) {
        if (b.kind === 'water') continue;
        g.fillStyle = b.kind === 'prop' ? 'rgba(150,140,150,0.6)' : 'rgba(120,100,110,0.9)';
        g.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * k, (b.z1 - b.z0) * k);
      }
      for (const [x, z] of r.map.bossSpawns) {
        g.strokeStyle = 'rgba(255,90,90,0.5)';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(X(x), Z(z), 6, 0, Math.PI * 2);
        g.stroke();
      }
      this.mmBase = c;
    }
    // north-up: the map never turns; a faint wedge shows where the camera looks
    const P = (x, z) => [X(x), Z(z)];
    ctx.clearRect(0, 0, W, W);
    ctx.drawImage(this.mmBase, 0, 0);
    const t = r.time;
    const dot = (x, z, rad, fill) => {
      const [px, pz] = P(x, z);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(px, pz, rad, 0, Math.PI * 2);
      ctx.fill();
      return [px, pz];
    };
    ctx.fillStyle = 'rgba(255,80,80,0.75)';
    for (const m of r.mobs.list) {
      if (m.dead || m.tier > 0) continue;
      const [px, pz] = P(m.x, m.z);
      ctx.fillRect(px - 1, pz - 1, 2.5, 2.5);
    }
    for (const m of r.mobs.list) {
      if (m.dead || m.tier === 0) continue;
      if (m.tier === 1) {
        // elites: crimson diamond (chests are gold boxes)
        const [px, pz] = P(m.x, m.z);
        ctx.fillStyle = '#ff3b6b';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px, pz - 5); ctx.lineTo(px + 4, pz); ctx.lineTo(px, pz + 5); ctx.lineTo(px - 4, pz);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        continue;
      }
      dot(m.x, m.z, 6, m.tier === 2 ? '#ff3030' : '#ff4fd8');
    }
    for (const c of r.pickups.chests) {
      if (c.t > CHEST_LIFE - 10 && Math.sin(c.t * 14) > 0) continue;
      const [px, pz] = P(c.x, c.z);
      ctx.fillStyle = '#8a5a2a';
      ctx.fillRect(px - 5, pz - 4, 10, 8);
      ctx.fillStyle = '#f2c037';
      ctx.fillRect(px - 5, pz - 1, 10, 2);
      ctx.fillRect(px - 1, pz - 4, 2, 8);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(px - 5, pz - 4, 10, 8);
    }
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const ti of r.titans) {
      const col = ti.state === 'ready' ? `rgba(255,210,63,${0.6 + Math.sin(t * 5) * 0.4})` : ti.state === 'dead' ? '#555' : ti.state === 'active' ? '#ff4fd8' : '#8a5ac8';
      const [px, pz] = dot(ti.pos[0], ti.pos[1], 9, col);
      ctx.fillStyle = '#000';
      ctx.fillText(ti.state === 'dead' ? '✕' : 'T', px, pz + 1);
    }
    if (r.bossWarn) {
      const [px, pz] = dot(r.bossWarn.x, r.bossWarn.z, 10, `rgba(255,48,48,${0.6 + Math.sin(t * 8) * 0.4})`);
      ctx.fillStyle = '#fff';
      ctx.fillText(String(Math.ceil(r.bossWarn.at - t)), px, pz + 1);
    }
    const mk = r.pickups.market;
    if (mk) {
      const [mx, mz] = dot(mk.x, mk.z, 8, r.contracts > 0 ? `rgba(93,255,154,${0.7 + Math.sin(t * 5) * 0.3})` : '#3a2a50');
      ctx.fillStyle = r.contracts > 0 ? '#000' : '#c9b8e0';
      ctx.fillText('$', mx, mz + 1);
    }
    if (r.pet) dot(r.pet.x, r.pet.z, 3, '#c9a27a');
    const p = r.player;
    const [px, pz] = P(p.x, p.z);
    // camera view wedge
    const cf = Math.atan2(-Math.cos(r.camYaw), -Math.sin(r.camYaw)); // canvas angle of camera-forward
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.beginPath();
    ctx.moveTo(px, pz);
    ctx.arc(px, pz, 42, cf - 0.6, cf + 0.6);
    ctx.closePath();
    ctx.fill();
    // the arrow points where you're walking (or last walked), not where you're shooting
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.PI - p.moveFacing);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ── choice cards ───────────────────────
  showChoice(c) {
    const r = this.run;
    this.$('choice-reason').textContent = c.reason ?? '';
    this.$('choice-title').textContent = c.kind === 'level' ? 'Level Up — pick one' : c.kind === 'market' ? '🕶️ Black Market — pick one' : 'Loot — pick one';
    const box = this.$('choice-cards');
    box.innerHTML = '';
    box.style.setProperty('--cols', c.cards.length);
    c.cards.forEach((card, i) => {
      const b = el('button', 'card');
      const tier = card.tier ?? 0;
      let col = tierColor(tier);
      let html = '';
      if (card.type === 'newAbility') {
        col = '#f2c037';
        html = `<span class="kind">${kindText(card.def)}</span><span class="tag">NEW ABILITY</span><div class="tier">Ability ${r.abilities.length + 1}/5</div><div class="ic">${card.def.icon}</div><div class="nm">${card.def.name}</div><div class="what">${card.def.desc}</div>`;
      } else if (card.type === 'abilityUp') {
        const a = card.ability, up = card.up;
        const have = up.kind === 'pct' ? (a.inc[up.stat] ?? 0) * 100 : (a.add[up.stat] ?? 0);
        const fmtTot = (v) => (up.fmt ? up.fmt(v) : up.kind === 'pct' ? `+${Math.round(v)}%` : `+${Math.round(v * 10) / 10}`);
        html = `<span class="kind">${kindText(a.def)}</span><div class="tier">${TIERS[tier].name}</div><div class="ic">${a.def.icon}</div><div class="nm">${a.def.name}</div><div class="eff">${upgradeText(up, card.gain)}</div>
          <div class="lvl">${have > 0 ? `${up.label}: ${fmtTot(have)} → ${fmtTot(have + card.gain)}` : `Lv ${a.level} → ${a.level + 1}`}</div>`;
      } else if (card.type === 'item') {
        const d = card.def;
        const cur = card.owned?.power ?? 0;
        const next = cur + card.gain;
        const stack = d.slot === 'stash' && card.owned ? `×${card.owned.level + 1}` : null;
        html = `${d.needsLabel ? `<span class="kind">FOR ${String(d.needsLabel).toUpperCase()}</span>` : ''}<span class="tag">${stack ?? (card.owned ? `LV ${card.owned.level + 1}` : 'NEW')}</span><div class="tier">${d.slot === 'stash' ? 'Contraband' : `${TIERS[tier].name} ${SLOT_NAMES[d.slot]}`}</div><div class="ic">${d.icon}</div><div class="nm">${d.name}</div>
          <div class="eff">${d.desc(next)}</div>${card.owned ? `<div class="lvl">was: ${d.desc(cur)}</div>` : ''}<div class="aff">Affects: ${this.affectsText(d)}</div>`;
      } else {
        html = `<div class="ic">💰</div><div class="nm">Pocket Money</div><div class="eff">+${card.amount} gold</div>`;
      }
      b.style.setProperty('--tc', col);
      if (card.maxes) { b.classList.add('maxout'); html = `<span class="maxed">MAXED OUT</span>${html}`; }
      const banishable = c.banishing && banishKind(card);
      if (c.banishing) { b.classList.add(banishable ? 'banish' : 'nobanish'); b.disabled = !banishable; }
      b.innerHTML = `<span class="kb">${i + 1}</span>${html}${banishable ? '<span class="ban">🚫 BANISH</span>' : ''}`;
      if (card.type === 'abilityUp') b.dataset.hl = `ab:${r.abilities.indexOf(card.ability)}`;
      if (card.type === 'item') b.dataset.hl = `itd:${card.def.id}`;
      b.addEventListener('click', () => r.choose(card));
      box.appendChild(b);
    });
    const rr = this.$('choice-reroll');
    rr.textContent = `🎲 Reroll (${r.rerolls})`;
    rr.disabled = r.rerolls <= 0;
    this.$('choice-skip').textContent = `Skip (+${10 + r.level * 2} gold)`;
    const kind = c.kind === 'level' ? 'ability' : 'item';
    const bb = this.$('choice-banish');
    bb.textContent = c.banishing ? '✖ Cancel banish' : `🚫 Banish (${r.banishes} left)`;
    bb.disabled = !c.banishing && r.banishes <= 0;
    bb.classList.toggle('on', !!c.banishing);
    if (c.kind === 'market') this.$('choice-reason').textContent = c.reason;
    const names = [...r.banished].map((id) => r.hero.abilities.find((a) => a.id === id)?.name ?? itemById(id)?.name).filter(Boolean);
    this.$('choice-banish-note').textContent = c.banishing ? `Pick the ${kind} to remove from this run's offers (the cards reroll for free).` : names.length ? `Banished: ${names.join(', ')}` : '';
    // brief pick lock so a click/tap/button meant for the fight doesn't take a card
    const box2 = this.$('choice');
    const left = (c.lockUntil ?? 0) - performance.now();
    clearTimeout(this.lockTimer);
    if (left > 0) {
      box2.classList.add('picklock');
      box2.style.setProperty('--lock', `${left}ms`);
      this.lockTimer = setTimeout(() => box2.classList.remove('picklock'), left);
    } else box2.classList.remove('picklock');
    this.$('choice').classList.remove('hidden');
  }

  buildHtml(r) {
    const s = r.stats;
    const abil = r.abilities.map((a, i) => `<div class="line" data-tip="ab:${i}"><span class="ic">${a.def.icon}</span><div><b>${a.def.name}</b> Lv ${a.level}<div class="d">${a.history.map((h) => `<span style="color:${tierColor(h.tier)}">${h.label}</span>`).join(', ') || 'base'}</div></div></div>`).join('');
    const items = r.allItems().map((it) => `<div class="line" data-tip="it:${it.def.id}"><span class="ic">${it.def.icon}</span><div><b style="color:${tierColor(it.tier)}">${it.def.name}</b> Lv ${it.level}<div class="d">${it.def.desc(it.power)}</div></div></div>`).join('') || '<div class="d">No items yet — open chests and kill bosses.</div>';
    const pct = (v) => `${Math.round(v * 100)}%`;
    return `<div class="build"><div><h3>Abilities</h3>${abil}</div><div><h3>Items</h3>${items}</div></div>
      <h3 style="color:var(--gold);font-size:16px;margin:12px 0 6px">Stats</h3>
      <div class="stats-grid">
        <div>Max HP <b>${Math.round(s.maxHp)}</b></div><div>Regen <b>${s.regen.toFixed(1)}/s</b></div><div>Armor <b>${pct(s.armor)}</b></div>
        <div>Damage <b>${pct(s.dmg)}</b></div><div>Crit <b>${pct(s.crit)}</b></div><div>Crit Dmg <b>+${pct(s.critDmg)}</b></div>
        <div>Recharge Rate <b>+${pct(s.haste)}</b></div><div>Area <b>+${pct(s.area)}</b></div><div>Duration <b>+${pct(s.duration)}</b></div>
        <div>Move Spd <b>${s.speed.toFixed(1)}</b></div><div>Luck <b>${Math.round(s.luck)}</b></div><div>Dodge <b>${pct(s.dodge)}</b></div><div>Lifesteal <b>${pct(s.lifesteal)}</b></div>
        <div>XP <b>${pct(s.xpGain)}</b></div><div>Gold <b>${pct(s.goldGain)}</b></div><div>Pickup <b>${s.pickup.toFixed(1)}m</b></div>
      </div>`;
  }

  // ── end screen ─────────────────────────
  showEnd(res, run) {
    const panel = this.$('end-panel');
    const dm = Object.entries(res.dmgBy).sort((a, b) => b[1] - a[1]);
    const total = dm.reduce((a, [, v]) => a + v, 0) || 1;
    const name = (id) => this.dmgSource(id, run);
    const dmgRows = dm.slice(0, 8).map(([id, v]) => {
      const d = name(id);
      return `<div class="dmg-row"><span>${d.icon}</span><span>${d.name}</span><div class="bar"><i style="width:${(v / total) * 100}%"></i></div><span>${fmtNum(v)}</span></div>`;
    }).join('');
    const gear = (res.gear ?? []).map((g) => (g.capped
      ? `<div class="reward">${g.def.icon} <b>${g.def.name}</b> is already <b style="color:${tierColor(g.to)}">${TIERS[g.to].name}</b> — clear a harder difficulty to upgrade it further.</div>`
      : `<div class="reward">${g.def.icon} ${g.drop ? 'Gear drop! ' : ''}${g.from < 0 ? 'New gear' : 'Gear upgraded'}: <b style="color:${tierColor(g.to)}">${g.def.name} (${TIERS[g.to].name})</b> <span style="color:var(--muted);font-size:13px">${g.def.slot}</span><br><span style="color:var(--muted);font-size:13px">${g.def.desc(g.to)}${g.from < 0 ? ' · equip it in the Gear tab' : ''}</span></div>`)).join('');
    const lvl = res.levels > 0 ? ` — <b style="color:var(--gold)">LEVEL UP! ${res.before} → ${res.after}</b> (+${res.levels} talent point${res.levels > 1 ? 's' : ''})` : '';
    panel.innerHTML = `
      <div class="end-head ${res.victory ? '' : 'lose'}"><h2>${res.victory ? 'Map Cleared!' : 'Busted!'}</h2>
      <p style="color:var(--muted);margin:0">${res.victory ? `${run.map.name} (${run.diff.name}) belongs to the family now.` : `${run.hero.name.split(' ')[0]} got put in time-out. The family remembers.`}</p></div>
      <div class="end-sum"><div>${fmtTime(res.time)}<span>time</span></div><div>${fmtNum(res.kills)}<span>kills</span></div><div>${res.level}<span>level</span></div><div>${fmtNum(res.gold)}<span>gold</span></div><div>${run.titanKills}/${run.titans.length}<span>titans</span></div></div>
      <div class="reward">⭐ +${res.heroXp} hero XP${lvl}</div>
      <div class="reward">🤝 +${res.rep} Rep <span style="color:var(--muted);font-size:13px">(account-wide — spend it in the hideout's Rep tab)</span></div>
      ${gear}
      <h3 style="color:var(--gold);margin:12px 0 6px;font-size:16px">Damage by ability</h3>${dmgRows || '<div class="note">No damage dealt.</div>'}
      <div class="row"><button class="btn" id="end-home" data-default>Back to the Hideout</button><button class="btn ghost" id="end-retry">Run it back</button></div>`;
    this.$('end').classList.remove('hidden');
    this.$('end-home').onclick = () => { sfx('click'); this.cb.onHome(); };
    this.$('end-retry').onclick = () => { sfx('click'); this.cb.onRetry(); };
  }
}

export { heroXpToNext };
