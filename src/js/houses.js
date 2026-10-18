'use strict';
/* ============================================================================
   SkyKerf_Studio · house generator: style × function
   Style = look (roof, gables, walls, windows, doors, trims, ornaments).
   Function = what the house is for (decor, tea house, box, organizer, piggy
   bank, birdhouse, feeder, lantern); two functions can be combined.
   Every detail can be changed after picking a style. Parts are finger-jointed
   or glued; all of them go through the shared nesting dialog.
   ============================================================================ */
const H_STYLES = () => [
  ['cottage', T('Деревенский домик', 'Country cottage')], ['izba', T('Русская изба (старинный)', 'Russian izba (old style)')], ['japanese', T('Японский чайный домик', 'Japanese tea house')],
  ['modern', T('Современный', 'Modern')], ['aframe', T('Скандинавский A-фрейм', 'Scandinavian A-frame')], ['fachwerk', T('Фахверк (немецкий)', 'Half-timbered (German)')],
  ['gothic', T('Готический / викторианский', 'Gothic / Victorian')], ['dutch', T('Голландский пряничный', 'Dutch gingerbread')], ['fairy', T('Сказочный', 'Fairy-tale')],
  ['christmas', T('Новогодний', 'Christmas')], ['castle', T('Крепость', 'Castle')], ['tower', T('Башня', 'Tower')], ['barn', T('Амбар (мансардная крыша)', 'Barn (gambrel roof)')], ['scifi', T('Модуль (sci-fi)', 'Module (sci-fi)')]];
const H_FUNCS = () => [['decor', T('Декор', 'Decoration')], ['tea', T('Чайный домик (пакетики)', 'Tea house (tea bags)')], ['box', T('Шкатулка / коробка', 'Box / casket')], ['organizer', T('Органайзер (отсеки)', 'Organizer (compartments)')], ['piggy', T('Копилка', 'Piggy bank')], ['birdhouse', T('Скворечник', 'Birdhouse')], ['feeder', T('Кормушка', 'Bird feeder')], ['lantern', T('Светильник (под свечу/LED)', 'Lantern (tea light / LED)')]];
const H_PRESETS = {
  cottage: { roof: 'gable', pitch: 40, over: 8, gable: 'tri', roofing: 'shingles', eave: 'plain', roofEdge: 'none', ridge: 'none', wall: 'planks', motif: 'none', winShape: 'rect', winBars: 'panes', winTrim: 'shutters', win: 2, winSide: 1, ww: 18, wh: 20, doorShape: 'rect', doorDeco: 'planks', gableWin: 'round', chimney: true, floors: 1, fh: 60, W: 120, D: 90 },
  izba: { roof: 'gable', pitch: 45, over: 10, gable: 'tri', roofing: 'planks', eave: 'russian', roofEdge: 'none', ridge: 'horse', wall: 'logs', motif: 'none', winShape: 'rect', winBars: 'cross', winTrim: 'nalichnik', win: 2, winSide: 1, ww: 16, wh: 20, doorShape: 'rect', doorDeco: 'planks', gableWin: 'arch', chimney: true, floors: 1, fh: 60, W: 120, D: 100 },
  japanese: { roof: 'gable', pitch: 28, over: 16, gable: 'tri', roofing: 'kawara', eave: 'upturn', roofEdge: 'none', ridge: 'none', wall: 'shoji', motif: 'none', winShape: 'round', winBars: 'grid', winTrim: 'frame', win: 1, winSide: 1, ww: 30, wh: 30, doorShape: 'slide', doorDeco: 'shoji', gableWin: 'none', chimney: false, floors: 1, fh: 52, W: 120, D: 100 },
  modern: { roof: 'shed', pitch: 10, over: 6, gable: 'tri', roofing: 'seam', eave: 'plain', roofEdge: 'none', ridge: 'none', wall: 'siding', motif: 'none', winShape: 'rect', winBars: 'none', winTrim: 'frame', win: 2, winSide: 1, ww: 32, wh: 26, doorShape: 'rect', doorDeco: 'panels', gableWin: 'none', chimney: false, floors: 1, fh: 60, W: 130, D: 90 },
  aframe: { roof: 'gable', pitch: 64, over: 6, gable: 'tri', roofing: 'shingles', eave: 'plain', roofEdge: 'none', ridge: 'none', wall: 'boards', motif: 'none', winShape: 'rect', winBars: 'none', winTrim: 'none', win: 0, winSide: 0, ww: 14, wh: 12, doorShape: 'rect', doorDeco: 'boards', gableWin: 'tri', chimney: false, floors: 1, fh: 26, W: 110, D: 100 },
  fachwerk: { roof: 'gable', pitch: 52, over: 6, gable: 'tri', roofing: 'tiles', eave: 'plain', roofEdge: 'none', ridge: 'none', wall: 'fachwerk', motif: 'none', winShape: 'rect', winBars: 'panes', winTrim: 'none', win: 2, winSide: 1, ww: 14, wh: 18, doorShape: 'arch', doorDeco: 'planks', gableWin: 'panes', chimney: true, floors: 2, fh: 45, W: 110, D: 90 },
  gothic: { roof: 'gable', pitch: 60, over: 6, gable: 'tri', roofing: 'slate', eave: 'lace', roofEdge: 'none', ridge: 'spire', wall: 'boards', motif: 'none', winShape: 'gothic', winBars: 'tracery', winTrim: 'hood', win: 2, winSide: 1, ww: 14, wh: 26, doorShape: 'gothic', doorDeco: 'panels', gableWin: 'rose', chimney: true, floors: 2, fh: 48, W: 110, D: 90 },
  dutch: { roof: 'gable', pitch: 50, over: 4, gable: 'bell', roofing: 'tiles', eave: 'plain', roofEdge: 'none', ridge: 'none', wall: 'bricks', motif: 'none', winShape: 'arch', winBars: 'sunburst', winTrim: 'frame', win: 2, winSide: 1, ww: 16, wh: 24, doorShape: 'arch', doorDeco: 'lattice', gableWin: 'round', chimney: false, floors: 1, fh: 70, W: 110, D: 80 },
  fairy: { roof: 'gable', pitch: 55, over: 12, gable: 'tri', roofing: 'shingles', eave: 'scallop', roofEdge: 'scallop', ridge: 'ball', wall: 'stones', motif: 'none', winShape: 'round', winBars: 'cross', winTrim: 'flowers', win: 1, winSide: 1, ww: 20, wh: 20, doorShape: 'round', doorDeco: 'planks', gableWin: 'round', chimney: true, floors: 1, fh: 55, W: 110, D: 90 },
  christmas: { roof: 'gable', pitch: 48, over: 8, gable: 'tri', roofing: 'shingles', eave: 'snow', roofEdge: 'scallop', ridge: 'star', wall: 'planks', motif: 'snow', winShape: 'rect', winBars: 'panes', winTrim: 'frame', win: 2, winSide: 1, ww: 16, wh: 18, doorShape: 'arch', doorDeco: 'planks', gableWin: 'round', chimney: true, floors: 1, fh: 55, W: 110, D: 80 },
  castle: { roof: 'crenel', pitch: 40, over: 0, gable: 'tri', roofing: 'none', eave: 'plain', roofEdge: 'none', ridge: 'none', wall: 'stones', motif: 'none', winShape: 'arch', winBars: 'none', winTrim: 'none', win: 3, winSide: 2, ww: 9, wh: 18, doorShape: 'arch', doorDeco: 'planks', gableWin: 'none', chimney: false, floors: 1, fh: 75, W: 170, D: 130 },
  tower: { roof: 'hip', pitch: 62, over: 6, gable: 'tri', roofing: 'shingles', eave: 'plain', roofEdge: 'none', ridge: 'spire', wall: 'bricks', motif: 'none', winShape: 'slit', winBars: 'none', winTrim: 'none', win: 1, winSide: 1, ww: 6, wh: 20, doorShape: 'arch', doorDeco: 'planks', gableWin: 'none', chimney: false, floors: 3, fh: 50, W: 70, D: 70 },
  barn: { roof: 'gambrel', pitch: 30, over: 6, gable: 'tri', roofing: 'planks', eave: 'plain', roofEdge: 'none', ridge: 'none', wall: 'boards', motif: 'none', winShape: 'rect', winBars: 'cross', winTrim: 'frame', win: 2, winSide: 1, ww: 14, wh: 14, doorShape: 'double', doorDeco: 'barn', gableWin: 'round', chimney: false, floors: 1, fh: 60, W: 130, D: 100 },
  scifi: { roof: 'flat', pitch: 20, over: 0, gable: 'tri', roofing: 'none', eave: 'plain', roofEdge: 'none', ridge: 'none', wall: 'panels', motif: 'none', winShape: 'round', winBars: 'none', winTrim: 'frame', win: 3, winSide: 2, ww: 14, wh: 14, doorShape: 'rect', doorDeco: 'panels', gableWin: 'none', chimney: false, floors: 2, fh: 45, W: 140, D: 100 },
};
const FN_PRESETS = {
  decor: { winMode: 'cut', doorMode: 'engrave', ledHole: false, div: 0 },
  tea: { winMode: 'cut', doorMode: 'engrave', teaH: 18, div: 0, W: 120, D: 95 },
  box: { winMode: 'engrave', doorMode: 'engrave', div: 0 },
  organizer: { winMode: 'cut', doorMode: 'engrave', div: 2, divH: 75 },
  piggy: { winMode: 'engrave', doorMode: 'engrave', div: 0 },
  birdhouse: { winMode: 'engrave', doorMode: 'engrave', hole: 32, div: 0 },
  feeder: { winMode: 'cut', doorMode: 'engrave', div: 0 },
  lantern: { winMode: 'cut', doorMode: 'cut', ledHole: true, div: 0 },
};
const ROOFS = () => [['gable', T('двускатная', 'gable')], ['gambrel', T('мансардная (ломаная)', 'gambrel')], ['hip', T('вальмовая / шатровая', 'hip / pyramid')], ['shed', T('односкатная', 'shed (mono-pitch)')], ['flat', T('плоская', 'flat')], ['crenel', T('зубцы крепости', 'battlements')], ['none', T('без крыши', 'none')]];
const WIN_SHAPES = () => [['rect', T('прямоугольное', 'rectangle')], ['arch', T('арочное', 'arched')], ['gothic', T('стрельчатое', 'pointed')], ['onion', T('восточное', 'ogee')], ['round', T('круглое', 'round')], ['oval', T('овальное', 'oval')], ['trefoil', T('трилистник', 'trefoil')], ['slit', T('бойница', 'arrow slit')], ['hexagon', T('шестиугольное', 'hexagonal')], ['heart', T('сердце', 'heart')]];
const WIN_BARS = () => [['none', T('без переплёта', 'no bars')], ['cross', T('крест', 'cross')], ['panes', T('4 стекла', '4 panes')], ['grid', T('сетка', 'grid')], ['shoji', T('сёдзи', 'shoji')], ['sunburst', T('лучи', 'sunburst')], ['tracery', T('готический', 'tracery')], ['diamond', T('ромбы', 'diamond lattice')]];
const WIN_TRIMS = () => [['none', T('нет', 'none')], ['frame', T('рамка (гравировка)', 'frame (engraved)')], ['sill', T('подоконник', 'sill')], ['shutters', T('ставни (накладные)', 'shutters (glued on)')], ['nalichnik', T('резной наличник (накладной)', 'carved Russian frame (glued on)')], ['hood', T('козырёк-арка', 'arched hood')], ['flowers', T('ящик с цветами', 'flower box')]];
const DOOR_SHAPES = () => [['none', T('без двери', 'no door')], ['rect', T('прямоугольная', 'rectangle')], ['arch', T('арочная', 'arched')], ['gothic', T('стрельчатая', 'pointed')], ['round', T('круглая (хоббит)', 'round (hobbit)')], ['double', T('двустворчатая', 'double')], ['slide', T('раздвижная (японская)', 'sliding (Japanese)')]];
const DOOR_DECOS = () => [['none', T('нет', 'none')], ['planks', T('доски', 'planks')], ['boards', T('вертикальные доски', 'vertical boards')], ['panels', T('филёнки', 'panels')], ['lattice', T('решётка', 'lattice')], ['shoji', T('сёдзи', 'shoji')], ['barn', T('амбарная (крест)', 'barn (X brace)')]];
const EAVES = () => [['plain', T('простой', 'plain')], ['scallop', T('фестоны', 'scallops')], ['teeth', T('зубчики', 'teeth')], ['lace', T('кружево с прорезями', 'gingerbread lace')], ['russian', T('резные причелины', 'carved Russian bargeboards')], ['upturn', T('загнутые концы (Азия)', 'upturned ends (Asian)')], ['snow', T('снежная шапка', 'snow cap')]];
const RIDGES = () => [['none', T('нет', 'none')], ['spire', T('шпиль', 'spire')], ['ball', T('шар', 'finial ball')], ['horse', T('конёк (голова коня)', 'horse head (konyok)')], ['star', T('звезда', 'star')], ['rooster', T('петушок', 'rooster')]];
const GABLES = () => [['tri', T('треугольный', 'triangular')], ['stepped', T('ступенчатый (голландский)', 'stepped (Dutch)')], ['bell', T('фигурный (колокол)', 'bell (curved)')]];
const GABLE_WINS = () => [['none', T('нет', 'none')], ['round', T('круглое', 'round')], ['arch', T('арочное', 'arched')], ['tri', T('треугольное', 'triangular')], ['rose', T('роза (готика)', 'rose window')], ['panes', T('с переплётом', 'with bars')]];

