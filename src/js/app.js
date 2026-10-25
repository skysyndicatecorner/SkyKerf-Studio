'use strict';
/* ============================================================================
   SkyKerf_Studio · event wiring, playback loop, drag-and-drop, boot
   ============================================================================ */
let pendingImgAction = null;

/* ---------------- clicks ---------------- */
document.addEventListener('click', async e => {
  const t = e.target;
  if (!t.closest('#ctxMenu') && !t.closest('#menuBtn')) hideCtx();
  const help = t.closest('[data-help]'); if (help) { e.preventDefault(); e.stopPropagation(); openHelpTopic(help.dataset.help); return }
  const cm = t.closest('[data-ctx]'); if (cm) { ctxAction(cm.dataset.ctx); return }
  const mm = t.closest('[data-menu]'); if (mm) { menuAction(mm.dataset.menu); return }
  const tb = t.closest('[data-tab]'); if (tb) { switchTab(tb.dataset.tab); return }
  const mb = t.closest('[data-mode]'); if (mb) { setMode(mb.dataset.mode); return }
  const lb = t.closest('[data-lang]'); if (lb) { lang = lb.dataset.lang; store.set('lang', lang); GC.clear(); P.rev = -1; refresh(); if (GS) renderGenSide(); if (NS) renderNestSide(); return }
  const tl = t.closest('[data-tool]'); if (tl) { setTool(tl.dataset.tool); return }
  const gl = t.closest('.gl'); if (gl) { jumpToLine(+gl.dataset.line); return }
  const a = t.closest('[data-act]'); if (!a || a.disabled) return;
  const act = a.dataset.act, v = a.dataset.v;
  if (a.type === 'checkbox' && !['camOn', 'lout', 'eye'].includes(act)) return;
  try { await doAct(act, v, a, e) } catch (err) { logError('act:' + act, err); toast(T('Ошибка: ', 'Error: ') + (err.message || err), 'err') }
});
function jumpToLine(ln) { const m = P.moves.find(m => m.l >= ln); P.curLine = ln; if (m) { P.t = m.t0 + 1e-6; P.playing = false; updatePbTime(); renderChrome(); draw() } const box = $('#gcList'); if (box) box.scrollTop = ln * 19 - box.clientHeight / 2; renderGcList() }
async function doAct(act, v, a, e) {
  switch (act) {
    /* ---- shell ---- */
    case 'menu': openMenu(a); break;
    case 'primary': if (tab === 'cad' || tab === 'cam') generateNow(); else if (tab === 'gcode') switchTab('machine'); else MC.job.run ? jobStop() : jobStart(); break;
    case 'export': if (P.file && tab === 'gcode') { toast(T('Открыт внешний файл. Вернитесь к G-code проекта, чтобы экспортировать.', 'An external file is open. Go back to the project G-code to export.')); break } openExport(); break;
    case 'settings': openSettings(); break;
    case 'help': openHelp(); break; case 'helpTab': openHelp(v); break;
    case 'theme': { const r = document.documentElement, cur = r.dataset.theme || 'system', nx = { system: 'light', light: 'dark', dark: 'system' }[cur]; if (nx === 'system') delete r.dataset.theme; else r.dataset.theme = nx; store.set('theme', nx); prevCache.clear(); renderTop(); draw(); break }
    case 'undo': undo(); break; case 'redo': redo(); break;
    case 'nestRedo': if (LASTPLACE) { $('#toast').hidden = true; undo(); placeParts(LASTPLACE.parts, Object.assign({}, LASTPLACE.opts, { dialog: true })) } break;
    case 'closeModal': closeModal(); break;
    case 'fit': fitPlate(curPlate); draw(); renderStatus(); break; case 'fitAll': fitAll(); draw(); renderStatus(); break;
    case 'zin': zoomAt(CW / 2, CH / 2, 1.25); break; case 'zout': zoomAt(CW / 2, CH / 2, .8); break;
    case 'snapT': S.snapOn = !S.snapOn; scheduleSave(); renderStatus(); renderRight(); break;
    /* ---- project ---- */
    case 'newProj': openNewProject(); break; case 'openProj': openProjectDialog(); break; case 'saveProj': saveProject(false); break;
    case 'import': $('#fileAny').click(); break;
    case 'npMach': readNP(); NP.m = v; NP.mat = null; NP.thick = null; renderNewProject(); break;
    case 'npSheet': readNP(); NP.sheet = +v; renderNewProject(); break;
    case 'npCreate': createProject(); break;
    case 'npSample': { store.set('welcomed', '1'); readNP(); const simple = NP.simple; closeModal(); pushUndo(T('Пример', 'Sample')); await loadSample(); setMode(simple ? 'simple' : 'pro'); sel.clear(); curPlate = 0; changed(); fitPlate(0); draw(); toast(T('Это пример. Новый проект — «Меню → Новый проект».', 'This is a sample. New project: Menu → New project.')); break }
    case 'openSample': { pushUndo(T('Пример', 'Sample')); await loadSample(); sel.clear(); curPlate = 0; changed(); fitPlate(0); draw(); break }
    case 'preset': { const p = allMachineProfiles().find(p => p.id === v); if (p) { draftM = deepCopy(p); renderSettings() } break }
    case 'saveSettings': { const m = readSettings(); S.job.header = $('#mHead').value; S.job.footer = $('#mFoot').value; closeModal(); applyMachine(m, false); break }
    case 'saveMachineProfile': saveMachineProfile(); break;
    /* ---- sheets ---- */
    case 'plate': setPlate(+v); break;
    case 'addSheet': addSheet(); break; case 'dupSheet': addSheet(curPlate); toast(T('Добавлен лист с теми же размерами, материалом и зонами.', 'Added a sheet with the same size, material and zones.')); break;
    case 'delSheet': e.stopPropagation(); await deleteSheet(v != null ? +v : curPlate); break;
    case 'selParked': sel = new Set(S.shapes.filter(s => s.parked).map(s => s.id)); fitAll(); refresh(); break;
    case 'zoneDel': pushUndo(T('Удаление зоны', 'Delete zone')); sheetAt(curPlate).zones.splice(+v, 1); changed(); break;
    case 'zoneTool': setTool('zone'); break;
    case 'layoutSave': { const n = await askName(T('Сохранить вариант раскладки', 'Save layout variant'), T('Вариант ', 'Variant ') + (S.layouts.length + 1)); if (n != null) saveLayout(n); break }
    case 'layoutRestore': restoreLayout(+v); break;
    case 'layoutDel': pushUndo(T('Удаление варианта', 'Delete variant')); S.layouts.splice(+v, 1); changed(); break;
    /* ---- wizards & imports ---- */
    case 'genSwitch': { const tg = TEST_GROUP().find(x => x[0] === v); if (tg && tg[2] && !needMachine(tg[2], tg[1])) break; closeModal(); openGen(v); break }
    case 'wiz': if (!needMachine(wizNeeds(v), wizName(v)[0])) break; if (!$('#modal').hidden) closeModal(); if (v === 'tests') openGen(isLaser() ? 'test' : 'kerf'); else if (v === 'slicer') openSlicer(); else if (v === 'relief') { pendingImgAction = 'relief'; $('#fileImg').click() } else openGen(v); break;
    case 'imgRaster': closeModal(); addRasterImage(pendingImg); break;
    case 'imgTrace': closeModal(); openTrace(pendingImg); break;
    case 'imgLayered': { const im = pendingImg; closeModal(); openGen('layered', { imgAsset: imageToAsset(im).id }); break }
    case 'imgRelief': { if (!needMachine('cnc', T('3D-рельеф', '3D relief'))) break; const im = pendingImg; closeModal(); openRelief(im); break }
    case 'imgTraceSel': { const s = selShapes()[0]; if (!s || !s.img) break; const im = imgEl(s.img.asset); if (!im.complete) await new Promise(r => { im.onload = r; im.onerror = r }); openTrace(im, { width: fx(bboxOf(s.paths)[2] - bboxOf(s.paths)[0], 1) }); break }
    case 'imgBands': bandsDialog(); break;
    case 'trMode': if (TR) { TR.mode = v; renderTraceSide(); traceRun() } break;
    case 'trView': if (TR) { TR.view = v; $$('[data-act="trView"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v)); traceDraw() } break;
    case 'doTrace': doTrace(); break;
    case 'genView': if (GS) { GS.view = v; renderGenVb(); genDraw() } break;
    case 'hk': hkAction(v); break;
    case 'mjMode': if (GS) { GS.jmode = GS.jmode ? null : 'edge'; GS.jpick = null; if (GS.jmode) { GS.view = '2d'; renderGenVb() } renderGenSide(); genDraw() } break;
    case 'mjDel': if (GS && GS.o.mj) { GS.o.mj.splice(+v, 1); mjRefresh() } break;
    case 'gen2z': if (GS) { const vv = GS.v2 || (GS.v2 = { k: 1, dx: 0, dy: 0 }); if (+v === 0) GS.v2 = { k: 1, dx: 0, dy: 0 }; else { const k2 = clamp(vv.k * (+v > 0 ? 1.4 : 1 / 1.4), .2, 40); vv.dx *= k2 / vv.k; vv.dy *= k2 / vv.k; vv.k = k2 } genDraw() } break;
    case 'genPlace': genPlace(); break; case 'genImg': $('#fileGenImg').click(); break;
    case 'slOpen': $('#file3d').click(); break;
    case 'slSample': SL.base = v === 'torus' ? sampleTorus() : sampleVase(); SL.name = v === 'torus' ? T('Тор (пример)', 'Torus (sample)') : T('Ваза (пример)', 'Vase (sample)'); SL.size = v === 'torus' ? 60 : 150; slPrepare(); slRenderSide(); slRefresh(true); break;
    case 'slRot': slRotate(v); break; case 'slMethod': slSet('method', v); break; case 'slView': SL.view = v; slRenderSide(); slApplyView(); break; case 'slPlace': slPlace(); break;
    /* ---- nesting ---- */
    case 'nest': nestExisting(); break;
    case 'nestRun': nestRun(); break; case 'nestApply': nestApply(); break;
    case 'nestPick': if (NS) { NS.cur = +v; renderNestSide(); nestDraw() } break;
    /* ---- CAD editing ---- */
    case 'assign': { const l = +a.dataset.l; curDrawLayer = l; if (sel.size) { pushUndo(T('Смена операции', 'Change operation')); for (const s of selShapes()) s.layer = l; changed() } else { renderChrome(); toast(T(`Новые фигуры рисуются на слое «${layerName(S.layers[l])}»`, `New shapes go to “${layerName(S.layers[l])}”`)) } break }
    case 'pickLayer': if (e.target.closest('.sw2')) break; { if (e.target.closest('[data-act="eye"]')) break; const l = +a.dataset.l; sel = new Set(S.shapes.filter(s => s.layer === l && !s.parked && plateOf(s) === curPlate).map(s => s.id)); curDrawLayer = l; refresh(); break }
    case 'lout': { e.stopPropagation(); const L = S.layers[+a.dataset.l]; pushUndo(T('Вывод слоя', 'Layer output')); L.on = e.target.checked; changed(); toast(L.on ? T(`Слой «${layerName(L)}» будет обрабатываться.`, `Layer “${layerName(L)}” will be processed.`) : T(`Слой «${layerName(L)}» не попадёт в G-code (остаётся на столе).`, `Layer “${layerName(L)}” is left out of the G-code (stays on the bed).`)); break }
    case 'eye': { e.stopPropagation(); const L = S.layers[+a.dataset.l]; pushUndo(T('Видимость слоя', 'Layer visibility')); L.show = a.type === 'checkbox' ? a.checked : !L.show; for (const s of S.shapes) if (s.layer === L.id) sel.delete(s.id); changed(); break }
    case 'pickShape': { const s = shapeById(+a.dataset.id); if (!s) break; const ids = groupIds(s); if (e.shiftKey || e.ctrlKey || e.metaKey) { const has = sel.has(s.id); for (const id of ids) has ? sel.delete(id) : sel.add(id) } else sel = new Set(ids); renderObjRows(); renderRight(); renderChrome(); draw(); break }
    case 'del': delSel(); break; case 'dup': dupSel(); break; case 'rename': renameSel(); break;
    case 'lockToggle': lockSel(!selShapes().every(s => s.lock)); break;
    case 'center': { const b = selBox(); if (b) { const r = sheetRectWorld(plateOfBox(b)), dx = (r[0] + r[2]) / 2 - (b[0] + b[2]) / 2, dy = (r[1] + r[3]) / 2 - (b[1] + b[3]) / 2; transformSel((x, y) => [x + dx, y + dy], T('В центр листа', 'Centre on sheet')) } break }
    case 'rot': rotSel(+v); break; case 'rotApply': rotSel(+$('#rotBy').value || 0); break;
    case 'mirror': mirrorSel(v === 'h'); break; case 'align': alignSel(v); break; case 'bool': boolSel(v); break;
    case 'group': groupSel(); break; case 'ungroup': ungroupSel(); break; case 'break': breakApart(); break; case 'simplify': simplifySel(.1); break;
    case 'offset': { const d = +$('#offD').value; toolOpt.off = d; if (d) offsetSel(d); break }
    case 'array': { const c = clamp(+$('#arrC').value | 0, 1, 50), r = clamp(+$('#arrR').value | 0, 1, 50), g = +$('#arrG').value || 0; Object.assign(toolOpt, { ac: c, ar: r, ag: g }); if (c * r > 1) arraySel(c, r, g); break }
    case 'circArr': { const n = clamp(+$('#cirN').value | 0, 2, 200), r = Math.max(1, +$('#cirR').value || 40); Object.assign(toolOpt, { cc: n, cr: r }); circArraySel(n, r); break }
    case 'split': openSplit(); break; case 'moveSheet': moveSelToSheet(); break;
    case 'regen': { const s = selShapes().find(s => s.g && S.groups[s.g] && S.groups[s.g].gen); if (s) regenGroup(s.g); break }
    case 'retrace': { const s = selShapes().find(s => s.g && S.groups[s.g] && S.groups[s.g].src); if (s) retraceGroup(s.g); break }
    case 'txtAlign': { const p = a.dataset.p; if (p === 'data-topt') { toolOpt.align = v; renderRight() } else { const s = selShapes()[0]; if (s && s.kind === 'text') updateText(Object.assign(textSpec(s), { align: v })) } break }
    case 'loadFonts': try { busy(T('Читаю шрифты системы…', 'Reading system fonts…')); await loadSystemFonts(); busy(null); renderRight(); if (GS) renderGenSide(); toast(T(`Найдено шрифтов: ${systemFonts.length}`, `${systemFonts.length} fonts found`)) } catch (err) { busy(null); toast(err.message || String(err), 'warn') } break;
    /* ---- CAM ---- */
    case 'camPick': if (e.target.closest('.mini') || e.target.type === 'checkbox') break; camSel = +a.dataset.l; renderLeft(); renderRight(); break;
    case 'camOn': { const L = S.layers[+a.dataset.l]; pushUndo(L.on ? T('Отключение операции', 'Disable operation') : T('Включение операции', 'Enable operation')); L.on = e.target.checked; changed(); break }
    case 'camUp': case 'camDown': { const id = +a.dataset.l, used = camLayers().map(L => L.id), i = used.indexOf(id), j = act === 'camUp' ? i - 1 : i + 1; if (j < 0 || j >= used.length) break; pushUndo(T('Порядок операций', 'Operation order')); const o = S.order, ia = o.indexOf(id), ib = o.indexOf(used[j]);[o[ia], o[ib]] = [o[ib], o[ia]]; changed(); break }
    case 'orderMode': if (S.orderMode === v) break; pushUndo(T('Режим порядка', 'Order mode')); if (v === 'manual') { const cur = camLayers().map(L => L.id); S.order = cur.concat(S.order.filter(i => !cur.includes(i))) } S.orderMode = v; changed(); break;
    case 'layerHead': { const L = S.layers[camSel]; if (!L) break; pushUndo(T('Головка операции', 'Operation head')); L.head = v; if (L.head === 'cnc' && L.type === 'raster') toast(T('Растровая гравировка возможна только лазером.', 'Raster engraving needs the laser.')); changed(); break }
    case 'layerAuto': { const L = S.layers[camSel]; if (!L || L.auto) break; pushUndo(T('Параметры из материала', 'Values from material')); L.auto = true; changed(); break }
    case 'layerManual': { const L = S.layers[camSel]; if (!L || !L.auto) break; pushUndo(T('Ручные параметры', 'Manual values')); if (layerHead(L) === 'laser') { const r = resolveLaser(L, sheetAt(curPlate)); Object.assign(L.laser, { power: r.power, minPower: r.minPower, speed: r.speed, passes: r.passes, interval: r.interval, kerf: r.kerf }) } else { const r = resolveCnc(L, sheetAt(curPlate)); Object.assign(L.cnc, { rpm: r.rpm, feed: r.feed, plunge: r.plunge, step: r.step, depth: r.depth }) } L.auto = false; changed(); break }
    case 'ovrReset': { const L = S.layers[camSel]; if (!L) break; pushUndo(T('Значение материала', 'Material value')); if (isLaser()) { L.ovr = Object.assign({}, L.ovr); delete L.ovr[v] } else { L.ovrC = Object.assign({}, L.ovrC); delete L.ovrC[v] } changed(); break }
    case 'layerToMat': { const L = S.layers[camSel]; if (L) layerToMaterial(L); break }
    case 'issue': { const x = GEO.issues[+v]; if (!x) break; sel = new Set(x.ids.filter(id => shapeById(id))); switchTab('cad'); const b = selBox(); if (b) { fitBox(b, 120); draw() } refresh(); break }
    case 'removeDups': { const x = GEO.issues.find(i => i.dup); if (x) removeDuplicates(x.dup); break }
    case 'materials': openMaterials(); break; case 'tools': openTools(); break;
    case 'toolAdd': toolAdd(); break;
    case 'toolDel': { const i = userTools.findIndex(t => t.id === v); if (i >= 0) { userTools.splice(i, 1); saveUserTools(); GC.clear(); openTools() } break }
    case 'mlPick': case 'mlNew': case 'mlDup': case 'mlProcOff': case 'mlProcOn': case 'mlOwnOn': case 'mlOwnOff': case 'mlLaserOn': case 'mlCncOn': case 'mlSave': case 'mlUse': case 'mlDel': case 'mlExport': case 'mlImport': matEditAction(act, v); break;
    /* ---- G-code ---- */
    case 'pmode': P.mode = v; renderChrome(); renderRight(); draw(); break;
    case 'play': if (P.t >= P.total) P.t = 0; P.playing = !P.playing; renderChrome(); break;
    case 'rate': P.rate = +v; renderChrome(); break;
    case 'colorBy': P.colorBy = v; renderRight(); draw(); break;
    case 'copyGc': try { await navigator.clipboard.writeText(P.text); toast(T('G-code скопирован в буфер обмена.', 'G-code copied to the clipboard.')) } catch (err) { toast(T('Буфер обмена недоступен в этом окне.', 'The clipboard is unavailable here.'), 'warn') } break;
    case 'openGc': $('#fileGc').click(); break;
    case 'gcConv': if (v === 'svg') gcToSVG(); else if (v === 'dxf') gcToDXF(); else if (v === 'png') gcToPNG(10); else if (v === 'png2') gcToPNG(20); else if (v === 'cad') gcToProject(); else if (v === 'pngcad') gcPngToProject(); break;
    case 'backProj': P.file = null; P.rev = -1; refresh(); break;
    case 'gcHit': { if (!P.hits.length) break; const cur = P.curLine, d = +v; let k = d > 0 ? P.hits.findIndex(h => h > cur) : (() => { for (let i = P.hits.length - 1; i >= 0; i--) if (P.hits[i] < cur) return i; return -1 })(); if (k < 0) k = d > 0 ? 0 : P.hits.length - 1; jumpToLine(P.hits[k]); break }
    case 'gcLine': jumpToLine(+v); break;
    case 'exPl': if (EX) { EX.plates = v; renderExport() } break;
    case 'postEdit': if (EX) { const id = EX.post; closeModal(); openPostEditor(id) } break;
    case 'exSave': exportSave(); break;
    case 'offerDl': case 'offerCopy': offerAction(act, v); break;
    case 'fpFilter': case 'fpPick': case 'fpOk': case 'fpFile': case 'fpFolder': fontPickerAction(act, v); break;
    case 'fontPick': { const p = a.dataset.p; let cur = p === 'data-topt' ? toolOpt.font : p === 'data-txt' ? (selShapes()[0] || {}).font : GS ? GS.o[p.slice(3)] : 'plex';
      if (FP && FP.anchor === a) { closeFontDrop(); break }
      openFontPicker(cur, f => { if (p === 'data-topt') { toolOpt.font = f; toolOpt.weight = defaultWeight(f); renderRight() } else if (p === 'data-txt') { const s = selShapes()[0]; if (s && s.kind === 'text') updateText(Object.assign(textSpec(s), { font: f, weight: defaultWeight(f) })) } else if (GS) { GS.o[p.slice(3)] = f; renderGenSide(); genRegen() } }, a); break } case 'exCopy': exportCopy(); break;
    case 'exOpenFolder': if (EX && EX.saved && DESK && DESK.showItemInFolder) DESK.showItemInFolder(EX.saved); break;
    /* ---- machine ---- */
    case 'sckGo': { const all = [...document.querySelectorAll('[data-sck]')]; if (!all.every(x => x.checked)) { toast(T('Отметьте все три пункта — это займёт пять секунд.', 'Tick all three items — it takes five seconds.')); break } if ($('#sckNever') && $('#sckNever').checked) MCOPT.checks = false; MC.checks = { a: true, b: true, c: true }; const o = MC.pendingStart || {}; closeModal(); jobStart(o); break }
    case 'mcPlug': MC.mode = 'serial'; setState('offline'); refresh(); await doAct('mcConnect'); break;
    case 'mcMode': if (MC.connected && v !== 'serial') await serialDisconnect(); MC.mode = v; setState(v === 'demo' ? 'demo' : 'offline'); refresh(); if (v === 'serial') autoConnect(); break;
    case 'mcConnect': serialConnect(); break;
    case 'mDetect': detectDevice(); break;
    case 'mcClearLog': { MC.log = []; const c = $('#mcCon'); if (c) c.innerHTML = ''; break }
    case 'demoRate': MC.demoRate = +v; renderMachineDock(); break;
    case 'jobStart': jobStart(); break; case 'jobPause': jobPause(); break; case 'jobStop': jobStop(); break;
    case 'estop': emergencyStop(); break;
    case 'jogStep': MC.step = +v; renderMachineDock(); break;
    case 'jog': { const ax = v[0], dir = v[1] === '+' ? 1 : -1; jog(ax, dir * MC.step); break }
    case 'mHome': sendCmd('$H'); break; case 'mUnlock': MC.lastErr = null; sendCmd('$X'); renderMachineDock(); break;
    case 'mcErrHide': MC.lastErr = null; renderMachineDock(); break;
    case 'zeroAx': sendCmd(`G10 L20 P1 ${'XYZ'[+v]}0`); MC.zero[+v] = MC.pos[+v]; updateMachineLive(); break;
    case 'mZeroXY': sendCmd('G10 L20 P1 X0 Y0'); MC.zero[0] = MC.pos[0]; MC.zero[1] = MC.pos[1]; updateMachineLive(); break;
    case 'mGoZero': sendCmd('G90 G0 X0 Y0'); break;
    case 'mFrame': frameJob(); break;
    case 'mFire': testFire(); break;
    case 'mcFireM': MC.fire.method = v; renderMachineDock(); break;
    case 'mSpin': toggleSpindle(); break;
    case 'mProbe': probeZ(); break;
    case 'mcChecksOff': MCOPT.checks = false; toast(T('Список «Перед запуском» скрыт. Вернуть — в настройках станка.', 'The “Before you start” list is hidden. Bring it back in machine settings.')); renderMachineDock(); break;
    case 'mcDock': store.set('mcDock', store.get('mcDock') === 'min' ? '' : 'min'); renderMachineDock(); requestAnimationFrame(drawMachineCanvas); break;
    case 'mvFit': mvFit(); drawMachineCanvas(); break;
    case 'mvZoom': { const c = $('#mcv'), r = c.getBoundingClientRect(); mvZoomAt(r.width / 2, r.height / 2, +v > 0 ? 1.4 : 1 / 1.4); break }
    case 'mvFollow': MV.follow = !MV.follow; drawMachineCanvas(); break;
    case 'gpSettings': openGamepadSettings(); break;
    case 'gpLearn': gpLearn(v); break;
    case 'gpReset': gpResetMap(); break;
    case 'gpClear': GP.cfg.map[v] = ''; gpSave(); openGamepadSettings(); break;
    case 'delMachine': if (await deleteUserMachine(v)) renderSettings(); break;
    case 'macro': { const m = (S.macros || [])[+v]; if (m) for (const c of m.g.split(';')) if (c.trim()) await sendCmd(c.trim()); break }
    case 'editMacros': openMacros(); break;
    case 'saveMacros': { const list = $('#mcEdit').value.split('\n').map(l => l.split('|')).filter(p => p.length > 1 && p[0].trim() && p[1].trim()).map(p => ({ n: p[0].trim(), g: p.slice(1).join('|').trim() })); pushUndo(T('Макросы', 'Macros')); S.macros = list; closeModal(); changed(); break }
  }
}

/* ---------------- field changes ---------------- */
document.addEventListener('change', e => { try { onChange(e.target) } catch (err) { logError('change', err); toast(T('Ошибка: ', 'Error: ') + (err.message || err), 'err') } });
function numVal(t) { let v = parseFloat(String(t.value).replace(',', '.')); if (!isFinite(v)) return null; if (t.min !== '' && t.min != null && isFinite(+t.min)) v = Math.max(+t.min, v); if (t.max !== '' && t.max != null && isFinite(+t.max)) v = Math.min(+t.max, v); return v }
function onChange(t) {
  const d = t.dataset;
  if (t.name === 'nestMode' && NS) { NS.mode = t.value; renderNestSide(); $('#nestApplyBtn').disabled = NS.mode !== 'manual' && NS.cur < 0; return }
  if (d.ns && NS) { const k = d.ns; NS[k] = t.type === 'checkbox' ? t.checked : (k === 'target' || k === 'rot' || k === 'res' || k === 'spacing') ? (numVal(t) ?? NS[k]) : t.value; renderNestSide(); return }
  if (d.prop) { setBox(d.prop, numVal(t)); return }
  if (t.id === 'lockRatio') { toolOpt.lock = t.checked; return }
  if (d.topt) { const k = d.topt; toolOpt[k] = t.type === 'checkbox' ? t.checked : (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' && k === 'font') ? t.value : (numVal(t) ?? toolOpt[k]); if (k === 'font') toolOpt.weight = defaultWeight(t.value); if (k === 'font' || k === 'italic') renderRight(); return }
  if (d.txt) { const s = selShapes()[0]; if (!s || s.kind !== 'text') return; const k = d.txt, spec = textSpec(s); spec[k] = t.type === 'checkbox' ? t.checked : (t.tagName === 'TEXTAREA' || k === 'font') ? t.value : (numVal(t) ?? spec[k]); if (k === 'font') spec.weight = defaultWeight(t.value); if (!String(spec.text).trim()) { toast(T('Текст не может быть пустым.', 'Text cannot be empty.'), 'warn'); renderRight(); return } updateText(spec); return }
  if (t.id === 'snapChk') { S.snapOn = t.checked; scheduleSave(); renderStatus(); return }
  if (t.id === 'snapStep') { S.snap = Math.max(.1, numVal(t) || 1); scheduleSave(); renderStatus(); return }
  if (d.job) { pushUndo(T('Настройки задания', 'Job settings')); S.job[d.job] = t.checked; changed(); return }
  if (d.sh) {
    const k = d.sh, sh = sheetAt(curPlate); pushUndo(T('Параметры листа', 'Sheet settings'), 'sh' + k + curPlate);
    if (k === 'name') sh.name = t.value.trim();
    else { const v = numVal(t); if (v == null) { dropLastUndo(); renderRight(); return } sh[k] = v; if (k === 'w') sh.w = Math.min(sh.w, S.machine.w); if (k === 'h') sh.h = Math.min(sh.h, S.machine.h); sh.x = clamp(sh.x, 0, Math.max(0, S.machine.w - sh.w)); sh.y = clamp(sh.y, 0, Math.max(0, S.machine.h - sh.h)) }
    changed(); return;
  }
  if (t.id === 'shMat') { const m = matById(t.value), sh = sheetAt(curPlate); if (!m) return; pushUndo(T('Материал листа', 'Sheet material')); sh.mat = m.id; sh.thick = m.thick; changed(); toast(T(`Материал: ${matLabel(m)}. Слои с параметрами «из материала» обновлены.`, `Material: ${matLabel(m)}. Layers using material values were updated.`) + (m.status === 'unverified' ? T(' Профиль не проверен на вашем станке.', ' The profile is not verified on your machine.') : '')); return }
  if (t.id === 'shPreset' && t.value !== '') { const sh = sheetAt(curPlate); pushUndo(T('Формат листа', 'Sheet format')); if (t.value === 'bed') { sh.x = 0; sh.y = 0; sh.w = S.machine.w; sh.h = S.machine.h } else { const p = SHEET_PRESETS[+t.value]; sh.w = Math.min(p[1], S.machine.w); sh.h = Math.min(p[2], S.machine.h); sh.x = clamp(sh.x, 0, S.machine.w - sh.w); sh.y = clamp(sh.y, 0, S.machine.h - sh.h) } changed(); return }
  if (d.img) { const s = selShapes()[0]; if (!s || !s.img) return; const k = d.img; pushUndo(T('Параметры фото', 'Photo settings'), 'img' + k + s.id); s.img[k] = t.type === 'checkbox' ? t.checked : t.tagName === 'SELECT' ? t.value : (numVal(t) ?? s.img[k]); changed(); return }
  if (d.crop) { const s = selShapes()[0]; if (!s || !s.img) return; pushUndo(T('Обрезка фото', 'Crop photo'), 'crop' + s.id); s.img.crop = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, s.img.crop); s.img.crop[d.crop] = clamp((numVal(t) || 0) / 100, 0, .45); changed(); return }
  if (t.id === 'ovChk') { pushUndo(T('Свои параметры объекта', 'Object override')); for (const s of selShapes()) { if (t.checked) { const r = resolveLaser(S.layers[s.layer], sheetAt(plateOf(s))); s.ov = s.ov || { power: r.power, speed: r.speed, passes: r.passes } } else delete s.ov } changed(); return }
  if (d.ov) { const v = numVal(t); if (v == null) return; pushUndo(T('Свои параметры объекта', 'Object override'), 'ov' + d.ov); for (const s of selShapes()) if (s.ov) s.ov[d.ov] = d.ov === 'power' ? clamp(v, 0, 100) : d.ov === 'passes' ? clamp(Math.round(v), 1, 50) : d.ov === 'interval' ? clamp(v, .02, 2) : Math.max(1, v); changed(); return }
  if (d.k && camSel != null) {
    const L = S.layers[camSel];
    if (d.k === 'type') { pushUndo(T('Тип процесса', 'Process type')); L.type = t.value; changed(); return }
    const [g, k] = d.k.split('.'); const v = t.tagName === 'SELECT' ? t.value : numVal(t); if (v == null) { renderRight(); return }
    pushUndo(T('Параметр операции', 'Operation setting'), 'k' + camSel + d.k);
    if (g === 'cnc' && k === 'zMode' && v === 'custom') { const cur = Object.assign({}, CNC_Z_DEF, Z_PRESETS[resolveCnc(L, sheetAt(curPlate)).zMode || 'std'] || {}); for (const q of Object.keys(CNC_Z_DEF)) if (q !== 'zMode') L.cnc[q] = cur[q] }
    L[g][k] = v;
    if (g === 'cnc' && k === 'toolId') { const tl = toolById(v); if (tl.type === 'v' && !['vcarve', 'chamfer', 'engrave'].includes(L.cnc.op)) toast(T('Выбрана V-фреза: подходит для V-резьбы, фаски и гравировки.', 'A V-bit is selected: use it for V-carve, chamfer or engraving.')) }
    changed(); return;
  }
  if ((d.ko || d.kc) && camSel != null) { const L = S.layers[camSel], v = numVal(t); if (v == null) { renderRight(); return } pushUndo(T('Своё значение операции', 'Own operation value'), 'ko' + camSel + (d.ko || d.kc)); if (d.ko) { L.laser[d.ko] = v; L.ovr = Object.assign({}, L.ovr, { [d.ko]: true }) } else { L.cnc[d.kc] = v; L.ovrC = Object.assign({}, L.ovrC, { [d.kc]: true }) } changed(); return }
  if (d.kb && camSel != null) { const [g, k] = d.kb.split('.'); pushUndo(T('Параметр операции', 'Operation setting')); S.layers[camSel][g][k] = t.checked; changed(); return }
  if (t.id === 'layerName' && camSel != null) { pushUndo(T('Название операции', 'Operation name')); S.layers[camSel].name = t.value.trim(); changed(); return }
  if (t.id === 'camPlate') { setPlate(+t.value); return }
  if (t.id === 'rapChk') { P.rapids = t.checked; draw(); return } if (t.id === 'ghostChk') { P.ghost = t.checked; draw(); return } if (t.id === 'dirsChk') { P.dirs = t.checked; draw(); return } if (t.id === 'followChk') { P.follow = t.checked; return }
  if (d.chk) { MC.checks[d.chk] = t.checked; return }
  if (d.mcopt) { MCOPT[d.mcopt] = t.checked; if (d.mcopt === 'auto' && t.checked) autoConnect(); return }
  if (d.mcf) { const v = numVal(t); if (v != null) { MC.fire[d.mcf] = v; if (d.mcf === 'power') store.set('mcFirePower', String(v)) } return }
  if (d.mcp) { const v = numVal(t); if (v != null) MC.probe[d.mcp] = v; return }
  if (d.gpopt) { GP.cfg[d.gpopt] = t.type === 'checkbox' ? t.checked : +t.value; gpSave(); return }
  if (t.id === 'fovR') { setFeedOverride(+t.value); return }
  if (t.id === 'mType') { readSettings(); const base = MACHINES.find(x => x.type === t.value); draftM = Object.assign(deepCopy(base), { name: draftM.name, w: draftM.w, h: draftM.h, id: draftM.id }); renderSettings(); return }
  if (t.id === 'npMat') { NP.mat = t.value; NP.thick = matById(t.value).thick; readNP(); NP.thick = matById(t.value).thick; renderNewProject(); return }
  if (t.id === 'mWasm') { store.set('noWasm', t.checked ? '0' : '1'); toast(T('Изменение вступит в силу после перезапуска программы.', 'The change takes effect after restarting the app.')); return }
  if (d.hk && GS) { hkSet(d.hk, t); return }
  if (d.mj && GS) { const [i, k] = d.mj.split(':'), j = (GS.o.mj || [])[+i], v = numVal(t); if (!j || v == null) return; j[k] = v; mjRefresh(); return }
  if (d.gf && GS) { const f = GS.g.fields.find(f => f.k === d.gf); if (!f) return; GS.o[f.k] = f.t === 'chk' ? t.checked : f.t === 'num' ? (numVal(t) ?? GS.o[f.k]) : t.value; if (f.preset && GS.g.presets && GS.g.presets[t.value]) Object.assign(GS.o, GS.g.presets[t.value]); if (f.apply) Object.assign(GS.o, f.apply(t.value) || {}); if (f.t === 'chk' || f.t === 'sel' || f.preset) renderGenSide(); genRegen(); return }
  if (d.sl) { slSet(d.sl, t.type === 'checkbox' ? t.checked : t.value); return }
  if (d.tr && TR) { const k = d.tr; TR[k] = t.type === 'checkbox' ? t.checked : t.tagName === 'SELECT' ? +t.value : (numVal(t) ?? TR[k]); if (k === 'multiLayer') renderTraceSide(); traceRun(); return }
  if (d.rl && RL) { const k = d.rl, r = RL.rel; if (t.type === 'checkbox') r[k] = t.checked; else if (t.tagName === 'SELECT') r[k] = t.value; else { const v = numVal(t); if (v == null) return; if (k === 'w') { r.h = fx(r.h * v / r.w, 1) } if (k === 'h') { r.w = fx(r.w * v / r.h, 1) } r[k] = v } if (k === 'w' || k === 'h') renderReliefSide(); reliefPreview(); return }
  if (d.mf || d.mp || d.mc || d.mt) { matEditInput(t); return }
  if (EX && /^ex/.test(t.id)) { const m = { exName: () => EX.name = safeFileName(t.value) || EX.name, exPost: () => { EX.post = t.value; const p = postById(t.value); if (p && p.ext && EX.ext !== 'custom') EX.ext = p.ext; if (S.post !== t.value) { pushUndo(T('Выбор постпроцессора', 'Choose postprocessor')); S.post = t.value; changed() } }, exUnits: () => EX.units = t.value, exExt: () => EX.ext = t.value, exCustomExt: () => EX.customExt = t.value, exEnc: () => EX.ascii = t.value === 'ascii', exStamp: () => { EX.stamp = t.checked; S.job.stamp = t.checked; scheduleSave() }, exReport: () => EX.report = t.checked, exPkg: () => EX.pkg = t.checked }[t.id]; if (m) { m(); if (t.id !== 'exName') renderExport(); else computeExport() } return }
}
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'pbSlider') { P.t = P.total * (+t.value / 1000); P.playing = false; updatePbTime(); syncLine(); draw(); return }
  if (t.id === 'fovR') { const v = $('#fovV'); if (v) v.textContent = t.value + '%'; return }
  if (t.id === 'objQ') { objQ = t.value; buildObjList(); return }
  if (t.id === 'gcQ') { const n = gcSearch(t.value.trim()); const h = $('#gcHits'); if (h) h.textContent = t.value.trim() ? n : ''; return }
  if (t.type === 'range') { const lab = t.closest('label') && t.closest('label').querySelector('span b'); if (lab) lab.textContent = t.dataset.crop ? t.value + '%' : (t.dataset.k === 'laser.speed' ? t.value + ' ' + MMIN() : t.dataset.k === 'laser.power' ? t.value + '%' : t.value) }
  if (t.dataset.tr && TR && t.type === 'range') { TR[t.dataset.tr] = +t.value; traceRun() }
  if (t.dataset.rl && RL && t.type === 'range') { RL.rel[t.dataset.rl] = +t.value; reliefPreview() }
});
document.addEventListener('focusin', e => { const h = e.target.closest && e.target.closest('[data-help]'); if (h) showTip(h) });
document.addEventListener('focusout', hideTip);
document.addEventListener('mouseover', e => { const h = e.target.closest && e.target.closest('[data-help]'); clearTimeout(tipT); if (h) tipT = setTimeout(() => showTip(h), 350); else hideTip() });

