'use strict';
/* ============================================================================
   SkyKerf_Studio · "Statuettes, medals & ornaments"
   Statuette on a stand, 3D statuette of two crossed plates, layered relief
   statuette, medal with a ribbon slot, award plaque (shield), Christmas
   ornament (flat or 3D), procedural snowflake, earrings and key rings.
   ============================================================================ */
const AW_KINDS = () => [['statuette', T('Статуэтка на подставке', 'Statuette on a stand')], ['cross', T('Объёмная статуэтка (2 пластины крестом)', '3D statuette (two crossed plates)')], ['relief', T('Рельефная статуэтка (слои)', 'Relief statuette (layers)')], ['medal', T('Медаль', 'Medal')], ['plaque', T('Наградная табличка-щит', 'Award plaque (shield)')], ['ornament', T('Ёлочная игрушка', 'Christmas ornament')], ['snowflake', T('Снежинка', 'Snowflake')], ['earrings', T('Серьги / подвески', 'Earrings / pendants')], ['keyring', T('Брелок', 'Key ring')]];
function snowflakePaths(R, seed, w) {
  seedRnd = 7 + (seed | 0) * 131; const br = [[[0, 0], [0, R]]], n = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) { const y = R * (.25 + .6 * (i + rnd() * .5) / n), l = R * (.18 + rnd() * .3) * (1 - y / R * .6), a = Math.PI / 4 + rnd() * .35; for (const s of [-1, 1]) br.push([[0, y], [s * l * Math.sin(a), y + l * Math.cos(a)]]) }
  if (rnd() > .4) { const y = R * (.35 + rnd() * .3), r = R * .08; br.push(FG.ell(0, y, r, r, 6).concat([[r, y]])) }
  const arm = offsetOpen(br, w / 2), all = []; for (let k = 0; k < 6; k++) all.push(arm.map(p => FG.rot(p, 0, 0, k * Math.PI / 3)));
  return union([...all, [polyPts(0, 0, R * .16, 6)]]);
}
GENS.awards = {
  icon: 'medal', name: () => T('Статуэтки, медали и украшения', 'Statuettes, medals & ornaments'), desc: () => T('Награды, фигурки на подставке, ёлочные игрушки, снежинки, серьги', 'Awards, figures on stands, ornaments, snowflakes, earrings'),
  fields: [
    { k: 'kind', t: 'sel', l: () => T('Что сделать', 'What to make'), def: () => 'statuette', opts: AW_KINDS },
    { k: 'fig', t: 'sel', l: () => T('Фигура', 'Figure'), def: () => 'star', opts: () => SILHOUETTES().concat(PERSONS().filter(p => p[0] !== 'human')), show: o => ['statuette', 'cross', 'relief', 'keyring'].includes(o.kind) },
    { k: 'shape', t: 'sel', l: () => T('Форма', 'Shape'), def: () => 'circle', opts: () => [['circle', T('круг', 'circle')], ['star', T('звезда', 'star')], ['shield', T('щит', 'shield')], ['hexagon', T('шестиугольник', 'hexagon')], ['heart', T('сердце', 'heart')], ['drop', T('капля', 'teardrop')], ['leaf', T('лист', 'leaf')]], show: o => ['medal', 'ornament', 'earrings'].includes(o.kind) },
    { k: 'H', t: 'num', l: () => T('Размер (высота)', 'Size (height)'), def: () => 120, min: 15, max: 600, u: MM, step: 5 },
    { k: 'text', t: 'area', l: () => T('Надпись', 'Text'), def: () => T('Лучшему мастеру', 'Best maker'), show: o => !['snowflake', 'earrings'].includes(o.kind) },
    { k: 'text2', t: 'area', l: () => T('Вторая строка / год', 'Second line / year'), def: () => '2026', show: o => ['statuette', 'relief', 'medal', 'plaque', 'ornament'].includes(o.kind) },
    { k: 'num', t: 'area', l: () => T('Цифра / место', 'Number / place'), def: () => '1', show: o => o.kind === 'medal' },
    { k: 'pattern', t: 'sel', l: () => T('Узор', 'Pattern'), def: () => 'stars', opts: () => [['none', T('нет', 'none')], ['stars', T('звёзды', 'stars')], ['snow', T('снежинки', 'snowflakes')], ['hearts', T('сердечки', 'hearts')], ['lace', T('кружево', 'lace')], ['flower', T('цветы', 'flowers')]], show: o => ['ornament', 'earrings'].includes(o.kind) },
    { k: 'd3', t: 'chk', l: () => T('Объёмная (две половинки крестом)', '3D (two halves crossed)'), def: () => false, show: o => o.kind === 'ornament' },
    { k: 'seed', t: 'num', l: () => T('Вариант', 'Variant'), def: () => 3, min: 1, max: 999, step: 1, show: o => o.kind === 'snowflake' },
    { k: 'qty', t: 'num', l: () => T('Количество', 'Quantity'), def: () => 1, min: 1, max: 50, step: 1 },
    ...jointFields().filter(f => f.k !== 'fw'),
  ],
  async make(o) {
    if (!hasClip()) throw new Error(T('Нужна библиотека Clipper — она не загрузилась.', 'The Clipper library did not load.'));
    const t = o.t, clr = fitValue(o), mk = markLayer(), H = o.H, parts = [], asm = [], steps = [], bom = [], q = clamp(o.qty | 0, 1, 50);
    const cut = p => ({ layer: CUT, kind: 'part', paths: p, closed: true }), eng = p => ({ layer: mk, kind: 'part', paths: p, closed: false }), engF = p => ({ layer: ENG, kind: 'part', paths: p, closed: true });
    const add = (name, items, fr, color) => { for (let i = 0; i < q; i++) parts.push({ name: q > 1 ? `${name} ${i + 1}` : name, items: i ? JSON.parse(JSON.stringify(items)) : items, req: curReq(t) }); if (fr) asm.push(Object.assign({ t, color: color || hslHex(40, 50, 55), paths: items[0].paths }, fr)) };
    const XY = (x, y, z) => ({ origin: [x, y, z], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] }), XZ = (x, y, z) => ({ origin: [x, y, z], u: [1, 0, 0], v: [0, 0, 1], n: [0, 1, 0] }), YZ = (x, y, z) => ({ origin: [x, y, z], u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0] });
    const txt = async (s, size, x, y, font = 'serif') => String(s || '').trim() ? await textAt(String(s).trim(), font, size, x, y) : [];
    const figOf = k => PERSONS().some(p => p[0] === k) ? personFigure(k) : silhouette(k);
    const shapeOf = (k, w, h) => { const b = (p) => { const bb = bboxOf([p]); return p.map(([x, y]) => [(x - bb[0]) / (bb[2] - bb[0]) * w, (y - bb[1]) / (bb[3] - bb[1]) * h]) }; switch (k) { case 'star': return b(silhouette('star').cut[0]); case 'shield': return outline('shield', 0, 0, w, h)[0]; case 'hexagon': return b(polyPts(0, 0, 1, 6)); case 'heart': return b(heartPoly(1)); case 'drop': { const a0 = Math.asin(1 / 2.4); return b(arcPts(0, 0, 1, Math.PI - a0, 2 * Math.PI + a0, .03).concat([[0, 2.4]])) } case 'leaf': { const d = .6, a = Math.atan2(1, d), R = Math.hypot(1, d); return b(arcPts(-d, 0, R, -a, a, .03).concat(arcPts(d, 0, R, Math.PI - a, Math.PI + a, .03))) } default: return ellipsePts(w / 2, h / 2, w / 2, h / 2, 96) } };
    const patternIn = (region, kind, s) => { if (kind === 'none') return []; const b = bboxOf(region), out = []; if (kind === 'lace') { for (let y = b[1]; y < b[3] + s; y += s * .9) for (let x = b[0] + ((y / s | 0) % 2) * s / 2; x < b[2] + s; x += s) out.push(FG.ell(x, y, s * .32, s * .32, 16)) } else for (let y = b[1] + s * .8; y < b[3]; y += s * 1.7) for (let x = b[0] + s * (((y / s) | 0) % 2 ? 1.6 : .8); x < b[2]; x += s * 1.8) { const m = kind === 'stars' ? 'star' : kind === 'snow' ? 'snow' : kind === 'hearts' ? 'heart' : 'flower'; out.push(...motif(m, x, y, s * .9)) } return clipShapes(out, region).filter(p => polyArea(p) > s * s * .05) };
    let info = '';
    if (o.kind === 'statuette' || o.kind === 'relief' || o.kind === 'cross') {
      const f = placeFigure(figOf(o.fig), H, 0, 0); { const foot = boolOp(f.cut, [rectPts(-1e4, -1, 2e4, H * .05 + 1)], 'inter'), fbb = foot.length ? bboxOf(foot) : null; if (fbb) f.cut = boolOp(f.cut, [rectPts(fbb[0], 0, fbb[2] - fbb[0], Math.max(2.5, H * .035), 1)], 'union') } // feet joined by a ground bar so the tab always has material
      const tw = clamp(f.w * .3, 8, 30), tabs = o.kind === 'cross' ? [-f.w * .22, f.w * .22] : [0];
      const fb = bboxOf(f.cut), bw = Math.max(f.w * (o.kind === 'cross' ? 1 : .95), 50), bd = o.kind === 'cross' ? bw : Math.max(32, Math.min(70, H * .3));
      const tabRects = tabs.map(x => rectPts(x - tw / 2, -t, tw, t + .5));
      if (o.kind === 'relief') {
        const layers = [f.cut, offsetPaths(f.cut, -Math.max(1.5, H * .02)), offsetPaths(f.cut, -Math.max(3, H * .045))].filter(p => p.length);
        layers.forEach((p, i) => { const pp = i ? p : boolOp(p, tabRects, 'union'), items = [cut(pp)]; if (i === layers.length - 1) { if (f.lines.length) items.push(eng(clipOpen(f.lines, p, true))); if (f.fills.length) items.push(engF(f.fills)) } add(T(`Фигура: слой ${i + 1}`, `Figure: layer ${i + 1}`), items, XZ(0, bd / 2 - t / 2 - i * t, 2 * t), hslHex(40, 50, 60 - i * 8)) });
      } else if (o.kind === 'cross') {
        const mid = (fb[1] + fb[3]) / 2, w = t + clr, A = boolOp(boolOp(f.cut, tabRects, 'union'), [rectPts(-w / 2, mid, w, fb[3] - mid + 1)], 'diff'), B = boolOp(boolOp(f.cut, tabRects, 'union'), [rectPts(-w / 2, -t - 1, w, mid + t + 1)], 'diff');
        const ia = [cut(A)], ib = [cut(B)]; if (f.lines.length) { ia.push(eng(f.lines)); ib.push(eng(f.lines)) }
        add(T('Фигура A (паз сверху)', 'Figure A (slot from the top)'), ia, XZ(0, -t / 2, 2 * t), hslHex(45, 55, 58)); add(T('Фигура B (паз снизу)', 'Figure B (slot from the bottom)'), ib, YZ(-t / 2, 0, 2 * t), hslHex(45, 55, 50));
        steps.push(T('Наденьте фигуру A пазом сверху на фигуру B (паз снизу) крест-накрест.', 'Slide figure A (slot from the top) onto figure B (slot from the bottom), crosswise.'));
      } else { const items = [cut(boolOp(f.cut, tabRects, 'union'))]; if (f.lines.length) items.push(eng(f.lines)); if (f.fills.length) items.push(engF(f.fills)); add(T('Фигура', 'Figure'), items, XZ(0, -t / 2, 2 * t), hslHex(45, 55, 58)) }
      // stand: bottom plate + top plate with slots, text engraved on the top plate
      const cx = 0, plate = o.kind === 'cross' ? [rectPts(-bw / 2, -bw / 2, bw, bw, 4)] : [rectPts(-bw / 2, -bd / 2, bw, bd, 4)];
      const slots = o.kind === 'cross' ? tabs.flatMap(x => [rectPts(x - tw / 2 - clr / 2, -t / 2 - clr / 2, tw + clr, t + clr), rectPts(-t / 2 - clr / 2, x - tw / 2 - clr / 2, t + clr, tw + clr)]) : tabs.map(x => rectPts(x - tw / 2 - clr / 2, (o.kind === 'relief' ? -t : 0) - t / 2 - clr / 2, tw + clr, (o.kind === 'relief' ? 3 * t : t) + clr));
      const top = boolOp(plate, slots, 'diff'), tt = await txt(o.text, Math.min(bw * .08, 7), 0, o.kind === 'cross' ? -bw * .38 : -bd * .3), t2 = await txt(o.text2, Math.min(bw * .06, 5), 0, o.kind === 'cross' ? bw * .38 : -bd * .3 - Math.min(bw * .08, 7) * 1.4);
      add(T('Подставка: верх', 'Stand: top'), [cut(top), ...(tt.length || t2.length ? [engF(tt.concat(t2))] : []), eng([offsetPaths(plate, -2)[0].concat([offsetPaths(plate, -2)[0][0]])])], XY(0, 0, t), hslHex(25, 40, 35));
      add(T('Подставка: низ', 'Stand: bottom'), [cut(offsetPaths(plate, 2))], XY(0, 0, 0), hslHex(25, 40, 28));
      steps.push(T('Склейте две пластины подставки, вставьте язычки фигуры в пазы верхней пластины до упора в нижнюю.', 'Glue the two stand plates, push the figure tabs into the top plate slots down to the bottom plate.'));
      info = T(`Высота ${H} мм, подставка ${fx(bw, 0)}×${fx(bd, 0)} мм`, `Height ${H} mm, stand ${fx(bw, 0)}×${fx(bd, 0)} mm`);
    }
    else if (o.kind === 'medal') {
      const D = H, sh = shapeOf(o.shape, D, D), ring = Math.max(3, D * .09), ear = o.shape === 'circle' || o.shape === 'hexagon' ? boolOp([rectPts(D / 2 - D * .18, D - 2, D * .36, D * .16 + 2, 3)], [rectPts(D / 2 - D * .12, D + D * .03, D * .24, Math.max(2.5, t + .5), 1)], 'diff') : [];
      let disc = union([[sh], ear].filter(x => x.length)); if (!ear.length) disc = boolOp(disc, [rectPts(D / 2 - D * .12, D * .82, D * .24, Math.max(2.5, t + .5), 1)], 'diff');
      const inner = offsetPaths([sh], -ring), wreath = [];
      for (const s of [-1, 1]) for (let i = 0; i < 7; i++) { const a = Math.PI * (.7 + i * .085), R = D / 2 - ring * 1.9, x = D / 2 + s * -R * Math.cos(a), y = D / 2 + R * Math.sin(a); wreath.push(FG.rot(FG.ell(x, y, D * .02, D * .042, 14), x, y, s > 0 ? Math.PI - a : a)) }
      const items = [cut(disc), eng([offsetPaths([sh], -ring * .5)[0].concat([offsetPaths([sh], -ring * .5)[0][0]])])], nn = await txt(o.num, D * .32, D / 2, D * .5, 'unb'), t1 = await txt(o.text, D * .07, D / 2, D * .24), t2 = await txt(o.text2, D * .07, D / 2, D * .76);
      const fills = clipShapes(wreath, inner).concat(nn, t1, t2); if (fills.length) items.push(engF(fills));
      add(T('Медаль', 'Medal'), items, XY(0, 0, 0), hslHex(45, 70, 55));
      add(T('Медаль: накладное кольцо', 'Medal: overlay ring'), [cut(boolOp([sh], inner, 'diff'))], XY(0, 0, t), hslHex(45, 60, 45));
      bom.push(T(`Лента шириной до ${fx(D * .24, 0)} мм продевается в прорезь.`, `A ribbon up to ${fx(D * .24, 0)} mm wide goes through the slot.`), T('Для «золота» — покрасьте или используйте зеркальный акрил (лазер CO2).', 'For “gold” paint it or use mirror acrylic (CO2 laser).'));
      info = T(`Медаль ⌀${D} мм`, `Medal ⌀${D} mm`);
    }
    else if (o.kind === 'plaque') {
      const W = H * .8, sh = outline('shield', 0, 0, W, H)[0], inner = offsetPaths([sh], -W * .06);
      const lines = [inner[0].concat([inner[0][0]])], t1 = await txt(o.text, W * .09, W / 2, H * .62), t2 = await txt(o.text2, W * .07, W / 2, H * .45), st = motif('star', W / 2, H * .8, W * .12);
      add(T('Табличка', 'Plaque'), [cut(boolOp([sh], [circlePts(W / 2, H * .92, 2.2, 16)], 'diff')), eng(lines), engF(t1.concat(t2, st))], XZ(0, 0, 0), hslHex(28, 45, 45));
      const sth = H * .55, stand = [[0, 0], [sth * .55, 0], [sth * .55, 4], [6 + t, sth * .9], [6 + t, sth], [6, sth], [6, sth * .9], [0, 4]];
      add(T('Подставка', 'Stand'), [cut([stand])]);
      info = T(`Щит ${fx(W, 0)}×${H} мм`, `Shield ${fx(W, 0)}×${H} mm`);
    }
    else if (o.kind === 'ornament') {
      const D = H, sh = shapeOf(o.shape, D, D), cap = rectPts(D / 2 - D * .12, D - 3, D * .24, D * .12 + 3, 2), hole = circlePts(D / 2, D + D * .05, Math.max(1.6, D * .035), 20);
      let body = boolOp(union([[sh], [cap]]), [hole], 'diff'); const reg = offsetPaths([sh], -Math.max(3, D * .1)), pat = patternIn(reg, o.pattern, D * .12);
      if (pat.length) body = boolOp(body, pat, 'diff');
      const items = [cut(body)], t1 = await txt(o.text, D * .08, D / 2, D * .2), t2 = await txt(o.text2, D * .07, D / 2, D * .1); if (t1.length || t2.length) items.push(engF(t1.concat(t2)));
      if (o.d3) { const w = t + clr, mid = D / 2, A = boolOp(body, [rectPts(D / 2 - w / 2, mid, w, D * .7)], 'diff'), B = boolOp(boolOp([sh], pat, 'diff'), [rectPts(D / 2 - w / 2, -1, w, mid + 1)], 'diff'); add(T('Половинка A', 'Half A'), [cut(A)], XZ(0, 0, 0)); add(T('Половинка B', 'Half B'), [cut(B)], { origin: [D / 2 - t / 2 + t / 2, -D / 2, 0], u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0] }); steps.push(T('Наденьте половинки друг на друга пазами крест-накрест.', 'Slide the halves together crosswise by their slots.')) }
      else add(T('Ёлочная игрушка', 'Ornament'), items, XZ(0, 0, 0), hslHex(0, 60, 50));
      info = T(`Игрушка ${D} мм`, `Ornament ${D} mm`);
    }
    else if (o.kind === 'snowflake') { const R = H / 2, sf = snowflakePaths(R, o.seed, Math.max(1.6, t * .9, R * .07)), hr = Math.max(1.2, R * .04), hole = circlePts(0, R * .82, hr, 16); add(T('Снежинка', 'Snowflake'), [cut(boolOp(union([sf, [circlePts(0, R * .82, hr * 2.3, 24)]]), [hole], 'diff'))], XY(0, 0, 0), hslHex(205, 40, 80)); info = T(`Снежинка ⌀${H} мм, вариант ${o.seed}`, `Snowflake ⌀${H} mm, variant ${o.seed}`) }
    else if (o.kind === 'earrings') {
      const h = H, w = h * .62, sh = shapeOf(o.shape, w, h), reg = offsetPaths([sh], -Math.max(1.2, w * .1)), pat = patternIn(reg, o.pattern === 'none' ? 'lace' : o.pattern, w * .2);
      let e1 = boolOp([sh], [...pat, circlePts(w / 2, h - Math.max(1.8, w * .08), Math.max(.7, w * .035), 14)], 'diff');
      for (let i = 0; i < 2; i++) add(T('Серьга', 'Earring'), [cut(e1)], XY(i * (w + 6), 0, 0), hslHex(330, 40, 60));
      bom.push(T('Для серёжек: швензы и колечки 4–6 мм. Тонкий материал (1,5–2 мм) — серьги легче.', 'For earrings: hooks and 4–6 mm jump rings. Thin stock (1.5–2 mm) keeps them light.'));
      info = T(`Пара ${fx(w, 0)}×${h} мм`, `Pair ${fx(w, 0)}×${h} mm`);
    }
    else if (o.kind === 'keyring') {
      const f = placeFigure(figOf(o.fig), H, 0, 0), rr = Math.max(4, H * .09);
      // the ring sits on the highest point of the figure and overlaps it, so it is one piece with a hole
      let tp = null; for (const q of f.cut) for (const p of q) if (!tp || p[1] > tp[1]) tp = p;
      const rc = [tp[0], tp[1] + rr * .75], hole = circlePts(rc[0], rc[1], rr * .55, 20);
      let body = union([f.cut, [circlePts(rc[0], rc[1], rr * 1.4, 32)]]); body = boolOp(body, [hole], 'diff'); const items = [cut(body)]; if (f.lines.length) items.push(eng(f.lines));
      // the text must stay inside the figure with a margin; it shrinks to fit, or is left out with a note
      const inner = offsetPaths(f.cut, -Math.max(1.5, t * .6)), b = bboxOf(f.cut); let tt = [];
      if (String(o.text || '').trim() && inner.length) for (let sz = Math.min(H * .12, 6); sz >= 2.5 && !tt.length; sz *= .85) { const cand = await txt(o.text, sz, (b[0] + b[2]) / 2, b[1] + (b[3] - b[1]) * .38, 'unb'); if (cand.length && cand.every(q => q.every(p => inPolys(p, inner)))) tt = cand }
      if (String(o.text || '').trim() && !tt.length) bom.push(T('Надпись не помещается внутри фигуры — она не добавлена. Сократите текст или увеличьте размер.', 'The text does not fit inside the figure, so it was left out. Shorten it or make the key ring larger.'));
      if (tt.length || f.fills.length) items.push(engF(tt.concat(f.fills)));
      add(T('Брелок', 'Key ring'), items, XY(0, 0, 0), hslHex(200, 45, 55)); info = T(`Брелок ${H} мм`, `Key ring ${H} mm`);
    }
    return { parts, asm, steps, bom, info: info + (q > 1 ? ` × ${q}` : '') };
  }
};
