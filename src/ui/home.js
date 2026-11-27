import * as THREE from 'three';
import { HEROES, heroById } from '../heroes/index.js';
import { createHeroModel, MATS } from '../assets/models.js';
import { PROPS } from '../assets/props.js';
import { MAPS, DIFFICULTIES } from '../data/maps.js';
import { TIERS, tierColor } from '../data/tiers.js';
import { Save, heroXpToNext, HERO_MAX_LEVEL } from '../save.js';
import { BOSSES } from '../data/mobs.js';
import { GEAR_SLOTS, SLOT_ICON, TITAN_DROPS, pieceEffect, wornSets } from '../data/gear.js';
import { ACCOUNT_UPGRADES } from '../data/account.js';
import { paint, C, el } from '../util.js';
import { sfx } from '../audio.js';

/**
 * The hideout: roster of heroes on the left, the selected baby on stage in
 * the middle (3D), and tabs on the right — Play (maps & difficulty), Talents,
 * Gear and Kit (ability list).
 */
export class HomeScreen {
  constructor({ onPlay }) {
    this.onPlay = onPlay;
    this.root = document.getElementById('home');
    this.heroId = Save.data.lastHero && heroById(Save.data.lastHero) ? Save.data.lastHero : 'lenny';
    this.tab = 'play';
    this.selTalent = null;
    this.selPiece = null;

    // ── 3D stage ──
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1a1018');
    this.scene.fog = new THREE.Fog('#1a1018', 12, 30);
    this.scene.add(new THREE.HemisphereLight('#ffe2b8', '#2a1a2a', 1.4));
    const key = new THREE.DirectionalLight('#ffd9a0', 2.2);
    key.position.set(3, 6, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#9a6aff', 1.2);
    rim.position.set(-4, 3, -4);
    this.scene.add(rim);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 2.2, 6.2);
    this.camera.lookAt(0, 0.85, 0);

    const floor = new THREE.Mesh(paint(new THREE.CircleGeometry(14, 40).rotateX(-Math.PI / 2), C('#2a1c22'), 0.1), MATS.flat);
    this.scene.add(floor);
    const rug = new THREE.Mesh(paint(new THREE.CylinderGeometry(1.6, 1.6, 0.04, 24), (p) => (Math.hypot(p.x, p.z) > 1.35 ? C('#c9a227') : C('#7a1020')), 0.04), MATS.flat);
    this.scene.add(rug);
    const deco = [
      [PROPS.crate(), -2.6, -1.6, 0.4],
      [PROPS.crate().translate(0, 1, 0), -2.6, -1.6, 0.9],
      [PROPS.barrel(), 2.7, -1.4, 0],
      [PROPS.lamp(), 3.4, -3, 0],
      [PROPS.car('#1d1d22'), -5.5, -4.5, 0.9],
    ];
    for (const [g, x, z, r] of deco) {
      const m = new THREE.Mesh(g, MATS.flat);
      m.position.set(x, 0, z);
      m.rotation.y = r;
      this.scene.add(m);
    }
    const spot = new THREE.PointLight('#ffcf7a', 12, 8);
    spot.position.set(0, 3.5, 1.5);
    this.scene.add(spot);

    this.model = null;
    this.t = 0;
    this.setHero(this.heroId);
  }

  setHero(id) {
    const h = heroById(id);
    if (!h || h.locked) return;
    this.heroId = id;
    Save.data.lastHero = id;
    Save.write();
    if (this.model) this.scene.remove(this.model.root);
    this.model = createHeroModel(h.model);
    this.model.root.scale.setScalar(1.5);
    this.scene.add(this.model.root);
    this.render();
  }

  show() {
    this.root.classList.remove('hidden');
    this.render();
  }

