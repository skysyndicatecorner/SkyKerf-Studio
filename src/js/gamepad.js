'use strict';
/* ============================================================================
   SkyKerf_Studio · gamepad control of the machine (Gamepad API)
   Works with Xbox, PlayStation, Switch Pro and generic USB/Bluetooth pads.
   Every button can be re-assigned by pressing it ("learn"), so pads without the
   standard layout work too. Safety: the pad acts only on the Machine tab while
   the window has focus; starting a job needs the button held for a moment;
   the emergency stop is always on its own button.
   ============================================================================ */
const GP_ACTIONS = () => [
  // id, label, kind: press | hold (needs holding) | axis
  ['jogX', T('Плавно X (стик)', 'Smooth X (stick)'), 'axis'], ['jogY', T('Плавно Y (стик)', 'Smooth Y (stick)'), 'axis'], ['jogZ', T('Плавно Z (стик)', 'Smooth Z (stick)'), 'axis'],
  ['stepXp', T('Шаг X+', 'Step X+'), 'press'], ['stepXm', T('Шаг X−', 'Step X−'), 'press'], ['stepYp', T('Шаг Y+', 'Step Y+'), 'press'], ['stepYm', T('Шаг Y−', 'Step Y−'), 'press'],
  ['stepZp', T('Шаг Z+ (вверх)', 'Step Z+ (up)'), 'press'], ['stepZm', T('Шаг Z− (вниз)', 'Step Z− (down)'), 'press'],
  ['stepDown', T('Шаг меньше', 'Smaller step'), 'press'], ['stepUp', T('Шаг больше', 'Larger step'), 'press'],
  ['startAll', T('Старт всего задания (удерживать)', 'Start the whole job (hold)'), 'hold'], ['startCut', T('Резка: только слои резки (удерживать)', 'Cut: cutting layers only (hold)'), 'hold'], ['startEngrave', T('Гравировка: только слои гравировки (удерживать)', 'Engrave: engraving layers only (hold)'), 'hold'],
  ['pause', T('Пауза / продолжить', 'Pause / resume'), 'press'], ['stop', T('Стоп (позиция сохраняется)', 'Stop (keeps position)'), 'press'], ['estop', T('Аварийная остановка', 'Emergency stop'), 'press'],
  ['frame', T('Обвести рамку задания', 'Trace the job frame'), 'press'], ['home', T('Поиск нуля ($H)', 'Home ($H)'), 'hold'], ['zeroXY', T('Ноль XY здесь', 'Set XY zero here'), 'hold'], ['zeroZ', T('Ноль Z здесь', 'Set Z zero here'), 'hold'],
  ['fire', T('Тест луча / шпиндель вкл-выкл', 'Test fire / spindle on-off'), 'press'], ['unlock', T('Разблокировать ($X)', 'Unlock ($X)'), 'press'],
];
const GP_DEFAULT = { jogX: 'a0', jogY: 'a1-', jogZ: 'a3-', stepXp: 'b15', stepXm: 'b14', stepYp: 'b12', stepYm: 'b13', stepZp: 'b5', stepZm: 'b4', stepDown: 'b6', stepUp: 'b7', startAll: 'b9', startCut: 'b2', startEngrave: 'b3', pause: 'b0', stop: 'b1', estop: 'b16', frame: 'b8', home: '', zeroXY: 'b10', zeroZ: '', fire: 'b11', unlock: '' };
const GP = { cfg: null, idx: -1, id: '', prev: [], held: {}, learning: null, jogT: 0, jogging: false, lastPoll: 0, steps: [.1, 1, 10, 50] };
(function gpLoad() { let c = {}; try { c = JSON.parse(store.get('gamepad') || '{}') } catch (e) { } GP.cfg = Object.assign({ enabled: true, dead: .18, speed: 3000, zspeed: 600, hold: .8, map: {} }, c); GP.cfg.map = Object.assign({}, GP_DEFAULT, c.map || {}) })();
function gpSave() { store.set('gamepad', JSON.stringify(GP.cfg)) }
function gpResetMap() { GP.cfg.map = Object.assign({}, GP_DEFAULT); gpSave(); openGamepadSettings() }
const GP_NAMES_X = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', '↑', '↓', '←', '→', 'Home'];
const GP_NAMES_PS = ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', '↑', '↓', '←', '→', 'PS'];
const GP_NAMES_NS = ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'L3', 'R3', '↑', '↓', '←', '→', 'Home'];
function gpNames() { const id = GP.id || ''; return /054c|playstation|dualshock|dualsense|wireless controller/i.test(id) ? GP_NAMES_PS : /057e|nintendo|pro controller/i.test(id) ? GP_NAMES_NS : GP_NAMES_X }
function gpBindName(b) {
  if (!b) return '—'; const n = gpNames();
  if (b[0] === 'b') { const i = +b.slice(1); return n[i] || T('кнопка ', 'button ') + i }
  const i = parseInt(b.slice(1)), inv = b.endsWith('-'); return (['LX', 'LY', 'RX', 'RY'][i] || T('ось ', 'axis ') + i) + (inv ? '↕' : '');
}
function gpPad() { const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : []; let p = pads.find(x => x.index === GP.idx) || pads[0] || null; if (p) { GP.idx = p.index; GP.id = p.id } return p }
function gpPressed(p, b) { if (!b || b[0] !== 'b') return false; const x = p.buttons[+b.slice(1)]; return !!x && (x.pressed || x.value > .5) }
function gpAxis(p, b) { if (!b || b[0] !== 'a') return 0; let v = p.axes[parseInt(b.slice(1))] || 0; if (b.endsWith('-')) v = -v; const dz = GP.cfg.dead; return Math.abs(v) < dz ? 0 : Math.sign(v) * (Math.abs(v) - dz) / (1 - dz) }
if (typeof window !== 'undefined') {
  window.addEventListener('gamepadconnected', e => { GP.idx = e.gamepad.index; GP.id = e.gamepad.id; toast(T('Геймпад подключён: ', 'Gamepad connected: ') + e.gamepad.id.replace(/\(.*?\)/g, '').trim()); renderMachineDock() });
  window.addEventListener('gamepaddisconnected', e => { if (e.gamepad.index === GP.idx) { GP.idx = -1; gpJogStop(); toast(T('Геймпад отключён.', 'Gamepad disconnected.')); renderMachineDock() } });
}
/* learning: the next pressed button / moved axis becomes the binding */
function gpLearn(action) { GP.learning = action; const el = $(`[data-gpl="${action}"]`); if (el) el.textContent = T('нажмите кнопку…', 'press a button…') }
function gpPoll(ts) {
  const p = gpPad(); if (!p) return;
  const btn = p.buttons.map(b => b.pressed || b.value > .5);
  if (GP.learning) {
    const bi = btn.findIndex((v, i) => v && !GP.prev[i]); let bind = bi >= 0 ? 'b' + bi : null;
    if (!bind) { const ai = p.axes.findIndex(v => Math.abs(v) > .7); if (ai >= 0) bind = 'a' + ai + (p.axes[ai] < 0 ? '-' : '') }
    if (bind) { GP.cfg.map[GP.learning] = bind; GP.learning = null; gpSave(); if ($('#gpTbl')) openGamepadSettings() }
    GP.prev = btn; return;
  }
  gpIndicator(p, btn);
  const active = GP.cfg.enabled && tab === 'machine' && document.hasFocus() && $('#modal').hidden;
  if (!active) { if (GP.jogging) gpJogStop(); GP.prev = btn; return }
  const map = GP.cfg.map, down = b => b && b[0] === 'b' && btn[+b.slice(1)], edge = b => down(b) && !GP.prev[+b.slice(1)];
  // emergency stop first, also Back + Start together
  if (edge(map.estop) || (btn[8] && btn[9] && !(GP.prev[8] && GP.prev[9]))) { emergencyStop(); GP.prev = btn; return }
  for (const [id, , kind] of GP_ACTIONS()) {
    if (kind === 'axis' || id === 'estop') continue; const b = map[id]; if (!b) continue;
    if (kind === 'press' && edge(b)) gpDo(id);
    if (kind === 'hold') {
      if (down(b)) { const h = GP.held[id] || (GP.held[id] = { t0: ts, done: false }); if (!h.done && ts - h.t0 > GP.cfg.hold * 1000) { h.done = true; gpDo(id) } }
      else delete GP.held[id];
    }
  }
  // smooth jogging with the sticks
  const vx = gpAxis(p, map.jogX), vy = gpAxis(p, map.jogY), vz = gpAxis(p, map.jogZ);
  if (vx || vy || vz) gpJog(vx, vy, vz, ts); else if (GP.jogging) gpJogStop();
  GP.prev = btn;
}
function gpDo(id) {
  const steps = GP.steps, si = steps.indexOf(MC.step);
  switch (id) {
    case 'stepXp': jog('X', MC.step); break; case 'stepXm': jog('X', -MC.step); break; case 'stepYp': jog('Y', MC.step); break; case 'stepYm': jog('Y', -MC.step); break;
    case 'stepZp': jog('Z', Math.min(MC.step, 10)); break; case 'stepZm': jog('Z', -Math.min(MC.step, 10)); break;
    case 'stepDown': MC.step = steps[Math.max(0, si - 1)] ?? 1; toast(T('Шаг: ', 'Step: ') + MC.step + ' ' + MM()); renderMachineDock(); break;
    case 'stepUp': MC.step = steps[Math.min(steps.length - 1, si + 1)] ?? 1; toast(T('Шаг: ', 'Step: ') + MC.step + ' ' + MM()); renderMachineDock(); break;
    case 'startAll': if (MC.job.run && MC.job.pause) jobStart(); else if (!MC.job.run) { ensurePreview(true); jobStart({ label: T('всё задание', 'whole job') }) } break;
    case 'startCut': if (!MC.job.run) jobStart(isLaser() ? { only: ['cut'], label: T('резка', 'cutting') } : { label: T('фрезеровка', 'milling') }); break;
    case 'startEngrave': if (!MC.job.run) { if (isLaser()) jobStart({ only: ['vector', 'fill', 'raster', 'mark'], label: T('гравировка', 'engraving') }); else toast(T('Для фрезера эта кнопка не используется.', 'Not used for a router.')) } break;
    case 'pause': if (MC.job.run) MC.job.pause ? jobStart() : jobPause(); break;
    case 'stop': jobStop(); break;
    case 'frame': frameJob(); break;
    case 'home': sendCmd('$H'); break;
    case 'zeroXY': sendCmd('G10 L20 P1 X0 Y0'); MC.zero[0] = MC.pos[0]; MC.zero[1] = MC.pos[1]; toast(T('Ноль XY установлен', 'XY zero set')); updateMachineLive(); break;
    case 'zeroZ': sendCmd('G10 L20 P1 Z0'); MC.zero[2] = MC.pos[2]; toast(T('Ноль Z установлен', 'Z zero set')); updateMachineLive(); break;
    case 'fire': isLaser() ? testFire() : toggleSpindle(); break;
    case 'unlock': MC.lastErr = null; sendCmd('$X'); break;
  }
}
/* continuous jog: short $J moves every ~100 ms; releasing the stick cancels the queue (0x85) */
function gpJog(vx, vy, vz, ts) {
  if (MC.job.run && !MC.job.pause) return; if (MC.state === 'alarm') return;
  if (ts - GP.jogT < 100) return; GP.jogT = ts; GP.jogging = true;
  const dt = .12, F = GP.cfg.speed, FZ = GP.cfg.zspeed;
  if (vx || vy) { const mag = Math.min(1, Math.hypot(vx, vy)), f = Math.max(30, F * mag * mag); const d = f / 60 * dt; const ux = vx / (Math.hypot(vx, vy) || 1), uy = vy / (Math.hypot(vx, vy) || 1); sendCmd(`$J=G91 G21 X${fx(ux * d, 3)} Y${fx(uy * d, 3)} F${Math.round(f)}`) }
  else if (vz) { const f = Math.max(20, FZ * Math.abs(vz)), d = f / 60 * dt * Math.sign(vz); sendCmd(`$J=G91 G21 Z${fx(d, 3)} F${Math.round(f)}`) }
}
function gpJogStop() { if (!GP.jogging) return; GP.jogging = false; rt(0x85) }
function gpIndicator(p, btn) {
  const el = $('#gpInd'); if (el) { el.hidden = false; const on = btn.map((v, i) => v ? gpNames()[i] || i : null).filter(v => v != null); const ax = p.axes.slice(0, 4).map(v => Math.abs(v) > GP.cfg.dead ? 1 : 0).some(Boolean); el.innerHTML = `${ic('gamepad', 14)} ${on.map(n => `<span class="gpkey on">${esc(String(n))}</span>`).join('') || (ax ? `<span class="gpkey on">${T('стик', 'stick')}</span>` : `<span class="note">${T('готов', 'ready')}</span>`)}${Object.keys(GP.held).length ? ` <span class="note">${T('удерживайте…', 'hold…')}</span>` : ''}` }
  const svg = $('#gpSvg'); if (svg) for (const b of svg.querySelectorAll('[data-b]')) b.classList.toggle('on', !!btn[+b.dataset.b]);
}
function gpCardHtml() {
  const p = typeof navigator !== 'undefined' && navigator.getGamepads ? gpPad() : null, n = gpNames(), m = GP.cfg.map;
  if (!p) return `<p class="note">${T('Подключите геймпад (Xbox, PlayStation, Switch или любой USB/Bluetooth) и нажмите на нём любую кнопку.', 'Connect a gamepad (Xbox, PlayStation, Switch or any USB/Bluetooth pad) and press any button on it.')}</p><label class="chk sm"><input type="checkbox" data-gpopt="enabled" ${GP.cfg.enabled ? 'checked' : ''}> ${T('Управление геймпадом', 'Gamepad control')}</label>`;
  const k = id => `<span class="gpkey">${esc(gpBindName(m[id]))}</span>`;
  return `<div class="note" title="${esc(p.id)}">${esc(p.id.replace(/\(.*?\)/g, '').trim().slice(0, 40))}${p.mapping === 'standard' ? '' : ' · ' + T('нестандартная раскладка — назначьте кнопки', 'non-standard layout — assign the buttons')}</div>
   <svg class="gpsvg" id="gpSvg" viewBox="0 0 160 80"><path class="body" d="M30 18h100c14 0 22 12 26 30s-2 30-14 30c-10 0-14-10-22-16H40c-8 6-12 16-22 16C6 78 0 66 4 48S16 18 30 18z"/>
    <rect class="b" data-b="4" x="24" y="10" width="22" height="7" rx="3"/><rect class="b" data-b="5" x="114" y="10" width="22" height="7" rx="3"/>
    <rect class="b" data-b="12" x="31" y="30" width="7" height="8"/><rect class="b" data-b="13" x="31" y="45" width="7" height="8"/><rect class="b" data-b="14" x="23" y="38" width="8" height="7"/><rect class="b" data-b="15" x="38" y="38" width="8" height="7"/>
    <circle class="b" data-b="3" cx="124" cy="31" r="5"/><circle class="b" data-b="0" cx="124" cy="51" r="5"/><circle class="b" data-b="2" cx="114" cy="41" r="5"/><circle class="b" data-b="1" cx="134" cy="41" r="5"/>
    <rect class="b" data-b="8" x="66" y="34" width="9" height="5" rx="2"/><rect class="b" data-b="9" x="86" y="34" width="9" height="5" rx="2"/><circle class="b" data-b="16" cx="80" cy="48" r="4"/>
    <circle class="b" data-b="10" cx="58" cy="58" r="7"/><circle class="b" data-b="11" cx="102" cy="58" r="7"/>
    <text x="124" y="33">${esc(n[3])}</text><text x="124" y="53">${esc(n[0])}</text><text x="114" y="43">${esc(n[2])}</text><text x="134" y="43">${esc(n[1])}</text></svg>
   <div class="gpmap">${k('pause')}<span>${T('пауза', 'pause')}</span>${k('stop')}<span>${T('стоп', 'stop')}</span>${k('startCut')}<span>${T('резка (удерж.)', 'cut (hold)')}</span>${k('startEngrave')}<span>${T('гравировка (удерж.)', 'engrave (hold)')}</span>${k('estop')}<span><b>${T('аварийная остановка', 'emergency stop')}</b></span></div>
   <label class="chk sm"><input type="checkbox" data-gpopt="enabled" ${GP.cfg.enabled ? 'checked' : ''}> ${T('Управление геймпадом', 'Gamepad control')}</label>`;
}
function openGamepadSettings() {
  const m = GP.cfg.map;
  openModal(`${ic('gamepad', 18)} ${T('Геймпад: назначение кнопок', 'Gamepad: button mapping')}`, `
   <p class="note">${T('Нажмите «Назначить», затем нужную кнопку или стик на геймпаде. Геймпад работает только на вкладке «Станок», когда окно программы активно. Запуск задания — только удержанием кнопки. Назад + Старт вместе — всегда аварийная остановка.', 'Press “Assign”, then the button or stick on the pad. The pad works only on the Machine tab while the window is active. Jobs start only when the button is held. Back + Start together is always an emergency stop.')}</p>
   <table class="tbl" id="gpTbl"><thead><tr><th>${T('Действие', 'Action')}</th><th>${T('Кнопка', 'Button')}</th><th></th></tr></thead><tbody>
   ${GP_ACTIONS().map(([id, n, kind]) => `<tr><td>${n}</td><td><span class="gpkey" data-gpl="${id}">${esc(gpBindName(m[id]))}</span></td><td class="r"><button class="btn sm" data-act="gpLearn" data-v="${id}">${T('Назначить', 'Assign')}</button> <button class="mini" data-act="gpClear" data-v="${id}" title="${T('Убрать', 'Clear')}">✕</button></td></tr>`).join('')}</tbody></table>
   <div class="grid3">${numF(T('Мёртвая зона стика', 'Stick dead zone'), 'data-gpopt="dead" min="0.02" max="0.6"', GP.cfg.dead, '', .02)}${numF(T('Скорость XY', 'XY speed'), 'data-gpopt="speed" min="100"', GP.cfg.speed, MMIN(), 100)}${numF(T('Скорость Z', 'Z speed'), 'data-gpopt="zspeed" min="20"', GP.cfg.zspeed, MMIN(), 20)}${numF(T('Удержание для старта', 'Hold to start'), 'data-gpopt="hold" min="0.3" max="3"', GP.cfg.hold, T('с', 's'), .1)}</div>`,
    `<button class="btn" data-act="gpReset">${T('Как было по умолчанию', 'Restore defaults')}</button><button class="primary" data-act="closeModal">${T('Готово', 'Done')}</button>`, 'wide');
}
