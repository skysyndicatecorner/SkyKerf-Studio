'use strict';
/* ============================================================================
   SkyKerf_Studio · layered house picture and dollhouse
   - houseLayers: a house scene as a stack of plates (back, sky with moon and
     stars, far scenery, house, roof and trims, foreground) + glued details;
     windows can be cut through for LED backlight
   - dollhouse: open-front multi-room house (1:6…1:48) on tabs and slots,
     gable / flat / castle top, partitions with doorways, stairs, towers
   ============================================================================ */
const ccwP = p => area(p) < 0 ? p.slice().reverse() : p;
const starPoly = (cx, cy, r1, r2, n = 5, a0 = Math.PI / 2) => { const p = []; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = a0 + Math.PI * i / n; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]) } return p };
const moonPoly = (cx, cy, r) => { const m = boolOp([circlePts(cx, cy, r, 48)], [circlePts(cx + r * .45, cy + r * .25, r * .85, 48)], 'diff'); return m };
const HL_STYLES = () => [['cottage', T('Коттедж', 'Cottage')], ['izba', T('Изба', 'Log hut')], ['castle', T('Замок', 'Castle')], ['tower', T('Башня', 'Tower')], ['church', T('Часовня', 'Chapel')], ['fairy', T('Сказочный', 'Fairy-tale')], ['christmas', T('Новогодний', 'Christmas')], ['japanese', T('Японский', 'Japanese')]];
const HL_PRESET = {
  cottage: { wall: 'planks', roofing: 'shingles', winShape: 'rect', fg: 'fence', bg: 'hills', sky: 'moonstars' },
  izba: { wall: 'logs', roofing: 'planks', winShape: 'arch', fg: 'fence', bg: 'forest', sky: 'moonstars' },
  castle: { wall: 'stones', roofing: 'slate', winShape: 'arch', fg: 'bushes', bg: 'mountains', sky: 'moonstars' },
  tower: { wall: 'bricks', roofing: 'shingles', winShape: 'arch', fg: 'bushes', bg: 'hills', sky: 'moon' },
  church: { wall: 'boards', roofing: 'shingles', winShape: 'gothic', fg: 'grass', bg: 'forest', sky: 'stars' },
  fairy: { wall: 'stones', roofing: 'shingles', winShape: 'round', fg: 'bushes', bg: 'forest', sky: 'moonstars' },
  christmas: { wall: 'planks', roofing: 'tiles', winShape: 'rect', fg: 'snow', bg: 'forest', sky: 'stars' },
  japanese: { wall: 'shoji', roofing: 'kawara', winShape: 'rect', fg: 'grass', bg: 'mountains', sky: 'sun' },
};
GENS.houseLayers = {
  icon: 'layers', name: () => T('Слоистый домик (картина)', 'Layered house (picture)'), desc: () => T('Домик-картина из слоёв с подсветкой', 'House scene made of stacked layers'),
  fields: [
    { t: 'head', l: () => T('Домик', 'House') },
    { k: 'style', t: 'sel', l: () => T('Стиль', 'Style'), def: () => 'cottage', opts: HL_STYLES, preset: true },
    { k: 'floors', t: 'num', l: () => T('Этажей', 'Floors'), def: () => 1, min: 1, max: 3, step: 1 },
    { k: 'win', t: 'num', l: () => T('Окон на этаже', 'Windows per floor'), def: () => 2, min: 0, max: 5, step: 1 },
    { k: 'winShape', t: 'sel', l: () => T('Форма окон', 'Window shape'), def: () => 'rect', opts: WIN_SHAPES },
    { k: 'wall', t: 'sel', l: () => T('Отделка стен', 'Wall finish'), def: () => 'planks', opts: SURFACES },
    { k: 'roofing', t: 'sel', l: () => T('Кровля', 'Roofing'), def: () => 'shingles', opts: ROOFINGS },
    { k: 'chimney', t: 'chk', l: () => T('Печная труба', 'Chimney'), def: () => true },
    { t: 'head', l: () => T('Сцена', 'Scene') },
    { k: 'sky', t: 'sel', l: () => T('Небо', 'Sky'), def: () => 'moonstars', opts: () => [['none', T('нет', 'none')], ['moon', T('месяц', 'moon')], ['stars', T('звёзды', 'stars')], ['moonstars', T('месяц и звёзды', 'moon and stars')], ['sun', T('солнце', 'sun')]] },
    { k: 'bg', t: 'sel', l: () => T('Фон', 'Background'), def: () => 'hills', opts: () => [['none', T('нет', 'none')], ['hills', T('холмы', 'hills')], ['mountains', T('горы', 'mountains')], ['forest', T('лес', 'forest')], ['town', T('городок', 'little town')]] },
    { k: 'fg', t: 'sel', l: () => T('Передний план', 'Foreground'), def: () => 'fence', opts: () => [['none', T('нет', 'none')], ['fence', T('заборчик', 'fence')], ['bushes', T('кусты', 'bushes')], ['snow', T('сугробы', 'snowdrifts')], ['grass', T('трава', 'grass')]] },
    { t: 'head', l: () => T('Картина', 'Picture') },
    { k: 'frame', t: 'sel', l: () => T('Форма', 'Shape'), def: () => 'arch', opts: () => [['rect', T('прямоугольник', 'rectangle')], ['round', T('скруглённый', 'rounded')], ['arch', T('арка', 'arch')], ['circle', T('круг', 'circle')], ['oval', T('овал', 'oval')], ['house', T('силуэт дома', 'house shape')]] },
    { k: 'W', t: 'num', l: () => T('Ширина', 'Width'), def: () => 160, min: 60, max: 600, u: MM, step: 5 },
    { k: 'Hk', t: 'num', l: () => T('Высота (% ширины)', 'Height (% of width)'), def: () => 120, min: 60, max: 200, u: () => '%', step: 5, show: o => o.frame !== 'circle' },
    { k: 'border', t: 'num', l: () => T('Ширина рамки', 'Frame width'), def: () => 8, min: 4, max: 30, u: MM, step: 1 },
    { k: 'spacers', t: 'num', l: () => T('Проставок между слоями', 'Spacers between layers'), def: () => 0, min: 0, max: 3, step: 1, help: 'hlSpacers' },
    { k: 'led', t: 'chk', l: () => T('Подсветка: окна насквозь, канал для ленты', 'Backlight: windows cut through, LED channel'), def: () => true },
    { k: 'hang', t: 'sel', l: () => T('Крепление', 'Mounting'), def: () => 'keyhole', opts: () => [['none', T('нет', 'none')], ['keyhole', T('петля-«замочная скважина»', 'keyhole')], ['holes', T('два отверстия', 'two holes')], ['stand', T('подставка', 'stand')]] },
    { k: 'nums', t: 'chk', l: () => T('Номера слоёв на обороте', 'Layer numbers on the back'), def: () => true },
  ],
  presets: HL_PRESET,
  async make(o) {
    if (!hasClip()) throw new Error(T('Нужна библиотека Clipper — она не загрузилась.', 'The Clipper library did not load.'));
    const t = curThick(), W = o.W, H = o.frame === 'circle' ? W : W * o.Hk / 100, bw = o.border, mk = markLayer(), st = o.style;
    seedRnd = 4242;
    let F;
    if (o.frame === 'house') { const ey = H * .62; F = [[[0, 0], [W, 0], [W, ey], [W / 2, H], [0, ey]]] } else F = outline(o.frame, 0, 0, W, H, Math.min(W, H) * .12);
    const Fi = offsetPaths(F, -bw); if (!Fi.length) throw new Error(T('Рамка слишком широкая для такого размера.', 'The frame is too wide for this size.'));
    const ib = bboxOf(Fi), ring = boolOp(F, Fi, 'diff');
    const plate = content => union([ring, boolOp(content, Fi, 'inter')].filter(x => x.length));
    /* ----- house geometry ----- */
    const gy = ib[1] + (ib[3] - ib[1]) * .12, cx = W / 2, floors = clamp(o.floors | 0, 1, 3);
    let hw = (ib[2] - ib[0]) * (st === 'castle' ? .5 : st === 'tower' ? .3 : .5);
    const avail = (ib[3] - gy) * .78;
    let fh = Math.min(hw * (st === 'tower' ? 1.1 : .5), avail * .55 / floors);
    const bodyH = floors * fh, by = gy + bodyH, body = [rectPts(cx - hw / 2, gy, hw, bodyH)], pitch = { izba: 45, fairy: 58, christmas: 48, church: 52, tower: 66, japanese: 24 }[st] || 40;
    const ov = hw * .09, roof = [], extraBodies = [], chim = [], snow = [];
    const gable = (x0, x1, y, p, o2) => { const h = ((x1 - x0) / 2 + o2) * Math.tan(p * Math.PI / 180); return [[x0 - o2, y - o2 * .2], [x1 + o2, y - o2 * .2], [(x0 + x1) / 2, y + h]] };
    if (st === 'castle') {
      const tw = hw * .32, th = bodyH * 1.45, mh = Math.min(6, fh * .2), cren = (x0, w, y) => { const out = [rectPts(x0, y - .1, w, mh * 1.2)], n = Math.max(3, Math.round(w / (mh * 1.4)) | 1); for (let i = 1; i < n; i += 2) out.push(...[rectPts(x0 + w * i / n, y + mh * .6, w / n, mh + 1)]); return boolOp([out[0]], out.slice(1), 'diff') };
      for (const sx of [-1, 1]) { const x0 = cx + sx * (hw / 2) - (sx < 0 ? tw * .55 : tw * .45); extraBodies.push(rectPts(x0, gy, tw, th)); roof.push(gable(x0, x0 + tw, gy + th, 62, tw * .12)) }
      roof.push(...cren(cx - hw / 2, hw, by));
    } else if (st === 'tower') { roof.push(gable(cx - hw / 2, cx + hw / 2, by, pitch, ov * 1.2)) }
    else if (st === 'church') { roof.push(gable(cx - hw / 2, cx + hw / 2, by, pitch, ov)); const tw = hw * .26, ty = by + (hw / 2) * Math.tan(pitch * Math.PI / 180) * .55; extraBodies.push(rectPts(cx - tw / 2, by, tw, ty - by + tw * .9)); roof.push(gable(cx - tw / 2, cx + tw / 2, ty + tw * .9, 72, tw * .1)); const sp = ty + tw * .9 + (tw / 2 + tw * .1) * Math.tan(72 * Math.PI / 180); roof.push(rectPts(cx - .7, sp - 1, 1.4, tw * .45), rectPts(cx - tw * .18, sp + tw * .22, tw * .36, 1.4)) }
    else if (st === 'japanese') { const p1 = gable(cx - hw / 2, cx + hw / 2, by, pitch, ov * 2.2), up = ov * .8; p1[0][1] += up; p1[1][1] += up; roof.push(p1); const y2 = by + (hw / 2) * Math.tan(pitch * Math.PI / 180) * .7; extraBodies.push(rectPts(cx - hw * .3, by, hw * .6, y2 - by + 2)); const p2 = gable(cx - hw * .3, cx + hw * .3, y2, pitch + 4, ov * 1.6); p2[0][1] += up * .7; p2[1][1] += up * .7; roof.push(p2) }
    else roof.push(gable(cx - hw / 2, cx + hw / 2, by, pitch, ov));
    if (o.chimney && !['castle', 'tower', 'japanese'].includes(st)) { const cw = hw * .1, x0 = cx + hw * .18, ch = (hw / 2) * Math.tan(pitch * Math.PI / 180) * .75; chim.push(rectPts(x0, by, cw, ch), rectPts(x0 - 1.2, by + ch - 2, cw + 2.4, 2.5)) }
    if (st === 'christmas' || o.fg === 'snow') { const rp = roof[0]; if (rp && rp.length === 3) { const [a, b, c] = rp, th = Math.max(2, hw * .04); snow.push(...boolOp(offsetOpen([[a, c, b]], th), [rp], 'diff')) } }
    // fit the whole house inside the window of the frame
    let hb = bboxOf([...body, ...extraBodies, ...roof, ...chim]); const top = ib[3] - (o.frame === 'arch' || o.frame === 'circle' || o.frame === 'oval' || o.frame === 'house' ? (ib[3] - ib[1]) * .1 : 3);
    let k = Math.min(1, (top - gy) / (hb[3] - gy), (ib[2] - ib[0] - 6) / (hb[2] - hb[0]));
    const S2 = paths => mapPaths(paths.filter(p => p && p.length > 2), (x, y) => [cx + (x - cx) * k, gy + (y - gy) * k]);
    const B = S2(body), XB = S2(extraBodies), R = S2(roof), CH = S2(chim), SN = S2(snow);
    hw *= k; fh *= k; const byk = gy + bodyH * k;
    /* windows and door */
    const wins = [], nW = clamp(o.win | 0, 0, 5), ww = Math.min(hw / (nW + 1) * .6, fh * .45), wh = ww * 1.25;
    const dw0 = Math.min(hw * .2, fh * .4);
    for (let f = 0; f < floors; f++) {
      const yc = gy + fh * (f + .55); let xs = [];
      if (f === 0 && nW) { const half = Math.max(1, Math.ceil(nW / 2)), a0 = cx - hw / 2 + ww * .9, a1 = cx - dw0 / 2 - ww * .9; for (let i = 0; i < half; i++) { const x = half === 1 ? (a0 + a1) / 2 : a0 + (a1 - a0) * i / (half - 1); if (a1 > a0 - 1) xs.push(x, 2 * cx - x) } }
      else for (let i = 0; i < nW; i++) xs.push(cx - hw / 2 + hw * (i + 1) / (nW + 1));
      for (const x of xs) wins.push(windowGeom(x, yc, ww, wh, o.winShape, 'cross', t));
    }
    for (const xb of XB) { const b = bboxOf([xb]); if (b[3] - b[1] > ww * 3) wins.push(windowGeom((b[0] + b[2]) / 2, b[3] - ww * 1.6, Math.min(ww * .7, (b[2] - b[0]) * .4), wh * .8, st === 'castle' ? 'slit' : o.winShape, 'none', t)) }
    const dw = dw0, dh = Math.min(fh * .72, dw * 1.9), door = doorGeom(cx, gy, dw, dh, st === 'fairy' ? 'round' : ['castle', 'church', 'izba'].includes(st) ? 'arch' : 'rect');
    /* background */
    const bgp = [], groundTop = gy + 1;
    const ground = [rectPts(-1, -1, W + 2, groundTop + 1)];
    if (o.bg === 'hills' || o.bg === 'mountains' || o.bg === 'forest') {
      const pts = [[-1, -1]], amp = (ib[3] - gy) * (o.bg === 'mountains' ? .42 : .2), base = gy + (ib[3] - gy) * (o.bg === 'mountains' ? .18 : .12);
      for (let x = -1; x <= W + 1; x += W / 90) { const s = o.bg === 'mountains' ? .3 + Math.abs(Math.sin(x / W * 5.1 + .4)) * .5 + Math.abs(Math.sin(x / W * 13 + 1.1)) * .2 : Math.sin(x / W * 5 + .8) * .5 + .5; pts.push([x, base + amp * s]) }
      pts.push([W + 1, -1]); bgp.push(pts);
      if (o.bg === 'forest') for (let x = ib[0] + 6; x < ib[2] - 4; x += W / 10) { const h = (ib[3] - gy) * (.22 + rnd() * .18), y0 = base + amp * (Math.sin(x / W * 5 + .8) * .5 + .5) - 2; for (let i = 0; i < 3; i++) { const w2 = h * (.3 - i * .07); bgp.push([[x - w2, y0 + h * i * .28], [x + w2, y0 + h * i * .28], [x, y0 + h * (.45 + i * .28)]]) } bgp.push(rectPts(x - 1, y0 - 3, 2, 4)) }
    } else if (o.bg === 'town') { for (let x = ib[0]; x < ib[2]; x += W / 9) { const w2 = W / 11, h = (ib[3] - gy) * (.18 + rnd() * .25); bgp.push(rectPts(x, gy - 1, w2, h + 1), [[x - 1, gy + h], [x + w2 + 1, gy + h], [x + w2 / 2, gy + h + w2 * .55]]) } }
    /* sky holes */
    const skyH = [], sr = (ib[3] - ib[1]);
    if (o.sky === 'moon' || o.sky === 'moonstars') skyH.push(...moonPoly(ib[0] + (ib[2] - ib[0]) * .78, ib[1] + sr * .78, Math.min(W, H) * .07));
    if (o.sky === 'sun') { const sx = ib[0] + (ib[2] - ib[0]) * .78, sy = ib[1] + sr * .8, r = Math.min(W, H) * .07; skyH.push(circlePts(sx, sy, r, 40)); for (let i = 0; i < 12; i++) { const a = TAU * i / 12; skyH.push(starPoly(sx + Math.cos(a) * r * 1.55, sy + Math.sin(a) * r * 1.55, r * .28, r * .12, 3, a)) } }
    if (o.sky === 'stars' || o.sky === 'moonstars') for (let i = 0; i < 9; i++) { const x = ib[0] + (ib[2] - ib[0]) * (.08 + rnd() * .84), y = ib[1] + sr * (.62 + rnd() * .33), r = Math.min(W, H) * (.012 + rnd() * .014); if (inPolys([x, y], offsetPaths(Fi, -r * 2))) skyH.push(starPoly(x, y, r, r * .42)) }
    /* foreground */
    const fgp = [], fy = ib[1];
    if (o.fg === 'fence') { const fh2 = fh * .42, pw = Math.max(2.4, W * .018), gap = pw * .8, gapL = cx - dw * 1.4, gapR = cx + dw * 1.4; for (const [a, b] of [[ib[0] - 1, gapL], [gapR, ib[2] + 1]]) { fgp.push(rectPts(a, gy + fh2 * .3, b - a, pw * .7), rectPts(a, gy + fh2 * .68, b - a, pw * .7)); for (let x = a + gap; x + pw < b; x += pw + gap) fgp.push([[x, fy - 1], [x + pw, fy - 1], [x + pw, gy + fh2], [x + pw / 2, gy + fh2 + pw * .7], [x, gy + fh2]]) } fgp.push(rectPts(-1, -1, W + 2, gy - (gy - fy) * .4)) }
    else if (o.fg === 'bushes') { for (const x of [ib[0] + hw * .2, ib[0] + hw * .45, ib[2] - hw * .2, ib[2] - hw * .45]) { const r = fh * (.2 + rnd() * .1); fgp.push(circlePts(x, gy + r * .4, r, 28), circlePts(x - r * .7, gy + r * .1, r * .7, 24), circlePts(x + r * .7, gy + r * .05, r * .75, 24)) } fgp.push(rectPts(-1, -1, W + 2, gy + 1)) }
    else if (o.fg === 'snow') { const pts = [[-1, -1]]; for (let x = -1; x <= W + 1; x += W / 60) { const d = Math.abs(x - cx) < dw ? -fh * .1 : 0; pts.push([x, gy + fh * (.06 + .08 * Math.sin(x / W * 9) + .04 * Math.sin(x / W * 23)) + d]) } pts.push([W + 1, -1]); fgp.push(pts) }
    else if (o.fg === 'grass') { const pts = [[-1, -1]]; for (let x = -1; x <= W + 1; x += 2.2) { pts.push([x, gy - 1], [x + 1.1, gy + fh * (.06 + rnd() * .12)]) } pts.push([W + 1, gy - 1], [W + 1, -1]); fgp.push(pts) }
    /* ----- assemble layers ----- */
    const layers = [], details = [], addL = (nm, paths, extraItems, z) => layers.push({ nm, paths, extraItems: extraItems || [], z });
    // 1 back
    { let back = F.slice(); const holes = [];
      if (o.hang === 'keyhole') holes.push(circlePts(W / 2, H - bw - 6, 3.2, 24), rectPts(W / 2 - 1.6, H - bw - 12, 3.2, 6));
      if (o.hang === 'holes') for (const sx of [.25, .75]) { const x = W * sx; let y = ib[3] - 4; while (y > ib[1] && !inPolys([x, y], Fi)) y -= 1; holes.push(circlePts(x, y + bw / 2 - 2, 2, 20)) }
      if (o.led) holes.push(rectPts(W / 2 - 4, -1, 8, bw * .6 + 1));
      if (holes.length) back = boolOp(back, holes, 'diff');
      addL(T('задник', 'back'), back, []);
    }
    if (o.sky !== 'none' || o.led) addL(T('небо', 'sky'), skyH.length ? boolOp(F, skyH, 'diff') : F, []);
    if (o.bg !== 'none') addL(T('фон', 'background'), plate(union([ground, bgp.map(ccwP)].filter(x => x.length))), []);
    // house body: windows always cut (they show the light/sky behind)
    { let hp = plate(union([ground, B, XB, CH].filter(x => x.length)));
      const holes = []; for (const g of wins) holes.push(...(o.led ? g.glass : g.outline)); if (holes.length) hp = boolOp(hp, holes, 'diff');
      const region = boolOp(boolOp(union([B, XB].filter(x => x.length)), offsetPaths(wins.flatMap(g => g.outline).concat(door), 2.5), 'diff'), [rectPts(-1, -1, W + 2, gy + .8)], 'diff');
      const sf = surface(o.wall, offsetPaths(region, -1), Math.max(2.5, fh / 8), 3), ex = []; if (sf.lines.length) ex.push({ layer: mk, kind: 'part', paths: sf.lines, closed: false }); if (sf.shapes.length) ex.push({ layer: ENG, kind: 'part', paths: sf.shapes, closed: true });
      addL(T('дом', 'house'), hp, ex);
    }
    // roof + trims
    { const trim = boolOp(union([B, XB].filter(x => x.length)), offsetPaths(union([B, XB].filter(x => x.length)), -Math.max(1.6, hw * .03)), 'diff');
      const rp = plate(union([ground, R, CH, SN, trim].filter(x => x.length)));
      const rf = roofing(o.roofing, offsetPaths(R, -1), Math.max(2.5, hw * .04)), ex = rf.lines.length ? [{ layer: mk, kind: 'part', paths: rf.lines, closed: false }] : [];
      addL(T('крыша', 'roof'), rp, ex);
    }
    if (o.fg !== 'none' && fgp.length) addL(T('передний план', 'foreground'), plate(union(fgp.map(p => [ccwP(p)]))), []);
    // glued details: door, window frames, shutters
    { const dp = door, dd = doorDecor('planks', door, 'rect'), it = [{ layer: CUT, kind: 'part', paths: dp, closed: true }]; if (dd.lines.length) it.push({ layer: mk, kind: 'part', paths: dd.lines, closed: false }); details.push({ nm: T('Дверь', 'Door'), items: it, paths: dp, on: 'house' }) }
    for (const g of wins) { const fr = boolOp(offsetPaths(g.outline, Math.max(1.2, ww * .12)), g.outline, 'diff'); if (fr.length) details.push({ nm: T('Наличник окна', 'Window frame'), items: [{ layer: CUT, kind: 'part', paths: fr, closed: true }], paths: fr, on: 'roof' }) }
    /* spacers */
    const out = []; layers.forEach((L, i) => { out.push(L); if (i < layers.length - 1) for (let s = 0; s < (o.spacers | 0); s++) out.push({ nm: T('проставка', 'spacer'), paths: ring, extraItems: [], spacer: true }) });
    const parts = [], asm = []; let n = 0;
    for (const L of out) {
      n++; const items = [{ layer: CUT, kind: 'part', paths: L.paths, closed: true }, ...L.extraItems];
      if (o.nums) { const tp = await textAt(String(n), 'mono', Math.min(bw * .5, 4), W - bw / 2 - 2, bw / 2 - 1); if (tp.length) items.push({ layer: mk, kind: 'text', paths: mapPaths(tp, (x, y) => [W - x, y]), closed: true, extra: { text: String(n), font: 'mono', size: Math.min(bw * .5, 4), rot: 0 } }) }
      parts.push({ name: T(`Слой ${n} — ${L.nm}`, `Layer ${n} — ${L.nm}`), items, req: curReq(t), noRotate: false });
      const z = (n - 1) * t; L.z = z;
      asm.push({ paths: L.paths, origin: [0, 0, z], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], t, color: L.spacer ? hslHex(30, 15, 45) : hslHex(30 + n * 22, 40, 72 - n * 4) });
    }
    const zOf = nm => { const L = out.find(q => q.nm === nm); return L ? L.z + t : out.length * t };
    for (const d of details) { parts.push({ name: d.nm, items: d.items, req: curReq(t) }); asm.push({ paths: d.paths, origin: [0, 0, zOf(T(d.on === 'house' ? 'крыша' : 'передний план', d.on === 'house' ? 'roof' : 'foreground'))], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], t, color: hslHex(25, 45, 45) }) }
    if (o.hang === 'stand') { const sh = Math.min(H * .45, 70), stand = [[[0, 0], [sh * .55, 0], [sh * .55, 4], [6 + t, sh * .9], [6 + t, sh], [6, sh], [6, sh * .9], [0, 4]]]; parts.push({ name: T('Подставка', 'Stand'), items: [{ layer: CUT, kind: 'part', paths: stand, closed: true }], req: curReq(t) }) }
    const steps = [T('Слои собираются по номерам: 1 — задник, дальше к зрителю. Номер выгравирован на обороте в правом нижнем углу.', 'Stack the layers by number: 1 is the back, then towards the viewer. The number is engraved on the back, bottom right.'),
      T('Дверь приклейте на слой «дом» поверх, наличники — вокруг окон.', 'Glue the door onto the house layer and the window frames around the windows.')];
    if (o.led) steps.push(T('Подсветка: светодиодная лента приклеивается к задней стороне слоя «небо»; провод выходит через паз внизу задника. Свет проходит через окна, звёзды и месяц.', 'Backlight: stick an LED strip to the back of the sky layer; the cable exits through the notch at the bottom of the back. Light shines through the windows, stars and moon.'));
    return { parts, asm, steps, info: T(`${out.length} слоёв + ${details.length} накладных · ${fx(W, 0)}×${fx(H, 0)} мм · толщина ${fx((out.length + 1) * t, 1)} мм`, `${out.length} layers + ${details.length} glued pieces · ${fx(W, 0)}×${fx(H, 0)} mm · ${fx((out.length + 1) * t, 1)} mm thick`), bom: [T('Клей ПВА или столярный. Для подсветки — тёплая светодиодная лента 5 В с USB.', 'PVA or wood glue. For the backlight a warm 5 V USB LED strip.')] };
  }
};

