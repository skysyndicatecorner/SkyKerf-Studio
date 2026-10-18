'use strict';
/* ============================================================================
   SkyKerf_Studio · CAD canvas: view, sheets on the bed, drawing tools,
   selection, transforms, context menu, editing commands, tiling of large parts
   ============================================================================ */
const cv = $('#cv'), ctx = cv.getContext('2d'); let CW = 0, CH = 0, DPR = 1;
let V = { s: 2, ox: 60, oy: 500, fitted: false };
let drag = null, spaceDown = false, penPts = null, cursorW = null, measure = null, toolSticky = false, clip = null;
const toolOpt = { radius: 0, sides: 6, points: 5, inner: 45, text: 'SkyKerf', font: 'unb', size: 12, lock: true, off: 2, ac: 3, ar: 2, ag: 5, cc: 8, cr: 40 };
function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() }
function resize() { const r = $('#stage').getBoundingClientRect(); if (!r.width || !r.height) return; DPR = window.devicePixelRatio || 1; CW = r.width; CH = r.height; cv.width = Math.round(CW * DPR); cv.height = Math.round(CH * DPR); if (!V.fitted) { fitPlate(curPlate); V.fitted = true } draw() }
function fitBox(b, pad = 60, bottom = 0) { const s = Math.min((CW - pad * 2) / (b[2] - b[0] || 1), (CH - pad * 2 - bottom) / (b[3] - b[1] || 1)); V.s = clamp(s, .05, 200); V.ox = (CW - (b[2] - b[0]) * V.s) / 2 - b[0] * V.s; V.oy = (CH - bottom) / 2 + (b[3] + b[1]) / 2 * V.s }
function fitPlate(i) { if (!CW) return; const m = S.machine, x = plateX(i); fitBox([x, 0, x + m.w, m.h], tab === 'cad' ? 64 : 44, tab === 'gcode' ? 50 : 0); P.sc = Math.min(CW, CH) / Math.max(m.w, m.h) * .85; P.panX = 0; P.panY = 0 }
function fitAll() { const m = S.machine, park = S.shapes.some(s => s.parked); fitBox([0, park ? -m.h * .45 : 0, plateX(S.sheets.length - 1) + m.w, m.h], 56, 0) }
const w2s = (x, y, v = V) => [v.ox + x * v.s, v.oy - y * v.s];
const s2w = (px, py) => [(px - V.ox) / V.s, (V.oy - py) / V.s];
let rq = 0; function draw() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; try { drawNow() } catch (e) { logError('draw', e) } }) }
function drawNow() {
  if (tab === 'machine') { drawMachineCanvas(); return }
  if (!CW) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, CW, CH);
  if (tab === 'gcode' && P.mode === '3d') { draw3D(ctx, CW, CH); return }
  if (tab === 'cad') { for (let i = 0; i < S.sheets.length; i++)drawBed(ctx, V, CW, CH, i); drawParkArea(); drawShapes(ctx, V, 1); drawSelection(); drawTemp() }
  else {
    const pl = tab === 'gcode' ? (P.file ? 0 : P.plate) : curPlate; drawBed(ctx, V, CW, CH, pl); const ox = P.file ? 0 : plateX(pl);
    if (tab === 'cam') { drawShapes(ctx, V, .32, curPlate); drawMoves(ctx, p => w2s(p[0] + ox, p[1]), P.total, true) }
    else { drawMoves(ctx, p => w2s(p[0] + ox, p[1]), P.t, false); drawHead2D(ctx, p => w2s(p[0] + ox, p[1]), P.t) }
  }
}
function niceStep(px) { for (const s of [.5, 1, 2, 5, 10, 20, 50, 100, 200, 500]) if (s * px >= 9) return s; return 1000 }
function drawBed(c, v, W, H, pi = 0, bare) {
  const m = S.machine, X = plateX(pi), [x0, y0] = w2s(X, m.h, v), [x1, y1] = w2s(X + m.w, 0, v);
  if (x1 < -40 || x0 > W + 40) return;
  c.fillStyle = css('--bed'); c.fillRect(x0, y0, x1 - x0, y1 - y0);
  const st = niceStep(v.s), maj = st * (st === .5 || st === 5 || st === 50 ? 2 : 5); c.lineWidth = 1;
  for (const [step, col] of [[st, css('--grid')], [maj, css('--grid-2')]]) {
    if (step * v.s < 4) continue; c.strokeStyle = col; c.beginPath();
    for (let x = 0; x <= m.w + 1e-6; x += step) { const sx = Math.round(v.ox + (X + x) * v.s) + .5; if (sx < -1 || sx > W + 1) continue; c.moveTo(sx, Math.max(y0, 0)); c.lineTo(sx, Math.min(y1, H)) }
    for (let y = 0; y <= m.h + 1e-6; y += step) { const sy = Math.round(v.oy - y * v.s) + .5; if (sy < -1 || sy > H + 1) continue; c.moveTo(Math.max(x0, 0), sy); c.lineTo(Math.min(x1, W), sy) } c.stroke()
  }
  if (!bare) {
    const sh = sheetAt(pi), [a, b] = w2s(X + sh.x, sh.y + sh.h, v), [a2, b2] = w2s(X + sh.x + sh.w, sh.y, v), mat = matById(sh.mat);
    c.fillStyle = css('--sheet'); c.fillRect(a, b, a2 - a, b2 - b); c.strokeStyle = css('--sheet-line'); c.setLineDash([6, 4]); c.strokeRect(a + .5, b + .5, a2 - a, b2 - b); c.setLineDash([]);
    if (sh.margin > 0 && sh.margin * v.s > 3) { const mg = sh.margin * v.s; c.strokeStyle = css('--sheet-line'); c.globalAlpha = .35; c.setLineDash([2, 4]); c.strokeRect(a + mg + .5, b + mg + .5, a2 - a - 2 * mg, b2 - b - 2 * mg); c.setLineDash([]); c.globalAlpha = 1 }
    for (const z of sh.zones || []) { const [za, zb] = w2s(X + z.x, z.y + z.h, v), zw = z.w * v.s, zh = z.h * v.s; c.save(); c.beginPath(); c.rect(za, zb, zw, zh); c.clip(); c.fillStyle = 'rgba(229,72,77,.12)'; c.fillRect(za, zb, zw, zh); c.strokeStyle = 'rgba(229,72,77,.55)'; c.lineWidth = 1; c.beginPath(); for (let t = -zh; t < zw; t += 8) { c.moveTo(za + t, zb + zh); c.lineTo(za + t + zh, zb) } c.stroke(); c.restore(); c.strokeStyle = 'rgba(229,72,77,.8)'; c.strokeRect(za + .5, zb + .5, zw, zh) }
    if (a2 - a > 120) { c.fillStyle = css('--sheet-line'); c.font = `10.5px ${css('--f-mono')}`; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(`${matLabel(mat, sh.thick)} · ${fx(sh.w, 1)}×${fx(sh.h, 1)}`, a2 - 6, b2 - 4) }
  }
  const active = pi === curPlate && S.sheets.length > 1 && tab === 'cad';
  c.strokeStyle = active ? css('--accent') : css('--line-2'); c.lineWidth = active ? 1.5 : 1; c.strokeRect(Math.round(x0) + .5, Math.round(y0) + .5, Math.round(x1 - x0), Math.round(y1 - y0)); c.lineWidth = 1;
  c.fillStyle = css('--muted'); c.font = `10.5px ${css('--f-mono')}`; c.textAlign = 'center'; c.textBaseline = 'top';
  const lab = maj * (maj * v.s < 40 ? 2 : 1);
  for (let x = 0; x <= m.w + 1e-6; x += lab) { const sx = v.ox + (X + x) * v.s; if (sx > 8 && sx < W - 8 && sx >= x0 - 1 && sx <= x1 + 1) c.fillText(fx(x, 1), sx, y1 + 5) }
  c.textAlign = 'right'; c.textBaseline = 'middle'; if (x0 - 6 > 8) for (let y = lab; y <= m.h + 1e-6; y += lab) { const sy = v.oy - y * v.s; if (sy > 8 && sy < H - 8) c.fillText(fx(y, 1), x0 - 6, sy) }
  if (!bare && (S.sheets.length > 1 || sheetAt(pi).name)) { c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillStyle = pi === curPlate ? css('--accent') : css('--muted'); c.font = `600 12px ${css('--f-ui')}`; c.fillText(sheetName(sheetAt(pi), pi), x0, y0 - 6) }
  c.fillStyle = css('--accent'); c.beginPath(); c.arc(x0, y1, 3.5, 0, Math.PI * 2); c.fill();
}
function drawParkArea() {
  const parked = S.shapes.filter(s => s.parked); if (!parked.length) return;
  const b = bboxOf(parked.flatMap(s => s.paths)), [x0, y0] = w2s(b[0] - 6, b[3] + 6), [x1, y1] = w2s(b[2] + 6, b[1] - 6);
  ctx.strokeStyle = css('--warn'); ctx.setLineDash([5, 4]); ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); ctx.setLineDash([]);
  ctx.fillStyle = css('--warn'); ctx.font = `600 11.5px ${css('--f-ui')}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(T(`Неразмещённые (${parked.length}) — перетащите на лист`, `Unplaced (${parked.length}) — drag onto a sheet`), x0, y0 - 4);
}
function tracePath(c, p, closed, v = V) { for (let i = 0; i < p.length; i++) { const [x, y] = w2s(p[i][0], p[i][1], v); i ? c.lineTo(x, y) : c.moveTo(x, y) } if (closed) c.closePath() }
function hexA(hex, a) { const n = parseInt(String(hex).slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})` }
function drawShapes(c, v, alpha, onlyPlate) {
  for (const s of S.shapes) {
    const L = S.layers[s.layer]; if (!L || !L.show) continue; if (onlyPlate != null && (s.parked || plateOf(s) !== onlyPlate)) continue;
    if (s.kind === 'image') { drawImageShape(c, v, s, alpha); continue }
    if (s.kind === 'relief') { drawReliefShape(c, v, s, alpha); continue }
    c.beginPath(); for (const p of s.paths) tracePath(c, p, s.closed, v);
    const fill = s.closed && layerOut(L) && (isLaser() ? (L.type === 'fill' || L.type === 'raster') : (L.cnc.op === 'pocket' || L.cnc.op === 'vcarve'));
    if (fill) { c.fillStyle = hexA(L.color, .16 * alpha); c.fill('evenodd') }
    c.globalAlpha = alpha * (s.parked ? .55 : 1); c.strokeStyle = L.color; c.lineWidth = sel.has(s.id) && tab === 'cad' ? 2 : 1.3; if (!layerOut(L) || !L.on) c.setLineDash([5, 4]); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    if (s.lock && tab === 'cad') { const b = bboxOf(s.paths), [px, py] = w2s(b[2], b[3], v); c.fillStyle = css('--muted'); c.font = `11px ${css('--f-ui')}`; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText('🔒', px, py - 1) }
  }
}
function drawImageShape(c, v, s, alpha) {
  const b = bboxOf(s.paths), [x0, y0] = w2s(b[0], b[3], v), [x1, y1] = w2s(b[2], b[1], v), pc = imagePreview(s, !!(s.img && s.img.actual));
  c.globalAlpha = alpha * .95; if (pc) { c.imageSmoothingEnabled = !(s.img && s.img.actual); c.drawImage(pc, x0, y0, x1 - x0, y1 - y0); c.imageSmoothingEnabled = true } c.globalAlpha = 1;
  c.strokeStyle = S.layers[s.layer].color; c.lineWidth = sel.has(s.id) && tab === 'cad' ? 2 : 1; c.setLineDash([3, 3]); c.strokeRect(x0 + .5, y0 + .5, x1 - x0, y1 - y0); c.setLineDash([]);
}

