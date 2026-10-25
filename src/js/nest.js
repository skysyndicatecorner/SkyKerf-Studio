'use strict';
/* ============================================================================
   SkyKerf_Studio · nesting / sheets (spec 4)
   One engine for every tool that produces parts (generators, slicer, imports,
   manual "Nest" command). Modes: one sheet, several sheets, current sheet only,
   manual. Raster true-shape placement with holes (part-in-part), exclusion
   zones, locked parts as obstacles, material compatibility and a report.
   The result is a valid layout found by a heuristic, not a proven optimum.
   ============================================================================ */
const NEST_MODES = ['one', 'multi', 'current', 'manual'];
const nestModeName = m => ({ one: T('Один лист', 'One sheet'), multi: T('Несколько листов', 'Several sheets'), current: T('Только текущий лист', 'Current sheet only'), manual: T('Ручная раскладка', 'Manual layout') })[m];
const NEST_GOALS = ['sheets', 'waste', 'balance'];
const nestGoalName = g => ({ sheets: T('Минимум листов', 'Fewest sheets'), waste: T('Минимум отхода', 'Least waste'), balance: T('Баланс', 'Balanced') })[g];
const ROT_STEPS = [0, 180, 90, 45, 15, 5];
const rotStepName = r => r === 0 ? T('без поворота', 'no rotation') : r === 180 ? T('0° / 180°', '0° / 180°') : T(`шаг ${r}°`, `${r}° steps`);
const sameMat = (sheet, req) => !req || ((req.thick == null || Math.abs((sheet.thick || 0) - req.thick) < .011) && (!req.mat || sheet.mat === req.mat));
const reasonText = r => ({ 'too-big': T('больше листа при любом повороте', 'larger than the sheet in every orientation'), 'no-space': T('не хватило места на листе', 'no room left on the sheet'), material: T('нет листа с подходящим материалом', 'no sheet with a matching material'), pinned: T('закреплённый лист заполнен', 'its pinned sheet is full'), limit: T('достигнут предел числа листов', 'sheet limit reached') })[r] || r;

/* --- footprint of one orientation: Clipper region dilated, rasterised, run spans --- */
function partFootprint(items, ang, mirror, dil, res) {
  let closed = [], open = [];
  for (const it of items) { let ps = it.paths; if (mirror) ps = mirrorPaths(ps, 0); ps = rotPaths(ps, ang); (it.closed ? closed : open).push(...ps) }
  let poly = [];
  if (hasClip()) {
    if (closed.length) poly = offsetPaths(closed, dil);
    if (open.length) poly = poly.concat(offsetOpen(open, dil));
    if (closed.length && open.length) poly = unionPaths(poly);
  } else {
    const b = bboxOf(closed.concat(open)); poly = [rectPts(b[0] - dil, b[1] - dil, b[2] - b[0] + 2 * dil, b[3] - b[1] + 2 * dil)];
  }
  if (!poly.length) return null;
  const b = bboxOf(poly), bx = Math.floor(b[0] / res) * res, by = Math.floor(b[1] / res) * res;
  const pw = Math.ceil((b[2] - bx) / res) + 1, ph = Math.ceil((b[3] - by) / res) + 1;
  const m = rasterPolys(poly, bx, by, res, pw, ph), spans = [];
  for (let r = 0; r < ph; r++) { let x = 0; while (x < pw) { while (x < pw && !m[r * pw + x]) x++; const s = x; while (x < pw && m[r * pw + x]) x++; if (x > s) spans.push([r, s, x - 1]) } }
  spans.sort((a, b2) => (b2[2] - b2[1]) - (a[2] - a[1]));
  return { ang, mirror, bx, by, pw, ph, spans };
}
function solidArea(items) { let a = 0; for (const it of items) if (it.closed) a = Math.max(a, areaOf(it.paths)); return a }

class NestGrid {
  constructor(sheet, res, dil, obstacles, zones) {
    this.sheet = sheet; this.res = res;
    const inset = Math.max(0, (sheet.margin || 0) - dil);
    this.ax = sheet.x + inset; this.ay = sheet.y + inset;
    this.gw = Math.max(1, Math.floor((sheet.w - 2 * inset) / res)); this.gh = Math.max(1, Math.floor((sheet.h - 2 * inset) / res));
    this.occ = new Uint8Array(this.gw * this.gh); this.run = new Int32Array(this.gw * this.gh);
    const obs = [];
    for (const o of obstacles || []) { if (o.closed && hasClip()) obs.push(...offsetPaths(o.paths, dil)); else if (hasClip()) obs.push(...offsetOpen(o.paths, dil)); }
    if (obs.length) rasterPolys(obs, this.ax, this.ay, res, this.gw, this.gh, this.occ);
    for (const z of zones || []) rasterPolys([rectPts(z.x, z.y, z.w, z.h)], this.ax, this.ay, res, this.gw, this.gh, this.occ);
    for (let r = 0; r < this.gh; r++) this.rowRun(r);
    this.partArea = 0; this.count = 0;
  }
  rowRun(r) { const o = r * this.gw; let c = 0; for (let x = this.gw - 1; x >= 0; x--) { c = this.occ[o + x] ? 0 : c + 1; this.run[o + x] = c } }
  find(fp) {
    const { gw, gh, run } = this, { pw, ph, spans } = fp; if (pw > gw || ph > gh) return null;
    for (let gy = 0; gy <= gh - ph; gy++) {
      let gx = 0;
      while (gx <= gw - pw) {
        let ok = true;
        for (const [r, s, e] of spans) { const v = run[(gy + r) * gw + gx + s]; if (v < e - s + 1) { gx += v + 1; ok = false; break } }
        if (ok) return [gx, gy];
      }
    }
    return null;
  }
  mark(fp, gx, gy) { for (const [r, s, e] of fp.spans) { const row = gy + r; this.occ.fill(1, row * this.gw + gx + s, row * this.gw + gx + e + 1) } const rows = new Set(fp.spans.map(s => s[0] + gy)); for (const r of rows) this.rowRun(r) }
}

