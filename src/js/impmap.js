'use strict';
/* ============================================================================
   SkyKerf_Studio · layers from imported files
   CorelDRAW, Inkscape/SVG, DXF, PDF/AI, PLT and LightBurn files carry their
   own meaning in colours, line widths, fills and layer names (red hairline =
   cut, black fill = engrave, LightBurn cut settings…). After an import every
   distinct style becomes a row: the user sees it on a preview and chooses the
   operation; sensible guesses are pre-selected and the choice can be
   remembered for the next file.
   ============================================================================ */
const IMP_OPS_LASER = () => [['cut', T('Резка', 'Cut')], ['vector', T('Гравировка по линии', 'Vector engrave')], ['mark', T('Разметка (слабо)', 'Mark / score')], ['fill', T('Гравировка заливкой', 'Fill engrave')], ['guide', T('Направляющие (не выводить)', 'Guides (no output)')], ['skip', T('Не импортировать', 'Do not import')]];
const IMP_OPS_CNC = () => [['out', cncOpName('out')], ['in', cncOpName('in')], ['on', cncOpName('on')], ['pocket', cncOpName('pocket')], ['engrave', cncOpName('engrave')], ['vcarve', cncOpName('vcarve')], ['drill', cncOpName('drill')], ['guide', T('Направляющие (не выводить)', 'Guides (no output)')], ['skip', T('Не импортировать', 'Do not import')]];
const LASER_TO_CNC = { cut: 'out', vector: 'engrave', mark: 'engrave', fill: 'pocket', raster: 'engrave', guide: 'guide', skip: 'skip' };
function rgbOf(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
function colorName(h) {
  const c = rgbOf(h); if (!c) return T('без цвета', 'no colour');
  const [r, g, b] = c, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx < 60) return T('чёрный', 'black'); if (mn > 225) return T('белый', 'white'); if (mx - mn < 30) return T('серый', 'grey');
  const hsv = (() => { const d = mx - mn; let h = 0; if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; return (h * 60 + 360) % 360 })();
  const names = [[15, T('красный', 'red')], [40, T('оранжевый', 'orange')], [70, T('жёлтый', 'yellow')], [160, T('зелёный', 'green')], [200, T('голубой', 'cyan')], [255, T('синий', 'blue')], [290, T('фиолетовый', 'violet')], [335, T('розовый', 'pink')], [361, T('красный', 'red')]];
  return names.find(n => hsv < n[0])[1];
}
const isRedish = c => c && c[0] >= 170 && c[1] <= 100 && c[2] <= 100;
const isBlueish = c => c && c[2] >= 150 && c[0] <= 90 && c[1] <= 140;
const isDark = c => c && Math.max(...c) < 80;
const IMP_NAME_RULES = [[/(^|[^a-zа-я])(cut|cutting|рез|резка|вырез|контур|outline|профил)/i, 'cut'], [/(engrav|грав|fill|залив|scan|растр|photo|фото)/i, 'fill'], [/(score|mark|размет|бигов|линии|line|надрез)/i, 'mark'], [/(guide|направ|hidden|скрыт|draft|черн|template|шаблон|подлож)/i, 'guide']];
function impKeyOf(st) { return st ? `${st.name || ''}|${st.stroke || '-'}|${st.fill || '-'}` : '|-|-' }
function impColorKey(g) { return (g.stroke || '-') + '/' + (g.fill || '-') }
/* group imported items by style */
function impGroups(out) {
  const by = new Map();
  for (const o of out) {
    const st = o.style || {}, k = impKeyOf(st);
    let g = by.get(k); if (!g) { g = { key: k, name: st.name || '', stroke: st.stroke || null, fill: st.fill || null, sw: 0, hidden: !!st.hidden, lb: st.lb || null, items: [], area: 0, closed: 0 }; by.set(k, g) }
    g.items.push(o); g.sw = Math.max(g.sw, st.sw || 0); if (o.closed) { g.closed++; const b = bboxOf(o.paths); g.area += (b[2] - b[0]) * (b[3] - b[1]) }
  }
  let gs = [...by.values()].sort((a, b) => b.items.length - a.items.length);
  if (gs.length > 12) { const rest = gs.slice(11), m = Object.assign({}, rest[0], { key: '*rest', name: T('Остальные цвета', 'Other colours'), items: rest.flatMap(g => g.items), area: rest.reduce((a, g) => a + g.area, 0), closed: rest.reduce((a, g) => a + g.closed, 0) }); gs = gs.slice(0, 11).concat([m]) }
  return gs;
}
function impMemory() { try { return JSON.parse(store.get('impMap') || '{}') || {} } catch (e) { return {} } }
const isWhiteish = c => !!c && c[0] > 235 && c[1] > 235 && c[2] > 235;
function impSuggest(gs) {
  const mem = impMemory();
  for (const g of gs) {
    const sc = rgbOf(g.stroke), fc = rgbOf(g.fill); let op = null, why = '';
    if (g.hidden) { op = 'skip'; why = T('скрыт в файле', 'hidden in the file') }
    else if (g.lb) { const k = String(g.lb.kind || 'Cut').toLowerCase(); op = /image/.test(k) || /scan|fill/.test(k) ? 'fill' : 'cut'; why = 'LightBurn: ' + g.lb.kind; if (g.lb.output === false) { op = 'guide'; why += T(' (вывод выключен)', ' (output off)') } }
    else if (mem[impColorKey(g)]) { op = mem[impColorKey(g)]; why = T('как в прошлый раз', 'as last time') }
    else { for (const [re, o] of IMP_NAME_RULES) if (g.name && re.test(g.name)) { op = o; why = T('по имени слоя', 'by layer name'); break } }
    if (!op) {
      if (!g.stroke && g.fill && isWhiteish(fc)) { op = 'skip'; why = T('белая заливка (фон или маска)', 'white fill (background or mask)') }
      else if (!g.stroke && g.fill) { op = 'fill'; why = T('заливка без контура', 'fill without outline') }
      else if (isRedish(sc)) { op = 'cut'; why = T('красная линия', 'red line') }
      else if (isBlueish(sc)) { op = 'mark'; why = T('синяя линия', 'blue line') }
      else if (g.fill && isDark(fc)) { op = 'fill'; why = T('тёмная заливка', 'dark fill') }
      else if (!g.stroke && !g.fill) { op = 'guide'; why = T('невидимый объект', 'invisible object') }
    }
    g.op = op; g.why = why;
  }
  // nothing chosen as cut: the style with the largest closed outlines is most likely the cut
  if (!gs.some(g => g.op === 'cut')) { const c = gs.filter(g => !g.op && g.closed).sort((a, b) => b.area - a.area)[0]; if (c) { c.op = 'cut'; c.why = T('самые крупные замкнутые контуры', 'largest closed outlines') } }
  for (const g of gs) if (!g.op) { g.op = g.fill && g.closed === g.items.length ? 'fill' : 'vector'; g.why = g.why || T('остальные линии', 'other lines') }
  if (!isLaser()) for (const g of gs) { const o = LASER_TO_CNC[g.op] || g.op; g.op = o === 'out' && g.closed < g.items.length ? 'on' : o }
  return gs;
}
/* which project layer gets a group: an empty layer (its colour and name follow the file) or a layer with the same operation */
function impPickLayers(gs, keepColors) {
  const used = new Set(S.shapes.map(s => s.layer)), taken = new Set(), laser = isLaser();
  const opOf = L => L.type === 'guide' ? 'guide' : laser ? L.type : L.cnc.op;
  for (const g of gs) {
    if (g.op === 'skip') { g.layer = null; continue }
    if (g.target != null && g.target !== 'auto') { g.layer = +g.target; continue }
    const same = S.layers.find(L => !taken.has(L.id) && opOf(L) === g.op && (!keepColors || (L.color || '').toLowerCase() === (g.stroke || g.fill || '').toLowerCase()) && used.has(L.id));
    if (same) { g.layer = same.id; taken.add(same.id); continue }
    const pref = { cut: 0, out: 0, fill: 1, pocket: 1, mark: 2, raster: 3, vector: 4, engrave: 2, guide: TOOL_L }[g.op];
    const free = [pref, ...S.layers.map(L => L.id)].filter(i => i != null && S.layers[i] && !used.has(i) && !taken.has(i) && (i !== TOOL_L || g.op === 'guide'));
    if (free.length) { g.layer = free[0]; g.fresh = true; taken.add(free[0]); continue }
    const any = S.layers.find(L => opOf(L) === g.op); g.layer = any ? any.id : curDrawLayer;
  }
}
function impApply(gs, keepColors, remember) {
  impPickLayers(gs, keepColors); const laser = isLaser(), mem = impMemory();
  for (const g of gs) {
    if (remember && g.key !== '*rest' && !g.lb) mem[impColorKey(g)] = laser ? g.op : (Object.entries(LASER_TO_CNC).find(([, c]) => c === g.op) || [g.op])[0];
    if (g.layer == null) continue;
    const L = S.layers[g.layer]; for (const o of g.items) o.layer = g.layer;
    if (!g.fresh && g.target != null && g.target !== 'auto') continue; // the user picked an existing layer: keep its settings
    if (g.fresh || !used0(L)) {
      if (g.op === 'guide') L.type = 'guide'; else if (laser) L.type = g.op; else { if (L.type === 'guide') L.type = 'cut'; L.cnc.op = g.op }
      if (keepColors && (g.stroke || g.fill)) L.color = g.stroke || g.fill;
      if (g.name && g.key !== '*rest') L.name = g.name.slice(0, 40);
      if (g.lb && laser) { const b = g.lb; if (b.power != null || b.speed != null) { L.auto = false; if (b.power != null) L.laser.power = clamp(b.power, 0, 100); if (b.minPower != null) L.laser.minPower = clamp(b.minPower, 0, 100); if (b.speed != null) L.laser.speed = Math.max(1, Math.round(b.speed * 60)); if (b.passes) L.laser.passes = clamp(b.passes | 0, 1, 50); if (b.interval) L.laser.interval = clamp(b.interval, .02, 2) } }
      L.on = true; L.show = true;
    }
  }
  if (remember) store.set('impMap', JSON.stringify(mem));
  function used0(L) { return S.shapes.some(s => s.layer === L.id) }
}
/* entry point used by every vector import */
function importStyled(out, kind, note, extra) {
  const styled = out.some(o => o.style && (o.style.stroke || o.style.fill || o.style.name || o.style.lb));
  const gs = styled ? impGroups(out) : [];
  if (gs.length < 2 && !(gs.length === 1 && (gs[0].lb || gs[0].hidden || (gs[0].fill && !gs[0].stroke)))) { placeImported(out, kind, note, extra); return }
  impSuggest(gs); openImportMap(out, gs, kind, note, extra);
}
let IMS = null;
function openImportMap(out, gs, kind, note, extra) {
  const laser = isLaser(), ops = laser ? IMP_OPS_LASER() : IMP_OPS_CNC();
  IMS = { out, gs, kind, note, extra, hi: -1, keep: store.get('impKeep') !== '0', remember: store.get('impRemember') !== '0' };
  const layerOpts = [['auto', T('новый слой (авто)', 'new layer (auto)')]].concat(S.layers.map(L => [String(L.id), `${String(L.id + 1).padStart(2, '0')} · ${layerName(L)}`]));
  const rows = gs.map((g, i) => {
    const sw = g.stroke || g.fill || '#888888';
    const info = [`${g.items.length} ${T('об.', 'obj')}`, g.stroke ? `${T('линия', 'line')} ${fx(g.sw || 0, 2)} ${MM()}` : '', g.fill ? T('заливка', 'fill') : '', g.lb && g.lb.power != null ? `${fx(g.lb.power, 0)}% · ${fx((g.lb.speed || 0) * 60, 0)} ${MMIN()}` : ''].filter(Boolean).join(' · ');
    return `<div class="imrow" data-imrow="${i}"><span class="imsw" style="${g.fill ? `background:${esc(g.fill)};` : ''}border-color:${esc(sw)}"></span>
      <div class="imname"><b>${esc(g.name || colorName(g.stroke || g.fill))}</b>${g.name ? ` <span class="mut">· ${esc(colorName(g.stroke || g.fill))}</span>` : ''}<small>${esc(info)}${g.why ? ' · ' + esc(g.why) : ''}</small></div>
      <select data-imop="${i}">${ops.map(([v, n]) => `<option value="${v}" ${v === g.op ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <select data-imlay="${i}" class="pro">${layerOpts.map(([v, n]) => `<option value="${v}" ${v === 'auto' ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>`;
  }).join('');
  openModal(`${ic('layers', 18)} ${T('Слои из файла', 'Layers from the file')}`,
    `<p class="note">${T('Файл содержит линии разных цветов и стилей. Выберите, что резать, что гравировать, а что не выводить. Предварительный выбор сделан по цвету, толщине, заливке и имени слоя.', 'The file has lines of different colours and styles. Choose what to cut, what to engrave and what not to output. The first guess comes from colour, width, fill and layer name.')}</p>
     <div class="imwrap"><canvas id="imPrev" width="520" height="300"></canvas><div class="imlist">${rows}</div></div>
     <div class="row wrap">${chkF(T('Цвета и имена слоёв — как в файле', 'Layer colours and names from the file'), 'id="imKeep"', IMS.keep)}${chkF(T('Запомнить выбор для этих цветов', 'Remember the choice for these colours'), 'id="imRem"', IMS.remember)}</div>
     ${note ? `<p class="note">${ic('info', 13)} ${esc(note)}</p>` : ''}`,
    `<button class="btn" id="imAllCur">${T('Всё в текущий слой', 'All into the current layer')}</button><button class="btn" data-act="closeModal">${T('Отмена', 'Cancel')}</button><button class="primary" id="imOk">${ic('check', 15)} ${T('Импортировать', 'Import')}</button>`, 'wide');
  const d = $('#dialog');
  d.querySelectorAll('[data-imop]').forEach(el => el.addEventListener('change', () => { gs[+el.dataset.imop].op = el.value; impDraw() }));
  d.querySelectorAll('[data-imlay]').forEach(el => el.addEventListener('change', () => { gs[+el.dataset.imlay].target = el.value }));
  d.querySelectorAll('[data-imrow]').forEach(el => { el.addEventListener('mouseenter', () => { IMS.hi = +el.dataset.imrow; impDraw() }); el.addEventListener('mouseleave', () => { IMS.hi = -1; impDraw() }) });
  $('#imKeep').addEventListener('change', e => { IMS.keep = e.target.checked; store.set('impKeep', e.target.checked ? '1' : '0') });
  $('#imRem').addEventListener('change', e => { IMS.remember = e.target.checked; store.set('impRemember', e.target.checked ? '1' : '0') });
  $('#imAllCur').addEventListener('click', () => { const s = IMS; IMS = null; closeModal(); for (const o of s.out) delete o.layer; placeImported(s.out, s.kind, s.note, s.extra) });
  $('#imOk').addEventListener('click', () => {
    const s = IMS; IMS = null; closeModal();
    pushUndo(T('Слои импорта', 'Import layers'));
    impApply(s.gs, s.keep, s.remember);
    const keep = s.out.filter(o => o.layer != null), skipped = s.out.length - keep.length;
    if (!keep.length) { toast(T('Все объекты пропущены — нечего импортировать.', 'Everything was skipped — nothing to import.'), 'warn'); return }
    placeImported(keep, s.kind, [s.note, skipped ? T(`не импортировано: ${skipped}`, `not imported: ${skipped}`) : ''].filter(Boolean).join(' · ') || null, s.extra, true);
  });
  impDraw();
}
function impDraw() {
  const cv = $('#imPrev'); if (!cv || !IMS) return; const g = cv.getContext('2d'), dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 520, H = cv.clientHeight || 300;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr) }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = (getComputedStyle(document.documentElement).getPropertyValue('--bed') || '').trim() || '#f4f1ea'; g.fillRect(0, 0, W, H);
  let b = null; for (const o of IMS.out) { const x = bboxOf(o.paths); b = b ? unionBox(b, x) : x } if (!b) return;
  const k = Math.min((W - 16) / Math.max(1e-6, b[2] - b[0]), (H - 16) / Math.max(1e-6, b[3] - b[1])), ox = (W - (b[2] - b[0]) * k) / 2, oy = (H - (b[3] - b[1]) * k) / 2;
  const P = (x, y) => [ox + (x - b[0]) * k, H - (oy + (y - b[1]) * k)];
  IMS.gs.forEach((gr, i) => {
    const dim = IMS.hi >= 0 && IMS.hi !== i, op = gr.op, col = gr.stroke || gr.fill || '#888';
    g.globalAlpha = op === 'skip' ? .12 : dim ? .18 : 1;
    g.setLineDash(op === 'mark' || op === 'engrave' ? [4, 3] : op === 'guide' ? [1, 3] : []);
    g.lineWidth = IMS.hi === i ? 2.2 : op === 'cut' || op === 'out' || op === 'in' ? 1.4 : 1; g.strokeStyle = op === 'guide' ? '#8a8f98' : col;
    for (const o of gr.items) {
      g.beginPath(); for (const p of o.paths) { p.forEach((q, j) => { const [x, y] = P(q[0], q[1]); j ? g.lineTo(x, y) : g.moveTo(x, y) }); if (o.closed) g.closePath() }
      if ((op === 'fill' || op === 'pocket') && o.closed) { g.fillStyle = gr.fill || col; const a = g.globalAlpha; g.globalAlpha = a * .55; g.fill('evenodd'); g.globalAlpha = a }
      g.stroke();
    }
  });
  g.globalAlpha = 1; g.setLineDash([]);
}
