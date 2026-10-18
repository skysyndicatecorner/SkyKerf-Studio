'use strict';
/* ============================================================================
   SkyKerf_Studio · decorative generators: photo frames and signs
   Built from decor.js: outer shapes, window shapes, border patterns, corner
   ornaments, motifs, text in any installed font, mounting options.
   ============================================================================ */
const vecLayer = () => { const i = S.layers.findIndex(l => l.type === 'vector'); return i >= 0 ? i : markLayer() };
const DECO_MODES = () => [['fill', T('гравировка', 'engraved')], ['line', T('линия (быстро)', 'line (fast)')], ['cut', T('прорезь насквозь', 'cut through')]];
const RECT_WINS = new Set(['rect', 'round', 'chamfer', 'notched', 'cartouche']);
const FRAME_SHAPES = () => OUTLINES().filter(([k]) => !['ribbon', 'star', 'trefoil'].includes(k));
const WIN_FRAME_SHAPES = () => OUTLINES().filter(([k]) => ['rect', 'round', 'oval', 'circle', 'arch', 'gothic', 'onion', 'chamfer', 'notched', 'cartouche', 'heart', 'hexagon', 'house', 'shield', 'cloud', 'scallop'].includes(k));
const TOPPERS = () => [['none', T('нет', 'none')], ['heart', T('сердце', 'heart')], ['star', T('звезда', 'star')], ['flower', T('цветок', 'flower')], ['snow', T('снежинка', 'snowflake')], ['bow', T('бантик', 'bow')], ['crown', T('корона', 'crown')], ['ears', T('ушки (кошка)', 'cat ears')], ['roof', T('крыша', 'roof')]];
/* text block centred at (cx, cy) fitted into maxW × maxH; returns an item or null */
async function fitText(text, font, size, cx, cy, maxW, maxH, mode) {
  if (!String(text || '').trim()) return null;
  let tp = await makeTextPaths({ text, font, size, align: 'center' }); if (!tp.length) return null;
  let b = bboxOf(tp); const sc = Math.min(1, maxW / Math.max(.1, b[2] - b[0]), maxH / Math.max(.1, b[3] - b[1]));
  tp = mapPaths(tp, (x, y) => [x * sc, y * sc]); b = bboxOf(tp);
  tp = mapPaths(tp, (x, y) => [x - (b[0] + b[2]) / 2 + cx, y - (b[1] + b[3]) / 2 + cy]);
  return { layer: mode === 'cut' ? CUT : mode === 'line' ? vecLayer() : ENG, kind: 'text', paths: tp, closed: true, extra: { text, font, size: fx(size * sc, 2), rot: 0, align: 'center' } };
}
/* decoration (lines + closed shapes) → items, in one of the three modes; shapes that would cut a part apart are kept inside */
function decoItems(d, mode, keepInside) {
  const items = []; if (!d) return items;
  let shapes = d.shapes || [], lines = d.lines || [];
  if (keepInside) { shapes = shapes.length ? clipShapes(shapes, keepInside) : []; lines = lines.length ? clipOpen(lines, keepInside, true) : [] }
  if (lines.length) items.push({ layer: mode === 'fill' ? markLayer() : vecLayer(), kind: 'part', paths: lines, closed: false });
  if (shapes.length) items.push({ layer: mode === 'cut' ? CUT : mode === 'line' ? vecLayer() : ENG, kind: 'part', paths: shapes, closed: true });
  return items;
}
function topper(kind, cx, y, s) { const P = topperRaw(kind, cx, y, s); return P.length ? boolOp(P.map(ccw), [], 'union') : [] }
function topperRaw(kind, cx, y, s) {
  switch (kind) {
    case 'heart': case 'star': case 'flower': case 'snow': return union([motif(kind, cx, y + s * .38, s), [rectPts(cx - s * .2, y - s * .2, s * .4, s * .4)]]);
    case 'bow': return union([[ellipsePts(cx - s * .38, y + s * .3, s * .38, s * .24, 32)], [ellipsePts(cx + s * .38, y + s * .3, s * .38, s * .24, 32)], [circlePts(cx, y + s * .3, s * .16, 20)], [ccw([[cx - s * .1, y + s * .25], [cx - s * .35, y - s * .3], [cx - s * .15, y - s * .3], [cx, y + s * .1], [cx + s * .15, y - s * .3], [cx + s * .35, y - s * .3], [cx + s * .1, y + s * .25]])]]);
    case 'crown': { const w = s * 1.6, h = s * .8, x = cx - w / 2, pts = [[x, y - s * .2], [x + w, y - s * .2], [x + w, y + h * .5]]; for (let i = 4; i >= 0; i--) { pts.push([x + w * i / 4, y + (i % 2 ? h * .55 : h)]) } return union([[ccw(pts)], ...[0, 2, 4].map(i => [circlePts(x + w * i / 4, y + h + s * .08, s * .1, 14)])]) }
    case 'ears': return union([-1, 1].map(sx => [[[cx + sx * s * .3, y - s * .3], [cx + sx * s * 1.1, y - s * .3], [cx + sx * s * .85, y + s * .8]]]));
    case 'roof': { const w = s * 2.6; return [[[cx - w / 2 - s * .1, y - s * .3], [cx + w / 2 + s * .1, y - s * .3], [cx, y + s * .9]]] }
  }
  return [];
}
/* height of the outline's top edge near x (lowest of the top points there, so a topper always touches) */
function topAt(paths, x, dx) {
  let best = -Infinity;
  for (const p of paths) for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) { const y = a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); if (y > best) best = y } }
  if (best === -Infinity) return bboxOf(paths)[3];
  let lo = best; for (const xx of [x - dx, x + dx]) for (const p of paths) for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; if ((a[0] - xx) * (b[0] - xx) <= 0 && a[0] !== b[0]) { const y = a[1] + (b[1] - a[1]) * (xx - a[0]) / (b[0] - a[0]); if (y > best - dx * 2 && y < lo) lo = y } }
  return lo;
}
/* topper above the outline: it stands out above the top even when the top has a dip (heart), and a stem joins it */
function attachTopper(outer, kind, cx, s) {
  const yt = topAt(outer, cx, s * .3), top = bboxOf(outer)[3], y = Math.max(yt - s * .25, top - s * .15), tp = topper(kind, cx, y, s);
  if (!tp.length) return outer;
  return union([outer, tp, [rectPts(cx - s * .1, yt - 1, s * .2, y - yt + 1 + s * .1)]]);
}
/* scale an outer shape until every window fits inside it with at least `m` of material */
function shapeAround(kind, box, wins, m, r) {
  let [x0, y0, x1, y1] = box, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = x1 - x0, h = y1 - y0, out = outline(kind, x0, y0, w, h, r);
  const fits = q => { const inner = offsetPaths(q, -m * .999); return inner.length && areaOf(boolOp(wins, inner, 'diff')) < .5 };
  const shifts = ['heart', 'shield', 'house', 'arch', 'gothic', 'onion', 'cloud'].includes(kind) ? [0, -.05, -.1, -.15, -.2, -.25] : [0];
  for (let k = 0; k < 30; k++) {
    for (const f of shifts) { const q = outline(kind, cx - w / 2, cy - h / 2 + f * h, w, h, r); if (fits(q)) return q }
    w *= 1.05; h *= 1.05;
  }
  return out;
}