/* ============================ dollhouse ============================ */
const DOLL_SCALES = { '6': { n: '1:6', fh: 380, room: 330, d: 300 }, '12': { n: '1:12', fh: 220, room: 220, d: 200 }, '16': { n: '1:16', fh: 160, room: 170, d: 150 }, '24': { n: '1:24', fh: 110, room: 120, d: 100 }, '48': { n: '1:48', fh: 60, room: 70, d: 60 } };
GENS.dollhouse = {
  icon: 'house', name: () => T('Кукольный дом', 'Dollhouse'), desc: () => T('Открытый фасад, комнаты, лестница, замок', 'Open front, rooms, stairs, castle'), manualJoints: true,
  fields: [
    { t: 'head', l: () => T('Масштаб и комнаты', 'Scale and rooms') },
    { k: 'scale', t: 'sel', l: () => T('Масштаб', 'Scale'), def: () => '16', opts: () => Object.entries(DOLL_SCALES).map(([k, v]) => [k, v.n + ({ '6': T(' (куклы 30 см)', ' (30 cm dolls)'), '12': T(' (классический)', ' (classic)'), '16': T(' (куклы 10–12 см)', ' (10–12 cm dolls)'), '24': T(' (мини)', ' (mini)'), '48': T(' (для полки)', ' (shelf size)') }[k] || '')]), apply: v => { const s = DOLL_SCALES[v]; return s ? { fh: s.fh, room: s.room, D: s.d } : {} } },
    { k: 'rooms', t: 'num', l: () => T('Комнат в ряд', 'Rooms per floor'), def: () => 2, min: 1, max: 4, step: 1 },
    { k: 'floors', t: 'num', l: () => T('Этажей', 'Floors'), def: () => 2, min: 1, max: 4, step: 1 },
    { k: 'room', t: 'num', l: () => T('Ширина комнаты', 'Room width'), def: () => 170, min: 40, u: MM, step: 5 },
    { k: 'fh', t: 'num', l: () => T('Высота комнаты', 'Room height'), def: () => 160, min: 40, u: MM, step: 5 },
    { k: 'D', t: 'num', l: () => T('Глубина', 'Depth'), def: () => 150, min: 40, u: MM, step: 5 },
    { t: 'head', l: () => T('Верх', 'Top') },
    { k: 'top', t: 'sel', l: () => T('Крыша', 'Roof'), def: () => 'gable', opts: () => [['gable', T('двускатная с мансардой', 'gable with attic')], ['flat', T('плоская с перилами', 'flat with railing')], ['castle', T('замок: зубцы', 'castle: battlements')]] },
    { k: 'pitch', t: 'num', l: () => T('Уклон крыши', 'Roof pitch'), def: () => 38, min: 20, max: 60, u: () => '°', step: 1, show: o => o.top === 'gable' },
    { k: 'towers', t: 'chk', l: () => T('Башни по бокам', 'Side towers'), def: () => false, show: o => o.top === 'castle' },
    { t: 'head', l: () => T('Окна, двери, лестница', 'Windows, doors, stairs') },
    { k: 'winShape', t: 'sel', l: () => T('Окна', 'Windows'), def: () => 'arch', opts: WIN_SHAPES },
    { k: 'sideWin', t: 'chk', l: () => T('Окна в боковых стенах', 'Side-wall windows'), def: () => true },
    { k: 'doorShape', t: 'sel', l: () => T('Проёмы между комнатами', 'Doorways between rooms'), def: () => 'arch', opts: () => [['arch', T('арка', 'arch')], ['rect', T('прямоугольные', 'rectangular')], ['none', T('без проёмов', 'none')]] },
    { k: 'stairs', t: 'chk', l: () => T('Лестница на второй этаж', 'Stairs to the upper floor'), def: () => true, show: o => o.floors > 1 },
    { k: 'wallTex', t: 'sel', l: () => T('Снаружи стены', 'Outside walls'), def: () => 'bricks', opts: SURFACES },
    { k: 'floorTex', t: 'sel', l: () => T('Пол', 'Floor'), def: () => 'planks', opts: () => [['none', T('без рисунка', 'plain')], ['planks', T('доски', 'planks')], ['parquet', T('паркет-ёлочка', 'herringbone parquet')], ['tiles', T('плитка', 'tiles')]] },
    { t: 'head', l: () => T('Соединения', 'Joints') },
    ...jointFields(),
  ],
  async make(o) {
    if (!hasClip()) throw new Error(T('Нужна библиотека Clipper — она не загрузилась.', 'The Clipper library did not load.'));
    const t = o.t, clr = fitValue(o), R = clamp(o.rooms | 0, 1, 4), Fl = clamp(o.floors | 0, 1, 4), rw = o.room, fh = o.fh, D = o.D, tw = Math.max(t * 2.5, Math.min(o.fw, 14));
    if (fh < t * 6 || rw < t * 6 || D < t * 6) throw new Error(T('Комнаты слишком малы для этой толщины.', 'The rooms are too small for this thickness.'));
    const Wi = R * rw + (R - 1) * t, W = Wi + 2 * t, Hs = Fl * (fh + t), e = Math.max(t * 1.6, 4), bm = t * 2 + 3, mk = markLayer();
    const parts = [], asm = [], steps = [], bom = [], col = { wall: hslHex(32, 40, 68), back: hslHex(28, 35, 60), floor: hslHex(30, 30, 52), roof: hslHex(12, 45, 42), part: hslHex(35, 35, 72) };
    const add = (name, items, a) => { parts.push({ name, items, req: curReq(t) }); if (a) asm.push(Object.assign({ t, color: col.wall }, a)) };
    const cut = paths => ({ layer: CUT, kind: 'part', paths, closed: true }), eng = paths => ({ layer: mk, kind: 'part', paths, closed: false });
    const slot = (x, y, w, h) => rectPts(x - clr / 2, y - clr / 2, w + clr, h + clr);
    const zSlab = k => k * (fh + t); // bottom of slab k (k = 0: base, top of base at t)
    const tabsAt = (len, n) => Array.from({ length: n }, (_, i) => len * (i + 1) / (n + 1));
    const nT = len => clamp(Math.round(len / (tw * 5)), 1, 4);
    const roofGable = o.top === 'gable', castle = o.top === 'castle', ph = castle ? Math.max(t * 4, fh * .22) : o.top === 'flat' ? Math.max(t * 4, fh * .2) : 0;
    const p = clamp(o.pitch, 15, 65) * Math.PI / 180, Rr = roofGable ? (W / 2 + e) * Math.tan(p) : 0;
    const doorW = Math.min(D * .45, rw * .5, fh * .5), doorH = fh * .72, doorY = D * .5 - doorW / 2;
    /* ---- side walls (local a = y, b = z - t) ---- */
    const sideYs = tabsAt(D, nT(D));
    for (const side of [0, 1]) {
      let pnl = [rectPts(0, 0, D, Hs + ph)];
      const tabs = [], holes = [];
      for (const y of sideYs) tabs.push(rectPts(y - tw / 2, -t, tw, t + .01)); // into the base
      for (let k = 0; k < Fl; k++) tabs.push(rectPts(D - .01, zSlab(k) + t + fh * .5 - tw / 2 - t, t + .01, tw)); // into the back wall
      if (castle) { const mw = Math.max(t * 3, 8), n = Math.max(3, Math.round(D / mw) | 1); for (let i = 1; i < n; i += 2) holes.push(rectPts(D * i / n, Hs + ph * .45, D / n, ph)) }
      for (let k = 1; k <= Fl; k++) for (const y of sideYs) holes.push(slot(y - tw / 2, zSlab(k) - t, tw, t)); // floor tabs
      if (o.sideWin) for (let k = 0; k < Fl; k++) { const g = windowGeom(D * .45, zSlab(k) + fh * .55, Math.min(D * .3, fh * .35), Math.min(fh * .42, D * .4), o.winShape, 'cross', t); holes.push(...g.glass) }
      pnl = boolOp(boolOp(pnl, tabs, 'union'), holes, 'diff');
      const sf = surface(o.wallTex, offsetPaths([rectPts(0, 0, D, Hs)], -2), Math.max(3, fh / 14), side + 1);
      const items = [cut(pnl)]; if (sf.lines.length) items.push(eng(sf.lines));
      add(side ? T('Правая стена', 'Right wall') : T('Левая стена', 'Left wall'), items, { paths: pnl, origin: [side ? W - t : 0, 0, t], u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0], color: col.wall });
    }
    /* ---- back wall (local a = x + e, b = z - t), full width + e on both sides ---- */
    {
      const BW = W + 2 * e; let sil = [rectPts(0, 0, BW, Hs + ph)];
      if (roofGable) sil = boolOp(sil, [[[0, Hs - .01], [BW, Hs - .01], [BW / 2, Hs + Rr]]], 'union');
      const holes = [], tabs = [];
      for (const x of tabsAt(BW - 2 * e, nT(W) + 1)) tabs.push(rectPts(e + x - tw / 2, -t, tw, t + .01));
      for (let k = 0; k < Fl; k++) for (const xs of [e, e + W - t]) holes.push(slot(xs, zSlab(k) + fh * .5 - tw / 2, t, tw)); // side-wall tabs
      for (let k = 1; k <= Fl; k++) for (const x of tabsAt(Wi, nT(Wi) + 1)) holes.push(slot(e + t + x - tw / 2, zSlab(k) - t, tw, t));
      for (let r = 1; r < R; r++) { const px = t + r * rw + (r - 1) * t; for (let k = 0; k < Fl; k++) holes.push(slot(e + px, zSlab(k) + t + fh * .5 - tw / 2 - t, t, tw)) }
      for (let k = 0; k < Fl; k++) for (let r = 0; r < R; r++) { const x0 = e + t + r * (rw + t) + rw / 2, g = windowGeom(x0, zSlab(k) + fh * .58, Math.min(rw * .32, fh * .36), Math.min(fh * .42, rw * .45), o.winShape, 'cross', t); holes.push(...g.glass) }
      if (roofGable) { const g = windowGeom(BW / 2, Hs + Rr * .38, Rr * .36, Rr * .36, 'round', 'cross', t); holes.push(...g.glass) }
      if (castle) { const mw = Math.max(t * 3, 8), n = Math.max(3, Math.round(BW / mw) | 1); for (let i = 1; i < n; i += 2) holes.push(rectPts(BW * i / n, Hs + ph * .45, BW / n, ph)) }
      const pnl = boolOp(boolOp(sil, tabs, 'union'), holes, 'diff');
      add(T('Задняя стена', 'Back wall'), [cut(pnl)], { paths: pnl, origin: [-e, D + t, t], u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0], color: col.back });
    }
    /* ---- base and floors (local x - t for floors, base: x + bm, y + bm) ---- */
    const floorTex = (w, d) => { const reg = [rectPts(1.5, 1.5, w - 3, d - 3)], s = Math.max(4, rw / 14); if (o.floorTex === 'planks') return surface('planks', reg, s, 2).lines; if (o.floorTex === 'tiles') { const L = []; for (let x = s * 1.6; x < w; x += s * 1.6) L.push([[x, 1.5], [x, d - 1.5]]); for (let y = s * 1.6; y < d; y += s * 1.6) L.push([[1.5, y], [w - 1.5, y]]); return L } if (o.floorTex === 'parquet') { const L = []; for (let x = -d; x < w + d; x += s) { for (let y = 0; y < d; y += s * 2) { L.push([[x + y, y], [x + y + s, y + s]]); L.push([[x + y + s, y + s], [x + y, y + 2 * s]]) } } return clipOpen(L, reg, true) } return [] };
    {
      const BWd = W + 2 * bm, BD = D + t + 2 * bm, holes = [];
      for (const xs of [0, W - t]) for (const y of sideYs) holes.push(slot(bm + xs, bm + y - tw / 2, t, tw));
      for (const x of tabsAt(W + 2 * e - 2 * e, nT(W) + 1)) holes.push(slot(bm + x - tw / 2, bm + D, tw, t));
      for (let r = 1; r < R; r++) { const px = t + r * rw + (r - 1) * t; for (const fy of [.15, .85]) holes.push(slot(bm + px, bm + D * fy - tw / 2, t, tw)) }
      const pnl = boolOp([rectPts(0, 0, BWd, BD, 3)], holes, 'diff'), fl = mapPaths(floorTex(Wi, D), (x, y) => [x + bm + t, y + bm]);
      add(T('Основание', 'Base'), [cut(pnl), ...(fl.length ? [eng(fl)] : [])], { paths: pnl, origin: [-bm, -bm, 0], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], color: col.floor });
    }
    for (let k = 1; k <= Fl; k++) {
      const tabs = [], holes = [];
      for (const y of sideYs) { tabs.push(rectPts(-t, y - tw / 2, t + .01, tw)); tabs.push(rectPts(Wi - .01, y - tw / 2, t + .01, tw)) }
      for (const x of tabsAt(Wi, nT(Wi) + 1)) tabs.push(rectPts(x - tw / 2, D - .01, tw, t + .01));
      for (let r = 1; r < R; r++) { const px = r * rw + (r - 1) * t; for (const fy of [.35, .65]) holes.push(slot(px, D * fy - tw / 2, t, tw)); if (k < Fl) for (const fy of [.15, .85]) holes.push(slot(px, D * fy - tw / 2, t, tw)) }
      const stairHole = o.stairs && Fl > 1 && k < Fl && k === 1 ? rectPts(Wi - rw * .42 - 2, 2 + D * .05, rw * .42, D * .4) : null; // opening above the stairs (first room on the right)
      if (stairHole) holes.push(stairHole);
      let pnl = boolOp(boolOp([rectPts(0, 0, Wi, D)], tabs, 'union'), holes, 'diff');
      const top = k === Fl, fl = top && !roofGable ? [] : floorTex(Wi, D);
      add(top ? (roofGable ? T('Пол мансарды', 'Attic floor') : T('Крыша-терраса', 'Roof terrace')) : T(`Перекрытие ${k}`, `Floor ${k}`), [cut(pnl), ...(fl.length ? [eng(fl)] : [])], { paths: pnl, origin: [t, 0, zSlab(k)], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], color: col.floor });
    }
    /* ---- partitions (local a = y, b = z) ---- */
    for (let r = 1; r < R; r++) for (let k = 0; k < Fl; k++) {
      const px = t + r * rw + (r - 1) * t, tabs = [], holes = [];
      for (const fy of [.15, .85]) tabs.push(rectPts(D * fy - tw / 2, -t, tw, t + .01)); // into the floor below
      for (const fy of [.35, .65]) tabs.push(rectPts(D * fy - tw / 2, fh - .01, tw, t + .01)); // into the floor above
      tabs.push(rectPts(D - .01, fh * .5 - tw / 2, t + .01, tw));
      if (o.doorShape !== 'none') holes.push(...outline(o.doorShape === 'arch' ? 'arch' : 'rect', doorY, -1, doorW, doorH + 1));
      const pnl = boolOp(boolOp([rectPts(0, 0, D, fh)], tabs, 'union'), holes, 'diff');
      add(T(`Перегородка ${r}, этаж ${k + 1}`, `Partition ${r}, floor ${k + 1}`), [cut(pnl)], { paths: pnl, origin: [px, 0, zSlab(k) + t], u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0], color: col.part });
    }
    /* ---- gable roof ---- */
    if (roofGable) {
      const BW = W + 2 * e, fr = boolOp([[[0, 0], [BW, 0], [BW / 2, Rr]]], [[[BW * .18, t * 1.6], [BW * .82, t * 1.6], [BW / 2, Rr - Rr * .18]]], 'diff');
      const ft = boolOp(fr, tabsAt(Wi, 2).map(x => rectPts(e + t + x - tw / 2, -t, tw, t + .01)), 'union');
      add(T('Фронтон (рамка)', 'Front gable frame'), [cut(ft)], { paths: ft, origin: [-e, t, Hs + t], u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0], color: col.back });
      // slots in the attic floor for the front gable
      const top = parts.find(q => q.name === T('Пол мансарды', 'Attic floor')); if (top) { const it = top.items[0], old = it.paths; it.paths = boolOp(it.paths, tabsAt(Wi, 2).map(x => slot(x - tw / 2, 0, tw, t)), 'diff'); for (const a of asm) if (a.paths === old) a.paths = it.paths }
      const ov = Math.max(6, W * .04), s = (BW / 2) / Math.cos(p) + ov, len = D + 2 * t + 2 * ov, ex = BW / 2 - s * Math.cos(p) - e, ez = t + Hs + Rr - s * Math.sin(p);
      for (const sd of [0, 1]) {
        const pnl = [rectPts(0, 0, s, len)], rf = roofing('shingles', offsetPaths(pnl, -1.5), Math.max(4, s / 12));
        add(T(`Скат крыши ${sd + 1}`, `Roof slope ${sd + 1}`), [cut(pnl), ...(rf.lines.length ? [eng(rf.lines)] : [])], sd ? { paths: pnl, origin: [W - ex, D + t + ov, ez], u: [-Math.cos(p), 0, Math.sin(p)], v: [0, -1, 0], n: [Math.sin(p), 0, Math.cos(p)], color: col.roof } : { paths: pnl, origin: [ex, -ov, ez], u: [Math.cos(p), 0, Math.sin(p)], v: [0, 1, 0], n: [-Math.sin(p), 0, Math.cos(p)], color: col.roof });
      }
      steps.push(T('Мансарда: вставьте рамку фронтона в пазы пола мансарды; скаты положите на фронтоны и приклейте (или добавьте ручные соединения).', 'Attic: push the gable frame into the attic floor slots; lay the roof slopes on the gables and glue them (or add manual joints).'));
    }
    /* ---- front railing / battlements ---- */
    if (ph) {
      let fp = [rectPts(0, 0, Wi, ph)];
      if (castle) { const mw = Math.max(t * 3, 8), n = Math.max(3, Math.round(Wi / mw) | 1), h2 = []; for (let i = 1; i < n; i += 2) h2.push(rectPts(Wi * i / n, ph * .45, Wi / n, ph)); fp = boolOp(fp, h2, 'diff') }
      else { const h2 = []; for (let x = 6; x < Wi - 8; x += 10) h2.push(rectPts(x, t * 1.5, 5, ph - t * 3, 2)); fp = boolOp(fp, h2, 'diff') }
      fp = boolOp(fp, tabsAt(Wi, 2).map(x => rectPts(x - tw / 2, -t, tw, t + .01)), 'union');
      add(castle ? T('Зубцы фасада', 'Front battlements') : T('Перила террасы', 'Terrace railing'), [cut(fp)], { paths: fp, origin: [t, t, Hs + t], u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0], color: col.wall });
      const top = parts.find(q => q.name === T('Крыша-терраса', 'Roof terrace')); if (top) { const it = top.items[0], old = it.paths; it.paths = boolOp(it.paths, tabsAt(Wi, 2).map(x => slot(x - tw / 2, 0, tw, t)), 'diff'); for (const a of asm) if (a.paths === old) a.paths = it.paths }
    }
    /* ---- side towers (castle) ---- */
    if (castle && o.towers) {
      const ts = Math.max(D * .45, 40), th = Hs + ph * 2, tp = [];
      for (const side of [0, 1]) for (let f = 0; f < 4; f++) {
        let pnl = fingerPanel(ts, th, f % 2 ? ['F', 'B', 'F', 'B'] : ['F', 'A', 'F', 'A'], t, Math.max(o.fw, 6), clr);
        const mw = Math.max(t * 3, 7), n = Math.max(3, Math.round(ts / mw) | 1), h2 = []; for (let i = 1; i < n; i += 2) h2.push(rectPts(ts * i / n, th - ph * .5, ts / n, ph));
        for (let k = 0; k < Fl; k++) h2.push(rectPts(ts / 2 - 2, zSlab(k) + fh * .35, 4, fh * .35, 2));
        pnl = boolOp(pnl, h2, 'diff');
        const x0 = side ? W + 1 : -ts - 1, y0 = D / 2 - ts / 2, fr = [{ O: [x0, y0, 0], u: [1, 0, 0], n: [0, 1, 0] }, { O: [x0 + ts, y0, 0], u: [0, 1, 0], n: [-1, 0, 0] }, { O: [x0 + ts, y0 + ts, 0], u: [-1, 0, 0], n: [0, -1, 0] }, { O: [x0, y0 + ts, 0], u: [0, -1, 0], n: [1, 0, 0] }][f];
        add(T(`Башня ${side + 1}: стенка ${f + 1}`, `Tower ${side + 1}: wall ${f + 1}`), [cut(pnl)], { paths: pnl, origin: fr.O, u: fr.u, v: [0, 0, 1], n: fr.n, color: hslHex(30, 15, 62) });
      }
      steps.push(T('Башни: склейте по четыре стенки на шипах и приставьте к боковым стенам дома.', 'Towers: glue four finger-jointed walls each and stand them against the side walls.'));
    }
    /* ---- stairs: two stringers + treads ---- */
    if (o.stairs && Fl > 1) {
      const rise = fh + t, nS = Math.max(4, Math.round(rise / Math.max(12, fh / 8))), sh = rise / nS, run = Math.min(rw * .42, D * .9) / nS, sw = D * .4, pts = [[0, 0]];
      for (let i = 0; i < nS; i++) pts.push([i * run, (i + 1) * sh], [(i + 1) * run, (i + 1) * sh]);
      pts.push([nS * run, Math.max(0, rise - sh * 2.2)], [sh * 1.2, 0]);
      for (const sd of [0, 1]) add(T('Лестница: тетива', 'Stairs: stringer'), [cut([pts])], { paths: [pts], origin: [W - t - nS * run - 2, 2 + D * .05 + (sd ? sw - t : 0), t], u: [1, 0, 0], v: [0, 0, 1], n: [0, 1, 0], color: col.part });
      bom.push(T(`Лестница: ${nS} ступенек ${fx(run, 1)}×${fx(sw - 2 * t, 1)} мм — нарежьте из обрезков или используйте детали «Ступень».`, `Stairs: ${nS} treads ${fx(run, 1)}×${fx(sw - 2 * t, 1)} mm — cut from offcuts or use the “Tread” parts.`));
      for (let i = 0; i < nS; i++) add(T('Ступень', 'Tread'), [cut([rectPts(0, 0, run + 1, sw - 2 * t)])], { paths: [rectPts(0, 0, run + 1, sw - 2 * t)], origin: [W - t - nS * run - 2 + i * run, 2 + D * .05 + t, t + (i + 1) * sh - t], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], color: col.floor });
      steps.push(T('Лестница: приклейте ступени между двумя тетивами и поставьте в правую комнату под проём в перекрытии.', 'Stairs: glue the treads between the two stringers and stand them in the right room under the opening.'));
    }
    steps.unshift(T('Вставьте боковые стены в основание, затем перекрытия снизу вверх (выступы — в пазы стен), перегородки, и в конце — заднюю стену: её пазы надеваются на выступы стен и перекрытий.', 'Fit the side walls into the base, then the floors from the bottom up (tabs into the wall slots) and the partitions; finally the back wall — its slots go over the tabs of the walls and floors.'));
    const topZ = Hs + t + (roofGable ? Rr : ph);
    bom.push(T(`Комната: ${fx(rw, 0)}×${fx(D, 0)}×${fx(fh, 0)} мм (масштаб ${(DOLL_SCALES[o.scale] || {}).n || '—'}).`, `Room: ${fx(rw, 0)}×${fx(D, 0)}×${fx(fh, 0)} mm (scale ${(DOLL_SCALES[o.scale] || {}).n || '—'}).`), T('Мебель для этого масштаба — вкладка «Мебель».', 'Furniture for this scale is on the “Furniture” tab.'));
    return { parts, asm, steps, bom, info: T(`${parts.length} деталей · ${R}×${Fl} комнат · ${fx(W, 0)}×${fx(D + t, 0)}×${fx(topZ, 0)} мм`, `${parts.length} parts · ${R}×${Fl} rooms · ${fx(W, 0)}×${fx(D + t, 0)}×${fx(topZ, 0)} mm`) };
  }
};
