'use strict';
/* ============================================================================
   SkyKerf_Studio · import & image processing (spec 7, 6.3)
   SVG / DXF / PNG / JPEG / BMP / WebP / TIFF, drag-and-drop, paste,
   photo processing (dithering, crop, rotate, brightness bands),
   tracing (threshold or colour segmentation) with re-trace from the original.
   ============================================================================ */
const RASTER_EXT = /\.(png|jpe?g|bmp|gif|webp|tiff?)$/i, VECTOR_EXT = /\.(svg|dxf)$/i, MODEL_EXT = /\.(stl|obj)$/i, GCODE_EXT = /\.(nc|gcode|gc|ngc|tap)$/i, PROJECT_EXT = /\.(kerf|skykerf|json)$/i;
const MORE_VEC_EXT = /\.(cdr|pdf|ai|plt|hpgl|hpg|lbrn2?|svgz|eps)$/i;
const SUPPORTED_FORMATS = () => T('Проект: .kerf · Векторы: SVG, SVGZ, DXF, CorelDRAW CDR (версии 6–X8 и новее), PDF, Adobe Illustrator AI (совместимый с PDF), HPGL/PLT, LightBurn LBRN/LBRN2 · Изображения: PNG, JPEG, BMP, GIF, WebP, TIFF · 3D: STL, OBJ · G-code: .nc .gcode .ngc .tap .gc.', 'Project: .kerf · Vectors: SVG, SVGZ, DXF, CorelDRAW CDR (versions 6–X8 and newer), PDF, Adobe Illustrator AI (PDF-compatible), HPGL/PLT, LightBurn LBRN/LBRN2 · Images: PNG, JPEG, BMP, GIF, WebP, TIFF · 3D: STL, OBJ · G-code: .nc .gcode .ngc .tap .gc.');
/* decompression through the browser's own zlib (no extra libraries) */
async function inflateBytes(u8, kind) { const ds = new DecompressionStream(kind || 'deflate'); const st = new Blob([u8]).stream().pipeThrough(ds); return new Uint8Array(await new Response(st).arrayBuffer()) }

