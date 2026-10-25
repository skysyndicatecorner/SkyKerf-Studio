'use strict';
/* ============================================================================
   SkyKerf_Studio · all calibration tests in one place
   Power × speed / passes grid, kerf, joint fit, focus ramp, line interval and
   the CNC depth/feed ladder are shown as tabs of one "Tests" dialog.
   ============================================================================ */
const TEST_GROUP = () => [['test', T('Мощность', 'Power'), 'laser'], ['focus', T('Фокус', 'Focus'), 'laser'], ['interval', T('Шаг строк', 'Line interval'), 'laser'], ['kerf', T('Ширина реза', 'Kerf'), null], ['joint', T('Посадка', 'Joint fit'), null], ['cncfeed', T('Подача фрезы', 'Router feed'), 'cnc']];
/* Focus ramp: the test strip lies on a wedge, so its height changes along the line.
   The thinnest spot of the burnt line shows the focus height. No Z axis needed. */
GENS.focus = {
  icon: 'test', name: () => T('Тест фокуса (наклонная планка)', 'Focus test (ramp)'), desc: () => T('Найти фокусное расстояние без оси Z', 'Find the focal distance without a Z axis'), laserOnly: true,
  fields: [
    { k: 'L', t: 'num', l: () => T('Длина планки', 'Strip length'), def: () => 120, min: 60, max: 300, u: MM, step: 5 },
    { k: 'rise', t: 'num', l: () => T('Подъём одного конца', 'Rise of one end'), def: () => 10, min: 2, max: 30, u: MM, step: 1, help: 'focusRise' },
    { k: 'power', t: 'num', l: () => T('Мощность линии', 'Line power'), def: () => 30, min: 1, max: 100, u: () => '%', step: 1 },
    { k: 'speed', t: 'num', l: () => T('Скорость линии', 'Line speed'), def: () => 1500, min: 50, u: MMIN, step: 50 },
  ],
  async make(o) {
    const t = curThick(), L = o.L, W = 24, rise = o.rise, items = [], mk = markLayer();
    items.push({ layer: CUT, kind: 'part', paths: [rectPts(0, 0, L, W, 2)], closed: true });
    const ticks = []; for (let x = 10; x <= L - 10 + 1e-6; x += 10) ticks.push([[x, 2], [x, x % 50 === 0 ? 7 : 5]]);
    items.push({ layer: mk, kind: 'part', paths: ticks, closed: false });
    for (let x = 10; x <= L - 10 + 1e-6; x += 10) { const h = rise * (x - 10) / (L - 20), tp = await textAt(fx(h, 1), 'mono', 2.2, x, 9.5); if (tp.length) items.push({ layer: mk, kind: 'text', paths: tp, closed: true, extra: { text: fx(h, 1), font: 'mono', size: 2.2, rot: 0 } }) }
    const line = { layer: ENG, kind: 'part', paths: [[[10, 16], [L - 10, 16]]], closed: false, extra: { ov: { power: o.power, speed: o.speed, passes: 1 } } };
    items.push(line);
    // wedge supports: two triangles with the same rise
    const wedge = () => ({ layer: CUT, kind: 'part', paths: [[[0, 0], [L - 20, 0], [L - 20, rise], [L - 20 - 4, rise]].map(q => q).concat([[0, 1.5]])], closed: true });
    return {
      parts: [{ name: T('Планка фокуса', 'Focus strip'), items, req: curReq(t), noRotate: true }, { name: T('Клин-подставка', 'Wedge support'), items: [wedge()], req: curReq(t) }, { name: T('Клин-подставка', 'Wedge support'), items: [wedge()], req: curReq(t) }],
      info: T(`Подъём 0…${rise} мм на ${L - 20} мм`, `Rise 0…${rise} mm over ${L - 20} mm`),
      steps: [T('Вырежьте планку и два клина. Поставьте клинья на стол, сверху — заготовку той же толщины, что и планка; низкий конец — у отметки 0.', 'Cut the strip and two wedges. Put the wedges on the bed and a blank of the same thickness on top; the low end at mark 0.'),
        T('Выставьте фокус по низкому концу и прожгите линию (слой гравировки).', 'Focus on the low end and burn the line (engraving layer).'),
        T('Найдите самое тонкое место линии и прочитайте высоту по шкале — на столько нужно поднять или опустить лазер от вашего текущего фокуса.', 'Find the thinnest spot of the line and read the height on the scale — that is how far to move the laser from your current focus.')],
      bom: [T('Линия выгравируется с собственными мощностью и скоростью (параметры объекта).', 'The line is burnt with its own power and speed (object override).')],
    };
  }
};
/* Line interval for fills: squares filled with different line spacings */
GENS.interval = {
  icon: 'test', name: () => T('Тест шага строк (заливка)', 'Line interval test (fill)'), desc: () => T('Какой шаг строк даёт ровную заливку', 'Which line interval gives an even fill'), laserOnly: true,
  fields: [
    { k: 'from', t: 'num', l: () => T('Шаг от', 'Interval from'), def: () => .05, min: .01, max: 1, u: MM, step: .01 },
    { k: 'to', t: 'num', l: () => T('Шаг до', 'Interval to'), def: () => .3, min: .02, max: 2, u: MM, step: .01 },
    { k: 'n', t: 'num', l: () => T('Квадратов', 'Squares'), def: () => 6, min: 2, max: 12, step: 1 },
    { k: 'cell', t: 'num', l: () => T('Размер квадрата', 'Square size'), def: () => 12, min: 5, u: MM, step: 1 },
    { k: 'power', t: 'num', l: () => T('Мощность', 'Power'), def: () => 35, min: 1, max: 100, u: () => '%', step: 1 },
    { k: 'speed', t: 'num', l: () => T('Скорость', 'Speed'), def: () => 3000, min: 50, u: MMIN, step: 100 },
  ],
  async make(o) {
    const n = o.n | 0, c = o.cell, gap = 4, W = n * (c + gap) + gap, H = c + 12, items = [{ layer: CUT, kind: 'part', paths: [rectPts(0, 0, W, H, 2)], closed: true }];
    const fill = S.layers.findIndex(l => l.type === 'fill');
    for (let i = 0; i < n; i++) {
      const iv = o.from + (o.to - o.from) * i / Math.max(1, n - 1), x = gap + i * (c + gap);
      items.push({ layer: fill >= 0 ? fill : ENG, kind: 'part', paths: [rectPts(x, 8, c, c)], closed: true, extra: { ov: { power: o.power, speed: o.speed, passes: 1, interval: +fx(iv, 3) } } });
      const tp = await textAt(fx(iv, 2), 'mono', 2.2, x + c / 2, 4); if (tp.length) items.push({ layer: markLayer(), kind: 'text', paths: tp, closed: true, extra: { text: fx(iv, 2), font: 'mono', size: 2.2, rot: 0 } });
    }
    return { parts: [{ name: T('Тест шага строк', 'Interval test'), items, req: curReq(curThick()), noRotate: true }], info: T(`${n} квадратов, шаг ${fx(o.from, 2)}…${fx(o.to, 2)} мм`, `${n} squares, ${fx(o.from, 2)}…${fx(o.to, 2)} mm`), steps: [T('Выберите самый ровный квадрат без полос и введите его шаг в поле «Интервал» слоя заливки или материала.', 'Pick the most even square without stripes and enter its interval in the fill layer or material.')], bom: [] };
  }
};
/* Router: a ladder of short slots with increasing feed (and depth per pass) */
GENS.cncfeed = {
  icon: 'test', name: () => T('Тест подачи фрезы', 'Router feed test'), desc: () => T('Пазы с разной подачей', 'Slots with different feed'), cncOnly: true,
  fields: [
    { k: 'f0', t: 'num', l: () => T('Подача от', 'Feed from'), def: () => 600, min: 50, u: MMIN, step: 50 },
    { k: 'f1', t: 'num', l: () => T('Подача до', 'Feed to'), def: () => 2400, min: 100, u: MMIN, step: 50 },
    { k: 'n', t: 'num', l: () => T('Пазов', 'Slots'), def: () => 6, min: 2, max: 12, step: 1 },
    { k: 'len', t: 'num', l: () => T('Длина паза', 'Slot length'), def: () => 30, min: 10, u: MM, step: 1 },
  ],
  async make(o) {
    const n = o.n | 0, gap = 10, W = n * gap + 20, H = o.len + 20, parts = [];
    const items = [{ layer: CUT, kind: 'part', paths: [rectPts(0, 0, W, H, 2)], closed: true }];
    const eng = S.layers.findIndex(l => l.type === 'vector');
    for (let i = 0; i < n; i++) { const f = Math.round(o.f0 + (o.f1 - o.f0) * i / Math.max(1, n - 1)), x = 10 + i * gap + gap / 2; items.push({ layer: eng >= 0 ? eng : ENG, kind: 'part', paths: [[[x, 12], [x, 12 + o.len]]], closed: false, extra: { ov: { speed: f, power: 100, passes: 1 } } }); const tp = await textAt(String(f), 'mono', 2.2, x, 6); if (tp.length) items.push({ layer: markLayer(), kind: 'text', paths: tp, closed: true, extra: { text: String(f), font: 'mono', size: 2.2, rot: 0 } }) }
    parts.push({ name: T('Тест подачи', 'Feed test'), items, req: curReq(curThick()), noRotate: true });
    return { parts, info: T(`${n} пазов, ${o.f0}…${o.f1} мм/мин`, `${n} slots, ${o.f0}…${o.f1} mm/min`), steps: [T('Слою пазов назначьте операцию «по линии» нужной глубины. Подача каждого паза задана в параметрах объекта. Выберите самый чистый паз без подгоревших краёв и вибрации.', 'Give the slot layer an “on line” operation of the depth you need. Each slot has its own feed (object override). Pick the cleanest slot without burnt edges or chatter.')], bom: [] };
  }
};
function testTabs(kind) {
  const g = TEST_GROUP(); if (!g.some(x => x[0] === kind)) return '';
  return `<div class="seg full gtabs">${g.map(([k, n, need]) => `<button data-act="genSwitch" data-v="${k}" aria-pressed="${k === kind}" class="${need && (need === 'laser') !== isLaser() ? 'dim' : ''}">${n}${need ? machBadge(need) : ''}</button>`).join('')}</div>`;
}
