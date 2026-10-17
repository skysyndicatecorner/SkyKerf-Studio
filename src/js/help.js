'use strict';
/* ============================================================================
   SkyKerf_Studio · help, tooltips, command search, main menu, hotkeys (3.1, 13.3)
   Hotkeys use KeyboardEvent.code (physical keys), so they work on any layout:
   Ctrl+Z is the same key on QWERTY and ЙЦУКЕН. Text fields keep their own
   Ctrl+Z / Ctrl+A / Ctrl+C / Ctrl+V.
   ============================================================================ */
const HELP = {
  kerf: [['Ширина реза (керф)', 'Kerf (cut width)'], ['Лазер и фреза снимают полоску материала. Компенсация сдвигает траекторию на половину ширины реза, чтобы деталь получилась точно по размеру.', 'Both lasers and bits remove a strip of material. Compensation shifts the path by half the kerf so the part comes out at its true size.'], ['Измерьте керф генератором «Тест керфа» и сохраните в материал. Типично: диод 0,08–0,2 мм, CO2 0,1–0,25 мм. Компенсация применяется один раз — при подготовке задания, генераторы её не добавляют.', 'Measure it with the “Kerf test” generator and save it to the material. Typical: diode 0.08–0.2 mm, CO2 0.1–0.25 mm. Compensation is applied once, when the job is prepared; generators never add it.']],
  kerfSide: [['Сторона компенсации', 'Compensation side'], ['«Авто» — деталь сохраняет размер: наружный контур уходит наружу, отверстия — внутрь.', '“Auto” keeps the part at size: outer outlines move out, holes move in.'], ['«Снаружи» и «внутри» сдвигают каждый контур в одну сторону — полезно, если нужна вырезанная вставка, а не лист с отверстием.', '“Outside” and “inside” move every outline one way — useful when you keep the cut-out insert rather than the sheet with a hole.']],
  interval: [['Шаг строк', 'Line interval'], ['Расстояние между соседними строками заливки или растра. Меньше шаг — плотнее и дольше.', 'Distance between neighbouring fill or raster lines. Smaller is denser and slower.'], ['0,1 мм ≈ 254 DPI. Шаг меньше пятна лазера (у диода ~0,08 мм) не добавляет деталей — строки сливаются.', '0.1 mm ≈ 254 DPI. An interval smaller than the laser spot (~0.08 mm for a diode) adds no detail — lines merge.']],
  overscan: [['Перебег', 'Overscan'], ['Головка разгоняется за пределами гравировки с выключенным лучом, чтобы края не пережигались.', 'The head accelerates outside the engraving with the beam off so the edges do not overburn.'], ['Обычно 2–5 мм. Перебег должен помещаться в рабочее поле.', 'Usually 2–5 mm. The overscan must fit inside the work area.']],
  bridges: [['Перемычки', 'Bridges'], ['Короткие нерезаные участки удерживают деталь в листе до конца задания.', 'Short uncut gaps hold the part in the sheet until the job ends.'], ['После резки перемычки перерезают ножом. Слишком узкая перемычка может прогореть.', 'Cut the bridges with a knife afterwards. Too narrow a bridge may burn through.']],
  passes: [['Проходы', 'Passes'], ['Сколько раз повторить операцию. Несколько быстрых проходов меньше обугливают кромку, чем один медленный.', 'How many times to repeat the operation. Several fast passes char the edge less than one slow pass.'], ['Следите за перегревом тонких деталей при многих проходах.', 'Watch for overheating of thin parts with many passes.']],
  minPower: [['Мин. мощность (полутона)', 'Min power (greyscale)'], ['В режиме оттенков серого светлые точки получают эту мощность, тёмные — максимальную.', 'In greyscale mode light pixels get this power and dark ones the maximum.'], ['Ниже порога, при котором материал начинает темнеть, ставить нет смысла.', 'There is no point going below the power at which the material starts to darken.']],
  scan: [['Направление сканирования', 'Scan direction'], ['Горизонтальное — вдоль X, вертикальное — вдоль Y.', 'Horizontal runs along X, vertical along Y.'], ['Выбирайте ось, по которой станок быстрее и жёстче (обычно X).', 'Pick the axis on which the machine is faster and stiffer (usually X).']],
  air: [['Обдув (Air Assist)', 'Air assist'], ['Включает обдув командой M8 и выключает M9 после операции.', 'Turns air assist on with M8 and off with M9 after the operation.'], ['Работает, только если ваш контроллер управляет компрессором по этим командам.', 'Works only if your controller drives the compressor with these commands.']],
  focus: [['Смещение фокуса', 'Focus offset'], ['Высота Z для операции: отрицательное — фокус глубже в материал.', 'Z height for the operation: negative puts the focus deeper into the material.'], ['Доступно, только если у станка есть ось Z.', 'Available only if the machine has a Z axis.']],
  auto: [['Параметры из материала', 'Values from the material'], ['Мощность, скорость, проходы и шаг берутся из профиля материала листа для этого типа операции.', 'Power, speed, passes and interval come from the sheet material profile for this operation type.'], ['Встроенные профили не проверены на вашем станке. Сделайте «Тест мощности» и сохраните свои значения — профиль станет пользовательским.', 'Built-in profiles are not tested on your machine. Run the “Power test” and save your values — the profile becomes a user profile.']],
  layerType: [['Тип процесса', 'Process type'], ['Слой определяется явным типом, а не только цветом: резка, векторная гравировка, заливка, растр, разметка или направляющие (не выводятся).', 'A layer is defined by an explicit type, not only its colour: cut, vector engrave, fill, raster, mark or guides (not output).'], ['Цвет — лишь подсказка на экране.', 'The colour is only an on-screen hint.']],
  orderMode: [['Порядок операций', 'Operation order'], ['«Авто»: растр → заливка → векторная гравировка → разметка → резка. «Вручную»: в порядке списка, который можно закрепить.', '“Auto”: raster → fill → vector engrave → mark → cut. “Manual”: the list order, which you can lock.'], ['Резка последней не даёт деталям сдвинуться до гравировки.', 'Cutting last keeps parts from shifting before they are engraved.']],
  joinTol: [['Объединение сегментов', 'Segment merging'], ['Мелкие сегменты объединяются, если отклонение не больше допуска. Меньше команд — плавнее движение.', 'Short segments are merged if the deviation stays within the tolerance. Fewer commands mean smoother motion.'], ['0,01–0,05 мм не влияет на точность изделия.', '0.01–0.05 mm does not affect part accuracy.']],
  nestMode: [['Режимы раскладки', 'Nesting modes'], ['Один лист — всё на выбранный лист, новые листы не создаются. Несколько листов — по листам с подходящим материалом, при нехватке добавляются новые. Только текущий — другие листы не меняются. Ручная — детали в ряд.', 'One sheet — everything on the chosen sheet, no new sheets. Several sheets — over sheets with a matching material, adding new ones if needed. Current only — other sheets stay untouched. Manual — parts in a row.'], ['Неразместившиеся детали не пропадают: они попадают в зону «Неразмещённые» и в отчёт.', 'Parts that do not fit are never lost: they go to the “Unplaced” area and the report.']],
  nestSpacing: [['Зазор', 'Gap'], ['Минимальное расстояние между деталями.', 'The minimum distance between parts.'], ['Для лазера 2–3 мм, для фрезы — не меньше диаметра фрезы плюс 1 мм.', '2–3 mm for lasers; at least the bit diameter plus 1 mm for routers.']],
  nestRot: [['Поворот деталей', 'Part rotation'], ['Какие углы разрешены при раскладке. Мельче шаг — плотнее, но дольше расчёт.', 'Which angles nesting may use. Finer steps pack tighter but take longer.'], ['Если важно направление волокон, выберите «без поворота» или «0°/180°».', 'If grain direction matters, choose “no rotation” or “0°/180°”.']],
  nestGoal: [['Цель раскладки', 'Nesting goal'], ['«Минимум листов» заполняет листы по порядку. «Минимум отхода» сначала дозаполняет самые занятые листы. «Баланс» держит раскладку компактной снизу.', '“Fewest sheets” fills sheets in order. “Least waste” tops up the fullest sheets first. “Balanced” keeps the layout compact from the bottom.'], ['Это эвристика: результат — допустимый, но не доказанно оптимальный вариант.', 'This is a heuristic: the result is valid but not proven optimal.']],
  nestRes: [['Точность сетки', 'Grid precision'], ['Раскладка работает по растровой сетке. Мелкая сетка точнее, но медленнее.', 'Nesting works on a raster grid. A finer grid is more precise but slower.'], ['«Авто» подбирает шаг по самой мелкой детали, чтобы она не потерялась.', '“Auto” picks the step from the smallest part so it is never lost.']],
  nestMirror: [['Зеркальное отражение', 'Mirroring'], ['Разрешает переворачивать детали.', 'Allows flipping parts over.'], ['Детали с текстом и фото не отражаются никогда.', 'Parts with text or photos are never mirrored.']],
  zones: [['Запретные зоны', 'No-go zones'], ['Области листа, куда раскладка не кладёт детали: прижимы, дефекты, повреждённые края.', 'Sheet areas nesting will not use: clamps, defects, damaged edges.'], ['Рисуются инструментом «Запретная зона» (клавиша B). Двойной клик по зоне — удалить.', 'Draw them with the “No-go zone” tool (B key). Double-click a zone to delete it.']],
  lock: [['Закрепление', 'Locking'], ['Закреплённый объект нельзя сдвинуть мышью, а раскладка обходит его как препятствие.', 'A locked object cannot be dragged, and nesting treats it as an obstacle.'], ['Так можно оставить деталь на листе № 2 и перераскладывать остальные.', 'Use it to keep a part on sheet 2 and re-nest the rest.']],
  post: [['Постпроцессор', 'Postprocessor'], ['G-code — семейство диалектов. Постпроцессор переводит задание в команды конкретного контроллера.', 'G-code is a family of dialects. The postprocessor translates the job into one controller’s commands.'], ['Ни один профиль не отмечен «проверенным», пока его не испытали на реальном станке. «Общий» профиль даёт самый консервативный код.', 'No profile is marked “verified” until it has been tested on a real machine. The “Generic” profile produces the most conservative code.']],
  ext: [['Расширение файла', 'File extension'], ['.gcode, .nc, .ngc, .tap — разные программы ждут разные расширения.', '.gcode, .nc, .ngc, .tap — different programs expect different extensions.'], ['Расширение не делает код совместимым: важен выбранный постпроцессор.', 'The extension does not make the code compatible: the postprocessor does.']],
  stamp: [['Метка времени', 'Timestamp'], ['Дата создания в комментарии в начале файла.', 'The creation date in a comment at the top of the file.'], ['Без метки повторный экспорт того же проекта даёт байт-в-байт одинаковый файл.', 'Without it, re-exporting the same project gives a byte-identical file.']],
  fit: [['Посадка соединения', 'Joint fit'], ['Зазор, который добавляется к пазам и шипам: свободная, стандартная, тугая или своё значение.', 'Clearance added to slots and fingers: loose, standard, tight or custom.'], ['Это профиль для калибровки, а не гарантия. Вырежьте «Тест соединения» и выберите лучшее значение для своего материала.', 'This is a calibration profile, not a guarantee. Cut a “Joint fit test” and pick the best value for your material.']],
  thick: [['Толщина материала', 'Material thickness'], ['Измерьте лист штангенциркулем в нескольких местах — фанера часто тоньше номинала.', 'Measure the sheet with calipers in a few places — plywood is often thinner than nominal.'], ['От толщины зависят шипы, пазы и штифты.', 'Fingers, slots and dowels depend on it.']],
  dither: [['Дизеринг', 'Dithering'], ['Превращает полутона в точки, которые лазер может прожечь. Jarvis и Stucki мягче, Floyd–Steinberg резче, Atkinson светлее.', 'Turns greyscale into dots the laser can burn. Jarvis and Stucki are softer, Floyd–Steinberg sharper, Atkinson lighter.'], ['«Оттенки серого» меняют мощность в каждой точке — подходит для дерева и кожи на станках с плавной мощностью.', '“Greyscale” varies power per pixel — good for wood and leather on machines with smooth power control.']],
  relief: [['3D-рельеф', '3D relief'], ['Отдельный режим для фрезера: карта высот из изображения, черновая и чистовая обработка.', 'A separate router mode: a height map from an image, roughing and finishing.'], ['Растровая гравировка лазером — это не 3D-рельеф: она меняет только тон поверхности.', 'Laser raster engraving is not a 3D relief: it only changes the surface tone.']],
  engraveFirst: [['Гравировка перед резкой', 'Engrave before cut'], ['В автоматическом порядке гравировка и разметка выполняются до резки.', 'In automatic order, engraving and marking run before cutting.'], ['Отрезанная деталь может сдвинуться — поэтому резка последней.', 'A part that has been cut free may shift — that is why cutting runs last.']],
};
const helpShort = k => HELP[k] ? `${T(...HELP[k][0])}: ${T(...HELP[k][1])}` : '';