/* parts: [{name, items:[{paths, closed}], req, noRotate, noMirror, pin}]
   opts : {mode, target, sheets[], template, obstacles{plate:[items]}, spacing, kerf, rot, mirror, goal, res, maxNew, onProgress} */
async function nestCompute(parts, opts) {
  const o = Object.assign({ mode: 'multi', target: 0, spacing: 3, kerf: 0, rot: 90, mirror: false, goal: 'sheets', res: 0, maxNew: 60 }, opts);
  const sheets = o.sheets.map(s => Object.assign({}, s)); const template = Object.assign({}, o.template || sheets[o.target] || sheets[0]);
  // resolution: fine enough for the smallest part, coarse enough to stay fast on big sheets
  let res = o.res;
  if (!res) {
    const big = Math.max(...sheets.map(s => s.w * s.h), template.w * template.h);
    const small = Math.min(...parts.map(p => { const b = bboxOf(p.items.flatMap(i => i.paths)); return Math.max(.5, Math.min(b[2] - b[0], b[3] - b[1])) }), 50);
    res = clamp(Math.max(Math.sqrt(big / 9e5), Math.min(small / 5, Math.sqrt(big) / 380)), .2, 4);
  }
  const dil = o.spacing / 2 + (o.kerf || 0) / 2 + res * .75;
  const step = o.rot | 0, angles = step === 0 ? [0] : step === 180 ? [0, 180] : Array.from({ length: Math.round(360 / step) }, (_, i) => i * step);
  const grids = [];
  const gridOf = i => grids[i] || (grids[i] = new NestGrid(sheets[i], res, dil, (o.obstacles && o.obstacles[i]) || [], sheets[i].zones));
  const prep = parts.map((p, i) => ({ i, p, a: solidArea(p.items) || (() => { const b = bboxOf(p.items.flatMap(x => x.paths)); return (b[2] - b[0]) * (b[3] - b[1]) })(), fps: null }));
  prep.sort((a, b) => b.a - a.a);
  const place = new Array(parts.length).fill(null), unplaced = [];
  let created = 0;
  const footprints = pp => pp.fps || (pp.fps = (() => {
    const out = []; const angs = pp.p.noRotate ? [0] : angles, mirrors = o.mirror && !pp.p.noMirror ? [false, true] : [false];
    for (const mi of mirrors) for (const a of angs) { const f = partFootprint(pp.p.items, a, mi, dil, res); if (f) out.push(f) }
    return out;
  })());
  const tryPlate = (pp, pi) => {
    const g = gridOf(pi); let best = null;
    for (const fp of footprints(pp)) {
      const pos = g.find(fp); if (!pos) continue;
      const score = o.goal === 'balance' ? (pos[1] + fp.ph) * g.gw + pos[0] : pos[1] * g.gw + pos[0];
      if (!best || score < best.score) best = { fp, pos, score };
    }
    return best;
  };
  const commit = (pp, pi, best) => { const g = gridOf(pi); g.mark(best.fp, best.pos[0], best.pos[1]); g.partArea += pp.a; g.count++; place[pp.i] = { plate: pi, ang: best.fp.ang, mirror: best.fp.mirror, tx: g.ax + best.pos[0] * res - best.fp.bx, ty: g.ay + best.pos[1] * res - best.fp.by } };
  for (let k = 0; k < prep.length; k++) {
    const pp = prep[k];
    if (o.onProgress && k % 2 === 0) { o.onProgress(k, prep.length); await sleep(0) }
    let cands;
    if (pp.p.pin != null && pp.p.pin < sheets.length) cands = [pp.p.pin];
    else if (o.mode === 'multi') { cands = sheets.map((_, i) => i).filter(i => sameMat(sheets[i], pp.p.req)); if (o.goal === 'waste') cands.sort((a, b) => (grids[b] ? grids[b].partArea : 0) - (grids[a] ? grids[a].partArea : 0)) }
    else cands = sameMat(sheets[o.target], pp.p.req) ? [o.target] : [];
    let done = false;
    for (const pi of cands) { const best = tryPlate(pp, pi); if (best) { commit(pp, pi, best); done = true; break } }
    if (done) continue;
    if (o.mode === 'multi' && pp.p.pin == null) {
      if (created >= o.maxNew) { unplaced.push({ i: pp.i, reason: 'limit' }); continue }
      const tpl = Object.assign({}, template, { zones: [], id: null, name: '' });
      if (pp.p.req && !sameMat(tpl, pp.p.req)) { if (pp.p.req.thick != null) tpl.thick = pp.p.req.thick; if (pp.p.req.mat) tpl.mat = pp.p.req.mat; tpl._matChanged = true }
      sheets.push(tpl); const ni = sheets.length - 1; created++;
      const best = tryPlate(pp, ni);
      if (best) commit(pp, ni, best); else { sheets.pop(); grids.length = Math.min(grids.length, sheets.length); created--; unplaced.push({ i: pp.i, reason: 'too-big' }) }
      continue;
    }
    // explain why it failed
    let reason = 'no-space';
    if (!cands.length) reason = 'material';
    else if (pp.p.pin != null) reason = 'pinned';
    else { const empty = new NestGrid(Object.assign({}, sheets[cands[0]], { zones: [] }), res, dil, [], []); if (!footprints(pp).some(fp => empty.find(fp))) reason = 'too-big' }
    unplaced.push({ i: pp.i, reason });
  }
  if (o.onProgress) o.onProgress(prep.length, prep.length);
  const perPlate = grids.map((g, i) => g ? { plate: i, count: g.count, partArea: g.partArea, sheetArea: sheets[i].w * sheets[i].h } : null).filter(Boolean).filter(x => x.count);
  const pa = perPlate.reduce((s, x) => s + x.partArea, 0), sa = perPlate.reduce((s, x) => s + x.sheetArea, 0);
  return { place, unplaced, sheets, created, res, perPlate, usage: sa ? pa / sa : 0, partArea: pa, sheetArea: sa, waste: Math.max(0, sa - pa), matChanged: sheets.some(s => s._matChanged) };
}

