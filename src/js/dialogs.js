'use strict';
/* ============================================================================
   SkyKerf_Studio · dialogs: project files, new project, machine settings,
   material library, tool library, macros
   ============================================================================ */

/* ---------------- downloads (web) ---------------- */
function downloadFile(name, data, mime) {
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 2000); return true;
  } catch (e) { logError('download', e); return false }
}

/* Web version: offer files with both "Download" and "Copy". Some embedded viewers
   block downloads silently, so copying is always available as the fallback. */
let OFFER = null;
const fmtSize = n => n < 1024 ? n + ' B' : n < 1048576 ? fx(n / 1024, 1) + ' ' + T('КБ', 'KB') : fx(n / 1048576, 2) + ' ' + T('МБ', 'MB');
function offerFiles(files, title, onDone) {
  OFFER = { files, onDone };
  openModal(`${ic('save', 18)} ${title || T('Сохранение файлов', 'Save files')}`, `<p class="note big">${T('Браузер скачает файл в папку загрузок. Если скачивание не началось (например, во встроенном просмотре), нажмите «Копировать» и сохраните содержимое в файл с этим именем.', 'The browser downloads the file to your downloads folder. If nothing is downloaded (for example in an embedded viewer), press “Copy” and save the content into a file with this name.')}</p>
   <div class="tbl-wrap"><table class="tbl">${files.map((f, i) => `<tr><td><b>${esc(f.name)}</b><br><small class="note">${fmtSize(f.data.length)}</small></td><td class="r"><button class="btn" data-act="offerDl" data-v="${i}">${ic('export', 14)} ${T('Скачать', 'Download')}</button> <button class="btn" data-act="offerCopy" data-v="${i}">${ic('copy', 14)} ${T('Копировать', 'Copy')}</button></td></tr>`).join('')}</table></div><div id="offerTxt"></div>`,
    `<button class="primary" data-act="closeModal">${T('Готово', 'Done')}</button>`, 'wide');
  onModalClose = () => { OFFER = null };
}
function offerAction(act, i) {
  const f = OFFER && OFFER.files[+i]; if (!f) return;
  if (act === 'offerDl') { downloadFile(f.name, f.data, f.mime); if (OFFER.onDone) OFFER.onDone(); return }
  const show = () => { $('#offerTxt').innerHTML = `<label class="fld"><span>${T('Выделите всё (Ctrl+A) и скопируйте (Ctrl+C):', 'Select all (Ctrl+A) and copy (Ctrl+C):')} ${esc(f.name)}</span><textarea class="plain" id="offerArea" rows="8" readonly>${esc(f.data.length > 3e6 ? f.data.slice(0, 3e6) : f.data)}</textarea></label>`; const a = $('#offerArea'); a.focus(); a.select() };
  try { navigator.clipboard.writeText(f.data).then(() => { toast(T(`Скопировано: ${f.name}`, `Copied: ${f.name}`)); if (OFFER && OFFER.onDone) OFFER.onDone() }, show) } catch (e) { show() }
}

