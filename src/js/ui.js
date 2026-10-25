'use strict';
/* ============================================================================
   SkyKerf_Studio · UI shell: change tracking, autosave, top bar, floating
   bars, left/right panels for the four tabs, status bar.
   Dialogs live in dialogs.js, event wiring and boot in app.js.
   ============================================================================ */
const DESK = window.skykerfDesktop || null;
let camSel = null, objQ = '', projPath = null, dirty = false, REVMAX = 0, saveT = 0, migratedFrom = null, OBJ = [];
const SHEET_PRESETS = [['A4', 297, 210], ['A3', 420, 297], ['300×200', 300, 200], ['400×300', 400, 300], ['600×400', 600, 400], ['1220×610', 1220, 610]];
const fileSysPath = f => { try { return DESK && DESK.pathForFile ? DESK.pathForFile(f) || null : (f && f.path) || null } catch (e) { return null } };

/* ---------------- change tracking ---------------- */
/* S.rev identifies the content for caches (G-code, checks). It only ever grows,
   also across undo/redo, so a cached result can never be reused for other content. */
function bumpRev() { REVMAX = Math.max(REVMAX, S.rev | 0) + 1; S.rev = REVMAX }
function changed() {
  bumpRev(); dirty = true;
  for (const sh of S.sheets) rememberMat(sh.mat);
  scheduleSave(); refresh();
}
function refresh() {
  document.body.classList.toggle('simple', mode === 'simple');
  if (tab === 'cam' || tab === 'gcode' || tab === 'machine') ensurePreview();
  renderLeft(); renderRight(); renderChrome(); renderStatus(); draw();
  if (tab === 'machine') renderMachineView();
}
function scheduleSave() { clearTimeout(saveT); saveT = setTimeout(saveLocal, 500) }
let saveWarned = false;
function saveLocal() {
  let txt; try { txt = serialize(S) } catch (e) { logError('serialize', e); return }
  const ok = store.set('project', txt);
  if (!ok && !saveWarned && !DESK) { saveWarned = true; toast(T('Проект слишком большой для автосохранения в браузере. Сохраните его в файл (Ctrl+S).', 'The project is too large for browser autosave. Save it to a file (Ctrl+S).'), 'warn') }
  if (DESK && DESK.autosave) DESK.autosave(txt).catch(e => logError('autosave', e));
}
/* G-code preview of the current sheet, rebuilt only when the project changed. */
function ensurePreview(force) {
  if (P.file) return;
  if (!force && P.rev === S.rev && P.plate === curPlate && P.postId === S.post) return;
  try {
    const r = buildForPlate(curPlate);
    P.post = r.post; P.report = r.report; P.job = r.job; P.est = r.est;
    loadGcode(r.text, null, true); P.rev = S.rev; P.plate = curPlate; P.postId = S.post;
    /* the simulation timeline follows the acceleration-aware estimate, so both show the same time */
    if (r.est && r.est.time > 0 && P.total > 0) { const k = r.est.time / P.total; for (const mv of P.moves) { mv.t0 *= k; mv.t1 *= k } P.total *= k; P.t = Math.min(P.t * k, P.total); if (P.stats) P.stats.time = P.total }
  } catch (e) { logError('plan', e); P.report = null; P.job = null; loadGcode('', null); P.rev = S.rev; toast(T('Не удалось рассчитать траектории: ', 'Could not compute toolpaths: ') + (e.message || e), 'err') }
}
function setPlate(i) { curPlate = clamp(i, 0, S.sheets.length - 1); if (P.file && tab !== 'gcode') P.file = null; fitPlate(curPlate); refresh() }
function switchTab(t) {
  if (t === tab) return; tab = t; store.set('tab', t); hideCtx();
  if (t !== 'gcode') P.playing = false; drag = null; penPts = null; measure = null;
  requestAnimationFrame(() => { resize(); if (t !== 'machine') fitPlate(curPlate); draw(); if (t === 'machine') renderMachineView() });
  refresh();
}
function setMode(m) {
  mode = m; store.set('mode', m);
  if (m === 'simple' && ['polygon', 'star', 'line', 'measure', 'zone'].includes(tool)) tool = 'select';
  refresh(); toast(m === 'simple' ? T('Простой режим: мастера, материалы и минимум настроек.', 'Simple mode: wizards, materials and fewer settings.') : T('Профессиональный режим: открыты все параметры.', 'Pro mode: every parameter is available.'));
}
function generateNow() {
  if (!S.shapes.some(s => !s.parked && plateOf(s) === curPlate)) { toast(T('На этом листе нечего обрабатывать.', 'There is nothing to process on this sheet.')); return }
  P.file = null; ensurePreview(true); P.t = 0; P.playing = true; switchTab('gcode');
  const w = (P.job && P.job.warn) || []; if (P.report && P.report.errors.length) toast(T(`Проверка кода: ошибок ${P.report.errors.length}. Подробности — справа.`, `Code check: ${P.report.errors.length} errors. Details on the right.`), 'warn'); else if (w.length) toast(w[0], 'warn');
}

