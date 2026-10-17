'use strict';
/* ============================================================================
   SkyKerf_Studio · 3D relief from a photo for CNC routers (spec 10.2)
   A separate mode on purpose: raster laser engraving is NOT a 3D relief.
   Height map → roughing (flat end mill, z-levels with allowance) →
   finishing (ball nose, drop-cutter on the height grid).
   ============================================================================ */
const reliefCache = new Map();
/* Height grid in mm (0 = stock top, negative = deeper). */
function reliefGrid(rel, gw, gh) {
  const key = [rel.asset, rel.depth, rel.base, rel.invert, rel.gamma, rel.smooth, gw, gh].join('|'); if (reliefCache.has(key)) return reliefCache.get(key);
  const im = imgEl(rel.asset); if (!im || !im.complete || !im.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = gw; c.height = gh; const x = c.getContext('2d'); if (rel.smooth) x.filter = `blur(${rel.smooth * .5}px)`; x.drawImage(im, 0, 0, gw, gh); x.filter = 'none';
  const d = x.getImageData(0, 0, gw, gh).data, H = new Float32Array(gw * gh), gm = rel.gamma || 1;
  for (let i = 0; i < gw * gh; i++) { let l = (.299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]) / 255; if (rel.invert) l = 1 - l; l = Math.pow(l, gm); H[i] = -(rel.base || 0) - rel.depth * (1 - l) }
  if (reliefCache.size > 6) reliefCache.clear(); reliefCache.set(key, H); return H;
}
function defaultRelief(assetId, w, h) { return { asset: assetId, w, h, depth: 4, base: 0, invert: false, gamma: 1, smooth: 2, res: .3, roughStep: 1, roughOver: 45, allowance: .3, finishTool: 'ball3', finishOver: 12, dir: 'x' } }