GENS.frame = {
  icon: 'frame', name: () => T('Рамка для фото', 'Photo frame'), desc: () => T('Формы, коллажи, узоры, надписи, подставка или петля', 'Shapes, collages, patterns, text, stand or hanger'),
  fields: [
    { t: 'head', l: () => T('Фото', 'Photos') },
    { k: 'pw', t: 'num', l: () => T('Ширина фото', 'Photo width'), def: () => 100, min: 10, u: MM, step: 1 }, { k: 'ph', t: 'num', l: () => T('Высота фото', 'Photo height'), def: () => 150, min: 10, u: MM, step: 1 },
    { k: 'cols', t: 'num', l: () => T('Фото в ряд', 'Photos per row'), def: () => 1, min: 1, max: 6, step: 1 }, { k: 'rows', t: 'num', l: () => T('Рядов', 'Rows'), def: () => 1, min: 1, max: 6, step: 1 },
    { k: 'gap', t: 'num', l: () => T('Промежуток между фото', 'Gap between photos'), def: () => 12, min: 3, u: MM, step: 1, show: o => o.cols > 1 || o.rows > 1 },
    { k: 'lip', t: 'num', l: () => T('Нахлёст на фото', 'Overlap on photo'), def: () => 4, min: 0, u: MM, step: .5 },
    { t: 'head', l: () => T('Форма', 'Shape') },
    { k: 'shape', t: 'sel', l: () => T('Форма рамки', 'Frame shape'), def: () => 'round', opts: FRAME_SHAPES },
    { k: 'win', t: 'sel', l: () => T('Форма окна', 'Window shape'), def: () => 'rect', opts: WIN_FRAME_SHAPES },
    { k: 'b', t: 'num', l: () => T('Ширина рамки', 'Border width'), def: () => 22, min: 5, u: MM, step: 1 },
    { k: 'r', t: 'num', l: () => T('Скругление / размер зубцов', 'Corner radius / edge detail'), def: () => 6, min: 0, u: MM, step: 1 },
    { k: 'top', t: 'sel', l: () => T('Украшение сверху', 'Topper'), def: () => 'none', opts: TOPPERS },
    { t: 'head', l: () => T('Узор', 'Decoration') },
    { k: 'border', t: 'sel', l: () => T('Узор по рамке', 'Border pattern'), def: () => 'beads', opts: BORDERS },
    { k: 'corner', t: 'sel', l: () => T('Уголки', 'Corners'), def: () => 'none', opts: CORNERS },
    { k: 'scatter', t: 'sel', l: () => T('Мотивы по полю', 'Scattered motifs'), def: () => 'none', opts: () => [['none', T('нет', 'none')]].concat(MOTIFS()) },
    { k: 'dm', t: 'sel', l: () => T('Узор выполнить', 'Decoration as'), def: () => 'fill', opts: DECO_MODES },
    { t: 'head', l: () => T('Надпись', 'Text') },
    { k: 'text', t: 'area', l: () => T('Надпись снизу', 'Text at the bottom'), def: () => '' },
    { k: 'text2', t: 'area', l: () => T('Надпись сверху', 'Text at the top'), def: () => '' },
    { k: 'font', t: 'font', l: () => T('Шрифт', 'Font'), def: () => 'serif' },
    { k: 'tm', t: 'sel', l: () => T('Текст', 'Text as'), def: () => 'fill', opts: () => DECO_MODES().map(([k, l]) => [k, k === 'cut' ? T('прорезь (трафарет)', 'cut-through (stencil)') : l]) },
    { t: 'head', l: () => T('Сборка', 'Assembly') },
    { k: 'ins', t: 'sel', l: () => T('Как вставлять фото', 'How the photo goes in'), def: () => 'pocket', opts: () => [['pocket', T('карман: рамка + прокладка + задник', 'pocket: front + spacer + back')], ['slide', T('сверху в щель (фото меняется без разборки)', 'slide in from the top')], ['front', T('только лицевая рамка', 'front frame only')]] },
    { k: 'mount', t: 'sel', l: () => T('Крепление', 'Mounting'), def: () => 'stand', opts: () => [['stand', T('подставка на стол', 'desk stand')], ['keyhole', T('петля-«замочная скважина»', 'keyhole hanger')], ['holes', T('два отверстия для шнурка', 'two holes for a cord')], ['magnets', T('гнёзда под магниты ⌀10', '⌀10 magnet pockets')], ['none', T('без крепления', 'none')]], show: o => o.ins !== 'front' },
    { k: 'land', t: 'chk', l: () => T('Подставка для горизонтального положения', 'Stand for landscape orientation'), def: () => false, show: o => o.ins !== 'front' && o.mount === 'stand' },
  ],
  migrate(o) { if (o.r != null && o.shape == null) o.shape = o.r > 0 ? 'round' : 'rect'; if (o.back === false) o.ins = 'front' },
  async make(o) {
    if (!hasClip()) throw new Error(T('Нужна библиотека Clipper — она не загрузилась.', 'The Clipper library did not load.'));
    const t = curThick(), C = Math.max(1, o.cols | 0), Rn = Math.max(1, o.rows | 0), gap = C > 1 || Rn > 1 ? o.gap : 0, lip = Math.min(o.lip, Math.min(o.pw, o.ph) / 3);
    const ww = o.pw - 2 * lip, wh = o.ph - 2 * lip, b = o.b, txtB = String(o.text || '').trim() ? b * .55 : 0, txtT = String(o.text2 || '').trim() ? b * .55 : 0;
    const gridW = C * o.pw + (C - 1) * gap, gridH = Rn * o.ph + (Rn - 1) * gap;
    const wins = [], pockets = [];
    for (let i = 0; i < C; i++) for (let j = 0; j < Rn; j++) {
      const px = i * (o.pw + gap), py = j * (o.ph + gap);
      const w1 = outline(o.win, px + lip, py + lip, ww, wh, Math.max(2, o.r * .6)); wins.push(...w1);
      if (RECT_WINS.has(o.win)) pockets.push(rectPts(px - .5, py - .5, o.pw + 1, o.ph + 1)); else pockets.push(...offsetPaths(w1, lip + .5));
    }
    const box = [-b, -b - txtB, gridW + b, gridH + b + txtT];
    let outer = shapeAround(o.shape, box, pockets, Math.max(4, b * .45), o.r);
    let ob = bboxOf(outer);
    if (o.top !== 'none') { const s = clamp(Math.min(ob[2] - ob[0], ob[3] - ob[1]) * .16, 10, 40), cx = (ob[0] + ob[2]) / 2; outer = attachTopper(outer, o.top, cx, s) }
    ob = bboxOf(outer);
    // shift everything to positive coordinates
    const dx = -ob[0], dy = -ob[1], mv = ps => mapPaths(ps, (x, y) => [x + dx, y + dy]);
    outer = mv(outer); const W = ob[2] - ob[0], H = ob[3] - ob[1], winsM = mv(wins), pocketsM = mv(pockets), gx0 = dx, gy0 = dy;
    const front = boolOp(outer, winsM, 'diff'), parts = [], steps = [], bom = [];
    // decoration band: inside the outer edge, outside the windows
    const band = boolOp(offsetPaths(outer, -1.5), offsetPaths(winsM, 1.5), 'diff');
    const items = [{ layer: CUT, kind: 'part', paths: front, closed: true }];
    const bw = Math.max(3, b * .3);
    if (o.border !== 'none') { const loop = offsetPaths(outer, -Math.min(b * .3, bw)); for (const L of loop.filter(q => polyArea(q) > 50)) items.push(...decoItems(borderDeco(o.border, L, bw), o.dm, o.dm === 'cut' ? offsetPaths(band, -1) : band)); for (const L of offsetPaths(winsM, Math.min(b * .22, 4)).filter(q => polyArea(q) > 50 && o.border !== 'lace')) items.push(...decoItems(borderDeco(o.border === 'vine' || o.border === 'greek' ? 'line' : o.border, L, bw * .7), o.dm, band)) }
    if (o.corner !== 'none') { const ib = [gx0 - b * .85, gy0 - b * .85 - txtB, gx0 + gridW + b * .85, gy0 + gridH + b * .85 + txtT]; items.push(...decoItems(cornerDeco(o.corner, ib, Math.min(b * 1.1, 26)), o.dm, offsetPaths(band, -1))) }
    if (o.scatter !== 'none') { const ms = Math.max(3.5, b * .32), sh = [], bb = bboxOf(band), area0 = offsetPaths(band, -ms * .7); for (let y = bb[1] + ms; y < bb[3]; y += ms * 2.4) for (let x = bb[0] + ms * ((((y / ms) | 0) % 2) ? 1.7 : .5); x < bb[2]; x += ms * 3) { const c = [[x, y], [x - ms * .5, y - ms * .5], [x + ms * .5, y + ms * .5], [x - ms * .5, y + ms * .5], [x + ms * .5, y - ms * .5]]; if (c.every(q => inPolys(q, area0))) sh.push(...motif(o.scatter, x, y, ms, ((x * 7 + y * 3) % 6) * .2 - .5)) } items.push(...decoItems({ shapes: sh }, o.dm, null)) }
    const font = o.font || 'serif';
    { const it = await fitText(o.text, font, Math.min(txtB * 1.2, 14), gx0 + gridW / 2, gy0 - b * .1 - txtB * .55, gridW * .9, txtB * .9, o.tm); if (it) items.push(it) }
    { const it = await fitText(o.text2, font, Math.min(txtT * 1.2, 14), gx0 + gridW / 2, gy0 + gridH + b * .1 + txtT * .55, gridW * .9, txtT * .9, o.tm); if (it) items.push(it) }
    parts.push({ name: T('Лицевая рамка', 'Front frame'), items, req: curReq(t) });
    if (o.ins !== 'front') {
      // spacer: pockets for the photos; for slide-in, the pockets open through the top edge
      let pk = pocketsM; if (o.ins === 'slide') { const cols = []; for (let i = 0; i < C; i++) { const px = gx0 + i * (o.pw + gap) - .5; cols.push(rectPts(px, gy0 - .5, o.pw + 1, H + 10)) } pk = pk.concat(cols) }
      const spacer = boolOp(outer, pk, 'diff');
      parts.push({ name: o.ins === 'slide' ? T('Прокладка с щелью', 'Spacer with slot') : T('Средняя рамка (карман)', 'Spacer (pocket)'), items: [{ layer: CUT, kind: 'part', paths: spacer, closed: true }], req: curReq(t) });
      const holes = [], cx = W / 2;
      if (o.mount === 'keyhole') { const ky = H - Math.max(18, b * .9); holes.push(union([[circlePts(cx, ky, 4.5, 28)], [rectPts(cx - 2, ky, 4, 9)], [circlePts(cx, ky + 9, 2, 16)]])[0]) }
      if (o.mount === 'holes') for (const sx of [-1, 1]) holes.push(circlePts(cx + sx * W * .3, H - Math.max(10, b * .5), 2.5, 20));
      if (o.mount === 'magnets') { const m = Math.max(10, b * .5); for (const [x, y] of [[m, m], [W - m, m], [m, H - m], [W - m, H - m]]) if (inPolys([x, y], offsetPaths(outer, -6))) holes.push(circlePts(x, y, 5.1, 32)) }
      let slot = null;
      if (o.mount === 'stand') { slot = o.land ? rectPts(cx - 10, H * .5, 20, t + .1) : rectPts(cx - 10, H * .55, 20, t + .1); holes.push(slot) }
      if (o.ins === 'slide' && C === 1) { /* thumb notch to push the photo out */ holes.push(circlePts(cx, gy0 + o.ph * .5, Math.min(8, o.pw * .1), 24)) }
      const back = holes.length ? boolOp(outer, holes, 'diff') : outer;
      parts.push({ name: T('Задник', 'Back'), items: [{ layer: CUT, kind: 'part', paths: back, closed: true }], req: curReq(t) });
      if (o.mount === 'stand') { const sh = (o.land ? H * .5 : H * .55), sw = clamp(sh * .45, 24, 60), stand = [[0, 0], [sw, 0], [sw, 6], [10 + t, sh - 4], [10 + t, sh + 6], [10, sh + 6], [10, sh - 4], [0, 6]]; parts.push({ name: T('Подставка', 'Stand'), items: [{ layer: CUT, kind: 'part', paths: [stand], closed: true }], req: curReq(t) }) }
      steps.push(o.ins === 'slide' ? T('Склейте слои: лицевая рамка, прокладка, задник. Фото вставляется сверху в щель прокладки.', 'Glue the layers: front, spacer, back. The photo slides in from the top through the spacer slot.') : T('Сложите: лицевая рамка, средняя рамка (в её карман вставляется фото), задник. Склейте или стяните винтами.', 'Stack: front frame, spacer (the photo sits in its pocket), back. Glue or screw.'));
      if (o.mount === 'stand') steps.push(T('Вставьте подставку в паз задника под углом.', 'Insert the stand into the slot in the back at an angle.'));
      if (o.mount === 'keyhole') steps.push(T('Петля-скважина: повесьте рамку на шуруп с плоской шляпкой.', 'Keyhole hanger: hang the frame on a flat-head screw.'));
      if (o.mount === 'magnets') bom.push(T('Магниты ⌀10 мм — вклейте в гнёзда задника.', 'Glue ⌀10 mm magnets into the back pockets.'));
    } else steps.push(T('Лицевую рамку можно наклеить на картон или фанеру с фото.', 'Glue the front frame onto card or plywood with the photo.'));
    if (o.dm === 'cut' && o.border !== 'none') bom.push(T('Узор прорезается насквозь: за ним будет видно прокладку — её можно покрасить.', 'The pattern is cut through: the spacer behind it shows — you can paint it.'));
    return { parts, info: `${fx(W, 0)}×${fx(H, 0)} ${MM()} · ${C * Rn} ${T('фото', 'photo(s)')}`, steps, bom: bom.concat(RECT_WINS.has(o.win) ? [] : [T('Фото обрежьте по форме кармана (контур кармана можно распечатать как шаблон).', 'Trim the photo to the pocket shape (print the pocket outline as a template).')], [T(`Окно ${fx(ww, 1)}×${fx(wh, 1)} мм, карман ${fx(o.pw + 1, 1)}×${fx(o.ph + 1, 1)} мм.`, `Window ${fx(ww, 1)}×${fx(wh, 1)} mm, pocket ${fx(o.pw + 1, 1)}×${fx(o.ph + 1, 1)} mm.`)]) };
  }
};