/* ======================= app side: units, dialog, apply ======================= */
function unitsOf(shapes) { const m = new Map(); for (const s of shapes) { const k = s.g ? 'g' + s.g : 's' + s.id; (m.get(k) || m.set(k, []).get(k)).push(s) } return [...m.values()] }
const unitName = u => u[0].nm || (u[0].g && S.groups[u[0].g] && S.groups[u[0].g].nm) || kindNameOf(u[0]);
function kindNameOf(s) { return ({ rect: T('Прямоугольник', 'Rectangle'), ellipse: T('Эллипс', 'Ellipse'), polygon: T('Многоугольник', 'Polygon'), star: T('Звезда', 'Star'), line: T('Линия', 'Line'), pen: T('Ломаная', 'Polyline'), text: T('Текст', 'Text'), svg: 'SVG', dxf: 'DXF', trace: T('Трассировка', 'Trace'), image: T('Фото', 'Photo'), relief: T('Рельеф', 'Relief'), bool: T('Контур', 'Shape'), offset: T('Смещение', 'Offset'), part: T('Деталь', 'Part'), tile: T('Часть', 'Tile') })[s.kind] || T('Фигура', 'Shape') }
function unitReq(u) { const r = u.find(s => s.req); return r ? r.req : null }
const toLocal = (paths, plate) => { const X = plateX(plate); return mapPaths(paths, (x, y) => [x - X, y]) };

let NS = null; // nesting dialog state
/* Open the nesting dialog.
   source: {kind:'new', parts:[...], title, onApply?}  (generator / slicer output not yet in the project)
        or {kind:'existing', units:[[shape...],...]}     (re-nest shapes already in the project) */