/* ---------------- selection ---------------- */
function selBox() { let b = null; for (const s of S.shapes) if (sel.has(s.id)) { const x = bboxOf(s.paths); b = b ? unionBox(b, x) : x } return b }
const selShapes = () => S.shapes.filter(s => sel.has(s.id));
function handlePts(b) { const [x0, y1] = w2s(b[0], b[1]), [x1, y0] = w2s(b[2], b[3]), mx = (x0 + x1) / 2, my = (y0 + y1) / 2; return { nw: [x0, y0], n: [mx, y0], ne: [x1, y0], e: [x1, my], se: [x1, y1], s: [mx, y1], sw: [x0, y1], w: [x0, my], rot: [mx, y0 - 24] } }
function drawSelection() {
  const b = selBox(); if (!b) return; const h = handlePts(b), ac = css('--accent'), locked = selShapes().some(s => s.lock);
  ctx.strokeStyle = ac; ctx.setLineDash([5, 4]); ctx.lineWidth = 1; ctx.strokeRect(h.nw[0] - .5, h.nw[1] - .5, h.se[0] - h.nw[0] + 1, h.se[1] - h.nw[1] + 1); ctx.setLineDash([]);
  if (!locked) {
    ctx.beginPath(); ctx.moveTo(h.n[0], h.n[1]); ctx.lineTo(h.rot[0], h.rot[1]); ctx.stroke(); ctx.fillStyle = css('--raised'); ctx.lineWidth = 1.5;
    for (const k of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) { const [x, y] = h[k]; ctx.fillRect(x - 4, y - 4, 8, 8); ctx.strokeRect(x - 4, y - 4, 8, 8) }
    ctx.beginPath(); ctx.arc(h.rot[0], h.rot[1], 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = ac; ctx.font = `11px ${css('--f-mono')}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(`${fx(b[2] - b[0], 1)} × ${fx(b[3] - b[1], 1)} ${MM()}${locked ? ' · ' + T('закреплено', 'locked') : ''}`, h.s[0], h.s[1] + 9);
}
function drawTemp() {
  const ac = css('--accent'); ctx.strokeStyle = ac; ctx.lineWidth = 1.4;
  if (drag && drag.k === 'draw') { const sh = buildShape(drag.start, drag.cur, drag.shift); if (sh) { ctx.beginPath(); for (const p of sh.paths) tracePath(ctx, p, sh.closed); if (tool === 'zone') { ctx.fillStyle = 'rgba(229,72,77,.15)'; ctx.fill() } ctx.stroke(); const b = bboxOf(sh.paths), [sx, sy] = w2s(b[2], b[1]); ctx.fillStyle = ac; ctx.font = `11px ${css('--f-mono')}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`${fx(b[2] - b[0], 1)} × ${fx(b[3] - b[1], 1)}`, sx + 8, sy + 6) } }
  if (drag && drag.k === 'marquee') { const a = w2s(...drag.start), b = w2s(...drag.cur), cross = drag.cur[0] < drag.start[0]; ctx.setLineDash(cross ? [4, 3] : []); ctx.fillStyle = css('--accent-soft'); ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); ctx.strokeRect(a[0] + .5, a[1] + .5, b[0] - a[0], b[1] - a[1]); ctx.setLineDash([]) }
  if (penPts && penPts.length) { ctx.beginPath(); tracePath(ctx, cursorW ? penPts.concat([snapP(cursorW)]) : penPts, false); ctx.stroke(); ctx.fillStyle = ac; for (const p of penPts) { const [x, y] = w2s(...p); ctx.fillRect(x - 3, y - 3, 6, 6) } }
  if (measure) {
    const a = w2s(...measure.a), b = w2s(...measure.b), d = Math.hypot(measure.b[0] - measure.a[0], measure.b[1] - measure.a[1]), ang = Math.atan2(measure.b[1] - measure.a[1], measure.b[0] - measure.a[0]) * 180 / Math.PI;
    ctx.strokeStyle = css('--info'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); for (const p of [a, b]) { ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2); ctx.stroke() }
    const t = `${fx(d, 2)} ${MM()} · ${fx(ang, 1)}° · ΔX ${fx(measure.b[0] - measure.a[0], 2)} ΔY ${fx(measure.b[1] - measure.a[1], 2)}`; ctx.font = `11.5px ${css('--f-mono')}`; const tw = ctx.measureText(t).width;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - 16; ctx.fillStyle = css('--panel'); ctx.fillRect(mx - tw / 2 - 6, my - 10, tw + 12, 20); ctx.fillStyle = css('--info'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, mx, my)
  }
  if (cursorW && tool !== 'select' && tool !== 'hand' && !drag) { const [x, y] = w2s(...snapP(cursorW)); ctx.strokeStyle = ac; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke() }
}