/* Rotate/translate helpers for 2D wall-local geometry */
const xfPaths = (paths, f) => paths.map(p => p.map(q => f(q[0], q[1])));
const rot2 = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const v3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/* ---- window: outline + bars → glass openings ---- */
function windowGeom(cx, cy, ww, wh, shape, bars, t) {
  const sq = ['round', 'hexagon', 'heart'].includes(shape) ? Math.min(ww, wh) : 0, w = sq || ww, h = sq || wh, x = cx - w / 2, y = cy - h / 2;
  const out = shape === 'slit' ? outline('rect', cx - Math.min(w, 5) / 2, y, Math.min(w, 5), h) : outline(shape === 'round' ? 'circle' : shape, x, y, w, h, 2);
  const bw = Math.max(1.4, Math.min(w, h) * .08), L = [], b = bboxOf(out);
  const vline = X => L.push([[X, b[1] - 1], [X, b[3] + 1]]), hline = Y => L.push([[b[0] - 1, Y], [b[2] + 1, Y]]);
  const spring = shape === 'arch' || shape === 'gothic' || shape === 'onion' || shape === 'trefoil' ? y + h - (shape === 'arch' ? w / 2 : Math.min(h * .55, w * .866)) : cy;
  if (shape !== 'slit') switch (bars) {
    case 'cross': vline(cx); hline(spring); break;
    case 'panes': vline(cx); hline(shape === 'rect' ? cy : spring); if (h > w * 1.4 && shape === 'rect') { hline(y + h * .25); hline(y + h * .75) } break;
    case 'grid': for (let i = 1; i < 3; i++) { vline(x + w * i / 3); hline(y + h * i / 3) } break;
    case 'shoji': for (let i = 1; i < 4; i++) vline(x + w * i / 4); for (let i = 1; i < 5; i++) hline(y + h * i / 5); break;
    case 'sunburst': { vline(cx); hline(spring); const R = Math.max(w, h); for (let k = 1; k < 4; k++) { const a = Math.PI * k / 4; L.push([[cx, spring], [cx + Math.cos(a) * R, spring + Math.sin(a) * R]]) } break }
    case 'tracery': { vline(cx); const r = w * .2; L.push(circlePts(cx, spring + (y + h - spring) * .42, r, 20).concat([[cx + r, spring + (y + h - spring) * .42]])); break }
    case 'diamond': for (let d = -h; d < w + h; d += Math.max(4, w / 3)) { L.push([[x + d, y], [x + d + h, y + h]]); L.push([[x + d, y + h], [x + d + h, y]]) } break;
  }
  const barPolys = L.length ? offsetOpen(L, bw / 2) : [];
  const glass = barPolys.length ? boolOp(out, barPolys, 'diff') : out;
  return { outline: out, glass: glass.filter(p => polyArea(p) > 1.5) };
}
function doorGeom(cx, y0, dw, dh, shape) {
  const x = cx - dw / 2;
  if (shape === 'round') { const r = Math.min(dw, dh) / 2; return boolOp([circlePts(cx, y0 + r * .85, r, 48)], [rectPts(cx - r - 1, y0 - r * 2, r * 2 + 2, r * 2)], 'diff') }
  if (shape === 'arch' || shape === 'gothic') return outline(shape, x, y0, dw, dh);
  if (shape === 'double' || shape === 'slide') return [rectPts(x, y0, dw * (shape === 'slide' ? 1.25 : 1.1), dh)].map(p => p.map(([px, py]) => [px - dw * (shape === 'slide' ? .125 : .05), py]));
  return [rectPts(x, y0, dw, dh)];
}
function doorDecor(kind, door, shape) {
  const b = bboxOf(door), [x0, y0, x1, y1] = b, w = x1 - x0, h = y1 - y0, L = [];
  if (kind === 'planks') for (let x = x0 + 3.5; x < x1; x += 3.5) L.push([[x, y0], [x, y1]]);
  if (kind === 'boards') for (let x = x0 + 2.5; x < x1; x += 2.5) L.push([[x, y0], [x, y1]]);
  if (kind === 'panels') { const m = Math.max(2, w * .15), ph = (h - 3 * m) / 2; L.push(rectPts(x0 + m, y0 + m, w - 2 * m, ph, 1).concat([[x0 + m + 1, y0 + m]]), rectPts(x0 + m, y0 + 2 * m + ph, w - 2 * m, ph, 1).concat([[x0 + m + 1, y0 + 2 * m + ph]])) }
  if (kind === 'lattice') for (let d = -h; d < w + h; d += 4) { L.push([[x0 + d, y0], [x0 + d + h, y1]]); L.push([[x0 + d, y1], [x0 + d + h, y0]]) }
  if (kind === 'shoji') { for (let x = x0 + w / 4; x < x1 - 1; x += w / 4) L.push([[x, y0], [x, y1]]); for (let y = y0 + h / 6; y < y1 - 1; y += h / 6) L.push([[x0, y], [x1, y]]) }
  if (kind === 'barn') { L.push(rectPts(x0 + 2, y0 + 2, w - 4, h - 4).concat([[x0 + 2, y0 + 2]]), [[x0 + 2, y0 + 2], [x1 - 2, y1 - 2]], [[x0 + 2, y1 - 2], [x1 - 2, y0 + 2]]) }
  if (shape === 'double' || shape === 'slide') L.push([[(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1]]);
  const knob = shape === 'round' ? [x0 + w * .72, y0 + h * .4] : shape === 'double' ? null : [x0 + w * .8, y0 + h * .45];
  return { lines: L.length ? clipOpen(L, door, true) : [], shapes: knob ? [circlePts(knob[0], knob[1], Math.max(.8, w * .05), 12)] : [] };
}
/* carved Russian window frame (nalichnik): frame with a crest on top and a "towel" below */
function nalichnik(win, bw) {
  const [x0, y0, x1, y1] = bboxOf(win), w = x1 - x0, cx = (x0 + x1) / 2, crest = w * .45;
  let shape = [rectPts(x0 - bw, y0 - bw, w + 2 * bw, y1 - y0 + 2 * bw)];
  shape = boolOp(shape, [[[x0 - bw * 1.6, y1 + bw * .5], [x1 + bw * 1.6, y1 + bw * .5], [cx, y1 + bw + crest]], ...[-1, 1].map(sx => circlePts(cx + sx * (w / 2 + bw * .9), y1 + bw * .8, bw * .9, 16)), rectPts(x0 - bw * 1.4, y0 - bw * 2.4, w + bw * 2.8, bw * 1.6)], 'union');
  const scallops = []; for (let i = 0; i < 5; i++) scallops.push(circlePts(x0 - bw * 1.4 + (w + bw * 2.8) * (i + .5) / 5, y0 - bw * 2.4, (w + bw * 2.8) / 10, 16));
  shape = boolOp(shape, scallops, 'union');
  const holes = [win[0] ? rectPts(x0, y0, w, y1 - y0) : win, circlePts(cx, y1 + bw + crest * .45, Math.min(bw * .7, crest * .18), 16), ...[-1, 1].map(sx => circlePts(cx + sx * w * .28, y1 + bw * 1.05, bw * .32, 12)), ...[0, 1, 2, 3, 4].map(i => circlePts(x0 - bw * 1.4 + (w + bw * 2.8) * (i + .5) / 5, y0 - bw * 1.7, bw * .3, 12))];
  return boolOp(shape, holes, 'diff');
}
function shutter(win, side) { const [x0, y0, x1, y1] = bboxOf(win), w = (x1 - x0) / 2 + 1, h = y1 - y0 + 2, x = side < 0 ? x0 - w - 1.5 : x1 + 1.5; return [rectPts(x, y0 - 1, w, h, .8)] }
const horseHead = (cx, cy, s, flip) => [[[-.14, 0], [.14, 0], [.2, .32], [.36, .52], [.58, .58], [.64, .68], [.5, .78], [.34, .76], [.3, .95], [.22, .86], [.16, .96], [.08, .8], [-.06, .6], [-.13, .34]].map(([x, y]) => [cx + (flip ? -x : x) * s, cy + y * s])];
const rooster = (cx, cy, s) => [[[-.08, 0], [.08, 0], [.08, .3], [.3, .35], [.42, .55], [.32, .58], [.36, .7], [.24, .68], [.18, .82], [.1, .7], [-.1, .66], [-.3, .78], [-.38, .62], [-.22, .5], [-.36, .4], [-.2, .32], [-.08, .3]].map(([x, y]) => [cx + x * s, cy + y * s])];
function ridgeOrnament(kind, cx, cy, s) {
  if (kind === 'spire') return union([[[[cx - s * .12, cy - 1], [cx + s * .12, cy - 1], [cx + s * .05, cy + s * .55], [cx, cy + s], [cx - s * .05, cy + s * .55]]], [circlePts(cx, cy + s * .4, s * .12, 16)]]);
  if (kind === 'ball') return union([[rectPts(cx - s * .08, cy - 1, s * .16, s * .45)], [circlePts(cx, cy + s * .55, s * .2, 20)]]);
  if (kind === 'horse') return horseHead(cx, cy - 1, s, false);
  if (kind === 'star') return union([[rectPts(cx - s * .06, cy - 1, s * .12, s * .4)], [starPts(cx, cy + s * .62, s * .32, s * .14, 5)]]);
  if (kind === 'rooster') return union([[rectPts(cx - s * .05, cy - 1, s * .1, s * .3)], rooster(cx, cy + s * .25, s * .8)]);
  return [];
}
/* bargeboard strip along a gable slope, built in its own frame: x from the eave (0) to the apex, y = 0 roof line, negative below */
function bargeboard(kind, Ls, bw, p) {
  const xe = Ls - bw * Math.tan(p), top = [[0, 0], [Ls, 0], [xe, -bw]], bottom = [];
  let poly = [[0, 0], [Ls, 0], [xe, -bw], [0, -bw]];
  const add = [], cut = [];
  if (kind === 'scallop' || kind === 'lace' || kind === 'russian' || kind === 'snow') {
    const r = kind === 'russian' ? bw * .7 : kind === 'snow' ? bw * .55 : bw * .45, n = Math.max(2, Math.floor(xe / (r * 2)));
    for (let i = 0; i < n; i++) { const c = [r + i * (xe - 2 * r) / Math.max(1, n - 1), -bw]; add.push(kind === 'snow' ? ellipsePts(c[0], c[1], r, r * (.6 + .4 * ((i * 7) % 3) / 2), 18) : circlePts(c[0], c[1], r, 18)); if (kind !== 'snow') cut.push(circlePts(c[0], c[1] - r * .1, r * .32, 12)) }
    if (kind === 'russian') { add.push(rectPts(0, -bw * 3.2, bw * .9, bw * 3.2)); for (let i = 0; i < 2; i++) add.push(circlePts(bw * .45, -bw * 3.2, bw * .45, 14)); cut.push(circlePts(bw * .45, -bw * 2.2, bw * .22, 12)) }
    if (kind === 'lace') for (let i = 1; i < n; i++) cut.push(motif('heart', i * xe / n, -bw * .5, bw * .4)[0]);
  }
  if (kind === 'teeth') { const n = Math.max(3, Math.floor(xe / (bw * .7))); for (let i = 0; i < n; i += 2) add.push(rectPts(i * xe / n, -bw * 1.5, xe / n, bw * .6)) }
  if (kind === 'upturn') add.push([...bezPts([0, 0], [-bw * .6, 0], [-bw * 1.4, bw * .4], [-bw * 1.7, bw * 1.3], 12), ...bezPts([-bw * 1.7, bw * 1.3], [-bw * 1.2, bw * .2], [-bw * .6, -bw * .9], [0, -bw], 12).slice(1)]);
  let res = add.length ? boolOp([poly], add, 'union') : [poly];
  if (cut.length) res = boolOp(res, cut, 'diff');
  return res;
}

GENS.building = {
  icon: 'house', name: () => T('Домик', 'House'), desc: () => T('14 стилей × 8 назначений: чайный домик, шкатулка, органайзер, копилка, скворечник…', '14 styles × 8 uses: tea house, box, organizer, piggy bank, birdhouse…'),
  fields: [
    { t: 'head', l: () => T('Стиль и назначение', 'Style and use') },
    { k: 'style', t: 'sel', l: () => T('Стиль', 'Style'), def: () => 'cottage', opts: H_STYLES, preset: true },
    { k: 'fn', t: 'sel', l: () => T('Назначение', 'Use'), def: () => 'decor', opts: H_FUNCS, apply: v => FN_PRESETS[v] || {} },
    { k: 'fn2', t: 'sel', l: () => T('Совместить с', 'Combine with'), def: () => 'none', opts: () => [['none', T('— ничего —', '— nothing —')]].concat(H_FUNCS()) },
    { t: 'head', l: () => T('Размеры', 'Size') },
    { k: 'W', t: 'num', l: () => T('Ширина', 'Width'), def: () => 120, min: 40, u: MM, step: 1 }, { k: 'D', t: 'num', l: () => T('Глубина', 'Depth'), def: () => 90, min: 40, u: MM, step: 1 },
    { k: 'floors', t: 'num', l: () => T('Этажей', 'Floors'), def: () => 1, min: 1, max: 4, step: 1 }, { k: 'fh', t: 'num', l: () => T('Высота этажа', 'Floor height'), def: () => 60, min: 20, u: MM, step: 1 },
    { t: 'head', l: () => T('Крыша', 'Roof') },
    { k: 'roof', t: 'sel', l: () => T('Форма крыши', 'Roof shape'), def: () => 'gable', opts: ROOFS },
    { k: 'pitch', t: 'num', l: () => T('Уклон', 'Pitch'), def: () => 40, min: 8, max: 70, u: () => '°', step: 1, show: o => ['gable', 'gambrel', 'hip', 'shed'].includes(o.roof) },
    { k: 'over', t: 'num', l: () => T('Свес', 'Overhang'), def: () => 8, min: 0, max: 40, u: MM, step: 1, show: o => ['gable', 'gambrel', 'hip', 'shed'].includes(o.roof) },
    { k: 'gable', t: 'sel', l: () => T('Фронтон', 'Gable'), def: () => 'tri', opts: GABLES, show: o => o.roof === 'gable' },
    { k: 'gableWin', t: 'sel', l: () => T('Окно во фронтоне', 'Gable window'), def: () => 'round', opts: GABLE_WINS, show: o => ['gable', 'gambrel'].includes(o.roof) },
    { k: 'roofing', t: 'sel', l: () => T('Кровля (гравировка)', 'Roofing (engraved)'), def: () => 'shingles', opts: ROOFINGS, show: o => ['gable', 'gambrel', 'hip', 'shed'].includes(o.roof) },
    { k: 'eave', t: 'sel', l: () => T('Карниз фронтона', 'Gable trim'), def: () => 'plain', opts: EAVES, show: o => o.roof === 'gable' },
    { k: 'roofEdge', t: 'sel', l: () => T('Край ската', 'Roof edge'), def: () => 'none', opts: () => [['none', T('прямой', 'straight')], ['scallop', T('фестоны', 'scallops')], ['teeth', T('зубчики', 'teeth')]], show: o => ['gable', 'gambrel', 'shed'].includes(o.roof) },
    { k: 'ridge', t: 'sel', l: () => T('Украшение конька', 'Ridge ornament'), def: () => 'none', opts: RIDGES, show: o => ['gable', 'hip'].includes(o.roof) },
    { k: 'chimney', t: 'chk', l: () => T('Печная труба', 'Chimney'), def: () => true, show: o => o.roof === 'gable' },
    { t: 'head', l: () => T('Стены', 'Walls') },
    { k: 'wall', t: 'sel', l: () => T('Отделка стен', 'Wall finish'), def: () => 'planks', opts: SURFACES },
    { k: 'motif', t: 'sel', l: () => T('Узор на стенах', 'Wall motifs'), def: () => 'none', opts: () => [['none', T('нет', 'none')]].concat(MOTIFS()) },
    { k: 'motifMode', t: 'sel', l: () => T('Узор', 'Motifs'), def: () => 'engrave', opts: () => [['engrave', T('гравировка', 'engraved')], ['cut', T('прорезь (для света)', 'cut through (for light)')]], show: o => o.motif !== 'none' },
    { t: 'head', l: () => T('Окна и дверь', 'Windows and door') },
    { k: 'win', t: 'num', l: () => T('Окон на фасаде (на этаж)', 'Front windows (per floor)'), def: () => 2, min: 0, max: 8, step: 1 },
    { k: 'winSide', t: 'num', l: () => T('Окон на боковой стене', 'Side windows'), def: () => 1, min: 0, max: 6, step: 1 },
    { k: 'winShape', t: 'sel', l: () => T('Форма окон', 'Window shape'), def: () => 'rect', opts: WIN_SHAPES },
    { k: 'winBars', t: 'sel', l: () => T('Переплёт', 'Window bars'), def: () => 'panes', opts: WIN_BARS },
    { k: 'ww', t: 'num', l: () => T('Ширина окна', 'Window width'), def: () => 18, min: 4, u: MM, step: 1 }, { k: 'wh', t: 'num', l: () => T('Высота окна', 'Window height'), def: () => 20, min: 4, u: MM, step: 1 },
    { k: 'winTrim', t: 'sel', l: () => T('Обрамление окон', 'Window trim'), def: () => 'shutters', opts: WIN_TRIMS },
    { k: 'winMode', t: 'sel', l: () => T('Окна', 'Windows are'), def: () => 'cut', opts: () => [['cut', T('сквозные', 'cut through')], ['engrave', T('гравировка (стена целая)', 'engraved (solid wall)')]] },
    { k: 'doorShape', t: 'sel', l: () => T('Дверь', 'Door'), def: () => 'rect', opts: DOOR_SHAPES },
    { k: 'doorDeco', t: 'sel', l: () => T('Отделка двери', 'Door finish'), def: () => 'planks', opts: DOOR_DECOS, show: o => o.doorShape !== 'none' },
    { k: 'doorMode', t: 'sel', l: () => T('Дверь', 'Door is'), def: () => 'engrave', opts: () => [['engrave', T('гравировка', 'engraved')], ['cut', T('проём', 'opening')]], show: o => o.doorShape !== 'none' },
    { t: 'head', l: () => T('Для назначения', 'For the chosen use') },
    { k: 'teaH', t: 'num', l: () => T('Окно для пакетиков (высота)', 'Tea bag opening height'), def: () => 18, min: 8, max: 40, u: MM, step: 1, show: o => [o.fn, o.fn2].includes('tea') },
    { k: 'div', t: 'num', l: () => T('Перегородок внутри', 'Inner dividers'), def: () => 0, min: 0, max: 6, step: 1 },
    { k: 'divH', t: 'num', l: () => T('Высота перегородок', 'Divider height'), def: () => 75, min: 20, max: 100, u: () => '%', step: 5, show: o => o.div > 0 },
    { k: 'hole', t: 'num', l: () => T('Леток (диаметр)', 'Entrance hole'), def: () => 32, min: 20, max: 60, u: MM, step: 1, show: o => [o.fn, o.fn2].includes('birdhouse') },
    { k: 'ledHole', t: 'chk', l: () => T('Отверстие в дне под свечу/LED', 'Base hole for a tea light / LED'), def: () => false },
    { k: 'fence', t: 'chk', l: () => T('Двор с заборчиком', 'Yard with a fence'), def: () => false },
    { k: 'picket', t: 'sel', l: () => T('Штакетник', 'Pickets'), def: () => 'pointed', opts: () => [['pointed', T('острый', 'pointed')], ['round', T('круглый', 'round')], ['flat', T('прямой', 'flat')], ['gothic', T('готический', 'gothic')]], show: o => o.fence },
    { t: 'head', l: () => T('Соединения', 'Joints') },
    ...jointFields(),
  ],
  presets: H_PRESETS,
  migrate(o) { // projects from 0.3: tea / fortress were styles
    if (o.style === 'tea') { o.style = 'japanese'; if (!o.fn || o.fn === 'decor') o.fn = 'tea' }
    if (o.style === 'fortress') o.style = 'castle';
    if (!H_PRESETS[o.style]) o.style = 'cottage';
    for (const [k, v] of Object.entries(H_PRESETS[o.style])) if (o[k] == null) o[k] = v;
    for (const [k, v] of Object.entries(FN_PRESETS[o.fn] || FN_PRESETS.decor)) if (o[k] == null) o[k] = v;
  },
  async make(o) {
    if (!hasClip()) throw new Error(T('Нужна библиотека Clipper — она не загрузилась.', 'The Clipper library did not load.'));
    const t = o.t, W = o.W, D = o.D, F = clamp(o.floors | 0, 1, 4), clr = fitValue(o), fw = o.fw, mk = markLayer(), seg = (a, b) => [a, b];
    if (fw < t * 1.2) throw new Error(T('Шип должен быть заметно шире толщины материала.', 'Fingers must be noticeably wider than the material.'));
    if (W < 4 * fw || D < 4 * fw) throw new Error(T('Домик слишком мал для такой ширины шипа.', 'The house is too small for this finger width.'));
    const fns = new Set([o.fn, o.fn2].filter(f => f && f !== 'none'));
    const lid = fns.has('tea') || fns.has('box') || fns.has('birdhouse'), dividers = Math.max(0, o.div | 0), openTop = fns.has('organizer') && !lid;
    const bird = fns.has('birdhouse'), feeder = fns.has('feeder'), piggy = fns.has('piggy'), tea = fns.has('tea'), lantern = fns.has('lantern');
    let roof = openTop ? (o.roof === 'crenel' ? 'crenel' : 'none') : o.roof; if (lid && (roof === 'crenel' || roof === 'none')) roof = 'flat';
    const H = F * o.fh + t, Hb = lid ? H + t : H; // Hb: where the roof starts (lid sits on a ceiling plate)
    const p = clamp(o.pitch, 5, 75) * Math.PI / 180, R = roof === 'gable' ? (W / 2) * Math.tan(p) : 0;
    const gq = 65 * Math.PI / 180, ga = W / 2 * .36, gb = W / 2 - ga, gR1 = ga * Math.tan(gq), gR2 = gb * Math.tan(p);
    const shedR = roof === 'shed' ? D * Math.tan(p) : 0;
    const parts = [], asm = [], steps = [], bom = [], wcol = hslHex(32, 42, 66), scol = hslHex(32, 38, 60), rcol = { modern: hslHex(210, 10, 45), japanese: hslHex(200, 12, 35), scifi: hslHex(205, 15, 55) }[o.style] || hslHex(12, 45, 40), dcol = hslHex(28, 40, 48);
    const add = (name, items, a, extraAsm) => { parts.push({ name, items, req: curReq(t) }); if (a) asm.push(Object.assign({ t, color: a.color || wcol }, a)); if (extraAsm) for (const e of extraAsm) asm.push(Object.assign({ t, color: dcol }, e)) };
    const cutItem = paths => ({ layer: CUT, kind: 'part', paths, closed: true });
    const engLines = paths => ({ layer: mk, kind: 'part', paths, closed: false }), engFill = paths => ({ layer: ENG, kind: 'part', paths, closed: true });

    /* ---------- gable silhouettes (wall-local: x along wall, y from 0 = wall top) ---------- */
    const silFront = (len) => {
      if (roof === 'gable') {
        const tri = [[0, -.01], [len, -.01], [len / 2, R]];
        if (o.gable === 'stepped') { const n = 3, s = len / (2 * n + 1), pts = [[0, -.01]]; for (let k = 0; k < n; k++) { const yk = Math.max(4, (k + 1) * s * Math.tan(p) + 4); pts.push([k * s, yk], [(k + 1) * s, yk]) } const top = R + 4; pts.push([n * s, top], [len - n * s, top]); for (let k = n - 1; k >= 0; k--) { const yk = Math.max(4, (k + 1) * s * Math.tan(p) + 4); pts.push([len - (k + 1) * s, yk], [len - k * s, yk]) } pts.push([len, -.01]); return union([[tri], [pts]]) }
        if (o.gable === 'bell') { // Dutch neck gable: a tall neck with a round top and scrolls on the shoulders
          const nw = len * .3, y0 = R * .5, y1 = R * .98, sr = nw * .3, c = len / 2;
          const neck = [[c - nw / 2, y0 - 1], [c + nw / 2, y0 - 1], [c + nw / 2, y1], ...arcPts(c, y1, nw / 2, 0, Math.PI).slice(1, -1), [c - nw / 2, y1]];
          const scrolls = [-1, 1].map(sx => { const cx = c + sx * (nw / 2 + sr * .55); return circlePts(cx, y0 + sr * .2, sr, 28) });
          let g = union([[tri], [neck], ...scrolls.map(q => [q])]);
          return boolOp(g, [-1, 1].map(sx => circlePts(c + sx * (nw / 2 + sr * .55), y0 + sr * .2, sr * .38, 16)), 'diff');
        }
        return [tri];
      }
      if (roof === 'gambrel') return [[[0, -.01], [len, -.01], [len - ga, gR1], [len / 2, gR1 + gR2], [ga, gR1]]];
      return null;
    };
    /* ---------- walls ---------- */
    // frames: O = panel (0,0) on the outer face, u along, v up, out = outward normal
    const frames = {
      front: { O: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], out: [0, -1, 0], len: W },
      back: { O: [W, D, 0], u: [-1, 0, 0], v: [0, 0, 1], out: [0, 1, 0], len: W },
      left: { O: [0, D, 0], u: [0, -1, 0], v: [0, 0, 1], out: [-1, 0, 0], len: D },
      right: { O: [W, 0, 0], u: [0, 1, 0], v: [0, 0, 1], out: [1, 0, 0], len: D },
    };
    const atOuter = (fr, paths, lift = 0) => ({ paths, origin: v3(fr.O, fr.out, lift), u: fr.u, v: fr.v, n: fr.out });
    const glued = []; // decorative parts glued on walls: {name, paths, fr}
    const wallParts = {};
    const buildWall = (key, name) => {
      const fr = frames[key], len = fr.len, isFB = key === 'front' || key === 'back', front = key === 'front';
      let topY = H, sil = null;
      if (!lid) {
        if (isFB) { const s = silFront(len); if (s) sil = xfPaths(s, (x, y) => [x, y + H]) }
        if (roof === 'shed') { if (front) sil = [rectPts(0, H - .01, len, shedR + .01)]; else if (key === 'left') sil = [[[0, H - .01], [len, H - .01], [len, H + shedR]]]; else if (key === 'right') sil = [[[0, H - .01], [len, H - .01], [0, H + shedR]]] }
      }
      const topType = roof === 'flat' && !lid ? 'A' : 'F';
      let panel = fingerPanel(len, H, isFB ? ['A', 'A', topType, 'A'] : ['A', 'B', topType, 'B'], t, fw, clr, sil);
      const holes = [], engr = [], fills = [], keep = []; // keep: areas without wall pattern
      // crenellations
      if (roof === 'crenel') { const mw = Math.max(7, fw), cd = Math.min(9, o.fh * .2), notch = []; for (let x = t + mw; x + mw < len - t - mw * .5; x += 2 * mw) notch.push(rectPts(x, H - cd, mw, cd + 1)); if (notch.length) panel = boolOp(panel, notch, 'diff') }
      // openings per floor
      const wins = [], nW = isFB ? (o.win | 0) : (o.winSide | 0), doorOn = front && o.doorShape !== 'none' && !bird;
      let door = null;
      for (let f = 0; f < F; f++) {
        const base = t + f * o.fh, cy = base + o.fh * .56; let xs = []; for (let i = 0; i < nW; i++) xs.push(len * (i + 1) / (nW + 1));
        if (f === 0 && doorOn) {
          const dw = clamp(len * .22, 12, o.fh * .55), dh = Math.min(o.fh * .74, o.fh - 6), y0 = t + (tea && front ? o.teaH + 6 : 0) + .01;
          door = doorGeom(len / 2, y0, o.doorShape === 'round' ? dh * .9 : dw, tea && front ? Math.max(12, dh - o.teaH - 6) : dh, o.doorShape);
          const db = bboxOf(door), half = (db[2] - db[0]) / 2 + o.ww / 2 + 4;
          if (nW % 2 === 1) xs = xs.filter(x => Math.abs(x - len / 2) > 1);
          xs = xs.map(x => Math.abs(x - len / 2) < half ? (x < len / 2 ? len / 2 - half : len / 2 + half) : x);
        }
        if (bird && front && f === 0) continue;
        if (feeder) continue;
        xs.sort((a, b) => a - b); xs = xs.filter((x, i) => i === 0 || x - xs[i - 1] >= o.ww + 3);
        for (const cx of xs) { if (cx - o.ww / 2 < t + 3 || cx + o.ww / 2 > len - t - 3) continue; const g = windowGeom(cx, Math.min(cy, base + o.fh - o.wh / 2 - 4), o.ww, o.wh, o.winShape, o.winBars, t); wins.push(g) }
      }
      // gable window
      if (isFB && !lid && (roof === 'gable' || roof === 'gambrel') && o.gableWin !== 'none') { const gh = roof === 'gable' ? R : gR1 + gR2, s = Math.min(gh * .42, len * .2); if (s > 8) wins.push(Object.assign(gableWindow(len / 2, H + gh * .36, s), { gable: true })) }
      for (const g of wins) { if (o.winMode === 'cut') holes.push(...g.glass); else { engr.push(...g.outline.map(q => q.concat([q[0]]))); fills.push(...g.glass) } keep.push(...g.outline) }
      if (door) { if (o.doorMode === 'cut' || (lantern && o.doorMode !== 'engrave')) holes.push(...door); else { engr.push(...door.map(q => q.concat([q[0]]))); const dd = doorDecor(o.doorDeco, door, o.doorShape); engr.push(...dd.lines); fills.push(...dd.shapes) } keep.push(...door) }
      // functions
      if (tea && front) { const w = len - 2 * t - 10, op = rectPts(t + 5, t + 2.5, w, o.teaH, 3); holes.push(op); keep.push(op) }
      if (bird && front) { const r = o.hole / 2, cy = t + F * o.fh * .62; holes.push(circlePts(len / 2, cy, r, 48), rectPts(len / 2 - 3, cy - r - 12, 6, 6)); keep.push(circlePts(len / 2, cy, r + 3)) }
      if (bird && !isFB) for (const sx of [.3, .7]) holes.push(circlePts(len * sx, H - 10, 3, 16));
      if (feeder) { const m = Math.max(8, t * 2.5), op = outline('arch', m + t, t + 14, len - 2 * (m + t), H - t - 14 - m); holes.push(...op); keep.push(...op) }
      if (dividers && isFB) for (const x of dividerXs()) { const lx = key === 'back' ? W - x : x, dh = dividerH(); for (const fy of [.3, .7]) holes.push(rectPts(lx - (t + clr) / 2, t + dh * fy - fw / 2 - clr / 2, t + clr, fw + clr)) }
      // floor slots in side walls
      if (!isFB && F > 1 && !openTop) for (let f = 1; f < F; f++) { const y = t + f * o.fh - t / 2 - clr / 2; for (const sx of [.25, .75]) holes.push(rectPts(t + (len - 2 * t) * sx - fw / 2 - clr / 2, y, fw + clr, t + clr)) }
      if (holes.length) panel = boolOp(panel, holes, 'diff');
      // surface pattern + motifs in the free area
      let region = offsetPaths(panel.length ? boolOp([rectPts(0, 0, len, H + (sil ? Math.max(R, gR1 + gR2, shedR) + 40 : 0))], [rectPts(-1, -1, len + 2, t + 1)], 'diff') : [], 0);
      region = boolOp(region, panel.length ? offsetPaths(panel, -1.2) : [], 'inter');
      region = boolOp(region, [rectPts(-1, -1, t + 1.5, H + 999), rectPts(len - t - .5, -1, t + 2, H + 999)], 'diff');
      if (keep.length) region = boolOp(region, offsetPaths(keep, 2), 'diff');
      const trimHoles = []; for (const g of wins) { if (g.gable) continue; if (o.winTrim === 'frame') engr.push(...offsetPaths(g.outline, 1.8).map(q => q.concat([q[0]]))); if (o.winTrim === 'sill') { const b = bboxOf(g.outline); fills.push(rectPts(b[0] - 2, b[1] - 3, b[2] - b[0] + 4, 2)) } if (o.winTrim === 'hood') { const b = bboxOf(g.outline), w = b[2] - b[0] + 6; engr.push(arcPts((b[0] + b[2]) / 2, b[3] - w * .15, w / 2, .15, Math.PI - .15)) } }
      if (region.length) {
        const sp = surface(o.wall, region, o.wall === 'fachwerk' ? Math.max(6, o.fh / 7) : o.wall === 'logs' ? Math.max(4.5, o.fh / 9) : Math.max(4, Math.min(8, o.fh / 9)), key.length);
        engr.push(...sp.lines); fills.push(...sp.shapes);
        if (o.motif !== 'none') { const ms = Math.max(5, Math.min(12, o.fh * .16)), b = bboxOf(region); for (let y = b[1] + ms; y < b[3] - ms * .5; y += ms * 2.2) for (let x = b[0] + ms * (((y / ms) | 0) % 2 ? 1.6 : .8); x < b[2] - ms * .5; x += ms * 2.4) { const c = [[x, y], [x - ms * .55, y - ms * .55], [x + ms * .55, y + ms * .55], [x - ms * .55, y + ms * .55], [x + ms * .55, y - ms * .55]]; if (c.every(q => inPolys(q, region))) { const m = motif(o.motif, x, y, ms); if (o.motifMode === 'cut') trimHoles.push(...m); else fills.push(...m) } } }
      }
      if (trimHoles.length) panel = boolOp(panel, trimHoles, 'diff');
      const items = [cutItem(panel)]; if (engr.length) items.push(engLines(engr)); if (fills.length) items.push(engFill(fills));
      add(name, items, Object.assign(atOuter(fr, panel), { n: fr.out.map(v => -v), color: isFB ? wcol : scol }));
      // glued trims
      for (const g of wins) {
        if (g.gable) continue;
        if (o.winTrim === 'shutters' && o.winShape !== 'round') for (const sd of [-1, 1]) { const sh = shutter(g.outline, sd), b = bboxOf(sh), ls = []; for (let y = b[1] + 2.5; y < b[3]; y += 2.5) ls.push([[b[0] + .8, y], [b[2] - .8, y]]); glued.push({ name: T('Ставня', 'Shutter'), paths: sh, lines: ls, fr }) }
        if (o.winTrim === 'nalichnik') glued.push({ name: T('Наличник', 'Carved frame'), paths: nalichnik(g.outline, Math.max(2.4, o.ww * .14)), fr });
        if (o.winTrim === 'flowers') { const b = bboxOf(g.outline), w = b[2] - b[0] + 6, box = [rectPts(b[0] - 3, b[1] - 9, w, 6, 1)], fl = []; for (let x = b[0] + 1; x < b[2]; x += 4) fl.push(...motif('flower', x, b[1] - 2.2, 4.2)); glued.push({ name: T('Ящик с цветами', 'Flower box'), paths: boolOp(box, fl, 'union'), fr }) }
      }
      wallParts[key] = { panel, wins, door };
    };
    const gableWindow = (cx, cy, s) => {
      const k = o.gableWin;
      if (k === 'tri') return { outline: [[[cx - s * .7, cy - s * .45], [cx + s * .7, cy - s * .45], [cx, cy + s * .55]]], glass: boolOp([[[cx - s * .7, cy - s * .45], [cx + s * .7, cy - s * .45], [cx, cy + s * .55]]], offsetOpen([[[cx, cy - s], [cx, cy + s]]], .8), 'diff') };
      if (k === 'rose') { const out = [circlePts(cx, cy, s / 2, 48)], L = []; for (let i = 0; i < 8; i++) { const a = TAU * i / 8; L.push([[cx, cy], [cx + Math.cos(a) * s, cy + Math.sin(a) * s]]) } L.push(circlePts(cx, cy, s * .16, 20).concat([[cx + s * .16, cy]])); return { outline: out, glass: boolOp(out, offsetOpen(L, .7), 'diff').filter(q => polyArea(q) > 1) } }
      return windowGeom(cx, cy, s * (k === 'arch' ? .8 : 1), s, k === 'panes' ? 'rect' : k === 'arch' ? 'arch' : 'round', k === 'panes' ? 'panes' : 'cross', t);
    };
    const dividerXs = () => { const xs = []; for (let i = 1; i <= dividers; i++) xs.push(t + (W - 2 * t) * i / (dividers + 1)); return xs };
    const dividerH = () => Math.max(12, (H - t) * clamp(o.divH, 20, 100) / 100);
    buildWall('front', T('Фасад', 'Front')); buildWall('back', T('Задняя стена', 'Back wall')); buildWall('left', T('Левая стена', 'Left wall')); buildWall('right', T('Правая стена', 'Right wall'));
    steps.push(T('Вставьте фасад и заднюю стену в основание шипами вниз, затем боковые стены — их шипы входят между шипами фасада.', 'Fit the front and back walls into the base, then the side walls — their fingers interlock with the front.'));
    /* ---------- base ---------- */
    {
      const holes = [];
      if (o.ledHole || lantern) holes.push(circlePts(W / 2, D / 2, Math.min(20.5, (Math.min(W, D) - 2 * t) * .3), 48));
      if (piggy) holes.push(circlePts(W / 2, D / 2, Math.min(20, (Math.min(W, D) - 2 * t) * .28), 48));
      if (bird) for (const [x, y] of [[.3, .3], [.7, .3], [.3, .7], [.7, .7]]) holes.push(circlePts(W * x, D * y, 3, 16));
      if (dividers) for (const x of dividerXs()) for (const fy of [.3, .7]) holes.push(rectPts(x - (t + clr) / 2, t + (D - 2 * t) * fy - fw / 2 - clr / 2, t + clr, fw + clr));
      let base = fingerPanel(W, D, ['B', 'B', 'B', 'B'], t, fw, clr); if (holes.length) base = boolOp(base, holes, 'diff');
      add(T('Основание', 'Base'), [cutItem(base)], { paths: base, origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], color: hslHex(30, 25, 55) });
    }
    /* ---------- intermediate floors ---------- */
    if (!openTop) for (let f = 1; f < F; f++) {
      const iw = W - 2 * t, id = D - 2 * t, z = t + f * o.fh - t / 2, tabs = [];
      for (const sx of [.25, .75]) { tabs.push(rectPts(-t, id * sx - fw / 2, t + .01, fw)); tabs.push(rectPts(iw - .01, id * sx - fw / 2, t + .01, fw)) }
      const slab = boolOp([rectPts(0, 0, iw, id)], tabs, 'union');
      add(T('Перекрытие ', 'Floor ') + (f + 1), [cutItem(slab)], { paths: slab, origin: [t, t, z], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], color: hslHex(30, 30, 50) });
    }
    if (F > 1 && !openTop) steps.push(T('Вставьте перекрытия этажей: их выступы входят в пазы боковых стен (до второй боковой стены).', 'Insert the floor plates: their tabs go into the side-wall slots (before the second side wall).'));
    /* ---------- dividers ---------- */
    if (dividers) {
      const dh = dividerH(), id = D - 2 * t;
      for (const x of dividerXs()) {
        const tabs = []; for (const fy of [.3, .7]) { tabs.push(rectPts(-t, dh * fy - fw / 2, t + .01, fw), rectPts(id - .01, dh * fy - fw / 2, t + .01, fw), rectPts(id * fy - fw / 2, -t, fw, t + .01)) }
        const dv = boolOp([rectPts(0, 0, id, dh)], tabs, 'union');
        add(T('Перегородка', 'Divider'), [cutItem(dv)], { paths: dv, origin: [x - t / 2, t, t], u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0], color: hslHex(30, 30, 58) });
      }
      steps.push(T('Вставьте перегородки до установки задней стены: выступы входят в пазы основания и стен.', 'Insert the dividers before the back wall: their tabs go into the slots of the base and walls.'));
      bom.push(T(`Отсеков: ${dividers + 1}, каждый ≈ ${fx((W - 2 * t - dividers * t) / (dividers + 1), 1)}×${fx(D - 2 * t, 1)} мм.`, `${dividers + 1} compartments, each ≈ ${fx((W - 2 * t - dividers * t) / (dividers + 1), 1)}×${fx(D - 2 * t, 1)} mm.`));
    }
    /* ---------- lid (ceiling + locating plug) ---------- */
    if (lid) {
      const lc = .35, holes = []; if (piggy && roof === 'flat') holes.push(rectPts(W / 2 - 16, D / 2 - 1.75, 32, 3.5));
      let ceil = [rectPts(0, 0, W, D)]; if (holes.length) ceil = boolOp(ceil, holes, 'diff');
      const plug = [rectPts(0, 0, W - 2 * t - 2 * lc, D - 2 * t - 2 * lc)];
      add(T('Крышка: потолок', 'Lid: ceiling'), [cutItem(ceil)], { paths: ceil, origin: [0, 0, H], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], color: hslHex(30, 28, 52) });
      add(T('Крышка: фиксатор', 'Lid: locating plate'), [cutItem(plug)], { paths: plug, origin: [t + lc, t + lc, H - t], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], color: hslHex(30, 20, 45) });
      steps.push(T('Крышка: приклейте фиксатор по центру снизу потолка — он входит внутрь стен и держит крышку на месте.', 'Lid: glue the locating plate centred under the ceiling — it drops inside the walls and keeps the lid in place.'));
      if (roof === 'gable' || roof === 'gambrel') for (const key of ['front', 'back']) {
        const s = silFront(W), gp = xfPaths(s, (x, y) => [x, Math.max(0, y)]), fr = frames[key];
        let gg = gp; const g = (roof === 'gable' || roof === 'gambrel') && o.gableWin !== 'none' ? gableWindow(W / 2, (roof === 'gable' ? R : gR1 + gR2) * .36, Math.min((roof === 'gable' ? R : gR1 + gR2) * .42, W * .2)) : null;
        if (g && o.winMode === 'cut') gg = boolOp(gg, g.glass, 'diff');
        const items = [cutItem(gg)]; if (g && o.winMode !== 'cut') items.push(engLines(g.outline.map(q => q.concat([q[0]]))));
        const sfc = surface(o.wall === 'fachwerk' ? 'fachwerk' : o.wall, offsetPaths(gg, -1.5), 5, 9); if (sfc.lines.length) items.push(engLines(sfc.lines)); if (sfc.shapes.length) items.push(engFill(sfc.shapes));
        add(T('Крышка: фронтон', 'Lid: gable'), items, { paths: gg, origin: v3(fr.O, [0, 0, 1], Hb), u: fr.u, v: fr.v, n: fr.out.map(v => -v) });
      }
      if (roof === 'shed') for (const key of ['left', 'right']) { const fr = frames[key], wedge = key === 'left' ? [[[0, 0], [D, 0], [D, shedR]]] : [[[0, 0], [D, 0], [0, shedR]]]; add(T('Крышка: боковой клин', 'Lid: side wedge'), [cutItem(wedge)], { paths: wedge, origin: v3(fr.O, [0, 0, 1], Hb), u: fr.u, v: fr.v, n: fr.out.map(v => -v) }) }
      bom.push(T(`Внутренний объём: ${fx(W - 2 * t, 1)}×${fx(D - 2 * t, 1)}×${fx(H - 2 * t, 1)} мм.`, `Inner space: ${fx(W - 2 * t, 1)}×${fx(D - 2 * t, 1)}×${fx(H - 2 * t, 1)} mm.`));
    }
    if (roof === 'flat' && !lid) { const top = fingerPanel(W, D, ['B', 'B', 'B', 'B'], t, fw, clr); add(T('Крыша', 'Roof'), [cutItem(top)], { paths: top, origin: [0, 0, H - t], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], color: rcol }); steps.push(T('Наденьте плоскую крышу на шипы стен.', 'Press the flat roof onto the wall fingers.')) }
    /* ---------- roof panels ---------- */
    const roofPanel = (name, w, h, edge, ears, coin, asmA) => {
      let pnl = [rectPts(0, 0, w, h)];
      const st = Math.max(4, Math.min(8, (w + h) / 30));
      if (edge === 'scallop') { const r = st * .55, n = Math.max(2, Math.round(h / (r * 2))); pnl = boolOp(pnl, Array.from({ length: n }, (_, i) => circlePts(0, (i + .5) * h / n, r, 16)), 'union') }
      if (edge === 'teeth') { const n = Math.max(3, Math.round(h / (st * .7))); pnl = boolOp(pnl, Array.from({ length: Math.ceil(n / 2) }, (_, i) => rectPts(-st * .5, (2 * i + .5) * h / n, st * .5 + .01, h / n)), 'union') }
      if (ears) { const e = Math.min(w * .3, 14); pnl = boolOp(pnl, [[...bezPts([w * .35, 0], [w * .1, -e * .2], [0, -e * .5], [-e * .3, -e], 10), ...bezPts([-e * .3, -e], [-e * .05, -e * .4], [0, -e * .1], [0, 0], 8).slice(1)], [...bezPts([w * .35, h], [w * .1, h + e * .2], [0, h + e * .5], [-e * .3, h + e], 10), ...bezPts([-e * .3, h + e], [-e * .05, h + e * .4], [0, h + e * .1], [0, h], 8).slice(1)]].map(q => q.length ? q : []), 'union') }
      if (coin) pnl = boolOp(pnl, [rectPts(w * .55 - 1.75, h / 2 - 16, 3.5, 32)], 'diff');
      const items = [cutItem(pnl)], rf = roofing(o.roofing, offsetPaths(pnl, -1.2), st); if (rf.lines.length) items.push(engLines(rf.lines));
      add(name, items, Object.assign({ paths: pnl, color: rcol }, asmA));
      return pnl;
    };
    const ov = clamp(o.over, 0, 40), coinOnRoof = piggy && roof !== 'flat';
    if (roof === 'gable') {
      const s = (W / 2) / Math.cos(p) + ov, len = D + 2 * ov, ex = W / 2 - s * Math.cos(p), ez = Hb + R - s * Math.sin(p), ears = false;
      roofPanel(T('Скат крыши 1', 'Roof slope 1'), s, len, o.roofEdge, ears, coinOnRoof, { origin: [ex, -ov, ez], u: [Math.cos(p), 0, Math.sin(p)], v: [0, 1, 0], n: [-Math.sin(p), 0, Math.cos(p)] });
      roofPanel(T('Скат крыши 2', 'Roof slope 2'), s, len, o.roofEdge, ears, false, { origin: [W - ex, D + ov, ez], u: [-Math.cos(p), 0, Math.sin(p)], v: [0, -1, 0], n: [Math.sin(p), 0, Math.cos(p)] });
      steps.push(T('Приклейте скаты крыши к фронтонам и верху боковых стен.', 'Glue the roof slopes onto the gables and the side-wall tops.'));
      // bargeboards on both gables
      if (o.eave !== 'plain') {
        const bw = Math.max(3.5, Math.min(9, W * .05)) * (o.eave === 'russian' ? 1.35 : 1), strip = bargeboard(o.eave, s, bw, p);
        for (const key of ['front', 'back']) for (const side of [0, 1]) {
          const placed = xfPaths(strip, (x, y) => { const q = rot2(x, y, p); let X = ex + q[0], Y = ez - Hb + Hb + q[1] - 0; X = side ? W - X : X; return [X, Y] });
          const fr = frames[key]; parts.push({ name: T('Карниз фронтона', 'Gable bargeboard'), items: [cutItem(placed)], req: curReq(t) });
          asm.push({ paths: placed, origin: v3(fr.O, fr.out, 0), u: fr.u, v: fr.v, n: fr.out, t, color: dcol });
        }
        steps.push(T('Приклейте карнизы на фронтоны вдоль края крыши.', 'Glue the bargeboards onto the gables along the roof edge.'));
      }
      // ridge ornament on both gables (part of the front panel outline would weaken it, so it is a glued piece)
      if (o.ridge !== 'none') { const sz = Math.max(14, Math.min(34, W * .2)), orn = ridgeOrnament(o.ridge, W / 2, Hb + R + t * .6, sz); if (orn.length) { parts.push({ name: T('Украшение конька', 'Ridge ornament'), items: [cutItem(orn)], req: curReq(t) }); asm.push({ paths: orn, origin: v3(frames.front.O, [0, 1, 0], -t / 2 + ov * 0), u: [1, 0, 0], v: [0, 0, 1], n: [0, 1, 0], t, color: dcol }) } }
      // chimney
      if (o.chimney) {
        const c = clamp(W * .13, 10, 24), xc = W * .26, yc = D * .3, zr = x => Hb + x * Math.tan(p) + t / Math.cos(p), top = Hb + R + c * .5, x0 = xc - c / 2, x1 = xc + c / 2;
        if (zr(x1) < top - 4) {
          const face = [[[0, zr(x0) - zr(x0) + 0], [c, zr(x1) - zr(x0)], [c, top - zr(x0)], [0, top - zr(x0)]]].map(q => q.map(([a, b]) => [a, b + zr(x0)]));
          const br = surface('bricks', offsetPaths(face, -.6), 2.5, 3).lines;
          for (const [y, n] of [[yc, [0, 1, 0]], [yc + c, [0, -1, 0]]]) { parts.push({ name: T('Труба: стенка', 'Chimney: wall'), items: [cutItem(face), engLines(br)], req: curReq(t) }); asm.push({ paths: face, origin: [x0, y, 0], u: [1, 0, 0], v: [0, 0, 1], n, t, color: hslHex(8, 35, 45) }) }
          for (const [x, h0, n] of [[x0, zr(x0 + t), [1, 0, 0]], [x1, zr(x1), [-1, 0, 0]]]) { const sp = [rectPts(0, h0, c - 2 * t, top - h0)]; parts.push({ name: T('Труба: стенка', 'Chimney: wall'), items: [cutItem(sp)], req: curReq(t) }); asm.push({ paths: sp, origin: [x, yc + t, 0], u: [0, 1, 0], v: [0, 0, 1], n, t, color: hslHex(8, 35, 45) }) }
          const cap = [rectPts(0, 0, c + 4, c + 4, 1)]; parts.push({ name: T('Труба: колпак', 'Chimney: cap'), items: [cutItem(cap)], req: curReq(t) }); asm.push({ paths: cap, origin: [x0 - 2, yc - 2, top], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], t, color: hslHex(8, 20, 30) });
          steps.push(T('Склейте трубу из четырёх стенок, наденьте колпак и приклейте к скату.', 'Glue the chimney from four walls, add the cap and glue it onto the roof.'));
        }
      }
    }
    if (roof === 'gambrel') {
      const L1 = ga / Math.cos(gq) + ov, L2 = gb / Math.cos(p), len = D + 2 * ov, z1 = Hb - ov * Math.sin(gq), x1 = -ov * Math.cos(gq);
      roofPanel(T('Нижний скат 1', 'Lower slope 1'), L1, len, o.roofEdge, false, false, { origin: [x1, -ov, z1], u: [Math.cos(gq), 0, Math.sin(gq)], v: [0, 1, 0], n: [-Math.sin(gq), 0, Math.cos(gq)] });
      roofPanel(T('Нижний скат 2', 'Lower slope 2'), L1, len, o.roofEdge, false, false, { origin: [W - x1, D + ov, z1], u: [-Math.cos(gq), 0, Math.sin(gq)], v: [0, -1, 0], n: [Math.sin(gq), 0, Math.cos(gq)] });
      roofPanel(T('Верхний скат 1', 'Upper slope 1'), L2, len, 'none', false, coinOnRoof, { origin: [ga, -ov, Hb + gR1], u: [Math.cos(p), 0, Math.sin(p)], v: [0, 1, 0], n: [-Math.sin(p), 0, Math.cos(p)] });
      roofPanel(T('Верхний скат 2', 'Upper slope 2'), L2, len, 'none', false, false, { origin: [W - ga, D + ov, Hb + gR1], u: [-Math.cos(p), 0, Math.sin(p)], v: [0, -1, 0], n: [Math.sin(p), 0, Math.cos(p)] });
      steps.push(T('Приклейте нижние, затем верхние скаты к фронтонам.', 'Glue the lower and then the upper slopes onto the gables.'));
    }
    if (roof === 'shed') {
      const len = (D + 2 * ov) / Math.cos(p), wd = W + 2 * ov;
      roofPanel(T('Крыша', 'Roof'), len, wd, o.roofEdge, false, coinOnRoof, { origin: [-ov, D + ov, Hb - ov * Math.tan(p)], u: [0, -Math.cos(p), Math.sin(p)], v: [1, 0, 0], n: [0, Math.sin(p), Math.cos(p)] });
      steps.push(T('Приклейте крышу на верх стен.', 'Glue the roof onto the wall tops.'));
    }
    if (roof === 'hip') {
      const a = Math.min(W, D) / 2, run = a + ov, sh = run / Math.cos(p), z0 = Hb - ov * Math.tan(p), rise = a * Math.tan(p);
      const sides = [
        { len: W, O: [-ov, -ov, z0], u: [1, 0, 0], v: [0, Math.cos(p), Math.sin(p)], n: [0, -Math.sin(p), Math.cos(p)] },
        { len: W, O: [W + ov, D + ov, z0], u: [-1, 0, 0], v: [0, -Math.cos(p), Math.sin(p)], n: [0, Math.sin(p), Math.cos(p)] },
        { len: D, O: [-ov, D + ov, z0], u: [0, -1, 0], v: [Math.cos(p), 0, Math.sin(p)], n: [-Math.sin(p), 0, Math.cos(p)] },
        { len: D, O: [W + ov, -ov, z0], u: [0, 1, 0], v: [-Math.cos(p), 0, Math.sin(p)], n: [Math.sin(p), 0, Math.cos(p)] }];
      sides.forEach((sd, i) => {
        const bl = sd.len + 2 * ov, tl = Math.max(0, sd.len - 2 * a), poly = [[[0, 0], [bl, 0], [(bl + tl) / 2, sh], [(bl - tl) / 2, sh]]].map(q => tl < .01 ? [q[0], q[1], q[2]] : q);
        const items = [cutItem(poly)], rf = roofing(o.roofing, offsetPaths(poly, -1.2), Math.max(4, Math.min(8, sh / 8))); if (rf.lines.length) items.push(engLines(rf.lines));
        let pp = poly; if (i === 0 && coinOnRoof) { pp = boolOp(poly, [rectPts(bl / 2 - 16, sh * .4, 32, 3.5)], 'diff'); items[0] = cutItem(pp) }
        add(T('Скат крыши ', 'Roof slope ') + (i + 1), items, { paths: pp, origin: sd.O, u: sd.u, v: sd.v, n: sd.n, color: rcol });
      });
      if (o.ridge !== 'none' && W === D) { const sz = Math.max(16, W * .4), A = ridgeOrnament(o.ridge === 'horse' ? 'spire' : o.ridge, 0, 0, sz); if (A.length) { const slotA = boolOp(A, [rectPts(-t / 2 - clr / 2, -2, t + clr, sz * .2 + 2)], 'diff'), slotB = boolOp(A, [rectPts(-t / 2 - clr / 2, sz * .2, t + clr, sz)], 'diff'); parts.push({ name: T('Шпиль A', 'Spire A'), items: [cutItem(slotA)], req: curReq(t) }, { name: T('Шпиль B', 'Spire B'), items: [cutItem(slotB)], req: curReq(t) }); asm.push({ paths: A, origin: [W / 2, D / 2 - t / 2, Hb + rise - 2], u: [1, 0, 0], v: [0, 0, 1], n: [0, 1, 0], t, color: dcol }); steps.push(T('Соберите шпиль крестом (пазы навстречу) и приклейте на вершину.', 'Slot the two spire pieces together crosswise and glue them onto the top.')) } }
      steps.push(T('Приклейте скаты крыши на верх стен; кромки скатов сходятся на рёбрах.', 'Glue the roof slopes onto the wall tops; their edges meet at the hips.'));
    }
    if (roof === 'crenel') steps.push(T('Верх открыт — зубцы уже вырезаны в стенах.', 'The top stays open — the battlements are cut into the walls.'));
    /* ---------- glued wall trims ---------- */
    for (const g of glued) { const items = [cutItem(g.paths)]; if (g.lines && g.lines.length) items.push(engLines(g.lines)); parts.push({ name: g.name, items, req: curReq(t) }); asm.push({ paths: g.paths, origin: g.fr.O, u: g.fr.u, v: g.fr.v, n: g.fr.out, t, color: dcol }) }
    if (glued.length) steps.push(T('Приклейте накладные детали (ставни, наличники, ящики с цветами) на стены вокруг окон.', 'Glue the trims (shutters, carved frames, flower boxes) onto the walls around the windows.'));
    /* ---------- function extras ---------- */
    if (piggy) { const r = Math.min(20, (Math.min(W, D) - 2 * t) * .28); const plug = [circlePts(0, 0, r - .05, 48)], cap = boolOp([circlePts(0, 0, r + 6, 48)], [rectPts(-r * .6, -1.5, r * 1.2, 3)], 'diff'); add(T('Копилка: пробка', 'Piggy bank: plug'), [cutItem(plug)]); add(T('Копилка: крышка дна', 'Piggy bank: bottom cap'), [cutItem(cap)]); steps.push(T('Склейте пробку с крышкой дна: пробка плотно входит в отверстие основания, монеты достаются снизу.', 'Glue the plug onto the bottom cap: the plug fits the base hole, coins come out from below.')); bom.push(T('Щель для монет 3,5×32 мм — в крыше.', 'The 3.5×32 mm coin slot is in the roof.')) }
    if (bird) { add(T('Жёрдочка', 'Perch'), [cutItem([rectPts(0, 0, 5.5, 40, 1)])]); bom.push(T(`Леток ⌀${o.hole} мм. Крыша снимается для чистки. Не красьте внутри, используйте фанеру для улицы.`, `Entrance ⌀${o.hole} mm. The roof lifts off for cleaning. Do not paint the inside; use exterior plywood.`)) }
    if (feeder) { const e = 12, tw = W + 2 * e, td = D + 2 * e; add(T('Лоток', 'Tray'), [cutItem([rectPts(0, 0, tw, td, 3)])], { paths: [rectPts(0, 0, tw, td, 3)], origin: [-e, -e, -t], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], color: hslHex(30, 25, 50) }); for (const [n, L] of [[T('Бортик лотка', 'Tray rim'), tw], [T('Бортик лотка', 'Tray rim'), tw], [T('Бортик лотка', 'Tray rim'), td - 2 * t], [T('Бортик лотка', 'Tray rim'), td - 2 * t]]) add(n, [cutItem([rectPts(0, 0, L, 12)])]); steps.push(T('Приклейте дом на лоток, по краям лотка — бортики.', 'Glue the house onto the tray and the rims around the tray edge.')) }
    if (tea) bom.push(T(`Окно для пакетиков ${fx(W - 2 * t - 10, 0)}×${o.teaH} мм внизу фасада; пакетики закладываются сверху, крышка снимается.`, `Tea bag opening ${fx(W - 2 * t - 10, 0)}×${o.teaH} mm at the bottom of the front; bags go in from the top, the lid lifts off.`));
    if (lantern || o.ledHole) bom.push(T('Отверстие в дне ⌀41 мм — для чайной свечи-светодиода. Не используйте открытый огонь внутри деревянного домика.', 'The ⌀41 mm base hole fits an LED tea light. Do not use an open flame inside a wooden house.'));
    /* ---------- fence ---------- */
    if (o.fence) {
      const ey = 30, ex = 10, yw = W + 2 * ex, yd = D + ex + ey, fh = clamp(o.fh * .38, 12, 30), slots = [], fences = [];
      const fence = (len, gate) => { const pw = 4, gap = 3, rail = 3, shapes = [rectPts(0, fh * .25, len, rail), rectPts(0, fh * .65, len, rail)]; for (let x = 1; x + pw < len; x += pw + gap) { if (gate && Math.abs(x + pw / 2 - len / 2) < 9) continue; const tip = o.picket === 'pointed' ? [[x, fh - 2.5], [x + pw / 2, fh], [x + pw, fh - 2.5]] : o.picket === 'round' ? arcPts(x + pw / 2, fh - pw / 2, pw / 2, 0, Math.PI).reverse() : o.picket === 'gothic' ? [[x, fh - 3], [x + pw / 2, fh - .5], [x + pw, fh - 3]] : [[x, fh], [x + pw, fh]]; shapes.push([[x, 0], [x + pw, 0], ...(o.picket === 'flat' ? [[x + pw, fh], [x, fh]] : tip.slice().reverse().map(q => q))]) } const tabs = [rectPts(len * .2 - fw / 2, -t, fw, t + .01), rectPts(len * .8 - fw / 2, -t, fw, t + .01)]; return { poly: boolOp(union(shapes.map(q => [q])), tabs, 'union'), tabs } };
      const ff = fence(yw - 6, true); fences.push({ n: T('Забор: перед', 'Fence: front'), poly: ff.poly, O: [-ex + 3, -ey + 1.5, 0], u: [1, 0, 0] });
      for (const sx of [0, 1]) { const sl = yd - 6, f2 = fence(sl, false); fences.push({ n: T('Забор: бок', 'Fence: side'), poly: f2.poly, O: [sx ? W + ex - 4.5 : -ex + 1.5, -ey + 3, 0], u: [0, 1, 0] }) }
      for (const f of fences) { add(f.n, [cutItem(f.poly)], { paths: f.poly, origin: f.O, u: f.u, v: [0, 0, 1], n: f.u[0] ? [0, 1, 0] : [1, 0, 0], color: hslHex(32, 30, 70) }) }
      // yard slots (tab positions)
      const yard0 = [-ex, -ey];
      for (const fx0 of [.2, .8]) slots.push(rectPts(3 + (yw - 6) * fx0 - fw / 2 - clr / 2, 1.5 - clr / 2, fw + clr, t + clr));
      for (const sx of [0, 1]) for (const fy of [.2, .8]) slots.push(rectPts(sx ? yw - 4.5 - clr / 2 : 1.5 - clr / 2, 3 + (yd - 6) * fy - fw / 2 - clr / 2, t + clr, fw + clr));
      const yard = boolOp([rectPts(0, 0, yw, yd, 4)], slots, 'diff'), path = [];
      for (let y = 3; y < ey - 2; y += 4) path.push(rectPts(W / 2 + ex - 7, y, 14, 2.6, 1).concat([[W / 2 + ex - 6, y]]));
      add(T('Двор', 'Yard'), [cutItem(yard), engLines(path)], { paths: yard, origin: [yard0[0], yard0[1], -t], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], color: hslHex(95, 20, 55) });
      steps.push(T('Приклейте дом на двор, вставьте заборчик в пазы двора.', 'Glue the house onto the yard and push the fence into the yard slots.'));
    }
    const area = parts.reduce((a, pt) => a + areaOf(pt.items[0].paths), 0), topZ = Math.max(Hb + (roof === 'gable' ? R : roof === 'gambrel' ? gR1 + gR2 : roof === 'hip' ? Math.min(W, D) / 2 * Math.tan(p) : roof === 'shed' ? shedR : 0), H);
    return {
      parts, asm, steps,
      info: T(`${parts.length} деталей · ${fx(W, 0)}×${fx(D, 0)}×${fx(topZ, 0)} мм · материал ≈ ${fmtArea(area)}`, `${parts.length} parts · ${fx(W, 0)}×${fx(D, 0)}×${fx(topZ, 0)} mm · material ≈ ${fmtArea(area)}`),
      bom: bom.concat(parts.map(pt => { const b = bboxOf(pt.items[0].paths); return `${pt.name}: ${fx(b[2] - b[0], 1)}×${fx(b[3] - b[1], 1)} ${MM()}` }), [T(`Посадка шипов: ${fitName(o.fit)} (${clr > 0 ? '+' : ''}${fx(clr, 2)} мм). Ширина реза добавится при подготовке задания.`, `Finger fit: ${fitName(o.fit)} (${clr > 0 ? '+' : ''}${fx(clr, 2)} mm). Kerf is added when the job is prepared.`)]),
    };
  }
};