GENS.sign = {
  icon: 'sign', name: () => T('Табличка / подставка', 'Sign / coaster'), desc: () => T('20 форм, узоры, уголки, текст любым шрифтом', '20 shapes, patterns, corners, text in any font'),
  fields: [
    { t: 'head', l: () => T('Форма', 'Shape') },
    { k: 'shape', t: 'sel', l: () => T('Форма', 'Shape'), def: () => 'round', opts: OUTLINES },
    { k: 'W', t: 'num', l: () => T('Ширина', 'Width'), def: () => 200, min: 10, u: MM, step: 1 }, { k: 'H', t: 'num', l: () => T('Высота', 'Height'), def: () => 80, min: 10, u: MM, step: 1 },
    { k: 'R', t: 'num', l: () => T('Скругление / размер зубцов', 'Corner radius / edge detail'), def: () => 10, min: 0, u: MM, step: 1 },
    { k: 'top', t: 'sel', l: () => T('Украшение сверху', 'Topper'), def: () => 'none', opts: TOPPERS },
    { t: 'head', l: () => T('Текст', 'Text') },
    { k: 'text', t: 'area', l: () => T('Текст', 'Text'), def: () => T('Мастерская', 'Workshop') },
    { k: 'font', t: 'font', l: () => T('Шрифт', 'Font'), def: () => 'unb' },
    { k: 'ts', t: 'num', l: () => T('Размер текста', 'Text size'), def: () => 22, min: 2, u: MM, step: 1 },
    { k: 'text2', t: 'area', l: () => T('Вторая строка (мельче)', 'Second line (smaller)'), def: () => '' },
    { k: 'font2', t: 'font', l: () => T('Шрифт второй строки', 'Second line font'), def: () => 'plex', show: o => String(o.text2 || '').trim() },
    { k: 'tm', t: 'sel', l: () => T('Текст', 'Text as'), def: () => 'fill', opts: () => [['fill', T('гравировка заливкой', 'filled engraving')], ['line', T('гравировка по контуру', 'outline engraving')], ['cut', T('прорезь (трафарет)', 'cut-through (stencil)')]] },
    { t: 'head', l: () => T('Узор', 'Decoration') },
    { k: 'border', t: 'sel', l: () => T('Узор по краю', 'Border pattern'), def: () => 'double', opts: BORDERS },
    { k: 'corner', t: 'sel', l: () => T('Уголки', 'Corners'), def: () => 'none', opts: CORNERS },
    { k: 'side', t: 'sel', l: () => T('Мотив по бокам текста', 'Motif beside the text'), def: () => 'none', opts: () => [['none', T('нет', 'none')]].concat(MOTIFS()) },
    { k: 'dm', t: 'sel', l: () => T('Узор выполнить', 'Decoration as'), def: () => 'fill', opts: DECO_MODES },
    { t: 'head', l: () => T('Крепление', 'Mounting') },
    { k: 'hm', t: 'sel', l: () => T('Отверстия', 'Holes'), def: () => 'two', opts: () => [['none', T('нет', 'none')], ['two', T('два сверху', 'two at the top')], ['one', T('одно сверху', 'one at the top')], ['four', T('четыре по углам', 'four corners')], ['keyhole', T('петля-«замочная скважина»', 'keyhole hanger')], ['tab', T('ушко для подвеса', 'hanging tab')]] },
    { k: 'hd', t: 'num', l: () => T('Диаметр', 'Diameter'), def: () => 5, min: 1, u: MM, step: .5, show: o => ['two', 'one', 'four', 'tab'].includes(o.hm) },
  ],
  migrate(o) { if (o.shape === 'ellipse') o.shape = 'oval'; if (o.shape === 'rect' && o.R > 0) o.shape = 'round'; if (typeof o.holes === 'boolean' && o.hm == null) o.hm = o.holes ? (o.shape === 'oval' ? 'one' : 'two') : 'none'; if (typeof o.border === 'boolean') o.border = o.border ? 'line' : 'none' },
  async make(o) {
    if (!hasClip()) throw new Error(T('Нужна библиотека Clipper — она не загрузилась.', 'The Clipper library did not load.'));
    const W = o.W, H = o.H, items = [], m = Math.min(W, H);
    let out = outline(o.shape, 0, 0, W, H, o.R);
    if (o.top !== 'none') { const s = clamp(m * .3, 8, 40); out = attachTopper(out, o.top, W / 2, s) }
    const holes = [], r = o.hd / 2;
    const inner = offsetPaths(out, -Math.max(3, m * .05)), ib = bboxOf(inner);
    const offC = {}, fitIn = (x, y, rr) => inPolys([x, y], offC[rr] || (offC[rr] = offsetPaths(out, -(rr + 2.5))));
    const topY = (x) => { let lo = ib[1], hi = ib[3]; if (fitIn(x, hi, r + 1)) return hi; for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (fitIn(x, mid, r + 1)) lo = mid; else hi = mid } return lo };
    if (o.hm === 'two') for (const sx of [.15, .85]) { const x = W * sx, y = topY(x); holes.push(circlePts(x, y - r - 2, r, 28)) }
    if (o.hm === 'one') { const y = topY(W / 2); holes.push(circlePts(W / 2, y - r - 2, r, 28)) }
    if (o.hm === 'four') for (const [sx, sy] of [[.12, .15], [.88, .15], [.12, .85], [.88, .85]]) { let x = W * sx, y = H * sy; for (let k = 0; k < 40 && !fitIn(x, y, r); k++) { x += (W / 2 - x) * .05; y += (H / 2 - y) * .05 } holes.push(circlePts(x, y, r, 28)) }
    if (o.hm === 'keyhole') { const y = topY(W / 2) - 8; holes.push(union([[circlePts(W / 2, y - 4, 4.5, 28)], [rectPts(W / 2 - 2, y - 4, 4, 9)], [circlePts(W / 2, y + 5, 2, 16)]])[0]) }
    if (o.hm === 'tab') { const b = bboxOf(out), tr = Math.max(r + 4, 7), cy = b[3] + tr * .6; out = union([out, [circlePts(W / 2, cy, tr, 32)], [rectPts(W / 2 - tr, cy - tr * 2, tr * 2, tr * 2)]]); holes.push(circlePts(W / 2, cy, r, 28)) }
    const body = holes.length ? boolOp(out, holes, 'diff') : out;
    items.push({ layer: CUT, kind: 'part', paths: body, closed: true });
    const band = boolOp(offsetPaths(out, -1.5), offsetPaths(holes, 2), 'diff');
    const bw = clamp(m * .07, 3, 10);
    if (o.border !== 'none') for (const L of offsetPaths(out, -bw * .9).filter(q => polyArea(q) > 50)) items.push(...decoItems(borderDeco(o.border, L, bw), o.dm, o.dm === 'cut' ? offsetPaths(band, -1) : band));
    if (o.corner !== 'none') items.push(...decoItems(cornerDeco(o.corner, [ib[0] + bw, ib[1] + bw, ib[2] - bw, ib[3] - bw], clamp(m * .2, 6, 30)), o.dm, offsetPaths(band, -1)));
    // text area: inside the border, away from the holes
    const has2 = String(o.text2 || '').trim(), tx0 = ib[0] + bw * 1.6, tx1 = ib[2] - bw * 1.6, sideW = o.side !== 'none' ? Math.min((tx1 - tx0) * .16, H * .4) : 0;
    const ty0 = ib[1] + bw * 1.4, ty1 = ib[3] - bw * 1.4 - (['two', 'one', 'keyhole'].includes(o.hm) ? o.hd + 4 : 0), th = ty1 - ty0, cy = (ty0 + ty1) / 2;
    const l1 = await fitText(o.text, o.font, o.ts, W / 2, has2 ? ty0 + th * .62 : cy, (tx1 - tx0) - 2 * sideW, has2 ? th * .6 : th * .8, o.tm);
    if (l1) items.push(l1);
    if (has2) { const l2 = await fitText(o.text2, o.font2 || 'plex', o.ts * .45, W / 2, ty0 + th * .18, (tx1 - tx0) - 2 * sideW, th * .26, o.tm); if (l2) items.push(l2) }
    if (o.side !== 'none' && sideW > 3) { const tb = l1 ? bboxOf(l1.paths) : [W / 2, cy, W / 2, cy], sz = Math.min(sideW * .8, th * .45), sh = []; for (const x of [tb[0] - sz * .9, tb[2] + sz * .9]) sh.push(...motif(o.side, x, cy, sz)); items.push(...decoItems({ shapes: sh }, o.dm, offsetPaths(band, -.5))) }
    const bom = []; if (o.tm === 'cut') bom.push(T('В режиме трафарета замкнутые части букв (О, А, Р) выпадут.', 'In stencil mode the islands of letters (O, A, R) will fall out.'));
    const bb = bboxOf(body);
    return { parts: [{ name: T('Табличка', 'Sign'), items }], info: `${fx(bb[2] - bb[0], 0)}×${fx(bb[3] - bb[1], 0)} ${MM()}`, bom };
  }
};