/* ---------- tooltip (hover/focus) + detailed popover (click) ---------- */
let tipT = 0;
function showTip(el) { const k = el.dataset.help, tip = $('#tip'); if (!HELP[k] || !tip) return; tip.textContent = T(...HELP[k][1]); tip.hidden = false; const r = el.getBoundingClientRect(), tr = tip.getBoundingClientRect(); tip.style.left = clamp(r.left + r.width / 2 - tr.width / 2, 8, innerWidth - tr.width - 8) + 'px'; tip.style.top = (r.bottom + tr.height + 12 > innerHeight ? r.top - tr.height - 8 : r.bottom + 8) + 'px' }
function hideTip() { const tip = $('#tip'); if (tip) tip.hidden = true }
function openHelpTopic(k) { const h = HELP[k]; if (!h) return; openModal(`${ic('info', 18)} ${T(...h[0])}`, `<p class="note big">${T(...h[1])}</p><p class="note">${T(...h[2])}</p>`, `<button class="primary" data-act="closeModal">${T('Понятно', 'Got it')}</button>`) }

/* ---------- commands ---------- */
const COMMANDS = () => [
  { id: 'new', n: T('Новый проект', 'New project'), syn: 'new create создать', key: 'Ctrl+N', run: () => openNewProject() },
  { id: 'open', n: T('Открыть проект…', 'Open project…'), syn: 'open load открыть', key: 'Ctrl+O', run: () => openProjectDialog() },
  { id: 'save', n: T('Сохранить проект', 'Save project'), syn: 'save сохранить', key: 'Ctrl+S', run: () => saveProject(false) },
  { id: 'saveAs', n: T('Сохранить проект как…', 'Save project as…'), syn: 'save as копия', key: 'Ctrl+Shift+S', run: () => saveProject(true) },
  { id: 'import', n: T('Импорт файла…', 'Import file…'), syn: 'import svg dxf png jpg stl obj импорт вставка изображение', key: 'Ctrl+I', run: () => $('#fileAny').click() },
  { id: 'export', n: T('Экспорт G-code…', 'Export G-code…'), syn: 'export gcode nc сохранить экспорт', key: 'Ctrl+E', run: () => openExport() },
  { id: 'svg', n: T('Экспорт листа в SVG…', 'Export sheet as SVG…'), syn: 'svg export', run: () => exportSide('svg') },
  { id: 'dxf', n: T('Экспорт листа в DXF…', 'Export sheet as DXF…'), syn: 'dxf export autocad', run: () => exportSide('dxf') },
  { id: 'undo', n: T('Отменить', 'Undo'), syn: 'undo отмена назад', key: 'Ctrl+Z', run: () => undo() },
  { id: 'redo', n: T('Повторить', 'Redo'), syn: 'redo вернуть', key: 'Ctrl+Y', run: () => redo() },
  { id: 'dup', n: T('Дублировать', 'Duplicate'), syn: 'duplicate copy копия', key: 'Ctrl+D', run: () => dupSel() },
  { id: 'del', n: T('Удалить выделенное', 'Delete selection'), syn: 'delete remove удалить', key: 'Del', run: () => delSel() },
  { id: 'selAll', n: T('Выделить всё на листе', 'Select all on sheet'), syn: 'select all выделить', key: 'Ctrl+A', run: () => selectAllOnSheet() },
  { id: 'group', n: T('Сгруппировать', 'Group'), syn: 'group группа', key: 'Ctrl+G', run: () => groupSel() },
  { id: 'ungroup', n: T('Разгруппировать', 'Ungroup'), syn: 'ungroup', key: 'Ctrl+Shift+G', run: () => ungroupSel() },
  { id: 'lock', n: T('Закрепить / открепить', 'Lock / unlock'), syn: 'lock pin закрепить', key: 'Ctrl+L', run: () => lockSel(!selShapes().every(s => s.lock)) },
  { id: 'rotL', n: T('Повернуть на −90°', 'Rotate −90°'), syn: 'rotate повернуть', key: '[', run: () => rotSel(-90) },
  { id: 'rotR', n: T('Повернуть на +90°', 'Rotate +90°'), syn: 'rotate повернуть', key: ']', run: () => rotSel(90) },
  { id: 'flipH', n: T('Отразить по горизонтали', 'Flip horizontal'), syn: 'mirror flip зеркало', key: 'Shift+H', run: () => mirrorSel(true) },
  { id: 'flipV', n: T('Отразить по вертикали', 'Flip vertical'), syn: 'mirror flip зеркало', key: 'Shift+V', run: () => mirrorSel(false) },
  { id: 'nest', n: T('Раскладка деталей…', 'Nest parts…'), syn: 'nest nesting раскрой раскладка', key: 'Ctrl+Shift+N', run: () => nestExisting() },
  { id: 'split', n: T('Разрезать крупную деталь на части…', 'Split a large part into tiles…'), syn: 'split tile разрезать', run: () => openSplit() },
  { id: 'check', n: T('Проверить геометрию листа', 'Check sheet geometry'), syn: 'check validate проверка', run: () => { switchTab('cam') } },
  { id: 'addSheet', n: T('Добавить лист', 'Add sheet'), syn: 'sheet plate лист', run: () => addSheet() },
  { id: 'delSheet', n: T('Удалить текущий лист…', 'Delete current sheet…'), syn: 'delete sheet удалить лист', run: () => deleteSheet() },
  { id: 'materials', n: T('Библиотека материалов…', 'Material library…'), syn: 'material материал калибровка kerf', run: () => openMaterials() },
  { id: 'tools', n: T('Библиотека фрез…', 'Tool library…'), syn: 'tool bit фреза', run: () => openTools() },
  { id: 'machine', n: T('Станок и настройки…', 'Machine & settings…'), syn: 'machine settings станок', run: () => openSettings() },
  { id: 'slicer', n: T('3D-модель → слои…', '3D model → layers…'), syn: 'stl obj slicer слайсер', run: () => openSlicer() },
  { id: 'building', n: T('Генератор строений…', 'Building generator…'), syn: 'house домик башня замок', run: () => openGen('building') },
  { id: 'box', n: T('Генератор коробок…', 'Box generator…'), syn: 'box коробка', run: () => openGen('box') },
  { id: 'help', n: T('Справка', 'Help'), syn: 'help справка', key: 'F1', run: () => openHelp() },
  { id: 'errlog', n: T('Журнал ошибок', 'Error log'), syn: 'log errors журнал', run: () => openHelp('log') },
  { id: 'simple', n: T('Простой режим', 'Simple mode'), syn: 'simple mode', run: () => setMode('simple') },
  { id: 'pro', n: T('Профессиональный режим', 'Pro mode'), syn: 'pro mode профессиональный', run: () => setMode('pro') },
];
function openPalette() {
  openModal(`${ic('search', 18)} ${T('Поиск команды', 'Find a command')}`, `<input class="plain big" id="palIn" placeholder="${T('Например: экспорт, раскладка, удалить лист…', 'e.g. export, nest, delete sheet…')}" autofocus><div class="palette-list" id="palList"></div>`, null, 'narrow');
  let idx = 0; const list = COMMANDS();
  const render = () => { const q = $('#palIn').value.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean); const hits = list.filter(c => words.every(w => (c.n + ' ' + c.syn).toLowerCase().includes(w))).slice(0, 14); idx = clamp(idx, 0, Math.max(0, hits.length - 1)); $('#palList').innerHTML = hits.map((c, i) => `<button class="${i === idx ? 'on' : ''}" data-pal="${c.id}"><span>${esc(c.n)}</span>${c.key ? `<kbd>${c.key}</kbd>` : ''}</button>`).join('') || `<p class="note">${T('Ничего не найдено.', 'Nothing found.')}</p>`; return hits };
  let hits = render();
  $('#palIn').oninput = () => { idx = 0; hits = render() };
  $('#palIn').onkeydown = e => { if (e.key === 'ArrowDown') { idx++; hits = render(); e.preventDefault() } else if (e.key === 'ArrowUp') { idx--; hits = render(); e.preventDefault() } else if (e.key === 'Enter' && hits[idx]) { closeModal(); hits[idx].run() } };
  $('#palList').onclick = e => { const b = e.target.closest('[data-pal]'); if (!b) return; const c = list.find(x => x.id === b.dataset.pal); closeModal(); c.run() };
}
/* ---------- main menu (File / Edit / View / Help) ---------- */
function openMenu(btn) {
  const m = $('#ctxMenu'), u = undoLabel(), r = redoLabel(), sec = (t) => `<div class="mh">${t}</div>`, it = (id, icn, n, k, dis) => `<button data-menu="${id}" ${dis ? 'disabled' : ''}>${ic(icn, 15)}<span>${n}</span><kbd>${k || ''}</kbd></button>`;
  m.innerHTML = sec(T('Файл', 'File')) + it('new', 'newp', T('Новый проект…', 'New project…'), 'Ctrl+N') + it('open', 'open', T('Открыть…', 'Open…'), 'Ctrl+O') + it('save', 'save', T('Сохранить', 'Save'), 'Ctrl+S') + it('saveAs', 'save', T('Сохранить как…', 'Save as…'), 'Ctrl+Shift+S') + it('import', 'svg', T('Импорт файла…', 'Import file…'), 'Ctrl+I') + it('export', 'export', T('Экспорт G-code…', 'Export G-code…'), 'Ctrl+E') + it('svg', 'svg', T('Экспорт SVG…', 'Export SVG…')) + it('dxf', 'svg', T('Экспорт DXF…', 'Export DXF…')) +
    '<hr>' + sec(T('Правка', 'Edit')) + it('undo', 'undo', u ? T('Отменить: ', 'Undo: ') + esc(u) : T('Отменить', 'Undo'), 'Ctrl+Z', !u) + it('redo', 'redo', r ? T('Повторить: ', 'Redo: ') + esc(r) : T('Повторить', 'Redo'), 'Ctrl+Y', !r) + it('dup', 'copy', T('Дублировать', 'Duplicate'), 'Ctrl+D', !sel.size) + it('del', 'trash', T('Удалить', 'Delete'), 'Del', !sel.size) + it('selAll', 'select', T('Выделить всё', 'Select all'), 'Ctrl+A') +
    '<hr>' + sec(T('Библиотеки', 'Libraries')) + it('materials', 'layers', T('Материалы…', 'Materials…')) + it('tools', 'cnc', T('Фрезы…', 'Tools…')) + it('machine', 'cog', T('Станок…', 'Machine…')) +
    '<hr>' + sec(T('Справка', 'Help')) + it('palette', 'search', T('Поиск команды…', 'Find a command…'), 'Ctrl+K') + it('help', 'help', T('Справка и горячие клавиши', 'Help & shortcuts'), 'F1') + it('errlog', 'warn', T('Журнал ошибок', 'Error log')) + it('about', 'info', T('О программе', 'About'));
  m.hidden = false; const br = btn.getBoundingClientRect(); m.style.left = Math.max(8, Math.min(br.left, innerWidth - 300)) + 'px'; m.style.top = br.bottom + 6 + 'px';
}
function menuAction(id) { hideCtx(); if (id === 'palette') return openPalette(); if (id === 'about') return openHelp('about'); const c = COMMANDS().find(x => x.id === id); if (c) c.run() }