/* ---------------- files ---------------- */
const pickFile = (id, fn) => { $(id).onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) { try { await fn(f) } catch (err) { logError('file', err); toast(T('Не удалось открыть файл: ', 'Could not open the file: ') + (err.message || err), 'err') } } } };
pickFile('#fileAny', f => importFile(f));
pickFile('#fileProj', f => importFile(f));
pickFile('#fileImg', async f => { const im = await fileToImage(f), act = pendingImgAction; pendingImgAction = null; if (act === 'relief') openRelief(im); else imageChooser(im) });
pickFile('#fileGenImg', async f => { if (!GS) return; const im = await fileToImage(f); GS.o.imgAsset = imageToAsset(im).id; renderGenSide(); genRegen() });
pickFile('#file3d', f => slLoadFile(f));
pickFile('#fileGc', async f => { const text = await f.text(); loadGcode(text, f.name); P.report = validateGcode(text, currentPost(), S.machine, {}); P.job = null; P.t = 0; P.playing = false; fitPlate(0); refresh(); toast(T(`Открыт ${f.name}: ${P.lines.length} строк. Файл проверен по профилю «${postLabel(currentPost())}».`, `Opened ${f.name}: ${P.lines.length} lines, checked against “${postLabel(currentPost())}”.`)) });
pickFile('#fileFont', async f => { const fam = await addUserFont(f); toast(T(`Шрифт «${fam}» загружен и сохранён в вашей библиотеке шрифтов.`, `Font “${fam}” loaded and kept in your font library.`)); if (FP) { FP.sel = fam; FP.filter = 'user'; $$('#fpFilter button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === 'user')); fpBuild() } });
pickFile('#fileMat', async f => { const n = importMaterials(await f.text()); renderMatList(); toast(T(`Импортировано материалов: ${n}. Их статус — «не проверено» или «пользовательский».`, `Imported ${n} materials. Their status is “unverified” or “user”.`)) });

/* drag-and-drop anywhere (spec 7.1) */
let dragDepth = 0;
document.addEventListener('dragenter', e => { if (![...(e.dataTransfer?.types || [])].includes('Files')) return; e.preventDefault(); dragDepth++; $('#drop').hidden = false });
document.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } });
document.addEventListener('dragleave', e => { if (--dragDepth <= 0) { dragDepth = 0; $('#drop').hidden = true } });
document.addEventListener('drop', async e => {
  const files = [...(e.dataTransfer?.files || [])]; dragDepth = 0; $('#drop').hidden = true; if (!files.length) return; e.preventDefault();
  if (GS && files[0] && RASTER_EXT.test(files[0].name) && GS.g.fields.some(f => f.t === 'img')) { const im = await fileToImage(files[0]); GS.o.imgAsset = imageToAsset(im).id; renderGenSide(); genRegen(); return }
  if (!$('#modal').hidden && !SL.viewer) closeModal();
  for (const f of files.slice(0, 8)) await importFile(f);
});
/* paste: our own objects, a picture copied in a browser or elsewhere, SVG */
document.addEventListener('paste', async e => {
  if (!$('#modal').hidden || inField()) return;
  const cd = e.clipboardData; if (!cd) return; e.preventDefault();
  const items = [...(cd.items || [])], img = items.find(i => i.kind === 'file' && /^image\//.test(i.type));
  const data = { file: img ? img.getAsFile() : null, text: cd.getData('text/plain'), html: cd.getData('text/html') };
  if (!data.file && !data.text && !data.html && DESK && DESK.readClipboard) { pasteCommand(); return }
  if (!(await pasteSystem(data))) toast(T('В буфере обмена нет объектов, картинки или SVG.', 'The clipboard has no objects, picture or SVG.'));
});

document.addEventListener('keydown', e => { try { onKeyDown(e) } catch (err) { logError('key', err) } });
document.addEventListener('keyup', e => { if (e.code === 'Space') { spaceDown = false; cv.style.cursor = '' } });
$('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') e.target._down = true });
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && e.target._down) closeModal(); e.target._down = false });
new ResizeObserver(() => { resize(); if (tab === 'machine') { MV.fitted = MV.fitted && true; drawMachineCanvas() } if (GS && GS.view === '2d') genDraw(); if (NS) nestDraw(); if (TR) traceDraw() }).observe($('#stage'));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { prevCache.clear(); draw() });
window.addEventListener('error', e => logError('window', e.error || e.message));
window.addEventListener('unhandledrejection', e => logError('promise', e.reason));
window.addEventListener('beforeunload', () => { clearTimeout(saveT); try { saveLocal() } catch (e) { } });