/* ---------------- images ---------------- */
const IMGS = new Map();
function imgEl(assetId) { const src = assetURL(assetId); if (!src) return null; let im = IMGS.get(assetId); if (!im) { im = new Image(); im.onload = () => { prevCache.clear(); if (typeof draw === 'function') draw() }; im.src = src; IMGS.set(assetId, im) } return im }
const prevCache = new Map();
function decodeTiff(buf) {
  if (typeof UTIF === 'undefined') throw new Error(T('Модуль чтения TIFF не загружен.', 'The TIFF decoder is not loaded.'));
  const ifds = UTIF.decode(buf); if (!ifds.length) throw new Error(T('В TIFF нет изображений.', 'The TIFF has no images.'));
  UTIF.decodeImage(buf, ifds[0]); const rgba = UTIF.toRGBA8(ifds[0]), w = ifds[0].width, h = ifds[0].height;
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, w * h * 4), w, h), 0, 0); return c.toDataURL('image/png');
}
async function fileToImage(f) {
  let url;
  if (/\.tiff?$/i.test(f.name) || f.type === 'image/tiff') url = decodeTiff(await f.arrayBuffer());
  else url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f) });
  const im = new Image(); await new Promise((res, rej) => { im.onload = res; im.onerror = () => rej(new Error(T('Формат изображения не поддерживается или файл повреждён.', 'Unsupported image format or damaged file.'))); im.src = url });
  return im;
}
/* Normalise any image to a JPEG/PNG data URL kept in the project (originals are preserved up to 2400 px). */
function imageToAsset(im, max = 2400) {
  const sc = Math.min(1, max / Math.max(im.naturalWidth || im.width, im.naturalHeight || im.height)), w = Math.max(1, Math.round((im.naturalWidth || im.width) * sc)), h = Math.max(1, Math.round((im.naturalHeight || im.height) * sc));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
  // PNG for anything with transparency or few colours (logos, drawings: no JPEG blocks, alpha kept); JPEG for photos
  const png = imageLooksGraphic(x, w, h);
  if (!png) { x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#fff'; x.fillRect(0, 0, w, h) }
  return { id: addAsset(png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', .92)), w, h, png };
}
function imageLooksGraphic(x, w, h) {
  const step = Math.max(1, Math.floor(Math.sqrt(w * h / 20000))), d = x.getImageData(0, 0, w, h).data, cols = new Set();
  for (let y = 0; y < h; y += step) for (let xx = 0; xx < w; xx += step) { const i = (y * w + xx) * 4; if (d[i + 3] < 250) return true; if (cols.size <= 64) cols.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | d[i + 2] >> 3) }
  return cols.size <= 64;
}
/* Process an image shape to a pw×ph darkness map (0 = no burn, 255 = full). */
function processImage(s, pw, ph) {
  const o = s.img, im = imgEl(o.asset); if (!im || !im.complete || !im.naturalWidth) return null;
  pw = Math.max(1, Math.round(pw)); ph = Math.max(1, Math.round(ph));
  const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, pw, ph);
  const cr = o.crop || { l: 0, t: 0, r: 0, b: 0 }, sw = im.naturalWidth, sh = im.naturalHeight;
  const sx = sw * cr.l, sy = sh * cr.t, sW = Math.max(1, sw * (1 - cr.l - cr.r)), sH = Math.max(1, sh * (1 - cr.t - cr.b)), rot = ((o.rot90 | 0) % 4 + 4) % 4;
  x.save(); x.translate(pw / 2, ph / 2); if (o.fx) x.scale(-1, 1); if (o.fy) x.scale(1, -1); x.rotate(rot * Math.PI / 2);
  const dw = rot % 2 ? ph : pw, dh = rot % 2 ? pw : ph; x.drawImage(im, sx, sy, sW, sH, -dw / 2, -dh / 2, dw, dh); x.restore();
  const d = x.getImageData(0, 0, pw, ph).data, n = pw * ph, g = new Float32Array(n);
  const con = clamp(o.contrast || 0, -100, 100) * 2.55, cf = (259 * (con + 255)) / (255 * (259 - con)), gm = o.gamma || 1;
  for (let i = 0; i < n; i++) { let l = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]; l = cf * (l - 128) + 128 + (o.bright || 0) * 2.55; l = clamp(l, 0, 255); l = 255 * Math.pow(l / 255, 1 / gm); if (o.invert) l = 255 - l; g[i] = 255 - l }
  if (o.band) { const [lo, hi] = o.band; for (let i = 0; i < n; i++) g[i] = g[i] >= lo && g[i] < hi ? 255 : 0 }
  const out = new Uint8ClampedArray(n), md = o.band ? 'threshold' : (o.mode || 'jarvis');
  if (md === 'gray') { for (let i = 0; i < n; i++)out[i] = g[i]; return out }
  if (md === 'threshold') { const t = o.band ? 127 : 255 - (o.thr ?? 128); for (let i = 0; i < n; i++)out[i] = g[i] > t ? 255 : 0; return out }
  if (md === 'ordered') { const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]; for (let y = 0; y < ph; y++)for (let x2 = 0; x2 < pw; x2++) { const i = y * pw + x2; out[i] = g[i] > (B[(y & 3) * 4 + (x2 & 3)] + .5) * 16 ? 255 : 0 } return out }
  return ditherK(g, pw, ph, md in DITHER_K ? md : 'fs'); // Rust/WebAssembly kernel, JavaScript fallback (wasmcore.js)
}
/* Preview of a photo shape; "actual" renders at the real line interval (spec 6.3). */
function imagePreview(s, actual) {
  const b = bboxOf(s.paths), wmm = b[2] - b[0], hmm = b[3] - b[1];
  let pw, ph;
  if (actual) { const L = S.layers[s.layer], iv = Math.max(.02, (isLaser() ? resolveLaser(L, sheetAt(plateOf(s))).interval : .1)); pw = Math.round(wmm / iv); ph = Math.round(hmm / iv); const k = Math.min(1, 1600 / Math.max(pw, ph)); pw = Math.max(1, Math.round(pw * k)); ph = Math.max(1, Math.round(ph * k)) }
  else { pw = Math.round(clamp(wmm * 4, 40, 520)); ph = Math.max(1, Math.round(pw * hmm / wmm)) }
  const fg = css('--fg'), key = [s.id, JSON.stringify(s.img), pw, ph, fg].join('|');
  let c = prevCache.get(key); if (c) return c;
  const data = processImage(s, pw, ph); if (!data) return null;
  c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d'), id = x.createImageData(pw, ph), n = parseInt(fg.slice(1), 16);
  for (let i = 0; i < data.length; i++) { id.data[i * 4] = n >> 16 & 255; id.data[i * 4 + 1] = n >> 8 & 255; id.data[i * 4 + 2] = n & 255; id.data[i * 4 + 3] = data[i] }
  x.putImageData(id, 0, 0); if (prevCache.size > 40) prevCache.clear(); prevCache.set(key, c); return c;
}
/* Resolution check (spec 6.3): source pixels vs. engraving lines, and spot-size limit. */
function imageResolutionWarnings(s) {
  const im = imgEl(s.img.asset); if (!im || !im.naturalWidth) return [];
  const b = bboxOf(s.paths), wmm = b[2] - b[0], cr = s.img.crop || { l: 0, r: 0 }, srcPx = im.naturalWidth * (1 - cr.l - cr.r), L = S.layers[s.layer];
  const iv = isLaser() ? resolveLaser(L, sheetAt(plateOf(s))).interval : .1, need = wmm / iv, out = [];
  if (srcPx < need * .7) out.push(T(`Исходное изображение ${Math.round(srcPx)} пикс. по ширине — меньше, чем строк гравировки (${Math.round(need)}). Детали будут размыты.`, `The source is ${Math.round(srcPx)} px wide — fewer than the engraving lines (${Math.round(need)}). Details will be soft.`));
  if (iv < .06) out.push(T(`Шаг ${iv} мм меньше типичного пятна диодного лазера (~0,08 мм) — соседние строки сольются.`, `An interval of ${iv} mm is below a typical diode spot (~0.08 mm) — adjacent lines will merge.`));
  return out;
}
function newImageProps(assetId) { return { asset: assetId, mode: 'jarvis', bright: 0, contrast: 0, gamma: 1, invert: false, thr: 128, fx: false, fy: false, rot90: 0, crop: { l: 0, t: 0, r: 0, b: 0 }, band: null } }
function addRasterImage(im) {
  const a = imageToAsset(im), ar = a.h / a.w, sh = sheetAt(curPlate), w = Math.min(100, sh.w * .6), h = w * ar, x0 = plateX(curPlate) + sh.x + 10, y0 = sh.y + 10;
  const L = S.layers.find(l => l.type === 'raster') || S.layers[3];
  pushUndo(T('Добавление фото', 'Add photo')); const s = addShape(S, L.id, 'image', [[[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]]], true, { img: newImageProps(a.id), nm: T('Фото', 'Photo') }); sel = new Set([s.id]); changed();
  toast(T('Фото добавлено на слой «Растр». Настройки обработки — справа.', 'Photo added to the Raster layer. Processing settings are on the right.'))
}
/* Split one photo into N brightness bands on separate layers (spec 6.3). */
function splitImageBands(s, n) {
  if (!s || s.kind !== 'image') return; n = clamp(n | 0, 2, 6); pushUndo(T('Разделение фото на слои', 'Split photo into layers'));
  const free = [5, 6, 7, 8, 9, 4, 3], g = s.g || S.nextG++; s.g = g; S.groups[g] = Object.assign({ nm: T('Фото по слоям', 'Photo layers') }, S.groups[g] || {});
  const ids = [];
  for (let k = 0; k < n; k++) {
    const L = S.layers[free[k % free.length]]; L.type = 'raster'; if (!L.name) L.name = T('Тон ', 'Tone ') + (k + 1);
    const c = addShape(S, L.id, 'image', deepCopy(s.paths), true, { g, img: Object.assign(deepCopy(s.img), { band: [255 * k / n, k === n - 1 ? 256 : 255 * (k + 1) / n] }), nm: T(`Тон ${k + 1} из ${n}`, `Tone ${k + 1} of ${n}`) }); ids.push(c.id);
  }
  S.shapes = S.shapes.filter(q => q !== s); sel = new Set(ids); changed();
  toast(T(`Фото разделено на ${n} слоя по яркости — задайте каждому свою мощность в CAM.`, `Photo split into ${n} brightness layers — give each its own power in CAM.`));
}

