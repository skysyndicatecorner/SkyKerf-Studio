'use strict';
/* ============================================================================
   SkyKerf_Studio · houses, part 2
   - one tab strip for all house generators (house, layered house, dollhouse,
     furniture, constructor)
   - manual joints: pick an edge of one part (it gets tabs) and a place on
     another part (it gets matching slots) — e.g. roof ↔ wall
   ============================================================================ */
const HOUSE_GROUP = () => [['building', T('Домик', 'House')], ['houseLayers', T('Слоистый домик', 'Layered house')], ['dollhouse', T('Кукольный дом', 'Dollhouse')], ['furniture', T('Мебель', 'Furniture')], ['houseKit', T('Конструктор', 'Constructor')]];
function houseTabs(kind) {
  const g = HOUSE_GROUP(); if (!g.some(x => x[0] === kind)) return '';
  return `<div class="seg full gtabs htabs">${g.map(([k, n]) => `<button data-act="genSwitch" data-v="${k}" aria-pressed="${k === kind}">${n}</button>`).join('')}</div>`;
}

/* ---------------- manual joints ---------------- */
const cutItemOf = p => p.items.find(i => i.layer === CUT && i.closed && i.kind !== 'text');
function nearestEdge(paths, x, y) {
  let best = null;
  paths.forEach((p, pi) => { for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-12, tt = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1), d = Math.hypot(a[0] + dx * tt - x, a[1] + dy * tt - y); if (!best || d < best.d) best = { d, pi, i, a, b } } });
  return best;
}
/* find the edge again after the product was rebuilt: nearest segment to the stored midpoint with the same direction */
function findEdge(paths, j) {
  let best = null; const dir = Math.atan2(j.p1[1] - j.p0[1], j.p1[0] - j.p0[0]), mx = (j.p0[0] + j.p1[0]) / 2, my = (j.p0[1] + j.p1[1]) / 2;
  paths.forEach((p, pi) => { for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue; let da = Math.abs(Math.atan2(b[1] - a[1], b[0] - a[0]) - dir) % Math.PI; da = Math.min(da, Math.PI - da); const d = Math.hypot((a[0] + b[0]) / 2 - mx, (a[1] + b[1]) / 2 - my) + da * 20; if (!best || d < best.d) best = { d, pi, i, a, b } } });
  return best && best.d < 60 ? best : null;
}
function applyManualJoints(res, o) {
  const list = (o.mj || []).filter(j => j && j.p0), warn = [];
  if (!list.length || !res || !res.parts) return warn;
  const t = o.t || curThick(), clr = typeof fitValue === 'function' ? fitValue(o) : .05;
  list.forEach((j, k) => {
    const A = res.parts[j.a], B = res.parts[j.b]; if (!A || !B) { warn.push(T(`Соединение ${k + 1}: детали изменились — удалите и создайте заново.`, `Joint ${k + 1}: the parts changed — delete it and create it again.`)); return }
    const ia = cutItemOf(A), ib = cutItemOf(B); if (!ia || !ib) return;
    const e = findEdge(ia.paths, j); if (!e) { warn.push(T(`Соединение ${k + 1}: кромка не найдена.`, `Joint ${k + 1}: edge not found.`)); return }
    const p = ia.paths[e.pi], ccw = area(p) > 0, dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = ccw ? uy : -uy, ny = ccw ? -ux : ux;
    const w = Math.max(1, +j.w || Math.max(o.fw || 0, t * 2.5)), n = Math.max(1, (+j.n | 0) || Math.max(1, Math.round(L / (w * 3)))), dep = Math.max(.3, +j.d || t), ss = [];
    for (let i = 0; i < n; i++) ss.push(L * (i + .5) / n);
    const tabs = ss.map(s => { const c0 = [e.a[0] + ux * (s - w / 2), e.a[1] + uy * (s - w / 2)], c1 = [e.a[0] + ux * (s + w / 2), e.a[1] + uy * (s + w / 2)]; return [[c0[0] - nx * .02, c0[1] - ny * .02], [c1[0] - nx * .02, c1[1] - ny * .02], [c1[0] + nx * dep, c1[1] + ny * dep], [c0[0] + nx * dep, c0[1] + ny * dep]] });
    const oldA = ia.paths; ia.paths = boolOp(ia.paths, tabs, 'union');
    const an = (+j.ang || 0) * Math.PI / 180, vx = Math.cos(an), vy = Math.sin(an), qx = -vy, qy = vx, sw = w + clr, sh = (+j.sd || t) + clr;
    const slots = ss.map(s => { const cx = j.x + vx * (s - L / 2), cy = j.y + vy * (s - L / 2); return [[cx - vx * sw / 2 - qx * sh / 2, cy - vy * sw / 2 - qy * sh / 2], [cx + vx * sw / 2 - qx * sh / 2, cy + vy * sw / 2 - qy * sh / 2], [cx + vx * sw / 2 + qx * sh / 2, cy + vy * sw / 2 + qy * sh / 2], [cx - vx * sw / 2 + qx * sh / 2, cy - vy * sw / 2 + qy * sh / 2]] });
    const oldB = ib.paths; ib.paths = boolOp(ib.paths, slots, 'diff');
    for (const a of res.asm || []) { if (a.paths === oldA) a.paths = ia.paths; else if (a.paths === oldB) a.paths = ib.paths }
    j.L = L;
  });
  if (list.length) (res.steps = res.steps || []).push(T(`Ручные соединения: ${list.length} — вставьте язычки в пазы по номерам деталей.`, `Manual joints: ${list.length} — push the tabs into the slots, matching the part names.`));
  return warn;
}
function mjSideHtml() {
  if (!GS || !GS.g.manualJoints) return '';
  const js = GS.o.mj || [], names = (GS.res || GS.raw || { parts: [] }).parts.map(p => p.name), mode = GS.jmode;
  return `<div class="sec"><h3>${T('Ручные соединения', 'Manual joints')}${infoBtn('manualJoints')}</h3>
    <button class="btn block ${mode ? 'acc' : ''}" data-act="mjMode">${ic('joint', 14)} ${mode ? T('Отменить выбор', 'Cancel picking') : T('Добавить соединение', 'Add a joint')}</button>
    ${mode ? `<p class="note">${mode === 'edge' ? T('1) Кликните по кромке детали — на ней будут язычки.', '1) Click the edge of a part — it gets the tabs.') : T('2) Кликните по детали, где нужны пазы (например, по скату крыши). Линию пазов можно повернуть ниже.', '2) Click the part that gets the slots (e.g. a roof slope). The slot line can be rotated below.')}</p>` : ''}
    ${js.map((j, i) => `<div class="mjrow"><b>${i + 1}. ${esc(names[j.a] || '?')} → ${esc(names[j.b] || '?')}</b>
      <div class="grid3">${numF(T('Язычков', 'Tabs'), `data-mj="${i}:n" min="1" max="20"`, j.n || '', '', 1)}${numF(T('Ширина', 'Width'), `data-mj="${i}:w" min="1"`, j.w || '', MM(), .5)}${numF(T('Угол пазов', 'Slot angle'), `data-mj="${i}:ang"`, j.ang || 0, '°', 15)}
      ${numF('X', `data-mj="${i}:x"`, fx(j.x, 1), MM(), .5)}${numF('Y', `data-mj="${i}:y"`, fx(j.y, 1), MM(), .5)}<div class="fld" style="align-self:end"><button class="btn" data-act="mjDel" data-v="${i}" title="${T('Удалить', 'Delete')}">${ic('trash', 14)}</button></div></div></div>`).join('') || `<p class="note">${T('Например: язычки на верхней кромке стены и пазы в скате крыши. Соединения сохраняются вместе с параметрами изделия.', 'For example: tabs on the top edge of a wall and slots in a roof slope. Joints are saved with the product parameters.')}</p>`}</div>`;
}
/* the 2D parts layout is stored by genDraw; convert a screen point to part-local coordinates */
function genHit(ev) {
  const L = GS && GS.layout; if (!L) return null; const c = $('#genCv'), r = c.getBoundingClientRect(), vz = GS.v2 || { k: 1, dx: 0, dy: 0 };
  const cx = (ev.clientX - r.left - r.width / 2 - vz.dx) / vz.k + r.width / 2, cy = (ev.clientY - r.top - r.height / 2 - vz.dy) / vz.k + r.height / 2;
  const X = (cx - L.ox) / L.s, Y = (L.oy - cy) / L.s, out = [];
  GS.res.parts.forEach((p, i) => { const b = L.boxes[i], lx = X - L.pos[i][0], ly = Y - L.pos[i][1], m = 4 / (L.s * vz.k); if (lx >= b[0] - m && lx <= b[2] + m && ly >= b[1] - m && ly <= b[3] + m) out.push({ i, x: lx, y: ly, tol: 8 / (L.s * vz.k) }) });
  return out;
}
function mjClick(ev) {
  const hits = genHit(ev); if (!hits || !hits.length) return;
  if (GS.jmode === 'edge') {
    let best = null; for (const h of hits) { const it = cutItemOf(GS.res.parts[h.i]); if (!it) continue; const e = nearestEdge(it.paths, h.x, h.y); if (e && e.d <= h.tol * 1.5 && (!best || e.d < best.e.d)) best = { h, e } }
    if (!best) { toast(T('Кликните точнее по линии кромки.', 'Click closer to the edge line.')); return }
    GS.jpick = { a: best.h.i, p0: best.e.a.slice(), p1: best.e.b.slice() }; GS.jmode = 'place'; renderGenSide(); genDraw(); return;
  }
  if (GS.jmode === 'place') {
    const h = hits.find(q => { const it = cutItemOf(GS.res.parts[q.i]); return it && it.paths.some(p => pointInPoly([q.x, q.y], p)) }) || hits[0];
    const it = cutItemOf(GS.res.parts[h.i]), e = it ? nearestEdge(it.paths, h.x, h.y) : null, ang = e ? Math.round(Math.atan2(e.b[1] - e.a[1], e.b[0] - e.a[0]) * 180 / Math.PI / 15) * 15 : 0;
    (GS.o.mj = GS.o.mj || []).push(Object.assign({ b: h.i, x: +fx(h.x, 2), y: +fx(h.y, 2), ang: ((ang % 180) + 180) % 180, n: 0, w: 0 }, GS.jpick));
    GS.jmode = null; GS.jpick = null; mjRefresh();
  }
}
function cloneRes(r) { try { return structuredClone(r) } catch (e) { return deepCopy(r) } }
function mjRefresh() { if (!GS) return; if (GS.raw) { const r = cloneRes(GS.raw); GS.mjWarn = applyManualJoints(r, GS.o); GS.res = r } renderGenSide(); genDraw() }
function mjDrawOverlay(c, L, vz) {
  if (!GS || !GS.g.manualJoints) return; const P = (i, x, y) => [L.ox + (x + L.pos[i][0]) * L.s, L.oy - (y + L.pos[i][1]) * L.s];
  c.save(); c.lineWidth = 2.5 / vz.k; c.strokeStyle = '#e5484d';
  if (GS.jpick) { const [x0, y0] = P(GS.jpick.a, ...GS.jpick.p0), [x1, y1] = P(GS.jpick.a, ...GS.jpick.p1); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke() }
  c.setLineDash([5 / vz.k, 4 / vz.k]); c.lineWidth = 1.2 / vz.k; c.strokeStyle = '#3e8ef7';
  for (const j of GS.o.mj || []) { if (!GS.res.parts[j.b] || !j.L) continue; const an = (+j.ang || 0) * Math.PI / 180, h = j.L / 2, [x0, y0] = P(j.b, j.x - Math.cos(an) * h, j.y - Math.sin(an) * h), [x1, y1] = P(j.b, j.x + Math.cos(an) * h, j.y + Math.sin(an) * h); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke() }
  c.restore();
}
function pointInPoly(pt, poly) { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins } return ins }
GENS.building.manualJoints = true;