/* ---------------- interaction ---------------- */
const snapV = v => S.snapOn ? Math.round(v / S.snap) * S.snap : v;
const snapP = p => [snapV(p[0]), snapV(p[1])];
function buildShape(a, b, shift) {
  let [x0, y0] = a, [x1, y1] = b; const dx = x1 - x0, dy = y1 - y0;
  if (tool === 'rect' || tool === 'ellipse' || tool === 'zone') {
    let w = dx, h = dy; if (shift) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m }
    const x = Math.min(x0, x0 + w), y = Math.min(y0, y0 + h), W = Math.abs(w), H = Math.abs(h); if (W < .2 && H < .2) return null;
    return tool === 'ellipse' ? { kind: 'ellipse', paths: [ellipsePts(x + W / 2, y + H / 2, W / 2, H / 2)], closed: true } : { kind: 'rect', paths: [rectPts(x, y, W, H, tool === 'zone' ? 0 : toolOpt.radius)], closed: true }
  }
  const r = Math.hypot(dx, dy);
  if (tool === 'polygon') { if (r < .2) return null; return { kind: 'polygon', paths: [polyPts(x0, y0, r, clamp(toolOpt.sides | 0, 3, 64))], closed: true } }
  if (tool === 'star') { if (r < .2) return null; return { kind: 'star', paths: [starPts(x0, y0, r, r * clamp(toolOpt.inner, 5, 95) / 100, clamp(toolOpt.points | 0, 3, 40))], closed: true } }
  if (tool === 'line') { if (r < .2) return null; if (shift) { const a2 = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12); x1 = x0 + r * Math.cos(a2); y1 = y0 + r * Math.sin(a2) } return { kind: 'line', paths: [[[x0, y0], [x1, y1]]], closed: false } }
  return null;
}
function hitShape(w) {
  const tol = 6 / V.s; for (let i = S.shapes.length - 1; i >= 0; i--) {
    const s = S.shapes[i]; if (!S.layers[s.layer].show) continue; const b = bboxOf(s.paths);
    if (w[0] < b[0] - tol || w[0] > b[2] + tol || w[1] < b[1] - tol || w[1] > b[3] + tol) continue;
    if (s.kind === 'image' || s.kind === 'relief') return s;
    if (s.closed && inPolys(w, s.paths)) return s;
    for (const p of s.paths) { const n = p.length; for (let k = 0; k < (s.closed ? n : n - 1); k++)if (distSeg(w, p[k], p[(k + 1) % n]) < tol) return s }
  } return null
}
function hitZone(w) { const pl = plateAtWorld(w); if (pl == null) return null; const X = plateX(pl), zs = sheetAt(pl).zones || []; for (let i = zs.length - 1; i >= 0; i--) { const z = zs[i]; if (w[0] >= X + z.x && w[0] <= X + z.x + z.w && w[1] >= z.y && w[1] <= z.y + z.h) return { plate: pl, i } } return null }
function hitHandle(px, py) { const b = selBox(); if (!b || selShapes().some(s => s.lock)) return null; const h = handlePts(b); for (const k in h) { if (Math.abs(px - h[k][0]) <= 7 && Math.abs(py - h[k][1]) <= 7) return k } return null }
const groupIds = s => s.g ? S.shapes.filter(q => q.g === s.g).map(q => q.id) : [s.id];
const snapSel = () => new Map(selShapes().map(s => [s.id, JSON.parse(JSON.stringify(s.paths))]));
function applyFromOrig(orig, f) { for (const [id, paths] of orig) { const s = shapeById(id); if (s) s.paths = mapPaths(paths, f) } }
function evtPos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
function plateAtWorld(w) { const pw = S.machine.w + plateGap(), i = Math.floor((w[0] + plateGap() / 2) / pw); return i >= 0 && i < S.sheets.length && w[1] >= -20 && w[1] <= S.machine.h + 20 ? i : null }
/* After moving: shapes dropped inside a sheet stop being "unplaced". */
function settleParked(ids) { for (const id of ids) { const s = shapeById(id); if (!s || !s.parked) continue; const b = bboxOf(s.paths), pl = plateOfBox(b), r = sheetRectWorld(pl); if (b[0] >= r[0] - .5 && b[2] <= r[2] + .5 && b[1] >= r[1] - .5 && b[3] <= r[3] + .5) delete s.parked } }

/* The menu opens on the "contextmenu" event: on Windows it fires after the button is
   released, on macOS/Linux when it is pressed. Opening it from pointerup put the menu
   under the cursor right before Windows delivered contextmenu to it, so the browser's own
   menu covered ours and swallowed the next click. */