  hide() {
    this.root.classList.add('hidden');
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    // centre the hero inside the stage column
    const stage = this.root.querySelector('.hero-stage');
    const w = innerWidth, h = innerHeight;
    if (stage && w && h) {
      const r = stage.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height * 0.45;
      this.camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
      // fit the baby into the stage height
      const fit = Math.max(0.65, Math.min(1.25, r.height / 520));
      this.camera.position.set(0, 2.1, 8 / fit);
      this.camera.lookAt(0, 1.05, 0);
    }
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.t += dt;
    if (!this.model) return;
    this.model.root.rotation.y = Math.sin(this.t * 0.4) * 0.5 + 0.2;
    this.model.animator.update(dt, { move: 0, aiming: Math.sin(this.t * 0.5) > 0.6, shoot: 0, hurt: 0, dead: false });
  }

  // ── HTML ───────────────────────────────
  render() {
    const h = heroById(this.heroId);
    const prof = Save.hero(h.id);
    const pts = Save.talentPoints(h.id);
    const xpNext = heroXpToNext(prof.level, prof.asc);
    const maxed = prof.level >= HERO_MAX_LEVEL;
    const asc = (n) => (n > 0 ? ` <span class="asc" title="Ascension ${n}">✦${n}</span>` : '');
    this.root.innerHTML = '';
    const title = el('div', 'home-title', `<h1>THUGRATS</h1><div class="sub">the hideout</div><div class="spacer"></div><div class="rep-chip" title="Rep — account-wide, earned by every run">🤝 ${Save.rep} Rep</div>`);
    const mini = el('div', 'roster-mini');
    for (const hh of HEROES) {
      const b = el('button', `${hh.id === this.heroId ? 'sel' : ''} ${hh.locked ? 'locked' : ''}`, hh.locked ? '🔒' : hh.icon ?? '👶');
      b.title = hh.name;
      b.onclick = () => { if (!hh.locked) { sfx('click'); this.setHero(hh.id); } };
      mini.appendChild(b);
    }
    title.appendChild(mini);
    this.root.appendChild(title);

    // roster
    const roster = el('div', 'roster', '<h3>THE CREW</h3>');
    for (const hh of HEROES) {
      const lv = hh.locked ? '' : `LV ${Save.hero(hh.id).level}${asc(Save.hero(hh.id).asc)}`;
      const b = el('button', `hero-card ${hh.id === this.heroId ? 'sel' : ''} ${hh.locked ? 'locked' : ''}`,
        `<div class="face">${hh.locked ? '🔒' : hh.icon ?? '👶'}</div><div><div class="nm">${hh.name}</div><div class="tt">${hh.title}${hh.locked ? ' · coming soon' : ''}</div></div><div class="lv">${lv}</div>`);
      b.onclick = () => { if (!hh.locked) { sfx('click'); this.setHero(hh.id); } };
      roster.appendChild(b);
    }
    this.root.appendChild(roster);

    // stage
    const stage = el('div', 'hero-stage', `<div class="plate"><div class="tt">${h.title} · Level ${prof.level}${asc(prof.asc)}</div><h2>${h.name}</h2>
      <div class="hero-xp ${maxed ? 'full' : ''}"><i style="width:${maxed ? 100 : (prof.xp / xpNext) * 100}%"></i></div>
      <div class="note" style="margin:3px 0 0">${maxed ? 'LEVEL 50 — ready to ascend' : `${prof.xp} / ${xpNext} XP`} · ${prof.runs} runs</div>
      <div class="blurb">${h.blurb}</div></div>`);
    if (maxed) {
      const b = el('button', 'btn ascend-btn', `✦ Ascend to ${prof.asc + 1}`);
      b.title = 'Back to level 1 with your talents kept, +5 gear upgrade tokens, and pick your starting ability.';
      b.onclick = () => {
        sfx('click');
        if (!confirm(`Ascend ${h.name}?\n\nBack to level 1 (talents and gear are kept), Ascension ${prof.asc + 1}, +5 gear upgrade tokens, and you can choose your starting ability.`)) return;
        Save.ascend(h.id);
        sfx('levelup');
        this.render();
      };
      stage.querySelector('.plate').appendChild(b);
    }
    this.root.appendChild(stage);

    // side tabs
    const side = el('div', 'side');
    const tabs = el('div', 'tabs');
    for (const [id, label] of [['play', 'Play'], ['talents', 'Talents'], ['gear', 'Gear'], ['kit', 'Kit'], ['rep', 'Rep']]) {
      const b = el('button', this.tab === id ? 'on' : '', label + (id === 'talents' && pts.free > 0 ? `<span class="badge">${pts.free}</span>` : ''));
      b.onclick = () => { sfx('click'); this.tab = id; this.render(); };
      tabs.appendChild(b);
    }
    side.appendChild(tabs);
    const body = el('div', 'tab-body');
    side.appendChild(body);
    side.appendChild(el('div', 'pad-hint', 'Ⓐ select · LB / RB switch tabs · D-pad / stick to move'));
    this.root.appendChild(side);
    if (this.tab === 'play') this.renderPlay(body, h);
    if (this.tab === 'talents') this.renderTalents(body, h);
    if (this.tab === 'gear') this.renderGear(body, h);
    if (this.tab === 'kit') this.renderKit(body, h);
    if (this.tab === 'rep') this.renderRep(body);
    requestAnimationFrame(() => this.resize(innerWidth / innerHeight));
  }