/* ---------------- vector import ---------------- */
/* SVG path data → polylines (user units); curves flattened to ~tol */
function svgPathPolys(d, tol) {
  const toks = String(d).match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [], out = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cpx = 0, cpy = 0, prev = '', cur = null;
  const num = () => +toks[i++], isNum = () => i < toks.length && !/^[a-zA-Z]$/.test(toks[i]);
  const flag = () => { // arc flags may be written without separators ("a1 1 0 01 10 10")
    const t = toks[i]; if (t.length > 1 && (t[0] === '0' || t[0] === '1') && !t.includes('.')) { toks[i] = t.slice(1); return +t[0] } i++; return +t };
  const start = () => { cur = { pts: [[x, y]], closed: false }; out.push(cur) };
  const seg = (n, f) => { for (let k = 1; k <= n; k++) cur.pts.push(f(k / n)) };
  const nOf = L => Math.max(2, Math.min(200, Math.ceil(L / Math.max(tol, 1e-6) / 4)));
  const cubicTo = (x1, y1, x2, y2, ex, ey) => { const L = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(ex - x2, ey - y2), x0 = x, y0 = y; seg(nOf(L), t => { const u = 1 - t; return [u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey] }); cpx = x2; cpy = y2; x = ex; y = ey };
  const quadTo = (x1, y1, ex, ey) => { const L = Math.hypot(x1 - x, y1 - y) + Math.hypot(ex - x1, ey - y1), x0 = x, y0 = y; seg(nOf(L), t => { const u = 1 - t; return [u * u * x0 + 2 * u * t * x1 + t * t * ex, u * u * y0 + 2 * u * t * y1 + t * t * ey] }); cpx = x1; cpy = y1; x = ex; y = ey };
  const arcTo = (rx, ry, phi, fa, fs, ex, ey) => {
    rx = Math.abs(rx); ry = Math.abs(ry); if (!rx || !ry) { cur.pts.push([ex, ey]); x = ex; y = ey; return }
    const c = Math.cos(phi * Math.PI / 180), s2 = Math.sin(phi * Math.PI / 180), dx = (x - ex) / 2, dy = (y - ey) / 2, x1 = c * dx + s2 * dy, y1 = -s2 * dx + c * dy;
    let lam = x1 * x1 / (rx * rx) + y1 * y1 / (ry * ry); if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam) }
    const sg = fa === fs ? -1 : 1, num2 = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1, co = sg * Math.sqrt(Math.max(0, num2 / (rx * rx * y1 * y1 + ry * ry * x1 * x1))), cx1 = co * rx * y1 / ry, cy1 = -co * ry * x1 / rx;
    const cx = c * cx1 - s2 * cy1 + (x + ex) / 2, cy = s2 * cx1 + c * cy1 + (y + ey) / 2, ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a };
    const t1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry); let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
    if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
    seg(nOf(Math.abs(dt) * Math.max(rx, ry)), t => { const a = t1 + dt * t; return [cx + rx * Math.cos(a) * c - ry * Math.sin(a) * s2, cy + rx * Math.cos(a) * s2 + ry * Math.sin(a) * c] });
    cur.pts[cur.pts.length - 1] = [ex, ey]; x = ex; y = ey;
  };
  while (i < toks.length) {
    if (/^[a-zA-Z]$/.test(toks[i])) cmd = toks[i++]; else if (!cmd) { i++; continue }
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'Z') { if (cur) { cur.closed = true; x = sx; y = sy } cur = null; prev = 'Z'; continue }
    if (!isNum()) { continue }
    if (C === 'M') { x = ox + num(); y = oy + num(); sx = x; sy = y; start(); cmd = rel ? 'l' : 'L'; prev = 'M'; continue }
    if (!cur) start();
    if (C === 'L') { x = ox + num(); y = oy + num(); cur.pts.push([x, y]) }
    else if (C === 'H') { x = ox + num(); cur.pts.push([x, y]) }
    else if (C === 'V') { y = oy + num(); cur.pts.push([x, y]) }
    else if (C === 'C') { const a = ox + num(), b = oy + num(), c2 = ox + num(), d2 = oy + num(), e = ox + num(), f = oy + num(); cubicTo(a, b, c2, d2, e, f) }
    else if (C === 'S') { const r1 = /[CS]/.test(prev) ? [2 * x - cpx, 2 * y - cpy] : [x, y], c2 = ox + num(), d2 = oy + num(), e = ox + num(), f = oy + num(); cubicTo(r1[0], r1[1], c2, d2, e, f) }
    else if (C === 'Q') { const a = ox + num(), b = oy + num(), e = ox + num(), f = oy + num(); quadTo(a, b, e, f) }
    else if (C === 'T') { const r1 = /[QT]/.test(prev) ? [2 * x - cpx, 2 * y - cpy] : [x, y], e = ox + num(), f = oy + num(); quadTo(r1[0], r1[1], e, f) }
    else if (C === 'A') { const rx = num(), ry = num(), ph = num(), fa = flag(), fs = flag(), e = ox + num(), f = oy + num(); arcTo(rx, ry, ph, fa, fs, e, f) }
    else { i++; continue }
    if (!/[CSQT]/.test(C)) { cpx = x; cpy = y } prev = C;
  }
  return out.filter(p => p.pts.length > 1 && p.pts.every(q => isFinite(q[0]) && isFinite(q[1])));
}
function svgElementPolys(el, tol) {
  const tag = el.nodeName.toLowerCase(), A = k => parseFloat(el.getAttribute(k)) || 0;
  if (tag === 'path') return svgPathPolys(el.getAttribute('d') || '', tol);
  if (tag === 'rect') { const x = A('x'), y = A('y'), w = A('width'), h = A('height'); let rx = el.hasAttribute('rx') ? A('rx') : A('ry'), ry = el.hasAttribute('ry') ? A('ry') : rx; rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2); if (!(w > 0 && h > 0)) return [];
    if (!rx || !ry) return [{ pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true }];
    return svgPathPolys(`M${x + rx},${y}H${x + w - rx}A${rx},${ry} 0 0 1 ${x + w},${y + ry}V${y + h - ry}A${rx},${ry} 0 0 1 ${x + w - rx},${y + h}H${x + rx}A${rx},${ry} 0 0 1 ${x},${y + h - ry}V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}Z`, tol) }
  if (tag === 'circle' || tag === 'ellipse') { const cx = A('cx'), cy = A('cy'), rx = tag === 'circle' ? A('r') : A('rx'), ry = tag === 'circle' ? A('r') : A('ry'); if (!(rx > 0 && ry > 0)) return []; const n = Math.max(24, Math.min(720, Math.ceil(Math.PI * 2 * Math.max(rx, ry) / Math.max(tol * 4, 1e-3)))), pts = []; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]) } return [{ pts, closed: true }] }
  if (tag === 'line') return [{ pts: [[A('x1'), A('y1')], [A('x2'), A('y2')]], closed: false }];
  if (tag === 'polyline' || tag === 'polygon') { const v = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number), pts = []; for (let k = 0; k + 1 < v.length; k += 2) pts.push([v[k], v[k + 1]]); return pts.length > 1 ? [{ pts, closed: tag === 'polygon' }] : [] }
  return [];
}
function importSVG(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml'), root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error(T('Файл не является корректным SVG.', 'The file is not valid SVG.'));
  const svg = document.importNode(root, true); const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  const unit = a => { const m = /^\s*([\d.]+)\s*(mm|cm|in|pt|pc|px)?/.exec(a || ''); if (!m) return null; return +m[1] * ({ mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96 }[m[2] || 'px']) };
  const vw = vb.length === 4 ? vb[2] : parseFloat(svg.getAttribute('width')) || 100, vh = vb.length === 4 ? vb[3] : parseFloat(svg.getAttribute('height')) || 100;
  const wmm = unit(svg.getAttribute('width')), k = wmm && vw ? wmm / vw : 25.4 / 96;
  svg.setAttribute('width', vw); svg.setAttribute('height', vh); if (vb.length !== 4) svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
  svg.setAttribute('style', 'position:absolute;left:-10000px;top:0;visibility:hidden'); document.body.appendChild(svg);
  const out = [], skipped = new Set();
  for (const el of svg.querySelectorAll('image,text,foreignObject')) skipped.add(el.nodeName.toLowerCase());
  try {
    // hidden layers keep their geometry (shown as "hidden in the file" in the layer dialog)
    const hid = [...svg.querySelectorAll('g,path,rect,circle,ellipse,line,polyline,polygon')].filter(e => !e.closest('defs,clipPath,mask,symbol,marker,pattern') && getComputedStyle(e).display === 'none');
    for (const e of hid) { e.setAttribute('data-skh', '1'); e.style.display = 'inline' }
    const INK = 'http://www.inkscape.org/namespaces/inkscape', topG = [...svg.children].filter(c => c.nodeName.toLowerCase() === 'g');
    const layerOf = el => { for (let a = el.parentNode; a && a !== svg; a = a.parentNode) { if (!a.getAttribute) continue; if (a.getAttributeNS(INK, 'groupmode') === 'layer' || a.getAttribute('inkscape:groupmode') === 'layer') return a.getAttributeNS(INK, 'label') || a.getAttribute('inkscape:label') || a.id || '' } if (topG.length > 1) { let a = el; while (a.parentNode && a.parentNode !== svg) a = a.parentNode; if (a !== el && topG.includes(a)) return a.getAttribute('data-name') || a.id || '' } return '' };
    const cssHex = c => { const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(c || ''); if (!m || m[4] === '0') return null; return '#' + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join('') };
    const styleOf = (el, sc) => { const cs = getComputedStyle(el), op = +cs.opacity === 0; const stroke = !op && cs.stroke !== 'none' && +cs.strokeOpacity !== 0 ? cssHex(cs.stroke) : null, fill = !op && cs.fill !== 'none' && +cs.fillOpacity !== 0 ? cssHex(cs.fill) : null;
      return { stroke, sw: stroke ? (parseFloat(cs.strokeWidth) || 0) * k * sc : 0, fill, name: layerOf(el), hidden: !!el.closest('[data-skh]') } };
    for (const el of svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon')) {
      if (el.closest('defs,clipPath,mask,symbol,marker,pattern')) continue;
      const m = el.getCTM(), tf = (px, py) => m ? [(m.a * px + m.c * py + m.e) * k, (vh - (m.b * px + m.d * py + m.f)) * k] : [px * k, (vh - py) * k];
      const sc = m ? Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1 : 1; let fast = null; try { fast = svgElementPolys(el, .02 / (k * sc)) } catch (e) { fast = null }
      if (fast && fast.length) {
        const clean = fast.map(p => { const pts = p.pts.map(q => tf(q[0], q[1])), f = pts[0], l = pts[pts.length - 1], cl = p.closed || (pts.length > 2 && Math.hypot(f[0] - l[0], f[1] - l[1]) < .01); return { q: cl ? rdpClosed(p.closed && !(Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-9) ? pts : pts.slice(0, -1), .01) : rdp(pts, .01), cl } }).filter(c => c.q.length > 1);
        if (!clean.length) continue; const style = styleOf(el, sc);
        if (clean.every(c => c.cl)) out.push({ paths: clean.map(c => c.q), closed: true, style }); else for (const c of clean) out.push({ paths: [c.q], closed: c.cl, style });
        continue;
      }
      let len = 0; try { len = el.getTotalLength() } catch (e) { } if (!len) continue; const step = Math.max(len / 6000, .2 / k), n = Math.ceil(len / step), pts = [];
      for (let i = 0; i <= n; i++) { let p = el.getPointAtLength(Math.min(len, i * step)); if (m) p = p.matrixTransform(m); pts.push([p.x * k, (vh - p.y) * k]) }
      const paths = [[pts[0]]]; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) > step * k * 4) paths.push([]); paths[paths.length - 1].push(b) }
      const tag = el.nodeName.toLowerCase(), forced = ['rect', 'circle', 'ellipse', 'polygon'].includes(tag);
      const clean = paths.filter(p => p.length > 1).map(p => { const cl = forced || Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < step * k * 2.5; return { q: cl ? rdpClosed(p.slice(0, -1), .02) : rdp(p, .02), cl } });
      if (!clean.length) continue; const style = styleOf(el, sc);
      if (clean.every(c => c.cl)) out.push({ paths: clean.map(c => c.q), closed: true, style }); else for (const c of clean) out.push({ paths: [c.q], closed: c.cl, style })
    }
  } finally { svg.remove() }
  if (!out.length) throw new Error(T('В SVG не найдено контуров.', 'No outlines found in the SVG.') + (skipped.size ? ' ' + T('Есть неподдерживаемые элементы: ', 'Unsupported elements present: ') + [...skipped].join(', ') : ''));
  importStyled(out, 'svg', skipped.size ? T(`Пропущены неподдерживаемые элементы: ${[...skipped].join(', ')} (переведите текст в кривые перед экспортом из редактора).`, `Skipped unsupported elements: ${[...skipped].join(', ')} (convert text to paths before exporting).`) : null);
}
/* AutoCAD colour index → hex (1–9 exact, the rest approximated by the ACI hue wheel; 7 shown black on the light canvas) */
function aciColor(i) {
  const base = { 1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff', 5: '#0000ff', 6: '#ff00ff', 7: '#000000', 8: '#808080', 9: '#c0c0c0' };
  if (base[i]) return base[i]; if (i >= 250) { const g = Math.round(51 + (i - 250) * 40.8); return '#' + g.toString(16).padStart(2, '0').repeat(3) }
  if (i < 10 || i > 249) return '#000000';
  const h = Math.floor((i - 10) / 10) * 15, k = (i - 10) % 10, v = [1, 1, .8, .8, .6, .6, .5, .5, .3, .3][k], sa = k % 2 ? .5 : 1;
  const f = n => { const q = (n + h / 60) % 6; return v - v * sa * Math.max(0, Math.min(q, 4 - q, 1)) };
  return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
function importDXF(text) {
  const Ls = text.split(/\r?\n/), pr = []; for (let i = 0; i + 1 < Ls.length; i += 2)pr.push([parseInt(Ls[i].trim(), 10), Ls[i + 1].trim()]);
  let scale = 1; for (let i = 0; i < pr.length - 1; i++)if (pr[i][0] === 9 && pr[i][1] === '$INSUNITS') { const u = +pr[i + 1][1]; scale = u === 1 ? 25.4 : u === 2 ? 304.8 : u === 5 ? 10 : u === 6 ? 1000 : 1 }
  let i = pr.findIndex((p, k) => p[0] === 2 && p[1] === 'ENTITIES' && pr[k - 1] && pr[k - 1][1] === 'SECTION'); if (i < 0) throw new Error(T('В DXF нет раздела ENTITIES.', 'The DXF has no ENTITIES section.'));
  const ents = []; let cur = null; for (i++; i < pr.length; i++) { const [c, v] = pr[i]; if (c === 0) { if (v === 'ENDSEC') break; cur = { type: v, d: [] }; ents.push(cur) } else if (cur) cur.d.push([c, v]) }
  // layer table: name → colour, off (negative colour) or frozen (flag 1)
  const LAY = new Map(); { const t = pr.findIndex((p, k) => p[0] === 2 && p[1] === 'LAYER' && pr[k - 1] && pr[k - 1][1] === 'TABLE'); if (t >= 0) { let L = null; for (let k = t + 1; k < pr.length; k++) { const [c, v] = pr[k]; if (c === 0) { if (v === 'ENDTAB') break; L = v === 'LAYER' ? { name: '', color: 7, flags: 0, tc: null } : null; continue } if (!L) continue; if (c === 2) { L.name = v; LAY.set(v, L) } else if (c === 62) L.color = +v; else if (c === 70) L.flags = +v; else if (c === 420) L.tc = +v } } }
  const tcHex = n => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
  const styleOf = e => { let lay = '0', col = 256, tc = null; for (const [c, v] of e.d) { if (c === 8) lay = v; else if (c === 62) col = +v; else if (c === 420) tc = +v } const L = LAY.get(lay); if (tc == null && (col === 256 || col === 0)) { col = L ? L.color : 7; tc = L && L.tc != null ? L.tc : null } return { stroke: tc != null ? tcHex(tc) : aciColor(Math.abs(col)), sw: 0, fill: null, name: lay, hidden: !!L && (L.color < 0 || (L.flags & 1) === 1) } };
  const num = (e, c, def = 0) => { const p = e.d.find(q => q[0] === c); return p ? parseFloat(p[1]) : def };
  const arcP = (cx, cy, r, a0, a1) => { if (a1 <= a0) a1 += 360; return arcPts(cx, cy, r, a0 * Math.PI / 180, a1 * Math.PI / 180) };
  const bulge = (p1, p2, b) => { const th = 4 * Math.atan(b), c = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]); if (c < 1e-9 || Math.abs(b) < 1e-9) return []; const r = c / (2 * Math.sin(th / 2)), d = r * Math.cos(th / 2), ux = (p2[0] - p1[0]) / c, uy = (p2[1] - p1[1]) / c, cx = (p1[0] + p2[0]) / 2 - uy * d, cy = (p1[1] + p2[1]) / 2 + ux * d, a1 = Math.atan2(p1[1] - cy, p1[0] - cx), n = Math.max(4, Math.ceil(Math.abs(th * r) / .5)), o = []; for (let k = 1; k < n; k++) { const a = a1 + th * k / n; o.push([cx + Math.abs(r) * Math.cos(a), cy + Math.abs(r) * Math.sin(a)]) } return o };
  const out = [], openBy = new Map(), unsupported = new Set(); let st = null; const open = { push: p => { const k = JSON.stringify(st); if (!openBy.has(k)) openBy.set(k, { st, list: [] }); openBy.get(k).list.push(p) } };
  const vtxList = d => { const v = []; let last = null; for (const [c, val] of d) { if (c === 10) { last = [parseFloat(val), 0, 0]; v.push(last) } else if (c === 20 && last) last[1] = parseFloat(val); else if (c === 42 && last) last[2] = parseFloat(val) } return v };
  const polyFrom = (v, closed) => { const p = []; for (let k = 0; k < v.length; k++) { p.push([v[k][0], v[k][1]]); const nx = v[(k + 1) % v.length]; if (v[k][2] && (k < v.length - 1 || closed)) p.push(...bulge(v[k], nx, v[k][2])) } return p };
  const outPush = out.push.bind(out); out.push = o => outPush(Object.assign(o, { style: st }));
  for (let k = 0; k < ents.length; k++) {
    const e = ents[k]; st = styleOf(e);
    if (e.type === 'LINE') open.push([[num(e, 10), num(e, 20)], [num(e, 11), num(e, 21)]]);
    else if (e.type === 'LWPOLYLINE') { const cl = (num(e, 70) & 1) === 1, p = polyFrom(vtxList(e.d), cl); if (p.length > 1) (cl ? out.push({ paths: [p], closed: true }) : open.push(p)) }
    else if (e.type === 'POLYLINE') { const cl = (num(e, 70) & 1) === 1, v = []; while (ents[k + 1] && ents[k + 1].type === 'VERTEX') { k++; v.push([num(ents[k], 10), num(ents[k], 20), num(ents[k], 42)]) } const p = polyFrom(v, cl); if (p.length > 1) (cl ? out.push({ paths: [p], closed: true }) : open.push(p)) }
    else if (e.type === 'CIRCLE') { const r = num(e, 40); out.push({ paths: [ellipsePts(num(e, 10), num(e, 20), r, r)], closed: true }) }
    else if (e.type === 'ARC') open.push(arcP(num(e, 10), num(e, 20), num(e, 40), num(e, 50), num(e, 51)));
    else if (e.type === 'ELLIPSE') {
      const cx = num(e, 10), cy = num(e, 20), mx = num(e, 11), my = num(e, 21), ra = num(e, 40, 1), t0 = num(e, 41, 0), t1 = num(e, 42, Math.PI * 2), R = Math.hypot(mx, my), rot = Math.atan2(my, mx); const t1b = t1 <= t0 ? t1 + Math.PI * 2 : t1; const n = Math.max(24, Math.ceil((t1b - t0) * R / .5)), p = [];
      for (let q = 0; q <= n; q++) { const t = t0 + (t1b - t0) * q / n, x = R * Math.cos(t), y = R * ra * Math.sin(t); p.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]) }
      if (Math.abs(t1b - t0 - Math.PI * 2) < 1e-3) out.push({ paths: [p.slice(0, -1)], closed: true }); else open.push(p)
    }
    else if (e.type === 'SPLINE') { const fit = [], ctl = []; let lx = null; for (const [c, v] of e.d) { if (c === 11) { lx = [+v, 0]; fit.push(lx) } else if (c === 21 && lx) lx[1] = +v; else if (c === 10) { lx = [+v, 0]; ctl.push(lx) } else if (c === 20 && lx) lx[1] = +v } const p = fit.length > 1 ? fit : ctl; if (p.length > 1) { if ((num(e, 70) & 1) === 1) out.push({ paths: [p], closed: true }); else open.push(p) } }
    else if (!['VERTEX', 'SEQEND', 'POINT'].includes(e.type)) unsupported.add(e.type);
  }
  for (const { st: s2, list } of openBy.values()) { st = s2; for (const ch of joinOpenPaths(list, .01)) { if (ch.length > 2 && Math.hypot(ch[0][0] - ch[ch.length - 1][0], ch[0][1] - ch[ch.length - 1][1]) < .01) out.push({ paths: [ch.slice(0, -1)], closed: true }); else out.push({ paths: [ch], closed: false }) } }
  if (!out.length) throw new Error(T('В DXF не найдено поддерживаемых контуров.', 'No supported outlines found in the DXF.') + (unsupported.size ? ' ' + T('Есть объекты: ', 'Found: ') + [...unsupported].join(', ') : ''));
  for (const o of out) o.paths = mapPaths(o.paths, (x, y) => [x * scale, y * scale]);
  importStyled(out, 'dxf', unsupported.size ? T(`Пропущены объекты DXF: ${[...unsupported].join(', ')}.`, `Skipped DXF entities: ${[...unsupported].join(', ')}.`) : null);
}
/* multi-page vector results (CDR, PDF, PLT, LightBurn): pages side by side, outlines simplified */
const IMPORT_WARN = () => ({ text: T('текст (переведите в кривые)', 'text (convert to curves)'), bitmap: T('растровые картинки', 'bitmaps'), image: T('растровые картинки', 'images'), effect: T('эффекты (тени, перетекания)', 'effects (shadows, blends)'), shading: T('градиенты', 'gradients'), damaged: T('повреждённые объекты', 'damaged objects'), objstm: T('часть объектов', 'some objects') });
function importPages(res, kind, opts = {}) {
  const out = []; let x = 0, n = 0;
  for (const pg of res.pages) {
    const items = [];
    for (const s of pg.shapes) {
      const paths = [], open = [];
      for (const p of s.paths) {
        if (p.length < 2) continue; const f = p[0], l = p[p.length - 1], cl = s.closed || (p.length > 2 && Math.hypot(f[0] - l[0], f[1] - l[1]) < .01);
        const q = cl ? rdpClosed(s.closed ? p : p.slice(0, -1), .01) : rdp(p, .01); if (q.length < 2) continue; (cl ? paths : open).push(q);
      }
      const style = s.style || null; if (paths.length) items.push({ paths, closed: true, style }); for (const q of open) items.push({ paths: [q], closed: false, style });
    }
    if (!items.length) continue;
    let b = null; for (const o of items) { const bb = bboxOf(o.paths); b = b ? unionBox(b, bb) : bb }
    const dx = x - b[0]; for (const o of items) { o.paths = mapPaths(o.paths, (px, py) => [px + dx, py]); out.push(o) }
    x += b[2] - b[0] + 20; n++;
  }
  const W = IMPORT_WARN(), skipped = [...new Set((res.warnings || []).map(w => W[w] || (/^(filter|cmd|shape):/.test(w) ? T('неподдерживаемые команды', 'unsupported commands') : null)).filter(Boolean))];
  if (!out.length) throw new Error(T('В файле не найдено контуров.', 'No outlines found in the file.') + (skipped.length ? ' ' + T('Пропущено: ', 'Skipped: ') + skipped.join(', ') + '.' : ''));
  const notes = []; if (n > 1) notes.push(T(`страниц: ${n}, разложены в ряд`, `${n} pages laid out in a row`)); if (skipped.length) notes.push(T('пропущено: ', 'skipped: ') + skipped.join(', ')); if (opts.unverified) notes.push(opts.unverified);
  importStyled(out, kind, notes.join(' · ') || null);
}
async function importMoreVector(f, name) {
  const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1].toLowerCase(), buf = new Uint8Array(await f.arrayBuffer());
  if (ext === 'svgz') { importSVG(new TextDecoder().decode(await inflateBytes(buf, 'gzip'))); return }
  if (ext === 'eps' || (ext === 'ai' && String.fromCharCode(...buf.subarray(0, 4)) === '%!PS')) throw new Error(T('Это PostScript (EPS или старый AI). Сохраните файл как PDF, SVG или DXF — или в Illustrator включите «Создать PDF-совместимый файл».', 'This is PostScript (EPS or legacy AI). Save the file as PDF, SVG or DXF — or enable “Create PDF Compatible File” in Illustrator.'));
  if (ext === 'cdr') {
    let res; try { res = await parseCDR(buf, b => inflateBytes(b, 'deflate'), b => inflateBytes(b, 'deflate-raw')) } catch (e) { throw new Error(/1–5/.test(e.message) ? T('Файлы CorelDRAW 1–5 не поддерживаются. Сохраните файл в более новой версии или как SVG/DXF.', 'CorelDRAW 1–5 files are not supported. Save in a newer version or as SVG/DXF.') : T('Не удалось прочитать CDR: ', 'Could not read the CDR: ') + e.message) }
    const tested = res.version >= 1200 && res.version <= 2400;
    importPages(res, 'cdr', { unverified: tested ? null : T(`версия CorelDRAW ${res.version / 100 | 0} не проверена — сверьте размеры`, `CorelDRAW version ${res.version / 100 | 0} not tested — check the dimensions`) }); return;
  }
  if (ext === 'pdf' || ext === 'ai') {
    let res; try { res = await parsePDF(buf, b => inflateBytes(b, 'deflate')) } catch (e) { throw new Error(e.message === 'encrypted' ? T('PDF защищён (шифрование). Снимите защиту и попробуйте снова.', 'The PDF is protected (encrypted). Remove the protection and try again.') : e.message === 'PostScript' ? T('Это PostScript — сохраните как PDF.', 'This is PostScript — save it as PDF.') : T('Не удалось прочитать PDF: ', 'Could not read the PDF: ') + e.message) }
    importPages(res, ext, { unverified: ext === 'ai' ? T('импорт AI не проверен на реальных файлах', 'AI import not tested on real files') : null }); return;
  }
  if (/^(plt|hpgl|hpg)$/.test(ext)) { importPages(parseHPGL(new TextDecoder('latin1').decode(buf)), 'plt', { unverified: T('импорт PLT не проверен на реальных файлах — сверьте масштаб (40 единиц = 1 мм)', 'PLT import not tested on real files — check the scale (40 units = 1 mm)') }); return }
  if (/^lbrn2?$/.test(ext)) { importPages(parseLBRN(new TextDecoder().decode(buf)), 'lbrn', { unverified: T('импорт LightBurn не проверен на реальных файлах — сверьте размеры', 'LightBurn import not tested on real files — check the dimensions') }); return }
}
function placeImported(out, kind, note, extra, noUndo) {
  let b = null; for (const o of out) { const x = bboxOf(o.paths); b = b ? unionBox(b, x) : x }
  const sh = sheetAt(curPlate), dx = plateX(curPlate) + sh.x + 5 - b[0], dy = sh.y + 5 - b[1];
  if (!noUndo) pushUndo(T('Импорт', 'Import')); const ids = new Set(), g = out.length > 1 || extra ? S.nextG++ : 0;
  if (g) S.groups[g] = Object.assign({ nm: kind.toUpperCase() }, extra || {});
  for (const o of out) { const s = addShape(S, o.layer ?? curDrawLayer, kind, mapPaths(o.paths, (x, y) => [x + dx, y + dy]), o.closed, g ? { g } : {}); ids.add(s.id) }
  sel = ids; changed();
  const bw = b[2] - b[0], bh = b[3] - b[1];
  toast(T(`Импортировано контуров: ${out.length} · ${fx(bw, 1)}×${fx(bh, 1)} мм`, `Imported ${out.length} outlines · ${fx(bw, 1)}×${fx(bh, 1)} mm`) + (note ? ' · ' + note : ''), note ? 'warn' : null);
}