/* ---------------- toolpaths ---------------- */
function planRelief(s, c, add, warn, m, phase) {
  const rel = s.relief, b = bboxOf(s.paths), W = b[2] - b[0], Hh = b[3] - b[1];
  let res = Math.max(.1, rel.res || .3); const cells = (W / res) * (Hh / res); if (cells > 2.5e6) { res = Math.sqrt(W * Hh / 2.5e6); warn.push(T(`Шаг сетки рельефа увеличен до ${fx(res, 2)} мм ради скорости.`, `Relief grid step increased to ${fx(res, 2)} mm for speed.`)) }
  const gw = Math.max(2, Math.round(W / res)), gh = Math.max(2, Math.round(Hh / res)), Hm = reliefGrid(rel, gw, gh);
  if (!Hm) { warn.push(T('Изображение рельефа ещё загружается — нажмите «Рассчитать» ещё раз.', 'The relief image is still loading — press Generate again.')); return }
  const gx = i => b[0] + (i + .5) * W / gw, gy = j => b[3] - (j + .5) * Hh / gh, safe = m.safeZ, minZ = Math.min(...Hm);
  if (phase === 'rough') {
    const tool = c.tool, r = tool.d / 2, rc = Math.ceil(r / res), allow = Math.max(0, rel.allowance || 0);
    // max filter (square, conservative) so the flat tool never cuts below the surface + allowance
    const tmp = new Float32Array(gw * gh), M = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { let v = -1e9; for (let k = Math.max(0, i - rc); k <= Math.min(gw - 1, i + rc); k++) v = Math.max(v, Hm[j * gw + k]); tmp[j * gw + i] = v }
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { let v = -1e9; for (let k = Math.max(0, j - rc); k <= Math.min(gh - 1, j + rc); k++) v = Math.max(v, tmp[k * gw + i]); M[j * gw + i] = v }
    const step = Math.max(.1, rel.roughStep || c.step), rowStep = Math.max(1, Math.round(tool.d * clamp(rel.roughOver || 45, 10, 90) / 100 / res));
    let z = 0, dir = 1; add({ g: 0, z: safe });
    while (z > minZ + allow + 1e-6) {
      z = Math.max(z - step, minZ + allow);
      for (let j = 0; j < gh; j += rowStep) {
        const segs = []; let st = -1;
        for (let i = 0; i < gw; i++) { const ok = M[j * gw + i] + allow <= z + 1e-6; if (ok && st < 0) st = i; if ((!ok || i === gw - 1) && st >= 0) { segs.push([st, ok ? i : i - 1]); st = -1 } }
        const ordered = dir > 0 ? segs : segs.reverse().map(([a, e]) => [e, a]);
        for (const [a, e] of ordered) { add({ g: 0, z: .5 }); add({ g: 0, x: gx(a), y: gy(j) }); add({ g: 1, z, f: c.plunge }); add({ g: 1, x: gx(e), y: gy(j), z, f: c.feed }) }
        dir = -dir;
      }
      add({ g: 0, z: .5 });
    }
    add({ g: 0, z: safe });
  } else {
    const tool = c.tool, rb = tool.d / 2, rc = Math.ceil(rb / res), isBall = tool.type === 'ball', fp = [];
    for (let dj = -rc; dj <= rc; dj++) for (let di = -rc; di <= rc; di++) { const d = Math.hypot(di * res, dj * res); if (d <= rb) fp.push([di, dj, isBall ? rb - Math.sqrt(rb * rb - d * d) : 0]) }
    const tip = (i, j) => { let z = -1e9; for (const [di, dj, off] of fp) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue; const v = Hm[jj * gw + ii] - off; if (v > z) z = v } return Math.min(0, z) };
    const over = Math.max(1, Math.round(tool.d * clamp(rel.finishOver || 12, 3, 50) / 100 / res)), feed = Math.round(c.feed * .8);
    if (!isBall) warn.push(T('Для чистового прохода рельефа лучше сферическая фреза.', 'A ball-nose tool is recommended for relief finishing.'));
    add({ g: 0, z: safe }); let dir = 1;
    const runs = rel.dir === 'y' ? [['y']] : rel.dir === 'xy' ? [['x'], ['y']] : [['x']];
    for (const [ax] of runs) {
      const nRows = ax === 'x' ? gh : gw, nCols = ax === 'x' ? gw : gh;
      for (let r2 = 0; r2 < nRows; r2 += over) {
        const pts = []; for (let k = 0; k < nCols; k++) { const i = ax === 'x' ? k : r2, j = ax === 'x' ? r2 : k; pts.push([ax === 'x' ? gx(i) : gy(j), tip(i, j)]) }
        const simp = rdp(pts, .01), seq = dir > 0 ? simp : simp.slice().reverse(), other = ax === 'x' ? gy(r2) : gx(r2);
        const P0 = seq[0]; add({ g: 0, z: .5 }); add(ax === 'x' ? { g: 0, x: P0[0], y: other } : { g: 0, x: other, y: P0[0] }); add({ g: 1, z: P0[1], f: c.plunge });
        for (const [u, zz] of seq.slice(1)) add(ax === 'x' ? { g: 1, x: u, y: other, z: zz, f: feed } : { g: 1, x: other, y: u, z: zz, f: feed });
        dir = -dir;
      }
      add({ g: 0, z: .5 });
    }
    add({ g: 0, z: safe });
  }
}

