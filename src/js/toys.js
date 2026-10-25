'use strict';
/* ============================================================================
   SkyKerf_Studio · toy generator
   Rubber-band pistol and rifle (layered body, trigger lever on a pin),
   cars on axles (sedan, truck, bus, racer, tractor), flat soldiers and
   little people on stands (modern, knights, pirates, vikings…), and an
   articulated doll with pin joints.
   ============================================================================ */
const TOY_KINDS = () => [['pistol', T('Резинкострел-пистолет', 'Rubber-band pistol')], ['rifle', T('Резинкострел-автомат', 'Rubber-band rifle')], ['car', T('Машинка', 'Car')], ['soldiers', T('Солдатики и человечки', 'Soldiers and little people')], ['doll', T('Куколка на шарнирах', 'Jointed doll')]];
const CAR_STYLES = () => [['sedan', T('легковая', 'sedan')], ['truck', T('грузовик', 'truck')], ['bus', T('автобус', 'bus')], ['race', T('гоночная', 'racer')], ['tractor', T('трактор', 'tractor')], ['jeep', T('внедорожник', 'off-roader')]];
function carProfile(style, L, H) {
  const P = [], win = [], arches = [], wheels = [];
  const R = style === 'tractor' ? H * .3 : H * (style === 'race' ? .2 : .22), rr = style === 'tractor' ? H * .2 : R, y0 = R * .55;
  const wf = style === 'tractor' ? [L * .2, rr] : [L * .2, R], wb = style === 'tractor' ? [L * .76, R * 1.45] : [L * (style === 'bus' ? .8 : .78), R];
  wheels.push(wf, wb);
  switch (style) {
    case 'truck': P.push(FG.rr(0, y0, L * .38, H * .78, 5), FG.rr(L * .36, y0, L * .64, H * .55, 2)); win.push(FG.rr(L * .06, y0 + H * .4, L * .24, H * .26, 3)); break;
    case 'bus': P.push(FG.rr(0, y0, L, H * .9, 8)); for (let i = 0; i < 5; i++) win.push(FG.rr(L * (.06 + i * .18), y0 + H * .45, L * .14, H * .28, 2)); break;
    case 'race': P.push([[0, y0], [L, y0], [L, y0 + H * .35], [L * .75, y0 + H * .42], [L * .58, y0 + H * .62], [L * .4, y0 + H * .62], [L * .3, y0 + H * .4], [0, y0 + H * .3]]); P.push(FG.rr(L * .9, y0 + H * .35, L * .1, H * .35, 1)); win.push([[L * .42, y0 + H * .44], [L * .56, y0 + H * .44], [L * .54, y0 + H * .58], [L * .44, y0 + H * .58]]); break;
    case 'tractor': P.push(FG.rr(0, y0, L * .55, H * .45, 4), FG.rr(L * .5, y0, L * .5, H * .95, 4), FG.rr(L * .25, y0 + H * .4, L * .05, H * .3, 1)); win.push(FG.rr(L * .58, y0 + H * .5, L * .34, H * .32, 3)); break;
    case 'jeep': P.push(FG.rr(0, y0, L, H * .5, 4), FG.rr(L * .3, y0, L * .66, H * .9, 4)); win.push(FG.rr(L * .34, y0 + H * .52, L * .26, H * .28, 2), FG.rr(L * .64, y0 + H * .52, L * .26, H * .28, 2)); break;
    default: P.push(FG.rr(0, y0, L, H * .48, 6), [[L * .2, y0 + H * .4], [L * .82, y0 + H * .4], [L * .7, y0 + H * .85], [L * .32, y0 + H * .85]]); win.push([[L * .27, y0 + H * .48], [L * .49, y0 + H * .48], [L * .49, y0 + H * .78], [L * .35, y0 + H * .78]], [[L * .53, y0 + H * .48], [L * .75, y0 + H * .48], [L * .66, y0 + H * .78], [L * .53, y0 + H * .78]]);
  }
  for (const [x, r] of wheels) arches.push(circlePts(x, y0 + (r - R) * 0 + R * .45 - (R - r) * 0, r * 1.12, 40));
  return { body: boolOp(FG.U(P), arches, 'diff'), win, wheels: wheels.map(([x, r]) => ({ x, y: y0 + R * .45 - (style === 'tractor' && r > R ? 0 : 0), r })), H };
}
GENS.toys = {
  icon: 'toy', name: () => T('Генератор игрушек', 'Toy generator'), desc: () => T('Резинкострелы, машинки, солдатики, куколки', 'Rubber-band guns, cars, soldiers, dolls'),
  fields: [
    { k: 'kind', t: 'sel', l: () => T('Игрушка', 'Toy'), def: () => 'car', opts: TOY_KINDS },
    { k: 'L', t: 'num', l: () => T('Длина', 'Length'), def: () => 160, min: 60, max: 600, u: MM, step: 5, show: o => ['pistol', 'rifle', 'car'].includes(o.kind) },
    { k: 'car', t: 'sel', l: () => T('Кузов', 'Body'), def: () => 'sedan', opts: CAR_STYLES, show: o => o.kind === 'car' },
    { k: 'layers', t: 'num', l: () => T('Слоёв корпуса', 'Body layers'), def: () => 5, min: 3, max: 12, step: 1, show: o => o.kind === 'car' },
    { k: 'axle', t: 'num', l: () => T('Ось (шпажка/штифт)', 'Axle (skewer/dowel)'), def: () => 4, min: 2, max: 8, u: MM, step: .5, show: o => o.kind === 'car' },
    { k: 'pin', t: 'num', l: () => T('Штифт шарнира', 'Pivot pin'), def: () => 3, min: 1.5, max: 6, u: MM, step: .5, show: o => ['pistol', 'rifle', 'doll'].includes(o.kind) },
    { k: 'figs', t: 'area', l: () => T('Фигурки (тип×кол-во)', 'Figures (type×count)'), def: () => 'knight×4, archer×2, king×1', show: o => o.kind === 'soldiers', help: 'toyFigs' },
    { k: 'H', t: 'num', l: () => T('Высота', 'Height'), def: () => 60, min: 25, max: 400, u: MM, step: 5, show: o => ['soldiers', 'doll'].includes(o.kind) },
    { k: 'stand', t: 'sel', l: () => T('Подставка', 'Stand'), def: () => 'round', opts: () => [['round', T('круглая', 'round')], ['rect', T('прямоугольная', 'rectangular')], ['none', T('без подставки (с ножкой-упором)', 'none (with a foot)')]], show: o => o.kind === 'soldiers' },
    { k: 'dress', t: 'sel', l: () => T('Одежда', 'Outfit'), def: () => 'dress', opts: () => [['dress', T('платье', 'dress')], ['suit', T('костюм', 'suit')], ['none', T('без одежды-накладки', 'no overlay')]], show: o => o.kind === 'doll' },
    ...jointFields().filter(f => f.k !== 'fw'),
  ],
  async make(o) {
    if (!hasClip()) throw new Error(T('Нужна библиотека Clipper — она не загрузилась.', 'The Clipper library did not load.'));
    const t = o.t, clr = fitValue(o), mk = markLayer(), parts = [], asm = [], steps = [], bom = [];
    const cut = p => ({ layer: CUT, kind: 'part', paths: p, closed: true }), eng = p => ({ layer: mk, kind: 'part', paths: p, closed: false }), engF = p => ({ layer: ENG, kind: 'part', paths: p, closed: true });
    const add = (name, items, fr, color) => { parts.push({ name, items, req: curReq(t) }); if (fr) asm.push(Object.assign({ t, color: color || hslHex(30, 40, 60), paths: items[0].paths }, fr)) };
    const XY = (x, y, z) => ({ origin: [x, y, z], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] }), XZ = (x, y, z) => ({ origin: [x, y, z], u: [1, 0, 0], v: [0, 0, 1], n: [0, 1, 0] });
    let info = '';
    if (o.kind === 'pistol' || o.kind === 'rifle') {
      const rifle = o.kind === 'rifle', L = o.L, k = L / (rifle ? 300 : 180), S = (pts) => pts.map(([x, y]) => [x * k, y * k]);
      // body in a 180 (pistol) / 300 (rifle) unit frame, muzzle at x = 0, barrel top at y = 58
      const Lb = rifle ? 200 : 120, P = [FG.rr(0, 40, Lb + 30, 18, 3), [[Lb - 30, 42], [Lb - 12, 0], [Lb + 12, 0], [Lb + 4, 42]], FG.rr(Lb - 12, 30, 52, 28, 4)];
      if (rifle) { P.push([[Lb + 30, 50], [300, 30], [300, 6], [Lb + 26, 28]], FG.rr(Lb - 70, 14, 22, 30, 3), FG.rr(20, 36, 70, 6, 2)) }
      const xc = Lb - 30, guard = boolOp([FG.rr(xc - 18, 8, 34, 36, 10)], [FG.rr(xc - 13, 13, 24, 30, 7)], 'diff');
      let body = union([...P.map(p => [S(p)]), S(guard[0] ? guard[0] : []).length ? guard.map(p => S(p)) : []].filter(x => x.length));
      const notch = S([[-1, 58.5], [5, 58.5], [2, 53]]); body = boolOp(body, [notch], 'diff');
      const pv = [xc * k, 46 * k], pr = (o.pin + clr) / 2;
      const lever = S([[xc - 4, 16], [xc + 4, 16], [xc + 4, 40], [xc + 3, 58], [xc + 3, 66], [xc - 7, 69], [xc - 7, 64], [xc - 3, 61], [xc - 4, 40]]);
      const cavity = union([offsetPaths([lever], 1.6), offsetPaths([FG.rot(lever, pv[0], pv[1], .4)], 1.6), offsetPaths([FG.rot(lever, pv[0], pv[1], -.15)], 1.6)]);
      const outer = boolOp(body, [circlePts(pv[0], pv[1], pr, 20)], 'diff'), mid = boolOp(body, cavity, 'diff');
      const deco = []; for (let x = 10; x < Lb - 40; x += 8) deco.push(S([[x, 44], [x, 54]]));
      add(T('Корпус: левая сторона', 'Body: left side'), [cut(outer), eng(deco)], XZ(0, 0, 0), hslHex(28, 45, 50));
      for (let i = 0; i < (rifle ? 2 : 1); i++) add(T('Корпус: средний слой', 'Body: middle layer'), [cut(mid)], XZ(0, t + i * t, 0), hslHex(28, 40, 58));
      add(T('Корпус: правая сторона', 'Body: right side'), [cut(outer)], XZ(0, t * (rifle ? 3 : 2), 0), hslHex(28, 45, 50));
      add(T('Спуск (рычаг)', 'Trigger lever'), [cut(boolOp([lever], [circlePts(pv[0], pv[1], (o.pin + .3) / 2, 20)], 'diff'))], XZ(0, t + .2, 0), hslHex(0, 50, 50));
      steps.push(T('Склейте слои корпуса: сторона — средний слой — сторона, вставив рычаг-спуск в вырез среднего слоя на штифт.', 'Glue the body: side — middle layer — side, with the trigger lever in the middle cut-out on its pin.'), T('Резинку натяните от выреза на дуле до крючка на верху рычага. Нажатие на спуск поворачивает рычаг вперёд — резинка соскальзывает.', 'Stretch a rubber band from the muzzle notch to the hook on top of the lever. Pulling the trigger tilts the lever forward and the band slips off.'), T('Возврат спуска — маленькая резинка между нижней частью рычага и рукояткой.', 'A small rubber band between the lower lever and the grip returns the trigger.'));
      bom.push(T(`Штифт ⌀${o.pin} мм длиной ${fx(t * (rifle ? 4 : 3), 0)} мм. Резинки канцелярские.`, `Pin ⌀${o.pin} mm, ${fx(t * (rifle ? 4 : 3), 0)} mm long. Office rubber bands.`), T('Стреляйте только в мишени, не в людей и животных.', 'Shoot only at targets, never at people or animals.'));
      info = T(`${rifle ? 'Автомат' : 'Пистолет'} ${L} мм, ${rifle ? 5 : 4} деталей корпуса`, `${rifle ? 'Rifle' : 'Pistol'} ${L} mm`);
    }
    else if (o.kind === 'car') {
      const L = o.L, H = L * (o.car === 'bus' ? .5 : o.car === 'race' ? .32 : o.car === 'tractor' ? .62 : .42), pr = carProfile(o.car, L, H), n = clamp(o.layers | 0, 3, 12), ah = (o.axle + .5) / 2;
      const holes = pr.wheels.map(w => circlePts(w.x, w.y, ah, 20)), side = boolOp(pr.body, [...holes, ...(o.car === 'bus' ? [] : pr.win)], 'diff'), core = boolOp(pr.body, holes, 'diff');
      const winE = o.car === 'bus' ? pr.win.map(p => p.concat([p[0]])) : [], doors = [];
      if (o.car === 'sedan' || o.car === 'jeep') doors.push([[L * .5, pr.wheels[0].y + H * .1], [L * .5, pr.wheels[0].y + H * .8]]);
      for (let i = 0; i < n; i++) { const outerL = i === 0 || i === n - 1; add(outerL ? T('Кузов: бок', 'Body: side') : T('Кузов: слой', 'Body: layer'), [cut(outerL ? side : core), ...(outerL && (winE.length || doors.length) ? [eng(winE.concat(doors))] : [])], XZ(0, i * t, 0), outerL ? hslHex(0, 60, 50) : hslHex(0, 45, 58)) }
      for (const w of pr.wheels) for (const sd of [0, 1]) { const wp = boolOp([circlePts(0, 0, w.r, 48)], [circlePts(0, 0, (o.axle - .1) / 2, 20)], 'diff'), hub = [circlePts(0, 0, w.r * .55, 32).concat([[w.r * .55, 0]]), circlePts(0, 0, w.r * .82, 40).concat([[w.r * .82, 0]])]; add(T('Колесо', 'Wheel'), [cut(wp), eng(hub)], XZ(w.x, sd ? n * t + 1 : -t - 1, w.y), hslHex(220, 10, 25)) }
      for (let i = 0; i < 4; i++) add(T('Шайба-проставка', 'Spacer washer'), [cut(boolOp([circlePts(0, 0, ah + 2.5, 24)], [circlePts(0, 0, ah, 16)], 'diff'))]);
      bom.push(T(`Оси: 2 шпажки/штифта ⌀${o.axle} мм длиной ${fx(n * t + 2 * t + 6, 0)} мм. В корпусе отверстие свободное (+0,5), в колёсах — тугое.`, `Axles: 2 skewers/dowels ⌀${o.axle} mm, ${fx(n * t + 2 * t + 6, 0)} mm long. Loose holes in the body (+0.5), tight in the wheels.`));
      steps.push(T('Склейте слои кузова, совместив отверстия осей (вставьте оси на время склейки). Наденьте шайбы и колёса.', 'Glue the body layers with the axle holes aligned (keep the axles in while gluing). Add the washers and wheels.'));
      info = T(`${(CAR_STYLES().find(c => c[0] === o.car) || [0, ''])[1]} ${L} мм, ширина ${fx(n * t, 0)} мм`, `${(CAR_STYLES().find(c => c[0] === o.car) || [0, ''])[1]} ${L} mm, ${fx(n * t, 0)} mm wide`);
    }
    else if (o.kind === 'soldiers') {
      const list = String(o.figs || '').split(/[,;\n]+/).map(s => { const m = /^\s*([a-zа-я]+)\s*(?:[×x*]\s*(\d+))?/i.exec(s); return m ? { k: m[1].toLowerCase(), n: +(m[2] || 1) } : null }).filter(Boolean);
      const known = new Set(PERSONS().map(p => p[0])), H = o.H; let ox = 0, total = 0;
      for (const it of list) {
        if (!known.has(it.k)) { bom.push(T(`Неизвестный тип «${it.k}». Доступно: ${[...known].join(', ')}.`, `Unknown type “${it.k}”. Available: ${[...known].join(', ')}.`)); continue }
        for (let i = 0; i < clamp(it.n, 1, 30); i++) {
          const f = placeFigure(personFigure(it.k), H, 0, 0), fb = bboxOf(f.cut), foot = rectPts(fb[0] + (fb[2] - fb[0]) * .15, 0, (fb[2] - fb[0]) * .7, Math.max(2, H * .04), 1);
          const tw = Math.min(f.w * .3, 14), body = o.stand === 'none' ? union([f.cut, [rectPts(-f.w * .35, 0, f.w * .7, H * .05)]]) : boolOp(union([f.cut, [foot]]), [rectPts(-tw / 2, -t, tw, t + .5)], 'union');
          const items = [cut(body)]; if (f.lines.length) items.push(eng(f.lines)); if (f.fills.length) items.push(engF(f.fills));
          const nm = (PERSONS().find(p => p[0] === it.k) || [0, it.k])[1];
          add(nm, items, XZ(ox, 0, t), hslHex(it.k === 'pirate' ? 0 : it.k === 'knight' ? 210 : 30, 40, 55));
          if (o.stand !== 'none') { const sd = Math.max(f.w * .7, H * .35), st = boolOp([o.stand === 'round' ? circlePts(0, 0, sd / 2, 40) : rectPts(-sd / 2, -sd * .35, sd, sd * .7, 2)], [rectPts(-tw / 2 - clr / 2, -t / 2 - clr / 2, tw + clr, t + clr)], 'diff'); add(T('Подставка', 'Stand'), [cut(st)], XY(ox, t / 2, 0), hslHex(100, 25, 40)) }
          ox += Math.max(f.w, H * .4) + 8; total++;
        }
      }
      if (!total) throw new Error(T('Укажите фигурки, например «knight×4, pirate×2».', 'List the figures, e.g. “knight×4, pirate×2”.'));
      steps.push(T('Вставьте язычок фигурки в паз подставки (клей по желанию). Раскрасьте акрилом — гравировка подскажет границы.', 'Push the figure tab into the stand slot (glue if you like). Paint with acrylics — the engraving shows the borders.'));
      bom.push(T('Типы: human, knight, pirate, soldier, archer, viking, king, princess, astronaut, ninja.', 'Types: human, knight, pirate, soldier, archer, viking, king, princess, astronaut, ninja.'));
      info = T(`${total} фигурок по ${H} мм`, `${total} figures, ${H} mm`);
    }
    else if (o.kind === 'doll') {
      const H = o.H, u = H / 100, pr = (o.pin + clr) / 2, hole = (x, y) => circlePts(x, y, pr, 18);
      const torso = union([[FG.ell(0, 86 * u, 9 * u, 10 * u)], [FG.rr(-3 * u, 74 * u, 6 * u, 6 * u, 1)], [FG.rr(-11 * u, 46 * u, 22 * u, 30 * u, 5 * u)]]);
      const tp = boolOp(torso, [hole(-8 * u, 71 * u), hole(8 * u, 71 * u), hole(-6 * u, 49 * u), hole(6 * u, 49 * u)], 'diff');
      const face = [FG.ell(-3 * u, 88 * u, 1.2 * u, 1.2 * u, 10).concat([[-1.8 * u, 88 * u]]), FG.ell(3 * u, 88 * u, 1.2 * u, 1.2 * u, 10).concat([[4.2 * u, 88 * u]]), arcPts(0, 84 * u, 3.6 * u, Math.PI * 1.15, Math.PI * 1.85, .3)];
      add(T('Голова и туловище', 'Head and torso'), [cut(tp), eng(face)], XZ(0, 0, 0), hslHex(25, 50, 75));
      const seg = (len, w, name, x, y, ang) => { const p = boolOp([FG.rr(-w / 2, -len, w, len + w / 2, w / 2)], [hole(0, 0), hole(0, -len + w / 2)], 'diff'); add(name, [cut(p)], null) };
      for (const s of [T('левая', 'left'), T('правая', 'right')]) { seg(16 * u, 7 * u, T(`Плечо (${s})`, `Upper arm (${s})`)); add(T(`Предплечье (${s})`, `Forearm (${s})`), [cut(boolOp(union([[FG.rr(-3.5 * u, -16 * u, 7 * u, 19.5 * u, 3.5 * u)], [FG.ell(0, -17 * u, 4.2 * u, 4.2 * u)]]), [hole(0, 0)], 'diff'))]); seg(22 * u, 9 * u, T(`Бедро (${s})`, `Thigh (${s})`)); add(T(`Голень (${s})`, `Shin (${s})`), [cut(boolOp(union([[FG.rr(-4.5 * u, -22 * u, 9 * u, 26.5 * u, 4.5 * u)], [FG.rr(-4.5 * u, -26 * u, 13 * u, 5 * u, 2)]]), [hole(0, 0)], 'diff'))]) }
      if (o.dress !== 'none') { const dr = o.dress === 'dress' ? [[[-9 * u, 74 * u], [9 * u, 74 * u], [24 * u, 30 * u], [-24 * u, 30 * u]]] : [FG.rr(-12 * u, 44 * u, 24 * u, 31 * u, 3 * u)]; const dd = boolOp(dr, [hole(-8 * u, 71 * u), hole(8 * u, 71 * u), hole(-6 * u, 49 * u), hole(6 * u, 49 * u)].map(h => offsetPaths([h], 1.5)[0]), 'diff'); add(o.dress === 'dress' ? T('Платье (накладка)', 'Dress (overlay)') : T('Костюм (накладка)', 'Suit (overlay)'), [cut(dd), eng(o.dress === 'dress' ? [[[-11 * u, 52 * u], [11 * u, 52 * u]]] : [[[0, 74 * u], [0, 44 * u]]])], XZ(0, -t, 0), hslHex(330, 45, 60)) }
      bom.push(T(`Шарниры: 8 штифтов, гвоздиков-«брадсов» или винтов ⌀${o.pin} мм. Отверстия с зазором — куколка двигает руками и ногами.`, `Joints: 8 pins, split brads or ⌀${o.pin} mm screws. Holes have clearance so arms and legs move.`));
      steps.push(T('Соедините плечо с туловищем, предплечье — с плечом, бедро — с туловищем, голень — с бедром через отверстия штифтами. Накладку-одежду приклейте спереди.', 'Join upper arm to torso, forearm to upper arm, thigh to torso and shin to thigh with pins through the holes. Glue the outfit overlay on the front.'));
      info = T(`Куколка ${H} мм, 9 деталей + одежда`, `Doll ${H} mm, 9 parts + outfit`);
    }
    return { parts, asm, steps, bom, info };
  }
};
