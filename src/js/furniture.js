'use strict';
/* ============================================================================
   SkyKerf_Studio · doll furniture
   Flat-pack furniture on tabs and slots at doll scale (1:6 … 1:48): tables,
   chairs, stools, beds, wardrobes, cabinets, sofas, bookcases, benches,
   a throne and a chest — singly or as room sets (bedroom, kitchen, living
   room, castle hall). Every item is built at real size / scale.
   ============================================================================ */
const FURN_ITEMS = () => [['table', T('Стол', 'Table')], ['coffee', T('Журнальный столик', 'Coffee table')], ['chair', T('Стул', 'Chair')], ['stool', T('Табурет', 'Stool')], ['bed', T('Кровать', 'Bed')], ['wardrobe', T('Шкаф', 'Wardrobe')], ['nightstand', T('Тумбочка', 'Nightstand')], ['sofa', T('Диван', 'Sofa')], ['bookcase', T('Стеллаж', 'Bookcase')], ['bench', T('Скамья', 'Bench')], ['longtable', T('Длинный стол (замок)', 'Long table (castle)')], ['throne', T('Трон', 'Throne')], ['chest', T('Сундук', 'Chest')]];
const FURN_SETS = { bedroom: ['bed', 'wardrobe', 'nightstand', 'chair'], kitchen: ['table', 'chair', 'chair', 'chair', 'chair', 'bookcase'], living: ['sofa', 'coffee', 'bookcase', 'stool'], castle: ['throne', 'longtable', 'bench', 'bench', 'chest'] };
GENS.furniture = {
  icon: 'chair', name: () => T('Мебель для кукольного дома', 'Dollhouse furniture'), desc: () => T('Столы, стулья, кровати, шкафы, трон — на пазах', 'Tables, chairs, beds, wardrobes, a throne — slot-together'),
  fields: [
    { k: 'scale', t: 'sel', l: () => T('Масштаб', 'Scale'), def: () => '16', opts: () => Object.entries(DOLL_SCALES).map(([k, v]) => [k, v.n]) },
    { k: 'set', t: 'sel', l: () => T('Что сделать', 'What to make'), def: () => 'bedroom', opts: () => [['bedroom', T('Набор: спальня', 'Set: bedroom')], ['kitchen', T('Набор: кухня', 'Set: kitchen')], ['living', T('Набор: гостиная', 'Set: living room')], ['castle', T('Набор: зал замка', 'Set: castle hall')], ['one', T('Один предмет', 'Single item')]] },
    { k: 'item', t: 'sel', l: () => T('Предмет', 'Item'), def: () => 'chair', opts: FURN_ITEMS, show: o => o.set === 'one' },
    { k: 'qty', t: 'num', l: () => T('Количество', 'Quantity'), def: () => 1, min: 1, max: 12, step: 1, show: o => o.set === 'one' },
    { k: 'deco', t: 'sel', l: () => T('Украшение', 'Decoration'), def: () => 'simple', opts: () => [['plain', T('без украшений', 'plain')], ['simple', T('гравировка', 'engraved details')], ['carved', T('резные вырезы', 'carved cut-outs')]] },
    { k: 'size', t: 'num', l: () => T('Размер (поправка)', 'Size (adjust)'), def: () => 100, min: 50, max: 200, u: () => '%', step: 5 },
    ...jointFields(),
  ],
  async make(o) {
    if (!hasClip()) throw new Error(T('Нужна библиотека Clipper — она не загрузилась.', 'The Clipper library did not load.'));
    const N = +o.scale || 16, f = (o.size || 100) / 100 / N, t = o.t, clr = fitValue(o), mk = markLayer();
    const list = o.set === 'one' ? Array(clamp(o.qty | 0, 1, 12)).fill(o.item) : FURN_SETS[o.set] || ['chair'];
    const parts = [], asm = [], warn = new Set(), groups3d = []; let ox = 0;
    const tw = len => clamp(len * .22, Math.max(1.6, t * 1.5), 10);
    const slot = (x, y, w, h) => rectPts(x - clr / 2, y - clr / 2, w + clr, h + clr);
    const cut = p => ({ layer: CUT, kind: 'part', paths: p, closed: true }), eng = p => ({ layer: mk, kind: 'part', paths: p, closed: false });
    const XY = (x, y, z) => ({ origin: [x, y, z], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] }), XZ = (x, y, z) => ({ origin: [x, y, z], u: [1, 0, 0], v: [0, 0, 1], n: [0, 1, 0] }), YZ = (x, y, z) => ({ origin: [x, y, z], u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0] });
    for (const kind of list) {
      const P = [], put = (name, paths, fr, color, lines) => P.push({ name, paths, fr, color, lines });
      const R = v => v * f; // real millimetres → model
      const deco = o.deco;
      /* ---- tables and benches: top + two leg panels + a through stretcher ---- */
      const table = (L, Wd, H, nm) => {
        const lw = Wd * .82, lx = [L * .12, L * .88 - t], twd = tw(lw), lh = H - t, sh = Math.max(t * 2, lh * .16), sz = lh * .38;
        let top = [rectPts(0, 0, L, Wd, Math.min(2, Wd * .05))]; const ty = [lw * .25, lw * .75].map(y => (Wd - lw) / 2 + y);
        top = boolOp(top, lx.flatMap(x => ty.map(y => slot(x, y - twd / 2, t, twd))), 'diff');
        const lines = deco !== 'plain' ? [rectPts(L * .06, Wd * .1, L * .88, Wd * .8, 1)].map(q => q.concat([q[0]])) : [];
        put(nm + T(': столешница', ': top'), top, XY(0, 0, H - t), hslHex(28, 40, 55), lines);
        for (const x of lx) {
          let leg = [rectPts(0, 0, lw, lh)]; leg = boolOp(leg, [lw * .25, lw * .75].map(y => rectPts(y - twd / 2, lh - .01, twd, t + .01)), 'union');
          const foot = Math.max(t * 1.5, lw * .14), arch = deco === 'carved' ? outline('gothic', foot, -1, lw - 2 * foot, lh * .45) : outline('arch', foot, -1, lw - 2 * foot, lh * .3);
          leg = boolOp(leg, [...arch, slot(lw / 2 - t / 2, sz, t, sh)], 'diff');
          put(nm + T(': ножка', ': leg'), leg, YZ(x, (Wd - lw) / 2, 0), hslHex(28, 35, 50));
        }
        const sl = lx[1] - lx[0] + t + 2 * (t + 1.5), st = [rectPts(0, 0, sl, sh)];
        put(nm + T(': царга', ': stretcher'), st, XZ(lx[0] - t - 1.5, Wd / 2 - t / 2, sz), hslHex(28, 30, 45));
        return [L, Wd, H];
      };
      /* ---- chair / throne: two side frames, seat on tabs, backrest between the back legs ---- */
      const chair = (W, Dp, sh, bh, throne) => {
        const m = t * 1.2, lw = Math.max(t * 3.2, Dp * .14), rail = Math.max(t * 1.8, sh * .14), seatD = Dp - lw - clr, twd = tw(Dp), armH = sh + (bh - sh) * .3;
        const prof = union([[rectPts(0, 0, lw, sh - t)], [rectPts(Dp - lw, 0, lw, bh)], [rectPts(0, sh - t - rail, Dp, rail)], ...(throne ? [[rectPts(0, 0, lw, armH)], [rectPts(0, armH - rail, Dp, rail)]] : [])]);
        const bz0 = sh + (bh - sh) * (throne ? .12 : .35), bh2 = (bh - sh) * (throne ? .78 : .55), bw = W - 2 * m - 2 * t, by = Dp - lw / 2 - t / 2;
        let side = boolOp(prof, [seatD * .3, seatD * .7].map(y => rectPts(y - twd / 2, sh - t - .01, twd, t + .01)), 'union');
        side = boolOp(side, [.25, .75].map(k => slot(by, bz0 + bh2 * k - twd / 2, t, twd)), 'diff');
        if (deco === 'carved' && Dp - 2 * lw > 6) side = boolOp(side, outline('arch', lw + 1, 1.5, Dp - 2 * lw - 2, Math.max(2, sh - t - rail - 3)), 'diff');
        for (const x of [m, W - m - t]) put((throne ? T('Трон', 'Throne') : T('Стул', 'Chair')) + T(': боковина', ': side'), side, YZ(x, 0, 0), hslHex(throne ? 40 : 28, 40, throne ? 45 : 52));
        let seat = [rectPts(0, 0, W, seatD, Math.min(2, W * .05))];
        seat = boolOp(seat, [m, W - m - t].flatMap(x => [seatD * .3, seatD * .7].map(y => slot(x, y - twd / 2, t, twd))), 'diff');
        put(throne ? T('Трон: сиденье', 'Throne: seat') : T('Стул: сиденье', 'Chair: seat'), seat, XY(0, 0, sh - t), hslHex(throne ? 0 : 28, throne ? 55 : 40, throne ? 40 : 58), deco !== 'plain' ? [rectPts(W * .1, seatD * .1, W * .8, seatD * .8, 2)].map(q => q.concat([q[0]])) : []);
        let back = throne ? outline('gothic', 0, 0, bw, bh2) : [rectPts(0, 0, bw, bh2, Math.min(3, bh2 * .2))];
        back = boolOp(back, [.25, .75].flatMap(k => [rectPts(-t, bh2 * k - twd / 2, t + .01, twd), rectPts(bw - .01, bh2 * k - twd / 2, t + .01, twd)]), 'union');
        if (throne) { const cw = bw * .4, cy = bh2 * .55, crown = [[[-cw / 2, 0], [cw / 2, 0], [cw / 2, cw * .55], [cw * .25, cw * .3], [0, cw * .62], [-cw * .25, cw * .3], [-cw / 2, cw * .55]]].map(q => q.map(([x, y]) => [x + bw / 2, y + cy])); back = boolOp(back, crown, 'diff') }
        else if (deco === 'carved') back = boolOp(back, [circlePts(bw / 2, bh2 / 2, Math.min(bw, bh2) * .22, 24)], 'diff');
        put((throne ? T('Трон', 'Throne') : T('Стул', 'Chair')) + T(': спинка', ': backrest'), back, XZ(m + t, by, bz0), hslHex(throne ? 0 : 28, throne ? 55 : 40, throne ? 38 : 55));
        return [W, Dp, bh];
      };
      /* ---- stool: crossed half-lapped legs under a round top ---- */
      const stool = (Dm, H) => {
        const w = Dm * .78, lh = H - t, twd = tw(w), top = boolOp([circlePts(Dm / 2, Dm / 2, Dm / 2, 48)], [...[.25, .75].map(k => slot(Dm / 2 - w / 2 + w * k - twd / 2, Dm / 2 - t / 2, twd, t)), ...[.25, .75].map(k => slot(Dm / 2 - t / 2, Dm / 2 - w / 2 + w * k - twd / 2, t, twd))], 'diff');
        put(T('Табурет: сиденье', 'Stool: seat'), top, XY(0, 0, H - t), hslHex(28, 40, 56));
        const leg = (fromTop) => { let p = boolOp([rectPts(0, 0, w, lh)], [.25, .75].map(k => rectPts(w * k - twd / 2, lh - .01, twd, t + .01)), 'union'); p = boolOp(p, [fromTop ? slot(w / 2 - t / 2, lh / 2, t, lh / 2 + t + 1) : slot(w / 2 - t / 2, -1, t, lh / 2 + 1), ...outline('arch', w * .2, -1, w * .6, lh * .3)], 'diff'); return p };
        put(T('Табурет: ножка A', 'Stool: leg A'), leg(false), XZ(Dm / 2 - w / 2, Dm / 2 - t / 2, 0), hslHex(28, 35, 50));
        put(T('Табурет: ножка B', 'Stool: leg B'), leg(true), YZ(Dm / 2 - t / 2, Dm / 2 - w / 2, 0), hslHex(28, 35, 46));
        return [Dm, Dm, H];
      };
      /* ---- bed: head and foot boards, two rails, a platform with an engraved mattress ---- */
      const bed = (L, Wd, rh, hh, fh2) => {
        const m = t * 1.5, twd = tw(L * .3), railH = Math.max(t * 2.5, rh * .35), z0 = rh - railH, pw = Wd - 2 * m, pl = L - 2 * t;
        const board = (h) => { let p = deco === 'plain' ? [rectPts(0, 0, Wd, h)] : outline('arch', 0, 0, Wd, h); const hs = [m, Wd - m - t].map(x => slot(x, z0 + railH * .5 - twd / 2, t, twd)).concat([.25, .75].map(k => slot(m + pw * k - twd / 2, rh, twd, t))); p = boolOp(p, hs, 'diff'); if (deco === 'carved') p = boolOp(p, [circlePts(Wd / 2, rh + (h - rh) * .55, Math.min(Wd, h - rh) * .18, 32)], 'diff'); return p };
        put(T('Кровать: изголовье', 'Bed: headboard'), board(hh), XZ(0, 0, 0), hslHex(28, 40, 48));
        put(T('Кровать: изножье', 'Bed: footboard'), board(fh2), XZ(0, L - t, 0), hslHex(28, 40, 48));
        const rail = boolOp([rectPts(0, 0, pl, railH)], [rectPts(-t, railH * .5 - twd / 2, t + .01, twd), rectPts(pl - .01, railH * .5 - twd / 2, t + .01, twd)], 'union');
        for (const x of [m, Wd - m - t]) put(T('Кровать: царга', 'Bed: side rail'), rail, YZ(x, t, z0), hslHex(28, 35, 52));
        const plat = boolOp([rectPts(0, 0, pw, pl)], [.25, .75].flatMap(k => [rectPts(pw * k - twd / 2, -t, twd, t + .01), rectPts(pw * k - twd / 2, pl - .01, twd, t + .01)]), 'union');
        const q = []; if (deco !== 'plain') { const s = Math.max(3, pw / 6); for (let d = -pl; d < pw + pl; d += s) { q.push([[d, 0], [d + pl, pl]], [[d, pl], [d + pl, 0]]) } }
        const lines = q.length ? clipOpen(q, [rectPts(2, pl * .22, pw - 4, pl * .76)], true).concat([rectPts(pw * .12, 2, pw * .76, pl * .15, 2).concat([[pw * .12 + 2, 2]])]) : [];
        put(T('Кровать: основание с матрасом', 'Bed: platform and mattress'), plat, XY(m, t, rh), hslHex(210, 25, 75), lines);
        return [Wd, L, hh];
      };
      /* ---- wardrobe / nightstand / bookcase: two sides with slots, shelves on tabs, glued back and doors ---- */
      const cabinet = (W, D, H, shelves, doors, nm) => {
        const twd = tw(D), iw = W - 2 * t, zs = [t * 1.5 + H * .04, H - 2 * t]; for (let i = 1; i <= shelves; i++) zs.push(zs[0] + (zs[1] - zs[0]) * i / (shelves + 1));
        let side = [rectPts(0, 0, D, H)]; side = boolOp(side, zs.flatMap(z => [.25, .75].map(k => slot(D * k - twd / 2, z, twd, t))).concat(outline('arch', D * .2, -1, D * .6, H * .035 + 1)), 'diff');
        for (const x of [0, W - t]) put(nm + T(': боковина', ': side'), side, YZ(x, 0, 0), hslHex(30, 35, 55));
        const shelf = boolOp([rectPts(0, 0, iw, D - t)], [.25, .75].flatMap(k => [rectPts(-t, D * k - twd / 2, t + .01, twd), rectPts(iw - .01, D * k - twd / 2, t + .01, twd)]), 'union');
        zs.forEach((z, i) => put(nm + (i === 1 ? T(': крыша', ': top') : i === 0 ? T(': дно', ': bottom') : T(': полка', ': shelf')), shelf, XY(t, 0, z), hslHex(30, 30, 60)));
        put(nm + T(': задняя стенка', ': back'), [rectPts(0, 0, W, H - H * .035)], XZ(0, D - t, H * .035), hslHex(30, 25, 45));
        if (doors) { const n = doors, dw = W / n - .4, dh = H - zs[0] - t; for (let i = 0; i < n; i++) { const dr = boolOp([rectPts(0, 0, dw, dh, .6)], [circlePts(i === 0 && n > 1 ? dw - 3 : 3, dh * .5, Math.max(.6, t * .25), 12)], 'diff'), L = deco === 'plain' ? [] : [rectPts(dw * .14, dh * .08, dw * .72, dh * .38, 1), rectPts(dw * .14, dh * .54, dw * .72, dh * .38, 1)].map(q => q.concat([q[0]])); put(nm + T(': дверца', ': door'), dr, XZ(i * (dw + .4), -t, zs[0]), hslHex(28, 40, 50), L) } }
        return [W, D, H];
      };
      /* ---- sofa: two arms, seat and front on tabs, back panel ---- */
      const sofa = (W, D, sh, bh, ah) => {
        const twd = tw(D * .6), iw = W - 2 * t, sz = sh - t, bz = sh * .55, byy = D - t * 1.6, armP = union([[rectPts(0, 0, D, ah - D * .1)], [circlePts(D * .2, ah - D * .2, D * .2, 24)], [rectPts(D * .2, ah - D * .4, D * .8, D * .4)]]);
        let arm = boolOp(armP, [...[.3, .65].map(k => slot(D * k - twd / 2, sz, twd, t)), slot(byy, bz, t, Math.min(twd, ah - bz - 2)), slot(t * .6, sh * .25, t, twd)], 'diff');
        for (const x of [0, W - t]) put(T('Диван: подлокотник', 'Sofa: arm'), arm, YZ(x, 0, 0), hslHex(200, 30, 55));
        const seat = boolOp([rectPts(0, 0, iw, D - t * 1.6 - clr)], [.3, .65].flatMap(k => [rectPts(-t, D * k - twd / 2, t + .01, twd), rectPts(iw - .01, D * k - twd / 2, t + .01, twd)]), 'union');
        const cush = deco === 'plain' ? [] : Array.from({ length: 3 }, (_, i) => rectPts(iw * i / 3 + 1, 1, iw / 3 - 2, D * .7, 2).concat([[iw * i / 3 + 1 + 2, 1]]));
        put(T('Диван: сиденье', 'Sofa: seat'), seat, XY(t, 0, sz), hslHex(200, 35, 62), cush);
        const backH = bh - bz, bk = boolOp([rectPts(0, 0, iw, backH, 2)], [rectPts(-t, 0, t + .01, Math.min(twd, ah - bz - 2)), rectPts(iw - .01, 0, t + .01, Math.min(twd, ah - bz - 2))], 'union');
        put(T('Диван: спинка', 'Sofa: back'), bk, XZ(t, byy, bz), hslHex(200, 35, 50), deco === 'plain' ? [] : Array.from({ length: 3 }, (_, i) => rectPts(iw * i / 3 + 1, backH * .4, iw / 3 - 2, backH * .5, 2).concat([[iw * i / 3 + 3, backH * .4]])));
        const front = boolOp([rectPts(0, 0, iw, sh * .55)], [rectPts(-t, sh * .25 - twd * 0 , t + .01, twd), rectPts(iw - .01, sh * .25, t + .01, twd)], 'union');
        put(T('Диван: перед', 'Sofa: front'), front, XZ(t, t * .6, 0), hslHex(200, 30, 45));
        return [W, D, bh];
      };
      /* ---- chest: finger-jointed box with a lift-off lid ---- */
      const chest = async (W, D, H) => {
        const r = await GENS.box.make({ W, D, H, dims: 'outer', top: 'lift', dx: 0, dy: 0, t, fw: Math.max(t * 1.6, Math.min(W, D, H) / 5), fit: o.fit, fitC: o.fitC, labels: false });
        r.parts.forEach((p, i) => { const a = r.asm[i] || {}; put(T('Сундук: ', 'Chest: ') + p.name, p.items[0].paths, { origin: a.origin, u: a.u, v: a.v, n: a.n }, hslHex(25, 45, 40), deco !== 'plain' && /Перед|Front/.test(p.name) ? (() => { const b = bboxOf(p.items[0].paths); return [[[b[0] + 2, (b[1] + b[3]) / 2], [b[2] - 2, (b[1] + b[3]) / 2]], circlePts((b[0] + b[2]) / 2, b[3] - (b[3] - b[1]) * .3, Math.max(1, (b[3] - b[1]) * .08), 12).concat([[(b[0] + b[2]) / 2 + Math.max(1, (b[3] - b[1]) * .08), b[3] - (b[3] - b[1]) * .3]])] })() : []) });
        return [W, D, H];
      };
      let size;
      switch (kind) {
        case 'table': size = table(R(1200), R(800), R(750), T('Стол', 'Table')); break;
        case 'coffee': size = table(R(1000), R(550), R(450), T('Столик', 'Coffee table')); break;
        case 'longtable': size = table(R(2200), R(850), R(760), T('Длинный стол', 'Long table')); break;
        case 'bench': size = table(R(1400), R(350), R(450), T('Скамья', 'Bench')); break;
        case 'chair': size = chair(R(450), R(450), R(450), R(900), false); break;
        case 'throne': size = chair(R(700), R(620), R(480), R(1700), true); break;
        case 'stool': size = stool(R(360), R(460)); break;
        case 'bed': size = bed(R(2000), R(1400), R(420), R(1050), R(600)); break;
        case 'wardrobe': size = cabinet(R(1000), R(580), R(1900), 2, 2, T('Шкаф', 'Wardrobe')); break;
        case 'nightstand': size = cabinet(R(450), R(400), R(560), 0, 1, T('Тумбочка', 'Nightstand')); break;
        case 'bookcase': size = cabinet(R(800), R(300), R(1800), 3, 0, T('Стеллаж', 'Bookcase')); break;
        case 'sofa': size = sofa(R(1900), R(850), R(430), R(860), R(620)); break;
        case 'chest': size = await chest(R(900), R(500), R(520)); break;
      }
      if (size && Math.min(size[0], size[1]) < t * 5) warn.add(T(`«${(FURN_ITEMS().find(x => x[0] === kind) || [0, kind])[1]}» мельче пяти толщин материала — возьмите масштаб крупнее или материал тоньше.`, `“${(FURN_ITEMS().find(x => x[0] === kind) || [0, kind])[1]}” is smaller than five material thicknesses — use a larger scale or thinner stock.`));
      // place each item by its real extent along X (the parts know their frames), so items never stand inside each other
      let lo = Infinity, hi = -Infinity, top = 0; const mine = [];
      for (const q of P) {
        const items = [cut(q.paths)]; if (q.lines && q.lines.length) items.push(eng(q.lines));
        parts.push({ name: q.name, items, req: curReq(t) });
        const f = q.fr; for (const pth of q.paths) for (const [a, b] of pth) for (const k of [0, t]) { const x = f.origin[0] + f.u[0] * a + f.v[0] * b + f.n[0] * k, z = f.origin[2] + f.u[2] * a + f.v[2] * b + f.n[2] * k; if (x < lo) lo = x; if (x > hi) hi = x; if (z > top) top = z }
        mine.push({ paths: q.paths, origin: [f.origin[0], f.origin[1], f.origin[2]], u: f.u, v: f.v, n: f.n, t, color: q.color });
      }
      if (!isFinite(lo)) { lo = 0; hi = size ? size[0] : 50 }
      groups3d.push({ mine, lo, hi, top });
    }
    // tall items stand at the back-left, low ones in front: nothing hides behind a wardrobe in the 3D view
    groups3d.sort((a, b) => b.top - a.top); for (const g of groups3d) { for (const m of g.mine) { m.origin[0] += ox - g.lo; asm.push(m) } ox += (g.hi - g.lo) + Math.max(12, t * 5) }
    return { parts, asm, info: T(`${list.length} предм. · ${parts.length} деталей · масштаб 1:${N}`, `${list.length} items · ${parts.length} parts · scale 1:${N}`), steps: [T('Ножки и боковины вставляются язычками в пазы сидений и столешниц; царги проходят сквозь ножки. Задние стенки и дверцы шкафов приклейте.', 'Legs and sides go with their tabs into the slots of seats and tops; stretchers pass through the legs. Glue the cabinet backs and doors.')], bom: [...warn, T('Для мебели мельче 1:16 лучше фанера или картон 1–1,5 мм.', 'For furniture smaller than 1:16, 1–1.5 mm plywood or card works best.')] };
  }
};
