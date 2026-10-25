'use strict';
/* ============================================================================
   SkyKerf_Studio · house constructor ("Конструктор")
   A Tinkercad-like plan where houses, towers, terraces, wall paths and
   cobbled paths are placed, sized and stacked; in the spirit of Tiny Glade
   the details come by themselves: roofs follow the footprint (ridge along the
   long side), windows follow wall size, towers grow at wall corners and a
   path drawn through a wall becomes a gate. "Generate" turns the scene into a
   real kit: every block is built by the house generator, walls become
   battlement panels on tabs, and a base plate carries engraved footprints,
   cobblestone paths and the slots for the walls.
   ============================================================================ */
const HK_TYPES = () => [['house', T('Дом', 'House'), 'house'], ['tower', T('Башня', 'Tower'), 'castle'], ['platform', T('Терраса', 'Terrace'), 'box'], ['wall', T('Стена', 'Wall'), 'line'], ['path', T('Дорожка', 'Path'), 'pen']];
const hkDefaults = (kind, preset) => { const g = GENS[kind], o = {}; for (const f of g.fields) if (f.def) o[f.k] = f.def(); if (g.presets) Object.assign(o, g.presets[(preset && preset.style) || o.style] || {}); Object.assign(o, preset || {}); if (g.migrate) g.migrate(o); return o };
const hkScene = () => [
  { id: 1, type: 'wall', pts: [[0, 0], [260, 0], [260, 190], [0, 190]], closed: true, h: 45, towers: true, ts: 44, crenel: true },
  { id: 2, type: 'path', pts: [[130, -60], [130, 60], [130, 92]], w: 18 },
  { id: 3, type: 'house', x: 130, y: 130, w: 110, d: 70, h: 60, rot: 0, roof: 'auto', style: 'fachwerk' },
  { id: 4, type: 'tower', x: 60, y: 70, w: 46, h: 120, rot: 0, roof: 'cone', style: 'tower' },
];
const hkFoot = b => { const w = b.type === 'tower' ? b.w : b.w, d = b.type === 'tower' ? b.w : b.d, a = (b.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, y]) => [b.x + x * c - y * s, b.y + x * s + y * c]) };
const hkTopH = b => b.type === 'platform' ? b.h : b.type === 'house' ? b.h + 3 : b.type === 'tower' ? b.h + 3 : 0;
/* elevation of every block: it stands on the highest earlier block under its centre (or its own z) */
function hkElev(blocks) {
  const z = new Map(), warn = [];
  for (const b of blocks) {
    if (b.type === 'wall' || b.type === 'path') { z.set(b.id, 0); continue }
    if (b.z > 0) { z.set(b.id, b.z); continue }
    let best = 0, under = null;
    for (const q of blocks) { if (q === b) break; if (q.type === 'wall' || q.type === 'path') continue; if (pointInPoly([b.x, b.y], hkFoot(q))) { const top = (z.get(q.id) || 0) + hkTopH(q); if (top > best) { best = top; under = q } } }
    z.set(b.id, best);
    if (under && under.type === 'house' && hkRoof(under) !== 'flat') warn.push(T(`Блок ${b.id} стоит на доме ${under.id} со скатной крышей — сделайте нижнему дому плоскую крышу.`, `Block ${b.id} stands on house ${under.id} with a pitched roof — give the lower house a flat roof.`));
  }
  return { z, warn };
}
const hkRoof = b => b.roof && b.roof !== 'auto' ? b.roof : (b.type === 'house' ? (b.w < 60 || b.d < 60 ? 'gable' : 'gable') : 'cone');
/* ---------------- editor ---------------- */
const HK = { tool: 'select', sel: null, draft: null, drag: null, hist: [], fut: [] };
function hkSave() { HK.hist.push(JSON.stringify(GS.o.blocks)); if (HK.hist.length > 80) HK.hist.shift(); HK.fut = [] }
function hkUndo(redo) { const from = redo ? HK.fut : HK.hist, to = redo ? HK.hist : HK.fut; if (!from.length) return; to.push(JSON.stringify(GS.o.blocks)); GS.o.blocks = JSON.parse(from.pop()); HK.sel = null; renderGenSide(); genDraw(); genRegen() }
function hkView(c, W, H) { // plan transform: mm → canvas
  if (!GS.pv || GS.pv.W !== W || GS.pv.H !== H) {
    let b = [-40, -80, 300, 220]; for (const q of GS.o.blocks) { const pts = q.pts || hkFoot(q); for (const p of pts) { b[0] = Math.min(b[0], p[0] - 30); b[1] = Math.min(b[1], p[1] - 30); b[2] = Math.max(b[2], p[0] + 30); b[3] = Math.max(b[3], p[1] + 30) } }
    const s = Math.min((W - 40) / (b[2] - b[0]), (H - 60) / (b[3] - b[1])); GS.pv = { W, H, s, ox: (W - (b[2] - b[0]) * s) / 2 - b[0] * s, oy: (H + (b[3] - b[1]) * s) / 2 + b[1] * s };
  }
  return GS.pv;
}
function hkMouse(e) { // event → plan mm
  const c = $('#genCv'), r = c.getBoundingClientRect(), vz = GS.v2 || { k: 1, dx: 0, dy: 0 }, pv = hkView(null, r.width, r.height);
  const cx = (e.clientX - r.left - r.width / 2 - vz.dx) / vz.k + r.width / 2, cy = (e.clientY - r.top - r.height / 2 - vz.dy) / vz.k + r.height / 2;
  return { x: (cx - pv.ox) / pv.s, y: (pv.oy - cy) / pv.s, tol: 7 / (pv.s * vz.k) };
}
const snap5 = v => Math.round(v / 5) * 5;
function hkPick(m) {
  const bl = GS.o.blocks;
  for (let i = bl.length - 1; i >= 0; i--) { const b = bl[i];
    if (b.pts) { for (let k = 0; k < b.pts.length; k++) if (Math.hypot(b.pts[k][0] - m.x, b.pts[k][1] - m.y) < m.tol * 1.4) return { b, vtx: k }; const n = b.closed ? b.pts.length : b.pts.length - 1; for (let k = 0; k < n; k++) { const a = b.pts[k], c = b.pts[(k + 1) % b.pts.length], dx = c[0] - a[0], dy = c[1] - a[1], L2 = dx * dx + dy * dy || 1, tt = clamp(((m.x - a[0]) * dx + (m.y - a[1]) * dy) / L2, 0, 1); if (Math.hypot(a[0] + dx * tt - m.x, a[1] + dy * tt - m.y) < Math.max(m.tol, (b.w || 8) / 2)) return { b } } }
    else { const f = hkFoot(b); if (HK.sel === b.id && Math.hypot(f[2][0] - m.x, f[2][1] - m.y) < m.tol * 1.6) return { b, corner: true }; if (pointInPoly([m.x, m.y], f)) return { b } }
  }
  return null;
}
const HK_EDITOR = {
  draw(c, W, H, vz) {
    const pv = hkView(c, W, H), P = (x, y) => [pv.ox + x * pv.s, pv.oy - y * pv.s], lw = 1 / vz.k;
    // grid
    c.save(); const x0 = -pv.ox / pv.s - 500, x1 = (W - pv.ox) / pv.s + 500, y0 = (pv.oy - H) / pv.s - 500, y1 = pv.oy / pv.s + 500;
    for (let x = Math.floor(x0 / 10) * 10; x < x1; x += 10) { c.strokeStyle = x % 50 ? css('--grid') : css('--grid-2'); c.lineWidth = lw; c.beginPath(); c.moveTo(...P(x, y0)); c.lineTo(...P(x, y1)); c.stroke() }
    for (let y = Math.floor(y0 / 10) * 10; y < y1; y += 10) { c.strokeStyle = y % 50 ? css('--grid') : css('--grid-2'); c.lineWidth = lw; c.beginPath(); c.moveTo(...P(x0, y)); c.lineTo(...P(x1, y)); c.stroke() }
    const { z } = hkElev(GS.o.blocks), poly = (pts, close) => { c.beginPath(); pts.forEach((p, i) => { const q = P(p[0], p[1]); i ? c.lineTo(...q) : c.moveTo(...q) }); if (close) c.closePath() };
    const order = GS.o.blocks.slice().sort((a, b) => (a.type === 'path' ? -1 : 0) - (b.type === 'path' ? -1 : 0) || (z.get(a.id) || 0) - (z.get(b.id) || 0));
    for (const b of order) {
      const sel = HK.sel === b.id;
      if (b.type === 'path') { c.strokeStyle = 'rgba(160,140,110,.55)'; c.lineWidth = b.w * pv.s; c.lineJoin = 'round'; c.lineCap = 'round'; poly(b.pts); c.stroke(); c.setLineDash([2 * lw, 3 * lw]); c.strokeStyle = sel ? css('--accent') : '#7a6a55'; c.lineWidth = lw; poly(b.pts); c.stroke(); c.setLineDash([]) }
      else if (b.type === 'wall') {
        c.strokeStyle = sel ? css('--accent') : '#8b8f97'; c.lineWidth = Math.max(3 * lw, 4 * pv.s); c.lineJoin = 'miter'; c.lineCap = 'butt'; poly(b.pts, b.closed); c.stroke();
        if (b.towers) for (const p of b.pts) { const q = P(p[0], p[1]), r = b.ts / 2 * pv.s; c.fillStyle = sel ? css('--accent') : '#a7abb3'; c.fillRect(q[0] - r, q[1] - r, 2 * r, 2 * r); c.strokeStyle = '#555'; c.lineWidth = lw; c.strokeRect(q[0] - r, q[1] - r, 2 * r, 2 * r) }
        if (sel) for (const p of b.pts) { const q = P(p[0], p[1]); c.fillStyle = '#fff'; c.strokeStyle = css('--accent'); c.lineWidth = 1.5 * lw; c.beginPath(); c.arc(q[0], q[1], 4 * lw, 0, TAU); c.fill(); c.stroke() }
      } else {
        const f = hkFoot(b), zz = z.get(b.id) || 0, col = b.type === 'platform' ? '#c9b48f' : b.type === 'tower' ? '#b5b9c2' : '#d9a074';
        c.fillStyle = col; poly(f, true); c.fill(); c.strokeStyle = sel ? css('--accent') : '#5a4a3a'; c.lineWidth = (sel ? 2.2 : 1.1) * lw; c.stroke();
        // roof hint: ridge along the long side, cross for towers
        c.strokeStyle = 'rgba(80,40,20,.55)'; c.lineWidth = lw;
        if (b.type === 'house' && hkRoof(b) !== 'flat') { const long = b.w >= b.d, m1 = long ? [(f[0][0] + f[3][0]) / 2, (f[0][1] + f[3][1]) / 2] : [(f[0][0] + f[1][0]) / 2, (f[0][1] + f[1][1]) / 2], m2 = long ? [(f[1][0] + f[2][0]) / 2, (f[1][1] + f[2][1]) / 2] : [(f[3][0] + f[2][0]) / 2, (f[3][1] + f[2][1]) / 2]; c.beginPath(); c.moveTo(...P(...m1)); c.lineTo(...P(...m2)); c.stroke() }
        if (b.type === 'tower') { c.beginPath(); c.moveTo(...P(...f[0])); c.lineTo(...P(...f[2])); c.moveTo(...P(...f[1])); c.lineTo(...P(...f[3])); c.stroke() }
        if (b.type === 'house') { const fr = P((f[0][0] + f[1][0]) / 2, (f[0][1] + f[1][1]) / 2); c.fillStyle = '#5a4a3a'; c.beginPath(); c.arc(fr[0], fr[1], 2.5 * lw, 0, TAU); c.fill() } // front door marker
        const cc = P(b.x, b.y); c.fillStyle = '#2a2420'; c.font = `${11 * lw}px var(--f-mono, monospace)`; c.textAlign = 'center'; c.fillText(`${b.id}${zz ? ' ↑' + Math.round(zz) : ''}`, cc[0], cc[1] + 4 * lw);
        if (sel) { const q = P(...f[2]); c.fillStyle = '#fff'; c.strokeStyle = css('--accent'); c.lineWidth = 1.5 * lw; c.fillRect(q[0] - 4 * lw, q[1] - 4 * lw, 8 * lw, 8 * lw); c.strokeRect(q[0] - 4 * lw, q[1] - 4 * lw, 8 * lw, 8 * lw) }
      }
    }
    if (HK.draft && HK.draft.pts.length) { c.strokeStyle = css('--accent'); c.setLineDash([4 * lw, 3 * lw]); c.lineWidth = 2 * lw; poly(HK.draft.pts.concat(HK.draft.hover ? [HK.draft.hover] : [])); c.stroke(); c.setLineDash([]) }
    c.restore();
  },
  down(e) {
    if (e.button !== 0) return false; const m = hkMouse(e);
    if (HK.tool === 'wall' || HK.tool === 'path') return false;
    if (HK.tool !== 'select') return false;
    const h = hkPick(m); if (!h) { if (HK.sel != null) { HK.sel = null; renderGenSide(); genDraw() } return false }
    HK.sel = h.b.id; hkSave(); HK.drag = { h, m0: m, orig: JSON.parse(JSON.stringify(h.b)), moved: false }; renderGenSide(); genDraw(); return true;
  },
  move(e) {
    const d = HK.drag; if (!d) return; const m = hkMouse(e), dx = m.x - d.m0.x, dy = m.y - d.m0.y, b = d.h.b, o = d.orig; d.moved = d.moved || Math.hypot(dx, dy) > .5;
    if (d.h.vtx != null) { b.pts[d.h.vtx] = [snap5(o.pts[d.h.vtx][0] + dx), snap5(o.pts[d.h.vtx][1] + dy)] }
    else if (b.pts) b.pts = o.pts.map(p => [snap5(p[0] + dx), snap5(p[1] + dy)]);
    else if (d.h.corner) { const a = -(b.rot || 0) * Math.PI / 180, lx = (m.x - o.x) * Math.cos(a) - (m.y - o.y) * Math.sin(a), ly = (m.x - o.x) * Math.sin(a) + (m.y - o.y) * Math.cos(a); if (b.type === 'tower') b.w = clamp(snap5(Math.max(lx, ly) * 2), 30, 400); else { b.w = clamp(snap5(lx * 2), 40, 600); b.d = clamp(snap5(ly * 2), 40, 600) } }
    else { b.x = snap5(o.x + dx); b.y = snap5(o.y + dy) }
    genDraw();
  },
  up() { const d = HK.drag; HK.drag = null; if (d && d.moved) { renderGenSide(); genRegen() } else if (d) HK.hist.pop() },
  click(e) {
    const m = hkMouse(e), x = snap5(m.x), y = snap5(m.y);
    if (HK.tool === 'wall' || HK.tool === 'path') { HK.draft = HK.draft || { type: HK.tool, pts: [] }; const pts = HK.draft.pts; if (pts.length > 2 && HK.tool === 'wall' && Math.hypot(pts[0][0] - x, pts[0][1] - y) < m.tol * 2) { hkFinish(true); return } if (!pts.length || Math.hypot(pts[pts.length - 1][0] - x, pts[pts.length - 1][1] - y) > 1) pts.push([x, y]); genDraw(); return }
    if (HK.tool === 'house' || HK.tool === 'tower' || HK.tool === 'platform') {
      hkSave(); const id = Math.max(0, ...GS.o.blocks.map(b => b.id)) + 1, st = GS.o.style || 'cottage';
      const b = HK.tool === 'house' ? { id, type: 'house', x, y, w: 100, d: 75, h: 60, rot: 0, roof: 'auto', style: st } : HK.tool === 'tower' ? { id, type: 'tower', x, y, w: 46, h: 120, rot: 0, roof: 'cone', style: 'tower' } : { id, type: 'platform', x, y, w: 160, d: 120, h: 30, rot: 0 };
      GS.o.blocks.push(b); HK.sel = id; HK.tool = 'select'; renderGenSide(); genDraw(); genRegen();
    }
  },
  hover(e) { if (HK.draft) { const m = hkMouse(e); HK.draft.hover = [snap5(m.x), snap5(m.y)]; genDraw() } },
};
function hkFinish(close) {
  const d = HK.draft; HK.draft = null; if (!d || d.pts.length < 2) { genDraw(); return }
  hkSave(); const id = Math.max(0, ...GS.o.blocks.map(b => b.id)) + 1;
  GS.o.blocks.push(d.type === 'wall' ? { id, type: 'wall', pts: d.pts, closed: !!close, h: 45, towers: true, ts: 44, crenel: true } : { id, type: 'path', pts: d.pts, w: 18 });
  HK.sel = id; HK.tool = 'select'; renderGenSide(); genDraw(); genRegen();
}
function hkAction(v) {
  if (!GS) return; const b = GS.o.blocks.find(q => q.id === HK.sel);
  if (v.startsWith('tool:')) { HK.tool = v.slice(5); HK.draft = null; if (GS.view !== 'plan') { GS.view = 'plan'; renderGenVb() } renderGenSide(); genDraw(); return }
  if (v === 'finish') { hkFinish(false); return }
  if (v === 'undo' || v === 'redo') { hkUndo(v === 'redo'); return }
  if (v.startsWith('sel:')) { HK.sel = +v.slice(4); renderGenSide(); genDraw(); return }
  if (v === 'fit') { GS.pv = null; GS.v2 = { k: 1, dx: 0, dy: 0 }; genDraw(); return }
  if (v === 'reset') { hkSave(); GS.o.blocks = hkScene(); HK.sel = null; GS.pv = null; renderGenSide(); genDraw(); genRegen(); return }
  if (v === 'clear') { hkSave(); GS.o.blocks = []; HK.sel = null; renderGenSide(); genDraw(); genRegen(); return }
  if (!b) return;
  hkSave();
  if (v === 'del') { GS.o.blocks = GS.o.blocks.filter(q => q !== b); HK.sel = null }
  if (v === 'rot' && !b.pts) b.rot = ((b.rot || 0) + 90) % 360;
  if (v === 'dup') { const id = Math.max(...GS.o.blocks.map(q => q.id)) + 1, c = JSON.parse(JSON.stringify(b)); c.id = id; if (c.pts) c.pts = c.pts.map(p => [p[0] + 20, p[1] - 20]); else { c.x += 20; c.y -= 20 } GS.o.blocks.push(c); HK.sel = id }
  if (v === 'up' || v === 'down') { const i = GS.o.blocks.indexOf(b), j = v === 'up' ? i + 1 : i - 1; if (j >= 0 && j < GS.o.blocks.length) { GS.o.blocks[i] = GS.o.blocks[j]; GS.o.blocks[j] = b } }
  renderGenSide(); genDraw(); genRegen();
}
function hkSet(key, el) {
  const b = GS && GS.o.blocks.find(q => q.id === HK.sel); if (!b) return; hkSave();
  b[key] = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : (numVal(el) ?? b[key]);
  renderGenSide(); genDraw(); genRegen();
}
function hkSideHtml(o) {
  const tools = [['select', T('Выбор', 'Select'), 'select']].concat(HK_TYPES().map(([k, n, i]) => [k, n, i]));
  const b = o.blocks.find(q => q.id === HK.sel), { z, warn } = hkElev(o.blocks);
  const nf = (lab, k, unit, step, min, max) => numF(lab, `data-hk="${k}" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''}`, b[k] ?? '', unit, step);
  let props = '';
  if (b) {
    const head = `<h4 class="gf-head">${esc((HK_TYPES().find(x => x[0] === b.type) || [0, b.type])[1])} ${b.id}${z.get(b.id) ? ` · ${T('стоит на высоте', 'stands at')} ${Math.round(z.get(b.id))} ${MM()}` : ''}</h4>`;
    if (b.type === 'house') props = head + `<div class="grid3">${nf(T('Ширина', 'Width'), 'w', MM(), 5, 40)}${nf(T('Глубина', 'Depth'), 'd', MM(), 5, 40)}${nf(T('Высота стен', 'Wall height'), 'h', MM(), 5, 25)}</div>` + selF(T('Стиль', 'Style'), 'data-hk="style"', H_STYLES(), b.style) + selF(T('Крыша', 'Roof'), 'data-hk="roof"', [['auto', T('сама (конёк вдоль длинной стороны)', 'auto (ridge along the long side)')], ['gable', T('двускатная', 'gable')], ['hip', T('вальмовая', 'hip')], ['shed', T('односкатная', 'shed')], ['flat', T('плоская (можно ставить сверху)', 'flat (can carry blocks)')], ['crenel', T('зубцы', 'battlements')]], b.roof || 'auto') + nf(T('Высота над землёй (0 — сама)', 'Elevation (0 — auto)'), 'z', MM(), 5, 0);
    else if (b.type === 'tower') props = head + `<div class="grid2">${nf(T('Сторона', 'Side'), 'w', MM(), 5, 30)}${nf(T('Высота', 'Height'), 'h', MM(), 5, 30)}</div>` + selF(T('Верх', 'Top'), 'data-hk="roof"', [['cone', T('шатёр со шпилем', 'pyramid with spire')], ['crenel', T('зубцы', 'battlements')], ['flat', T('плоский', 'flat')]], b.roof || 'cone') + selF(T('Стиль', 'Style'), 'data-hk="style"', H_STYLES(), b.style || 'tower') + nf(T('Высота над землёй (0 — сама)', 'Elevation (0 — auto)'), 'z', MM(), 5, 0);
    else if (b.type === 'platform') props = head + `<div class="grid3">${nf(T('Ширина', 'Width'), 'w', MM(), 5, 40)}${nf(T('Глубина', 'Depth'), 'd', MM(), 5, 40)}${nf(T('Высота', 'Height'), 'h', MM(), 5, 10)}</div><p class="note">${T('Блоки, поставленные на террасу, поднимутся на её высоту.', 'Blocks placed on the terrace are raised to its height.')}</p>`;
    else if (b.type === 'wall') props = head + `<div class="grid2">${nf(T('Высота', 'Height'), 'h', MM(), 5, 15)}${nf(T('Башни: сторона', 'Towers: side'), 'ts', MM(), 2, 24)}</div>` + chkF(T('Башни в углах и на концах', 'Towers at corners and ends'), 'data-hk="towers"', b.towers) + chkF(T('Зубцы', 'Battlements'), 'data-hk="crenel"', b.crenel) + chkF(T('Замкнутая', 'Closed loop'), 'data-hk="closed"', b.closed) + `<p class="note">${T('Тяните точки, чтобы менять форму. Дорожка, проведённая через стену, превращается в ворота.', 'Drag the points to reshape. A path drawn through the wall becomes a gate.')}</p>`;
    else if (b.type === 'path') props = head + nf(T('Ширина', 'Width'), 'w', MM(), 1, 6, 60) + `<p class="note">${T('Дорожка гравируется брусчаткой на основании; там, где она пересекает стену, появляются ворота.', 'The path is engraved as cobblestones on the base; where it crosses a wall a gate appears.')}</p>`;
    props += `<div class="grid3"><button class="btn" data-act="hk" data-v="rot" ${b.pts ? 'disabled' : ''}>${ic('rotr', 14)} 90°</button><button class="btn" data-act="hk" data-v="dup">${ic('copy', 14)} ${T('Копия', 'Copy')}</button><button class="btn bad" data-act="hk" data-v="del">${ic('trash', 14)}</button></div>`;
  }
  const hint = HK.tool === 'wall' || HK.tool === 'path' ? T('Кликайте по плану, ставя точки. Клик по первой точке замыкает стену, «Готово» или Enter — закончить, Esc — отмена.', 'Click on the plan to add points. Click the first point to close a wall, “Done” or Enter to finish, Esc to cancel.') : HK.tool !== 'select' ? T('Кликните по плану, чтобы поставить блок.', 'Click on the plan to place the block.') : T('Перетаскивайте блоки; квадратик в углу меняет размер. R — повернуть, Delete — удалить, Ctrl+Z — отменить.', 'Drag blocks; the corner square resizes. R rotates, Delete removes, Ctrl+Z undoes.');
  return `<div class="sec hk"><h3>${T('Конструктор', 'Constructor')}${infoBtn('houseKit')}</h3>
    <div class="hktools">${tools.map(([k, n, i]) => `<button class="btn ${HK.tool === k ? 'acc' : ''}" data-act="hk" data-v="tool:${k}" title="${esc(n)}">${ic(i, 15)}<span>${esc(n)}</span></button>`).join('')}</div>
    <p class="note">${hint}</p>${HK.draft ? `<div class="grid2"><button class="btn acc" data-act="hk" data-v="finish">${ic('check', 14)} ${T('Готово', 'Done')}</button><button class="btn" data-act="hk" data-v="tool:select">${T('Отмена', 'Cancel')}</button></div>` : ''}
    <div class="grid3"><button class="btn" data-act="hk" data-v="undo" ${HK.hist.length ? '' : 'disabled'}>${ic('undo', 14)}</button><button class="btn" data-act="hk" data-v="redo" ${HK.fut.length ? '' : 'disabled'}>${ic('redo', 14)}</button><button class="btn" data-act="hk" data-v="fit" title="${T('Показать всё', 'Fit')}">${ic('fit', 14)}</button></div>
    ${props}
    <div class="hklist">${o.blocks.map(q => `<button class="${q.id === HK.sel ? 'on' : ''}" data-act="hk" data-v="sel:${q.id}">${q.id}. ${esc((HK_TYPES().find(x => x[0] === q.type) || [0, q.type])[1])}${q.w && !q.pts ? ` ${q.w}×${q.d || q.w}` : ''}</button>`).join('')}</div>
    ${warn.map(w => `<div class="warnline">${ic('warn', 13)} ${esc(w)}</div>`).join('')}
    <div class="grid2"><button class="btn" data-act="hk" data-v="reset">${T('Пример: крепость', 'Example: fortress')}</button><button class="btn" data-act="hk" data-v="clear">${T('Очистить', 'Clear')}</button></div></div>`;
}
/* ---------------- generation ---------------- */
const rotZ = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
function segX(a, b, c, d) { const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-9) return null; const u = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, v = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den; return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? u : null }
GENS.houseKit = {
  icon: 'shapes', name: () => T('Конструктор домов и замков', 'House & castle constructor'), desc: () => T('Расставьте блоки — получите набор деталей', 'Place blocks — get a kit of parts'),
  editor: HK_EDITOR,
  fields: [
    { t: 'head', l: () => T('Набор', 'Kit') },
    { k: 'style', t: 'sel', l: () => T('Стиль новых домов', 'Style of new houses'), def: () => 'cottage', opts: H_STYLES },
    { k: 'detail', t: 'sel', l: () => T('Отделка', 'Finish'), def: () => 'full', opts: () => [['full', T('полная гравировка', 'full engraving')], ['light', T('только окна и двери (быстрее)', 'windows and doors only (faster)')]] },
    { k: 'base', t: 'chk', l: () => T('Общее основание с разметкой и брусчаткой', 'Common base with footprints and cobblestones'), def: () => true },
    ...jointFields(),
  ],
  sidePre: o => hkSideHtml(o),
  migrate(o) { if (!Array.isArray(o.blocks)) o.blocks = hkScene() },
  async make(o) {
    if (!hasClip()) throw new Error(T('Нужна библиотека Clipper — она не загрузилась.', 'The Clipper library did not load.'));
    const t = o.t, clr = fitValue(o), mk = markLayer(), parts = [], asm = [], steps = [], bom = [], { z: Z, warn } = hkElev(o.blocks), tw = Math.max(t * 2.5, 8);
    const paths = o.blocks.filter(b => b.type === 'path'), walls = o.blocks.filter(b => b.type === 'wall');
    const place = (r, label, at, a, zz) => { // building result → world (centre at, rotation a, elevation zz)
      const { W, D } = r.size;
      r.parts.forEach(p => parts.push(Object.assign({}, p, { name: `${label}: ${p.name}` })));
      for (const q of r.asm || []) { const o2 = rotZ([q.origin[0] - W / 2, q.origin[1] - D / 2, q.origin[2]], a); asm.push(Object.assign({}, q, { origin: [o2[0] + at[0], o2[1] + at[1], o2[2] + zz], u: rotZ(q.u, a), v: rotZ(q.v, a), n: rotZ(q.n, a) })) }
    };
    const light = o.detail === 'light', common = { t, fw: o.fw, fit: o.fit, fitC: o.fitC, fn: 'decor', fn2: 'none', fence: false };
    const building = async (pr) => { const p = hkDefaults('building', Object.assign({ style: pr.style }, common)); Object.assign(p, pr, common); if (light) { p.wall = 'none'; p.roofing = 'none'; p.motif = 'none'; p.winTrim = 'none' } const r = await GENS.building.make(p); r.size = { W: p.W, D: p.D }; return r };
    const towerParams = (w, h, roof, style) => { const fl = clamp(Math.round(h / 70), 1, 4); return { style: style || 'tower', W: w, D: w, floors: fl, fh: Math.max(25, (h - t) / fl), roof: roof === 'crenel' ? 'crenel' : roof === 'flat' ? 'flat' : 'hip', pitch: 64, ridge: roof === 'cone' ? 'spire' : 'none', win: 1, winSide: 1, ww: Math.min(10, w * .22), wh: Math.min(16, w * .3), winShape: 'arch', winBars: 'none', winTrim: 'none', doorShape: 'none', chimney: false, over: 4 } };
    let n = 0;
    for (const b of o.blocks) {
      const zz = Z.get(b.id) || 0, a = (b.rot || 0) * Math.PI / 180;
      if (b.type === 'house') {
        let W = b.w, D = b.d, rot = a, roof = hkRoof(b);
        if ((b.roof || 'auto') === 'auto' && W > D) { [W, D] = [D, W]; rot += Math.PI / 2 } // ridge along the long side: the generator puts the ridge along its depth
        const fl = clamp(Math.round(b.h / 65), 1, 4);
        const r = await building({ style: b.style || o.style, W, D, floors: fl, fh: Math.max(25, (b.h - t) / fl), roof, win: clamp(Math.round(W / 45), 1, 4), winSide: clamp(Math.round(D / 50), 0, 4), chimney: W * D > 6000 && roof === 'gable' });
        place(r, `${T('Дом', 'House')} ${b.id}`, [b.x, b.y], rot, zz); n++;
      } else if (b.type === 'tower') { const r = await building(towerParams(b.w, b.h, b.roof, b.style)); place(r, `${T('Башня', 'Tower')} ${b.id}`, [b.x, b.y], a, zz); n++ }
      else if (b.type === 'platform') {
        const r = await GENS.box.make({ W: b.w, D: b.d, H: b.h, dims: 'outer', top: 'closed', dx: 0, dy: 0, t, fw: o.fw, fit: o.fit, fitC: o.fitC, labels: true }); r.size = { W: b.w, D: b.d };
        place(r, `${T('Терраса', 'Terrace')} ${b.id}`, [b.x, b.y], a, zz); n++;
      }
    }
    /* walls: battlement panels between the towers; gates where paths cross */
    const baseSlots = [], footprints = [];
    for (const w of walls) {
      const pts = w.pts, segs = []; for (let i = 0; i < pts.length - (w.closed ? 0 : 1); i++) segs.push([pts[i], pts[(i + 1) % pts.length]]);
      if (w.towers) pts.forEach((p, i) => { const s0 = segs[Math.min(i, segs.length - 1)], ang = Math.atan2(s0[1][1] - s0[0][1], s0[1][0] - s0[0][0]); footprints.push({ p, ang, ts: w.ts, h: w.h }) });
      for (const [A, B] of segs) {
        const L0 = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L0 < 10) continue; const ux = (B[0] - A[0]) / L0, uy = (B[1] - A[1]) / L0, s0 = w.towers ? w.ts / 2 : 0, L = L0 - 2 * s0; if (L < 10) continue;
        let pnl = [rectPts(0, 0, L, w.h)]; const holes = [], tabs = [];
        if (w.crenel) { const mw = Math.max(t * 2.5, 7), cn = Math.max(3, Math.round(L / mw) | 1), md = Math.min(8, w.h * .18); for (let i = 1; i < cn; i += 2) holes.push(rectPts(L * i / cn, w.h - md, L / cn, md + 1)) }
        for (const pth of paths) for (let k = 0; k < pth.pts.length - 1; k++) { const u = segX(A, B, pth.pts[k], pth.pts[k + 1]); if (u == null) continue; const x = u * L0 - s0, gw = Math.min(pth.w * 1.25, L * .6), gh = Math.min(w.h * .72, gw * 1.6); if (x - gw / 2 > t && x + gw / 2 < L - t) holes.push(...outline('arch', x - gw / 2, -1, gw, gh + 1)) }
        const nt = Math.max(1, Math.round(L / 45)); for (let i = 0; i < nt; i++) { const x = L * (i + .5) / nt; if (holes.some(h => { const bb = bboxOf([h]); return x + tw / 2 > bb[0] - 2 && x - tw / 2 < bb[2] + 2 && bb[1] < 1 })) continue; tabs.push(rectPts(x - tw / 2, -t, tw, t + .01)); const cx = A[0] + ux * (s0 + x), cy = A[1] + uy * (s0 + x), hx = ux * (tw + clr) / 2, hy = uy * (tw + clr) / 2, nx = -uy * (t + clr) / 2, ny = ux * (t + clr) / 2; baseSlots.push([[cx - hx - nx, cy - hy - ny], [cx + hx - nx, cy + hy - ny], [cx + hx + nx, cy + hy + ny], [cx - hx + nx, cy - hy + ny]]) }
        if (o.base) pnl = boolOp(pnl, tabs, 'union'); if (holes.length) pnl = boolOp(pnl, holes, 'diff');
        const items = [{ layer: CUT, kind: 'part', paths: pnl, closed: true }];
        if (!light) { const sf = surface('stones', offsetPaths(boolOp([rectPts(0, 0, L, w.h)], holes.length ? offsetPaths(holes, 1.5) : [], 'diff'), -1.2), Math.max(3, w.h / 10), 5); if (sf.shapes.length) items.push({ layer: ENG, kind: 'part', paths: sf.shapes, closed: true }) }
        parts.push({ name: `${T('Стена', 'Wall')} ${w.id}`, items, req: curReq(t) });
        asm.push({ paths: pnl, origin: [A[0] + ux * s0 + uy * t / 2, A[1] + uy * s0 - ux * t / 2, 0], u: [ux, uy, 0], v: [0, 0, 1], n: [-uy, ux, 0], t, color: hslHex(30, 10, 62) });
      }
    }
    for (const f of footprints) { const r = await building(towerParams(f.ts, f.h * 1.55, 'cone', 'tower')); place(r, `${T('Башня стены', 'Wall tower')}`, f.p, f.ang, 0); n++ }
    /* base plate */
    if (o.base && o.blocks.length) {
      let b = null; const add = pts => { const bb = bboxOf([pts]); b = b ? unionBox(b, bb) : bb };
      for (const q of o.blocks) { if (q.pts) for (const p of q.pts) add([[p[0] - 30, p[1] - 30], [p[0] + 30, p[1] + 30]]); else add(hkFoot(q).map(p => p)) }
      b = [b[0] - 12, b[1] - 12, b[2] + 12, b[3] + 12];
      const tr = p => [p[0] - b[0], p[1] - b[1]], plate = boolOp([rectPts(0, 0, b[2] - b[0], b[3] - b[1], 6)], baseSlots.map(s => s.map(tr)), 'diff');
      const eng = [], fills = [];
      for (const q of o.blocks) if (!q.pts && !(Z.get(q.id) > 0)) eng.push(hkFoot(q).map(tr).concat([tr(hkFoot(q)[0])]));
      for (const f of footprints) { const h = f.ts / 2, c = Math.cos(f.ang), s = Math.sin(f.ang), sq = [[-h, -h], [h, -h], [h, h], [-h, h], [-h, -h]].map(([x, y]) => tr([f.p[0] + x * c - y * s, f.p[1] + x * s + y * c])); eng.push(sq) }
      for (const pth of paths) { const band = offsetOpen([pth.pts.map(tr)], pth.w / 2); const sf = surface('stones', band, Math.max(2.5, pth.w / 5), 7); eng.push(...sf.lines); fills.push(...sf.shapes) }
      const items = [{ layer: CUT, kind: 'part', paths: plate, closed: true }]; if (eng.length) items.push({ layer: mk, kind: 'part', paths: eng, closed: false }); if (fills.length) items.push({ layer: mk, kind: 'part', paths: fills.map(p => p.concat([p[0]])), closed: false });
      parts.push({ name: T('Основание', 'Base'), items, req: curReq(t) });
      asm.push({ paths: plate, origin: [b[0], b[1], 0], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], t, color: hslHex(95, 18, 58) });
      for (const a2 of asm) if (a2.paths !== plate) a2.origin = [a2.origin[0], a2.origin[1], a2.origin[2] + t]; // everything stands on the base
      steps.push(T('Основание: контуры на нём показывают, где стоит каждый дом и башня; дорожки выгравированы брусчаткой. Стены вставляются язычками в пазы основания.', 'Base: the outlines show where each house and tower stands; paths are engraved as cobblestones. Walls push their tabs into the base slots.'));
      bom.push(T(`Основание ${fx(b[2] - b[0], 0)}×${fx(b[3] - b[1], 0)} мм — если не помещается на лист, раскладка разнесёт детали, а основание можно склеить из частей.`, `Base ${fx(b[2] - b[0], 0)}×${fx(b[3] - b[1], 0)} mm — if it does not fit the sheet, cut it in parts and glue them.`));
    }
    if (!parts.length) throw new Error(T('Сцена пуста — добавьте дом, башню или стену.', 'The scene is empty — add a house, a tower or a wall.'));
    steps.unshift(T('Каждый дом и башня собирается по своей инструкции (детали подписаны номером блока), затем ставится на основание по выгравированному контуру.', 'Each house and tower is assembled on its own (parts carry the block number), then stood on the base along its engraved outline.'));
    return { parts, asm, steps, bom: bom.concat(warn), info: T(`${o.blocks.length} блоков → ${parts.length} деталей`, `${o.blocks.length} blocks → ${parts.length} parts`) };
  }
};
document.addEventListener('keydown', e => {
  if (!GS || GS.kind !== 'houseKit' || GS.view !== 'plan' || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
  if (e.key === 'Escape' && (HK.draft || HK.tool !== 'select')) { HK.draft = null; HK.tool = 'select'; renderGenSide(); genDraw(); e.preventDefault(); e.stopPropagation() }
  else if (e.key === 'Enter' && HK.draft) { hkFinish(false); e.preventDefault() }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && HK.sel != null) { hkAction('del'); e.preventDefault() }
  else if ((e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') && HK.sel != null && !e.ctrlKey && !e.metaKey) { hkAction('rot'); e.preventDefault() }
  else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'я')) { hkUndo(e.shiftKey); e.preventDefault(); e.stopPropagation() }
}, true);
