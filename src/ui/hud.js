import { TIERS, tierColor } from '../data/tiers.js';
import { SLOTS, SLOT_NAMES, itemById } from '../data/items.js';
import { upgradeText } from '../game/stats.js';
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
      hideChoice: () => this.$('choice').classList.add('hidden'),
      showEnd: (r, run) => this.showEnd(r, run),
    };
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
  }

  detach() {
    this.run = null;
    this.root.classList.add('hidden');
    for (const id of ['end', 'choice', 'pause']) this.$(id).classList.add('hidden');
  }

  togglePause(force) {
    const r = this.run;
    if (!r || r.ended || r.choice) return;
    const on = force ?? !r.paused;
    r.paused = on;
    this.$('pause').classList.toggle('hidden', !on);
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
    for (let i = 0; i < 5; i++) {
      const s = el('div', 'slot empty', '');
      ab.appendChild(s);
      this.abSlots.push(s);
    }
    const ib = this.$('item-bar');
    ib.innerHTML = '';
    this.itSlots = [];
    for (const [slot, n] of Object.entries(SLOTS)) {
      for (let i = 0; i < n; i++) {
        const s = el('div', 'slot empty', `<span class="sl">${slot === 'title' ? 'TITLE' : slot === 'rep' ? 'REP' : 'RING'}</span>`);
        s.dataset.slot = slot;
        s.dataset.i = i;
        ib.appendChild(s);
        this.itSlots.push(s);
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
    this.$('hud-kills').textContent = `💀 ${fmtNum(r.kills)}`;
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
        sl.title = a ? a.def.name : '';
      });
      const counters = { ring: 0, title: 0, rep: 0 };
      for (const sl of this.itSlots) {
        const slot = sl.dataset.slot;
        const it = r.items[slot][counters[slot]++];
        sl.className = it ? 'slot' : 'slot empty';
        sl.style.borderColor = it ? tierColor(it.tier) : '';
        sl.innerHTML = it ? `${it.def.icon}<span class="lv">${it.level}</span>` : `<span class="sl">${slot === 'title' ? 'TITLE' : slot.toUpperCase()}</span>`;
      }
    }
    r.abilities.forEach((a, i) => {
      const cd = this.abSlots[i].querySelector('.cd');
      if (cd) cd.style.setProperty('--p', `${Math.max(0, Math.min(1, a.cd / a.cdMax)) * 100}%`);
      this.abSlots[i].classList.toggle('buff', !!r.buffs[a.def.id]);
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
    // the map turns with the camera so "up" on the minimap = forward on screen
    const yaw = r.camYaw, cs = Math.cos(yaw), sn = Math.sin(yaw), C0 = W / 2;
    const P = (x, z) => {
      const dx = X(x) - C0, dz = Z(z) - C0;
      return [C0 + dx * cs - dz * sn, C0 + dx * sn + dz * cs];
    };
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.translate(C0, C0);
    ctx.rotate(yaw);
    ctx.drawImage(this.mmBase, -C0, -C0);
    ctx.restore();
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
      dot(m.x, m.z, m.tier === 1 ? 3 : 6, m.tier === 1 ? '#ffd23f' : m.tier === 2 ? '#ff3030' : '#ff4fd8');
    }
    for (const c of r.pickups.chests) {
      const [px, pz] = P(c.x, c.z);
      ctx.fillStyle = '#f2c037';
      ctx.fillRect(px - 4, pz - 4, 8, 8);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(px - 4, pz - 4, 8, 8);
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
    if (r.pet) dot(r.pet.x, r.pet.z, 3, '#c9a27a');
    const p = r.player;
    const [px, pz] = P(p.x, p.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-p.facing + Math.PI + yaw);
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
    this.$('choice-title').textContent = c.kind === 'level' ? 'Level Up — pick one' : 'Loot — pick one';
    const box = this.$('choice-cards');
    box.innerHTML = '';
    c.cards.forEach((card, i) => {
      const b = el('button', 'card');
      const tier = card.tier ?? 0;
      let col = tierColor(tier);
      let html = '';
      if (card.type === 'newAbility') {
        col = '#f2c037';
        html = `<span class="tag">NEW ABILITY</span><div class="tier">Ability ${r.abilities.length + 1}/5</div><div class="ic">${card.def.icon}</div><div class="nm">${card.def.name}</div><div class="what">${card.def.desc}</div>`;
      } else if (card.type === 'abilityUp') {
        const a = card.ability, up = card.up;
        const have = up.kind === 'pct' ? (a.inc[up.stat] ?? 0) * 100 : (a.add[up.stat] ?? 0);
        const fmtTot = (v) => (up.fmt ? up.fmt(v) : up.kind === 'pct' ? `+${Math.round(v)}%` : `+${Math.round(v * 10) / 10}`);
        html = `<div class="tier">${TIERS[tier].name}</div><div class="ic">${a.def.icon}</div><div class="nm">${a.def.name}</div><div class="eff">${upgradeText(up, card.gain)}</div>
          <div class="lvl">${have > 0 ? `${up.label}: ${fmtTot(have)} → ${fmtTot(have + card.gain)}` : `Lv ${a.level} → ${a.level + 1}`}</div>`;
      } else if (card.type === 'item') {
        const d = card.def;
        const cur = card.owned?.power ?? 0;
        const next = cur + card.gain;
        html = `<span class="tag">${card.owned ? `LV ${card.owned.level + 1}` : 'NEW'}</span><div class="tier">${TIERS[tier].name} ${SLOT_NAMES[d.slot]}</div><div class="ic">${d.icon}</div><div class="nm">${d.name}</div>
          <div class="eff">${d.desc(next)}</div>${card.owned ? `<div class="lvl">was: ${d.desc(cur)}</div>` : ''}`;
      } else {
        html = `<div class="ic">💰</div><div class="nm">Pocket Money</div><div class="eff">+${card.amount} gold</div>`;
      }
      b.style.setProperty('--tc', col);
      const banishable = c.banishing && banishKind(card);
      if (c.banishing) { b.classList.add(banishable ? 'banish' : 'nobanish'); b.disabled = !banishable; }
      b.innerHTML = `<span class="kb">${i + 1}</span>${html}${banishable ? '<span class="ban">🚫 BANISH</span>' : ''}`;
      b.addEventListener('click', () => r.choose(card));
      box.appendChild(b);
    });
    const rr = this.$('choice-reroll');
    rr.textContent = `🎲 Reroll (${r.rerolls})`;
    rr.disabled = r.rerolls <= 0;
    this.$('choice-skip').textContent = `Skip (+${10 + r.level * 2} gold)`;
    const kind = c.kind === 'level' ? 'ability' : 'item';
    const bb = this.$('choice-banish');
    bb.textContent = c.banishing ? '✖ Cancel banish' : `🚫 Banish ${kind} (${r.banishes[kind]})`;
    bb.disabled = !c.banishing && r.banishes[kind] <= 0;
    bb.classList.toggle('on', !!c.banishing);
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
    const abil = r.abilities.map((a) => `<div class="line"><span class="ic">${a.def.icon}</span><div><b>${a.def.name}</b> Lv ${a.level}<div class="d">${a.history.map((h) => `<span style="color:${tierColor(h.tier)}">${h.label}</span>`).join(', ') || 'base'}</div></div></div>`).join('');
    const items = r.allItems().map((it) => `<div class="line"><span class="ic">${it.def.icon}</span><div><b style="color:${tierColor(it.tier)}">${it.def.name}</b> Lv ${it.level}<div class="d">${it.def.desc(it.power)}</div></div></div>`).join('') || '<div class="d">No items yet — open chests and kill bosses.</div>';
    const pct = (v) => `${Math.round(v * 100)}%`;
    return `<div class="build"><div><h3>Abilities</h3>${abil}</div><div><h3>Items</h3>${items}</div></div>
      <h3 style="color:var(--gold);font-size:16px;margin:12px 0 6px">Stats</h3>
      <div class="stats-grid">
        <div>Max HP <b>${Math.round(s.maxHp)}</b></div><div>Regen <b>${s.regen.toFixed(1)}/s</b></div><div>Armor <b>${pct(s.armor)}</b></div>
        <div>Damage <b>${pct(s.dmg)}</b></div><div>Crit <b>${pct(s.crit)}</b></div><div>Crit Dmg <b>+${pct(s.critDmg)}</b></div>
        <div>Cooldown Spd <b>+${pct(s.haste)}</b></div><div>Area <b>+${pct(s.area)}</b></div><div>Duration <b>+${pct(s.duration)}</b></div>
        <div>Move Spd <b>${s.speed.toFixed(1)}</b></div><div>Luck <b>${Math.round(s.luck)}</b></div><div>Dodge <b>${pct(s.dodge)}</b></div>
        <div>XP <b>${pct(s.xpGain)}</b></div><div>Gold <b>${pct(s.goldGain)}</b></div><div>Pickup <b>${s.pickup.toFixed(1)}m</b></div>
      </div>`;
  }

  // ── end screen ─────────────────────────
  showEnd(res, run) {
    const panel = this.$('end-panel');
    const dm = Object.entries(res.dmgBy).sort((a, b) => b[1] - a[1]);
    const total = dm.reduce((a, [, v]) => a + v, 0) || 1;
    const name = (id) => run.hero.abilities.find((a) => a.id === id) ?? { name: id === 'burn' ? 'Burning' : id === 'godfather' ? 'Godfather Bodyguard' : id, icon: id === 'burn' ? '🔥' : '🤵' };
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