/* ---------------- top bar ---------------- */
function renderTop() {
  document.documentElement.lang = lang; document.title = APP_NAME + (S.name ? ' — ' + S.name : '');
  const m = S.machine, u = undoLabel(), r = redoLabel();
  $('#deviceBtn').innerHTML = `<span class="dev-ic">${ic(isLaser() ? 'laser' : 'cnc', 18)}</span><span class="dev-txt"><b>${esc(machName(m))}</b><small>${m.w}×${m.h} ${MM()} · ${isLaser() ? T('лазер', 'laser') : T('фрезер', 'router')}${m.confirmed === false ? ' · ' + T('черновик', 'draft') : ''}</small></span>${ic('chev', 14)}`;
  $('#deviceBtn').title = T('Профиль станка и настройки', 'Machine profile and settings');
  $('#modeSeg').innerHTML = `<button data-mode="simple" aria-pressed="${mode === 'simple'}" title="${T('Простой режим: мастера, материалы, минимум настроек', 'Simple mode: wizards, materials, fewer settings')}">${T('Простой', 'Simple')}</button><button data-mode="pro" aria-pressed="${mode === 'pro'}" title="${T('Профессиональный режим: все параметры', 'Pro mode: every parameter')}">${T('Про', 'Pro')}</button>`;
  // Russian: plain words first, the industry terms underneath (pros still find CAD/CAM/G-code)
  const tabs = [['cad', T('Рисунок', 'CAD'), T('CAD · чертёж', 'Design')], ['cam', T('Обработка', 'CAM'), T('CAM · режимы реза', 'Toolpaths')], ['gcode', T('Проверка', 'G-code'), T('G-code · симуляция', 'Preview')], ['machine', T('Станок', 'Machine'), T('управление', 'Control')]];
  $('#tabs').innerHTML = tabs.map(([id, a, b], i) => `<button role="tab" data-tab="${id}" aria-selected="${tab === id}" title="Ctrl+${i + 1}"><i>${i + 1}</i><span><b>${a}</b><small>${b}</small></span></button>`).join('');
  $('#hist').innerHTML = `<button class="icon-btn" data-act="undo" ${u ? '' : 'disabled'} title="${u ? esc(T('Отменить: ', 'Undo: ') + u) : T('Нечего отменять', 'Nothing to undo')} (Ctrl+Z)" aria-label="${T('Отменить', 'Undo')}">${ic('undo')}</button><button class="icon-btn" data-act="redo" ${r ? '' : 'disabled'} title="${r ? esc(T('Повторить: ', 'Redo: ') + r) : T('Нечего повторять', 'Nothing to redo')} (Ctrl+Y)" aria-label="${T('Повторить', 'Redo')}">${ic('redo')}</button>`;
  $$('#langSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang));
  const th = document.documentElement.dataset.theme || 'system'; $('#themeBtn').innerHTML = ic('theme', 17); $('#themeBtn').title = T('Тема: ', 'Theme: ') + ({ system: T('как в системе', 'system'), light: T('светлая', 'light'), dark: T('тёмная', 'dark') })[th];
  $('#helpBtn').innerHTML = ic('help', 17); $('#helpBtn').title = T('Справка и горячие клавиши (F1)', 'Help & shortcuts (F1)');
  $('#menuBtn').innerHTML = ic('menu', 18); $('#menuBtn').title = T('Меню', 'Menu');
  const pb = $('#primaryBtn'), eb = $('#exportBtn'), onPlate = S.shapes.some(s => !s.parked && plateOf(s) === curPlate);
  eb.innerHTML = `${ic('export', 15)}<span>${T('Экспорт', 'Export')}</span>`; eb.title = T('Экспорт G-code через постпроцессор (Ctrl+E)', 'Export G-code through a postprocessor (Ctrl+E)'); eb.hidden = tab === 'machine';
  if (tab === 'cad' || tab === 'cam') { pb.innerHTML = `${ic('play', 14)} ${T('Подготовить', 'Prepare')}${S.sheets.length > 1 ? ` · ${curPlate + 1}` : ''}`; pb.title = T('Рассчитать траектории текущего листа и открыть проверку G-code', 'Compute toolpaths for this sheet and open the G-code preview'); pb.disabled = !onPlate }
  else if (tab === 'gcode') { pb.innerHTML = `${T('К станку', 'To machine')} →`; pb.title = ''; pb.disabled = !P.moves.length }
  else { pb.innerHTML = MC.job.run ? `${ic('stop', 14)} ${T('Стоп', 'Stop')}` : `${ic('play', 14)} ${T('Запустить', 'Start job')}`; pb.disabled = !P.moves.length; pb.classList.toggle('danger', MC.job.run) }
  if (tab !== 'machine') pb.classList.remove('danger');
}

/* ---------------- floating bars ---------------- */
const TOOLS_UI = () => [['select', 'V', T('Выбор и перемещение', 'Select & move')], ['hand', 'H', T('Панорама', 'Pan')], null, ['rect', 'R', T('Прямоугольник (Shift — квадрат)', 'Rectangle (Shift = square)')], ['ellipse', 'E', T('Эллипс (Shift — круг)', 'Ellipse (Shift = circle)')], ['polygon', 'P', T('Многоугольник', 'Polygon'), 1], ['star', 'S', T('Звезда', 'Star'), 1], ['line', 'L', T('Линия', 'Line'), 1], ['pen', 'N', T('Ломаная (Enter — завершить)', 'Polyline (Enter to finish)')], ['text', 'T', T('Текст', 'Text')], null, ['measure', 'M', T('Рулетка', 'Measure'), 1], ['zone', 'B', T('Запретная зона листа', 'Sheet no-go zone'), 1]];
function renderChrome() {
  renderTop(); const isM = tab === 'machine';
  $('#cv').hidden = isM; $('#mach').hidden = !isM; $('#stage').classList.toggle('machmode', isM); $('#app').classList.toggle('machtab', isM);
  const tb = $('#toolbar'); tb.hidden = tab !== 'cad';
  if (tab === 'cad') tb.innerHTML = TOOLS_UI().map(t => t ? `<button data-tool="${t[0]}" class="${t[3] ? 'pro' : ''}" aria-pressed="${tool === t[0]}" title="${t[2]} (${t[1]})" aria-label="${t[2]}">${ic(t[0], 19)}</button>` : '<hr>').join('');
  const vb = $('#viewbar'); vb.hidden = isM;
  if (!isM) {
    let h = '';
    if (tab === 'cad') h += `<button class="btn" data-act="nest" title="${T('Разложить выделенное или все незакреплённые детали листа (Ctrl+Shift+N)', 'Nest the selection or all unlocked parts of the sheet (Ctrl+Shift+N)')}">${ic('nest', 16)} ${T('Раскладка', 'Nest')}</button><span class="sep"></span>`;
    if (tab === 'gcode') h += `<div class="seg"><button data-act="pmode" data-v="2d" aria-pressed="${P.mode === '2d'}">2D</button><button data-act="pmode" data-v="3d" aria-pressed="${P.mode === '3d'}">3D</button></div><span class="sep"></span>`;
    h += `<button class="icon-btn" data-act="zout" title="${T('Отдалить', 'Zoom out')}">${ic('zout')}</button><button class="icon-btn" data-act="zin" title="${T('Приблизить', 'Zoom in')}">${ic('zin')}</button><button class="icon-btn" data-act="fit" title="${T('Показать лист', 'Fit sheet')} (F)">${ic('fit')}</button>${tab === 'cad' && (S.sheets.length > 1 || S.shapes.some(s => s.parked)) ? `<button class="icon-btn" data-act="fitAll" title="${T('Все листы', 'All sheets')}">${ic('grid')}</button>` : ''}`;
    vb.innerHTML = h;
  }
  renderPlates();
  const pal = $('#palette'); pal.hidden = tab !== 'cad';
  if (tab === 'cad') {
    const main = S.layers.filter(L => L.id <= 4);
    pal.innerHTML = `<span>${sel.size ? T('Операция для выделенного:', 'Operation for selection:') : T('Рисовать на слое:', 'Draw on layer:')}</span>` +
      `<span class="simple-only" style="display:contents">${main.map(L => `<button class="wide${curDrawLayer === L.id && !sel.size ? ' cur' : ''}" data-act="assign" data-l="${L.id}" style="background:${L.color}" title="${esc(ltypeName(L.type))}">${esc(layerName(L))}</button>`).join('')}</span>` +
      `<span class="pro" style="display:contents">${S.layers.map(L => `<button class="${curDrawLayer === L.id && !sel.size ? 'cur' : ''}" data-act="assign" data-l="${L.id}" style="background:${L.color}" title="${esc(layerName(L) + ' — ' + ltypeName(L.type))}">${L.id === TOOL_L ? 'T' : String(L.id + 1).padStart(2, '0')}</button>`).join('')}</span>`;
  }
  const pbar = $('#playbar'); pbar.hidden = tab !== 'gcode';
  if (tab === 'gcode') {
    pbar.innerHTML = `<button class="icon-btn" data-act="play" title="${P.playing ? T('Пауза', 'Pause') : T('Воспроизвести', 'Play')} (${T('Пробел', 'Space')})" ${P.moves.length ? '' : 'disabled'}>${ic(P.playing ? 'pause' : 'play', 15)}</button>
    <input type="range" id="pbSlider" min="0" max="1000" step="1" value="${P.total ? Math.round(P.t / P.total * 1000) : 1000}" aria-label="${T('Прогресс симуляции', 'Simulation progress')}">
    <span class="time" id="pbTime"></span><div class="seg" title="${T('Скорость симуляции', 'Simulation speed')}">${[1, 10, 50, 200].map(r => `<button data-act="rate" data-v="${r}" aria-pressed="${P.rate === r}">${r}×</button>`).join('')}</div>`;
    updatePbTime();
  }
  if (isM) renderMachineView();
}
function renderPlates() {
  const el = $('#plates'), show = tab === 'cad' || ((tab === 'cam' || tab === 'gcode') && S.sheets.length > 1 && !P.file); el.hidden = !show; if (!show) return;
  const cnt = i => S.shapes.filter(s => !s.parked && plateOf(s) === i).length;
  let h = S.sheets.map((sh, i) => `<button data-act="plate" data-v="${i}" aria-pressed="${i === curPlate}" title="${esc(sheetName(sh, i))} · ${fx(sh.w, 0)}×${fx(sh.h, 0)} · ${esc(matLabel(matById(sh.mat), sh.thick))}">${esc(sheetName(sh, i))} <small>${cnt(i)}</small></button>`).join('');
  if (tab === 'cad') h += `<button data-act="addSheet" title="${T('Добавить лист', 'Add sheet')}" aria-label="${T('Добавить лист', 'Add sheet')}">${ic('plus', 14)}</button><button data-act="delSheet" title="${T('Удалить текущий лист…', 'Delete current sheet…')}" aria-label="${T('Удалить текущий лист', 'Delete current sheet')}" ${S.sheets.length < 2 && !cnt(0) ? 'disabled' : ''}>${ic('trash', 14)}</button>`;
  el.innerHTML = h;
}
function updatePbTime() { const e = $('#pbTime'); if (e) e.textContent = `${fmtTime(P.t)} / ${fmtTime(P.total)}`; const s = $('#pbSlider'); if (s && document.activeElement !== s) s.value = P.total ? Math.round(P.t / P.total * 1000) : 1000 }

/* ---------------- shared bits ---------------- */
function kindIcon(k) { return ({ rect: 'rect', ellipse: 'ellipse', polygon: 'polygon', star: 'star', line: 'line', pen: 'pen', text: 'text', svg: 'svg', dxf: 'svg', trace: 'wand', image: 'image', bool: 'group', offset: 'group', part: 'nest', tile: 'split', relief: 'relief' })[k] || 'rect' }
const statusPill = m => m ? `<span class="pill ${m.status === 'verified' ? 'ok' : m.status === 'user' ? 'mut' : 'warn'}" title="${m.status === 'verified' && m.test ? esc(`${m.test.machine || ''} · ${m.test.date || ''} · ${m.test.note || ''}`) : ''}">${matStatusName(m.status)}</span>` : '';
const sec = (title, body, cls = '', extra = '') => `<div class="sec ${cls}"><h3>${title}${extra}</h3>${body}</div>`;
function matOptions(type, cur) {
  const ms = matsForMachine(type), byCat = {}; for (const m of ms) (byCat[m.cat || 'other'] = byCat[m.cat || 'other'] || []).push(m);
  let h = ''; for (const c in byCat) h += `<optgroup label="${esc(matCatName(c))}">${byCat[c].map(m => `<option value="${esc(m.id)}" ${m.id === cur ? 'selected' : ''}>${esc(L10(m.name))} · ${fx(m.thick, 2)} ${MM()}${m.status !== 'unverified' ? ' · ' + matStatusName(m.status) : ''}</option>`).join('')}</optgroup>`;
  if (cur && !ms.some(m => m.id === cur)) h = `<option value="${esc(cur)}" selected>${esc(matLabel(matById(cur)))} ⚠</option>` + h;
  return h;
}

/* ============================== LEFT PANE ============================== */
const WIZ = () => [['building', 'house'], ['dollhouse', 'chair'], ['box', 'box'], ['boxkit', 'book'], ['slicer', 'slices'], ['layered', 'layers'], ['awards', 'medal'], ['toys', 'toy'], ['frame', 'frame'], ['sign', 'sign'], ['puzzle', 'puzzle'], ['gear', 'gear'], ['qr', 'qr'], ['hinge', 'hinge'], ['tests', 'test'], ['relief', 'relief']];
function wizName(k) { if (k === 'tests') return [T('Тесты и калибровка', 'Tests & calibration'), T('Мощность, фокус, шаг строк, рез, посадка, подача', 'Power, focus, interval, kerf, fit, feed')]; if (k === 'slicer') return [T('3D-модель → слои', '3D model → layers'), T('STL/OBJ: стопка или решётка, штифты', 'STL/OBJ: stacked or interlocked, dowels')]; if (k === 'relief') return [T('3D-рельеф из фото', '3D relief from a photo'), T('Фрезер: черновая и чистовая', 'Router: roughing and finishing')]; const g = GENS[k], short = WIZ_SHORT()[k]; return [short || g.name(), g.desc()] }
/* shorter card titles: long Russian words must not be cut in the middle in a narrow card */
const WIZ_SHORT = () => ({ layered: T('Слоистая картина', 'Layered picture'), boxkit: T('Коробки и шкатулки', 'Boxes & caskets'), box: T('Коробка на шипах', 'Finger-joint box'), awards: T('Статуэтки и медали', 'Awards & ornaments'), toys: T('Игрушки', 'Toys'), slicer: T('3D-модель → слои', '3D model → layers') });
/* Features tied to one machine type carry a badge in the bottom-right corner (laser or
   router icon). They stay clickable: on the other machine type a notice explains it and
   offers to switch. */
function wizNeeds(k) { if (k === 'relief') return 'cnc'; const g = GENS[k]; return g && g.laserOnly ? 'laser' : g && g.cncOnly ? 'cnc' : null }
const machBadge = need => need ? `<span class="mbadge ${need}${(need === 'laser') === isLaser() ? '' : ' off'}" title="${need === 'laser' ? T('Только для лазера', 'Laser only') : T('Только для фрезера (ЧПУ)', 'Router (CNC) only')}">${ic(need === 'laser' ? 'laser' : 'cnc', 13)}</span>` : '';
function needMachine(need, what) {
  if (!need || (need === 'laser') === isLaser()) return true;
  const list = allMachineProfiles().filter(m => m.type === need).slice(0, 4), kind = need === 'laser' ? T('лазерного станка', 'a laser machine') : T('фрезерного станка (ЧПУ)', 'a CNC router');
  confirmBox(`${ic(need === 'laser' ? 'laser' : 'cnc', 18)} ${need === 'laser' ? T('Функция для лазера', 'Laser feature') : T('Функция для фрезера', 'Router feature')}`,
    T(`«${esc(what)}» работает только для ${kind}. Сейчас выбран «${esc(machName(S.machine))}». Переключитесь на ${need === 'laser' ? 'лазер' : 'фрезер'}, чтобы использовать эту функцию.`, `“${esc(what)}” works only with ${kind}. The current machine is “${esc(S.machine.name)}”. Switch to a ${need === 'laser' ? 'laser' : 'router'} to use it.`),
    list.map((m, i) => ({ label: T('Переключить: ', 'Switch to: ') + esc(machName(m)), value: m.id, primary: i === 0 })).concat([{ label: T('Настройки станка…', 'Machine settings…'), value: '#settings' }, { label: T('Отмена', 'Cancel'), value: null }])
  ).then(v => { if (!v) return; if (v === '#settings') return openSettings(); const m = allMachineProfiles().find(x => x.id === v); if (m) applyMachine(m, false) });
  return false;
}
function wizHtml(compact) {
  return `<div class="wiz${compact ? ' compact' : ''}">${WIZ().map(([k, icn], i) => { const [n, d] = wizName(k), need = wizNeeds(k); return `<button data-act="wiz" data-v="${k}" class="${i === 0 ? 'hero' : ''}${need && (need === 'laser') !== isLaser() ? ' dim' : ''}">${ic(icn, i === 0 ? 26 : 20)}${i === 0 ? `<span><b>${esc(n)}</b><small>${esc(d)}</small></span>` : `<b>${esc(n)}</b><small>${esc(d)}</small>`}${machBadge(need)}</button>` }).join('')}</div>`;
}
function renderLeft() {
  const el = $('#left');
  if (tab === 'cad') return renderLeftCad(el);
  if (tab === 'cam') return renderLeftCam(el);
  if (tab === 'gcode') return renderLeftGcode(el);
  el.innerHTML = '';
}
function renderLeftCad(el) {
  const used = usedLayers();
  const layHead = used.length ? `<div class="lhead"><span></span><span>${T('Слой', 'Layer')}</span><span title="${T('Будет резать / гравировать', 'Will be cut / engraved')}">${T('Вывод', 'Output')}</span><span title="${T('Видно на столе', 'Visible on the bed')}">${T('Вид', 'View')}</span></div>` : '';
  const lay = used.map(L => { const n = S.shapes.filter(s => s.layer === L.id).length; return `<div class="li${L.show ? '' : ' off'}" data-act="pickLayer" data-l="${L.id}"><span class="sw" style="background:${L.color}"></span><span class="nm">${esc(layerName(L))}</span><span class="meta">${n} · ${esc(isLaser() ? ltypeName(L.type) : layerOut(L) ? cncOpName(L.cnc.op) : ltypeName('guide'))}</span><label class="sw2" title="${T('Вывод: будет ли слой резаться/гравироваться', 'Output: is the layer cut/engraved')}"><input type="checkbox" data-act="lout" data-l="${L.id}" ${L.on ? 'checked' : ''}><i></i></label><label class="sw2 vis" title="${T('Видимость на столе', 'Visible on the bed')}"><input type="checkbox" data-act="eye" data-l="${L.id}" ${L.show ? 'checked' : ''}><i></i></label></div>` }).join('') || `<p class="note">${T('Слои появятся, когда вы что-нибудь нарисуете.', 'Layers appear once you draw something.')}</p>`;
  const sheets = S.sheets.map((sh, i) => { const n = S.shapes.filter(s => !s.parked && plateOf(s) === i).length, m = matById(sh.mat); return `<div class="li${i === curPlate ? ' on' : ''}" data-act="plate" data-v="${i}"><span class="sw" style="background:${m && m.color || 'var(--sheet-line)'}"></span><span class="nm">${esc(sheetName(sh, i))}<br><span class="meta">${fx(sh.w, 0)}×${fx(sh.h, 0)} · ${esc(matLabel(m, sh.thick))}</span></span><span class="meta">${n}</span><button class="mini" data-act="delSheet" data-v="${i}" title="${T('Удалить лист…', 'Delete sheet…')}" aria-label="${T('Удалить лист', 'Delete sheet')}" ${S.sheets.length < 2 && !n ? 'disabled' : ''}>${ic('trash', 14)}</button></div>` }).join('');
  const parked = S.shapes.filter(s => s.parked).length;
  el.innerHTML = sec(mode === 'simple' ? T('Что сделаем?', 'What shall we make?') : T('Мастера и генераторы', 'Wizards & generators'), wizHtml(mode !== 'simple')) +
    sec(T('Импорт', 'Import'), `<button class="btn block" data-act="import">${ic('open', 15)} ${T('Открыть файл…', 'Open a file…')} <span class="kbd">Ctrl+I</span></button><p class="note">${T('SVG, DXF, PNG, JPEG, BMP, WebP, TIFF, STL, OBJ, G-code. Файл можно просто перетащить в окно или вставить из буфера.', 'SVG, DXF, PNG, JPEG, BMP, WebP, TIFF, STL, OBJ, G-code. You can also drop a file onto the window or paste it.')}</p>`) +
    sec(T('Проект', 'Project'), `<div class="grid3"><button class="btn" data-act="newProj">${ic('newp', 15)} ${T('Новый', 'New')}</button><button class="btn" data-act="openProj">${ic('open', 15)} ${T('Открыть', 'Open')}</button><button class="btn" data-act="saveProj">${ic('save', 15)} ${T('Сохранить', 'Save')}</button></div>${projPath ? `<p class="note mono-s" title="${esc(projPath)}">${esc(projPath)}</p>` : ''}`, 'pro') +
    sec(T('Листы', 'Sheets'), `<div class="list">${sheets}</div><div class="grid2"><button class="btn" data-act="addSheet">${ic('plus', 14)} ${T('Добавить', 'Add')}</button><button class="btn" data-act="dupSheet">${ic('copy', 14)} ${T('Копия листа', 'Copy sheet')}</button></div>${parked ? `<button class="btn block" data-act="selParked">${ic('warn', 14)} ${T('Неразмещённые', 'Unplaced')}: ${parked}</button>` : ''}`, '', `<span class="sp"></span><em>${S.sheets.length}</em>`) +
    sec(T('Слои', 'Layers'), `<div class="list">${layHead}${lay}</div>`, 'pro', `<span class="sp"></span><em>${used.length}</em>`) +
    `<div class="sec grow"><h3>${T('Объекты', 'Objects')} · ${esc(sheetName(sheetAt(curPlate), curPlate))}<span class="sp"></span><em id="objCount"></em></h3>
     <div class="inp"><span class="pre">${ic('search', 14)}</span><input id="objQ" placeholder="${T('Поиск по названию', 'Search by name')}" value="${esc(objQ)}" aria-label="${T('Поиск объектов', 'Search objects')}"></div>
     <div class="vlist" id="objList" tabindex="0" aria-label="${T('Список объектов', 'Object list')}"><div class="vinner" id="objInner"></div></div></div>`;
  buildObjList(); $('#objList').onscroll = renderObjRows;
}
/* The object list is virtualised: any number of objects, only visible rows are in the DOM. */
function buildObjList() {
  const pool = S.shapes.filter(s => s.parked || plateOf(s) === curPlate);
  let units = unitsOf(pool.slice().reverse()); const q = objQ.trim().toLowerCase();
  if (q) units = units.filter(u => unitName(u).toLowerCase().includes(q) || u.some(s => s.kind === 'text' && String(s.text || '').toLowerCase().includes(q)));
  OBJ = units.map(u => ({ u, b: bboxOf(u.flatMap(s => s.paths)) }));
  const c = $('#objCount'); if (c) c.textContent = OBJ.length;
  renderObjRows();
}
function renderObjRows() {
  const box = $('#objList'), inn = $('#objInner'); if (!box || !inn) return; const rh = 30, n = OBJ.length; inn.style.height = Math.max(1, n) * rh + 'px';
  if (!n) { inn.innerHTML = `<p class="note" style="padding:6px 2px">${objQ ? T('Ничего не найдено.', 'Nothing found.') : T('На листе пусто. Выберите мастер выше, инструмент на холсте или откройте файл.', 'This sheet is empty. Pick a wizard above, a tool on the canvas or open a file.')}</p>`; return }
  const top = box.scrollTop, h = box.clientHeight || 300, i0 = Math.max(0, Math.floor(top / rh) - 5), i1 = Math.min(n, Math.ceil((top + h) / rh) + 5); let s = '';
  for (let i = i0; i < i1; i++) {
    const { u, b } = OBJ[i], s0 = u[0], L = S.layers[s0.layer], on = u.some(q => sel.has(q.id));
    s += `<div class="li${on ? ' on' : ''}" style="position:absolute;left:0;right:0;top:${i * rh}px" data-act="pickShape" data-id="${s0.id}"><span class="sw" style="background:${L.color}"></span>${ic(u.length > 1 ? 'group' : kindIcon(s0.kind), 15)}<span class="nm">${esc(unitName(u))}${u.length > 1 ? ` <small>· ${u.length}</small>` : ''}</span>${u.some(q => q.lock) ? ic('lock', 13) : ''}${s0.parked ? `<span class="pill warn">${T('вне листа', 'unplaced')}</span>` : ''}<span class="meta">${fx(b[2] - b[0], 0)}×${fx(b[3] - b[1], 0)}</span></div>`;
  }
  inn.innerHTML = s;
}
let GEO = { rev: -1, plate: -1, issues: [] };
function geoIssues() { if (GEO.rev !== S.rev || GEO.plate !== curPlate) { try { GEO = { rev: S.rev, plate: curPlate, issues: checkGeometry(curPlate) } } catch (e) { logError('check', e); GEO = { rev: S.rev, plate: curPlate, issues: [] } } } return GEO.issues }
function camLayers() { return orderedLayers(curPlate) }
function opSummary(L) {
  const sh = sheetAt(curPlate);
  if (isLaser()) { if (L.type === 'guide') return ltypeName('guide'); const r = resolveLaser(L, sh); return `${ltypeName(L.type)} · ${fx(r.power, 0)}% · ${fx(r.speed, 0)} ${MMIN()}${r.passes > 1 ? ' · ×' + r.passes : ''}` }
  const r = resolveCnc(L, sh); return `${cncOpName(L.cnc.op)} · ⌀${fx(r.tool.d, 2)} · ${fx(r.depth, 2)} ${MM()}`;
}
function renderLeftCam(el) {
  const used = camLayers(); if (camSel == null || !used.find(L => L.id === camSel)) camSel = used[0] ? used[0].id : null;
  const manual = S.orderMode !== 'auto', sh = sheetAt(curPlate), m = matById(sh.mat);
  const ops = used.map((L, i) => {
    const src = isLaser() ? resolveLaser(L, sh) : resolveCnc(L, sh), warn = src.warn.length || src.unsupported;
    return `<div class="li${L.id === camSel ? ' on' : ''}${L.on ? '' : ' off'}" data-act="camPick" data-l="${L.id}">
     <input type="checkbox" data-act="camOn" data-l="${L.id}" ${L.on ? 'checked' : ''} title="${T('Включить операцию', 'Enable operation')}" aria-label="${T('Включить операцию', 'Enable operation')}">
     <span class="sw" style="background:${L.color}"></span><span class="nm">${i + 1}. ${esc(layerName(L))}<br><span class="meta">${esc(opSummary(L))}</span></span>
     ${warn ? `<span title="${esc(src.warn.join(' '))}">${ic('warn', 14)}</span>` : ''}<span class="pill ${L.auto ? 'mut' : 'ok'}" title="${L.auto ? T('Параметры из материала листа', 'Values from the sheet material') : T('Параметры заданы вручную', 'Values set by hand')}">${L.auto ? T('мат.', 'mat.') : T('ручн.', 'man.')}</span>
     ${manual ? `<button class="mini" data-act="camUp" data-l="${L.id}" ${i ? '' : 'disabled'} title="${T('Выше', 'Move up')}">${ic('up', 14)}</button><button class="mini" data-act="camDown" data-l="${L.id}" ${i < used.length - 1 ? '' : 'disabled'} title="${T('Ниже', 'Move down')}">${ic('down', 14)}</button>` : ''}</div>`;
  }).join('') || `<p class="note">${T('На этом листе нечего обрабатывать — нарисуйте что-нибудь во вкладке CAD.', 'Nothing to process on this sheet — draw something in CAD.')}</p>`;
  const issues = geoIssues(), lvl = { error: 'bad', warn: 'warn', info: 'mut' };
  const iss = issues.map((x, i) => `<div class="issue ${x.level}" data-act="issue" data-v="${i}" title="${T('Показать на чертеже', 'Show in the drawing')}">${ic(x.level === 'info' ? 'info' : 'warn', 13)}<span>${esc(x.msg)}</span></div>`).join('');
  const dup = issues.find(x => x.dup);
  el.innerHTML = (S.sheets.length > 1 ? sec(T('Лист', 'Sheet'), `<select class="plain" id="camPlate">${S.sheets.map((s, i) => `<option value="${i}" ${i === curPlate ? 'selected' : ''}>${esc(sheetName(s, i))} · ${fx(s.w, 0)}×${fx(s.h, 0)}</option>`).join('')}</select>`) : '') +
    sec(T('Операции', 'Operations'), `<div class="seg full"><button data-act="orderMode" data-v="auto" aria-pressed="${!manual}">${T('Порядок: авто', 'Order: auto')}</button><button data-act="orderMode" data-v="manual" aria-pressed="${manual}">${T('Вручную', 'Manual')}</button></div><div class="list">${ops}</div>
     <p class="note">${manual ? T('Операции выполняются сверху вниз; порядок можно менять стрелками.', 'Operations run top to bottom; reorder them with the arrows.') : isLaser() ? T('Авто: растр → заливка → векторная гравировка → разметка → резка.', 'Auto: raster → fill → vector engrave → mark → cut.') : T('Авто: сверление → гравировка → карманы → рельеф → контуры.', 'Auto: drilling → engraving → pockets → relief → profiles.')}</p>`, '', infoBtn('orderMode')) +
    sec(T('Материал листа', 'Sheet material'), `<div class="row"><b class="grow">${esc(matLabel(m, sh.thick))}</b>${statusPill(m)}</div>${m && m.notes ? `<p class="note">${esc(L10(m.notes))}</p>` : ''}${m && isLaser() && LASER_HAZARD.test(L10(m.name)) ? `<div class="warnline">${ic('warn', 13)} ${T('Этот материал опасно обрабатывать лазером.', 'This material is dangerous to laser.')}</div>` : ''}
     <div class="grid2"><button class="btn" data-act="materials">${ic('layers', 14)} ${T('Материалы…', 'Materials…')}</button>${isLaser() ? '' : `<button class="btn" data-act="tools">${ic('cnc', 14)} ${T('Фрезы…', 'Tools…')}</button>`}</div>`) +
    sec(T('Проверка геометрии', 'Geometry check'), issues.length ? `<div class="issues-list">${iss}</div>${dup ? `<button class="btn" data-act="removeDups">${ic('trash', 14)} ${T('Удалить повторяющиеся контуры', 'Remove duplicate outlines')}</button>` : ''}` : `<p class="note ok">${ic('check', 13)} ${T('Проблем не найдено.', 'No problems found.')}</p>`, '', `<span class="sp"></span>${issues.length ? `<span class="pill ${lvl[issues.some(x => x.level === 'error') ? 'error' : issues.some(x => x.level === 'warn') ? 'warn' : 'info']}">${issues.length}</span>` : ''}`);
}
function renderLeftGcode(el) {
  const post = P.post || currentPost();
  el.innerHTML = (S.sheets.length > 1 && !P.file ? sec(T('Лист', 'Sheet'), `<select class="plain" id="camPlate">${S.sheets.map((s, i) => `<option value="${i}" ${i === curPlate ? 'selected' : ''}>${esc(sheetName(s, i))}</option>`).join('')}</select>`) : '') +
    `<div class="sec"><h3>G-code<span class="sp"></span><em>${P.lines.length.toLocaleString(lang)} ${T('стр.', 'lines')}</em></h3>
     <div class="row"><span class="pill ${P.file ? 'mut' : 'ok'}">${P.file ? esc(P.file) : T('из проекта', 'from project')}</span>${P.file ? '' : `<span class="pill ${post.verified ? 'ok' : 'warn'}" title="${esc(postStatus(post))}">${esc(postLabel(post))}</span>`}</div>
     <button class="primary block" data-act="export" ${P.file ? 'disabled' : ''}>${ic('export', 15)} ${T('Экспорт G-code…', 'Export G-code…')}</button>
     <div class="grid2"><button class="btn" data-act="copyGc" ${P.lines.length > 1 ? '' : 'disabled'}>${ic('copy', 15)} ${T('Копировать', 'Copy')}</button><button class="btn" data-act="openGc">${ic('open', 15)} ${T('Открыть файл', 'Open file')}</button></div>
     ${P.file ? `<button class="btn block" data-act="backProj">${T('Вернуть G-code проекта', 'Back to project G-code')}</button>` : ''}
     <label class="chk"><input type="checkbox" id="followChk" ${P.follow ? 'checked' : ''}> ${T('Следить за текущей строкой', 'Follow the current line')}</label></div>
    ${P.moves.length ? `<div class="sec"><h3>${T('Преобразовать G-code', 'Convert G-code')}${infoBtn('gcConv')}</h3><div class="grid2"><button class="btn" data-act="gcConv" data-v="cad" title="${T('Рабочие перемещения станут контурами в проекте', 'Cutting moves become outlines in the project')}">${ic('edit', 14)} ${T('В проект', 'To project')}</button><button class="btn" data-act="gcConv" data-v="pngcad" title="${T('Картинка гравировки в реальном размере', 'Engraving picture at real size')}">${ic('image', 14)} ${T('Картинкой', 'As picture')}</button><button class="btn" data-act="gcConv" data-v="svg">SVG</button><button class="btn" data-act="gcConv" data-v="dxf">DXF</button><button class="btn" data-act="gcConv" data-v="png">PNG 254 DPI</button><button class="btn" data-act="gcConv" data-v="png2">PNG 508 DPI</button></div></div>` : ''}
    <div class="sec gcsearch"><div class="inp"><span class="pre">${ic('search', 14)}</span><input id="gcQ" placeholder="${T('Поиск в коде: M3, F1500, LAYER…', 'Search code: M3, F1500, LAYER…')}" value="${esc(P.search || '')}" aria-label="${T('Поиск в G-code', 'Search G-code')}"><em id="gcHits">${P.search ? P.hits.length : ''}</em></div>
     <div class="grid2"><button class="btn" data-act="gcHit" data-v="-1">${ic('up', 14)} ${T('Пред.', 'Prev')}</button><button class="btn" data-act="gcHit" data-v="1">${ic('down', 14)} ${T('След.', 'Next')}</button></div></div>
    <div class="gcwrap"><div id="gcList" tabindex="0" aria-label="G-code"><div id="gcInner"></div></div></div>`;
  const gl = $('#gcList'); if (gl) { gl.addEventListener('scroll', renderGcList); renderGcList() }
}

/* ============================== RIGHT PANE ============================== */
function renderRight() {
  const el = $('#right');
  if (tab === 'cad') return selShapes().length ? renderRightSel(el) : renderRightIdle(el);
  if (tab === 'cam') return renderRightCam(el);
  if (tab === 'gcode') return renderRightGcode(el);
  renderRightMachine(el);
}
function textFontOptions(cur) {
  const b = Object.entries(BUNDLED_FONTS).map(([k, v]) => [k, v.n]), sys = systemFonts ? systemFonts.map(f => [f.family, f.family]) : [];
  const has = b.some(x => x[0] === cur) || sys.some(x => x[0] === cur);
  return `<optgroup label="${T('Встроенные', 'Bundled')}">${b.map(([v, n]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>${sys.length ? `<optgroup label="${T('Системные', 'System')}">${sys.map(([v, n]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>` : ''}${!has && cur ? `<option value="${esc(cur)}" selected>${esc(fontLabel(cur))} ⚠</option>` : ''}`;
}
function weightOptions(f) {
  const names = { 100: T('сверхтонкий', 'thin'), 200: T('тонкий', 'extra light'), 300: T('светлый', 'light'), 400: T('обычный', 'regular'), 500: T('средний', 'medium'), 600: T('полужирный', 'semibold'), 700: T('жирный', 'bold'), 800: T('очень жирный', 'extra bold'), 900: T('чёрный', 'black') };
  const e = fontEntry(fontFamily(f)); let ws = e ? [...new Set(e.faces.map(x => x.weight || 400))].sort((a, b) => a - b) : [300, 400, 600, 700, 800];
  if (!ws.length) ws = [400]; return ws.map(w => [w, `${w} · ${names[w] || ''}`]);
}
function textFields(o, prefix) {
  return `<textarea class="plain" ${prefix}="text" rows="2">${esc(o.text)}</textarea>
   <div class="grid2"><div class="fld"><span>${T('Шрифт', 'Font')}</span><button type="button" class="btn fontbtn" data-act="fontPick" data-p="${prefix}" title="${T('Выбрать шрифт — встроенный, с компьютера или из файла', 'Choose a font — bundled, from this computer or from a file')}"><span style="font-family:'${esc(fontFamily(o.font)).replace(/'/g, '')}',var(--f-ui)">${esc(fontLabel(o.font))}</span>${ic('chev', 14)}</button></div>${numF(T('Размер (высота букв)', 'Size (cap height)'), `${prefix}="size" min="1"`, o.size, MM(), .5)}
   ${selF(T('Насыщенность', 'Weight'), `${prefix}="weight"`, weightOptions(o.font), o.weight || defaultWeight(o.font))}${numF(T('Межбуквенный', 'Letter spacing'), `${prefix}="ls"`, o.ls || 0, MM(), .1)}
   ${numF(T('Межстрочный', 'Line height'), `${prefix}="lh" min="0.6" max="4"`, o.lh || 1.2, '×', .05)}${numF(T('По дуге, радиус', 'On an arc, radius'), `${prefix}="arc"`, o.arc || 0, MM(), 1, '', null)}</div>
   <div class="seg full">${[['left', T('Влево', 'Left')], ['center', T('Центр', 'Centre')], ['right', T('Вправо', 'Right')]].map(([v, n]) => `<button data-act="txtAlign" data-p="${prefix}" data-v="${v}" aria-pressed="${(o.align || 'left') === v}">${n}</button>`).join('')}</div>
   <label class="chk"><input type="checkbox" ${prefix}="italic" ${o.italic ? 'checked' : ''}> ${T('Курсив', 'Italic')}</label>
   <p class="note">${T('Радиус дуги: 0 — прямая строка, больше 0 — текст сверху дуги, меньше 0 — снизу. Работает для одной строки.', 'Arc radius: 0 is straight, positive puts text on top of an arc, negative below it. Single line only.')}</p>
   `;
}
function renderRightSel(el) {
  const ss = selShapes(), b = selBox(), units = unitsOf(ss), one = ss.length === 1 ? ss[0] : null, pl = plateOfBox([b[0], b[1], b[0], b[1]]), ox = plateX(pl), locked = ss.some(s => s.lock), allLocked = ss.every(s => s.lock);
  const gs = ss.find(s => s.g && S.groups[s.g]), gm = gs ? S.groups[gs.g] : null; const L0 = S.layers[ss[0].layer];
  let h = `<div class="sec"><h3>${esc(units.length > 1 ? T('Выделено: ', 'Selected: ') + units.length : unitName(units[0]))}<span class="sp"></span><button class="mini" data-act="rename" title="${T('Переименовать', 'Rename')} (F2)">${ic('edit', 15)}</button><button class="mini" data-act="lockToggle" title="${allLocked ? T('Открепить', 'Unlock') : T('Закрепить — раскладка не сдвинет', 'Lock — nesting will not move it')} (Ctrl+L)" aria-pressed="${allLocked}">${ic(allLocked ? 'lock' : 'unlock', 15)}</button><button class="mini" data-act="dup" title="${T('Дублировать', 'Duplicate')} (Ctrl+D)">${ic('copy', 15)}</button><button class="mini" data-act="del" title="${T('Удалить', 'Delete')} (Del)">${ic('trash', 15)}</button></h3>
   ${locked ? `<div class="warnline">${ic('lock', 13)} ${T('Закреплено: перемещение и раскладка недоступны, пока не открепите.', 'Locked: moving and nesting are disabled until you unlock it.')}</div>` : ''}
   <div class="grid2">${numF('X', 'data-prop="x"', fx(b[0] - ox, 2), MM())}${numF('Y', 'data-prop="y"', fx(b[1], 2), MM())}${numF(T('Ширина', 'Width'), 'data-prop="w" min="0.01"', fx(b[2] - b[0], 2), MM())}${numF(T('Высота', 'Height'), 'data-prop="h" min="0.01"', fx(b[3] - b[1], 2), MM())}</div>
   <label class="chk"><input type="checkbox" id="lockRatio" ${toolOpt.lock ? 'checked' : ''}> ${T('Сохранять пропорции', 'Keep proportions')}</label>
   <div class="grid3"><button class="btn" data-act="rot" data-v="-90" title="[">${ic('rotl', 15)} 90°</button><button class="btn" data-act="rot" data-v="90" title="]">${ic('rotr', 15)} 90°</button><button class="btn" data-act="center">${T('В центр', 'Centre')}</button>
   <button class="btn" data-act="mirror" data-v="h" title="Shift+H">⇋ ${T('Гориз.', 'Flip H')}</button><button class="btn" data-act="mirror" data-v="v" title="Shift+V">⇵ ${T('Верт.', 'Flip V')}</button><button class="btn" data-act="nest">${ic('nest', 14)} ${T('Разложить', 'Nest')}</button></div>
   <div class="row pro">${numF(T('Повернуть на', 'Rotate by'), 'id="rotBy"', 0, '°', 1)}<div class="fld" style="align-self:end"><button class="btn" data-act="rotApply">${T('Применить', 'Apply')}</button></div></div>
   ${S.sheets.length > 1 ? `<button class="btn pro" data-act="moveSheet">${ic('sheet', 14)} ${T('Перенести на другой лист…', 'Move to another sheet…')}</button>` : ''}</div>`;
  const main = S.layers.filter(L => L.id <= 4);
  h += sec(T('Операция', 'Operation'), `<div class="grid2">${main.map(L => `<button class="btn${ss.every(s => s.layer === L.id) ? ' acc' : ''}" data-act="assign" data-l="${L.id}"><span class="sw" style="background:${L.color}"></span>${esc(layerName(L))}</button>`).join('')}</div>
   <p class="note pro">${T('Все 11 слоёв — в палитре под холстом. Тип процесса слоя задаётся во вкладке CAM. Слой «T» — направляющие, не выводятся.', 'All 11 layers are in the palette under the canvas. A layer’s process type is set in CAM. Layer “T” holds guides and is not output.')}</p>
   ${isLaser() ? `<label class="chk pro"><input type="checkbox" id="ovChk" ${ss.every(s => s.ov) ? 'checked' : ''}> ${T('Свои мощность и скорость для объекта', 'Own power & speed for this object')}</label>
   ${ss.every(s => s.ov) ? `<div class="grid2 pro">${numF(T('Мощность', 'Power'), 'data-ov="power" min="0" max="100"', ss[0].ov.power, '%', 1)}${numF(T('Скорость', 'Speed'), 'data-ov="speed" min="1"', ss[0].ov.speed, MMIN(), 10)}${numF(T('Проходов', 'Passes'), 'data-ov="passes" min="1" max="50"', ss[0].ov.passes || resolveLaser(L0, sheetAt(pl)).passes, '', 1)}${numF(T('Шаг строк', 'Line interval'), 'data-ov="interval" min="0.02" max="2"', ss[0].ov.interval || resolveLaser(L0, sheetAt(pl)).interval, MM(), .01)}</div>` : ''}` : ''}`);
  if (one && one.kind === 'text') {
    const miss = one.font && !fontAvailable(one.font);
    h += sec(T('Текст', 'Text'), (miss ? `<div class="warnline">${ic('warn', 13)} ${T(`Шрифт «${esc(fontLabel(one.font))}» не найден в системе. Контуры сохранены, но при изменении текста будет использован запасной шрифт.`, `Font “${esc(fontLabel(one.font))}” is not installed. The outlines are kept, but editing the text will use a fallback font.`)}</div>` : '') + textFields(one, 'data-txt'));
  }
  if (one && one.kind === 'image') {
    const o = one.img, warns = imageResolutionWarnings(one), cr = o.crop || { l: 0, t: 0, r: 0, b: 0 };
    h += sec(T('Фото', 'Photo'), `${selF(T('Дизеринг', 'Dithering'), 'data-img="mode"', [['jarvis', 'Jarvis'], ['fs', 'Floyd–Steinberg'], ['stucki', 'Stucki'], ['atkinson', 'Atkinson'], ['ordered', T('Упорядоченный (Байер)', 'Ordered (Bayer)')], ['threshold', T('Порог', 'Threshold')], ['gray', T('Оттенки серого (мощность)', 'Greyscale (power)')]], o.mode, '', 'dither')}
     <label class="fld"><span>${T('Яркость', 'Brightness')}: <b>${o.bright}</b></span><input type="range" min="-100" max="100" value="${o.bright}" data-img="bright"></label>
     <label class="fld"><span>${T('Контраст', 'Contrast')}: <b>${o.contrast}</b></span><input type="range" min="-100" max="100" value="${o.contrast}" data-img="contrast"></label>
     <label class="fld pro"><span>${T('Гамма', 'Gamma')}: <b>${o.gamma}</b></span><input type="range" min="0.3" max="3" step="0.05" value="${o.gamma}" data-img="gamma"></label>
     ${o.mode === 'threshold' ? `<label class="fld"><span>${T('Порог', 'Threshold')}: <b>${o.thr}</b></span><input type="range" min="1" max="254" value="${o.thr}" data-img="thr"></label>` : ''}
     <label class="chk"><input type="checkbox" data-img="invert" ${o.invert ? 'checked' : ''}> ${T('Инвертировать (тёмные материалы, сланец, стекло)', 'Invert (dark materials, slate, glass)')}</label>
     <label class="chk"><input type="checkbox" data-img="actual" ${o.actual ? 'checked' : ''}> ${T('Показать с реальным шагом строк', 'Preview at the real line interval')}</label>
     <div class="grid2 pro">${['l', 't', 'r', 'b'].map(k => `<label class="fld"><span>${({ l: T('Обрезать слева', 'Crop left'), t: T('сверху', 'top'), r: T('справа', 'right'), b: T('снизу', 'bottom') })[k]}: <b>${Math.round(cr[k] * 100)}%</b></span><input type="range" min="0" max="45" value="${Math.round(cr[k] * 100)}" data-crop="${k}"></label>`).join('')}</div>
     ${warns.map(w => `<div class="warnline">${ic('warn', 13)} ${esc(w)}</div>`).join('')}
     <div class="grid2"><button class="btn" data-act="imgTraceSel">${ic('wand', 14)} ${T('Трассировать', 'Trace')}</button><button class="btn" data-act="imgBands">${ic('layers', 14)} ${T('Слои по яркости…', 'Brightness layers…')}</button></div>
     <p class="note">${T('Разрешение гравировки задаётся шагом строк в CAM. Исходное изображение хранится в проекте без изменений.', 'Engraving resolution is the line interval in CAM. The original image is kept in the project unchanged.')}</p>`, '', infoBtn('dither'));
  }
  if (gm && (gm.gen || gm.src || gs.req)) {
    const r = gs.req; h += sec(T('Изделие', 'Product'), `${gm.gen ? `<p class="note">${T('Создано генератором', 'Made by the generator')} «${esc(GENS[gm.gen.kind] ? GENS[gm.gen.kind].name() : gm.gen.kind)}». ${T('Параметры сохранены — изделие можно перестроить.', 'Parameters are saved — the product can be rebuilt.')}</p><button class="btn" data-act="regen">${ic('wand', 14)} ${T('Изменить параметры…', 'Edit parameters…')}</button>` : ''}
     ${gm.src ? `<button class="btn" data-act="retrace">${ic('wand', 14)} ${T('Перетрассировать…', 'Re-trace…')}</button>` : ''}
     ${r ? `<p class="note">${T('Требуемый материал', 'Required material')}: <b>${esc(r.mat ? matLabel(matById(r.mat), r.thick) : fx(r.thick, 2) + ' ' + MM())}</b>${(() => { const sh = sheetAt(pl); return Math.abs(sh.thick - r.thick) > .01 ? ` — <span class="bad">${T('лист другой толщины', 'the sheet is a different thickness')} (${fx(sh.thick, 2)} ${MM()})</span>` : '' })()}</p>` : ''}`);
  }
  h += sec(T('Выравнивание', 'Align'), `<div class="grid3"><button class="btn" data-act="align" data-v="l">⇤ ${T('Лево', 'Left')}</button><button class="btn" data-act="align" data-v="cx">↔ ${T('Центр', 'Centre')}</button><button class="btn" data-act="align" data-v="r">${T('Право', 'Right')} ⇥</button>
   <button class="btn" data-act="align" data-v="t">⤒ ${T('Верх', 'Top')}</button><button class="btn" data-act="align" data-v="cy">↕ ${T('Середина', 'Middle')}</button><button class="btn" data-act="align" data-v="b">⤓ ${T('Низ', 'Bottom')}</button></div>
   <p class="note">${units.length > 1 ? T('Относительно общей рамки выделения; группы двигаются целиком.', 'Relative to the selection frame; groups move as one.') : T('Одиночный объект выравнивается по листу материала.', 'A single object aligns to the material sheet.')}</p>`, 'pro');
  h += sec(T('Построение', 'Construct'), `<div class="grid3"><button class="btn" data-act="bool" data-v="union" ${ss.length > 1 ? '' : 'disabled'}>${T('Объединить', 'Union')}</button><button class="btn" data-act="bool" data-v="diff" ${ss.length > 1 ? '' : 'disabled'}>${T('Вычесть', 'Subtract')}</button><button class="btn" data-act="bool" data-v="inter" ${ss.length > 1 ? '' : 'disabled'}>${T('Пересечь', 'Intersect')}</button>
   <button class="btn" data-act="group" ${ss.length > 1 ? '' : 'disabled'}>${ic('group', 14)} ${T('Группа', 'Group')}</button><button class="btn" data-act="ungroup" ${ss.some(s => s.g) ? '' : 'disabled'}>${ic('ungroup', 14)} ${T('Разгрупп.', 'Ungroup')}</button><button class="btn" data-act="break">${ic('split', 14)} ${T('Разбить', 'Break')}</button></div>
   <div class="row">${numF(T('Смещение контура', 'Offset outline'), 'id="offD"', toolOpt.off, MM(), .5)}<div class="fld" style="align-self:end"><button class="btn" data-act="offset">${T('Создать', 'Create')}</button></div><div class="fld" style="align-self:end"><button class="btn" data-act="simplify" title="${T('Упростить узлы (0,1 мм)', 'Simplify nodes (0.1 mm)')}">${ic('smooth', 14)}</button></div></div>
   <div class="grid3">${numF(T('Столбцы', 'Columns'), 'id="arrC" min="1"', toolOpt.ac, '', 1)}${numF(T('Ряды', 'Rows'), 'id="arrR" min="1"', toolOpt.ar, '', 1)}${numF(T('Зазор', 'Gap'), 'id="arrG"', toolOpt.ag, MM(), .5)}</div>
   <button class="btn" data-act="array">${ic('grid', 14)} ${T('Массив сеткой', 'Grid array')}</button>
   <div class="grid2">${numF(T('Копий по кругу', 'Copies in a circle'), 'id="cirN" min="2"', toolOpt.cc, '', 1)}${numF(T('Радиус', 'Radius'), 'id="cirR" min="1"', toolOpt.cr, MM(), 1)}</div>
   <button class="btn" data-act="circArr">${ic('circle', 14)} ${T('Круговой массив', 'Circular array')}</button>
   <button class="btn" data-act="split">${ic('split', 14)} ${T('Разрезать крупную деталь на части…', 'Split a large part into tiles…')}</button>
   <p class="note">${T('Вычитание: из самой большой фигуры удаляются остальные. Alt+клик или двойной клик выбирает объект внутри группы.', 'Subtract removes the other shapes from the largest. Alt+click or double-click picks one object inside a group.')}</p>`, 'pro');
  el.innerHTML = h;
}
function sheetPanel() {
  const sh = sheetAt(curPlate), m = matById(sh.mat), pi = SHEET_PRESETS.findIndex(p => p[1] === sh.w && p[2] === sh.h);
  const zones = (sh.zones || []).map((z, i) => `<div class="li"><span class="sw" style="background:rgba(229,72,77,.5)"></span><span class="nm">${T('Зона', 'Zone')} ${i + 1}</span><span class="meta">${fx(z.w, 0)}×${fx(z.h, 0)} @ ${fx(z.x, 0)},${fx(z.y, 0)}</span><button class="mini" data-act="zoneDel" data-v="${i}" title="${T('Удалить зону', 'Delete zone')}">${ic('trash', 14)}</button></div>`).join('');
  const lays = S.layouts.map((L, i) => `<div class="li"><span class="nm">${esc(L.name)}<br><span class="meta">${new Date(L.date).toLocaleString(lang)} · ${L.sheets.length} ${T('лист.', 'sh.')}</span></span><button class="mini" data-act="layoutRestore" data-v="${i}" title="${T('Восстановить', 'Restore')}">${ic('undo', 14)}</button><button class="mini" data-act="layoutDel" data-v="${i}" title="${T('Удалить', 'Delete')}">${ic('trash', 14)}</button></div>`).join('');
  return sec(T('Лист', 'Sheet') + ': ' + esc(sheetName(sh, curPlate)), `<label class="fld pro"><span>${T('Название листа', 'Sheet name')}</span><input class="plain" data-sh="name" value="${esc(sh.name)}" placeholder="${esc(T('Лист ', 'Sheet ') + (curPlate + 1))}"></label>
    <label class="fld"><span>${T('Материал', 'Material')}</span><select class="plain" id="shMat">${matOptions(S.machine.type, sh.mat)}</select></label>
    <div class="row">${statusPill(m)}${m && m.notes ? `<span class="note grow">${esc(L10(m.notes))}</span>` : ''}</div>
    <div class="grid2">${numF(T('Толщина', 'Thickness'), 'data-sh="thick" min="0.1"', sh.thick, MM(), .1, '', 'thick')}${selF(T('Формат', 'Format'), 'id="shPreset"', [['', T('свой', 'custom')], ...SHEET_PRESETS.map((p, i) => [i, p[0]]), ['bed', T('весь стол', 'whole bed')]], pi >= 0 ? pi : '')}
    ${numF(T('Ширина', 'Width'), 'data-sh="w" min="10"', sh.w, MM(), 1)}${numF(T('Высота', 'Height'), 'data-sh="h" min="10"', sh.h, MM(), 1)}
    ${numF(T('Отступ X', 'Offset X'), 'data-sh="x" min="0"', sh.x, MM(), 1, 'pro')}${numF(T('Отступ Y', 'Offset Y'), 'data-sh="y" min="0"', sh.y, MM(), 1, 'pro')}
    ${numF(T('Поля для раскладки', 'Nesting margin'), 'data-sh="margin" min="0"', sh.margin, MM(), .5)}</div>
    <button class="btn" data-act="materials">${ic('layers', 14)} ${T('Библиотека материалов…', 'Material library…')}</button>
    <p class="note">${T('Лист — заготовка на столе в реальном размере. Мастера и раскладка кладут детали внутрь него.', 'The sheet is the stock on the bed at real size. Wizards and nesting place parts inside it.')}</p>`) +
    sec(T('Запретные зоны', 'No-go zones'), `${zones ? `<div class="list">${zones}</div>` : `<p class="note">${T('Нет зон. Отметьте прижимы и дефекты листа — раскладка их обойдёт.', 'No zones. Mark clamps and defects — nesting will avoid them.')}</p>`}<button class="btn" data-act="zoneTool">${ic('zone', 14)} ${T('Нарисовать зону', 'Draw a zone')} <span class="kbd">B</span></button>`, 'pro', infoBtn('zones')) +
    sec(T('Варианты раскладки', 'Layout variants'), `${lays ? `<div class="list">${lays}</div>` : `<p class="note">${T('Сохраните текущее расположение деталей, чтобы сравнить или вернуть его позже.', 'Save the current part positions to compare or restore them later.')}</p>`}<button class="btn" data-act="layoutSave">${ic('save', 14)} ${T('Сохранить вариант', 'Save variant')}</button>`, 'pro');
}
function renderRightIdle(el) {
  let opt = '';
  if (tool === 'rect') opt = numF(T('Радиус скругления', 'Corner radius'), 'data-topt="radius" min="0"', toolOpt.radius, MM(), .5);
  else if (tool === 'polygon') opt = numF(T('Число сторон', 'Sides'), 'data-topt="sides" min="3" max="64"', toolOpt.sides, '', 1);
  else if (tool === 'star') opt = `<div class="grid2">${numF(T('Лучей', 'Points'), 'data-topt="points" min="3" max="40"', toolOpt.points, '', 1)}${numF(T('Внутр. радиус', 'Inner radius'), 'data-topt="inner" min="5" max="95"', toolOpt.inner, '%', 1)}</div>`;
  else if (tool === 'text') opt = textFields(toolOpt, 'data-topt') + `<p class="note">${T('Кликните по холсту, чтобы поставить текст. Текст остаётся редактируемым.', 'Click the canvas to place text. It stays editable.')}</p>`;
  else if (tool === 'pen') opt = `<p class="note">${T('Клик — точка. Клик по первой точке замыкает контур, Enter или двойной клик — открытая линия, Esc — отмена.', 'Click to add points. Click the first point to close, Enter or double-click to finish open, Esc to cancel.')}</p>`;
  else if (tool === 'measure') opt = `<p class="note">${T('Тяните от точки к точке — покажу расстояние, угол и смещения. Shift — шаг 15°.', 'Drag between two points to see distance, angle and offsets. Shift snaps to 15°.')}</p>`;
  else if (tool === 'zone') opt = `<p class="note">${T('Тяните прямоугольник на листе: раскладка не будет класть туда детали. Двойной клик по зоне — удалить.', 'Drag a rectangle on a sheet: nesting will keep parts out of it. Double-click a zone to delete it.')}</p>`;
  const cur = TOOLS_UI().find(t => t && t[0] === tool);
  el.innerHTML = (opt ? sec(T('Инструмент', 'Tool') + ': ' + cur[2], opt) : '') + sheetPanel() +
    sec(T('Сетка', 'Grid'), `<div class="row"><label class="chk"><input type="checkbox" id="snapChk" ${S.snapOn ? 'checked' : ''}> ${T('Привязка к сетке', 'Snap to grid')}</label><div class="inp" style="width:96px"><input type="number" id="snapStep" value="${S.snap}" step="0.5" min="0.1"><em>${MM()}</em></div></div>
     <div class="kv"><span>${T('Листов в проекте', 'Sheets in project')}</span><b>${S.sheets.length}</b><span>${T('Объектов', 'Objects')}</span><b>${S.shapes.length}</b></div>`);
}
/* ---- CAM: settings of the selected operation ---- */
function laserLayerHtml(L) {
  const l = L.laser, sh = sheetAt(curPlate), r = resolveLaser(L, sh), t = L.type, raster = t === 'raster', fill = t === 'fill', cut = t === 'cut', hasImg = S.shapes.some(s => s.layer === L.id && s.kind === 'image');
  const kn = (lab, k, unit, step, min, max, help, cls = '') => numF(lab, `data-k="laser.${k}" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''}`, l[k], unit, step, cls, help);
  let h = selF(T('Тип процесса', 'Process type'), 'data-k="type"', LTYPES.map(x => [x, ltypeName(x)]), t, '', 'layerType');
  if (t === 'guide') return h + `<p class="note">${T('Направляющие видны на чертеже, но не попадают в G-code.', 'Guides are visible in the drawing but never go into the G-code.')}</p>`;
  h += `<div class="seg full"><button data-act="layerAuto" aria-pressed="${!!L.auto}">${T('Из материала', 'From material')}</button><button data-act="layerManual" aria-pressed="${!L.auto}">${T('Вручную', 'Manual')}</button></div>`;
  if (L.auto) {
    /* material values, each of them can be corrected by hand (kept as the layer's own value) */
    const own = new Set(r.own || []), ko = (lab, k, unit, step, min, max, help) => `<label class="fld${own.has(k) ? ' own' : ''}"><span>${lab}${help ? infoBtn(help) : ''}${own.has(k) ? ` <button type="button" class="reset" data-act="ovrReset" data-v="${k}" title="${T('Вернуть значение материала', 'Back to the material value')}">↺ ${T('своё', 'own')}</button>` : ''}</span><div class="inp"><input type="number" data-ko="${k}" value="${fx(r[k], 3)}" step="${step}" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''}>${unit ? `<em>${unit}</em>` : ''}</div></label>`;
    h += `<div class="grid2">${ko(T('Мощность', 'Power'), 'power', '%', 1, 0, 100)}${ko(T('Скорость', 'Speed'), 'speed', MMIN(), 10, 1)}${ko(T('Проходов', 'Passes'), 'passes', '', 1, 1, 50, 'passes')}${fill || raster || hasImg ? ko(T('Шаг строк', 'Line interval'), 'interval', MM(), .01, .02, 2, 'interval') : ''}${raster || hasImg ? ko(T('Мин. мощность', 'Min power'), 'minPower', '%', 1, 0, 100, 'minPower') : ''}${cut ? ko(T('Ширина реза', 'Kerf'), 'kerf', MM(), .01, 0, 1, 'kerf') : ''}</div>
     <p class="note">${T('Источник', 'Source')}: <b>${r.src === 'material' ? esc(L10(r.mat.name)) : T('параметры слоя', 'layer values')}</b>${own.size ? T(' · свои значения отмечены «↺ своё»', ' · your own values are marked “↺ own”') : T(' · любое значение можно изменить', ' · any value can be changed')}</p>
     ${r.unverified ? `<div class="warnline">${ic('warn', 13)} ${T('Профиль материала не проверен на вашем станке. Сделайте тест мощности и сохраните свои значения.', 'The material profile is not verified on your machine. Run a power test and save your own values.')}</div>` : ''}`;
    if (own.size) h += `<button class="btn" data-act="layerToMat">${ic('save', 14)} ${T('Сохранить свои значения в материал…', 'Save your values to the material…')}</button>`;
  } else {
    h += `<label class="fld"><span>${T('Мощность', 'Power')}: <b>${l.power}%</b></span><input type="range" min="0" max="100" value="${l.power}" data-k="laser.power"></label>
     <label class="fld"><span>${T('Скорость', 'Speed')}: <b>${l.speed} ${MMIN()}</b></span><input type="range" min="50" max="${Math.max(S.machine.maxFeed || 12000, l.speed)}" step="50" value="${l.speed}" data-k="laser.speed"></label>
     <div class="grid2">${kn(T('Мощность', 'Power'), 'power', '%', 1, 0, 100, null, 'pro')}${kn(T('Скорость', 'Speed'), 'speed', MMIN(), 10, 1, null, null, 'pro')}${kn(T('Проходов', 'Passes'), 'passes', '', 1, 1, 50, 'passes')}${fill || raster || hasImg ? kn(T('Шаг строк', 'Line interval'), 'interval', MM(), .01, .02, 2, 'interval') : ''}${raster || hasImg ? kn(T('Мин. мощность', 'Min power'), 'minPower', '%', 1, 0, 100, 'minPower') : ''}${cut ? kn(T('Ширина реза', 'Kerf'), 'kerf', MM(), .01, 0, 1, 'kerf') : ''}</div>
     ${fill || raster || hasImg ? `<p class="note">${T('Шаг', 'Interval')} ${l.interval} ${MM()} ≈ ${Math.round(25.4 / l.interval)} DPI</p>` : ''}
     <button class="btn" data-act="layerToMat">${ic('save', 14)} ${T('Сохранить значения в материал…', 'Save values to the material…')}</button>`;
  }
  r.warn.forEach(w => { h += `<div class="warnline">${ic('warn', 13)} ${esc(w)}</div>` });
  h += `<div class="grid2 pro">${fill || raster || hasImg ? selF(T('Направление', 'Direction'), 'data-k="laser.scan"', [['h', T('горизонтально (X)', 'horizontal (X)')], ['v', T('вертикально (Y)', 'vertical (Y)')]], l.scan, '', 'scan') + kn(T('Перебег', 'Overscan'), 'overscan', MM(), .5, 0, 50, 'overscan') : ''}${fill ? kn(T('Угол заливки', 'Fill angle'), 'angle', '°', 5, -180, 180) : ''}
   ${cut ? selF(T('Сторона компенсации', 'Compensation side'), 'data-k="laser.kerfSide"', [['auto', T('авто (деталь в размер)', 'auto (part to size)')], ['outside', T('снаружи', 'outside')], ['inside', T('внутри', 'inside')], ['none', T('без компенсации', 'none')]], l.kerfSide, '', 'kerfSide') + kn(T('Перемычки на контур', 'Bridges per outline'), 'bridges', '', 1, 0, 20, 'bridges') + kn(T('Ширина перемычки', 'Bridge width'), 'bridgeW', MM(), .1, .1, 10) : ''}
   ${S.machine.hasZ ? kn(T('Смещение фокуса', 'Focus offset'), 'focus', MM(), .1, -20, 20, 'focus') : ''}${kn(T('Допуск объединения', 'Merge tolerance'), 'joinTol', MM(), .01, 0, .5, 'joinTol')}</div>
   ${fill || raster || hasImg ? `<label class="chk pro"><input type="checkbox" data-kb="laser.bidir" ${l.bidir !== false ? 'checked' : ''}> ${T('Двунаправленная гравировка', 'Bidirectional engraving')}</label>` : ''}
   ${chkF(T('Обдув (M8/M9)', 'Air assist (M8/M9)'), 'data-kb="laser.air"', l.air, '', 'air')}`;
  return h;
}
function cncLayerHtml(L) {
  const c = L.cnc, sh = sheetAt(curPlate), r = resolveCnc(L, sh), op = c.op, prof = op === 'out' || op === 'in', tools = allTools();
  const kn = (lab, k, unit, step, min, max, cls = '') => numF(lab, `data-k="cnc.${k}" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''}`, c[k], unit, step, cls);
  let h = selF(T('Тип обработки', 'Operation type'), 'data-k="cnc.op"', CNC_OPS.map(o => [o, cncOpName(o)]), op, '', 'layerType') +
    `<div class="row">${selF(T('Фреза', 'Tool'), 'data-k="cnc.toolId"', tools.map(t => [t.id, toolName(t)]), c.toolId, 'grow')}<div class="fld" style="align-self:end"><button class="btn" data-act="tools" title="${T('Библиотека фрез', 'Tool library')}">${ic('cnc', 14)}</button></div></div>
     <div class="seg full"><button data-act="layerAuto" aria-pressed="${!!L.auto}">${T('Режимы из материала', 'Feeds from material')}</button><button data-act="layerManual" aria-pressed="${!L.auto}">${T('Вручную', 'Manual')}</button></div>`;
  if (L.auto) { const own = new Set(r.own || []), kc = (lab, k, unit, step, min) => `<label class="fld${own.has(k) ? ' own' : ''}"><span>${lab}${own.has(k) ? ` <button type="button" class="reset" data-act="ovrReset" data-v="${k}" title="${T('Вернуть автоматическое значение', 'Back to the automatic value')}">↺ ${T('своё', 'own')}</button>` : ''}</span><div class="inp"><input type="number" data-kc="${k}" value="${fx(r[k], 2)}" step="${step}" min="${min}"><em>${unit}</em></div></label>`;
    h += `<div class="grid2">${kc(T('Глубина', 'Depth'), 'depth', MM(), .1, .05)}${kc(T('Шаг по Z', 'Step down'), 'step', MM(), .1, .05)}${kc(T('Подача', 'Feed'), 'feed', MMIN(), 10, 1)}${kc(T('Врезание', 'Plunge'), 'plunge', MMIN(), 10, 1)}${kc(T('Обороты', 'Spindle'), 'rpm', T('об/мин', 'rpm'), 500, 0)}</div><p class="note">${T('Значения рассчитаны по материалу и фрезе; любое можно изменить.', 'Values are calculated from the material and the tool; any of them can be changed.')}</p>` }
  else h += `<div class="grid2">${kn(T('Глубина', 'Depth'), 'depth', MM(), .1, .05)}${kn(T('Шаг по Z', 'Step down'), 'step', MM(), .1, .05)}${kn(T('Подача', 'Feed'), 'feed', MMIN(), 10, 1)}${kn(T('Врезание', 'Plunge'), 'plunge', MMIN(), 10, 1)}${kn(T('Обороты', 'Spindle'), 'rpm', T('об/мин', 'rpm'), 500, 0)}</div>`;
  h += `<div class="grid2">${op === 'pocket' ? kn(T('Перекрытие', 'Stepover'), 'stepover', '%', 5, 5, 95) : ''}${prof || op === 'pocket' ? kn(T('Припуск на чистовой', 'Finishing pass'), 'finish', MM(), .05, 0, 2, 'pro') : ''}${op === 'vcarve' ? kn(T('Шаг колец', 'Ring step'), 'vstep', MM(), .05, .05, null, 'pro') : ''}${op === 'chamfer' ? kn(T('Ширина фаски', 'Chamfer width'), 'chamferW', MM(), .1, .1) : ''}</div>`;
  r.warn.forEach(w => { h += `<div class="warnline">${ic('warn', 13)} ${esc(w)}</div>` });
  if (prof) h += `<h4 class="sub">${T('Перемычки', 'Holding tabs')}</h4><div class="grid3">${kn(T('Кол-во', 'Count'), 'tabs', '', 1, 0, 24)}${kn(T('Высота', 'Height'), 'tabH', MM(), .1, .1)}${kn(T('Ширина', 'Width'), 'tabW', MM(), .5, .5)}</div><p class="note">${T('Перемычки держат деталь, чтобы она не вылетела на последнем проходе.', 'Tabs keep the part attached so it does not fly out on the last pass.')}</p>`;
  if (op === 'relief') h += `<p class="note">${T('Рельеф: черновая обработка этой фрезой, чистовая — сферической, заданной в параметрах рельефа.', 'Relief: roughing with this tool, finishing with the ball nose chosen in the relief settings.')}</p>`;
  h += cncZHtml(L);
  return h;
}
/* Z axis behaviour: presets (acrylic etc.) or own values */
function cncZHtml(L) {
  const c = L.cnc, mode = resolveCnc(L, sheetAt(curPlate)).zMode || 'std', Z = Object.assign({}, CNC_Z_DEF, Z_PRESETS[mode] || {}, mode === 'custom' ? c : {}), cu = mode === 'custom';
  const kz = (lab, k, unit, step, min, max) => numF(lab, `data-k="cnc.${k}" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''} ${cu ? '' : 'disabled'}`, Z[k], unit, step);
  const sz = (lab, k, opts) => selF(lab, `data-k="cnc.${k}" ${cu ? '' : 'disabled'}`, opts, Z[k]);
  let h = `<h4 class="sub">${T('Ось Z: врезание и подъёмы', 'Z axis: entry and lifts')}${infoBtn('zMode')}</h4>` + selF(T('Режим', 'Mode'), 'data-k="cnc.zMode"', Z_MODES(), mode);
  h += `<div class="grid2">${sz(T('Врезание', 'Entry'), 'entry', [['plunge', T('сверху', 'straight')], ['ramp', T('по наклонной', 'ramp')]])}${Z.entry === 'ramp' ? kz(T('Угол наклона', 'Ramp angle'), 'rampAng', '°', 1, 1, 45) : ''}
    ${sz(T('Подъём между контурами', 'Lift between shapes'), 'retract', [['safe', T('на безопасную высоту', 'to safe height')], ['low', T('низко над заготовкой', 'just above the stock')]])}${Z.retract === 'low' ? kz(T('Зазор над заготовкой', 'Clearance'), 'clearH', MM(), .5, .3, 20) : ''}
    ${sz(T('Подъём для стружки', 'Chip-clearing lift'), 'lift', [['none', T('нет', 'none')], ['pass', T('после каждого прохода', 'after each pass')], ['dist', T('через каждые N мм', 'every N mm')]])}${Z.lift === 'dist' ? kz(T('Каждые', 'Every'), 'liftEvery', MM(), 5, 5, 1000) : ''}
    ${sz(T('Охлаждение', 'Coolant'), 'coolant', [['none', T('нет', 'none')], ['M7', T('туман (M7)', 'mist (M7)')], ['M8', T('обдув/СОЖ (M8)', 'air/flood (M8)')]])}${kz(T('Пауза разгона шпинделя', 'Spindle spin-up wait'), 'spinWait', T('с', 's'), .5, 0, 30)}</div>
    <label class="chk"><input type="checkbox" data-kb="cnc.spring" ${Z.spring ? 'checked' : ''} ${cu ? '' : 'disabled'}> ${T('Чистовой проход без снятия глубины (контур)', 'Spring pass at full depth (profile)')}</label>`;
  if (mode === 'acrylic') h += `<p class="note">${T('Оргстекло плавится от трения: врезание по наклонной, обдув, подъём после каждого прохода, чтобы стружка не наваривалась, и чистовой проход для прозрачной кромки. Берите однозаходную фрезу «для пластика», обороты ниже, подачу выше.', 'Acrylic melts from friction: ramp entry, air blast, a lift after each pass so chips do not weld, and a spring pass for a clear edge. Use a single-flute plastic bit, lower rpm, higher feed.')}</p>`;
  else if (!cu) h += `<p class="note">${T('Чтобы изменить отдельные значения, выберите «Свои настройки» — они начнутся с текущего режима.', 'To change single values pick “Custom” — it starts from the current mode.')}</p>`;
  return h;
}
function layerHeadSeg(L) {
  if (!S.machine.combo) return '';
  const h = layerHead(L);
  return `<div class="seg full"><button data-act="layerHead" data-v="laser" aria-pressed="${h === 'laser'}">${ic('laser', 13)} ${T('Лазер', 'Laser')}</button><button data-act="layerHead" data-v="cnc" aria-pressed="${h === 'cnc'}">${ic('cnc', 13)} ${T('Фрезер', 'Router')}</button></div>`;
}
function renderRightCam(el) {
  const L = camSel != null ? S.layers[camSel] : null, st = P.stats, est = P.est, jw = (P.job && P.job.warn) || [];
  let h = '';
  if (L) h += `<div class="sec"><h3><span class="sw" style="background:${L.color}"></span>${T('Операция', 'Operation')}<span class="sp"></span>${infoBtn('auto')}</h3><label class="fld pro"><span>${T('Название', 'Name')}</span><input class="plain" id="layerName" value="${esc(layerName(L))}"></label>${layerHeadSeg(L)}${layerHead(L) === 'laser' ? laserLayerHtml(L) : cncLayerHtml(L)}</div>`;
  else h += sec(T('Операция', 'Operation'), `<p class="note">${T('Выберите операцию слева.', 'Pick an operation on the left.')}</p>`);
  h += sec(T('Итог листа', 'Sheet summary') + ' ' + (curPlate + 1), `<div class="statgrid"><div class="stat big"><span>${T('Время (оценка', 'Time (estimate')}${est && est.withAccel ? T(', с ускорениями', ', with acceleration') : ''})</span><b>${est ? fmtTime(est.time) : '—'}</b></div>
    <div class="stat"><span>${isLaser() ? T('Рабочий путь', 'Burn path') : T('Резание', 'Cutting')}</span><b>${est ? fmtLen(est.cut) : '—'}</b></div><div class="stat"><span>${T('Холостые', 'Travel')}</span><b>${est ? fmtLen(est.travel) : '—'}</b></div></div>
    ${jw.map(w => `<div class="warnline">${ic('warn', 13)} ${esc(w)}</div>`).join('')}
    <p class="note">${T('Оценка учитывает ускорения из профиля станка, но не заменяет пробный прогон.', 'The estimate uses the machine profile accelerations but does not replace a test run.')}</p>`);
  h += sec(T('Задание', 'Job'), `${chkF(T('Сначала внутренние контуры', 'Cut inner shapes first'), 'data-job="innerFirst"', S.job.innerFirst)}${isLaser() ? chkF(T('Гравировка перед резкой (авто-порядок)', 'Engrave before cutting (auto order)'), 'data-job="engraveFirst"', S.job.engraveFirst, '', 'engraveFirst') : ''}
    <p class="note">${isLaser() ? T('Ноль XY — левый нижний угол поля. Холостые ходы — с выключенным лучом.', 'XY zero is the lower-left corner. Travel moves run with the beam off.') : T('Ноль Z — верх заготовки, ноль XY — левый нижний угол поля.', 'Z zero is the stock top, XY zero is the lower-left corner.')}</p>`, 'pro');
  el.innerHTML = h;
}
function renderRightGcode(el) {
  const st = P.stats, rep = P.report, jw = (!P.file && P.job && P.job.warn) || [];
  const items = rep ? rep.errors.map(e => ['e', e]).concat(rep.warns.map(e => ['w', e]), rep.infos.map(e => ['i', e])) : [];
  // three facts a newcomer needs: how long, does it fit, any errors
  const m = S.machine, fits = st && P.moves.length ? st.b[0] >= -.05 && st.b[1] >= -.05 && st.b[3] <= m.w + .05 && st.b[4] <= m.h + .05 : null, nerr = rep ? rep.errors.length : 0;
  const ready = st && P.moves.length ? `<div class="sec ready"><h3>${T('Готово к запуску?', 'Ready to run?')}</h3>
    <div class="rdy"><span>${ic('clock', 16)}</span><b>${T('Время', 'Time')} ≈ ${fmtTime(!P.file && P.est ? P.est.time : st.time)}</b></div>
    <div class="rdy ${fits ? 'ok' : 'bad'}"><span>${ic(fits ? 'check' : 'warn', 16)}</span><b>${fits ? T('Помещается в рабочее поле', 'Fits the work area') : T('Выходит за рабочее поле станка', 'Goes outside the work area')}</b></div>
    <div class="rdy ${nerr ? 'bad' : 'ok'}"><span>${ic(nerr ? 'warn' : 'check', 16)}</span><b>${nerr ? T(`Ошибок: ${nerr} — список ниже`, `${nerr} errors — see below`) : T('Ошибок нет', 'No errors')}</b></div></div>` : '';
  el.innerHTML = ready + `<div class="sec pro"><h3>${T('Сводка', 'Summary')}</h3>${st && P.moves.length ? `<div class="statgrid"><div class="stat big"><span>${T('Время (оценка)', 'Time (estimate)')}</span><b>${fmtTime(!P.file && P.est ? P.est.time : st.time)}</b></div>
    <div class="stat"><span>${P.laser ? T('Прожиг', 'Burn') : T('Резание', 'Cutting')}</span><b>${fmtLen(st.cut)}</b></div><div class="stat"><span>${T('Холостые', 'Travel')}</span><b>${fmtLen(st.rapid)}</b></div>
    <div class="stat"><span>${T('Перемещений', 'Moves')}</span><b>${st.n.toLocaleString(lang)}</b></div><div class="stat"><span>${T('Строк', 'Lines')}</span><b>${P.lines.length.toLocaleString(lang)}</b></div></div>
    <div class="kv"><span>${T('Габарит X', 'Extent X')}</span><b>${fx(st.b[0], 1)} … ${fx(st.b[3], 1)} ${MM()}</b><span>${T('Габарит Y', 'Extent Y')}</span><b>${fx(st.b[1], 1)} … ${fx(st.b[4], 1)} ${MM()}</b>${P.laser ? '' : `<span>${T('Глубина Z', 'Depth Z')}</span><b>${fx(st.b[2], 2)} … ${fx(st.b[5], 2)} ${MM()}</b>`}</div>` : `<p class="note">${T('Нет G-code. Нарисуйте объекты и нажмите «Подготовить».', 'No G-code yet. Draw shapes and press “Prepare”.')}</p>`}</div>
   <div class="sec"><h3>${T('Проверка кода', 'Code check')}<span class="sp"></span>${rep ? `<span class="pill ${rep.errors.length ? 'bad' : rep.warns.length || jw.length ? 'warn' : 'ok'}">${rep.errors.length ? T('ошибки: ', 'errors: ') + rep.errors.length : rep.warns.length || jw.length ? T('предупреждения', 'warnings') : T('пройдена', 'passed')}</span>` : ''}</h3>
    ${items.length || jw.length ? `<ul class="issues">${items.map(([k, e]) => `<li class="${k}" ${e.line ? `data-act="gcLine" data-v="${e.line - 1}"` : ''}>${ic(k === 'i' ? 'info' : 'warn', 12)} ${e.line ? `<b>${T('стр.', 'ln')} ${e.line}</b> ` : ''}${esc(e.msg)}</li>`).join('')}${jw.map(w => `<li class="w">${ic('warn', 12)} ${esc(w)}</li>`).join('')}</ul>` : rep ? `<p class="note ok">${ic('check', 13)} ${T('Ошибок не найдено.', 'No problems found.')}</p>` : ''}
    <p class="note">${T('Проверка программы не заменяет холостой прогон на станке.', 'The software check does not replace a dry run on the machine.')}</p></div>
   <div class="sec"><h3>${T('Отображение', 'Display')}</h3>
    <div class="seg full"><button data-act="colorBy" data-v="layer" aria-pressed="${P.colorBy === 'layer'}">${T('Слои', 'Layers')}</button><button data-act="colorBy" data-v="feed" aria-pressed="${P.colorBy === 'feed'}">${T('Скорость', 'Speed')}</button>${P.laser ? `<button data-act="colorBy" data-v="power" aria-pressed="${P.colorBy === 'power'}">${T('Мощность', 'Power')}</button>` : `<button data-act="colorBy" data-v="z" aria-pressed="${P.colorBy === 'z'}">${T('Глубина', 'Depth')}</button>`}</div>
    <label class="chk"><input type="checkbox" id="rapChk" ${P.rapids ? 'checked' : ''}> ${T('Показывать холостые ходы', 'Show travel moves')}</label>
    <label class="chk"><input type="checkbox" id="ghostChk" ${P.ghost ? 'checked' : ''}> ${T('Показывать будущий путь', 'Show the remaining path')}</label>
    <label class="chk"><input type="checkbox" id="dirsChk" ${P.dirs ? 'checked' : ''}> ${T('Направления и точки включения', 'Directions and on/off points')}</label>
    <p class="note">${P.mode === '3d' ? T('3D: тяните для вращения, Shift или правая кнопка — сдвиг, колесо — масштаб.', '3D: drag to orbit, Shift or right-drag to pan, wheel to zoom.') : T('Колесо — масштаб, перетаскивание — панорама. Пробел — пуск/пауза.', 'Wheel to zoom, drag to pan. Space plays/pauses.')}</p></div>
   <div class="sec"><h3>${T('Легенда', 'Legend')}</h3><div class="legend">${legendHtml()}</div></div>`;
}
function legendHtml() {
  let h = `<div><i class="dash"></i>${T('Холостой ход (G0)', 'Travel (G0)')}</div>`;
  if (P.colorBy === 'layer') { const ls = P.layers.length ? P.layers : [{ name: T('Рабочий ход', 'Cutting'), color: css('--accent') }]; h += ls.map(l => `<div><i style="background:${l.color}"></i>${esc(l.name)}</div>`).join('') }
  else h += `<div><i style="background:linear-gradient(90deg,hsl(205 85% 55%),hsl(35 95% 55%))"></i>${P.colorBy === 'feed' ? T('медленно → быстро', 'slow → fast') : P.colorBy === 'power' ? T('слабо → мощно', 'low → high power') : T('мелко → глубоко', 'shallow → deep')}</div>`;
  return h;
}
function renderRightMachine(el) { el.innerHTML = '' }

/* ============================== STATUS ============================== */
const HINTS = () => ({ select: T('Клик — выбрать (группа целиком), Shift — добавить, рамка — выделить, правая кнопка — меню.', 'Click selects (whole group), Shift adds, drag a box to select, right-click for the menu.'), hand: T('Тяните, чтобы двигать вид.', 'Drag to move the view.'), rect: T('Тяните, чтобы нарисовать прямоугольник. Shift — квадрат.', 'Drag to draw a rectangle. Shift for a square.'), ellipse: T('Тяните от угла. Shift — круг.', 'Drag from a corner. Shift for a circle.'), polygon: T('Тяните от центра.', 'Drag from the centre.'), star: T('Тяните от центра.', 'Drag from the centre.'), line: T('Тяните от начала к концу. Shift — шаг 15°.', 'Drag from start to end. Shift snaps to 15°.'), pen: T('Клик — точка, Enter — завершить.', 'Click to add points, Enter to finish.'), text: T('Клик — поставить текст.', 'Click to place text.'), measure: T('Тяните, чтобы измерить.', 'Drag to measure.'), zone: T('Тяните, чтобы отметить запретную зону.', 'Drag to mark a no-go zone.') });
function renderStatus() {
  const c = cursorW ? `X ${fx(cursorW[0] - plateX(curPlate), 2).toFixed(2)}  Y ${fx(cursorW[1], 2).toFixed(2)}` : 'X —  Y —', sh = sheetAt(curPlate), m = matById(sh.mat);
  const hint = tab === 'cad' ? HINTS()[tool] : tab === 'cam' ? T('Траектории пересчитываются при каждом изменении параметров.', 'Toolpaths recalculate whenever parameters change.') : tab === 'gcode' ? T('Клик по строке переносит симуляцию к ней.', 'Click a line to jump the simulation there.') : T('Перемещения — шагом, выбранным над джойстиком.', 'Jog moves use the step chosen above the pad.');
  $('#status').innerHTML = `<span class="mono">${c}</span><span class="hint">${hint}</span>${tab === 'cad' ? `<button data-act="snapT" aria-pressed="${S.snapOn}">${ic('grid', 13)} ${T('Сетка', 'Snap')} ${S.snap} ${MM()}</button>` : ''}<span class="mono">${esc(matLabel(m, sh.thick))}</span><span class="mono">${Math.round(V.s / (96 / 25.4) * 100)}%</span><span class="mono" title="${dirty ? T('Есть изменения, не сохранённые в файл. Автосохранение работает.', 'Changes not saved to a file. Autosave is on.') : T('Сохранено', 'Saved')}">${dirty ? '● ' + T('не сохранено в файл', 'not saved to file') : '✓ ' + T('сохранено', 'saved')}</span>${hasClip() ? '' : `<span class="mono" style="color:var(--warn)">⚠ ${T('без Clipper', 'no Clipper')}</span>`}`;
}