/* ---------------- playback / demo loop ---------------- */
let lastTs = 0;
function tick(ts) {
  const dt = lastTs ? Math.min(.1, (ts - lastTs) / 1000) : 0; lastTs = ts;
  if (P.playing && tab === 'gcode') { P.t = Math.min(P.total, P.t + dt * P.rate); if (P.t >= P.total) { P.playing = false; renderChrome() } updatePbTime(); syncLine(); draw() }
  if (MC.job.run && !MC.job.pause && MC.mode === 'demo') {
    const j = MC.job; j.t = Math.min(P.total, j.t + dt * MC.demoRate * MC.feedOv / 100); const i = idxAt(j.t); j.line = i >= 0 && P.moves[i] ? P.moves[i].l : 0;
    MC.pos = posAt(j.t); if (j.t >= P.total) { j.run = false; mlog('rx', T('Задание выполнено', 'Job complete') + ' — ' + fmtTime(P.total)); toast(T('Задание выполнено', 'Job complete')); renderRight(); renderChrome() }
    if (tab === 'machine') updateMachineLive();
  }
  if (typeof gpPoll === 'function' && (GP.idx >= 0 || GP.learning) ) gpPoll(ts);
  requestAnimationFrame(tick);
}

/* ---------------- boot ---------------- */
async function loadSample() {
  const st = blankState(MACHINES[0]); S = st; S.name = T('Пример', 'Sample');
  const sh = S.sheets[0], X = sh.x, Y = sh.y;
  addShape(S, 0, 'rect', [rectPts(X + 20, Y + 20, 120, 80, 8)], true, { nm: T('Табличка', 'Sign') });
  addShape(S, 0, 'ellipse', [ellipsePts(X + 30, Y + 90, 3, 3)], true, { nm: T('Отверстие', 'Hole') });
  addShape(S, 0, 'ellipse', [ellipsePts(X + 130, Y + 90, 3, 3)], true, { nm: T('Отверстие', 'Hole') });
  addShape(S, 0, 'star', [starPts(X + 220, Y + 60, 40, 18, 5)], true, { nm: T('Звезда', 'Star') });
  const tp = await makeTextPaths({ text: 'SkyKerf', font: 'unb', size: 14 }); if (tp.length) { const b = bboxOf(tp); addShape(S, 1, 'text', mapPaths(tp, (x, y) => [x + X + 80 - (b[2] - b[0]) / 2, y + Y + 52]), true, Object.assign({ rot: 0 }, textSpec({ text: 'SkyKerf', font: 'unb', size: 14 }))) }
}
(async function boot() {
  const th = store.get('theme'); if (th === 'light' || th === 'dark') document.documentElement.dataset.theme = th;
  if (!['cad', 'cam', 'gcode', 'machine'].includes(tab)) tab = 'cad'; if (mode !== 'simple' && mode !== 'pro') mode = 'pro';
  let restored = false, recovery = null;
  if (DESK && DESK.recovery) { try { recovery = await DESK.recovery() } catch (e) { } }
  const saved = store.get('project');
  if (saved) { try { const r = parseProject(saved); S = r.state; restored = true; migratedFrom = r.migratedFrom; if (r.migratedFrom) dirty = true } catch (e) { logError('restore', e) } }
  // no saved project: an empty sheet (the sample opens from the menu); the very first launch asks three questions
  if (!S) { S = blankState(MACHINES[0]); dirty = false; if (!store.get('welcomed')) setTimeout(() => { if ($('#modal').hidden) openWelcome() }, 300) }
  REVMAX = Math.max(REVMAX, S.rev | 0);
  document.body.classList.toggle('simple', mode === 'simple');
  resize(); refresh(); fitPlate(0); draw();
  if (document.fonts) document.fonts.ready.then(() => draw());
  MC.state = 'demo'; mlog('rx', `${APP_NAME} ${APP_VERSION} · ` + T('демо-станок готов', 'demo machine ready'));
  if (MCOPT.auto) setTimeout(() => autoConnect(T('при запуске', 'on start')), 1200);
  requestAnimationFrame(tick);
  if (recovery && recovery.data && recovery.data === saved) { toast(T('Программа была закрыта аварийно — последняя версия проекта восстановлена.', 'The app did not close properly — the latest version of the project was restored.')); recovery = null }
  if (recovery && recovery.data) {
    const ok = await confirmBox(T('Восстановить работу?', 'Recover your work?'), T(`Похоже, программа в прошлый раз закрылась аварийно. Найдено автосохранение от ${new Date(recovery.time).toLocaleString(lang)}. Открыть его? Текущий проект можно будет вернуть через Ctrl+Z.`, `It looks like the app did not close properly last time. An autosave from ${new Date(recovery.time).toLocaleString(lang)} was found. Open it? Ctrl+Z brings back the current project.`), [{ label: T('Восстановить', 'Recover'), value: true, primary: true }, { label: T('Не нужно', 'No thanks'), value: false }]);
    if (ok) await openProjectText(recovery.data, T('восстановленный проект', 'recovered project'), recovery.path || null);
  }
  if (DESK) {
    if (DESK.pendingFile) DESK.pendingFile().then(f => f && openDesktopFile(f)).catch(() => { });
    if (DESK.onOpenFile) DESK.onOpenFile(openDesktopFile);
  }
  if (restored && migratedFrom) toast(T('Проект из прошлой версии открыт и преобразован. Старые данные сохранены.', 'The project from the previous version was opened and converted. The old data is kept.'));
})();
async function openDesktopFile(f) {
  if (!f) return;
  if (/\.(kerf|skykerf|json)$/i.test(f.name)) { await openProjectText(f.data, f.name, f.path); return }
  if (/\.(nc|gcode|gc|ngc|tap)$/i.test(f.name)) { loadGcode(f.data, f.name); P.report = validateGcode(f.data, currentPost(), S.machine, {}); P.job = null; P.t = 0; switchTab('gcode'); refresh(); return }
  if (/\.(svg|dxf)$/i.test(f.name)) { if (/\.dxf$/i.test(f.name)) importDXF(f.data); else importSVG(f.data); switchTab('cad') }
}