/* ---------------- universal file entry (dialogs, drag-and-drop, desktop) ---------------- */
async function importFile(f) {
  const name = f.name || '';
  try {
    if (PROJECT_EXT.test(name)) { const text = await f.text(); await openProjectText(text, name, fileSysPath(f)); return }
    if (GCODE_EXT.test(name)) { const text = await f.text(); loadGcode(text, name); P.t = 0; P.playing = false; switchTab('gcode'); refresh(); toast(T(`Открыт ${name}: ${P.lines.length} строк`, `Opened ${name}: ${P.lines.length} lines`)); return }
    if (MORE_VEC_EXT.test(name)) { busy(T('Читаю файл…', 'Reading the file…')); try { await importMoreVector(f, name) } finally { busy(null) } if (tab !== 'cad') switchTab('cad'); return }
    if (VECTOR_EXT.test(name) || /svg/.test(f.type)) { const text = await f.text(); if (/\.dxf$/i.test(name) || /^\s*0\s*\r?\n\s*SECTION/.test(text)) importDXF(text); else importSVG(text); if (tab !== 'cad') switchTab('cad'); return }
    if (MODEL_EXT.test(name)) { await slLoadFile(f); return }
    if (RASTER_EXT.test(name) || /^image\//.test(f.type)) { const im = await fileToImage(f); if (tab !== 'cad') switchTab('cad'); imageChooser(im); return }
    throw new Error(T('Неизвестный формат файла.', 'Unknown file format.') + ' ' + SUPPORTED_FORMATS());
  } catch (e) { logError('import', e); toast(T('Не удалось открыть «', 'Could not open “') + name + T('»: ', '”: ') + (e.message || e), 'err') }
}

/* ---------------- image chooser ---------------- */
let pendingImg = null;
function imageChooser(im) {
  pendingImg = im;
  openModal(T('Что сделать с изображением?', 'What should we do with the image?'), `<div class="wiz">
  <button data-act="imgRaster">${ic('image', 22)}<b>${T('Растровая гравировка', 'Raster engraving')}</b><small>${T('Дизеринг или полутона, регулировка яркости, обрезка, поворот.', 'Dithering or greyscale, brightness, crop, rotation.')}</small></button>
  <button data-act="imgTrace">${ic('wand', 22)}<b>${T('Трассировка в векторы', 'Trace to vectors')}</b><small>${T('Контуры для резки или гравировки, ч/б или по цветам.', 'Outlines for cutting or engraving, B/W or by colour.')}</small></button>
  <button data-act="imgLayered">${ic('layers', 22)}<b>${T('Многослойная картина', 'Layered picture')}</b><small>${T('1–10 физических слоёв по яркости.', '1–10 physical layers by brightness.')}</small></button>
  <button data-act="imgRelief" class="${isLaser() ? 'dim' : ''}">${machBadge('cnc')}${ic('relief', 22)}<b>${T('3D-рельеф (фрезер)', '3D relief (router)')}</b><small>${isLaser() ? T('Только для фрезерного станка. Для лазера — растр в оттенках серого.', 'Router only. For lasers use greyscale raster.') : T('Карта высот → черновая и чистовая фрезеровка.', 'Height map → roughing and finishing.')}</small></button></div>`, null);
}

/* ---------------- tracing (spec 7.2) ---------------- */
let TR = null;
function openTrace(img, preset) {
  const a = imageToAsset(img, 1600);
  TR = Object.assign({ asset: a.id, img, mode: 'bw', thr: 128, invert: false, colors: 4, smooth: 1, detail: 1, minArea: 2, dropBg: true, width: Math.min(120, sheetAt(curPlate).w - 20), layer: curDrawLayer, multiLayer: true, view: 'after', loops: null }, preset || {});
  openModal(T('Трассировка изображения', 'Trace image'), `<div class="ws-view"><canvas id="trCv"></canvas><div class="float" style="top:12px;left:12px;padding:4px;display:flex;gap:4px"><div class="seg"><button data-act="trView" data-v="before" aria-pressed="false">${T('До', 'Before')}</button><button data-act="trView" data-v="after" aria-pressed="true">${T('После', 'After')}</button></div></div><div class="badge" id="trInfo">…</div></div><div class="ws-side" id="trSide"></div>`,
    `<p class="note">${T('Исходное изображение сохраняется в проекте: позже можно перетрассировать с другими параметрами.', 'The original image is kept in the project so you can re-trace later with other settings.')}</p><button class="btn" data-act="closeModal">${T('Отмена', 'Cancel')}</button><button class="primary" data-act="doTrace">${T('Создать контуры', 'Create outlines')}</button>`, 'xl');
  onModalClose = () => { TR = null };
  renderTraceSide(); traceRun();
}
function renderTraceSide() {
  if (!TR) return;
  $('#trSide').innerHTML = `<div class="sec"><h3>${T('Режим', 'Mode')}</h3><div class="seg full"><button data-act="trMode" data-v="bw" aria-pressed="${TR.mode === 'bw'}">${T('Чёрно-белый', 'Black & white')}</button><button data-act="trMode" data-v="color" aria-pressed="${TR.mode === 'color'}">${T('По цветам', 'By colour')}</button></div>
   ${TR.mode === 'bw' ? `<label class="fld"><span>${T('Порог', 'Threshold')}: <b>${TR.thr}</b></span><input type="range" data-tr="thr" min="10" max="245" value="${TR.thr}"></label>${chkF(T('Инвертировать', 'Invert'), 'data-tr="invert"', TR.invert)}`
      : `${numF(T('Число цветов', 'Number of colours'), 'data-tr="colors" min="2" max="8"', TR.colors, '', 1)}${chkF(T('Убрать фон (цвет по краям)', 'Remove background (edge colour)'), 'data-tr="dropBg"', TR.dropBg)}${chkF(T('Каждый цвет — на свой слой', 'Each colour on its own layer'), 'data-tr="multiLayer"', TR.multiLayer)}`}</div>
   <div class="sec"><h3>${T('Очистка', 'Clean-up')}</h3>
   <label class="fld"><span>${T('Сглаживание', 'Smoothing')}: <b>${TR.smooth}</b></span><input type="range" data-tr="smooth" min="0" max="6" value="${TR.smooth}"></label>
   <label class="fld"><span>${T('Детализация (меньше — точнее)', 'Detail (lower is finer)')}: <b>${TR.detail}</b></span><input type="range" data-tr="detail" min="0.3" max="4" step="0.1" value="${TR.detail}"></label>
   ${numF(T('Мин. размер элемента', 'Minimum element size'), 'data-tr="minArea" min="0"', TR.minArea, MM() + '²', .5)}</div>
   <div class="sec"><h3>${T('Результат', 'Output')}</h3>${numF(T('Ширина', 'Width'), 'data-tr="width" min="5"', TR.width, MM(), 1)}
   ${TR.mode === 'bw' || !TR.multiLayer ? selF(T('Слой', 'Layer'), 'data-tr="layer"', S.layers.filter(l => l.id !== TOOL_L).map(l => [l.id, `${l.id + 1}. ${layerName(l)} — ${ltypeName(l.type)}`]), TR.layer) : `<p class="note">${T('Цвета лягут на слои 5–10, тип и параметры задаются в CAM.', 'Colours go to layers 5–10; set their type and parameters in CAM.')}</p>`}</div>`;
}
function traceComputeMasks() {
  const img = TR.img, sc = Math.min(1, 900 / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height)), w = Math.max(2, Math.round((img.naturalWidth || img.width) * sc)), h = Math.max(2, Math.round((img.naturalHeight || img.height) * sc));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); if (TR.smooth) x.filter = `blur(${TR.smooth * .6}px)`; x.drawImage(img, 0, 0, w, h); x.filter = 'none';
  const d = x.getImageData(0, 0, w, h).data, n = w * h, masks = [];
  if (TR.mode === 'bw') { const m = new Uint8Array(n); for (let i = 0; i < n; i++) { const l = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]; m[i] = (l < TR.thr) !== TR.invert ? 1 : 0 } masks.push({ m, color: '#000000' }) }
  else {
    const K = clamp(TR.colors | 0, 2, 8), cent = []; seedRnd = 12345;
    for (let k = 0; k < K; k++) { const i = Math.floor(rnd() * n); cent.push([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]) }
    const lab = new Uint8Array(n), stride = Math.max(1, Math.floor(n / 60000));
    for (let it = 0; it < 12; it++) {
      const sum = cent.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < n; i += stride) { let best = 0, bd = 1e12; for (let k = 0; k < K; k++) { const dr = d[i * 4] - cent[k][0], dg = d[i * 4 + 1] - cent[k][1], db = d[i * 4 + 2] - cent[k][2], e = dr * dr + dg * dg + db * db; if (e < bd) { bd = e; best = k } } const s = sum[best]; s[0] += d[i * 4]; s[1] += d[i * 4 + 1]; s[2] += d[i * 4 + 2]; s[3]++ }
      for (let k = 0; k < K; k++) if (sum[k][3]) cent[k] = [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]]; else { const i = Math.floor(rnd() * n); cent[k] = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]] }
    }
    const cnt = new Array(K).fill(0), edge = new Array(K).fill(0);
    for (let i = 0; i < n; i++) { let best = 0, bd = 1e12; for (let k = 0; k < K; k++) { const dr = d[i * 4] - cent[k][0], dg = d[i * 4 + 1] - cent[k][1], db = d[i * 4 + 2] - cent[k][2], e = dr * dr + dg * dg + db * db; if (e < bd) { bd = e; best = k } } lab[i] = best; cnt[best]++; const xx = i % w, yy = (i / w) | 0; if (xx === 0 || yy === 0 || xx === w - 1 || yy === h - 1) edge[best]++ }
    const bg = TR.dropBg ? edge.indexOf(Math.max(...edge)) : -1;
    for (let k = 0; k < K; k++) { if (k === bg || !cnt[k]) continue; const m = new Uint8Array(n); for (let i = 0; i < n; i++)m[i] = lab[i] === k ? 1 : 0; masks.push({ m, color: '#' + cent[k].map(v => Math.round(v).toString(16).padStart(2, '0')).join(''), lum: .299 * cent[k][0] + .587 * cent[k][1] + .114 * cent[k][2] }) }
    masks.sort((a, b) => a.lum - b.lum);
  }
  return { masks, w, h };
}
function traceRun() {
  if (!TR) return; clearTimeout(TR._t);
  TR._t = setTimeout(() => {
    if (!TR) return; const { masks, w, h } = traceComputeMasks(), k = TR.width / w, minPx = TR.minArea / (k * k);
    TR.loops = masks.map(mk => ({ color: mk.color, loops: traceMask(mk.m, w, h).map(l => TR.smooth ? chaikin(rdpClosed(l, TR.detail), 1) : rdpClosed(l, TR.detail)).filter(l => l.length > 2 && Math.abs(area(l)) > Math.max(2, minPx)) }));
    TR.w = w; TR.h = h; const total = TR.loops.reduce((s, x) => s + x.loops.length, 0);
    $('#trInfo').textContent = T(`Контуров: ${total} · ${TR.loops.length} ${TR.mode === 'bw' ? 'слой' : 'цвет(ов)'} · ${fx(TR.width, 0)}×${fx(TR.width * h / w, 0)} мм`, `Outlines: ${total} · ${TR.loops.length} ${TR.mode === 'bw' ? 'layer' : 'colour(s)'} · ${fx(TR.width, 0)}×${fx(TR.width * h / w, 0)} mm`);
    traceDraw();
  }, 120);
}
function traceDraw() {
  const cv2 = $('#trCv'); if (!cv2 || !TR || !TR.loops) return; const r = cv2.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; if (!r.width) return;
  cv2.width = Math.round(r.width * dpr); cv2.height = Math.round(r.height * dpr); const c = cv2.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, r.width, r.height);
  const s = Math.min((r.width - 40) / TR.w, (r.height - 60) / TR.h), ox = (r.width - TR.w * s) / 2, oy = (r.height - TR.h * s) / 2;
  if (TR.view === 'before') { c.drawImage(TR.img, ox, oy, TR.w * s, TR.h * s); return }
  c.fillStyle = '#fff'; c.fillRect(ox, oy, TR.w * s, TR.h * s);
  for (const g of TR.loops) { c.beginPath(); for (const l of g.loops) { l.forEach((p, i) => i ? c.lineTo(ox + p[0] * s, oy + p[1] * s) : c.moveTo(ox + p[0] * s, oy + p[1] * s)); c.closePath() } c.fillStyle = TR.mode === 'bw' ? '#1a1f26' : g.color; c.fill('evenodd'); c.strokeStyle = '#e5484d'; c.lineWidth = .8; c.stroke() }
}
function doTrace() {
  if (!TR || !TR.loops) return; const k = TR.width / TR.w, total = TR.loops.reduce((s, x) => s + x.loops.length, 0);
  if (!total) { toast(T('Контуры не найдены — поменяйте порог или число цветов.', 'No outlines found — adjust the threshold or colour count.')); return }
  const free = [5, 6, 7, 8, 9, 4, 3, 2];
  const out = TR.loops.filter(g => g.loops.length).map((g, i) => ({ paths: g.loops.map(l => l.map(([x, y]) => [x * k, (TR.h - y) * k])), closed: true, layer: TR.mode === 'color' && TR.multiLayer ? free[i % free.length] : +TR.layer }));
  if (TR.mode === 'color' && TR.multiLayer) out.forEach((o, i) => { const L = S.layers[o.layer]; if (!L.name) L.name = T('Цвет ', 'Colour ') + (i + 1) });
  const params = Object.assign({}, TR); delete params.img; delete params.loops; delete params._t; delete params.w; delete params.h;
  const prev = TR.replace; closeModal();
  if (prev) { const old = S.shapes.filter(s => s.g === prev); const b = bboxOf(old.flatMap(s => s.paths)); pushUndo(T('Перетрассировка', 'Re-trace')); S.shapes = S.shapes.filter(s => s.g !== prev); const ob = bboxOf(out.flatMap(o => o.paths)); const ids = new Set(); for (const o of out) { const s = addShape(S, o.layer, 'trace', mapPaths(o.paths, (x, y) => [x - ob[0] + b[0], y - ob[1] + b[1]]), true, { g: prev }); ids.add(s.id) } S.groups[prev] = Object.assign(S.groups[prev] || {}, { nm: T('Трассировка', 'Trace'), src: { asset: params.asset, params } }); sel = ids; changed(); toast(T('Контуры пересчитаны.', 'Outlines updated.')); return }
  placeImported(out, 'trace', null, { nm: T('Трассировка', 'Trace'), src: { asset: params.asset, params } });
}
function retraceGroup(g) {
  const gr = S.groups[g]; if (!gr || !gr.src) return; const url = assetURL(gr.src.asset); if (!url) { toast(T('Исходное изображение не найдено в проекте.', 'The original image is missing from the project.'), 'err'); return }
  const im = new Image(); im.onload = () => openTrace(im, Object.assign({}, gr.src.params, { replace: g })); im.src = url;
}