/* ---------- help dialog ---------- */
const HOTKEYS = () => [
  [T('Отменить', 'Undo'), 'Ctrl+Z'], [T('Повторить', 'Redo'), 'Ctrl+Y · Ctrl+Shift+Z'], [T('Выделить всё на листе', 'Select all on sheet'), 'Ctrl+A'], [T('Копировать / вставить', 'Copy / paste'), 'Ctrl+C · Ctrl+V'],
  [T('Дублировать', 'Duplicate'), 'Ctrl+D'], [T('Группа / разгруппировать', 'Group / ungroup'), 'Ctrl+G · Ctrl+Shift+G'], [T('Закрепить / открепить', 'Lock / unlock'), 'Ctrl+L'], [T('Удалить', 'Delete'), 'Delete · Backspace'],
  [T('Снять выделение, отменить инструмент', 'Deselect, cancel tool'), 'Esc'], [T('Завершить ломаную', 'Finish polyline'), 'Enter'], [T('Сдвиг на 1 мм / 10 мм', 'Nudge 1 mm / 10 mm'), T('Стрелки · Shift+стрелки', 'Arrows · Shift+arrows')],
  [T('Повернуть −90° / +90°', 'Rotate −90° / +90°'), '[ · ]'], [T('Отразить по горизонтали / вертикали', 'Flip horizontal / vertical'), 'Shift+H · Shift+V'], [T('Переименовать', 'Rename'), 'F2'],
  [T('Поиск команды', 'Find a command'), 'Ctrl+K · Ctrl+Shift+P'], [T('Новый / открыть / сохранить', 'New / open / save'), 'Ctrl+N · Ctrl+O · Ctrl+S'], [T('Сохранить как', 'Save as'), 'Ctrl+Shift+S'], [T('Импорт файла', 'Import file'), 'Ctrl+I'], [T('Экспорт G-code', 'Export G-code'), 'Ctrl+E'],
  [T('Вкладки CAD / CAM / G-code / Станок', 'Tabs CAD / CAM / G-code / Machine'), 'Ctrl+1…4'], [T('Показать лист', 'Fit sheet'), 'F'], [T('Панорама', 'Pan'), T('Пробел + мышь, средняя или правая кнопка', 'Space + drag, middle or right button')], [T('Контекстное меню', 'Context menu'), T('правая кнопка без сдвига', 'right click without dragging')],
  [T('Инструменты', 'Tools'), 'V H R E P S L N T M B'], [T('Справка', 'Help'), 'F1'],
];
function openHelp(section) {
  const s = section || 'keys', tabs = [['keys', T('Горячие клавиши', 'Shortcuts')], ['formats', T('Форматы', 'Formats')], ['safety', T('Безопасность', 'Safety')], ['log', T('Журнал ошибок', 'Error log')], ['about', T('О программе', 'About')]];
  const body = {
    keys: `<p class="note">${T('Сочетания работают на любой раскладке (по физическим клавишам). В текстовых полях Ctrl+Z, Ctrl+A, Ctrl+C и Ctrl+V относятся к тексту, а не к сцене. На macOS вместо Ctrl — Cmd.', 'Shortcuts follow physical keys, so they work on any layout. In text fields Ctrl+Z, Ctrl+A, Ctrl+C and Ctrl+V act on the text, not the scene. On macOS use Cmd instead of Ctrl.')}</p><table class="tbl">${HOTKEYS().map(([a, b]) => `<tr><td>${a}</td><td><kbd>${b}</kbd></td></tr>`).join('')}</table>`,
    formats: `<p class="note big">${SUPPORTED_FORMATS()}</p><p class="note">${T('Экспорт: G-code (.gcode .nc .ngc .tap или своё расширение) через выбранный постпроцессор, SVG и DXF R12 по листам, отчёт о задании (.txt) и настройки задания (.json).', 'Export: G-code (.gcode .nc .ngc .tap or a custom extension) through the chosen postprocessor, SVG and DXF R12 per sheet, a job report (.txt) and job settings (.json).')}</p>`,
    safety: `<p class="note big">${T('Лазер и фрезер могут повредить станок, вызвать пожар или травму. Проверка кода в программе не заменяет проверку станка, крепления материала, фокуса, инструмента и аварийной остановки.', 'Lasers and routers can damage the machine, start a fire or injure you. The software check does not replace checking the machine, workholding, focus, tool and emergency stop.')}</p><ul class="note"><li>${T('Работайте в очках под длину волны лазера, с вытяжкой и огнетушителем рядом.', 'Wear laser-rated glasses, run extraction and keep an extinguisher nearby.')}</li><li>${T('Никогда не режьте лазером ПВХ, винил, поликарбонат, ABS, тефлон и стеклотекстолит. Сверяйтесь с паспортом безопасности материала.', 'Never laser-cut PVC, vinyl, polycarbonate, ABS, PTFE or fibreglass. Check the material safety data sheet.')}</li><li>${T('Перед первым запуском нового профиля сделайте холостой прогон с выключенным лучом или шпинделем.', 'Before the first run of a new profile do a dry run with the beam or spindle off.')}</li><li>${T('Программа не запускает задания и не двигает станок без вашей команды. Программный «Стоп» не заменяет аппаратную аварийную кнопку.', 'The app never starts a job or moves the machine without your command. The software Stop does not replace the hardware E-stop.')}</li></ul>`,
    log: `<p class="note">${T('Ошибки хранятся только на этом компьютере и никуда не отправляются.', 'Errors are kept on this computer only and are never sent anywhere.')}</p><pre class="log">${esc(ERRLOG.slice(-80).join('\n') || T('Ошибок нет.', 'No errors.'))}</pre>`,
    about: `<p class="note big"><b>${APP_NAME} ${APP_VERSION}</b> — ${T('открытая CAD/CAM-программа для лазерных станков и фрезеров с ЧПУ. Лицензия MIT.', 'open-source CAD/CAM for laser machines and CNC routers. MIT licence.')}</p><p class="note">${T('Формат проекта', 'Project format')}: v${FORMAT_VERSION} (${T('открывает файлы Kerf Studio 0.1–0.2', 'opens Kerf Studio 0.1–0.2 files')}). ${T('Сторонние компоненты: three.js (MIT), Clipper (Boost 1.0), JSBN (MIT-подобная), qrcode-generator (MIT), UTIF.js (MIT), формулы пазла Draradech/jigsaw (CC0), шрифты IBM Plex Sans, JetBrains Mono, Unbounded, PT Serif, Caveat (OFL 1.1).', 'Third-party components: three.js (MIT), Clipper (Boost 1.0), JSBN (MIT-style), qrcode-generator (MIT), UTIF.js (MIT), Draradech/jigsaw puzzle formulas (CC0), fonts IBM Plex Sans, JetBrains Mono, Unbounded, PT Serif, Caveat (OFL 1.1).')}</p><p class="note">${T('Ранее проект назывался Kerf Studio. Настройки и проекты старой версии переносятся автоматически и не удаляются.', 'The project used to be called Kerf Studio. Settings and projects from the old version are carried over automatically and never deleted.')}</p>`,
  }[s];
  openModal(`${ic('help', 18)} ${T('Справка', 'Help')}`, `<div class="seg full">${tabs.map(([k, n]) => `<button data-act="helpTab" data-v="${k}" aria-pressed="${k === s}">${n}</button>`).join('')}</div>${body}`, null, 'wide');
}