/* ---------------- project files ---------------- */
async function openProjectText(text, name, path) {
  let res;
  try { res = parseProject(text) } catch (e) { toast(e instanceof ProjectError ? e.message : T('Не удалось открыть проект: ', 'Could not open the project: ') + (e.message || e), 'err'); logError('open', e); return false }
  const hadContent = S && S.shapes.length;
  if (hadContent) pushUndo(T('Открытие проекта', 'Open project'));
  S = res.state; REVMAX = Math.max(REVMAX, S.rev | 0); S.name = S.name || String(name || '').replace(/\.[^.]+$/, '') || '';
  projPath = path || null; migratedFrom = res.migratedFrom; dirty = !!res.migratedFrom;
  sel.clear(); curPlate = 0; camSel = null; P.file = null; GC.clear(); changed(); if (!res.migratedFrom) { dirty = false; renderStatus() }
  fitPlate(0); draw();
  const notes = [];
  if (res.migratedFrom) notes.push(T(`Проект старого формата (v${res.migratedFrom}) преобразован в v${FORMAT_VERSION}. Исходный файл не изменён; при сохранении поверх него рядом будет создана резервная копия.`, `An old-format project (v${res.migratedFrom}) was converted to v${FORMAT_VERSION}. The original file is untouched; saving over it keeps a backup copy next to it.`));
  const miss = missingFonts(S);
  if (miss.length) notes.push(T(`Не найдены шрифты: ${miss.join(', ')}. Контуры текста сохранены как есть, но при редактировании текста будет использован запасной шрифт.`, `Missing fonts: ${miss.join(', ')}. Text outlines are kept as they are, but editing the text will use a fallback font.`));
  const unknownMats = S.sheets.filter(sh => !matById(sh.mat)).map(sh => sh.mat);
  if (unknownMats.length) notes.push(T(`Материалы листов не найдены в библиотеке: ${[...new Set(unknownMats)].join(', ')}. Для них используются параметры слоёв — проверьте листы.`, `Sheet materials not found in the library: ${[...new Set(unknownMats)].join(', ')}. Layer values are used instead — check the sheets.`));
  if (notes.length) openModal(`${ic('info', 18)} ${T('Проект открыт', 'Project opened')}`, notes.map(n => `<p class="note big">${esc(n)}</p>`).join(''), `<button class="primary" data-act="closeModal">${T('Понятно', 'Got it')}</button>`);
  else toast(T('Открыт проект ', 'Opened project ') + (name || ''));
  return true;
}
function openProjectDialog() { $('#fileProj').click() }
async function saveProject(as) {
  const name = (S.name || APP_NAME).replace(/[\\/:*?"<>|]+/g, '_'), data = serialize(S);
  if (DESK && DESK.saveProject) {
    try {
      const r = await DESK.saveProject({ path: as ? null : projPath, name: name + '.kerf', data, backupOld: !!migratedFrom });
      if (r && r.ok) { projPath = r.path; dirty = false; migratedFrom = null; S.name = S.name || r.path.split(/[\\/]/).pop().replace(/\.[^.]+$/, ''); toast(T('Проект сохранён: ', 'Project saved: ') + r.path + (r.backup ? T(' (резервная копия старого файла: ', ' (backup of the old file: ') + r.backup + ')' : '')); refresh() }
    } catch (e) { logError('save', e); toast(T('Не удалось сохранить проект: ', 'Could not save the project: ') + (e.message || e), 'err') }
    return;
  }
  offerFiles([{ name: name + '.kerf', data, mime: 'application/json' }], T('Сохранить проект', 'Save project'), () => { dirty = false; renderStatus() });
}
async function exportSide(kind) {
  const plate = curPlate, base = (S.name || APP_NAME).replace(/[\\/:*?"<>|]+/g, '_') + `_${plate + 1}`, data = kind === 'svg' ? svgExport(plate) : dxfExport(plate);
  if (DESK && DESK.saveFile) { try { const r = await DESK.saveFile({ name: `${base}.${kind}`, data, filters: [{ name: kind.toUpperCase(), extensions: [kind] }] }); if (r && r.ok) toast(T('Сохранено: ', 'Saved: ') + r.path) } catch (e) { toast(T('Не удалось сохранить: ', 'Could not save: ') + (e.message || e), 'err') } return }
  offerFiles([{ name: `${base}.${kind}`, data, mime: kind === 'svg' ? 'image/svg+xml' : 'application/dxf' }], kind.toUpperCase());
}

/* ---------------- new project ---------------- */
let NP = null;
function allMachineProfiles() { return MACHINES.concat(userMachines()) }
function openNewProject() { const mm = S.machine; NP = { m: allMachineProfiles().some(x => x.id === mm.id) ? mm.id : MACHINES[0].id, mat: null, thick: null, sheet: 2, w: 300, h: 200, name: '' }; renderNewProject() }
function machineCards(curId, act, canDelete) { return `<div class="presets">${allMachineProfiles().map(p => { const mine = !MACHINES.includes(p); return `<div class="preset-wrap"><button class="preset${p.id === curId ? ' on' : ''}" data-act="${act}" data-v="${esc(p.id)}"><span class="row">${ic(p.type === 'laser' ? 'laser' : 'cnc', 16)}<b>${esc(p.name)}</b></span><small>${p.w}×${p.h} ${MM()}${mine ? ' · ' + T('мой', 'mine') : ''}</small></button>${mine && canDelete ? `<button class="mini del" data-act="delMachine" data-v="${esc(p.id)}" title="${T('Удалить профиль', 'Delete profile')}">${ic('trash', 14)}</button>` : ''}</div>` }).join('')}</div>` }
function renderNewProject() {
  const mm = allMachineProfiles().find(x => x.id === NP.m) || MACHINES[0], ml = matsForMachine(mm.type);
  if (!NP.mat || !ml.some(m => m.id === NP.mat)) { NP.mat = ml[0].id; NP.thick = null } const mt = matById(NP.mat); if (NP.thick == null) NP.thick = mt.thick;
  const ps = SHEET_PRESETS.concat([[T('Весь стол', 'Whole bed'), mm.w, mm.h]]);
  openModal(`${ic('newp', 18)} ${T('Новый проект', 'New project')}`, `<label class="fld"><span>${T('Название', 'Name')}</span><input class="plain" id="npName" value="${esc(NP.name)}" placeholder="${T('Например: Домик для внучки', 'e.g. Birdhouse')}"></label>
   <div class="fld"><span>${T('1. Станок', '1. Machine')}</span></div>${machineCards(NP.m, 'npMach')}
   <div class="grid2"><label class="fld"><span>${T('2. Материал', '2. Material')}</span><select class="plain" id="npMat">${matOptions(mm.type, NP.mat)}</select></label>${numF(T('Толщина (измерьте)', 'Thickness (measure it)'), 'id="npThick" min="0.1"', NP.thick, MM(), .1, '', 'thick')}</div>
   <div class="fld"><span>${T('3. Лист на столе', '3. Sheet on the bed')}</span></div><div class="seg full wrap">${ps.map((s, i) => `<button data-act="npSheet" data-v="${i}" aria-pressed="${NP.sheet === i}">${esc(s[0])}</button>`).join('')}<button data-act="npSheet" data-v="-1" aria-pressed="${NP.sheet === -1}">${T('Свой', 'Custom')}</button></div>
   <div class="grid2">${numF(T('Ширина', 'Width'), 'id="npW" min="10"', NP.sheet >= 0 ? Math.min(ps[NP.sheet][1], mm.w) : NP.w, MM(), 1)}${numF(T('Высота', 'Height'), 'id="npH" min="10"', NP.sheet >= 0 ? Math.min(ps[NP.sheet][2], mm.h) : NP.h, MM(), 1)}</div>
   <p class="note">${T('Лист рисуется прямо на столе в реальном размере. Всё, что вы рисуете или генерируете, кладётся внутрь листа. Текущий проект можно вернуть через Ctrl+Z.', 'The sheet is drawn on the bed at real size. Everything you draw or generate goes inside it. Ctrl+Z brings back the current project.')}</p>`,
    `<button class="btn" data-act="closeModal">${T('Отмена', 'Cancel')}</button><button class="primary" data-act="npCreate">${ic('newp', 15)} ${T('Создать', 'Create')}</button>`, 'wide');
}
function readNP() { const g = id => $('#' + id); if (g('npName')) NP.name = g('npName').value; if (g('npMat')) NP.mat = g('npMat').value; if (g('npThick')) NP.thick = +g('npThick').value || NP.thick; if (g('npW')) NP.w = +g('npW').value || NP.w; if (g('npH')) NP.h = +g('npH').value || NP.h }
function createProject() {
  readNP(); const mm = allMachineProfiles().find(x => x.id === NP.m) || MACHINES[0], w = clamp(NP.w, 10, mm.w), h = clamp(NP.h, 10, mm.h);
  pushUndo(T('Новый проект', 'New project'));
  S = blankState(mm, { mat: NP.mat, thick: NP.thick, w, h, x: Math.max(0, Math.min(10, (mm.w - w) / 2)), y: Math.max(0, Math.min(10, (mm.h - h) / 2)) });
  S.name = NP.name.trim(); projPath = null; migratedFrom = null; sel.clear(); curPlate = 0; camSel = null; P.file = null; closeModal(); changed(); fitPlate(0); draw();
  toast(T('Новый проект создан. Слои берут параметры из материала листа.', 'New project created. Layers take their values from the sheet material.'));
}

/* ---------------- machine settings ---------------- */
let draftM = null;
function openSettings() { draftM = deepCopy(S.machine); renderSettings() }
function renderSettings() {
  const m = draftM, L = m.type === 'laser', posts = postsFor(m.type);
  openModal(`${ic('cog', 18)} ${T('Станок и настройки', 'Machine & settings')}`, `<div class="fld"><span>${T('Профили', 'Profiles')}</span></div>${machineCards(m.id, 'preset', true)}
   <div class="grid2"><label class="fld"><span>${T('Название', 'Name')}</span><input class="plain" id="mName" value="${esc(m.name)}"></label>
   ${selF(T('Тип станка', 'Machine type'), 'id="mType"', [['laser', T('Лазерный гравер/резак', 'Laser engraver/cutter')], ['cnc', T('Фрезерный ЧПУ', 'CNC router')]], m.type)}
   ${numF(T('Рабочее поле X', 'Work area X'), 'id="mW" min="10"', m.w, MM(), 1)}${numF(T('Рабочее поле Y', 'Work area Y'), 'id="mH" min="10"', m.h, MM(), 1)}
   ${L ? selF(T('Источник', 'Source'), 'id="mSrc"', [['diode', T('диод', 'diode')], ['co2', 'CO2'], ['fiber', T('волоконный', 'fiber')]], m.laserSource || 'diode') + numF(T('Оптическая мощность', 'Optical power'), 'id="mWatts" min="0"', m.watts ?? '', T('Вт', 'W'), .5) : numF(T('Ход по Z', 'Z travel'), 'id="mZt" min="1"', m.zTravel || 40, MM(), 1) + numF(T('Макс. обороты', 'Max spindle'), 'id="mRpmMax" min="0"', m.rpmMax || m.rpm || 10000, T('об/мин', 'rpm'), 500)}
   ${numF(T('Максимум S ($30)', 'Max S ($30)'), 'id="mS" min="1"', m.smax, '', 1)}${numF(T('Скорость холостых', 'Rapid speed'), 'id="mR" min="10"', m.rapid, MMIN(), 100)}
   ${numF(T('Макс. рабочая подача', 'Max cutting feed'), 'id="mF" min="10"', m.maxFeed || m.rapid, MMIN(), 100)}${numF(T('Ускорение', 'Acceleration'), 'id="mA" min="1"', m.accel || 500, T('мм/с²', 'mm/s²'), 50)}
   ${L ? '' : numF(T('Безопасная высота Z', 'Safe Z height'), 'id="mZ" min="0.5"', m.safeZ, MM(), .5)}${selF(T('Прошивка', 'Firmware'), 'id="mFw"', [['grbl', 'GRBL 1.1'], ['fluidnc', 'FluidNC'], ['marlin', 'Marlin']], m.fw)}
   ${selF(T('Постпроцессор', 'Postprocessor'), 'id="mPost"', posts.map(p => [p.id, postLabel(p)]), m.type === S.machine.type ? S.post : (m.post || posts[0].id), '', 'post')}</div>
   ${L ? '' : `<div class="sec"><h3>${ic('laser', 15)} ${T('Лазер + фрезер на одном станке', 'Laser + router on one machine')}</h3>${chkF(T('Станок с двумя головками (лазерный модуль и шпиндель)', 'Machine with two heads (laser module and spindle)'), 'id="mCombo"', !!m.combo, '', 'combo')}
     <div class="grid3">${numF(T('Смещение лазера X', 'Laser offset X'), 'id="mLox"', (m.laserOff || [0, 0])[0], MM(), .1)}${numF(T('Смещение лазера Y', 'Laser offset Y'), 'id="mLoy"', (m.laserOff || [0, 0])[1], MM(), .1)}${numF(T('Мощность лазера', 'Laser power'), 'id="mLw" min="0"', m.watts ?? '', T('Вт', 'W'), .5)}</div>
     ${chkF(T('Переключать режим лазера GRBL ($32) при смене головки', 'Switch GRBL laser mode ($32) on head change'), 'id="mC32"', m.comboSwitch32 !== false)}
     <p class="note">${T('Каждому слою можно выбрать головку. В задании сначала идут операции одной головки, затем пауза M0 для смены, затем другой. Смещение — насколько луч лазера сдвинут от оси шпинделя. Режим не проверен на реальном оборудовании.', 'Each layer picks its head. The job runs one head’s operations, pauses with M0 for the change, then the other head. The offset is how far the beam is from the spindle axis. Not tested on real hardware.')}</p></div>`}
   ${L ? `<div class="row">${chkF(T('Ось Z / подъём фокуса', 'Z axis / focus lift'), 'id="mHasZ"', !!m.hasZ)}${chkF(T('Обдув по M8/M9', 'Air assist on M8/M9'), 'id="mAir"', m.air !== false)}${chkF(T('Динамическая мощность M4', 'Dynamic power M4'), 'id="mDyn"', m.dynamic !== false)}</div>` : ''}
   <div class="sec"><h3>${T('Работа со станком', 'Machine control')}</h3><div class="row wrap">${chkF(T('Подключаться автоматически', 'Connect automatically'), 'data-mcopt="auto"', MCOPT.auto)}${chkF(T('Показывать список «Перед запуском»', 'Show the “Before you start” checklist'), 'data-mcopt="checks"', MCOPT.checks)}${chkF(T('Спрашивать подтверждение для теста луча, шпинделя, рамки', 'Ask before test fire, spindle, framing'), 'data-mcopt="confirm"', MCOPT.confirm)}</div><p class="note">${T('Подключение никогда не запускает задание. Аварийная кнопка на станке остаётся главной.', 'Connecting never starts a job. The hardware E-stop stays the primary stop.')}</p></div>
   <div class="sec"><h3>${T('Скорость работы', 'Performance')}</h3>${chkF(T('Ускорение WebAssembly (модуль на Rust)', 'WebAssembly acceleration (Rust module)'), 'id="mWasm"', store.get('noWasm') !== '1')}<p class="note">${esc(typeof wasmStatus === 'function' ? wasmStatus() : '')}. ${T('Растрирование фото и нарезка 3D-моделей идут через быстрый модуль; без него — те же результаты на JavaScript, только медленнее.', 'Photo dithering and 3D slicing use the fast module; without it the same results come from JavaScript, only slower.')}</p></div>
   <label class="fld"><span>${T('Начало G-code (header)', 'G-code header')}</span><textarea class="plain" id="mHead" placeholder="; ${T('например', 'e.g.')} $H">${esc(S.job.header)}</textarea></label>
   <label class="fld"><span>${T('Конец G-code (footer)', 'G-code footer')}</span><textarea class="plain" id="mFoot">${esc(S.job.footer)}</textarea></label>
   <p class="note">${T('Готовые профили — общие заготовки, а не проверенные модели станков. Укажите реальные размеры поля и мощность. Команды начала и конца проверяются при экспорте.', 'Built-in profiles are generic starting points, not verified machine models. Enter the real work area and power. Header and footer commands are checked on export.')}</p>`,
    `<button class="btn" data-act="saveMachineProfile">${ic('save', 15)} ${T('Сохранить как мой профиль', 'Save as my profile')}</button><button class="btn" data-act="closeModal">${T('Отмена', 'Cancel')}</button><button class="primary" data-act="saveSettings">${T('Применить', 'Apply')}</button>`, 'wide');
}
function readSettings() {
  const m = draftM, g = id => $('#' + id), num = (id, d) => { const e = g(id); if (!e || e.value === '') return d; const v = +e.value; return isFinite(v) ? v : d };
  m.name = g('mName').value.trim() || m.name; m.type = g('mType').value; m.w = Math.max(10, num('mW', m.w)); m.h = Math.max(10, num('mH', m.h)); m.smax = Math.max(1, num('mS', m.smax)); m.rapid = Math.max(10, num('mR', m.rapid)); m.maxFeed = Math.max(10, num('mF', m.maxFeed || m.rapid)); m.accel = Math.max(1, num('mA', m.accel || 500)); m.fw = g('mFw').value; m.post = g('mPost').value;
  if (m.type === 'laser') { if (g('mSrc')) m.laserSource = g('mSrc').value; if (g('mWatts')) m.watts = g('mWatts').value === '' ? null : num('mWatts', null); if (g('mHasZ')) m.hasZ = g('mHasZ').checked; if (g('mAir')) m.air = g('mAir').checked; if (g('mDyn')) m.dynamic = g('mDyn').checked }
  else { m.zTravel = num('mZt', m.zTravel || 40); m.rpmMax = num('mRpmMax', m.rpmMax || 10000); m.rpm = Math.min(m.rpm || m.rpmMax, m.rpmMax); m.safeZ = Math.max(.5, num('mZ', m.safeZ || 5)); if (g('mCombo')) { m.combo = g('mCombo').checked; m.laserOff = [num('mLox', 0), num('mLoy', 0)]; m.comboSwitch32 = g('mC32').checked; m.watts = g('mLw').value === '' ? null : num('mLw', null) } }
  return m;
}
/* Apply a machine profile to the project. Shapes on sheets 2+ keep their place on
   their sheet even though the sheets are laid out by machine width. */
function applyMachine(m, fromDevice) {
  pushUndo(T('Смена станка', 'Change machine'));
  const oldW = S.machine.w, oldGap = plateGap(), oldX = i => i * (oldW + oldGap), plates = S.shapes.map(s => s.parked ? null : plateOf(s)), oldType = S.machine.type;
  S.machine = deepCopy(m);
  S.shapes.forEach((s, k) => { const i = plates[k]; if (i) { const dx = plateX(i) - oldX(i); if (dx) s.paths = mapPaths(s.paths, (x, y) => [x + dx, y]) } });
  const typeChanged = oldType !== m.type, changedMats = [];
  if (typeChanged) {
    const ml = matsForMachine(m.type);
    for (const sh of S.sheets) { const cur = matById(sh.mat); if (!cur || !(m.type === 'laser' ? cur.laser : cur.cnc)) { changedMats.push(sheetName(sh, S.sheets.indexOf(sh))); sh.mat = ml[0].id; sh.thick = ml[0].thick } }
  }
  if (m.post && postById(m.post) && postById(m.post).kind === m.type) S.post = m.post; else if (typeChanged) S.post = m.type === 'laser' ? 'grbl_laser' : 'grbl_cnc';
  for (const sh of S.sheets) { sh.w = Math.min(sh.w, m.w); sh.h = Math.min(sh.h, m.h); sh.x = clamp(sh.x, 0, m.w - sh.w); sh.y = clamp(sh.y, 0, m.h - sh.h) }
  GC.clear(); P.file = null; changed(); fitPlate(curPlate); draw();
  if (changedMats.length) toast(T(`Тип станка изменён. Материал заменён на подходящий на листах: ${changedMats.join(', ')} — проверьте их.`, `Machine type changed. The material was replaced on sheets: ${changedMats.join(', ')} — please check them.`), 'warn');
  else if (!fromDevice) toast(T('Профиль станка применён.', 'Machine profile applied.'));
}
function saveMachineProfile() {
  const m = readSettings(), list = userMachines(), copy = deepCopy(m);
  if (MACHINES.some(x => x.id === copy.id)) copy.id = uid('mach');
  const i = list.findIndex(x => x.id === copy.id); if (i >= 0) list[i] = copy; else list.push(copy);
  store.set('machines', JSON.stringify(list.slice(-30))); draftM = copy; renderSettings(); toast(T('Профиль сохранён в библиотеку станков.', 'Profile saved to your machine library.'));
}

/* ---------------- material library (spec 11) ---------------- */
let ML = null;
function openMaterials(selectId) {
  ML = { q: '', sel: selectId || sheetAt(curPlate).mat, edit: null };
  openModal(`${ic('layers', 18)} ${T('Библиотека материалов', 'Material library')}`, `<div class="lib"><div class="lib-list"><div class="inp"><span class="pre">${ic('search', 14)}</span><input id="mlQ" placeholder="${T('Поиск', 'Search')}"></div><div id="mlList" class="list"></div>
    <div class="grid2"><button class="btn" data-act="mlNew">${ic('plus', 14)} ${T('Новый', 'New')}</button><button class="btn" data-act="mlImport">${ic('open', 14)} ${T('Импорт…', 'Import…')}</button><button class="btn" data-act="mlExport">${ic('export', 14)} ${T('Экспорт моих', 'Export mine')}</button></div></div><div class="lib-edit" id="mlEdit"></div></div>`,
    `<p class="note">${T('Встроенные профили — стартовые значения, не проверенные на вашем станке. Изменённый профиль сохраняется как ваш, встроенный остаётся без изменений.', 'Built-in profiles are starting values, not verified on your machine. An edited profile is saved as yours; the built-in one stays unchanged.')}</p><button class="btn" data-act="closeModal">${T('Закрыть', 'Close')}</button>`, 'xl lib-dlg');
  onModalClose = () => { ML = null };
  $('#mlQ').oninput = e => { ML.q = e.target.value; renderMatList() };
  renderMatList(); renderMatEdit();
}
function renderMatList() {
  if (!ML) return; const q = ML.q.trim().toLowerCase(), type = S.machine.type;
  const list = allMats().filter(m => !q || (L10(m.name) + ' ' + m.id + ' ' + matCatName(m.cat)).toLowerCase().includes(q));
  const rel = list.filter(m => type === 'laser' ? m.laser : m.cnc), other = list.filter(m => !(type === 'laser' ? m.laser : m.cnc));
  const row = m => `<div class="li${m.id === ML.sel ? ' on' : ''}" data-act="mlPick" data-v="${esc(m.id)}"><span class="sw" style="background:${m.color || '#999'}"></span><span class="nm">${esc(L10(m.name))}<br><span class="meta">${fx(m.thick, 2)} ${MM()} · ${esc(matCatName(m.cat))}</span></span>${statusPill(m)}</div>`;
  $('#mlList').innerHTML = rel.map(row).join('') + (other.length ? `<p class="note sub">${type === 'laser' ? T('Только для фрезера', 'Router only') : T('Только для лазера', 'Laser only')}</p>` + other.map(row).join('') : '');
}
const PROC_KEYS = () => [['cut', T('Резка', 'Cut')], ['vector', T('Векторная гравировка', 'Vector engrave')], ['fill', T('Заливка', 'Fill')], ['raster', T('Растр', 'Raster')], ['mark', T('Разметка', 'Mark')]];
function renderMatEdit() {
  if (!ML) return; const m = matById(ML.sel), el = $('#mlEdit'); if (!m) { el.innerHTML = `<p class="note">${T('Выберите материал слева.', 'Pick a material on the left.')}</p>`; return }
  const d = ML.edit && ML.edit.id === m.id ? ML.edit : (ML.edit = deepCopy(m)), mid = S.machine.id, own = d.byMachine && d.byMachine[mid];
  const lp = own || d.laser, hazard = LASER_HAZARD.test(L10(d.name));
  const procRow = ([k, n]) => { const p = lp && lp[k]; return `<tr><td>${n}</td>${p ? `<td><div class="inp"><input type="number" data-mp="${k}.power" value="${p.power}" min="0" max="100"><em>%</em></div></td><td><div class="inp"><input type="number" data-mp="${k}.speed" value="${p.speed}" min="1"><em>${MMIN()}</em></div></td><td><div class="inp"><input type="number" data-mp="${k}.passes" value="${p.passes ?? 1}" min="1" max="50"></div></td><td>${k === 'fill' || k === 'raster' ? `<div class="inp"><input type="number" data-mp="${k}.interval" value="${p.interval ?? .1}" step="0.01" min="0.02"><em>${MM()}</em></div>` : ''}</td><td><button class="mini" data-act="mlProcOff" data-v="${k}" title="${T('Материал не поддерживает операцию', 'Material does not support this')}">${ic('trash', 13)}</button></td>` : `<td colspan="4" class="note">${T('не поддерживается', 'not supported')}</td><td><button class="mini" data-act="mlProcOn" data-v="${k}" title="${T('Добавить', 'Add')}" ${hazard ? 'disabled' : ''}>${ic('plus', 13)}</button></td>`}</tr>` };
  el.innerHTML = `<div class="sec"><h3>${esc(L10(d.name))}<span class="sp"></span>${statusPill(m)}${m.builtin ? `<span class="pill mut">${T('встроенный', 'built-in')}</span>` : ''}</h3>
   <div class="grid2"><label class="fld"><span>${T('Название', 'Name')}</span><input class="plain" data-mf="name" value="${esc(L10(d.name))}"></label>${selF(T('Категория', 'Category'), 'data-mf="cat"', Object.keys(MAT_CATS).map(c => [c, matCatName(c)]), d.cat)}
   ${numF(T('Толщина', 'Thickness'), 'data-mf="thick" min="0.1"', d.thick, MM(), .1)}${numF(T('Посадка соединений', 'Joint fit clearance'), 'data-mf="fit" min="-0.5" max="1"', d.fit ?? 0, MM(), .01, '', 'fit')}
   ${selF(T('Волокна', 'Grain'), 'data-mf="grain"', [['none', T('нет', 'none')], ['x', T('вдоль X', 'along X')], ['y', T('вдоль Y', 'along Y')]], d.grain || 'none')}<label class="fld"><span>${T('Цвет на экране', 'Screen colour')}</span><input type="color" class="plain" data-mf="color" value="${esc(d.color || '#c8a874')}"></label></div>
   <label class="fld"><span>${T('Заметки и безопасность', 'Notes & safety')}</span><textarea class="plain" rows="2" data-mf="notes">${esc(L10(d.notes) || '')}</textarea></label>
   ${hazard ? `<div class="warnline">${ic('warn', 13)} ${T('Название указывает на материал, опасный для лазера. Лазерные профили для него не создаются.', 'The name suggests a material that is dangerous to laser. No laser profiles are created for it.')}</div>` : ''}</div>
   ${d.laser || S.machine.type === 'laser' ? `<div class="sec"><h3>${T('Лазер', 'Laser')}<span class="sp"></span><span class="pill mut">${own ? T('для станка «', 'for “') + esc(S.machine.name) + T('»', '”') : T('общие (', 'generic (') + esc(d.laser ? d.laser.ref || '—' : '—') + ')'}</span></h3>
   ${d.laser ? `<table class="tbl mat"><thead><tr><th>${T('Процесс', 'Process')}</th><th>${T('Мощность', 'Power')}</th><th>${T('Скорость', 'Speed')}</th><th>${T('Проходы', 'Passes')}</th><th>${T('Шаг', 'Interval')}</th><th></th></tr></thead><tbody>${PROC_KEYS().map(procRow).join('')}</tbody></table>
   <div class="grid2">${numF(T('Ширина реза (керф)', 'Kerf'), 'data-mp="kerf"', (own && own.kerf != null ? own.kerf : d.laser.kerf) || 0, MM(), .01, '', 'kerf')}${numF(T('Мин. мощность растра', 'Raster min power'), 'data-mp="raster.minPower"', lp.raster ? lp.raster.minPower ?? 0 : 0, '%', 1)}</div>
   ${own ? `<button class="btn" data-act="mlOwnOff">${T('Удалить параметры для этого станка', 'Remove values for this machine')}</button>` : `<button class="btn" data-act="mlOwnOn">${ic('plus', 14)} ${T('Отдельные параметры для станка «', 'Separate values for “') + esc(S.machine.name) + T('»', '”')}</button>`}` : hazard ? '' : `<button class="btn" data-act="mlLaserOn">${ic('plus', 14)} ${T('Добавить лазерный профиль', 'Add a laser profile')}</button>`}</div>` : ''}
   ${d.cnc || S.machine.type === 'cnc' ? `<div class="sec"><h3>${T('Фрезер', 'Router')}</h3>${d.cnc ? `<div class="grid3">${numF(T('Съём на зуб', 'Chip load'), 'data-mc="chip" min="0.001"', d.cnc.chip, MM(), .005)}${numF(T('Глубина за проход', 'Depth per pass'), 'data-mc="doc" min="0.05" max="2"', d.cnc.doc, '×D', .05)}${numF(T('Обороты', 'Spindle'), 'data-mc="rpm" min="0"', d.cnc.rpm, T('об/мин', 'rpm'), 500)}</div><p class="note">${T('Подача = обороты × число зубьев × съём на зуб. Глубина за проход — доля диаметра фрезы.', 'Feed = rpm × flutes × chip load. Depth per pass is a fraction of the tool diameter.')}</p>` : `<button class="btn" data-act="mlCncOn">${ic('plus', 14)} ${T('Добавить профиль фрезера', 'Add a router profile')}</button>`}</div>` : ''}
   <div class="sec"><h3>${T('Статус профиля', 'Profile status')}</h3>${selF('', 'data-mf="status"', MAT_STATUS.map(s => [s, matStatusName(s)]), d.status === 'unverified' && !m.builtin ? 'user' : d.status)}
   ${d.status === 'verified' ? `<div class="grid3">${['machine', 'date', 'note'].map(k => `<label class="fld"><span>${({ machine: T('Станок теста', 'Test machine'), date: T('Дата', 'Date'), note: T('Условия', 'Conditions') })[k]}</span><input class="plain" data-mt="${k}" value="${esc((d.test && d.test[k]) || (k === 'machine' ? S.machine.name : k === 'date' ? new Date().toISOString().slice(0, 10) : ''))}"></label>`).join('')}</div><p class="note">${T('«Проверено» ставится только после реального теста; укажите станок, дату и условия.', '“Verified” is only for profiles tested for real; enter the machine, date and conditions.')}</p>` : ''}
   <div class="row"><button class="primary" data-act="mlSave">${ic('save', 15)} ${T('Сохранить', 'Save')}</button><button class="btn" data-act="mlUse">${ic('sheet', 14)} ${T('Назначить текущему листу', 'Use on current sheet')}</button><button class="btn" data-act="mlDup">${ic('copy', 14)} ${T('Копия', 'Duplicate')}</button>${!m.builtin ? `<button class="btn bad" data-act="mlDel">${ic('trash', 14)} ${BUILTIN_MATS.some(b => b.id === m.id) ? T('Вернуть встроенный', 'Reset to built-in') : T('Удалить', 'Delete')}</button>` : ''}</div>
   <div class="sec-sub"><b>${T('Калибровка', 'Calibration')}</b><p class="note">${T('Вырежьте тест, измерьте результат штангенциркулем и введите значения выше: «Тест керфа» — ширина реза, «Тест соединения» — посадка, «Тест мощности» — мощность и скорость.', 'Cut a test, measure it with calipers and enter the values above: “Kerf test” for the cut width, “Joint fit test” for the fit, “Power test” for power and speed.')}</p><div class="grid3"><button class="btn" data-act="wiz" data-v="kerf">${ic('kerf', 14)} ${T('Тест керфа', 'Kerf test')}</button><button class="btn" data-act="wiz" data-v="joint">${ic('joint', 14)} ${T('Тест соединения', 'Joint test')}</button><button class="btn has-badge" data-act="wiz" data-v="test">${ic('test', 14)} ${T('Тест мощности', 'Power test')}${machBadge('laser')}</button></div></div>`;
}
function matEditInput(t) {
  const d = ML && ML.edit; if (!d) return;
  if (t.dataset.mf) { const k = t.dataset.mf; let v = t.type === 'number' ? parseFloat(t.value) : t.value; if (t.type === 'number' && !isFinite(v)) return; if (k === 'name' || k === 'notes') d[k] = { ru: v, en: v }; else d[k] = v; if (k === 'status' || k === 'name') renderMatEdit(); return }
  if (t.dataset.mt) { d.test = d.test || {}; d.test[t.dataset.mt] = t.value; return }
  if (t.dataset.mc) { const v = parseFloat(t.value); if (isFinite(v)) d.cnc[t.dataset.mc] = v; return }
  if (t.dataset.mp) {
    const v = parseFloat(t.value); if (!isFinite(v)) return; const own = d.byMachine && d.byMachine[S.machine.id], tgt = own || d.laser; if (!tgt) return;
    const [a, b] = t.dataset.mp.split('.'); if (!b) { tgt[a] = v; return } if (!tgt[a]) return; tgt[a][b] = v;
  }
}
function matEditAction(act, v) {
  const d = ML && ML.edit; if (!d && !['mlNew', 'mlImport', 'mlExport', 'mlPick'].includes(act)) return;
  switch (act) {
    case 'mlPick': ML.sel = v; ML.edit = null; renderMatList(); renderMatEdit(); break;
    case 'mlNew': { const base = S.machine.type === 'laser' ? matById('plywood-3') : matById('c-plywood-6'), n = Object.assign(deepCopy(base), { id: uid('mat'), name: { ru: T('Новый материал', 'New material'), en: T('Новый материал', 'New material') }, builtin: false, status: 'user', byMachine: {}, test: null, notes: null }); userMats.push(n); saveUserMats(); ML.sel = n.id; ML.edit = null; renderMatList(); renderMatEdit(); break }
    case 'mlDup': { const n = Object.assign(deepCopy(d), { id: uid('mat'), builtin: false, status: 'user', test: null }); n.name = { ru: L10(d.name) + T(' (копия)', ' (copy)'), en: L10(d.name) + ' (copy)' }; userMats.push(n); saveUserMats(); ML.sel = n.id; ML.edit = null; renderMatList(); renderMatEdit(); break }
    case 'mlProcOff': { const tgt = (d.byMachine && d.byMachine[S.machine.id]) || d.laser; if (tgt) tgt[v] = null; renderMatEdit(); break }
    case 'mlProcOn': { const tgt = (d.byMachine && d.byMachine[S.machine.id]) || d.laser; if (tgt) tgt[v] = { power: 20, speed: 1500, passes: 1, interval: v === 'fill' || v === 'raster' ? .1 : undefined }; renderMatEdit(); break }
    case 'mlOwnOn': { d.byMachine = d.byMachine || {}; const src = d.laser; d.byMachine[S.machine.id] = deepCopy({ cut: src.cut, vector: src.vector, fill: src.fill, raster: src.raster, mark: src.mark, kerf: src.kerf }); renderMatEdit(); break }
    case 'mlOwnOff': if (d.byMachine) delete d.byMachine[S.machine.id]; renderMatEdit(); break;
    case 'mlLaserOn': d.laser = { ref: S.machine.id, cut: { power: 100, speed: 300, passes: 2 }, vector: { power: 30, speed: 1500 }, fill: { power: 35, speed: 3000, interval: .1 }, raster: { power: 45, minPower: 8, speed: 3000, interval: .1 }, mark: { power: 25, speed: 1500 }, kerf: .15 }; renderMatEdit(); break;
    case 'mlCncOn': d.cnc = { chip: .04, doc: .5, rpm: 12000 }; renderMatEdit(); break;
    case 'mlSave': {
      if (d.status === 'verified' && !(d.test && d.test.machine && d.test.date && String(d.test.note || '').trim())) { $$('[data-mt]').forEach(el => { d.test = d.test || {}; d.test[el.dataset.mt] = el.value }); if (!(d.test.machine && d.test.date && String(d.test.note || '').trim())) { toast(T('Для статуса «проверено» укажите станок, дату и условия теста.', 'For “verified”, enter the test machine, date and conditions.'), 'err'); return } }
      if (d.laser && LASER_HAZARD.test(L10(d.name))) { delete d.laser; toast(T('Лазерный профиль удалён: материал опасен для лазера.', 'The laser profile was removed: the material is dangerous to laser.'), 'warn') }
      const copy = Object.assign(deepCopy(d), { builtin: false, status: d.status === 'unverified' ? 'user' : d.status, edited: new Date().toISOString() });
      const i = userMats.findIndex(u => u.id === copy.id); if (i >= 0) userMats[i] = copy; else userMats.push(copy); saveUserMats();
      if (S.mats[copy.id]) S.mats[copy.id] = deepCopy(copy);
      ML.edit = null; GC.clear(); changed(); renderMatList(); renderMatEdit(); toast(T('Материал сохранён в вашу библиотеку.', 'Material saved to your library.')); break;
    }
    case 'mlUse': { const sh = sheetAt(curPlate), m = matById(ML.sel); if (!m) break; if (!(S.machine.type === 'laser' ? m.laser : m.cnc)) { toast(T('У материала нет профиля для этого типа станка.', 'The material has no profile for this machine type.'), 'err'); break } pushUndo(T('Материал листа', 'Sheet material')); sh.mat = m.id; sh.thick = m.thick; changed(); renderMatList(); toast(T('Материал назначен листу.', 'Material assigned to the sheet.')); break }
    case 'mlDel': { const used = S.sheets.some(sh => sh.mat === d.id); const i = userMats.findIndex(u => u.id === d.id); if (i < 0) break; if (used) { userMats[i].archived = true; S.mats[d.id] = deepCopy(userMats[i]) } else userMats.splice(i, 1); saveUserMats(); const builtin = BUILTIN_MATS.some(b => b.id === d.id); if (!builtin) ML.sel = S.machine.type === 'laser' ? 'plywood-3' : 'c-plywood-6'; ML.edit = null; GC.clear(); changed(); renderMatList(); renderMatEdit(); if (builtin && !used) { toast(T('Восстановлен встроенный профиль.', 'The built-in profile was restored.')); break } toast(used ? T('Материал убран из библиотеки; копия осталась в проекте, где он используется.', 'Material removed from the library; a copy stays in the project that uses it.') : T('Материал удалён.', 'Material deleted.')); break }
    case 'mlExport': { const mine = userMats.filter(m => !m.archived); if (!mine.length) { toast(T('В вашей библиотеке пока нет материалов.', 'Your library has no materials yet.')); break } const txt = exportMaterials(mine); if (DESK && DESK.saveFile) DESK.saveFile({ name: 'skykerf-materials.json', data: txt, filters: [{ name: 'JSON', extensions: ['json'] }] }).then(r => { if (r && r.ok) toast(T('Сохранено: ', 'Saved: ') + r.path) }); else offerFiles([{ name: 'skykerf-materials.json', data: txt, mime: 'application/json' }], T('Библиотека материалов', 'Material library')); break }
    case 'mlImport': $('#fileMat').click(); break;
  }
}
/* "Save values to the material" from a CAM layer: writes per-machine values into a user copy. */
async function layerToMaterial(L) {
  const sh = sheetAt(curPlate), m = matById(sh.mat); if (!m || !m.laser) { toast(T('У материала листа нет лазерного профиля.', 'The sheet material has no laser profile.'), 'err'); return }
  const ok = await confirmBox(T('Сохранить в материал', 'Save to the material'), T(`Значения слоя (${ltypeName(L.type)}: ${L.laser.power}%, ${L.laser.speed} мм/мин, проходов ${L.laser.passes}) будут записаны в материал «${L10(m.name)}» для станка «${S.machine.name}». Статус профиля станет «пользовательский».`, `The layer values (${ltypeName(L.type)}: ${L.laser.power}%, ${L.laser.speed} mm/min, ${L.laser.passes} passes) will be written to “${L10(m.name)}” for the machine “${S.machine.name}”. The profile status becomes “user”.`), [{ label: T('Сохранить', 'Save'), value: true, primary: true }, { label: T('Отмена', 'Cancel'), value: false }]);
  if (!ok) return;
  const copy = Object.assign(deepCopy(m), { builtin: false, status: m.status === 'verified' ? 'user' : 'user' }); copy.byMachine = copy.byMachine || {};
  const own = copy.byMachine[S.machine.id] || (copy.byMachine[S.machine.id] = deepCopy({ cut: m.laser.cut, vector: m.laser.vector, fill: m.laser.fill, raster: m.laser.raster, mark: m.laser.mark, kerf: m.laser.kerf }));
  const l = L.laser; own[L.type] = { power: l.power, speed: l.speed, passes: l.passes, interval: l.interval, minPower: l.minPower }; if (L.type === 'cut') own.kerf = l.kerf;
  const i = userMats.findIndex(u => u.id === copy.id); if (i >= 0) userMats[i] = copy; else userMats.push(copy); saveUserMats(); if (S.mats[copy.id]) S.mats[copy.id] = deepCopy(copy);
  pushUndo(T('Параметры из материала', 'Values from material')); L.auto = true; changed(); toast(T('Сохранено в материал. Слой снова берёт значения из материала.', 'Saved to the material. The layer now uses material values again.'));
}

/* ---------------- tool library ---------------- */
function openTools() {
  const rows = allTools().map(t => `<tr><td>${esc(toolName(t))}</td><td>${({ flat: T('концевая', 'flat'), ball: T('сферическая', 'ball'), v: 'V', drill: T('сверло', 'drill') })[t.type] || t.type}${t.angle ? ' ' + t.angle + '°' : ''}</td><td>${fx(t.d, 3)}</td><td>${t.fl || '—'}</td><td>${t.maxDepth || '—'}</td><td>${t.builtin ? `<span class="pill mut">${T('встр.', 'built-in')}</span>` : `<button class="mini" data-act="toolDel" data-v="${esc(t.id)}">${ic('trash', 13)}</button>`}</td></tr>`).join('');
  openModal(`${ic('cnc', 18)} ${T('Библиотека фрез', 'Tool library')}`, `<table class="tbl"><thead><tr><th>${T('Название', 'Name')}</th><th>${T('Тип', 'Type')}</th><th>⌀, ${MM()}</th><th>${T('Зубья', 'Flutes')}</th><th>${T('Раб. длина', 'Cut length')}</th><th></th></tr></thead><tbody>${rows}</tbody></table>
   <div class="sec-sub"><b>${T('Новая фреза', 'New tool')}</b><div class="grid3"><label class="fld"><span>${T('Название', 'Name')}</span><input class="plain" id="tlName" placeholder="${T('Концевая 4 мм', '4 mm flat')}"></label>${selF(T('Тип', 'Type'), 'id="tlType"', [['flat', T('концевая', 'flat')], ['ball', T('сферическая', 'ball')], ['v', 'V'], ['drill', T('сверло', 'drill')]], 'flat')}${numF(T('Диаметр', 'Diameter'), 'id="tlD" min="0.1"', 4, MM(), .1)}${numF(T('Зубьев', 'Flutes'), 'id="tlFl" min="1" max="8"', 2, '', 1)}${numF(T('Рабочая длина', 'Cutting length'), 'id="tlLen" min="0.5"', 12, MM(), .5)}${numF(T('Угол (V)', 'Angle (V)'), 'id="tlAng" min="10" max="170"', 90, '°', 5)}</div></div>`,
    `<button class="btn" data-act="closeModal">${T('Закрыть', 'Close')}</button><button class="primary" data-act="toolAdd">${ic('plus', 15)} ${T('Добавить', 'Add')}</button>`, 'wide');
}
function toolAdd() {
  const g = id => $('#' + id), type = g('tlType').value, d = Math.max(.1, +g('tlD').value || 3), name = g('tlName').value.trim() || `${type} ⌀${d}`;
  userTools.push({ id: uid('tool'), type, d, fl: clamp(+g('tlFl').value | 0, 1, 8), len: +g('tlLen').value || 12, maxDepth: +g('tlLen').value || 12, angle: type === 'v' ? +g('tlAng').value || 90 : undefined, name: { ru: name, en: name } });
  saveUserTools(); GC.clear(); openTools(); toast(T('Фреза добавлена.', 'Tool added.'));
}

/* ---------------- macros, layouts, misc ---------------- */
function openMacros() {
  openModal(T('Макросы', 'Macros'), `<textarea class="plain" id="mcEdit" style="min-height:220px">${esc((S.macros || []).map(m => `${m.n} | ${m.g}`).join('\n'))}</textarea><p class="note">${T('Одна строка — один макрос: «Название | G-code». Несколько команд разделяйте «;» без пробела: G0 X0;G0 Y0. Макросы отправляются на станок только по нажатию.', 'One line per macro: “Name | G-code”. Separate several commands with “;” (no space): G0 X0;G0 Y0. Macros are sent only when you press them.')}</p>`,
    `<button class="btn" data-act="closeModal">${T('Отмена', 'Cancel')}</button><button class="primary" data-act="saveMacros">${T('Сохранить', 'Save')}</button>`);
}
async function askName(title, def) {
  return new Promise(res => {
    openModal(title, `<label class="fld"><span>${T('Название', 'Name')}</span><input class="plain" id="askIn" value="${esc(def || '')}" autofocus></label>`, `<button class="btn" data-act="closeModal">${T('Отмена', 'Cancel')}</button><button class="primary" id="askOk">${T('ОК', 'OK')}</button>`);
    onModalClose = () => res(null);
    const ok = () => { const v = $('#askIn').value.trim(); onModalClose = null; closeModal(); res(v || def || '') };
    $('#askOk').onclick = ok; $('#askIn').onkeydown = e => { if (e.key === 'Enter') ok() };
  });
}
async function bandsDialog() {
  const s = selShapes()[0]; if (!s || s.kind !== 'image') return;
  const n = await confirmBox(T('Слои по яркости', 'Brightness layers'), T('Фото будет разделено на несколько слоёв по яркости — каждый со своими мощностью и скоростью в CAM. Сколько слоёв?', 'The photo is split into brightness bands — each with its own power and speed in CAM. How many layers?'), [2, 3, 4, 5].map(k => ({ label: String(k), value: k, primary: k === 3 })).concat([{ label: T('Отмена', 'Cancel'), value: null }]));
  if (n) splitImageBands(s, n);
}

/* ---------------- font list: a drop-down under the font button, like in office programs ----------------
   Every font is shown in its own typeface; typing filters the list; click or Enter applies at once.
   It never covers the dialog it was opened from. */
let FP = null;
const FP_RECENT = () => { try { return JSON.parse(store.get('fontRecent') || '[]') } catch (e) { return [] } };
async function openFontPicker(current, onPick, anchor) {
  closeFontDrop();
  FP = { cur: current, onPick, q: '', filter: 'all', list: [], sel: current, anchor, loading: new Set() };
  const el = document.createElement('div'); el.className = 'fontdrop'; el.id = 'fontDrop'; el.setAttribute('role', 'listbox');
  el.innerHTML = `<div class="fd-top"><div class="inp grow"><span class="pre">${ic('search', 14)}</span><input id="fpQ" placeholder="${T('Найти шрифт', 'Find a font')}" autocomplete="off"></div></div>
    <div class="seg full fd-filter" id="fpFilter">${[['all', T('Все', 'All')], ['bundled', T('Встроенные', 'Bundled')], ['pc', T('Компьютер', 'Computer')], ['user', T('Мои', 'Mine')]].map(([k, n]) => `<button data-act="fpFilter" data-v="${k}" aria-pressed="${k === 'all'}">${n}</button>`).join('')}</div>
    <div class="vlist fp-list" id="fpList"><div class="vinner" id="fpInner"></div></div>
    <div class="fd-foot"><span class="note" id="fpNote">${T('Читаю шрифты компьютера…', 'Reading the computer’s fonts…')}</span><span class="sp"></span><button class="mini" data-act="fpFile" title="${T('Загрузить шрифт из файла', 'Load a font file')}">${ic('open', 14)}</button>${DESK && DESK.addFontFolder ? `<button class="mini" data-act="fpFolder" title="${T('Добавить папку со шрифтами', 'Add a font folder')}">${ic('folder', 14)}</button>` : ''}</div>`;
  document.body.appendChild(el); placeFontDrop();
  const q = $('#fpQ'); q.oninput = e => { FP.q = e.target.value; FP.sel = null; fpBuild() };
  q.onkeydown = e => {
    if (!FP) return; const L = FP.list, i = Math.max(0, L.findIndex(x => x.id === FP.sel));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = clamp(i + (e.key === 'ArrowDown' ? 1 : -1), 0, L.length - 1); if (L[n]) { FP.sel = L[n].id; fpScrollTo(n); fpRows() } }
    else if (e.key === 'Enter') { e.preventDefault(); const x = L.find(x => x.id === FP.sel) || L[0]; if (x) fpApply(x.id) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFontDrop() }
  };
  $('#fpList').onscroll = fpRows;
  setTimeout(() => q.focus(), 0);
  fpBuild();
  let err = null; try { await loadSystemFonts() } catch (e) { err = e }
  if (!FP) return;
  const n = systemFonts ? systemFonts.length : 0;
  $('#fpNote').textContent = err ? err.message : T(`Шрифтов: ${n + Object.keys(BUNDLED_FONTS).length}`, `${n + Object.keys(BUNDLED_FONTS).length} fonts`);
  fpBuild(); const i = FP.list.findIndex(x => x.id === current); if (i >= 0) fpScrollTo(i, true);
}
function placeFontDrop() {
  const el = $('#fontDrop'); if (!el || !FP) return; const W = 320, H = Math.min(420, innerHeight - 40);
  let x = 20, y = 60; const a = FP.anchor && FP.anchor.isConnected ? FP.anchor.getBoundingClientRect() : null;
  if (a) { x = clamp(a.left, 8, innerWidth - W - 8); y = a.bottom + 4; if (y + H > innerHeight - 8) y = Math.max(8, a.top - H - 4) }
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = W + 'px'; el.style.height = H + 'px';
}
function closeFontDrop() { const el = $('#fontDrop'); if (el) el.remove(); FP = null }
document.addEventListener('pointerdown', e => { if (FP && !e.target.closest('#fontDrop') && !e.target.closest('.fontbtn')) closeFontDrop() }, true);
window.addEventListener('resize', () => { if (FP) placeFontDrop() });
function fpBuild() {
  if (!FP) return; const q = FP.q.trim().toLowerCase(), list = [], seen = new Set();
  const push = x => { if (!seen.has(x.id)) { seen.add(x.id); list.push(x) } };
  if (!q && FP.filter === 'all') for (const id of FP_RECENT()) { const b = BUNDLED_FONTS[id], e = (systemFonts || []).find(f => f.family === id); if (b || e) push({ id, name: b ? b.n : id, tag: T('недавний', 'recent'), recent: true }) }
  if (FP.filter === 'all' || FP.filter === 'bundled') for (const [k, v] of Object.entries(BUNDLED_FONTS)) push({ id: k, name: v.n, tag: T('встроенный', 'bundled') });
  if (FP.filter !== 'bundled') for (const e of systemFonts || []) { if (FP.filter === 'user' && e.src !== 'user') continue; if (FP.filter === 'pc' && e.src === 'user') continue; push({ id: e.family, name: e.family, tag: e.src === 'user' ? T('мой', 'mine') : `${e.faces.length}` }) }
  FP.list = q ? list.filter(x => x.name.toLowerCase().includes(q)) : list;
  if (!FP.sel && FP.list.length) FP.sel = FP.list[0].id;
  fpRows();
}
function fpScrollTo(i, center) { const box = $('#fpList'); if (!box) return; const rh = 30, top = i * rh; if (center) box.scrollTop = Math.max(0, top - box.clientHeight / 2); else if (top < box.scrollTop) box.scrollTop = top; else if (top + rh > box.scrollTop + box.clientHeight) box.scrollTop = top + rh - box.clientHeight }
function fpRows() {
  const box = $('#fpList'), inn = $('#fpInner'); if (!box || !FP) return; const rh = 30, n = FP.list.length; inn.style.height = Math.max(1, n) * rh + 'px';
  if (!n) { inn.innerHTML = `<p class="note" style="padding:8px">${T('Ничего не найдено.', 'Nothing found.')}</p>`; return }
  const i0 = Math.max(0, Math.floor(box.scrollTop / rh) - 3), i1 = Math.min(n, Math.ceil((box.scrollTop + (box.clientHeight || 300)) / rh) + 3); let h = '';
  const want = [];
  for (let i = i0; i < i1; i++) {
    const x = FP.list[i], fam = fontFamily(x.id), ready = BUNDLED_FAMILIES.has(fam) || FONT_LOADED.has(fam); if (!ready) want.push(x.id);
    h += `<div class="li${x.id === FP.sel ? ' on' : ''}${x.id === FP.cur ? ' cur' : ''}${x.recent ? ' rec' : ''}" role="option" style="position:absolute;left:0;right:0;top:${i * rh}px;height:${rh}px" data-act="fpPick" data-v="${esc(x.id)}"><span class="nm" style="font-family:'${esc(fam).replace(/'/g, '')}',var(--f-ui)">${esc(x.name)}</span><span class="meta">${esc(x.tag)}</span></div>`;
  }
  inn.innerHTML = h;
  // load the visible fonts so their names show in their own typeface
  clearTimeout(FP.lt); FP.lt = setTimeout(async () => { if (!FP) return; let changed = false; for (const id of want.slice(0, 16)) { if (!FP || FP.loading.has(id)) continue; FP.loading.add(id); try { if (await ensureFont(id)) changed = true } catch (e) { } } if (changed && FP) { const keep = $('#fpList').scrollTop; fpRowsLite(); $('#fpList').scrollTop = keep } }, 120);
}
function fpRowsLite() { if (!FP) return; for (const el of document.querySelectorAll('#fpInner .li')) { const fam = fontFamily(el.dataset.v), nm = el.querySelector('.nm'); if (nm) nm.style.fontFamily = `'${fam.replace(/'/g, '')}',var(--f-ui)` } }
function fpApply(f) {
  if (!FP) return; const cb = FP.onPick; const rec = FP_RECENT().filter(x => x !== f); rec.unshift(f); store.set('fontRecent', JSON.stringify(rec.slice(0, 6)));
  closeFontDrop(); ensureFont(f).then(() => cb(f));
}
function fontPickerAction(act, v) {
  if (!FP) return;
  if (act === 'fpFilter') { FP.filter = v; $$('#fpFilter button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v)); FP.sel = null; fpBuild(); $('#fpQ').focus() }
  else if (act === 'fpPick' || act === 'fpOk') fpApply(v || FP.sel);
  else if (act === 'fpFile') $('#fileFont').click();
  else if (act === 'fpFolder') DESK.addFontFolder().then(async r => { if (!r || !r.ok || !FP) return; systemFonts = null; $('#fpNote').textContent = T('Читаю шрифты…', 'Reading fonts…'); await loadSystemFonts(true); fpBuild(); $('#fpNote').textContent = T(`Папка добавлена. Шрифтов: ${systemFonts.length}.`, `Folder added. ${systemFonts.length} fonts.`) });
}
