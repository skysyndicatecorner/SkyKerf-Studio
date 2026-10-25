'use strict';
/* ============================================================================
   SkyKerf_Studio · G-code → drawing
   Turns the loaded G-code (any file opened on the G-code tab, or the project's
   own code) back into outlines: SVG or DXF for other programs, a PNG picture
   (power → darkness, useful for raster engraving jobs) or editable shapes in
   the CAD tab. Only cutting/burning moves are converted; travel moves are not.
   ============================================================================ */
/* chains of cutting moves, grouped by the layer colour that the code carries */
function gcPaths() {
  const out = [], tol = 1e-4; let cur = null;
  for (const mv of P.moves || []) {
    if (!mv.c) { cur = null; continue }
    const col = mv.col || '#000000', a = mv.a, b = mv.b;
    if (cur && cur.col === col && Math.hypot(cur.pts[cur.pts.length - 1][0] - a[0], cur.pts[cur.pts.length - 1][1] - a[1]) < tol) { const l = cur.pts[cur.pts.length - 1]; if (Math.hypot(l[0] - b[0], l[1] - b[1]) > tol) cur.pts.push([b[0], b[1]]); cur.s = Math.max(cur.s, mv.s || 0); continue }
    cur = { col, pts: [[a[0], a[1]], [b[0], b[1]]], s: mv.s || 0, z: Math.min(a[2], b[2]) }; out.push(cur);
  }
  for (const p of out) { const f = p.pts[0], l = p.pts[p.pts.length - 1]; p.closed = p.pts.length > 3 && Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-3; if (p.closed) p.pts.pop() }
  return out.filter(p => p.pts.length > 1);
}
const gcLayerName = col => { const L = (P.layers || []).find(l => l.color === col); return L ? L.name : colorName(col) };
function gcBox(paths) { let b = null; for (const p of paths) { const x = bboxOf([p.pts]); b = b ? unionBox(b, x) : x } return b }
function gcBaseName() { return safeFileName((P.file || S.name || 'gcode').replace(/\.[a-z0-9]+$/i, '')) }
function gcNeedMoves() { const ps = gcPaths(); if (!ps.length) { toast(T('В G-code нет рабочих перемещений — нечего преобразовывать.', 'The G-code has no cutting moves — nothing to convert.'), 'warn'); return null } return ps }
function gcToSVG() {
  const ps = gcNeedMoves(); if (!ps) return; const b = gcBox(ps), W = b[2] - b[0], H = b[3] - b[1], by = new Map();
  for (const p of ps) { if (!by.has(p.col)) by.set(p.col, []); by.get(p.col).push(p) }
  let body = '';
  for (const [col, list] of by) { body += `<g id="${esc(gcLayerName(col))}" stroke="${col}" fill="none" stroke-width="0.1">`; for (const p of list) body += `<path d="M${p.pts.map(q => `${fx(q[0] - b[0], 3)},${fx(b[3] - q[1], 3)}`).join('L')}${p.closed ? 'Z' : ''}"/>`; body += '</g>' }
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${fx(W, 3)}mm" height="${fx(H, 3)}mm" viewBox="0 0 ${fx(W, 3)} ${fx(H, 3)}"><!-- ${APP_NAME} ${APP_VERSION}: G-code → SVG, origin X${fx(b[0], 3)} Y${fx(b[1], 3)} --> ${body}</svg>\n`;
  downloadFile(gcBaseName() + '.svg', svg, 'image/svg+xml'); toast(T(`SVG: ${ps.length} контуров, ${fx(W, 1)}×${fx(H, 1)} мм`, `SVG: ${ps.length} outlines, ${fx(W, 1)}×${fx(H, 1)} mm`));
}
function gcToDXF() {
  const ps = gcNeedMoves(); if (!ps) return; const o = [], P2 = (c, v) => o.push(String(c), String(v)), cols = [...new Set(ps.map(p => p.col))];
  const lname = col => (toAscii(gcLayerName(col)).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 28) || 'L') + '_' + (cols.indexOf(col) + 1);
  P2(0, 'SECTION'); P2(2, 'HEADER'); P2(9, '$ACADVER'); P2(1, 'AC1009'); P2(9, '$INSUNITS'); P2(70, 4); P2(0, 'ENDSEC');
  P2(0, 'SECTION'); P2(2, 'TABLES'); P2(0, 'TABLE'); P2(2, 'LAYER'); P2(70, cols.length);
  cols.forEach((c, i) => { P2(0, 'LAYER'); P2(2, lname(c)); P2(70, 0); P2(62, (i % 7) + 1); P2(6, 'CONTINUOUS') });
  P2(0, 'ENDTAB'); P2(0, 'ENDSEC'); P2(0, 'SECTION'); P2(2, 'ENTITIES');
  for (const p of ps) { P2(0, 'POLYLINE'); P2(8, lname(p.col)); P2(66, 1); P2(70, p.closed ? 1 : 0); for (const q of p.pts) { P2(0, 'VERTEX'); P2(8, lname(p.col)); P2(10, fx(q[0], 4)); P2(20, fx(q[1], 4)); P2(30, 0) } P2(0, 'SEQEND') }
  P2(0, 'ENDSEC'); P2(0, 'EOF');
  downloadFile(gcBaseName() + '.dxf', o.join('\n') + '\n', 'application/dxf'); toast(T(`DXF: ${ps.length} контуров в ${cols.length} слоях`, `DXF: ${ps.length} outlines on ${cols.length} layers`));
}
/* raster picture: every burning move is drawn with darkness = power (laser) or depth (router) */
function gcRaster(pxPerMm, lineMm) {
  const mv = (P.moves || []).filter(m => m.c); if (!mv.length) return null;
  let b = [Infinity, Infinity, -Infinity, -Infinity]; for (const m of mv) for (const q of [m.a, m.b]) { b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[0]); b[3] = Math.max(b[3], q[1]) }
  const pad = 2, W = b[2] - b[0] + pad * 2, H = b[3] - b[1] + pad * 2, k = Math.min(pxPerMm, 8000 / Math.max(W, H));
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(W * k)); cv.height = Math.max(1, Math.round(H * k));
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.lineCap = 'round'; g.lineWidth = Math.max(1, lineMm * k);
  const sMax = Math.max(1, ...mv.map(m => m.s || 0)), zMin = Math.min(-1e-3, ...mv.map(m => Math.min(m.a[2], m.b[2])));
  const X = x => (x - b[0] + pad) * k, Y = y => cv.height - (y - b[1] + pad) * k;
  for (const m of mv) { const v = P.laser ? (m.s || 0) / sMax : Math.min(m.a[2], m.b[2]) / zMin; g.strokeStyle = `rgba(0,0,0,${clamp(v, .05, 1)})`; g.beginPath(); g.moveTo(X(m.a[0]), Y(m.a[1])); g.lineTo(X(m.b[0]), Y(m.b[1])); g.stroke() }
  return { cv, k, W, H };
}
function gcToPNG(pxPerMm) {
  const r = gcRaster(pxPerMm || 10, P.laser ? .1 : .5); if (!r) { gcNeedMoves(); return }
  r.cv.toBlob(bl => { if (bl) { downloadFile(gcBaseName() + '.png', bl); toast(T(`PNG ${r.cv.width}×${r.cv.height} пикс. (${fx(r.k * 25.4, 0)} DPI)`, `PNG ${r.cv.width}×${r.cv.height} px (${fx(r.k * 25.4, 0)} DPI)`)) } }, 'image/png');
}
/* into the drawing: outlines keep their layer colour; the import dialog decides cut / engrave */
function gcToProject() {
  const ps = gcNeedMoves(); if (!ps) return;
  if (ps.length > 20000) { toast(T(`В коде ${ps.length} отрезков — это, вероятно, растровая гравировка. Преобразуйте её в PNG и вставьте как картинку.`, `The code has ${ps.length} segments — probably a raster engraving. Convert it to PNG and add it as a picture.`), 'warn'); return }
  const out = ps.map(p => ({ paths: [p.pts.map(q => [q[0], q[1]])], closed: p.closed, style: { stroke: p.col, sw: 0, fill: null, name: gcLayerName(p.col) } }));
  switchTab('cad'); importStyled(out, 'gcode', T('контуры восстановлены из G-code (без компенсации реза и перемычек)', 'outlines rebuilt from G-code (no kerf offset or tabs)'));
}
function gcPngToProject() {
  const r = gcRaster(10, P.laser ? .1 : .5); if (!r) { gcNeedMoves(); return }
  const im = new Image(); im.onload = () => {
    switchTab('cad'); const a = imageToAsset(im, 4000), sh = sheetAt(curPlate), x0 = plateX(curPlate) + sh.x + 5, y0 = sh.y + 5, w = r.W, h = r.H;
    const L = S.layers.find(l => l.type === 'raster') || S.layers[3];
    pushUndo(T('Картинка из G-code', 'Picture from G-code')); const sp = addShape(S, L.id, 'image', [[[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]]], true, { img: newImageProps(a.id), nm: T('Из G-code', 'From G-code') }); sel = new Set([sp.id]); changed();
    toast(T(`Картинка ${fx(w, 1)}×${fx(h, 1)} мм добавлена на слой «${layerName(L)}» в реальном размере.`, `Picture ${fx(w, 1)}×${fx(h, 1)} mm added to “${layerName(L)}” at real size.`));
  }; im.src = r.cv.toDataURL('image/png');
}
