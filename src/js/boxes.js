'use strict';
/* ============================================================================
   SkyKerf_Studio · box templates
   Gift box with a slip-over lid, jewellery box with a flexible hinge, chest of
   drawers, hexagonal and heart boxes on a bent (kerf) band, desk organiser
   with sections / niches / shelves, pencil case with a sliding lid (layered),
   book box with a flexible spine and an interactive board book with windows
   and flaps.
   ============================================================================ */
const BOX_TPL = () => [['gift', T('Подарочная с крышкой', 'Gift box with lid')], ['hinged', T('Шкатулка с гибкой петлёй', 'Box with a flex hinge')], ['drawers', T('Комодик с ящиками', 'Chest of drawers')], ['hex', T('Шестигранная (гнутая стенка)', 'Hexagonal (bent wall)')], ['heart', T('Сердце (гнутая стенка)', 'Heart (bent wall)')], ['organizer', T('Органайзер: секции, ниши, полки', 'Organiser: sections, niches, shelves')], ['pencil', T('Пенал с выдвижной крышкой', 'Pencil case, sliding lid')], ['book', T('Книга-шкатулка', 'Book box')], ['flipbook', T('Интерактивная книжка', 'Interactive board book')]];
/* living-hinge cuts in a band region [x0,x1]×[0,h]: columns alternate between one middle cut and two edge cuts */
function flexCuts(x0, x1, h, sp, avoid) {
  const g = Math.max(1.6, h * .06), L = [];
  let i = 0; for (let x = x0 + sp / 2; x < x1; x += sp, i++) {
    if (avoid && avoid.some(([a, b]) => x > a && x < b)) continue;
    if (i % 2) L.push([[x, g], [x, h - g]]); else { L.push([[x, -.5], [x, h / 2 - g / 2]]); L.push([[x, h / 2 + g / 2], [x, h + .5]]) }
  }
  return L;
}
/* points and tangents along a closed polyline at arc lengths */
function alongLoop(loop, ss) {
  const seg = [], n = loop.length; let tot = 0; for (let i = 0; i < n; i++) { const a = loop[i], b = loop[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push([a, b, l, tot]); tot += l }
  return { total: tot, at: ss.map(s => { s = ((s % tot) + tot) % tot; const sg = seg.find(q => s >= q[3] && s <= q[3] + q[2]) || seg[seg.length - 1], k = (s - sg[3]) / (sg[2] || 1), [a, b, l] = sg; return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], d: [(b[0] - a[0]) / (l || 1), (b[1] - a[1]) / (l || 1)] } }) };
}
const orientRect = (c, d, along, across) => { const [ux, uy] = d, nx = -uy, ny = ux, a = along / 2, b = across / 2; return [[c[0] - ux * a - nx * b, c[1] - uy * a - ny * b], [c[0] + ux * a - nx * b, c[1] + uy * a - ny * b], [c[0] + ux * a + nx * b, c[1] + uy * a + ny * b], [c[0] - ux * a + nx * b, c[1] - uy * a + ny * b]] };
GENS.boxkit = {
  icon: 'box', name: () => T('Коробки, шкатулки, органайзеры', 'Boxes, caskets, organisers'), desc: () => T('Шаблоны: подарочная, шкатулка, комод, сердце, органайзер, пенал, книга', 'Templates: gift, casket, drawers, heart, organiser, pencil case, book'), manualJoints: true,
  fields: [
    { k: 'tpl', t: 'sel', l: () => T('Шаблон', 'Template'), def: () => 'gift', opts: BOX_TPL, apply: v => ({ gift: { W: 120, D: 90, H: 60 }, hinged: { W: 140, D: 90, H: 50 }, drawers: { W: 140, D: 110, H: 110, n: 3 }, hex: { S: 110, H: 50 }, heart: { S: 120, H: 50 }, organizer: { D: 90 }, pencil: { W: 200, D: 60, H: 21 }, book: { W: 120, D: 170, H: 36 }, flipbook: { W: 100, H: 100, pages: 6 } })[v] || {} },
    { k: 'W', t: 'num', l: () => T('Ширина', 'Width'), def: () => 120, min: 30, u: MM, step: 5, show: o => !['heart', 'hex'].includes(o.tpl) },
    { k: 'D', t: 'num', l: () => T('Глубина', 'Depth'), def: () => 90, min: 30, u: MM, step: 5, show: o => !['heart', 'hex', 'flipbook'].includes(o.tpl) },
    { k: 'H', t: 'num', l: () => T('Высота', 'Height'), def: () => 60, min: 15, u: MM, step: 5 },
    { k: 'S', t: 'num', l: () => T('Размер (поперёк)', 'Size (across)'), def: () => 110, min: 40, u: MM, step: 5, show: o => ['heart', 'hex'].includes(o.tpl) },
    { k: 'lidH', t: 'num', l: () => T('Высота крышки', 'Lid height'), def: () => 25, min: 8, u: MM, step: 1, show: o => o.tpl === 'gift' },
    { k: 'n', t: 'num', l: () => T('Ящиков', 'Drawers'), def: () => 3, min: 1, max: 8, step: 1, show: o => o.tpl === 'drawers' },
    { k: 'pages', t: 'num', l: () => T('Страниц', 'Pages'), def: () => 6, min: 2, max: 16, step: 1, show: o => o.tpl === 'flipbook' },
    { k: 'sections', t: 'area', l: () => T('Секции (тип:ширина×высота)', 'Sections (type:width×height)'), def: () => 'pen:45x110, niche:60x80, shelf:55x120, tray:70x35', show: o => o.tpl === 'organizer', help: 'orgSections' },
    { k: 'text', t: 'area', l: () => T('Надпись', 'Text'), def: () => T('С любовью', 'With love'), show: o => ['gift', 'hinged', 'book', 'heart', 'pencil', 'flipbook'].includes(o.tpl) },
    { k: 'deco', t: 'sel', l: () => T('Украшение', 'Decoration'), def: () => 'ribbon', opts: () => [['none', T('нет', 'none')], ['ribbon', T('лента с бантом', 'ribbon and bow')], ['hearts', T('сердечки', 'hearts')], ['stars', T('звёзды', 'stars')], ['floral', T('цветы', 'flowers')], ['window', T('окошко в крышке', 'window in the lid')]], show: o => ['gift', 'hinged', 'heart', 'hex', 'book'].includes(o.tpl) },
    { k: 'divs', t: 'num', l: () => T('Перегородок внутри', 'Inner dividers'), def: () => 0, min: 0, max: 6, step: 1, show: o => ['gift', 'hinged', 'pencil'].includes(o.tpl) },
    ...jointFields(),
  ],
  async make(o) {
    if (!hasClip()) throw new Error(T('Нужна библиотека Clipper — она не загрузилась.', 'The Clipper library did not load.'));
    const t = o.t, clr = fitValue(o), mk = markLayer(), parts = [], asm = [], steps = [], bom = [], tpl = o.tpl;
    const cut = p => ({ layer: CUT, kind: 'part', paths: p, closed: true }), eng = p => ({ layer: mk, kind: 'part', paths: p, closed: false }), engF = p => ({ layer: ENG, kind: 'part', paths: p, closed: true }), cutL = p => ({ layer: CUT, kind: 'part', paths: p, closed: false });
    const add = (name, items, fr, color) => { parts.push({ name, items, req: curReq(t) }); if (fr) asm.push(Object.assign({ t, color: color || hslHex(32, 40, 62), paths: items[0].paths }, fr)) };
    const XY = (x, y, z) => ({ origin: [x, y, z], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] }), XZ = (x, y, z) => ({ origin: [x, y, z], u: [1, 0, 0], v: [0, 0, 1], n: [0, 1, 0] });
    const shell = async (W, D, H, top, dx, dy) => GENS.box.make({ W, D, H, dims: 'outer', top: top || 'open', dx: dx | 0, dy: dy | 0, t, fw: o.fw, fit: o.fit, fitC: o.fitC, labels: false });
    const pushShell = (r, pre, map, color) => r.parts.forEach((p, i) => { const a = r.asm[i]; parts.push(Object.assign({}, p, { name: pre + p.name })); if (a) asm.push(Object.assign({}, a, map ? map(a) : {}, { color: color || a.color })) });
    const decoOn = async (w, h, kind, ty) => { // engraving for a lid/cover w×h
      const L = [], F = [];
      if (kind === 'ribbon') { const rw = Math.min(w, h) * .12; L.push([[w / 2 - rw / 2, 0], [w / 2 - rw / 2, h]], [[w / 2 + rw / 2, 0], [w / 2 + rw / 2, h]], [[0, h / 2 - rw / 2], [w, h / 2 - rw / 2]], [[0, h / 2 + rw / 2], [w, h / 2 + rw / 2]]); const s = rw * 1.6, cx = w / 2, cy = h / 2; for (const sx of [-1, 1]) L.push([[cx, cy], ...bezPts([cx, cy], [cx + sx * s * 1.4, cy + s * 1.3], [cx + sx * s * 1.6, cy - s * .2], [cx, cy], 16).slice(1)]); L.push(circlePts(cx, cy, rw * .35, 14).concat([[cx + rw * .35, cy]])) }
      if (kind === 'hearts' || kind === 'stars' || kind === 'floral') { const mt = kind === 'hearts' ? 'heart' : kind === 'stars' ? 'star' : 'flower', ms = Math.min(w, h) * .09; for (let y = ms * 1.2; y < h - ms * .6; y += ms * 2.4) for (let x = ms * (((y / ms) | 0) % 2 ? 1.8 : .9); x < w - ms * .6; x += ms * 2.6) F.push(...motif(mt, x, y, ms)) }
      if (String(o.text || '').trim()) { const tp = await textAt(o.text, 'serif', Math.min(w * .1, h * .14, 12), w / 2, ty != null ? ty : kind === 'ribbon' ? h * .2 : h / 2); if (tp.length) F.push(...tp) }
      return { L, F };
    };
    const divsInside = (W, D, H) => { const n = o.divs | 0; if (!n) return; const iw = W - 2 * t, id = D - 2 * t, h = H - t - 1; for (let i = 1; i <= n; i++) { const p = [rectPts(0, 0, id - clr, h)]; add(T('Перегородка', 'Divider'), [cut(p)], { origin: [t + iw * i / (n + 1) - t / 2, t + clr / 2, t], u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0] }, hslHex(30, 25, 70)) } bom.push(T('Перегородки вставляются враспор и при желании приклеиваются.', 'Dividers are a press fit; glue them if you like.')) };
    let info = '';
    if (tpl === 'gift') {
      const W = o.W, D = o.D, H = o.H, lh = Math.min(o.lidH, H * .9), gap = .4, LW = W + 2 * t + 2 * gap, LD = D + 2 * t + 2 * gap, dx = (LW - W) / 2, dy = (LD - D) / 2;
      pushShell(await shell(W, D, H, 'open'), T('Коробка: ', 'Box: '));
      const lid = await shell(LW, LD, lh, 'open'); const top = lid.parts[0];
      if (o.deco === 'window') { const wn = boolOp(top.items[0].paths, [rectPts(LW * .25, LD * .25, LW * .5, LD * .5, 4)], 'diff'); top.items[0].paths = wn; lid.asm[0].paths = wn; bom.push(T('Окошко в крышке: вклейте снизу прозрачный пластик.', 'Lid window: glue clear plastic underneath.')) }
      else { const d = await decoOn(LW, LD, o.deco); const lt = mapPaths(d.L, (x, y) => [x, LD - y]), ft = mapPaths(d.F, (x, y) => [LW - x, y]); if (lt.length) top.items.push(eng(lt)); if (ft.length) top.items.push(engF(mapPaths(ft, (x, y) => [LW - x, y]))) }
      pushShell(lid, T('Крышка: ', 'Lid: '), a => ({ origin: [a.origin[0] - dx, (LD - a.origin[1]) - dy, H + t + 1 - a.origin[2]], u: [a.u[0], -a.u[1], -a.u[2]], v: [a.v[0], -a.v[1], -a.v[2]], n: [a.n[0], -a.n[1], -a.n[2]] }), hslHex(350, 45, 55));
      divsInside(W, D, H);
      const tag = boolOp([[[0, 0], [40, 0], [40, 22], [8, 22], [0, 11]]], [circlePts(6, 11, 2, 16)], 'diff'), tt = String(o.text || '').trim() ? await textAt(o.text, 'serif', 4.5, 24, 11) : [];
      add(T('Бирка', 'Gift tag'), [cut(tag), ...(tt.length ? [engF(tt)] : [])]);
      steps.push(T('Соберите коробку и крышку на шипах (крышка — дном вверх). Крышка надевается сверху с зазором 0,4 мм.', 'Assemble the box and the lid (lid upside down). The lid slips over with 0.4 mm clearance.'));
      info = T(`Коробка ${W}×${D}×${H} мм, крышка ${fx(LW, 1)}×${fx(LD, 1)}×${lh} мм`, `Box ${W}×${D}×${H} mm, lid ${fx(LW, 1)}×${fx(LD, 1)}×${lh} mm`);
    }
    else if (tpl === 'hinged') {
      const W = o.W, D = o.D, H = o.H;
      pushShell(await shell(W, D, H, 'open'), T('Шкатулка: ', 'Casket: '));
      // lid with a locating lip, and a flexible hinge strip glued on the back wall and the lid
      const lid = [rectPts(0, 0, W, D, 2)], lip = [rectPts(t + .4, t + .4, W - 2 * t - .8, D - 2 * t - .8, 1)], d = await decoOn(W, D, o.deco);
      const lidItems = [cut(o.deco === 'window' ? boolOp(lid, [rectPts(W * .25, D * .3, W * .5, D * .4, 4)], 'diff') : lid)]; if (d.L.length) lidItems.push(eng(d.L)); if (d.F.length) lidItems.push(engF(d.F));
      add(T('Крышка', 'Lid'), lidItems, XY(0, 0, H + .5), hslHex(28, 45, 50));
      add(T('Крышка: вкладыш-фиксатор', 'Lid: locating plate'), [cut(o.deco === 'window' ? boolOp(lip, [rectPts(W * .25, D * .3, W * .5, D * .4, 4)], 'diff') : lip)], XY(0, 0, H - t + .5), hslHex(28, 35, 45));
      const hw = W * .7, bendL = Math.PI / 2 * (t * 1.5) + 2, a1 = H * .45, a2 = D * .3, HL = a1 + bendL + a2, strip = [rectPts(0, 0, HL, hw, 2)], cuts = flexCuts(a1, a1 + bendL, hw, Math.max(1, t * .45)).map(l => l.map(([x, y]) => [x, y]));
      add(T('Гибкая петля', 'Flex hinge'), [cut(strip), cutL(cuts)]);
      steps.push(T('Гибкую петлю приклейте одним концом к задней стенке снаружи, другим — к верху крышки; гибкая часть ложится на ребро.', 'Glue one end of the flex hinge to the outside of the back wall and the other to the top of the lid; the flexible part wraps the edge.'));
      bom.push(T('Петля режется прорезями — используйте фанеру 3 мм или тоньше, волокна поперёк прорезей.', 'The hinge is a cut pattern — use 3 mm plywood or thinner, grain across the cuts.'));
      divsInside(W, D, H);
      info = T(`Шкатулка ${W}×${D}×${H} мм`, `Casket ${W}×${D}×${H} mm`);
    }
    else if (tpl === 'drawers') {
      const W = o.W, D = o.D, H = o.H, n = clamp(o.n | 0, 1, 8), car = await shell(W, H, D, 'open'); // carcass lying on its back: open "top" = front
      pushShell(car, T('Корпус: ', 'Carcass: '), a => ({ origin: [a.origin[0], D - a.origin[2], a.origin[1]], u: [a.u[0], -a.u[2], a.u[1]], v: [a.v[0], -a.v[2], a.v[1]], n: [a.n[0], -a.n[2], a.n[1]] }), hslHex(30, 35, 55));
      const iw = W - 2 * t - .8, ih = (H - 2 * t) / n - .8, id = D - t - 1.5;
      for (let i = 0; i < n; i++) {
        const z0 = t + i * (H - 2 * t) / n + .4, dr = await shell(iw, id, ih - t * .5, 'open');
        pushShell(dr, T(`Ящик ${i + 1}: `, `Drawer ${i + 1}: `), a => ({ origin: [a.origin[0] + t + .4, a.origin[1] + t * 2, a.origin[2] + z0] }), hslHex(28, 30, 65));
        const fh = (H - 2 * t) / n - .6, front = boolOp([rectPts(0, 0, W - 2 * t - .4, fh, 1.2)], [circlePts((W - 2 * t) / 2, fh / 2, Math.max(2, Math.min(5, fh * .12)), 24)], 'diff');
        add(T(`Ящик ${i + 1}: лицевая панель`, `Drawer ${i + 1}: front`), [cut(front), eng([rectPts(3, 3, W - 2 * t - 6.4, fh - 6, 1).concat([[3, 3]])])], XZ(t + .2, t, z0 - .1), hslHex(28, 40, 48));
      }
      steps.push(T('Корпус собирается на шипах открытой стороной вперёд. Каждый ящик — коробка без крышки; лицевая панель приклеивается к передней стенке ящика, отверстие — под ручку или палец.', 'The carcass is finger-jointed with the open side to the front. Each drawer is an open box; glue the front panel onto its front wall; the hole takes a knob or a finger.'));
      info = T(`Комод ${W}×${D}×${H} мм, ящиков ${n}`, `Chest ${W}×${D}×${H} mm, ${n} drawers`);
    }
    else if (tpl === 'hex' || tpl === 'heart') {
      const S = o.S, H = o.H; let shape;
      if (tpl === 'hex') shape = polyPts(0, 0, S / 2, 6).map(([x, y]) => [x + S / 2, y + S / 2]);
      else { const hp = heartPoly(S / 34); const b = bboxOf([hp]); shape = offsetPaths(offsetPaths([hp.map(([x, y]) => [x - b[0], y - b[1]])], -S * .06), S * .06)[0] }
      if (area(shape) < 0) shape = shape.slice().reverse();
      const rim = Math.max(4, t * 1.6), mid = offsetPaths([shape], t / 2)[0], outer = offsetPaths([shape], t + rim)[0], tw = Math.max(t * 2.5, 6);
      const lp = alongLoop(mid, []), nT = Math.max(6, Math.round(lp.total / 28)), ss = Array.from({ length: nT }, (_, i) => lp.total * (i + .5) / nT), at = alongLoop(mid, ss).at;
      const slots = at.map(q => orientRect(q.p, q.d, tw + clr, t + clr));
      const bottom = boolOp([outer], slots, 'diff'), ring = boolOp([outer], [offsetPaths([shape], -.01)[0], ...slots], 'diff');
      add(T('Дно', 'Bottom'), [cut(bottom)], XY(-t - rim, -t - rim, 0), hslHex(30, 30, 55));
      add(T('Верхнее кольцо', 'Top ring'), [cut(boolOp([outer], [shape], 'diff'))], XY(-t - rim, -t - rim, H + t), hslHex(30, 30, 58));
      // band: length of the mid loop, tabs top and bottom at the slot positions, flex cuts everywhere except straight runs
      const L = lp.total, bandH = H, tabs = []; for (const s of ss) tabs.push(rectPts(s - tw / 2, -t, tw, t + .01), rectPts(s - tw / 2, bandH - .01, tw, t + .01));
      let band = boolOp([rectPts(0, 0, L + 8, bandH)], tabs, 'union'); const flexZ = [];
      { let acc = 0; for (let i = 0; i < mid.length; i++) { const a = mid[i], b = mid[(i + 1) % mid.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 18) flexZ.push([acc - 4, acc + l + 4]); else flexZ.push([acc - 6, acc + 6]); acc += l } }
      const zones = []; for (const z of flexZ.sort((a, b) => a[0] - b[0])) { const last = zones[zones.length - 1]; if (last && z[0] <= last[1]) last[1] = Math.max(last[1], z[1]); else zones.push([Math.max(0, z[0]), Math.min(L, z[1])]) }
      const avoid = ss.map(s => [s - tw / 2 - 1, s + tw / 2 + 1]), cuts = zones.flatMap(z => flexCuts(z[0], z[1], bandH, Math.max(1, t * .45), avoid));
      bom.push(T('Последние 8 мм стенки — нахлёст для склейки стыка.', 'The last 8 mm of the band overlap to glue the seam.'));
      add(T('Гнутая стенка', 'Bent wall'), [cut(band), cutL(cuts)]);
      const lidP = [offsetPaths([shape], t + rim * .5)[0]], lipP = [offsetPaths([shape], -.4)[0]], d = await decoOn(S, S, o.deco === 'window' ? 'none' : o.deco, tpl === 'heart' ? S * .5 : S * .3), lidItems = [cut(o.deco === 'window' ? boolOp(lidP, offsetPaths([shape], -S * .18), 'diff') : lidP)];
      const dl = mapPaths(d.L, (x, y) => [x, y]).filter(p => p.length), dF = d.F; if (dl.length) lidItems.push(eng(clipOpen(dl, offsetPaths([shape], -2), true))); if (dF.length) lidItems.push(engF(clipShapes(dF, offsetPaths([shape], -2))));
      add(T('Крышка', 'Lid'), lidItems, XY(0, 0, H + 2 * t + 1), hslHex(350, 40, 55)); add(T('Крышка: фиксатор', 'Lid: locating plate'), [cut(lipP)], XY(0, 0, H + t + 1), hslHex(350, 30, 48));
      // a few band panels for the 3D view (approximation of the bent wall)
      for (let i = 0; i < mid.length; i += Math.max(1, Math.round(mid.length / 48))) { const a = mid[i], b = mid[(i + Math.max(1, Math.round(mid.length / 48))) % mid.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < .5) continue; const u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l, 0]; asm.push({ paths: [rectPts(0, 0, l, H)], origin: [a[0] + u[1] * t / 2, a[1] - u[0] * t / 2, t], u, v: [0, 0, 1], n: [-u[1], u[0], 0], t, color: hslHex(30, 35, 62) }) }
      steps.push(T('Вставьте язычки гнутой стенки в пазы дна, огибая контур (гибкие зоны — на углах), стык склейте внахлёст. Сверху наденьте кольцо, крышку положите сверху (фиксатор снизу).', 'Push the band tabs into the bottom slots following the outline (flex zones at the corners), glue the overlapping seam. Put the ring on top and lay the lid on (locating plate underneath).'));
      info = T(`${tpl === 'hex' ? 'Шестигранная' : 'Сердце'} ${S} мм, высота ${H} мм, длина стенки ${fx(L, 0)} мм`, `${tpl === 'hex' ? 'Hexagon' : 'Heart'} ${S} mm, height ${H} mm, band ${fx(L, 0)} mm`);
    }
    else if (tpl === 'organizer') {
      const secs = String(o.sections || '').split(/[,;\n]+/).map(s => { const m = /^\s*([a-zа-я]+)\s*:\s*([\d.]+)\s*[x×х*]\s*([\d.]+)/i.exec(s); return m ? { k: m[1].toLowerCase(), w: +m[2], h: +m[3] } : null }).filter(Boolean);
      if (!secs.length) throw new Error(T('Опишите секции: например «pen:45x110, niche:60x80, tray:70x35».', 'Describe the sections, e.g. “pen:45x110, niche:60x80, tray:70x35”.'));
      const D = o.D, tw = Math.max(t * 2.5, 6), e = t * 1.5, W = secs.reduce((a, s) => a + s.w, 0) + (secs.length + 1) * t;
      const xs = [0]; for (const s of secs) xs.push(xs[xs.length - 1] + t + s.w); // divider positions (left faces)
      const fH = s => s.k === 'tray' || s.k === 'niche' ? s.h : Math.min(s.h, Math.max(22, s.h * .45)); // front-wall height of a section
      const nb = i => [secs[i - 1], secs[i]].filter(Boolean), hB = i => Math.max(...nb(i).map(s => s.h)), hF = i => Math.max(...nb(i).map(fH));
      const slot = (x, y, w, h) => rectPts(x - clr / 2, y - clr / 2, w + clr, h + clr);
      // base
      const bslots = []; xs.forEach(x => { for (const fy of [.25, .75]) bslots.push(slot(e + x, e + D * fy - tw / 2, t, tw)) }); for (const back of [0, 1]) secs.forEach((s, i) => bslots.push(slot(e + xs[i] + t + s.w / 2 - tw / 2, back ? e + D - t : e, tw, t)));
      add(T('Основание', 'Base'), [cut(boolOp([rectPts(0, 0, W + 2 * e, D + 2 * e, 3)], bslots, 'diff'))], XY(-e, -e, 0), hslHex(30, 25, 50));
      // front and back walls: stepped silhouette (front lower), niches cut in the front
      for (const back of [0, 1]) {
        const sil = secs.map((s, i) => [rectPts(i ? e + xs[i] : 0, 0, (i ? 0 : e) + s.w + 2 * t + (i === secs.length - 1 ? e : 0), back ? s.h : fH(s))]);
        let pnl = union(sil); const holes = [], tabs = [];
        secs.forEach((s, i) => tabs.push(rectPts(e + xs[i] + t + s.w / 2 - tw / 2, -t, tw, t + .01)));
        xs.forEach((x, i) => { const h = back ? hB(i) : hF(i); for (const fz of [.3, .7]) if (h * fz > tw * .8 && h * (1 - fz) > tw * .8) holes.push(slot(e + x, h * fz - tw / 2, t, tw)) });
        if (!back) secs.forEach((s, i) => { if (s.k === 'niche') holes.push(...outline('arch', e + xs[i] + t + s.w * .15, s.h * .12, s.w * .7, s.h * .55)) });
        pnl = boolOp(boolOp(pnl, tabs, 'union'), holes, 'diff');
        add(back ? T('Задняя стенка', 'Back wall') : T('Передняя стенка', 'Front wall'), [cut(pnl)], XZ(-e, back ? D - t : 0, t), hslHex(30, 35, back ? 55 : 60));
      }
      // dividers and outer sides: sloped top from the front height to the back height
      xs.forEach((x, i) => {
        const hb = hB(i), hf = hF(i), dd = D - 2 * t; let pnl = [[[0, 0], [dd, 0], [dd, hb], [0, hf]]]; const tabs = [], holes = [];
        for (const fy of [.25, .75]) tabs.push(rectPts(D * fy - t - tw / 2, -t, tw, t + .01));
        for (const fz of [.3, .7]) { if (hf * fz > tw * .8 && hf * (1 - fz) > tw * .8) tabs.push(rectPts(-t, hf * fz - tw / 2, t + .01, tw)); if (hb * fz > tw * .8 && hb * (1 - fz) > tw * .8) tabs.push(rectPts(dd - .01, hb * fz - tw / 2, t + .01, tw)) }
        for (const sd of [i - 1, i]) { const s = secs[sd]; if (s && s.k === 'shelf') holes.push(slot(D * .2 - t, s.h * .5, dd * .6, t)) }
        pnl = boolOp(boolOp(pnl, tabs, 'union'), holes, 'diff');
        add(i === 0 || i === secs.length ? T('Боковина', 'Side') : T('Перегородка', 'Divider'), [cut(pnl)], { origin: [x, t, t], u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0] }, hslHex(30, 30, 66));
      });
      secs.forEach((s, i) => { if (s.k === 'shelf') { const sh = boolOp([rectPts(0, D * .2 - t, s.w, (D - 2 * t) * .6)], [rectPts(-t, D * .2 - t, t + .01, (D - 2 * t) * .6), rectPts(s.w - .01, D * .2 - t, t + .01, (D - 2 * t) * .6)], 'union'); add(T('Полка', 'Shelf'), [cut(sh)], XY(xs[i] + t, t, t + s.h * .5), hslHex(30, 30, 58)); bom.push(T('Полка шире паза на толщину язычков: заводите её наискосок.', 'The shelf is wider than the gap by its tabs: slide it in at an angle.')) } });
      steps.push(T('Вставьте боковины и перегородки в основание, затем наденьте переднюю и заднюю стенки на их язычки. Полки вставьте в пазы перегородок до установки второй стенки.', 'Put the sides and dividers into the base, then fit the front and back walls over their tabs. Slide the shelves into the divider slots before the second wall.'));
      bom.push(T('Типы секций: pen — стакан для ручек, niche — ниша (арка в передней стенке), shelf — секция с полкой, tray — низкий лоток.', 'Section types: pen — pen cup, niche — niche (arch in the front wall), shelf — section with a shelf, tray — low tray.'));
      info = T(`Органайзер ${fx(W, 0)}×${D} мм, секций ${secs.length}`, `Organiser ${fx(W, 0)}×${D} mm, ${secs.length} sections`);
    }
    else if (tpl === 'pencil') {
      const W = o.W, D = o.D, H = o.H, b = Math.max(6, t * 2.2), lip = Math.max(2.5, t), nMid = Math.max(1, Math.round((H - 3 * t) / t)), plates = [];
      plates.push([T('Дно', 'Bottom'), [rectPts(0, 0, W, D, 3)]]);
      for (let i = 0; i < nMid; i++) plates.push([T('Рамка', 'Frame') + ' ' + (i + 1), boolOp([rectPts(0, 0, W, D, 3)], [rectPts(b, b, W - 2 * b, D - 2 * b, 2)], 'diff')]);
      plates.push([T('Рамка с пазом крышки', 'Lid channel frame'), boolOp([rectPts(0, 0, W, D, 3)], [rectPts(b - lip, b - lip, W - b - (b - lip) + 1, D - 2 * (b - lip))], 'diff')]); // open at the right end
      plates.push([T('Верхняя рамка', 'Top frame'), boolOp([rectPts(0, 0, W, D, 3)], [rectPts(b, b, W - b + 1, D - 2 * b)], 'diff')]);
      plates.forEach(([nm, p], i) => add(nm, [cut(p)], XY(0, 0, i * t), hslHex(30, 30, 52 + (i % 2) * 6)));
      const lidW = W - (b - lip) - .3, lidD = D - 2 * (b - lip) - .4, lid = boolOp([rectPts(0, 0, lidW, lidD)], [rectPts(lidW - 9, lidD / 2 - 6, 4, 12, 2)], 'diff'), tt = String(o.text || '').trim() ? await textAt(o.text, 'serif', Math.min(lidD * .35, 10), lidW / 2, lidD / 2) : [];
      add(T('Выдвижная крышка', 'Sliding lid'), [cut(lid), ...(tt.length ? [engF(tt)] : [])], XY(b - lip, b - lip, (plates.length - 2) * t + .2), hslHex(28, 45, 48));
      steps.push(T('Склейте слои по порядку: дно, рамки, рамка с пазом, верхняя рамка — открытые концы паза в одну сторону. Крышка вдвигается в паз с открытого торца.', 'Glue the layers in order: bottom, frames, channel frame, top frame — the open channel ends on the same side. The lid slides into the channel from the open end.'));
      info = T(`Пенал ${W}×${D}×${fx(plates.length * t, 1)} мм, ${plates.length} слоёв`, `Pencil case ${W}×${D}×${fx(plates.length * t, 1)} mm, ${plates.length} layers`);
    }
    else if (tpl === 'book') {
      const W = o.W, Hh = o.D, T2 = o.H, spine = T2 + .5, bendL = spine + Math.PI * t * .5, nFr = Math.max(1, Math.round((T2 - 2 * t) / t)), b = Math.max(8, W * .1);
      const total = W * 2 + bendL, cover = [rectPts(0, 0, total, Hh, 3)], cuts = [...flexCuts(W - 1, W + bendL + 1, Hh, Math.max(1, t * .45))];
      const d = await decoOn(W - 10, Hh - 10, o.deco === 'window' ? 'none' : o.deco), dl = mapPaths(d.L, (x, y) => [W + bendL + 5 + x, 5 + y]), df = mapPaths(d.F, (x, y) => [W + bendL + 5 + x, 5 + y]);
      const items = [cut(cover), cutL(cuts), eng([rectPts(W + bendL + 4, 4, W - 8, Hh - 8, 2).concat([[W + bendL + 6, 4]])])]; if (dl.length) items.push(eng(dl)); if (df.length) items.push(engF(df));
      add(T('Обложка с гибким корешком', 'Cover with flexible spine'), items);
      for (let i = 0; i < nFr; i++) add(T('Страницы-рамка', 'Pages frame') + ' ' + (i + 1), [cut(boolOp([rectPts(0, 0, W - 3, Hh - 6, 1)], [rectPts(b, b, W - 3 - 2 * b, Hh - 6 - 2 * b, 3)], 'diff')), eng([[[W - 3.5, 1], [W - 3.5, Hh - 7]]])], XY(0, 3, t + i * t), hslHex(45, 30, 85));
      asm.push({ paths: [rectPts(0, 0, W, Hh, 3)], origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], t, color: hslHex(10, 45, 35) }, { paths: [rectPts(0, 0, W, Hh, 3)], origin: [0, 0, T2 - t], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], t, color: hslHex(10, 45, 35) });
      steps.push(T('Склейте стопку рамок-«страниц» и приклейте её к задней половине обложки (слева от корешка). Корешок огибает стопку, передняя обложка открывается как у книги. Для фиксации вклейте два магнита ⌀6×2 мм в угол рамок и обложки.', 'Glue the stack of page frames onto the back half of the cover (left of the spine). The spine wraps the stack and the front cover opens like a book. Two ⌀6×2 mm magnets in a corner keep it shut.'));
      info = T(`Книга ${W}×${Hh}×${T2} мм, рамок ${nFr}`, `Book ${W}×${Hh}×${T2} mm, ${nFr} frames`);
    }
    else if (tpl === 'flipbook') {
      const W = o.W, H = o.H, n = clamp(o.pages | 0, 2, 16), hw = 26, bend = Math.max(6, t * 2.5);
      for (let i = 0; i < n; i++) {
        let pg = [rectPts(0, 0, W, H, 3)]; const items = [];
        const win = i % 2 === 1 && i < n - 1 ? outline(['arch', 'circle', 'heart', 'rect'][i % 4] === 'heart' ? 'circle' : ['arch', 'circle', 'round', 'rect'][i % 4], W * .3, H * .3, W * .4, H * .4, 4) : null;
        if (win) pg = boolOp(pg, win, 'diff');
        items.push(cut(pg), eng([rectPts(4, 4, W - 8, H - 8, 2).concat([[6, 4]])]));
        const num = await textAt(String(i + 1), 'serif', Math.min(8, H * .07), W - 10, 9); if (num.length) items.push(engF(num));
        if (i === 0 && String(o.text || '').trim()) { const tt = await textAt(o.text, 'serif', Math.min(W * .1, 14), W / 2, H * .75); if (tt.length) items.push(engF(tt)) }
        add(T(`Страница ${i + 1}`, `Page ${i + 1}`), items, XY(0, 0, i * (t + .4)), hslHex(40 + i * 12, 35, 78));
        if (i % 3 === 2) { const fl = [rectPts(0, 0, W * .36, H * .3, 2)], ft = [rectPts(0, H * .3 - .01, W * .36, 8, 1)]; add(T(`Клапан для стр. ${i + 1}`, `Flap for page ${i + 1}`), [cut(boolOp(fl, ft, 'union')), cutL(flexCuts(1, W * .36 - 1, 8, 1.2).map(l => l.map(([x, y]) => [x, y + H * .3])))]) }
      }
      for (let i = 0; i < n - 1; i++) add(T('Петля-корешок', 'Spine hinge') + ' ' + (i + 1), [cut([rectPts(0, 0, hw * 2 + bend, H * .8, 2)]), cutL(flexCuts(hw, hw + bend, H * .8, Math.max(1, t * .45)))]);
      steps.push(T('Страницы соединяются гибкими петлями: приклейте петлю на обратную сторону двух соседних страниц вдоль левого края. В страницах с окошками видна следующая страница; клапаны приклейте верхней кромкой над рисунком — получится «загляни под клапан».', 'Pages join with flex hinges: glue a hinge on the back of two neighbouring pages along the left edge. Pages with windows show the next page; glue the flaps by their top edge over a picture for “lift the flap”.'));
      bom.push(T('Нарисуйте или выгравируйте на страницах свои картинки: добавьте их в CAD после раскладки.', 'Draw or engrave your own pictures on the pages: add them in CAD after nesting.'));
      info = T(`Книжка ${W}×${H} мм, ${n} страниц`, `Board book ${W}×${H} mm, ${n} pages`);
    }
    return { parts, asm, steps, bom, info };
  }
};