cv.addEventListener('contextmenu', e => {
  e.preventDefault(); if (tab !== 'cad') return;
  if (drag && drag.k === 'pan' && drag.moved) return;
  const [px, py] = evtPos(e); openCtxMenu(e.clientX + 2, e.clientY + 2, s2w(px, py));
});
document.addEventListener('contextmenu', e => { if (!e.target.closest('input, textarea, [contenteditable="true"]')) e.preventDefault() });
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); const [px, py] = evtPos(e), w = s2w(px, py); hideCtx();
  if (tab === 'gcode' && P.mode === '3d') { drag = { k: 'orbit', px, py, yaw: P.yaw, pitch: P.pitch, pan: e.button === 2 || e.shiftKey, panX: P.panX, panY: P.panY }; return }
  if (e.button === 1 || e.button === 2 || spaceDown || tool === 'hand' || tab !== 'cad') { drag = { k: 'pan', px, py, ox: V.ox, oy: V.oy, ctx: e.button === 2 && tab === 'cad', w, cx: e.clientX, cy: e.clientY }; cv.style.cursor = 'grabbing'; return }
  const pl = plateAtWorld(w); if (pl != null && pl !== curPlate) { curPlate = pl; renderChrome(); renderLeft() }
  if (tool === 'measure') { measure = { a: snapP(w), b: snapP(w) }; drag = { k: 'measure' }; draw(); return }
  measure = null;
  if (tool === 'select') {
    const hk = sel.size ? hitHandle(px, py) : null;
    if (hk) { pushUndo(hk === 'rot' ? T('Поворот', 'Rotate') : T('Масштаб', 'Resize')); const b = selBox(); drag = { k: hk === 'rot' ? 'rot' : 'scale', h: hk, box: b, orig: snapSel(), start: w, c: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], moved: false, undo: true }; return }
    const hit = hitShape(w);
    if (hit) {
      const ids = e.altKey ? [hit.id] : groupIds(hit);
      if (e.shiftKey) { const has = sel.has(hit.id); for (const id of ids) has ? sel.delete(id) : sel.add(id) } else if (!sel.has(hit.id)) { sel = new Set(ids) }
      if (selShapes().some(s => s.lock)) { selChanged(); return }
      pushUndo(T('Перемещение', 'Move')); drag = { k: 'move', start: w, box: selBox(), orig: snapSel(), moved: false, undo: true }; selChanged(); return
    }
    if (!e.shiftKey) sel.clear(); drag = { k: 'marquee', start: w, cur: w, base: new Set(sel) }; selChanged(); return
  }
  if (tool === 'pen') {
    const p = snapP(w); if (!penPts) penPts = [];
    if (penPts.length >= 3) { const [fx0, fy0] = w2s(...penPts[0]); if (Math.hypot(px - fx0, py - fy0) < 9) { finishPen(true); return } }
    penPts.push(p); draw(); return
  }
  if (tool === 'text') { placeText(snapP(w)); return }
  drag = { k: 'draw', start: snapP(w), cur: snapP(w), shift: e.shiftKey };
});
cv.addEventListener('pointermove', e => {
  const [px, py] = evtPos(e), w = s2w(px, py);
  if (tab !== 'gcode' || P.mode === '2d') { cursorW = w; const sm = $('#status .mono'); if (sm) { const ox = tab === 'cad' ? plateX(plateAtWorld(w) ?? curPlate) : plateX(curPlate); sm.textContent = `X ${fx(w[0] - ox, 2).toFixed(2)}  Y ${fx(w[1], 2).toFixed(2)}` } }
  if (!drag) {
    if (tab === 'cad' && tool === 'select') { const hk = sel.size ? hitHandle(px, py) : null; const hs = hk ? null : hitShape(w); cv.style.cursor = hk ? (hk === 'rot' ? 'grab' : ({ nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' })[hk]) : hs ? (hs.lock ? 'not-allowed' : 'move') : 'default' }
    else cv.style.cursor = tab !== 'cad' || tool === 'hand' || spaceDown ? 'grab' : 'crosshair';
    if (tab === 'cad' && tool !== 'select') draw(); return
  }
  const d = drag;
  if (d.k === 'orbit') { if (d.pan) { P.panX = d.panX + (px - d.px); P.panY = d.panY + (py - d.py) } else { P.yaw = d.yaw + (px - d.px) * .008; P.pitch = clamp(d.pitch + (py - d.py) * .006, 0, 1.5) } draw(); return }
  if (d.k === 'pan') { if (Math.hypot(px - d.px, py - d.py) > 3) { if (!d.moved && d.ctx) hideCtx(); d.moved = true } V.ox = d.ox + (px - d.px); V.oy = d.oy + (py - d.py); draw(); return }
  if (d.k === 'measure') { measure.b = e.shiftKey ? (() => { const dx = w[0] - measure.a[0], dy = w[1] - measure.a[1], r = Math.hypot(dx, dy), a = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12); return [measure.a[0] + r * Math.cos(a), measure.a[1] + r * Math.sin(a)] })() : snapP(w); draw(); return }
  if (d.k === 'move') { const b = d.box; let dx = w[0] - d.start[0], dy = w[1] - d.start[1]; dx = snapV(b[0] + dx) - b[0]; dy = snapV(b[1] + dy) - b[1]; if (Math.abs(dx) + Math.abs(dy) > 0) d.moved = true; applyFromOrig(d.orig, (x, y) => [x + dx, y + dy]); draw(); return }
  if (d.k === 'scale') {
    const b = d.box, h = d.h; d.moved = true;
    const ax = h.includes('w') ? b[2] : b[0], ay = h.includes('s') ? b[3] : b[1], hx = h.includes('w') ? b[0] : b[2], hy = h.includes('s') ? b[1] : b[3];
    const p = snapP(w); let sx = h === 'n' || h === 's' ? 1 : (p[0] - ax) / ((hx - ax) || 1), sy = h === 'e' || h === 'w' ? 1 : (p[1] - ay) / ((hy - ay) || 1);
    const lock = e.shiftKey !== toolOpt.lock || [...d.orig.keys()].some(id => { const s = shapeById(id); return s && (s.kind === 'image' || s.kind === 'relief') });
    if (lock) { if (h === 'n' || h === 's') sx = sy; else if (h === 'e' || h === 'w') sy = sx; else { const m = Math.max(Math.abs(sx), Math.abs(sy)); sx = Math.sign(sx || 1) * m; sy = Math.sign(sy || 1) * m } }
    if (Math.abs(sx) < .001) sx = .001; if (Math.abs(sy) < .001) sy = .001;
    applyFromOrig(d.orig, (x, y) => [ax + (x - ax) * sx, ay + (y - ay) * sy]); d.sy = sy; draw(); return
  }
  if (d.k === 'rot') { if ([...d.orig.keys()].some(id => { const k = shapeById(id)?.kind; return k === 'image' || k === 'relief' })) return; const c = d.c; let a = Math.atan2(w[1] - c[1], w[0] - c[0]) - Math.atan2(d.start[1] - c[1], d.start[0] - c[0]); if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12); d.moved = true; d.ang = a; const ca = Math.cos(a), sa = Math.sin(a); applyFromOrig(d.orig, (x, y) => [c[0] + (x - c[0]) * ca - (y - c[1]) * sa, c[1] + (x - c[0]) * sa + (y - c[1]) * ca]); draw(); return }
  if (d.k === 'marquee') {
    d.cur = w; const x0 = Math.min(d.start[0], w[0]), x1 = Math.max(d.start[0], w[0]), y0 = Math.min(d.start[1], w[1]), y1 = Math.max(d.start[1], w[1]), cross = w[0] < d.start[0];
    sel = new Set(d.base); for (const s of S.shapes) { if (!S.layers[s.layer].show) continue; const b = bboxOf(s.paths); const inside = b[0] >= x0 && b[2] <= x1 && b[1] >= y0 && b[3] <= y1, hit = b[0] <= x1 && b[2] >= x0 && b[1] <= y1 && b[3] >= y0; if (cross ? hit : inside) for (const id of groupIds(s)) sel.add(id) } draw(); return
  }
  if (d.k === 'draw') { d.cur = snapP(w); d.shift = e.shiftKey; draw() }
});
cv.addEventListener('pointerup', e => {
  const d = drag; drag = null; if (!d) return; cv.style.cursor = '';
  if (d.k === 'pan' && d.ctx) { if (d.moved) hideCtx(); return }
  if (d.undo && !d.moved) dropLastUndo();
  if (d.k === 'rot' && d.moved) for (const id of d.orig.keys()) { const s = shapeById(id); if (s && s.kind === 'text') s.rot = ((s.rot || 0) + d.ang * 180 / Math.PI) % 360 }
  if (d.k === 'scale' && d.moved) for (const id of d.orig.keys()) { const s = shapeById(id); if (s && s.kind === 'text') s.size = fx(s.size * Math.abs(d.sy || 1), 2) }
  if (d.k === 'draw') {
    const sh = buildShape(d.start, d.cur, d.shift);
    if (sh && tool === 'zone') { const b = bboxOf(sh.paths), pl = plateAtWorld([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]); if (pl == null) { toast(T('Запретная зона рисуется на листе.', 'Draw no-go zones on a sheet.')); draw(); return } pushUndo(T('Запретная зона', 'No-go zone')); const X = plateX(pl); sheetAt(pl).zones.push({ x: fx(b[0] - X, 2), y: fx(b[1], 2), w: fx(b[2] - b[0], 2), h: fx(b[3] - b[1], 2) }); changed(); toast(T('Зона добавлена: раскладка будет её обходить. Удалить — в панели листа.', 'Zone added: nesting will avoid it. Remove it in the sheet panel.')); return }
    if (sh) { pushUndo(T('Новая фигура', 'New shape')); const s = addShape(S, curDrawLayer, sh.kind, sh.paths, sh.closed); sel = new Set([s.id]); if (mode === 'simple' || !toolSticky) setTool('select'); changed(); return }
  }
  if (d.k === 'move' || d.k === 'scale' || d.k === 'rot') { if (d.moved) { settleParked([...d.orig.keys()]); changed() } else { renderRight(); draw() } return }
  if (d.k === 'marquee') { selChanged(); return }
  draw();
});
cv.addEventListener('pointerleave', () => { if (tab === 'cad' && tool !== 'select') { cursorW = null; draw() } });
cv.addEventListener('dblclick', e => {
  if (tool === 'pen' && penPts) { finishPen(false); return }
  if (tab === 'cad' && tool === 'select') { const w = s2w(...evtPos(e)), hit = hitShape(w); if (hit && hit.g) { sel = new Set([hit.id]); selChanged(); toast(T('Выбран один объект из группы (Alt+клик делает то же).', 'Selected one object inside the group (Alt+click does the same).')) } else if (!hit) { const z = hitZone(w); if (z) { pushUndo(T('Удаление зоны', 'Delete zone')); sheetAt(z.plate).zones.splice(z.i, 1); changed(); toast(T('Запретная зона удалена.', 'No-go zone removed.')) } } }
});
cv.addEventListener('wheel', e => { e.preventDefault(); const [px, py] = evtPos(e), f = Math.exp(-e.deltaY * .0015); if (tab === 'gcode' && P.mode === '3d') { P.sc = clamp(P.sc * f, .05, 80); draw(); return } zoomAt(px, py, f) }, { passive: false });
function zoomAt(px, py, f) { const ns = clamp(V.s * f, .05, 200), k = ns / V.s; V.ox = px - (px - V.ox) * k; V.oy = py - (py - V.oy) * k; V.s = ns; draw(); renderStatus() }
function finishPen(closed) { const p = penPts; penPts = null; if (!p || p.length < 2) { draw(); return } pushUndo(T('Ломаная', 'Polyline')); const s = addShape(S, curDrawLayer, 'pen', [p], closed && p.length > 2); sel = new Set([s.id]); setTool('select'); changed() }
async function placeText(at) {
  const txt = String(toolOpt.text).trim(); if (!txt) { toast(T('Введите текст в панели справа.', 'Type the text in the right panel.')); return }
  const spec = textSpec({ text: txt, font: toolOpt.font, size: toolOpt.size, weight: toolOpt.weight, italic: toolOpt.italic, ls: toolOpt.ls, lh: toolOpt.lh, align: toolOpt.align, arc: toolOpt.arc });
  const paths = await makeTextPaths(spec); if (!paths.length) { toast(T('Не удалось построить контуры текста.', 'Could not outline this text.')); return }
  pushUndo(T('Текст', 'Text')); const s = addShape(S, curDrawLayer, 'text', mapPaths(paths, (x, y) => [x + at[0], y + at[1]]), true, Object.assign({ rot: 0 }, spec)); sel = new Set([s.id]); setTool('select'); changed()
}
function setTool(t) { tool = t; if (t !== 'pen') penPts = null; if (t !== 'measure') measure = null; renderChrome(); renderRight(); renderStatus(); draw() }
function selChanged() { renderLeft(); renderRight(); renderChrome(); draw() }

/* ---------------- context menu (spec 3.1) ---------------- */
function hideCtx() { const m = $('#ctxMenu'); if (m) m.hidden = true }
function openCtxMenu(cx, cy, w) {
  const hit = hitShape(w); if (hit && !sel.has(hit.id)) { sel = new Set(groupIds(hit)); selChanged() }
  const ss = selShapes(), z = !hit ? hitZone(w) : null, m = $('#ctxMenu'), items = [];
  if (ss.length) {
    const locked = ss.some(s => s.lock);
    items.push(['dup', 'copy', T('Дублировать', 'Duplicate'), 'Ctrl+D'], ['del', 'trash', T('Удалить', 'Delete'), 'Del'], null,
      [locked ? 'unlock' : 'lock', locked ? 'unlock' : 'lock', locked ? T('Открепить', 'Unlock') : T('Закрепить (раскладка не сдвинет)', 'Lock (nesting will not move it)'), ''],
      ['rename', 'edit', T('Переименовать…', 'Rename…'), 'F2'],
      ss.length > 1 ? ['group', 'group', T('Сгруппировать', 'Group'), 'Ctrl+G'] : null, ss.some(s => s.g) ? ['ungroup', 'ungroup', T('Разгруппировать', 'Ungroup'), '⇧Ctrl+G'] : null, null,
      ['rotCcw', 'rotl', T('Повернуть −90°', 'Rotate −90°'), '['], ['rotCw', 'rotr', T('Повернуть +90°', 'Rotate +90°'), ']'], ['mirrorH', 'flip', T('Отразить по горизонтали', 'Flip horizontal'), '⇧H'], null,
      ['front', 'up', T('На передний план', 'Bring to front'), ''], ['back', 'down', T('На задний план', 'Send to back'), ''], ['nestSel', 'nest', T('Разложить по листам…', 'Nest onto sheets…'), ''],
      S.sheets.length > 1 ? ['moveSheet', 'sheet', T('Перенести на лист…', 'Move to sheet…'), ''] : null);
    if (ss.length === 1 && ss[0].kind === 'image') items.push(null, ['imgBands', 'layers', T('Разделить на слои по яркости…', 'Split into brightness layers…'), '']);
    const gs = ss.find(s => s.g && S.groups[s.g]); if (gs && S.groups[gs.g].gen) items.push(null, ['regen', 'wand', T('Изменить параметры изделия…', 'Edit product parameters…'), '']);
    if (gs && S.groups[gs.g].src) items.push(['retrace', 'wand', T('Перетрассировать…', 'Re-trace…'), '']);
  } else if (z) items.push(['zoneDel', 'trash', T('Удалить запретную зону', 'Delete no-go zone'), '']);
  else items.push(['paste', 'copy', T('Вставить', 'Paste'), 'Ctrl+V'], ['selAll', 'select', T('Выделить всё на листе', 'Select all on sheet'), 'Ctrl+A'], ['addPlate', 'plus', T('Добавить лист', 'Add sheet'), '']);
  m.innerHTML = items.filter((x, i, a) => x || (i && a[i - 1])).map(x => x ? `<button data-ctx="${x[0]}">${ic(x[1], 15)}<span>${x[2]}</span><kbd>${x[3]}</kbd></button>` : '<hr>').join('');
  m.hidden = false; const r = m.getBoundingClientRect(); m.style.left = Math.min(cx, innerWidth - r.width - 8) + 'px'; m.style.top = Math.min(cy, innerHeight - r.height - 8) + 'px';
  m._zone = z; m.querySelector('button')?.focus();
}
async function ctxAction(a) {
  const m = $('#ctxMenu'), z = m._zone; hideCtx();
  switch (a) {
    case 'dup': dupSel(); break; case 'del': delSel(); break; case 'lock': lockSel(true); break; case 'unlock': lockSel(false); break; case 'rename': renameSel(); break;
    case 'group': groupSel(); break; case 'ungroup': ungroupSel(); break; case 'rotCcw': rotSel(-90); break; case 'rotCw': rotSel(90); break; case 'mirrorH': mirrorSel(true); break;
    case 'front': case 'back': { pushUndo(T('Порядок объектов', 'Object order')); const ss = selShapes(); S.shapes = S.shapes.filter(s => !sel.has(s.id)); S.shapes = a === 'front' ? S.shapes.concat(ss) : ss.concat(S.shapes); changed(); break }
    case 'nestSel': nestExisting(); break; case 'moveSheet': moveSelToSheet(); break; case 'imgBands': splitImageBands(selShapes()[0], 3); break;
    case 'regen': { const s = selShapes().find(s => s.g && S.groups[s.g] && S.groups[s.g].gen); if (s) regenGroup(s.g); break }
    case 'retrace': { const s = selShapes().find(s => s.g && S.groups[s.g] && S.groups[s.g].src); if (s) retraceGroup(s.g); break }
    case 'zoneDel': if (z) { pushUndo(T('Удаление зоны', 'Delete zone')); sheetAt(z.plate).zones.splice(z.i, 1); changed() } break;
    case 'paste': pasteClip(); break; case 'selAll': selectAllOnSheet(); break; case 'addPlate': addSheet(); break;
  }
}

/* ---------------- commands ---------------- */
function transformSel(f, label, key) { if (selShapes().some(s => s.lock)) { toast(T('Выделение содержит закреплённые объекты — сначала открепите их.', 'The selection has locked objects — unlock them first.')); return false } pushUndo(label || T('Изменение', 'Edit'), key); for (const s of selShapes()) s.paths = mapPaths(s.paths, f); settleParked([...sel]); changed(); return true }
function setBox(prop, val) {
  const b = selBox(); if (!b || !isFinite(val)) return; const w = b[2] - b[0], h = b[3] - b[1], lock = toolOpt.lock || selShapes().some(s => s.kind === 'image' || s.kind === 'relief'), ox = plateX(plateOfBox([b[0], b[1], b[0], b[1]]));
  if (prop === 'x') return transformSel((x, y) => [x + val + ox - b[0], y], T('Положение X', 'Position X'), 'px');
  if (prop === 'y') return transformSel((x, y) => [x, y + val - b[1]], T('Положение Y', 'Position Y'), 'py');
  if (val <= 0) return; let sx = 1, sy = 1; if (prop === 'w') { sx = w ? val / w : 1; if (lock) sy = sx } else { sy = h ? val / h : 1; if (lock) sx = sy }
  for (const s of selShapes()) if (s.kind === 'text') s.size = fx(s.size * sy, 2);
  transformSel((x, y) => [b[0] + (x - b[0]) * sx, b[1] + (y - b[1]) * sy], T('Размер', 'Size'), 'ps' + prop)
}
function rotSel(deg) {
  const b = selBox(); if (!b) return; if (selShapes().some(s => s.kind === 'image' || s.kind === 'relief')) { if (Math.abs(deg) % 90 === 0 && selShapes().every(s => s.kind === 'image')) { pushUndo(T('Поворот фото', 'Rotate photo')); for (const s of selShapes()) { s.img.rot90 = (((s.img.rot90 | 0) + (deg > 0 ? 3 : 1) * Math.abs(deg / 90)) % 4); const bb = bboxOf(s.paths), cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, w = bb[3] - bb[1], h = bb[2] - bb[0]; s.paths = [rectPts(cx - w / 2, cy - h / 2, w, h)] } changed() } else toast(T('Фото поворачивается только на 90°.', 'Photos rotate in 90° steps only.')); return }
  const c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; if (selShapes().some(s => s.lock)) { toast(T('Сначала открепите объекты.', 'Unlock the objects first.')); return }
  for (const s of selShapes()) if (s.kind === 'text') s.rot = ((s.rot || 0) + deg) % 360; transformSel((x, y) => rotPaths([[[x, y]]], deg, c[0], c[1])[0][0], T('Поворот', 'Rotate'))
}
function mirrorSel(h) { const b = selBox(); if (!b) return; const cx = b[0] + b[2], cy = b[1] + b[3]; for (const s of selShapes()) if (s.kind === 'image') { if (h) s.img.fx = !s.img.fx; else s.img.fy = !s.img.fy } transformSel(h ? (x, y) => [cx - x, y] : (x, y) => [x, cy - y], T('Отражение', 'Mirror')) }
function alignSel(k) {
  const ss = selShapes(); if (!ss.length) return; if (ss.some(s => s.lock)) { toast(T('Сначала открепите объекты.', 'Unlock the objects first.')); return }
  const units = unitsOf(ss), pl = plateOfBox(selBox()), ref = units.length > 1 ? selBox() : sheetRectWorld(pl); pushUndo(T('Выравнивание', 'Align'));
  for (const u of units) { const b = bboxOf(u.flatMap(s => s.paths)); let dx = 0, dy = 0; if (k === 'l') dx = ref[0] - b[0]; if (k === 'r') dx = ref[2] - b[2]; if (k === 'cx') dx = (ref[0] + ref[2]) / 2 - (b[0] + b[2]) / 2; if (k === 'b') dy = ref[1] - b[1]; if (k === 't') dy = ref[3] - b[3]; if (k === 'cy') dy = (ref[1] + ref[3]) / 2 - (b[1] + b[3]) / 2; for (const s of u) s.paths = mapPaths(s.paths, (x, y) => [x + dx, y + dy]) } changed()
}
function cloneShapes(list, dx, dy, rot, c) {
  const gmap = new Map(), ns = []; for (const s of list) {
    const n = JSON.parse(JSON.stringify(s)); n.id = S.nextId++; delete n.lock; if (s.g) { if (!gmap.has(s.g)) { const g = S.nextG++; gmap.set(s.g, g); if (S.groups[s.g]) S.groups[g] = deepCopy(S.groups[s.g]) } n.g = gmap.get(s.g) }
    if (rot) { n.paths = rotPaths(n.paths, rot, c[0], c[1]); if (n.kind === 'text') n.rot = ((n.rot || 0) + rot) % 360 } n.paths = mapPaths(n.paths, (x, y) => [x + dx, y + dy]); S.shapes.push(n); ns.push(n.id)
  } return ns
}
function dupSel(off = 5) { const ss = selShapes(); if (!ss.length) return; pushUndo(T('Дублирование', 'Duplicate')); sel = new Set(cloneShapes(ss, off, -off)); changed() }
function delSel() { if (!sel.size) { toast(T('Сначала выделите объект.', 'Select an object first.')); return } const n = sel.size; pushUndo(T('Удаление', 'Delete')); S.shapes = S.shapes.filter(s => !sel.has(s.id)); sel.clear(); changed(); toast(T(`Удалено объектов: ${n}. Ctrl+Z — вернуть.`, `Deleted ${n} objects. Ctrl+Z to undo.`)) }
function lockSel(on) { if (!sel.size) return; pushUndo(on ? T('Закрепление', 'Lock') : T('Открепление', 'Unlock')); for (const s of selShapes()) { if (on) s.lock = true; else delete s.lock } changed(); toast(on ? T('Закреплено: раскладка и мышь не сдвинут эти объекты.', 'Locked: nesting and dragging will not move these objects.') : T('Откреплено.', 'Unlocked.')) }
async function renameSel() {
  const ss = selShapes(); if (!ss.length) return; const cur = unitName(ss);
  openModal(T('Переименовать', 'Rename'), `<label class="fld"><span>${T('Название', 'Name')}</span><input class="plain" id="rnInput" value="${esc(cur)}" autofocus></label>`, `<button class="btn" data-act="closeModal">${T('Отмена', 'Cancel')}</button><button class="primary" id="rnOk">${T('Сохранить', 'Save')}</button>`);
  const ok = () => { const v = $('#rnInput').value.trim(); closeModal(); if (!v) return; pushUndo(T('Переименование', 'Rename')); const gs = new Set(ss.filter(s => s.g).map(s => s.g)); for (const s of ss) s.nm = v; for (const g of gs) S.groups[g] = Object.assign(S.groups[g] || {}, { nm: v }); changed() };
  $('#rnOk').onclick = ok; $('#rnInput').onkeydown = e => { if (e.key === 'Enter') ok() };
}
function groupSel() { const ss = selShapes(); if (ss.length < 2) return; pushUndo(T('Группировка', 'Group')); const g = S.nextG++; S.groups[g] = { nm: T('Группа', 'Group') }; for (const s of ss) s.g = g; changed(); toast(T('Объекты сгруппированы.', 'Objects grouped.')) }
function ungroupSel() { if (!selShapes().some(s => s.g)) return; pushUndo(T('Разгруппировка', 'Ungroup')); for (const s of selShapes()) delete s.g; changed(); toast(T('Группа разобрана.', 'Group dissolved.')) }
function breakApart() {
  const ss = selShapes().filter(s => s.paths.length > 1 && s.kind !== 'image' && s.kind !== 'relief'); if (!ss.length) { toast(T('Нечего разбивать: у объектов по одному контуру.', 'Nothing to break apart: each object has one outline.')); return } pushUndo(T('Разбиение', 'Break apart')); const ns = new Set();
  for (const s of ss) { const parts = s.closed ? components(s.paths) : s.paths.map(p => [p]); S.shapes = S.shapes.filter(q => q !== s); for (const c of parts) { const n = addShape(S, s.layer, s.kind === 'text' ? 'bool' : s.kind, c, s.closed, s.g ? { g: s.g } : {}); ns.add(n.id) } } sel = ns; changed()
}
function simplifySel(eps) { pushUndo(T('Упрощение узлов', 'Simplify nodes')); let before = 0, after = 0; for (const s of selShapes()) if (s.kind !== 'image' && s.kind !== 'relief') { before += s.paths.reduce((a, p) => a + p.length, 0); s.paths = s.paths.map(p => s.closed ? rdpClosed(p, eps) : rdp(p, eps)); after += s.paths.reduce((a, p) => a + p.length, 0) } changed(); toast(T(`Узлов: ${before} → ${after}`, `Nodes: ${before} → ${after}`)) }
function boolSel(kind) {
  if (!hasClip()) { toast(T('Булевы операции недоступны: библиотека Clipper не загрузилась.', 'Boolean ops need the Clipper library, which did not load.'), 'err'); return }
  const ss = selShapes().filter(s => s.closed && s.kind !== 'image' && s.kind !== 'relief'); if (ss.length < 2) { toast(T('Нужно выделить минимум две замкнутые фигуры.', 'Select at least two closed shapes.')); return }
  let res; if (kind === 'diff') { const big = ss.reduce((a, s) => areaOf(s.paths) > areaOf(a.paths) ? s : a); res = boolOp(big.paths, ss.filter(s => s !== big).flatMap(s => s.paths), 'diff') }
  else if (kind === 'union') res = boolOp(ss[0].paths, ss.slice(1).flatMap(s => s.paths), 'union');
  else { res = ss[0].paths; for (const s of ss.slice(1)) res = boolOp(res, s.paths, 'inter') }
  if (!res.length) { toast(T('Результат пустой — фигуры не пересекаются.', 'The result is empty — shapes do not overlap.')); return }
  pushUndo(T('Булева операция', 'Boolean')); const layer = ss[0].layer, g = ss[0].g; S.shapes = S.shapes.filter(s => !ss.includes(s)); const n = addShape(S, layer, 'bool', res, true, g ? { g } : {}); sel = new Set([n.id]); changed()
}
function offsetSel(d) { const ss = selShapes().filter(s => s.closed && s.kind !== 'image' && s.kind !== 'relief'); if (!ss.length) { toast(T('Смещение работает с замкнутыми фигурами.', 'Offset needs closed shapes.')); return } const res = offsetPaths(ss.flatMap(s => s.paths), d); if (!res.length) { toast(T('Смещение съело фигуру целиком — уменьшите значение.', 'The offset consumed the shape — use a smaller value.')); return } pushUndo(T('Смещение контура', 'Offset')); const n = addShape(S, ss[0].layer, 'offset', res, true); sel = new Set([n.id]); changed() }
function arraySel(cols, rows, gap) { const ss = selShapes(); if (!ss.length) return; const b = selBox(), w = b[2] - b[0] + gap, h = b[3] - b[1] + gap; pushUndo(T('Массив', 'Array')); const all = new Set(sel); for (let r = 0; r < rows; r++)for (let c = 0; c < cols; c++) { if (!r && !c) continue; for (const id of cloneShapes(ss, c * w, r * h)) all.add(id) } sel = all; changed(); toast(T(`Создано копий: ${cols * rows - 1}`, `${cols * rows - 1} copies created`)) }
function circArraySel(n, r) { const ss = selShapes(); if (!ss.length || n < 2) return; if (ss.some(s => s.kind === 'image' || s.kind === 'relief')) { toast(T('Круговой массив не работает с фото.', 'Circular arrays do not support photos.')); return } const b = selBox(), c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2 - r]; pushUndo(T('Круговой массив', 'Circular array')); const all = new Set(sel); for (let i = 1; i < n; i++)for (const id of cloneShapes(ss, 0, 0, 360 * i / n, c)) all.add(id); sel = all; changed(); toast(T(`Создано копий: ${n - 1}`, `${n - 1} copies created`)) }
async function updateText(spec) { const s = selShapes()[0]; if (!s || s.kind !== 'text' || !String(spec.text).trim()) return; const prev = deepCopy(s); pushUndo(T('Изменение текста', 'Edit text'), 'text' + s.id); if (!(await rebuildText(s, spec))) { Object.assign(s, prev); toast(T('Не удалось построить текст этим шрифтом.', 'Could not build text with this font.'), 'err'); return } changed() }
function selectAllOnSheet() { sel = new Set(S.shapes.filter(s => S.layers[s.layer].show && !s.parked && plateOf(s) === curPlate).map(s => s.id)); refresh() }
function copySel() { clip = JSON.parse(JSON.stringify(selShapes())); if (clip.length) toast(T(`Скопировано объектов: ${clip.length}`, `Copied ${clip.length} objects`)) }
function pasteClip() { if (!clip || !clip.length) return; pushUndo(T('Вставка', 'Paste')); sel = new Set(cloneShapes(clip, 10, -10)); clip = clip.map(s => ({ ...s, paths: mapPaths(s.paths, (x, y) => [x + 10, y - 10]) })); changed() }
async function moveSelToSheet() {
  const opts = S.sheets.map((sh, i) => ({ label: sheetName(sh, i), value: i })).filter(o => o.value !== curPlate);
  const to = await confirmBox(T('Перенести на лист', 'Move to sheet'), T('Объекты сохранят положение относительно листа.', 'Objects keep their position relative to the sheet.'), opts.concat([{ label: T('Отмена', 'Cancel'), value: null }]));
  if (to == null) return; pushUndo(T('Перенос на лист', 'Move to sheet'));
  for (const s of selShapes()) { const from = plateOf(s), dx = plateX(to) - plateX(from) + (sheetAt(to).x - sheetAt(from).x), dy = sheetAt(to).y - sheetAt(from).y; s.paths = mapPaths(s.paths, (x, y) => [x + dx, y + dy]); delete s.parked }
  curPlate = to; changed(); fitPlate(to); draw();
}

/* ---------------- sheets (spec 3.2, 13.2) ---------------- */
function addSheet(copyOf) { const base = sheetAt(copyOf ?? curPlate); pushUndo(T('Новый лист', 'New sheet')); S.sheets.push(newSheet({ w: base.w, h: base.h, x: base.x, y: base.y, mat: base.mat, thick: base.thick, margin: base.margin, zones: copyOf != null ? deepCopy(base.zones) : [] })); setPlate(S.sheets.length - 1) }
async function deleteSheet(i) {
  i = i ?? curPlate; const on = S.shapes.filter(s => !s.parked && plateOf(s) === i);
  if (S.sheets.length < 2 && !on.length) { toast(T('Это единственный лист проекта.', 'This is the only sheet in the project.')); return }
  let choice = 'delete';
  if (on.length) {
    const btns = [];
    if (S.sheets.length > 1) btns.push({ label: T('Перенести детали на другие листы', 'Move parts to other sheets'), value: 'move', primary: true });
    btns.push({ label: T('Убрать детали в «Неразмещённые»', 'Move parts to “Unplaced”'), value: 'park' }, { label: T('Удалить лист вместе с деталями', 'Delete the sheet with its parts'), value: 'delete', danger: true }, { label: T('Отмена', 'Cancel'), value: null });
    choice = await confirmBox(T('Удалить лист?', 'Delete the sheet?'), T(`На листе «${sheetName(sheetAt(i), i)}» ${on.length} объект(ов). Что с ними сделать?`, `Sheet “${sheetName(sheetAt(i), i)}” has ${on.length} object(s). What should happen to them?`), btns);
    if (!choice) return;
  }
  pushUndo(T('Удаление листа', 'Delete sheet'));
  const units = unitsOf(on);
  if (choice === 'delete') S.shapes = S.shapes.filter(s => !on.includes(s));
  else if (choice === 'park') { let px = 0; for (const u of units) { const b = bboxOf(u.flatMap(s => s.paths)); for (const s of u) { s.paths = mapPaths(s.paths, (x, y) => [x - b[0] + px, y - b[3] - 20]); s.parked = true } px += b[2] - b[0] + 6 } }
  const dx = plateX(1) - plateX(0);
  if (S.sheets.length > 1) { for (const s of S.shapes) if (!s.parked && plateOf(s) > i && !on.includes(s)) s.paths = mapPaths(s.paths, (x, y) => [x - dx, y]); S.sheets.splice(i, 1) } else S.sheets[0] = newSheet(Object.assign({}, S.sheets[0], { zones: [] }));
  if (choice === 'move') { // park first, then nest onto the remaining sheets
    let px = 0; for (const u of units) { const b = bboxOf(u.flatMap(s => s.paths)); for (const s of u) { s.paths = mapPaths(s.paths, (x, y) => [x - b[0] + px, y - b[3] - 20]); s.parked = true } px += b[2] - b[0] + 6 }
  }
  sel.clear(); curPlate = clamp(i - (i >= S.sheets.length ? 1 : 0), 0, S.sheets.length - 1); changed(); fitPlate(curPlate); draw();
  if (choice === 'move') { openNest({ kind: 'existing', units, title: T('Перенос деталей удалённого листа', 'Re-home parts of the deleted sheet') }); NS.mode = 'multi'; renderNestSide(); }
  else toast(T('Лист удалён. Ctrl+Z — вернуть.', 'Sheet deleted. Ctrl+Z to undo.'));
}

/* ---------------- split large parts into tiles (spec 10.2) ---------------- */
function openSplit() {
  const ss = selShapes().filter(s => s.closed && s.kind !== 'image' && s.kind !== 'relief'); if (!ss.length) { toast(T('Выделите замкнутую деталь.', 'Select a closed part.')); return }
  const sh = sheetAt(curPlate), b = bboxOf(ss.flatMap(s => s.paths));
  openModal(`${ic('split', 18)} ${T('Разрезать на части', 'Split into tiles')}`, `<p class="note">${T(`Деталь ${fx(b[2] - b[0], 1)}×${fx(b[3] - b[1], 1)} мм будет разрезана сеткой на части не больше заданного размера. На линиях разреза — замки «ласточкин хвост» или отверстия под шканты.`, `The ${fx(b[2] - b[0], 1)}×${fx(b[3] - b[1], 1)} mm part is cut by a grid into tiles no larger than the size below. Cut lines get dovetail keys or dowel holes.`)}</p>
   <div class="grid2">${numF(T('Макс. ширина части', 'Max tile width'), 'id="spW" min="20"', fx(sh.w - 2 * sh.margin, 0), MM(), 1)}${numF(T('Макс. высота части', 'Max tile height'), 'id="spH" min="20"', fx(sh.h - 2 * sh.margin, 0), MM(), 1)}
   ${selF(T('Соединение', 'Joint'), 'id="spJ"', [['dovetail', T('ласточкин хвост', 'dovetail')], ['dowel', T('отверстия под шканты', 'dowel holes')], ['none', T('без соединения', 'none')]], 'dovetail')}${numF(T('Размер замка', 'Key size'), 'id="spK" min="3"', 12, MM(), 1)}
   ${numF(T('Зазор посадки', 'Fit clearance'), 'id="spC" min="0" max="1"', .1, MM(), .05)}${numF(T('Замков на шов', 'Keys per seam'), 'id="spN" min="1" max="8"', 2, '', 1)}</div>`,
    `<button class="btn" data-act="closeModal">${T('Отмена', 'Cancel')}</button><button class="primary" id="spOk">${T('Разрезать и разложить', 'Split and nest')}</button>`);
  $('#spOk').onclick = () => { const o = { w: +$('#spW').value, h: +$('#spH').value, joint: $('#spJ').value, key: +$('#spK').value, clr: +$('#spC').value, n: clamp(+$('#spN').value | 0, 1, 8) }; closeModal(); splitTiles(ss, o) };
}
function splitTiles(ss, o) {
  if (!hasClip()) return; const region = unionPaths(ss.flatMap(s => s.paths)), b = bboxOf(region), W = b[2] - b[0], H = b[3] - b[1];
  const nx = Math.max(1, Math.ceil(W / Math.max(10, o.w - o.key))), ny = Math.max(1, Math.ceil(H / Math.max(10, o.h - o.key)));
  if (nx * ny === 1) { toast(T('Деталь уже помещается — разрезать не нужно.', 'The part already fits — no split needed.')); return }
  const tw = W / nx, th = H / ny, tiles = [];
  for (let j = 0; j < ny; j++)for (let i = 0; i < nx; i++) tiles.push({ i, j, add: [], sub: [], rect: rectPts(b[0] + i * tw, b[1] + j * th, tw, th) });
  const at = (i, j) => tiles.find(t => t.i === i && t.j === j), k = o.key, c = o.clr;
  const dove = (x, y, dir) => { const a = k * .35, bw = k * .6; return dir === 'x' ? [[x, y - a], [x + k * .7, y - bw], [x + k * .7, y + bw], [x, y + a]] : [[x - a, y], [x - bw, y + k * .7], [x + bw, y + k * .7], [x + a, y]] };
  const seams = [];
  for (const t of tiles) {
    if (t.i < nx - 1) for (let q = 0; q < o.n; q++) seams.push({ a: t, b: at(t.i + 1, t.j), dir: 'x', x: b[0] + (t.i + 1) * tw, y: b[1] + t.j * th + th * (q + 1) / (o.n + 1) });
    if (t.j < ny - 1) for (let q = 0; q < o.n; q++) seams.push({ a: t, b: at(t.i, t.j + 1), dir: 'y', x: b[0] + t.i * tw + tw * (q + 1) / (o.n + 1), y: b[1] + (t.j + 1) * th });
  }
  const holes = [];
  for (const sm of seams) {
    if (!inPolys([sm.x + (sm.dir === 'x' ? k * .35 : 0), sm.y + (sm.dir === 'y' ? k * .35 : 0)], region) || !inPolys([sm.x - (sm.dir === 'x' ? k * .3 : 0), sm.y - (sm.dir === 'y' ? k * .3 : 0)], region)) continue;
    if (o.joint === 'dovetail') { const key = dove(sm.x, sm.y, sm.dir); sm.a.add.push(key); sm.b.sub.push(offsetPaths([key], c, 'miter')[0] || key) }
    else if (o.joint === 'dowel') { const r = Math.min(k * .2, 4); holes.push(ellipsePts(sm.x + (sm.dir === 'x' ? -k * .4 : 0), sm.y + (sm.dir === 'y' ? -k * .4 : 0), r, r), ellipsePts(sm.x + (sm.dir === 'x' ? k * .4 : 0), sm.y + (sm.dir === 'y' ? k * .4 : 0), r, r)) }
  }
  const layer = ss[0].layer, parts = [];
  for (const t of tiles) {
    let piece = boolOp(region, [t.rect], 'inter'); if (!piece.length) continue;
    if (t.add.length) piece = boolOp(piece, boolOp(t.add, region, 'inter'), 'union');
    if (t.sub.length) piece = boolOp(piece, t.sub, 'diff');
    if (holes.length) piece = boolOp(piece, holes, 'diff');
    const nm = `${T('Часть', 'Tile')} ${String.fromCharCode(65 + t.j)}${t.i + 1}`, items = [{ layer, kind: 'tile', paths: piece, closed: true }];
    parts.push({ name: nm, items, _label: nm });
  }
  const orig = ss.map(s => s.id), rm = new Set(orig);
  Promise.all(parts.map(async p => { const comp = p.items[0].paths, dp = deepPoint(comp, [], 3); if (dp) { const tp = await textAt(p._label, 'mono', 4, dp.p[0], dp.p[1]); if (tp.length) p.items.push({ layer: S.layers.findIndex(l => l.type === 'mark') >= 0 ? S.layers.findIndex(l => l.type === 'mark') : 2, kind: 'text', paths: tp, closed: true, extra: { text: p._label, font: 'mono', size: 4, rot: 0 } }) } })).then(() => placeParts(parts, { title: T('Части крупной детали', 'Tiles of a large part'), exclude: orig, onApply: () => { S.shapes = S.shapes.filter(s => !rm.has(s.id)); sel.clear() } }));
}