function openNest(source) {
  const n = S.nest;
  if (source.kind === 'new') for (const p of source.parts) if (p.items.some(it => it.kind === 'text' || it.kind === 'image')) p.noMirror = true;
  NS = { source, mode: source.kind === 'new' ? n.mode : (n.mode === 'manual' ? 'multi' : n.mode), target: curPlate, spacing: n.spacing, rot: n.rot, mirror: n.mirror, goal: n.goal, res: n.res, kerf: n.kerf, allowNew: true, variants: [], cur: -1, busy: false };
  const cnt = source.kind === 'new' ? source.parts.length : source.units.length;
  openModal(`${ic('nest', 18)} ${source.title || T('Раскладка деталей', 'Nest parts')} <span class="pill mut">${cnt} ${T('дет.', 'parts')}</span>`,
    `<div class="ws-view"><canvas id="nestCv"></canvas><div class="badge" id="nestBadge">${T('Выберите режим и нажмите «Рассчитать».', 'Choose a mode and press “Compute”.')}</div></div><div class="ws-side" id="nestSide"></div>`,
    `<p class="note" id="nestNote">${T('Результат — найденный допустимый вариант, а не доказанный оптимум.', 'The result is a valid layout found by a heuristic, not a proven optimum.')}</p><button class="btn" data-act="closeModal">${T('Отмена', 'Cancel')}</button><button class="btn" data-act="nestRun">${ic('nest', 15)} ${T('Рассчитать вариант', 'Compute variant')}</button><button class="primary" data-act="nestApply" id="nestApplyBtn" disabled>${T('Применить', 'Apply')}</button>`, 'xl');
  onModalClose = () => { NS = null };
  renderNestSide(); nestDraw();
  if (NS.mode !== 'manual') setTimeout(() => nestRun(), 50);
}
function renderNestSide() {
  if (!NS) return; const el = $('#nestSide'); if (!el) return;
  const sheetsOpts = S.sheets.map((sh, i) => [i, `${sheetName(sh, i)} · ${fx(sh.w, 0)}×${fx(sh.h, 0)} · ${matLabel(matById(sh.mat), sh.thick)}`]);
  const v = NS.cur >= 0 ? NS.variants[NS.cur] : null;
  el.innerHTML = `<div class="sec"><h3>${T('Режим', 'Mode')}${infoBtn('nestMode')}</h3>
   <div class="modes">${NEST_MODES.filter(m => NS.source.kind === 'new' || m !== 'manual').map(m => `<label class="radio"><input type="radio" name="nestMode" value="${m}" ${NS.mode === m ? 'checked' : ''}><span><b>${nestModeName(m)}</b><small>${({ one: T('Всё на выбранный лист. Новые листы не создаются.', 'Everything on the chosen sheet. No new sheets.'), multi: T('Распределить по листам с подходящим материалом, при нехватке — добавить новые.', 'Spread over sheets with a matching material, add new ones if needed.'), current: T('Только текущий лист. Другие листы не меняются.', 'Current sheet only. Other sheets stay untouched.'), manual: T('Положить детали рядом, дальше расставите сами.', 'Drop parts in a row and arrange them yourself.') })[m]}</small></span></label>`).join('')}</div>
   ${NS.mode === 'one' ? selF(T('Лист', 'Sheet'), 'data-ns="target"', sheetsOpts, NS.target) : ''}
   ${NS.mode === 'multi' ? `${selF(T('Шаблон новых листов', 'Template for new sheets'), 'data-ns="target"', sheetsOpts, NS.target)}${chkF(T('Разрешить добавлять листы', 'Allow adding sheets'), 'data-ns="allowNew"', NS.allowNew)}` : ''}</div>
   <div class="sec"><h3>${T('Параметры', 'Settings')}</h3>
   <div class="grid2">${numF(T('Зазор между деталями', 'Gap between parts'), 'data-ns="spacing" min="0"', NS.spacing, MM(), .5, '', 'nestSpacing')}${selF(T('Поворот', 'Rotation'), 'data-ns="rot"', ROT_STEPS.map(r => [r, rotStepName(r)]), NS.rot, '', 'nestRot')}
   ${selF(T('Цель', 'Goal'), 'data-ns="goal"', NEST_GOALS.map(g => [g, nestGoalName(g)]), NS.goal, '', 'nestGoal')}${selF(T('Точность сетки', 'Grid precision'), 'data-ns="res"', [[0, T('авто', 'auto')], [.25, '0.25 ' + MM()], [.5, '0.5 ' + MM()], [1, '1 ' + MM()], [2, '2 ' + MM()]], NS.res, 'pro', 'nestRes')}</div>
   ${chkF(T('Учитывать ширину реза (керф)', 'Allow for kerf'), 'data-ns="kerf"', NS.kerf, '', 'kerf')}
   ${chkF(T('Разрешить зеркальное отражение', 'Allow mirroring'), 'data-ns="mirror"', NS.mirror, 'pro', 'nestMirror')}
   <p class="note">${T('Поля листа и запретные зоны задаются в панели «Листы». Закреплённые детали остаются на месте и служат препятствиями.', 'Sheet margins and no-go zones are set in the Sheets panel. Locked parts stay put and act as obstacles.')}</p></div>
   <div class="sec"><h3>${T('Отчёт', 'Report')}</h3><div id="nestReport">${v ? nestReportHtml(v) : `<p class="note">${T('Ещё не рассчитано.', 'Not computed yet.')}</p>`}</div></div>
   ${NS.variants.length ? `<div class="sec"><h3>${T('Варианты для сравнения', 'Variants to compare')}</h3><table class="tbl"><thead><tr><th></th><th>${T('Режим', 'Mode')}</th><th>${T('Листов', 'Sheets')}</th><th>${T('Заполн.', 'Fill')}</th><th>${T('Вне', 'Left')}</th></tr></thead><tbody>${NS.variants.map((x, i) => `<tr class="${i === NS.cur ? 'on' : ''}" data-act="nestPick" data-v="${i}"><td><b>${String.fromCharCode(65 + i)}</b></td><td>${esc(nestModeName(x.opts.mode))}<br><small>${esc(rotStepName(x.opts.rot))}, ${fx(x.opts.spacing, 1)} ${MM()}</small></td><td>${x.usedPlates}${x.res.created ? ` <small>(+${x.res.created})</small>` : ''}</td><td>${Math.round(x.res.usage * 100)}%</td><td>${x.res.unplaced.length}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
}
function nestReportHtml(v) {
  const r = v.res, partsList = v.parts;
  const un = r.unplaced.map(u => `<div class="warnline">${ic('warn', 13)} ${esc(partsList[u.i].name || T('Деталь', 'Part'))}: ${esc(reasonText(u.reason))}</div>`).join('');
  return `<div class="statgrid"><div class="stat"><span>${T('Размещено', 'Placed')}</span><b>${partsList.length - r.unplaced.length} / ${partsList.length}</b></div><div class="stat"><span>${T('Листов задействовано', 'Sheets used')}</span><b>${v.usedPlates}${r.created ? ` (+${r.created} ${T('нов.', 'new')})` : ''}</b></div>
   <div class="stat"><span>${T('Заполнение', 'Utilisation')}</span><b>${Math.round(r.usage * 100)}%</b></div><div class="stat"><span>${T('Отход (оценка)', 'Waste (est.)')}</span><b>${fmtArea(r.waste)}</b></div></div>
   <div class="kv"><span>${T('Площадь деталей', 'Parts area')}</span><b>${fmtArea(r.partArea)}</b><span>${T('Площадь листов', 'Sheets area')}</span><b>${fmtArea(r.sheetArea)}</b><span>${T('Сетка', 'Grid')}</span><b>${fx(r.res, 2)} ${MM()}</b></div>
   ${r.matChanged ? `<div class="warnline">${ic('warn', 13)} ${T('Для части деталей созданы листы другого материала/толщины — проверьте их в панели «Листы».', 'Some new sheets use a different material/thickness to match the parts — check them in the Sheets panel.')}</div>` : ''}
   ${un ? `<div class="unplaced"><b>${T('Не размещены', 'Not placed')} (${r.unplaced.length})</b>${un}<p class="note">${T('Они не пропадут: после применения окажутся в зоне «Неразмещённые» под листами, откуда их можно перетащить вручную.', 'They are kept: after applying they appear in the “Unplaced” area under the sheets, where you can drag them by hand.')}</p></div>` : `<p class="note ok">${ic('check', 13)} ${T('Все детали размещены.', 'All parts placed.')}</p>`}`;
}
function nestParts() {
  if (NS.source.kind === 'new') return NS.source.parts;
  return NS.source.units.map(u => ({ name: unitName(u), items: u.map(s => ({ paths: toLocal(s.paths, plateOf(s)), closed: s.closed || s.kind === 'image' })), req: unitReq(u), noRotate: u.some(s => s.kind === 'image' || s.kind === 'relief'), noMirror: u.some(s => s.kind === 'text' || s.kind === 'image' || s.kind === 'relief') }));
}
async function nestRun() {
  if (!NS || NS.busy) return;
  if (NS.mode === 'manual') { toast(T('Ручная раскладка: детали лягут в ряд на текущем листе.', 'Manual layout: parts will be placed in a row on the current sheet.')); $('#nestApplyBtn').disabled = false; return }
  NS.busy = true; const my = NS;
  const parts = nestParts(), moving = movingIds();
  const target = NS.mode === 'current' ? curPlate : NS.target;
  const obstacles = {};
  S.sheets.forEach((_, i) => { obstacles[i] = S.shapes.filter(s => !moving.has(s.id) && !s.parked && plateOf(s) === i).map(s => ({ paths: toLocal(s.paths, i), closed: s.closed || s.kind === 'image' })) });
  const opts = { mode: NS.mode, target, sheets: S.sheets, template: sheetAt(target), obstacles, spacing: NS.spacing, kerf: NS.kerf ? kerfAllowance() : 0, rot: NS.rot, mirror: NS.mirror, goal: NS.goal, res: NS.res, maxNew: NS.allowNew ? 60 : 0, onProgress: (k, n) => busy(T(`Раскладка: ${k} из ${n}`, `Nesting: ${k} of ${n}`)) };
  let res;
  try { res = await nestCompute(parts, opts) } catch (e) { logError('nest', e); busy(null); toast(T('Ошибка раскладки: ', 'Nesting failed: ') + e.message, 'err'); NS.busy = false; return } finally { busy(null) }
  if (NS !== my) return;
  NS.busy = false;
  const usedPlates = new Set(res.place.filter(Boolean).map(p => p.plate)).size;
  NS.variants.push({ opts: Object.assign({}, opts, { obstacles: null, sheets: null }), res, parts, usedPlates }); if (NS.variants.length > 6) NS.variants.shift();
  NS.cur = NS.variants.length - 1; $('#nestApplyBtn').disabled = false;
  if (NS.source.auto && NS.variants.length === 1) { if (!res.unplaced.length && res.sheets.length === S.sheets.length) { NS.quick = true; await nestApply(); return } $('#modal').hidden = false }
  $('#nestBadge').textContent = `${T('Вариант', 'Variant')} ${String.fromCharCode(65 + NS.cur)}: ${usedPlates} ${T(plural(usedPlates, 'лист', 'листа', 'листов'), usedPlates === 1 ? 'sheet' : 'sheets')}, ${Math.round(res.usage * 100)}% · ${T('не размещено', 'not placed')}: ${res.unplaced.length}`;
  renderNestSide(); nestDraw();
}
function kerfAllowance() { const L = S.layers.find(l => l.type === 'cut'); if (!L) return 0; const r = isLaser() ? resolveLaser(L, sheetAt(curPlate)) : null; return isLaser() ? (r.kerf || 0) : 0 }
function nestDraw() {
  const c2 = $('#nestCv'); if (!c2 || !NS) return; const r = c2.getBoundingClientRect(), d = window.devicePixelRatio || 1; if (!r.width) return; c2.width = Math.round(r.width * d); c2.height = Math.round(r.height * d);
  const c = c2.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, r.width, r.height);
  const v = NS.cur >= 0 ? NS.variants[NS.cur] : null, sheets = v ? v.res.sheets : S.sheets;
  const used = v ? [...new Set(v.res.place.filter(Boolean).map(p => p.plate))].sort((a, b) => a - b) : [NS.mode === 'current' ? curPlate : NS.target];
  const show = used.length ? used : [0], n = show.length, cols = Math.ceil(Math.sqrt(n * r.width / r.height)), rows = Math.ceil(n / cols);
  const mw = Math.max(...show.map(i => sheets[i].x + sheets[i].w)), mh = Math.max(...show.map(i => sheets[i].y + sheets[i].h));
  const cw = (r.width - 24) / cols, chh = (r.height - 56) / rows, s = Math.min((cw - 16) / mw, (chh - 26) / mh);
  show.forEach((pi, k) => {
    const sh = sheets[pi], ox = 12 + (k % cols) * cw + 8, oy = 12 + Math.floor(k / cols) * chh + 18, P = (x, y) => [ox + x * s, oy + (mh - y) * s];
    c.fillStyle = css('--muted'); c.font = `600 11px ${css('--f-ui')}`; c.textAlign = 'left'; c.textBaseline = 'bottom';
    c.fillText(`${sheetName(sh, pi)}${pi >= S.sheets.length ? ' · ' + T('новый', 'new') : ''} · ${fx(sh.w, 0)}×${fx(sh.h, 0)}`, ox, oy - 4);
    const [a0, b0] = P(sh.x, sh.y + sh.h); c.fillStyle = css('--sheet'); c.fillRect(a0, b0, sh.w * s, sh.h * s); c.strokeStyle = css('--sheet-line'); c.strokeRect(a0 + .5, b0 + .5, sh.w * s, sh.h * s);
    for (const z of sh.zones || []) { const [za, zb] = P(z.x, z.y + z.h); c.fillStyle = 'rgba(229,72,77,.18)'; c.fillRect(za, zb, z.w * s, z.h * s) }
    const draw = (items, col, fill) => { c.beginPath(); for (const it of items) for (const p of it.paths) { p.forEach((q, i) => { const [X, Y] = P(q[0], q[1]); i ? c.lineTo(X, Y) : c.moveTo(X, Y) }); if (it.closed) c.closePath() } if (fill) { c.fillStyle = fill; c.fill('evenodd') } c.strokeStyle = col; c.lineWidth = 1; c.stroke() };
    // obstacles
    if (pi < S.sheets.length) { const moving = movingIds(); draw(S.shapes.filter(x => !moving.has(x.id) && !x.parked && plateOf(x) === pi).map(x => ({ paths: toLocal(x.paths, pi), closed: x.closed })), css('--faint'), null) }
    if (v) v.res.place.forEach((pl, i) => { if (!pl || pl.plate !== pi) return; const items = v.parts[i].items.map(it => ({ closed: it.closed, paths: mapPaths(rotPaths(pl.mirror ? mirrorPaths(it.paths, 0) : it.paths, pl.ang), (x, y) => [x + pl.tx, y + pl.ty]) })); draw(items, css('--accent'), css('--accent-soft')) });
  });
}
/* Apply the chosen variant. New parts become shapes; existing units are moved. */
async function nestApply() {
  if (!NS) return; const src = NS.source;
  Object.assign(S.nest, { mode: NS.mode, spacing: NS.spacing, rot: NS.rot, mirror: NS.mirror, goal: NS.goal, res: NS.res, kerf: NS.kerf });
  if (NS.mode === 'manual') { const parts = nestParts(); closeModal(); manualPlace(parts, src); return }
  const v = NS.variants[NS.cur]; if (!v) return;
  pushUndo(src.kind === 'new' ? (src.title || T('Добавление деталей', 'Add parts')) : T('Раскладка', 'Nesting'));
  // new sheets
  for (let i = S.sheets.length; i < v.res.sheets.length; i++) { const t = v.res.sheets[i]; S.sheets.push(newSheet({ w: t.w, h: t.h, x: t.x, y: t.y, mat: t.mat, thick: t.thick, margin: t.margin })) }
  const ids = new Set(), unplacedIdx = new Set(v.res.unplaced.map(u => u.i));
  const xf = (paths, pl) => mapPaths(rotPaths(pl.mirror ? mirrorPaths(paths, 0) : paths, pl.ang), (x, y) => [x + pl.tx + plateX(pl.plate), y + pl.ty]);
  if (src.kind === 'new') {
    let parkX = 0;
    v.parts.forEach((pt, i) => {
      const pl = v.res.place[i], g = S.nextG++; S.groups[g] = Object.assign({ nm: pt.name }, pt.group || {});
      let items = pt.items;
      if (!pl) { const b = bboxOf(items.flatMap(it => it.paths)); items = items.map(it => Object.assign({}, it, { paths: mapPaths(it.paths, (x, y) => [x - b[0] + parkX, y - b[3] - 20]) })); parkX += b[2] - b[0] + 6 }
      for (const it of items) { const s = addShape(S, it.layer ?? 0, it.kind || 'part', pl ? xf(it.paths, pl) : it.paths, it.closed, Object.assign({ g, nm: pt.name }, pt.req ? { req: pt.req } : {}, it.extra || {}, pl ? {} : { parked: true })); if (pl && s.kind === 'text') s.rot = ((s.rot || 0) + pl.ang) % 360; ids.add(s.id) }
    });
    if (src.onApply) src.onApply(ids);
  } else {
    let parkX = 0;
    src.units.forEach((u, i) => {
      const pl = v.res.place[i];
      if (!pl) { const b = bboxOf(u.flatMap(s => s.paths)); for (const s of u) { s.paths = mapPaths(s.paths, (x, y) => [x - b[0] + parkX, y - b[3] - 20]); s.parked = true } parkX += b[2] - b[0] + 6; return }
      for (const s of u) {
        const local = toLocal(s.paths, plateOf(s)); s.paths = xf(local, pl); delete s.parked;
        if (s.kind === 'text') s.rot = ((s.rot || 0) + pl.ang) % 360;
        if (s.kind === 'image' && pl.mirror) s.img.fx = !s.img.fx;
        ids.add(s.id);
      }
    });
  }
  sel = ids; const first = v.res.place.find(Boolean); if (first) curPlate = first.plate;
  const n = v.parts.length - unplacedIdx.size;
  const quick = NS && NS.quick; closeModal(); changed(); fitPlate(curPlate); draw();
  if (quick) { toast(T(`Добавлено: ${n} ${plural(n, 'деталь', 'детали', 'деталей')}` + (v.usedPlates > 1 ? `, листов: ${v.usedPlates}.` : '.'), `Added ${n} part${n === 1 ? '' : 's'}` + (v.usedPlates > 1 ? `, sheets: ${v.usedPlates}.` : '.')), '', [{ label: T('Отменить', 'Undo'), act: 'undo' }, { label: T('Раскладка…', 'Layout…'), act: 'nestRedo' }]); return }
  toast(T(`Размещено: ${n} из ${v.parts.length}. Листов: ${v.usedPlates}, заполнение ≈ ${Math.round(v.res.usage * 100)}%.`, `Placed ${n} of ${v.parts.length}. Sheets: ${v.usedPlates}, ≈ ${Math.round(v.res.usage * 100)}% used.`) + (unplacedIdx.size ? T(` Не размещено: ${unplacedIdx.size} — они в зоне «Неразмещённые».`, ` Not placed: ${unplacedIdx.size} — see the “Unplaced” area.`) : ''));
}
function manualPlace(parts, src) {
  pushUndo(src.title || T('Добавление деталей', 'Add parts'));
  const sh = sheetAt(curPlate), X0 = plateX(curPlate) + sh.x + sh.margin; let x = X0, y = sh.y + sh.margin, rowH = 0; const ids = new Set();
  for (const pt of parts) {
    const b = bboxOf(pt.items.flatMap(it => it.paths)), w = b[2] - b[0], h = b[3] - b[1];
    if (x + w > X0 + sh.w - 2 * sh.margin && x > X0) { x = X0; y += rowH + S.nest.spacing; rowH = 0 }
    const g = S.nextG++; S.groups[g] = Object.assign({ nm: pt.name }, pt.group || {});
    for (const it of pt.items) { const s = addShape(S, it.layer ?? 0, it.kind || 'part', mapPaths(it.paths, (px, py) => [px - b[0] + x, py - b[1] + y]), it.closed, Object.assign({ g, nm: pt.name }, pt.req ? { req: pt.req } : {}, it.extra || {})); ids.add(s.id) }
    x += w + S.nest.spacing; rowH = Math.max(rowH, h);
  }
  if (src.onApply) src.onApply(ids);
  sel = ids; changed(); fitPlate(curPlate); draw();
  toast(T('Детали добавлены в ряд. Расставьте их вручную или нажмите «Раскладка».', 'Parts added in a row. Arrange them by hand or press “Nest”.'));
}
/* Entry point used by generators, slicer and importers (spec 4: one shared subsystem). */
/* opts.exclude: ids of shapes that the caller will remove in onApply (old version of a
   regenerated product, the original of a split part) — they must not block the layout. */
let LASTPLACE = null;
/* When the parts fit on the existing sheets, they are placed at once (no dialog) and a toast offers Undo / Adjust.
   The dialog opens when something does not fit, when the user asks for it, or when quick placement is off. */
function placeParts(parts, opts) {
  opts = opts || {}; LASTPLACE = { parts: deepCopy(parts), opts: Object.assign({}, opts) };
  const auto = !opts.dialog && store.get('nestAuto') !== '0' && S.nest.mode !== 'manual';
  openNest({ kind: 'new', parts, title: opts.title, onApply: opts.onApply, exclude: opts.exclude, auto });
  if (auto) $('#modal').hidden = true; // computed silently; shown only if the parts do not fit
}
function movingIds() { if (!NS) return new Set(); const src = NS.source; return src.kind === 'existing' ? new Set(src.units.flat().map(s => s.id)) : new Set(src.exclude || []) }
function nestExisting() {
  let pool = selShapes().filter(s => !s.lock);
  if (!pool.length) pool = S.shapes.filter(s => !s.lock && (s.parked || plateOf(s) === curPlate));
  if (!pool.length) { toast(T('Нечего раскладывать: нет незакреплённых деталей.', 'Nothing to nest: no unlocked parts.')); return }
  // whole groups move together
  const gs = new Set(pool.filter(s => s.g).map(s => s.g)); pool = S.shapes.filter(s => !s.lock && (pool.includes(s) || (s.g && gs.has(s.g))));
  openNest({ kind: 'existing', units: unitsOf(pool), title: T('Раскладка', 'Nest') });
}

/* ======================= saved layout variants (spec 4.2) ======================= */
function saveLayout(name) {
  const snapShapes = S.shapes.map(s => ({ id: s.id, paths: s.paths, parked: !!s.parked, rot: s.rot }));
  const bytes = JSON.stringify(snapShapes).length;
  pushUndo(T('Сохранение варианта раскладки', 'Save layout variant'));
  S.layouts.push({ name: name || T('Вариант ', 'Variant ') + (S.layouts.length + 1), date: new Date().toISOString(), sheets: deepCopy(S.sheets), shapes: deepCopy(snapShapes) });
  if (S.layouts.length > 8) S.layouts.shift();
  changed(); toast(T(`Вариант сохранён (${Math.round(bytes / 1024)} КБ в проекте).`, `Variant saved (${Math.round(bytes / 1024)} KB in the project).`));
}
function restoreLayout(i) {
  const L = S.layouts[i]; if (!L) return; pushUndo(T('Восстановление раскладки', 'Restore layout'));
  const map = new Map(L.shapes.map(s => [s.id, s])); let miss = 0;
  for (const s of S.shapes) { const o = map.get(s.id); if (!o) { miss++; continue } s.paths = deepCopy(o.paths); if (o.parked) s.parked = true; else delete s.parked; if (o.rot != null) s.rot = o.rot }
  S.sheets = deepCopy(L.sheets); curPlate = Math.min(curPlate, S.sheets.length - 1); changed(); fitPlate(curPlate); draw();
  toast(T(`Раскладка «${L.name}» восстановлена.`, `Layout “${L.name}” restored.`) + (miss ? T(` Новых объектов не было в варианте: ${miss} — они остались на местах.`, ` ${miss} newer objects were not in the variant and stayed where they are.`) : ''));
}

/* ======================= geometry checks (spec 4.3, 6.4) ======================= */
function checkGeometry(plate) {
  const issues = [], sh = sheetAt(plate), X = plateX(plate), rect = [X + sh.x, sh.y, X + sh.x + sh.w, sh.y + sh.h];
  const shapes = S.shapes.filter(s => !s.parked && plateOf(s) === plate && layerOut(S.layers[s.layer]) && S.layers[s.layer].on);
  const kerf = isLaser() ? kerfAllowance() / 2 : 0;
  for (const s of shapes) {
    const b = bboxOf(s.paths), k = S.layers[s.layer].type === 'cut' ? kerf : 0;
    if (b[0] - k < rect[0] - .01 || b[1] - k < rect[1] - .01 || b[2] + k > rect[2] + .01 || b[3] + k > rect[3] + .01) issues.push({ level: 'error', ids: [s.id], msg: T(`«${unitName([s])}» выходит за лист материала.`, `“${unitName([s])}” extends beyond the material sheet.`) });
    for (const z of sh.zones || []) { if (boxOverlap(b, [X + z.x, z.y, X + z.x + z.w, z.y + z.h])) issues.push({ level: 'error', ids: [s.id], msg: T(`«${unitName([s])}» заходит в запретную зону.`, `“${unitName([s])}” enters a no-go zone.`) }) }
    if (s.closed && s.kind !== 'image' && s.paths.length < 60 && s.paths.some(p => selfIntersects(p, true))) issues.push({ level: 'warn', ids: [s.id], msg: T(`Самопересекающийся контур: «${unitName([s])}».`, `Self-intersecting outline: “${unitName([s])}”.`) });
    if (!s.closed && S.layers[s.layer].type === 'cut' && s.kind !== 'part') issues.push({ level: 'info', ids: [s.id], msg: T(`Открытый контур на слое резки: «${unitName([s])}» — деталь не отделится.`, `Open outline on a cut layer: “${unitName([s])}” — the part will not come free.`) });
  }
  // overlaps between different units (cut layer outlines)
  const units = unitsOf(shapes).map(u => ({ u, b: bboxOf(u.flatMap(s => s.paths)), reg: u.filter(s => s.closed && S.layers[s.layer].type === 'cut').flatMap(s => s.paths) })).filter(x => x.reg.length);
  let overlaps = 0;
  for (let i = 0; i < units.length && overlaps < 30; i++) for (let j = i + 1; j < units.length && overlaps < 30; j++) {
    const A = units[i], B = units[j]; if (!boxOverlap(A.b, B.b, -S.nest.spacing)) continue;
    const inter = hasClip() ? boolOp(A.reg, B.reg, 'inter') : []; const ia = inter.length ? areaOf(inter) : 0;
    const contained = ia > 0 && (Math.abs(ia - areaOf(B.reg)) < .5 || Math.abs(ia - areaOf(A.reg)) < .5);
    if (ia > .05 && !contained) { overlaps++; issues.push({ level: 'error', ids: A.u.concat(B.u).map(s => s.id), msg: T(`Детали «${unitName(A.u)}» и «${unitName(B.u)}» пересекаются.`, `Parts “${unitName(A.u)}” and “${unitName(B.u)}” overlap.`) }) }
    else if (!ia && S.nest.spacing > 0) {
      const d = minDistPaths(A.reg, B.reg, S.nest.spacing); if (d < S.nest.spacing * .5) issues.push({ level: 'warn', ids: A.u.concat(B.u).map(s => s.id), msg: T(`Детали «${unitName(A.u)}» и «${unitName(B.u)}» ближе ${fx(d, 2)} мм друг к другу.`, `Parts “${unitName(A.u)}” and “${unitName(B.u)}” are only ${fx(d, 2)} mm apart.`) });
    }
  }
  // duplicates (overburn)
  const dups = findDuplicatePaths(shapes.filter(s => s.kind !== 'image').map(s => ({ id: s.id, paths: s.paths, closed: s.closed })));
  if (dups.length) issues.push({ level: 'warn', ids: [...new Set(dups.map(d => d.b.id))], dup: dups, msg: T(`Найдено повторяющихся контуров: ${dups.length} — они будут обработаны дважды (перегрев, лишний рез).`, `${dups.length} duplicate outlines found — they would be processed twice (overburn).`) });
  const parked = S.shapes.filter(s => s.parked).length;
  if (parked) issues.push({ level: 'info', ids: S.shapes.filter(s => s.parked).map(s => s.id), msg: T(`Неразмещённых объектов: ${parked} — они не попадут в задание.`, `${parked} unplaced objects will not be included in the job.`) });
  return issues;
}
function removeDuplicates(dups) {
  pushUndo(T('Удаление дубликатов', 'Remove duplicates'));
  const byShape = new Map(); for (const d of dups) { const l = byShape.get(d.b.id) || []; l.push(d.b.idx); byShape.set(d.b.id, l) }
  let n = 0; for (const [id, idxs] of byShape) { const s = shapeById(id); if (!s) continue; s.paths = s.paths.filter((_, i) => !idxs.includes(i)); n += idxs.length; if (!s.paths.length) S.shapes = S.shapes.filter(q => q !== s) }
  changed(); toast(T(`Удалено повторов: ${n}.`, `Removed ${n} duplicates.`));
}
