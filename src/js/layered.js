'use strict';
/* ============================================================================
   SkyKerf_Studio · layered picture (multi-layer depth art), version 2
   Any number of layers. The base can be a rectangle with a frame, an oval, a
   circle, or the contour of the picture itself (the outline of layer 2 becomes
   the back plate). Background removal, brightness/contrast/gamma, levels by
   histogram/equal/manual, smoothing, minimum detail, alignment pins hidden
   under the top layer, spacers, hangers, a desk stand and engraved gluing
   guides. Preview: depth map with zoom/pan and a 3D stack with a free camera.
   ============================================================================ */
GENS.layered = {
  icon: 'layers', name: () => T('Многослойная картина', 'Layered picture'), desc: () => T('Картинка → любое число слоёв, основа по контуру, рамки, подставка', 'Picture → any number of layers, contour base, frames, stand'),
  fields: [
    { t: 'head', l: () => T('Картинка', 'Picture') },
    { k: 'imgAsset', t: 'img', l: () => T('Файл', 'File') },
    { k: 'invert', t: 'chk', l: () => T('Светлое ближе к зрителю', 'Light areas closer to the viewer'), def: () => false },
    { k: 'bg', t: 'sel', l: () => T('Фон', 'Background'), def: () => 'keep', opts: () => [['keep', T('оставить (вся картинка)', 'keep (whole picture)')], ['light', T('убрать светлый фон', 'remove a light background')], ['dark', T('убрать тёмный фон', 'remove a dark background')]] },
    { k: 'bgThr', t: 'num', l: () => T('Порог фона', 'Background threshold'), def: () => 235, min: 1, max: 254, step: 1, show: o => o.bg !== 'keep' },
    { t: 'head', l: () => T('Слои и размер', 'Layers and size') },
    { k: 'N', t: 'num', l: () => T('Слоёв', 'Layers'), def: () => 5, min: 1, max: 200, step: 1, help: 'layers' },
    { k: 'W', t: 'num', l: () => T('Ширина картины', 'Picture width'), def: () => Math.min(180, Math.round(sheetAt(curPlate).w * .8)), min: 20, u: MM, step: 1 },
    { k: 'base', t: 'sel', l: () => T('Основа (слой 1)', 'Base (layer 1)'), def: () => 'rect', opts: () => [['rect', T('прямоугольник с рамкой', 'rectangle with a frame')], ['round', T('скруглённый прямоугольник', 'rounded rectangle')], ['oval', T('овал', 'oval')], ['circle', T('круг', 'circle')], ['contour', T('по контуру 2-го слоя', 'contour of layer 2')], ['contourAll', T('по контуру всей картинки', 'contour of the whole picture')]] },
    { k: 'margin', t: 'num', l: () => T('Отступ основы от контура', 'Base margin around the contour'), def: () => 4, min: 0, max: 40, u: MM, step: .5, show: o => /^contour/.test(o.base) },
    { k: 'frame', t: 'num', l: () => T('Рамка', 'Frame'), def: () => 10, min: 0, u: MM, step: 1, show: o => !/^contour/.test(o.base) },
    { k: 'frameAll', t: 'chk', l: () => T('Рамка на каждом слое', 'Frame on every layer'), def: () => true, show: o => !/^contour/.test(o.base) && o.frame > 0 },
    { k: 'R', t: 'num', l: () => T('Скругление углов', 'Corner radius'), def: () => 8, min: 0, u: MM, step: 1, show: o => o.base === 'round' },
    { t: 'head', l: () => T('Сборка', 'Assembly') },
    { k: 'pins', t: 'sel', l: () => T('Центровочные штифты', 'Alignment pins'), def: () => 'hidden', opts: () => [['none', T('нет', 'none')], ['hidden', T('скрытые (под верхним слоем)', 'hidden (under the top layer)')], ['corners', T('по углам рамки', 'in the frame corners')]] },
    { k: 'hd', t: 'num', l: () => T('Диаметр штифтов', 'Pin diameter'), def: () => 3, min: 1, u: MM, step: .5, show: o => o.pins !== 'none' },
    { k: 'spacers', t: 'num', l: () => T('Проставки между слоями (шт.)', 'Spacers between layers (each)'), def: () => 0, min: 0, max: 3, step: 1, help: 'spacers' },
    { k: 'guides', t: 'chk', l: () => T('Метка «куда клеить» (скрыта под следующим слоем)', 'Gluing guide (hidden under the next layer)'), def: () => false },
    { k: 'nums', t: 'chk', l: () => T('Номер слоя (под следующим слоем)', 'Layer number (under the next layer)'), def: () => true },
    { k: 'hang', t: 'sel', l: () => T('Крепление', 'Mounting'), def: () => 'none', opts: () => [['none', T('нет', 'none')], ['keyhole', T('петля-скважина в основе', 'keyhole in the base')], ['holes', T('два отверстия для шнура', 'two holes for a cord')], ['stand', T('подставка на стол', 'desk stand')]] },
    { t: 'head', l: () => T('Тонкая настройка картинки', 'Picture fine-tuning') },
    { k: 'bright', t: 'num', l: () => T('Яркость', 'Brightness'), def: () => 0, min: -100, max: 100, step: 5 },
    { k: 'contrast', t: 'num', l: () => T('Контраст', 'Contrast'), def: () => 0, min: -100, max: 100, step: 5 },
    { k: 'gamma', t: 'num', l: () => T('Гамма', 'Gamma'), def: () => 1, min: .2, max: 4, step: .1, pro: true },
    { k: 'dist', t: 'sel', l: () => T('Деление яркости', 'Level split'), def: () => 'hist', opts: () => [['hist', T('по гистограмме (поровну площади)', 'by histogram (equal area)')], ['equal', T('равными шагами', 'equal steps')], ['manual', T('свои пороги', 'custom thresholds')]] },
    { k: 'levels', t: 'area', l: () => T('Пороги 0–255 через запятую', 'Thresholds 0–255, comma-separated'), def: () => '60, 110, 160, 210', show: o => o.dist === 'manual' },
    { k: 'smooth', t: 'num', l: () => T('Сглаживание', 'Smoothing'), def: () => 2, min: 0, max: 20, step: 1, u: () => 'px' },
    { k: 'minA', t: 'num', l: () => T('Мин. деталь', 'Min detail'), def: () => 8, min: 0, u: () => MM() + '²', step: 1 },
    { k: 'res', t: 'sel', l: () => T('Точность контуров', 'Outline precision'), def: () => 'normal', opts: () => [['draft', T('черновая (быстро)', 'draft (fast)')], ['normal', T('обычная', 'normal')], ['fine', T('высокая', 'fine')]], pro: true },
  ],
  migrate(o) { if (o.near === 'light') o.invert = true; if (o.holes === false) o.pins = 'none'; else if (o.holes === true && !o.pins) o.pins = 'corners'; if (o.base == null) o.base = 'rect' },
  async make(o) {
    if (!hasClip()) throw new Error(T('Нужна библиотека Clipper — она не загрузилась.', 'The Clipper library did not load.'));
    if (!o.imgAsset) o.imgAsset = addAsset(sampleLandscape());
    const img = await imgFromAsset(o.imgAsset), iw = img.naturalWidth, ih = img.naturalHeight, t = curThick();
    let N = clamp(o.N | 0, 1, 200); const Nask = N, Wmm = o.W, Hmm = Wmm * ih / iw, perMm = { draft: 2.5, normal: 4, fine: 7 }[o.res] || 4;
    const pw = Math.round(clamp(Wmm * perMm, 160, o.res === 'fine' ? 1400 : 900)), ph = Math.max(2, Math.round(pw * ih / iw)), k = Wmm / pw;
    const warn = [];
    const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, pw, ph);
    const d = x.getImageData(0, 0, pw, ph).data, n = pw * ph; let Lm = new Float32Array(n);
    // transparent pixels are the background (cut away); half-transparent edges are blended over the background colour
    const under = o.bg === 'dark' ? 0 : 255; for (let i = 0; i < n; i++) { const al = d[i * 4 + 3] / 255; if (al < 1) for (let ch = 0; ch < 3; ch++) d[i * 4 + ch] = d[i * 4 + ch] * al + under * (1 - al) }
    const ct = (100 + (+o.contrast || 0)) / 100, br = +o.bright || 0, ga = +o.gamma || 1;
    const bgMask = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const raw = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2], a = d[i * 4 + 3];
      if ((o.bg === 'light' && raw >= o.bgThr) || (o.bg === 'dark' && raw <= 255 - o.bgThr) || a < 20) bgMask[i] = 1;
      let v = (raw - 128) * ct + 128 + br; v = clamp(v, 0, 255); v = 255 * Math.pow(v / 255, 1 / ga); Lm[i] = v;
    }
    const r = o.smooth | 0; if (r > 0) Lm = boxBlur(Lm, pw, ph, r);
    // thresholds (only foreground pixels count for the histogram)
    let th = [];
    if (o.dist === 'equal') for (let q = 1; q < N; q++) th.push(255 * q / N);
    else if (o.dist === 'manual') { th = String(o.levels || '').split(/[,;\s]+/).map(Number).filter(v => isFinite(v) && v > 0 && v < 255).sort((a, b) => a - b); while (th.length < N - 1) th.push(255 * (th.length + 1) / N); th = th.slice(0, N - 1) }
    else { const fg = []; for (let i = 0; i < n; i += 1) if (!bgMask[i]) fg.push(Lm[i]); const srt = Float32Array.from(fg.length ? fg : Lm).sort();
      // a threshold sits halfway between two different brightness values, so a flat area (all 255) is never split by noise
      for (let q = 1; q < N; q++) { let k = Math.floor(srt.length * q / N); const v = srt[k]; while (k > 0 && srt[k - 1] === v) k--; if (k > 0) th.push((srt[k - 1] + v) / 2) }
      th = [...new Set(th)].sort((a, b) => a - b) }
    // depth per pixel: 0 = back … N-1 = closest; -1 = background (cut away)
    const Dm = new Int16Array(n);
    for (let i = 0; i < n; i++) { if (bgMask[i]) { Dm[i] = -1; continue } let lv = 0; for (const tq of th) if (Lm[i] >= tq) lv++; Dm[i] = o.invert ? lv : N - 1 - lv }
    // drop depth levels that no pixel uses (flat pictures, logos): no empty layers, numbering stays "k of N"
    { const used = new Uint8Array(N); for (let i = 0; i < n; i++) if (Dm[i] >= 0) used[Dm[i]] = 1; const remap = new Int16Array(N); let k = 0; for (let j = 0; j < N; j++) remap[j] = used[j] ? k++ : -1;
      if (k > 0 && k < N) { for (let i = 0; i < n; i++) if (Dm[i] >= 0) Dm[i] = remap[Dm[i]]; N = k; warn.push(T(`В картинке только ${k} ${k === 1 ? 'уровень' : k < 5 ? 'уровня' : 'уровней'} яркости — слоёв будет ${k} вместо ${Nask}. Чтобы получить больше, увеличьте контраст или выберите «равными шагами».`, `The picture has only ${k} brightness level${k === 1 ? '' : 's'} — ${k} layers instead of ${Nask}. Raise the contrast or use “equal steps” for more.`)) } }
    if (N > 40) warn.push(T(`${N} слоёв — это высота ${fx(N * t, 0)} мм. Проверьте, хватит ли материала.`, `${N} layers make a ${fx(N * t, 0)} mm stack. Check you have enough material.`));
    // base shape (in mm, y up)
    const contourBase = /^contour/.test(o.base), mmPath = l => l.map(([X, Y]) => [X * k, (ph - Y) * k]);
    const tracePx = (m, minArea) => traceMask(m, pw, ph).map(l => rdpClosed(l, o.res === 'fine' ? .5 : .7)).filter(l => l.length > 2 && Math.abs(area(l)) > minArea);
    let base, inner = null;
    if (contourBase) {
      const m = new Uint8Array(n); const lvl = o.base === 'contour' ? Math.min(1, N - 1) : 0;
      for (let i = 0; i < n; i++) m[i] = Dm[i] >= lvl ? 1 : 0;
      let outl = cleanPaths(tracePx(m, 20).map(mmPath)); const outer = components(outl).map(c => c[0]); // holes filled
      base = offsetPaths(outer.length ? outer : [rectPts(0, 0, Wmm, Hmm)], +o.margin || 0, 'round');
      if (!base.length) throw new Error(T('Контур картинки не найден — проверьте порог фона.', 'No picture contour found — check the background threshold.'));
    } else {
      base = o.base === 'oval' ? [ellipsePts(Wmm / 2, Hmm / 2, Wmm / 2, Hmm / 2, 160)] : o.base === 'circle' ? [ellipsePts(Wmm / 2, Hmm / 2, Math.min(Wmm, Hmm) / 2, Math.min(Wmm, Hmm) / 2, 160)] : [rectPts(0, 0, Wmm, Hmm, o.base === 'round' ? Math.min(o.R, Math.min(Wmm, Hmm) / 2 - .1) : 0)];
      if (o.frame > 0) inner = offsetPaths(base, -o.frame);
    }
    const minPx = (o.minA || 0) / (k * k), parts = [], layerRegions = [], hr = o.hd / 2;
    for (let j = 0; j < N; j++) {
      let region;
      if (j === 0) region = base;
      else {
        const m = new Uint8Array(n); for (let i = 0; i < n; i++) m[i] = Dm[i] >= j ? 1 : 0;
        region = cleanPaths(tracePx(m, Math.max(4, minPx)).map(mmPath));
        if (inner) { region = boolOp(region, inner, 'inter'); if (o.frameAll) region = boolOp(region, boolOp(base, inner, 'diff'), 'union') }
        region = boolOp(region, base, 'inter');
      }
      layerRegions.push(region);
    }
    // alignment pins
    let pins = [];
    if (o.pins === 'corners' && inner && o.frame >= o.hd + 2) { const f = o.frame / 2, b = bboxOf(base); pins = [[b[0] + f, b[1] + f], [b[2] - f, b[1] + f], [b[2] - f, b[3] - f], [b[0] + f, b[3] - f]].filter(p => inPolys(p, base) && !inPolys(p, inner)) }
    if (o.pins === 'hidden' && N > 1) pins = pinSpots(Dm, pw, ph, N - 1, (hr + 1.5) / k, 3).map(([px, py]) => [px * k, (ph - py) * k]);
    if (o.pins === 'hidden' && N > 1 && !pins.length) warn.push(T('Верхний слой слишком узкий для скрытых штифтов — используйте штифты по углам или уменьшите диаметр.', 'The top layer is too narrow for hidden pins — use corner pins or a smaller diameter.'));
    for (let j = 0; j < N; j++) {
      let region = layerRegions[j]; if (!region.length) { warn.push(T(`Слой ${j + 1} пустой.`, `Layer ${j + 1} is empty.`)); continue }
      const pinHere = o.pins === 'corners' || (o.pins === 'hidden' && j < N - 1);
      if (pinHere && pins.length) region = boolOp(region, pins.map(([px, py]) => ellipsePts(px, py, hr, hr, 28)), 'diff');
      if (j === 0 && o.hang === 'keyhole') { const b = bboxOf(base), cx = (b[0] + b[2]) / 2, cy = b[3] - Math.max(12, (b[3] - b[1]) * .12); if (inPolys([cx, cy], offsetPaths(base, -6))) region = boolOp(region, union([[ellipsePts(cx, cy - 4, 4.5, 4.5, 28)], [rectPts(cx - 2, cy - 4, 4, 8)], [ellipsePts(cx, cy + 4, 2, 2, 16)]]), 'diff') }
      if (j === 0 && o.hang === 'holes') { const b = bboxOf(base), y = b[3] - Math.max(8, (b[3] - b[1]) * .08); const hs = [[b[0] + (b[2] - b[0]) * .25, y], [b[0] + (b[2] - b[0]) * .75, y]].filter(p => inPolys(p, offsetPaths(base, -4))); if (hs.length) region = boolOp(region, hs.map(([hx, hy]) => ellipsePts(hx, hy, 2, 2, 20)), 'diff') }
      if (j === 0 && o.hang === 'stand') { const b = bboxOf(base); region = boolOp(region, [rectPts((b[0] + b[2]) / 2 - 10, b[1] + (b[3] - b[1]) * .3, 20, t + .1)], 'diff') }
      region = dropSmall(region, Math.max(2, +o.minA || 0)); if (!region.length) { warn.push(T(`Слой ${j + 1} пустой.`, `Layer ${j + 1} is empty.`)); continue }
      const items = [{ layer: CUT, kind: 'part', paths: region, closed: true }];
      const next = j + 1 < N ? layerRegions[j + 1] : null;
      if (o.guides && next && next.length) { const g = offsetPaths(next, -1.2).map(q => q.concat([q[0]])); if (g.length) items.push({ layer: markLayer(), kind: 'part', paths: clipOpen(g, offsetPaths(region, -.4), true), closed: false }) } // 1.2 mm inside the next layer's outline: hidden after gluing
      if (o.nums && next && next.length) { const b = bboxOf(region), sz = clamp(Math.min(b[2] - b[0], b[3] - b[1]) * .08, 3, 7), tp = await textAt(String(j + 1), 'mono', sz, 0, 0); if (tp.length) { const spot = labelSpot(boolOp(region, offsetPaths(next, -1.5), 'inter'), sz * 1.6); if (spot) items.push({ layer: markLayer(), kind: 'text', paths: mapPaths(tp, (px, py) => [px + spot[0], py + spot[1]]), closed: true, extra: { text: String(j + 1), font: 'mono', size: sz, rot: 0 } }) } } // under the next layer: never visible on the finished picture
      parts.push({ name: T(`Слой ${j + 1} из ${N}`, `Layer ${j + 1} of ${N}`), items, req: curReq(t), z: j });
      for (let s = 0; s < (o.spacers | 0) && j > 0; s++) {
        let sp = offsetPaths(layerRegions[j], -Math.max(1.5, t * .8)); if (sp.length && pins.length && o.pins !== 'none') sp = boolOp(sp, pins.map(([px, py]) => ellipsePts(px, py, hr, hr, 28)), 'diff'); sp = dropSmall(sp, 4); if (sp.length) parts.push({ name: T(`Проставка под слой ${j + 1}`, `Spacer under layer ${j + 1}`), items: [{ layer: CUT, kind: 'part', paths: sp, closed: true }], req: curReq(t), z: j - .5 });
      }
    }
    if (o.hang === 'stand') { const b = bboxOf(base), sh = (b[3] - b[1]) * .45, sw = clamp(sh * .45, 24, 60); parts.push({ name: T('Подставка', 'Stand'), items: [{ layer: CUT, kind: 'part', paths: [[[0, 0], [sw, 0], [sw, 6], [10 + t, sh - 4], [10 + t, sh + 6], [10, sh + 6], [10, sh - 4], [0, 6]]], closed: true }], req: curReq(t) }) }
    // 3D stack
    let z = 0; const asm = [];
    for (const p of parts) { if (p.z == null) continue; const j = Math.ceil(p.z), tone = N > 1 ? j / (N - 1) : 1; asm.push({ paths: p.items[0].paths, origin: [0, 0, z], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], t, color: p.z % 1 ? '#8a7a64' : hslHex(30 + tone * 180, 45, 70 - tone * 35) }); z += t }
    const stackH = z;
    return {
      parts, depth: { D: Dm, pw, ph, N, Wmm, Hmm, base, inner: inner && o.frame > 0 ? inner : null, frameAll: !!o.frameAll, pins, hr }, info: T(`${N} слоёв · ${fx(Wmm, 0)}×${fx(Hmm, 0)} мм · высота ${fx(stackH, 1)} мм`, `${N} layers · ${fx(Wmm, 0)}×${fx(Hmm, 0)} mm · ${fx(stackH, 1)} mm high`),
      steps: [T('Слой 1 — основа (задний), дальше по номерам к зрителю. Номер каждого слоя стоит там, где его закроет следующий слой.', 'Layer 1 is the base (back); continue in order towards the viewer. Each number is engraved where the next layer covers it.'),
        o.guides ? T('Гравированная линия на каждом слое показывает, куда клеить следующий.', 'The engraved line on each layer shows where the next one goes.') : '',
        pins.length ? T(`Совместите слои штифтами ⌀${o.hd} мм (${pins.length} шт.) — например, зубочистками или шпажками — и склейте.`, `Align the layers with ⌀${o.hd} mm pins (${pins.length}) — toothpicks or skewers work — and glue.`) : '',
        o.spacers ? T('Проставки кладутся под соответствующий слой и дают дополнительную глубину тени.', 'Spacers go under their layer and add depth to the shadows.') : '',
        o.hang === 'stand' ? T('Вставьте подставку в паз основы.', 'Insert the stand into the slot in the base.') : '',
        T('Совет: покрасьте слои в разные оттенки до склейки — картина выглядит объёмнее.', 'Tip: paint the layers in different shades before gluing — the picture looks deeper.')].filter(Boolean),
      bom: warn,
      asm,
    };
  },
  preview(c, W, H, res) {
    const { D, pw, ph, N, Wmm, Hmm, base, inner, frameAll, pins, hr } = res.depth;
    // fit the base shape (it can be larger than the picture: contour + margin), leaving room for the floating buttons
    const B = base && base.length ? unionBox(bboxOf(base), [0, 0, Wmm, Hmm]) : [0, 0, Wmm || pw, Hmm || ph], top = 64, bottom = 52, side = 56;
    const S = Math.min((W - 2 * side) / (B[2] - B[0]), (H - top - bottom) / (B[3] - B[1])), ox = (W - (B[2] - B[0]) * S) / 2 - B[0] * S, oy = top + (H - top - bottom - (B[3] - B[1]) * S) / 2 + B[3] * S;
    const X = x => ox + x * S, Y = y => oy - y * S, tone = j => { const t = N > 1 ? j / (N - 1) : 1; return hslRgb((30 + t * 180) / 360, .45, (70 - t * 35) / 100) }, rgb = a => `rgb(${a[0]},${a[1]},${a[2]})`;
    const path = ps => { c.beginPath(); for (const q of ps) { q.forEach(([x, y], i) => i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))); c.closePath() } };
    if (base && base.length) { path(base); c.fillStyle = rgb(tone(0)); c.fill('evenodd') }
    const cc = document.createElement('canvas'); cc.width = pw; cc.height = ph; const x = cc.getContext('2d'), id = x.createImageData(pw, ph);
    for (let i = 0; i < D.length; i++) { if (D[i] < 0) { id.data[i * 4 + 3] = 0; continue } const [r, g, b] = tone(D[i]); id.data[i * 4] = r; id.data[i * 4 + 1] = g; id.data[i * 4 + 2] = b; id.data[i * 4 + 3] = 255 }
    x.putImageData(id, 0, 0); c.save(); if (base && base.length) { path(inner || base); c.clip('evenodd') } c.imageSmoothingEnabled = false; c.drawImage(cc, X(0), Y(Hmm), Wmm * S, Hmm * S); c.restore();
    if (inner) { path(base.concat(inner)); c.fillStyle = rgb(tone(frameAll ? N - 1 : 0)); c.fill('evenodd') }
    c.lineWidth = 1.2; c.strokeStyle = css('--fg'); if (base && base.length) { path(base); c.stroke() } if (inner) { path(inner); c.globalAlpha = .5; c.stroke(); c.globalAlpha = 1 }
    for (const [px, py] of pins || []) { c.beginPath(); c.arc(X(px), Y(py), Math.max(2, hr * S), 0, Math.PI * 2); c.fillStyle = css('--bg'); c.fill(); c.stroke() }
    // legend on the right: layer colours with numbers (1 = base)
    const n = Math.min(N, 24), lh = Math.min(18, (H - top - bottom) / n); c.font = `600 10px ${css('--f-mono') || 'monospace'}`; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (let j = 0; j < n; j++) { const jj = N > n ? Math.round(j * (N - 1) / (n - 1)) : j, y = top + j * lh; c.fillStyle = rgb(tone(jj)); c.fillRect(W - 24, y, 14, lh - 3); c.fillStyle = css('--muted'); c.fillText(String(jj + 1), W - 30, y + (lh - 3) / 2) }
  }
};
function boxBlur(L, w, h, r) {
  if (typeof boxBlurK === 'function') return boxBlurK(L, w, h, r);
  let a = L, b = new Float32Array(L.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) { let s = 0, n = 0; for (let xx = -r; xx <= r; xx++) if (xx >= 0 && xx < w) { s += a[y * w + xx]; n++ } for (let xx = 0; xx < w; xx++) { b[y * w + xx] = s / n; const p = xx - r, q = xx + r + 1; if (p >= 0) { s -= a[y * w + p]; n-- } if (q < w) { s += a[y * w + q]; n++ } } }
    const c = new Float32Array(L.length);
    for (let xx = 0; xx < w; xx++) { let s = 0, n = 0; for (let yy = -r; yy <= r; yy++) if (yy >= 0 && yy < h) { s += b[yy * w + xx]; n++ } for (let yy = 0; yy < h; yy++) { c[yy * w + xx] = s / n; const p = yy - r, q = yy + r + 1; if (p >= 0) { s -= b[p * w + xx]; n-- } if (q < h) { s += b[q * w + xx]; n++ } } }
    a = c;
  }
  return a;
}
/* remove islands smaller than minArea mm² (after all boolean operations) */
function dropSmall(paths, minArea) {
  if (!paths.length || !(minArea > 0)) return paths; const out = [];
  for (const c of components(paths)) { let a = Math.abs(area(c[0])); for (const h of c.slice(1)) a -= Math.abs(area(h)); if (a >= minArea) for (const q of c) out.push(q) }
  return out;
}
/* spots for hidden pins: far from the edge of the top-layer region, spread apart (distance transform + farthest point) */
function pinSpots(D, w, h, level, minDist, count) {
  const INF = 1e9, dt = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) dt[i] = D[i] >= level ? INF : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!dt[i]) continue; let v = dt[i]; if (x > 0) v = Math.min(v, dt[i - 1] + 1); if (y > 0) v = Math.min(v, dt[i - w] + 1); if (x > 0 && y > 0) v = Math.min(v, dt[i - w - 1] + 1.414); if (x < w - 1 && y > 0) v = Math.min(v, dt[i - w + 1] + 1.414); if (x === 0 || y === 0) v = Math.min(v, 1); dt[i] = v }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!dt[i]) continue; let v = dt[i]; if (x < w - 1) v = Math.min(v, dt[i + 1] + 1); if (y < h - 1) v = Math.min(v, dt[i + w] + 1); if (x < w - 1 && y < h - 1) v = Math.min(v, dt[i + w + 1] + 1.414); if (x > 0 && y < h - 1) v = Math.min(v, dt[i + w - 1] + 1.414); if (x === w - 1 || y === h - 1) v = Math.min(v, 1); dt[i] = v }
  let cand = []; for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const v = dt[y * w + x]; if (v >= minDist) cand.push([x, y, v]) }
  if (!cand.length) return [];
  cand.sort((a, b) => b[2] - a[2]); const roomy = cand.filter(c => c[2] >= minDist * 1.6); if (roomy.length >= count * 4) cand = roomy; // keep pins away from the very edge when there is room
  const out = [cand[0]];
  while (out.length < count) { let best = null, bd = 0; for (const c of cand) { const d = Math.min(...out.map(o => Math.hypot(o[0] - c[0], o[1] - c[1]))); if (d > bd) { bd = d; best = c } } if (!best || bd < minDist * 3) break; out.push(best) }
  return out.map(([x, y]) => [x, y]);
}
/* a place for the layer number inside the region (the number is mirrored: it is read from the back) */
function labelSpot(region, size) {
  const inner = offsetPaths(region, -size * .8); if (!inner.length) return null;
  const b = bboxOf(inner); for (let fy = .15; fy < .9; fy += .1) for (let fx2 = .15; fx2 < .9; fx2 += .1) { const p = [b[0] + (b[2] - b[0]) * fx2, b[1] + (b[3] - b[1]) * fy]; if (inPolys(p, inner)) return p }
  return null;
}