/* ---------------- canvas preview ---------------- */
function drawReliefShape(c, v, s, alpha) {
  const b = bboxOf(s.paths), [x0, y0] = w2s(b[0], b[3], v), [x1, y1] = w2s(b[2], b[1], v), gw = 160, gh = Math.max(2, Math.round(160 * (b[3] - b[1]) / (b[2] - b[0]))), Hm = reliefGrid(s.relief, gw, gh);
  if (Hm) {
    const key = 'rp' + s.id + JSON.stringify(s.relief); let cc = prevCache.get(key);
    if (!cc) { cc = document.createElement('canvas'); cc.width = gw; cc.height = gh; const x = cc.getContext('2d'), id = x.createImageData(gw, gh), mn = -(s.relief.base || 0) - s.relief.depth; for (let i = 0; i < Hm.length; i++) { const t = 1 - (Hm[i] - mn) / (s.relief.depth || 1), [r, g, bb] = hslRgb((205 - t * 170) / 360, .6, .45 + (1 - t) * .25); id.data[i * 4] = r; id.data[i * 4 + 1] = g; id.data[i * 4 + 2] = bb; id.data[i * 4 + 3] = 210 } x.putImageData(id, 0, 0); prevCache.set(key, cc) }
    c.globalAlpha = alpha; c.drawImage(cc, x0, y0, x1 - x0, y1 - y0); c.globalAlpha = 1;
  }
  c.strokeStyle = S.layers[s.layer].color; c.lineWidth = sel.has(s.id) && tab === 'cad' ? 2 : 1; c.strokeRect(x0 + .5, y0 + .5, x1 - x0, y1 - y0);
}