/* ---------- hotkeys ---------- */
const inField = () => { const a = document.activeElement; return a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable) };
function onKeyDown(e) {
  const mod = e.ctrlKey || e.metaKey, code = e.code;
  if (!$('#modal').hidden) { if (e.key === 'Escape') { e.preventDefault(); closeModal() } return }
  if (!$('#ctxMenu').hidden && e.key === 'Escape') { hideCtx(); return }
  if (code === 'F1') { e.preventDefault(); openHelp(); return }
  if (mod && (code === 'KeyK' || (e.shiftKey && code === 'KeyP'))) { e.preventDefault(); openPalette(); return }
  if (mod && code === 'KeyS') { e.preventDefault(); saveProject(e.shiftKey); return }
  if (inField()) return; // text fields keep their own Ctrl+Z / Ctrl+A / clipboard
  if (mod && code === 'KeyO') { e.preventDefault(); openProjectDialog(); return }
  if (mod && code === 'KeyN' && !e.shiftKey) { e.preventDefault(); openNewProject(); return }
  if (mod && code === 'KeyE') { e.preventDefault(); openExport(); return }
  if (mod && code === 'KeyI') { e.preventDefault(); $('#fileAny').click(); return }
  if (mod && /^Digit[1-4]$/.test(code)) { e.preventDefault(); switchTab(['cad', 'cam', 'gcode', 'machine'][+code.slice(5) - 1]); return }
  if (mod && code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); return }
  if (mod && code === 'KeyY') { e.preventDefault(); redo(); return }
  if (e.code === 'Space') { e.preventDefault(); if (tab === 'gcode') { if (P.t >= P.total) P.t = 0; P.playing = !P.playing; renderChrome() } else { spaceDown = true; cv.style.cursor = 'grab' } return }
  if (!mod && code === 'KeyF') { fitPlate(curPlate); draw(); renderStatus(); return }
  if (tab !== 'cad') return;
  if (mod && code === 'KeyA') { e.preventDefault(); selectAllOnSheet(); return }
  if (mod && code === 'KeyD') { e.preventDefault(); dupSel(); return }
  if (mod && code === 'KeyG') { e.preventDefault(); e.shiftKey ? ungroupSel() : groupSel(); return }
  if (mod && code === 'KeyL') { e.preventDefault(); lockSel(!selShapes().every(s => s.lock)); return }
  if (mod && e.shiftKey && code === 'KeyN') { e.preventDefault(); nestExisting(); return }
  if (mod && code === 'KeyC') { copySel(); return }
  if (mod && code === 'KeyV') { if (clip && clip.length) { e.preventDefault(); pasteClip() } return }
  if (code === 'Delete' || code === 'Backspace') { e.preventDefault(); delSel(); return }
  if (code === 'F2') { e.preventDefault(); renameSel(); return }
  if (e.key === 'Escape') { if (penPts) { penPts = null; draw(); return } measure = null; sel.clear(); refresh(); return }
  if (code === 'Enter' && penPts) { finishPen(false); return }
  if (code === 'BracketLeft') { rotSel(-90); return } if (code === 'BracketRight') { rotSel(90); return }
  if (e.shiftKey && code === 'KeyH') { mirrorSel(true); return } if (e.shiftKey && code === 'KeyV') { mirrorSel(false); return }
  if (code.startsWith('Arrow') && sel.size) { e.preventDefault(); const d = e.shiftKey ? 10 : 1, dx = code === 'ArrowLeft' ? -d : code === 'ArrowRight' ? d : 0, dy = code === 'ArrowDown' ? -d : code === 'ArrowUp' ? d : 0; transformSel((x, y) => [x + dx, y + dy], T('Сдвиг', 'Nudge'), 'nudge'); return }
  const map = { KeyV: 'select', KeyH: 'hand', KeyR: 'rect', KeyE: 'ellipse', KeyP: 'polygon', KeyS: 'star', KeyL: 'line', KeyN: 'pen', KeyT: 'text', KeyM: 'measure', KeyB: 'zone' };
  if (!mod && !e.shiftKey && !e.altKey && map[code] && (mode === 'pro' || !['polygon', 'star', 'line', 'measure', 'zone'].includes(map[code]))) setTool(map[code]);
}