  renderPlay(body, h) {
    const prof = Save.hero(h.id);
    if (prof.asc > 0) {
      const cur = prof.startAbility && h.abilities.some((a) => a.id === prof.startAbility) ? prof.startAbility : h.start;
      const pick = el('div', 'start-pick', '<div class="note" style="margin:0 0 6px">✦ <b>Starting ability</b> (unlocked by ascending)</div>');
      const row = el('div', 'start-row');
      for (const a of h.abilities) {
        const b = el('button', `start-ab ${a.id === cur ? 'on' : ''}`, a.icon);
        b.title = `${a.name} — ${a.desc}`;
        b.onclick = () => { sfx('click'); Save.setStartAbility(h.id, a.id); this.render(); };
        row.appendChild(b);
      }
      pick.appendChild(row);
      pick.appendChild(el('div', 'note', `Starts with <b>${h.abilities.find((a) => a.id === cur).name}</b>.`));
      body.appendChild(pick);
    }
    body.appendChild(el('div', 'note', 'Clear a map by killing its final Crime Titan. Each map\'s Crime Titans can drop pieces of this hero\'s gear set for that map.'));
    for (const m of MAPS) {
      const locked = m.requires && Save.bestClear(m.requires) < 0;
      const best = Save.bestClear(m.id);
      const set = h.sets.find((s) => s.map === m.id);
      const card = el('div', `map-card ${locked ? 'locked' : ''}`);
      const owned = set ? set.pieceList.filter((p) => Save.gearTier(h.id, p.id) >= 0).length : 0;
      const setHtml = set ? `<div class="set-drop"><div class="sd-head">${set.icon} <b>${set.name}</b> set <span class="muted">${owned}/5 · ${set.focusName}</span></div><div class="sd-row">${
        TITAN_DROPS.map((rule, ti) => `<div class="sd-titan" title="${BOSSES[m.titans[ti]?.boss]?.name ?? 'Titan'}: ${Math.round(rule.chance * 100)}% to drop a missing piece">${rule.slots.map((si) => {
          const p = set.pieceList[si], t = Save.gearTier(h.id, p.id);
          return `<span class="sd-pc ${t < 0 ? 'missing' : ''}" style="border-color:${t >= 0 ? tierColor(t) : '#444'}" title="${p.name}${t < 0 ? ' (missing)' : ''}">${p.icon}</span>`;
        }).join('')}<small>🗿${ti + 1} · ${Math.round(rule.chance * 100)}%</small></div>`).join('')}</div></div>` : '';
      card.innerHTML = `<h3>${m.name}</h3><div class="blurb">${locked ? `🔒 Clear ${MAPS.find((x) => x.id === m.requires).name} to unlock` : m.blurb}</div>
        <div class="meta"><span>🗿 ${m.titans.map((t) => BOSSES[t.boss].name).join(' · ')}</span></div>${setHtml}`;
      const diffs = el('div', 'diffs');
      DIFFICULTIES.forEach((d, i) => {
        const ok = !locked && (i === 0 || best >= i - 1);
        const b = el('button', 'diff-btn', `${d.name}${best >= i ? ' <span class="chk">✓</span>' : ''}`);
        b.style.background = d.color;
        b.disabled = !ok;
        b.title = ok ? `Monsters ×${d.hp} HP, ×${d.dmg} damage · hero XP ×${d.heroXp}` : 'Clear the previous difficulty first';
        b.onclick = () => { sfx('select'); this.onPlay(h.id, m.id, i); };
        diffs.appendChild(b);
      });
      card.appendChild(diffs);
      body.appendChild(card);
    }
  }