/* ---------------- dialog ---------------- */
let RL = null;
function openRelief(img) {
  if (isLaser()) { toast(T('3D-рельеф — режим для фрезерного станка. Для лазера используйте растр в оттенках серого.', '3D relief is a router mode. For lasers use greyscale raster.')); return }
  const a = imageToAsset(img, 1200), sh = sheetAt(curPlate), w = Math.min(120, sh.w - 2 * sh.margin - 10), h = w * a.h / a.w;
  RL = { rel: defaultRelief(a.id, fx(w, 1), fx(h, 1)), viewer: null };
  openModal(`${ic('relief', 18)} ${T('3D-рельеф из изображения', '3D relief from an image')}`, `<div class="ws-view"><canvas id="rlCv"></canvas><div class="badge" id="rlInfo">…</div></div><div class="ws-side" id="rlSide"></div>`,
    `<p class="note">${T('Светлое — выше, тёмное — глубже (можно инвертировать). Черновая — концевой фрезой слоя, чистовая — сферической.', 'Light is high, dark is deep (can be inverted). Roughing uses the layer’s flat tool, finishing a ball nose.')}</p><button class="btn" data-act="closeModal">${T('Отмена', 'Cancel')}</button><button class="primary" id="rlOk">${ic('plus', 15)} ${T('Добавить на лист', 'Add to sheet')}</button>`, 'xl');
  onModalClose = () => { if (RL && RL.viewer) RL.viewer.dispose(); RL = null };
  RL.viewer = createViewer($('#rlCv')); renderReliefSide(); reliefPreview();
  $('#rlOk').onclick = () => {
    const rel = deepCopy(RL.rel); closeModal();
    let li = S.layers.findIndex(l => l.cnc.op === 'relief'); if (li < 0) { li = 6; const L = S.layers[li]; L.cnc.op = 'relief'; L.cnc.toolId = 'em3'; L.name = T('Рельеф', 'Relief'); L.auto = false; L.cnc.feed = 1200; L.cnc.plunge = 300; L.cnc.step = rel.roughStep; L.cnc.depth = rel.depth + rel.base }
    placeParts([{ name: T('Рельеф', 'Relief'), noRotate: true, noMirror: true, items: [{ layer: li, kind: 'relief', paths: [rectPts(0, 0, rel.w, rel.h)], closed: true, extra: { relief: rel } }] }], { title: T('3D-рельеф', '3D relief') });
  };
}
function renderReliefSide() {
  const r = RL.rel, tools = allTools().filter(t => t.type === 'ball' || t.type === 'flat');
  $('#rlSide').innerHTML = `<div class="sec"><h3>${T('Размер и глубина', 'Size & depth')}</h3><div class="grid2">${numF(T('Ширина', 'Width'), 'data-rl="w" min="5"', r.w, MM(), 1)}${numF(T('Высота', 'Height'), 'data-rl="h" min="5"', r.h, MM(), 1)}
   ${numF(T('Глубина рельефа', 'Relief depth'), 'data-rl="depth" min="0.2"', r.depth, MM(), .5)}${numF(T('Опустить весь рельеф на', 'Lower the whole relief by'), 'data-rl="base" min="0"', r.base, MM(), .5)}</div>
   ${chkF(T('Инвертировать (тёмное — выше)', 'Invert (dark is high)'), 'data-rl="invert"', r.invert)}
   <label class="fld"><span>${T('Гамма', 'Gamma')}: <b>${r.gamma}</b></span><input type="range" data-rl="gamma" min="0.4" max="2.5" step="0.05" value="${r.gamma}"></label>
   <label class="fld"><span>${T('Сглаживание', 'Smoothing')}: <b>${r.smooth}</b></span><input type="range" data-rl="smooth" min="0" max="10" step="1" value="${r.smooth}"></label></div>
   <div class="sec"><h3>${T('Траектории', 'Toolpaths')}</h3><div class="grid2">${numF(T('Шаг сетки', 'Grid step'), 'data-rl="res" min="0.1"', r.res, MM(), .05)}${numF(T('Черновая: шаг по Z', 'Roughing step down'), 'data-rl="roughStep" min="0.1"', r.roughStep, MM(), .1)}
   ${numF(T('Черновая: перекрытие', 'Roughing stepover'), 'data-rl="roughOver" min="10" max="90"', r.roughOver, '%', 5)}${numF(T('Припуск на чистовую', 'Finishing allowance'), 'data-rl="allowance" min="0"', r.allowance, MM(), .05)}
   ${selF(T('Чистовая фреза', 'Finishing tool'), 'data-rl="finishTool"', tools.map(t => [t.id, toolName(t)]), r.finishTool)}${numF(T('Чистовая: перекрытие', 'Finishing stepover'), 'data-rl="finishOver" min="3" max="50"', r.finishOver, '%', 1)}</div>
   ${selF(T('Направление чистовой', 'Finishing direction'), 'data-rl="dir"', [['x', T('вдоль X', 'along X')], ['y', T('вдоль Y', 'along Y')], ['xy', T('X, затем Y', 'X then Y')]], r.dir)}
   <p class="note">${T('Черновая фреза и подачи берутся из слоя «Рельеф» во вкладке CAM.', 'The roughing tool and feeds come from the Relief layer in CAM.')}</p></div>`;
}
function reliefPreview() {
  if (!RL) return; clearTimeout(RL._t);
  RL._t = setTimeout(() => {
    if (!RL) return; const r = RL.rel, gw = 180, gh = Math.max(2, Math.round(180 * r.h / r.w)), Hm = reliefGrid(r, gw, gh);
    if (!Hm) { setTimeout(reliefPreview, 150); return }
    $('#rlInfo').textContent = T(`${fx(r.w, 0)}×${fx(r.h, 0)} мм · глубина до ${fx(r.depth + r.base, 1)} мм`, `${fx(r.w, 0)}×${fx(r.h, 0)} mm · depth up to ${fx(r.depth + r.base, 1)} mm`);
    if (!RL.viewer) return;
    const pos = new Float32Array(gw * gh * 3), idx = []; for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const k = (j * gw + i) * 3; pos[k] = i * r.w / (gw - 1); pos[k + 1] = (gh - 1 - j) * r.h / (gh - 1); pos[k + 2] = Hm[j * gw + i] * 2 }
    for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) { const a = j * gw + i, b2 = a + 1, c = a + gw, d = c + 1; idx.push(a, c, b2, b2, c, d) }
    RL.viewer.setMesh({ pos, idx: new Uint32Array(idx) }); RL.viewer.show(true, false, false); if (!RL._fit) { RL.viewer.fit([0, 0, -r.depth * 2, r.w, r.h, 0]); RL._fit = true }
  }, 120);
}