  spentIn(h, tree, belowRow = 99, talents = Save.hero(h.id).talents) {
    let n = 0;
    for (const t of h.talents) if (t.tree === tree && t.row < belowRow) n += talents[t.id] ?? 0;
    return n;
  }

  canLearn(h, t) {
    const prof = Save.hero(h.id);
    const r = prof.talents[t.id] ?? 0;
    return Save.talentPoints(h.id).free > 0 && r < t.max && this.spentIn(h, t.tree) >= t.row * 3;
  }

  canUnlearn(h, t) {
    const prof = Save.hero(h.id);
    const r = prof.talents[t.id] ?? 0;
    if (r <= 0) return false;
    const after = { ...prof.talents, [t.id]: r - 1 };
    return h.talents.every((o) => o.tree !== t.tree || !(after[o.id] > 0) || this.spentIn(h, o.tree, o.row, after) >= o.row * 3);
  }

  renderTalents(body, h) {
    const prof = Save.hero(h.id);
    const pts = Save.talentPoints(h.id);
    const head = el('div', 'tree-head', `<div class="pts">${pts.free} point${pts.free === 1 ? '' : 's'} free <span class="note">(${pts.spent}/${pts.total} spent)</span></div>`);
    const reset = el('button', 'btn ghost small', 'Respec');
    reset.onclick = () => { Save.resetTalents(h.id); this.selTalent = null; sfx('click'); this.render(); };
    head.appendChild(reset);
    body.appendChild(head);
    const trees = el('div', 'trees');
    for (const tr of h.trees) {
      const box = el('div', 'tree', `<h4 style="color:${tr.color}">${tr.icon} ${tr.name}<small>${this.spentIn(h, tr.id)} pts</small></h4>`);
      const grid = el('div', 'tgrid');
      for (const t of h.talents.filter((x) => x.tree === tr.id)) {
        const r = prof.talents[t.id] ?? 0;
        const unlocked = this.spentIn(h, t.tree) >= t.row * 3;
        const cls = ['talent', t.capstone ? 'cap' : '', r >= t.max ? 'max' : r > 0 ? 'some' : unlocked ? 'avail' : 'locked'].join(' ');
        const b = el('button', cls, `${t.icon}<span class="rk">${r}/${t.max}</span>${t.pair ? `<span class="pr">${h.abilities.find((a) => a.id === t.pair)?.icon ?? '🔗'}</span>` : ''}`);
        b.style.gridRow = t.row + 1;
        b.style.gridColumn = t.col + 1;
        if (this.selTalent === t.id) b.style.outline = '2px solid #fff';
        b.onclick = () => {
          sfx('click');
          if (this.selTalent === t.id && this.canLearn(h, t)) Save.setTalent(h.id, t.id, r + 1);
          this.selTalent = t.id;
          this.render();
        };
        b.oncontextmenu = (e) => {
          e.preventDefault();
          if (this.canUnlearn(h, t)) Save.setTalent(h.id, t.id, r - 1);
          this.selTalent = t.id;
          this.render();
        };
        grid.appendChild(b);
      }
      box.appendChild(grid);
      trees.appendChild(box);
    }
    body.appendChild(trees);
    const info = el('div', 'talent-info');
    const t = h.talents.find((x) => x.id === this.selTalent);
    if (t) {
      const r = prof.talents[t.id] ?? 0;
      const tr = h.trees.find((x) => x.id === t.tree);
      const pair = t.pair && h.abilities.find((a) => a.id === t.pair);
      info.innerHTML = `<b>${t.icon} ${t.name}</b> <span class="muted">${tr.name} · row ${t.row + 1}${t.row ? ` (needs ${t.row * 3} pts in branch)` : ''} · rank ${r}/${t.max}</span>
        ${pair ? `<div class="pair-tag">🔗 Pairs with ${pair.icon} ${pair.name} — only works in runs where you have it</div>` : ''}
        <div style="margin:4px 0">${t.desc(Math.max(1, r))}</div>${r < t.max && r > 0 ? `<div class="muted">Next rank: ${t.desc(r + 1)}</div>` : ''}`;
      const row = el('div', 'row');
      row.style.justifyContent = 'flex-start';
      row.style.marginTop = '6px';
      const add = el('button', 'btn small', '+ Learn');
      add.disabled = !this.canLearn(h, t);
      add.onclick = () => { Save.setTalent(h.id, t.id, r + 1); sfx('select'); this.render(); };
      const sub = el('button', 'btn ghost small', '− Unlearn');
      sub.disabled = !this.canUnlearn(h, t);
      sub.onclick = () => { Save.setTalent(h.id, t.id, r - 1); sfx('click'); this.render(); };
      row.append(add, sub);
      info.appendChild(row);
    } else {
      info.innerHTML = `<span class="muted">Tap a talent to read it, tap again to learn a rank (right-click to unlearn). You earn a point every hero level. Deeper rows need 3 points per row in that branch. Rows 6–8 are <b>pairing</b> talents (🔗): they make one ability set off another, so they only work when you take both in a run.</span>`;
    }
    body.appendChild(info);
  }

  renderGear(body, h) {
    const prof = Save.hero(h.id);
    const tierOf = (id) => Save.gearTier(h.id, id);
    const worn = GEAR_SLOTS.map((slot) => Save.equipped(h.id, slot));
    const sets = wornSets(h.sets, worn.filter(Boolean), tierOf);
    body.appendChild(el('div', 'note', `Each map drops <b>${h.name.split(' ')[0]}'s</b> set for that map: its Crime Titans can drop the pieces (see the Play tab). Wear one piece per slot; 2, 3 and 5 pieces of a set turn on its bonuses, and you can mix 2 + 3 from two sets. Ascending gives <b>upgrade tokens</b>: each raises a piece one rarity.`));
    // worn row + active bonuses
    const top = el('div', 'gear-top');
    top.innerHTML = `<div class="gear-worn">${GEAR_SLOTS.map((slot, i) => {
      const p = worn[i] && h.pieces.find((x) => x.id === worn[i]);
      return `<div class="gw ${p ? '' : 'empty'}" title="${slot}${p ? `: ${p.name}` : ' (empty)'}" style="border-color:${p ? tierColor(tierOf(p.id)) : '#444'}">${p ? p.icon : SLOT_ICON[slot]}<small>${slot}</small></div>`;
    }).join('')}<div class="tokens" title="Gear upgrade tokens (from ascending)">✦ ${prof.tokens} token${prof.tokens === 1 ? '' : 's'}</div></div>
      <div class="gear-bonuses">${sets.length ? sets.map((w) => `<div class="gb"><b>${w.set.icon} ${w.set.name}</b> <span class="muted">${w.count}/5 worn · bonuses ×${w.k.toFixed(2)}</span>${[2, 3, 5].map((n) => `<div class="gbl ${w.active.includes(n) ? 'on' : ''}">(${n}) ${w.set.bonus[n].desc(w.k)}</div>`).join('')}</div>`).join('') : '<div class="muted">No set pieces worn.</div>'}</div>`;
    body.appendChild(top);
    // grid: sets × slots
    const grid = el('div', 'gear-grid');
    grid.appendChild(el('div', 'gg-corner', ''));
    for (const slot of GEAR_SLOTS) grid.appendChild(el('div', 'gg-col', `${SLOT_ICON[slot]}<small>${slot}</small>`));
    for (const set of h.sets) {
      const map = MAPS.find((m) => m.id === set.map);
      const n = set.pieceList.filter((p) => tierOf(p.id) >= 0).length;
      const lab = el('button', `gg-set ${this.selPiece === set.id ? 'sel' : ''}`, `<span class="ic">${set.icon}</span><span><b>${set.name}</b><small>${map?.name ?? ''} · ${n}/5</small></span>`);
      lab.onclick = () => { sfx('click'); this.selPiece = set.id; this.render(); };
      grid.appendChild(lab);
      for (const p of set.pieceList) {
        const t = tierOf(p.id);
        const on = worn.includes(p.id);
        const b = el('button', `gg-pc ${t < 0 ? 'locked' : ''} ${on ? 'worn' : ''} ${this.selPiece === p.id ? 'sel' : ''}`, `${t < 0 ? '🔒' : p.icon}${t >= 0 ? `<i style="background:${tierColor(t)}"></i>` : ''}`);
        b.style.borderColor = t >= 0 ? tierColor(t) : '';
        b.title = `${p.name}${t >= 0 ? ` (${TIERS[t].name})` : ' — not found yet'}`;
        b.onclick = () => { sfx('click'); this.selPiece = p.id; this.render(); };
        grid.appendChild(b);
      }
    }
    body.appendChild(grid);
    // details for the selected piece or set
    const info = el('div', 'talent-info gear-info');
    const piece = h.pieces.find((p) => p.id === this.selPiece);
    const setSel = piece?.set ?? h.sets.find((s) => s.id === this.selPiece);
    if (setSel) {
      const map = MAPS.find((m) => m.id === setSel.map);
      let html = '';
      if (piece) {
        const t = tierOf(piece.id);
        const drop = TITAN_DROPS.findIndex((d) => d.slots.includes(piece.slotIndex));
        html += `<b style="color:${t >= 0 ? tierColor(t) : 'inherit'}">${piece.icon} ${piece.name}</b> <span class="muted">${piece.slot}${t >= 0 ? ` · ${TIERS[t].name}` : ''}</span>
          <div style="margin:4px 0">${t >= 0 ? pieceEffect(piece, t).desc : `<span class="muted">Not found yet. Drops from ${map?.name ?? 'its map'}'s Crime Titan #${drop + 1} (${Math.round(TITAN_DROPS[drop].chance * 100)}% per kill while missing).</span>`}</div>
          ${t >= 0 && t < 4 ? `<div class="muted">Next (${TIERS[t + 1].name}): ${pieceEffect(piece, t + 1).desc}</div>` : ''}`;
      }
      html += `<div class="gear-setinfo"><b>${setSel.icon} ${setSel.name}</b> <span class="muted">· ${map?.name ?? ''} · built around ${setSel.focusName}</span>${[2, 3, 5].map((n) => `<div class="gbl">(${n}) ${setSel.bonus?.[n]?.desc(1) ?? ''}</div>`).join('')}<div class="muted" style="font-size:11px">Bonus numbers grow up to ×2 with the rarity of the pieces you wear.</div></div>`;
      info.innerHTML = html;
      if (piece && tierOf(piece.id) >= 0) {
        const t = tierOf(piece.id);
        const on = worn.includes(piece.id);
        const row = el('div', 'row');
        row.style.justifyContent = 'flex-start';
        row.style.marginTop = '6px';
        const wear = el('button', `btn small ${on ? 'ghost' : ''}`, on ? 'Take off' : 'Wear');
        wear.onclick = () => { sfx('select'); Save.equip(h.id, piece.slot, on ? null : piece.id); this.render(); };
        const up = el('button', 'btn small', t >= 4 ? 'Legendary' : `Upgrade → ${TIERS[t + 1].name} (✦1)`);
        up.disabled = t >= 4 || prof.tokens <= 0;
        up.title = prof.tokens <= 0 ? 'Ascend to earn upgrade tokens' : '';
        up.onclick = () => { if (Save.upgradeGear(h.id, piece.id)) { sfx('levelup'); this.render(); } };
        row.append(wear, up);
        info.appendChild(row);
      }
    } else {
      info.innerHTML = '<span class="muted">Tap a piece (or a set name) to read it, wear it or upgrade it.</span>';
    }
    body.appendChild(info);
  }

  renderRep(body) {
    body.appendChild(el('div', 'note', `<b style="color:var(--gold);font-size:15px">🤝 ${Save.rep} Rep</b> · Rep is shared by your whole crew. Every run earns some (more for time survived, bosses, Crime Titans, clears and harder difficulties).`));
    let group = null;
    for (const u of ACCOUNT_UPGRADES) {
      if (u.group !== group) {
        group = u.group;
        body.appendChild(el('h3', 'rep-group', group === 'Pet' ? '🐾 Companion' : '📈 Run Boosts'));
      }
      const lvl = Save.acct(u.id);
      const maxed = lvl >= u.max;
      const locked = u.requires && !Save.acct(u.requires);
      const cost = maxed ? 0 : u.cost(lvl);
      const row = el('div', `rep-row ${locked ? 'locked' : ''}`);
      const pips = u.max > 1 ? `<div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>` : '';
      row.innerHTML = `<div class="ic">${u.icon}</div><div class="tx"><b>${u.name}</b>${pips}
        <div class="ds">${lvl > 0 ? (u.max > 1 ? `Now: ${u.desc(lvl)}` : u.desc(lvl)) : u.desc(u.max > 1 ? 1 : 0)}</div>
        ${!maxed && lvl > 0 ? `<div class="ds nx">Next: ${u.desc(lvl + 1)}</div>` : ''}
        ${locked ? '<div class="ds nx">Adopt Biscuit first</div>' : ''}</div>`;
      const b = el('button', 'btn small', maxed ? 'MAX' : `${cost} 🤝`);
      b.disabled = maxed || locked || Save.rep < cost;
      b.onclick = () => {
        if (Save.buyAcct(u)) { sfx('levelup'); this.render(); }
      };
      row.appendChild(b);
      body.appendChild(row);
    }
  }

  renderKit(body, h) {
    const prof = Save.hero(h.id);
    const sid = prof.asc > 0 && prof.startAbility ? prof.startAbility : h.start;
    body.appendChild(el('div', 'note', `Every run starts with <b>${h.abilities.find((a) => a.id === sid).name}</b>${prof.asc > 0 ? ' (change it in the Play tab)' : ' (ascend to choose)'}. Level-ups offer new abilities (up to 5 per run) or rarity-rolled upgrades to ones you have. Everything fires on its own — you just move.`));
    const list = el('div', 'ab-list');
    for (const a of h.abilities) {
      list.appendChild(el('div', 'ab-item', `<span class="ic">${a.icon}</span><div><b>${a.name}</b><span>${a.desc}</span></div>`));
    }
    body.appendChild(list);
  }
}
