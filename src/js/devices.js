'use strict';
/* ============================================================================
   SkyKerf_Studio · devices (spec 12)
   Web Serial connection to GRBL-family controllers, automatic connection to
   the last machine, read-only detection ($I, $$, ?), explained errors and
   alarms, safe streaming, soft stop that keeps the position, emergency stop.
   Nothing moves and no job starts without an explicit user action. A software
   stop never replaces the hardware emergency stop.
   ============================================================================ */
const MC = { mode: 'demo', connected: false, port: null, writer: null, reader: null, pos: [0, 0, 0], wco: [0, 0, 0], zero: [0, 0, 0], log: [], job: { run: false, pause: false, t: 0, line: 0, label: '' }, step: 10, feedOv: 100, demoRate: 20, checks: { a: false, b: false, c: false }, baud: +(store.get('mcBaud') || 115200), state: 'offline', info: null, poll: 0, lastRx: 0, portInfo: null, fire: { power: +(store.get('mcFirePower') || 3), time: .5, method: 'stroke' }, lastErr: null, autoTried: false, connecting: false, spindle: false, probe: { plate: 15, travel: 30, feed: 80 } };
const MCOPT = { get auto() { return store.get('mcAuto') !== '0' }, set auto(v) { store.set('mcAuto', v ? '1' : '0') }, get checks() { return store.get('mcChecks') !== '0' }, set checks(v) { store.set('mcChecks', v ? '1' : '0') }, get confirm() { return store.get('mcConfirm') !== '0' }, set confirm(v) { store.set('mcConfirm', v ? '1' : '0') } };
const USB_CHIPS = { '1a86:7523': 'CH340', '1a86:55d4': 'CH9102', '10c4:ea60': 'CP210x', '0403:6001': 'FTDI FT232', '0403:6015': 'FTDI FT231X', '2341:0043': 'Arduino Uno', '2341:0001': 'Arduino Uno', '2a03:0043': 'Arduino Uno', '303a:1001': 'ESP32-S3', '0483:5740': 'STM32 VCP', '1d50:6015': 'Smoothieboard' };
const STATE_NAME = s => ({ offline: T('нет связи', 'offline'), connecting: T('подключение…', 'connecting…'), idle: T('готов', 'ready'), run: T('работает', 'running'), hold: T('пауза', 'hold'), jog: T('перемещение', 'jogging'), alarm: T('авария (ALARM)', 'alarm'), door: T('открыта дверь', 'door open'), home: T('поиск нуля', 'homing'), check: T('проверка', 'check mode'), sleep: T('сон', 'sleep'), lost: T('связь потеряна', 'connection lost'), demo: T('демо', 'demo') })[s] || s;
const stateClass = s => ({ idle: 'ok', run: 'ok', demo: 'warn', hold: 'warn', jog: 'ok', alarm: 'bad', door: 'bad', lost: 'bad', offline: 'mut', connecting: 'warn', home: 'warn', check: 'warn', sleep: 'mut' })[s] || 'mut';

/* ---------------- GRBL errors and alarms, explained ----------------
   [what happened, what to do] for every code of GRBL 1.1 */
const GRBL_ERRORS = () => ({
  1: [T('Команда G-code без буквы.', 'G-code word without a letter.'), T('Проверьте строку: каждое число должно идти после буквы (X10, F1500).', 'Check the line: every number needs a letter in front (X10, F1500).')],
  2: [T('Неверное число в команде.', 'Bad number format.'), T('Лишние символы или пустое значение. Пересоздайте G-code.', 'Stray characters or a missing value. Regenerate the G-code.')],
  3: [T('Неизвестная системная команда «$».', 'Unknown “$” system command.'), T('Проверьте написание команды ($$, $H, $X, $J=…).', 'Check the command spelling ($$, $H, $X, $J=…).')],
  4: [T('Отрицательное значение там, где нужно положительное.', 'Negative value where a positive one is expected.'), T('Проверьте подачу, мощность и номер настройки.', 'Check feed, power and the setting number.')],
  5: [T('Поиск нуля выключен в настройках ($22=0).', 'Homing is disabled ($22=0).'), T('Включите поиск нуля ($22=1), если на станке есть концевики, или выставьте ноль вручную.', 'Enable homing ($22=1) if the machine has limit switches, or set zero by hand.')],
  6: [T('Слишком короткий импульс шага (<3 мкс).', 'Step pulse too short (<3 µs).'), T('Увеличьте $0.', 'Increase $0.')],
  7: [T('Ошибка чтения памяти настроек контроллера.', 'Controller settings memory read failed.'), T('Настройки сброшены к заводским. Проверьте $$ и введите свои значения заново.', 'Settings were restored to defaults. Check $$ and re-enter your values.')],
  8: [T('Команда «$» недоступна во время работы.', '“$” command not allowed while running.'), T('Дождитесь окончания задания или остановите его.', 'Wait for the job to finish or stop it.')],
  9: [T('Контроллер заблокирован (ALARM) — команды G-code не принимаются.', 'G-code locked out during ALARM.'), T('Выполните поиск нуля ($H) или разблокировку ($X), проверив станок.', 'Home ($H) or unlock ($X) after checking the machine.')],
  10: [T('Мягкие пределы требуют включённого поиска нуля.', 'Soft limits need homing enabled.'), T('Включите $22=1 перед $20=1.', 'Enable $22=1 before $20=1.')],
  11: [T('Строка слишком длинная (больше 80 символов).', 'Line too long (over 80 characters).'), T('Уменьшите точность координат или разбейте строку.', 'Reduce coordinate precision or split the line.')],
  12: [T('Скорость шагов превышает возможности контроллера.', 'Step rate exceeds the controller limit.'), T('Уменьшите $110–$112 или шаги на мм ($100–$102).', 'Lower $110–$112 or steps/mm ($100–$102).')],
  13: [T('Сработал датчик двери или крышки.', 'Safety door is open.'), T('Закройте крышку и продолжите.', 'Close the lid and resume.')],
  14: [T('Строка стартового блока слишком длинная.', 'Startup line too long.'), T('Сократите $N0/$N1.', 'Shorten $N0/$N1.')],
  15: [T('Перемещение выходит за пределы рабочего поля.', 'Jog target exceeds machine travel.'), T('Уменьшите шаг или проверьте ноль и размеры поля ($130–$132).', 'Use a smaller step or check zero and travel ($130–$132).')],
  16: [T('Неверная команда перемещения ($J=).', 'Invalid jog command.'), T('Команда должна содержать координату и подачу F.', 'The command needs a coordinate and a feed F.')],
  17: [T('Режим лазера требует ШИМ-выход.', 'Laser mode needs a PWM output.'), T('Прошивка собрана без ШИМ шпинделя — режим лазера ($32=1) недоступен.', 'The firmware has no spindle PWM — laser mode ($32=1) is unavailable.')],
  20: [T('Неподдерживаемая команда G-code.', 'Unsupported G-code command.'), T('Выберите постпроцессор под вашу прошивку или уберите команду.', 'Pick a postprocessor for your firmware or remove the command.')],
  21: [T('Две команды одной группы в строке.', 'Two commands of one modal group in a line.'), T('Разделите команды на разные строки.', 'Put the commands on separate lines.')],
  22: [T('Подача F не задана.', 'Feed rate not set.'), T('Добавьте F перед первым G1/G2/G3.', 'Add F before the first G1/G2/G3.')],
  23: [T('Нужно целое число.', 'Integer value required.'), T('Номера инструментов, строк и т.п. должны быть целыми.', 'Tool and line numbers must be integers.')],
  24: [T('Две команды с осями в одной строке.', 'Two axis commands in one line.'), T('Разделите их на разные строки.', 'Put them on separate lines.')],
  25: [T('Повтор буквы в строке.', 'Repeated word in a line.'), T('Уберите дублирующуюся букву.', 'Remove the duplicated word.')],
  26: [T('Нет координат для команды движения.', 'No axis words for a motion command.'), T('Добавьте X/Y/Z.', 'Add X/Y/Z.')],
  27: [T('Неверный номер строки N.', 'Invalid line number.'), T('Номер строки должен быть от 1 до 9999999.', 'Line numbers are 1…9999999.')],
  28: [T('Не хватает значения в команде.', 'Missing value in a command.'), T('Проверьте параметры команды (P, L, R).', 'Check the command parameters (P, L, R).')],
  29: [T('Системы координат G59.x не поддерживаются.', 'G59.x work systems unsupported.'), T('Используйте G54–G59.', 'Use G54–G59.')],
  30: [T('G53 работает только с G0 и G1.', 'G53 needs G0 or G1.'), T('Добавьте G0 или G1.', 'Add G0 or G1.')],
  31: [T('Лишние координаты в команде.', 'Unused axis words.'), T('Уберите координаты из команды, которой они не нужны.', 'Remove axis words from a command that does not use them.')],
  32: [T('Дуга G2/G3 без координат плоскости.', 'G2/G3 arc without plane axes.'), T('Проверьте выбранную плоскость (G17).', 'Check the active plane (G17).')],
  33: [T('Цель движения недопустима.', 'Invalid motion target.'), T('Дуга или щуп с нулевой длиной — пересоздайте G-code.', 'Zero-length arc or probe — regenerate the G-code.')],
  34: [T('Ошибка геометрии дуги (радиус).', 'Arc radius error.'), T('Пересоздайте G-code или включите разбиение дуг на отрезки.', 'Regenerate the G-code or split arcs into segments.')],
  35: [T('Дуга без смещения центра I/J.', 'Arc without I/J offset.'), T('Пересоздайте G-code.', 'Regenerate the G-code.')],
  36: [T('Лишние буквы в строке.', 'Unused words in a line.'), T('Уберите неподдерживаемые буквы.', 'Remove unsupported words.')],
  37: [T('Коррекция длины инструмента по оси, отличной от Z.', 'Tool length offset not on Z.'), T('Используйте G43.1 только по Z.', 'Use G43.1 on Z only.')],
  38: [T('Номер инструмента больше допустимого.', 'Tool number too large.'), T('Укажите T0–T255.', 'Use T0–T255.')],
});
const GRBL_ALARMS = () => ({
  1: [T('Сработал концевик (жёсткий предел).', 'Hard limit triggered.'), T('Головка дошла до концевика — позиция потеряна. Отведите её вручную, нажмите «Разблокировать» и выполните поиск нуля. Проверьте размеры задания и ноль.', 'The head hit a limit switch — position lost. Move it away, unlock and home. Check the job size and zero.')],
  2: [T('Задание выходит за рабочее поле (мягкий предел).', 'Soft limit: target outside the work area.'), T('Проверьте ноль и положение задания на столе. Позиция сохранена — нажмите «Разблокировать».', 'Check zero and the job placement. Position is kept — press Unlock.')],
  3: [T('Сброс во время движения.', 'Reset while in motion.'), T('Позиция могла сбиться. Нажмите «Разблокировать» ($X) и при необходимости выполните поиск нуля. Обычная кнопка «Стоп» больше не вызывает эту ошибку — она сначала останавливает движение.', 'Position may be lost. Press Unlock ($X) and home if needed. The regular Stop button no longer causes this — it stops the motion first.')],
  4: [T('Щуп уже касается до начала замера.', 'Probe already triggered before the cycle.'), T('Поднимите фрезу над пластиной щупа и повторите.', 'Lift the bit above the touch plate and retry.')],
  5: [T('Щуп не коснулся пластины за отведённый ход.', 'Probe did not touch within the travel.'), T('Опустите фрезу ближе или увеличьте ход щупа. Проверьте провод щупа.', 'Lower the bit or increase the probe travel. Check the probe wire.')],
  6: [T('Сброс во время поиска нуля.', 'Reset during homing.'), T('Повторите поиск нуля.', 'Run homing again.')],
  7: [T('Открыта дверь во время поиска нуля.', 'Door opened during homing.'), T('Закройте крышку и повторите поиск нуля.', 'Close the lid and home again.')],
  8: [T('При поиске нуля концевик не отпустился.', 'Homing: switch did not clear on pull-off.'), T('Увеличьте отскок $27 или проверьте концевик.', 'Increase pull-off $27 or check the switch.')],
  9: [T('Концевик не найден при поиске нуля.', 'Homing: limit switch not found.'), T('Проверьте концевики, проводку и размеры хода ($130–$132).', 'Check switches, wiring and travel ($130–$132).')],
  10: [T('Концевик не найден на втором этапе поиска нуля.', 'Homing: switch not found in the second pass.'), T('Проверьте концевик и скорость поиска ($24/$25).', 'Check the switch and homing rates ($24/$25).')],
});
function explainLine(l) {
  let m;
  if ((m = /^error:(\d+)/i.exec(l))) { const e = GRBL_ERRORS()[+m[1]]; return { kind: 'error', code: +m[1], what: e ? e[0] : T('Неизвестная ошибка контроллера.', 'Unknown controller error.'), fix: e ? e[1] : T('Посмотрите описание кода в документации прошивки.', 'Look the code up in the firmware documentation.') } }
  if ((m = /^ALARM:(\d+)/i.exec(l))) { const e = GRBL_ALARMS()[+m[1]]; return { kind: 'alarm', code: +m[1], what: e ? e[0] : T('Неизвестная авария.', 'Unknown alarm.'), fix: e ? e[1] : T('Проверьте станок и нажмите «Разблокировать».', 'Check the machine and press Unlock.') } }
  if (/\[MSG:.*(Reset to continue|Check Door|Check Limits)/i.test(l)) return { kind: 'msg', code: 0, what: l.replace(/^\[MSG:|\]$/g, ''), fix: T('Нажмите «Разблокировать» после проверки станка.', 'Press Unlock after checking the machine.') };
  return null;
}
function showProblem(p, line) {
  MC.lastErr = Object.assign({ line, at: Date.now() }, p);
  mlog('er', `${p.kind === 'alarm' ? 'ALARM' : 'error'}${p.code ? ':' + p.code : ''} — ${p.what} ${p.fix}`);
  toast(`${p.kind === 'alarm' ? T('Авария', 'Alarm') : T('Ошибка', 'Error')} ${p.code || ''}: ${p.what} ${p.fix}`, 'err');
  renderMachineDock();
}

function mlog(k, t) { MC.log.push([k, t]); if (MC.log.length > 400) MC.log.shift(); const c = $('#mcCon'); if (c) { c.insertAdjacentHTML('beforeend', `<div class="${k}">${esc(t)}</div>`); c.scrollTop = c.scrollHeight } }
function setState(s) { if (MC.state === s) return; const was = MC.state; MC.state = s; for (const el of document.querySelectorAll('.mcStatePill')) { el.className = 'pill mcStatePill ' + stateClass(s); el.textContent = STATE_NAME(s) } if (s === 'alarm' || was === 'alarm' || s === 'hold' || was === 'hold') renderMachineDock() }

/* ---------------- GRBL parsing ---------------- */
function parseStatus(l) {
  const m = /^<([A-Za-z]+)(?::(\d))?\|(.*)>$/.exec(l); if (!m) return null;
  const st = m[1].toLowerCase(), out = { state: st, sub: m[2] != null ? +m[2] : null };
  for (const part of m[3].split('|')) { const [k, v] = part.split(':'); if (!v) continue; const nums = v.split(',').map(Number); if (k === 'MPos') out.mpos = nums; else if (k === 'WPos') out.wpos = nums; else if (k === 'WCO') out.wco = nums; else if (k === 'FS' || k === 'F') out.fs = nums; else if (k === 'Ov') out.ov = nums; else if (k === 'Pn') out.pins = v }
  return out;
}
function handleStatus(p) {
  MC.sub = p.sub; setState(p.state === 'idle' ? 'idle' : p.state);
  if (p.wco) MC.wco = p.wco;
  if (p.mpos) MC.pos = p.mpos.slice(0, 3).concat([0, 0, 0]).slice(0, 3); else if (p.wpos) MC.pos = p.wpos.map((v, i) => v + (MC.wco[i] || 0)).slice(0, 3);
  if (p.fs) MC.fs = p.fs;
  updateMachineLive();
}
const info = () => MC.info || (MC.info = { ver: null, opt: null, settings: {}, raw: [] });
function handleLine(l) {
  MC.lastRx = Date.now();
  if (l.startsWith('<')) { const p = parseStatus(l); if (p) { handleStatus(p); return } }
  const pr = explainLine(l);
  if (pr) showProblem(pr, l); else mlog('rx', l);
  const I = info();
  let m;
  if ((m = /^\[VER:([^:\]]+)/.exec(l))) I.ver = m[1];
  else if ((m = /^\[OPT:([^\]]+)\]/.exec(l))) I.opt = m[1];
  else if ((m = /^\$(\d+)=([-\d.]+)/.exec(l))) I.settings[m[1]] = +m[2];
  else if (/^Grbl\s+([\d.a-z]+)/i.test(l)) { I.ver = I.ver || /^Grbl\s+([\d.a-z]+)/i.exec(l)[1]; MC.banner = Date.now() }
  if (/^ALARM/i.test(l)) setState('alarm');
}

/* ---------------- demo controller (answers like GRBL, marked as demo) ---------------- */
function demoAnswer(cmd) {
  const m = S.machine, u = cmd.toUpperCase(), out = [];
  if (u === '$I') out.push('[VER:1.1h.20190825:DEMO]', '[OPT:VZL,15,128]', 'ok');
  else if (u === '$$') { const lines = { 0: 10, 1: 25, 3: 0, 22: 1, 23: 3, 30: m.type === 'laser' ? m.smax : (m.rpmMax || m.rpm), 31: 0, 32: m.type === 'laser' ? 1 : 0, 110: m.rapid, 111: m.rapid, 112: 600, 120: m.accel || 500, 121: m.accel || 500, 122: 50, 130: m.w, 131: m.h, 132: m.type === 'laser' ? 0 : (m.zTravel || 50) }; for (const k in lines) out.push(`$${k}=${lines[k]}`); out.push('ok') }
  else if (u === '?') out.push(`<Idle|MPos:${MC.pos.map(v => v.toFixed(3)).join(',')}|FS:0,0>`);
  else if (/^\$H/.test(u)) { MC.pos = [0, 0, m.type === 'laser' ? 0 : m.safeZ]; out.push('ok') }
  else if (/^\$X/.test(u)) { setState('demo'); out.push('[MSG:Caution: Unlocked]', 'ok') }
  else if (/^G38\.2/.test(u)) { MC.pos[2] = MC.pos[2] - 5; out.push(`[PRB:${MC.pos.map(v => v.toFixed(3)).join(',')}:1]`, 'ok') }
  else if (/^G9[01]\b/.test(u) && !/[XYZ]/.test(u)) { MC.demoRel = /G91/.test(u); out.push('ok') }
  else if (/^G0?[0123]\b|^\$J=|^G91|^G90/.test(u) && /[XYZ]/.test(u)) { const rel = /^\$J=/.test(u) ? /G91/.test(u) : /G91/.test(u) || (MC.demoRel && !/G90/.test(u)), p = [...MC.pos]; ['X', 'Y', 'Z'].forEach((a, i) => { const r = new RegExp(a + '\\s*(-?[\\d.]+)').exec(u); if (r) p[i] = rel ? p[i] + (+r[1]) : (+r[1]) + MC.zero[i] }); p[0] = clamp(p[0], 0, m.w); p[1] = clamp(p[1], 0, m.h); MC.pos = p; out.push('ok') }
  else out.push('ok');
  return out;
}

/* ---------------- sending ---------------- */
let okWait = null;
const live = () => MC.mode === 'serial' && MC.connected;
async function sendCmd(cmd) {
  if (live()) { await serialWrite(cmd); return }
  mlog('tx', '> ' + cmd); const ans = demoAnswer(cmd);
  setTimeout(() => { for (const l of ans) handleLine(l); updateMachineLive() }, 40);
}
async function sendWait(cmd) { if (live()) return serialWrite(cmd, true); await sendCmd(cmd); await sleep(60); return 'ok' }
async function serialWrite(line, wait) { mlog('tx', '> ' + line); const p = wait ? new Promise(r => { okWait = r }) : null; await MC.writer.write(new TextEncoder().encode(line + '\n')); return p }
async function rt(byte) { if (live()) { try { await MC.writer.write(new Uint8Array([byte])) } catch (e) { logError('serial-rt', e) } } }

/* ---------------- connection ---------------- */
const BAUDS = [115200, 250000, 230400, 57600, 38400, 19200, 9600];
function savePortInfo(port) {
  const pi = port.getInfo ? port.getInfo() : {}; const vid = pi.usbVendorId != null ? pi.usbVendorId.toString(16).padStart(4, '0') : null, pid = pi.usbProductId != null ? pi.usbProductId.toString(16).padStart(4, '0') : null;
  MC.portInfo = vid ? { vid, pid, chip: USB_CHIPS[vid + ':' + pid] || null } : null;
  if (vid) { store.set('mcPort', JSON.stringify({ vid, pid })); if (DESK && DESK.preferSerial) DESK.preferSerial({ vid, pid }) }
}
async function openPort(port, baud) {
  await port.open({ baudRate: baud, bufferSize: 4096 });
  MC.port = port; MC.writer = port.writable.getWriter(); MC.connected = true; MC.info = null; MC.banner = 0; MC.lastRx = 0; MC.baud = baud;
  readLoop();
}
async function closePort() {
  clearInterval(MC.poll); MC.poll = 0;
  try { MC.reader && await MC.reader.cancel() } catch (e) { }
  try { MC.writer && MC.writer.releaseLock() } catch (e) { }
  try { MC.port && await MC.port.close() } catch (e) { }
  MC.connected = false; MC.reader = null; MC.writer = null;
}
/* does the controller answer at this speed? (GRBL prints a banner on reset and answers “?”) */
async function probeBaud() {
  const t0 = Date.now(); for (let i = 0; i < 6; i++) { await rt(0x3f); await sleep(250); if (MC.lastRx > t0) return true } return false;
}
async function serialConnect(knownPort, silent) {
  if (MC.connected) { await serialDisconnect(); return }
  if (!('serial' in navigator)) { if (!silent) toast(T('Этот браузер не поддерживает Web Serial. Используйте настольную версию SkyKerf_Studio или Chrome/Edge.', 'This browser has no Web Serial. Use the SkyKerf_Studio desktop app or Chrome/Edge.'), 'err'); return }
  if (MC.connecting) return; MC.connecting = true;
  try {
    MC.mode = 'serial'; setState('connecting'); renderMachineDock();
    const port = knownPort || await navigator.serial.requestPort();
    savePortInfo(port);
    const order = [MC.baud].concat(BAUDS.filter(b => b !== MC.baud));
    let okBaud = null;
    for (const b of order) {
      try { await openPort(port, b) } catch (e) { if (e && e.name === 'InvalidStateError') { await closePort(); await openPort(port, b) } else throw e }
      mlog('rx', T('Порт открыт', 'Port open') + ` @${b}` + (MC.portInfo ? ` · USB ${MC.portInfo.vid}:${MC.portInfo.pid}${MC.portInfo.chip ? ' (' + MC.portInfo.chip + ')' : ''}` : ''));
      if (await probeBaud()) { okBaud = b; break }
      mlog('er', T(`Нет ответа на скорости ${b}.`, `No answer at ${b} baud.`)); await closePort();
      if (silent && b !== order[0]) break; // background auto-connect tries only the remembered speed and one more
    }
    if (!okBaud) { setState('offline'); MC.connecting = false; if (!silent) toast(T('Станок не отвечает ни на одной скорости. Проверьте питание контроллера, кабель и драйвер.', 'The machine does not answer at any baud rate. Check controller power, the cable and the driver.'), 'err'); renderMachineDock(); return }
    store.set('mcBaud', okBaud);
    MC.poll = setInterval(() => { if (MC.connected) { rt(0x3f); if (MC.lastRx && Date.now() - MC.lastRx > 4000 && MC.state !== 'lost' && !MC.resetting) { setState('lost'); mlog('er', T('Контроллер не отвечает больше 4 с.', 'The controller has not answered for over 4 s.')) } } }, 300);
    toast(T(`Станок подключён (${okBaud}). Задание само не запускается.`, `Machine connected (${okBaud}). Nothing starts by itself.`));
    MC.connecting = false; refresh(); setTimeout(() => detectDevice(true), 600);
  } catch (e) { MC.connecting = false; setState('offline'); if (e && e.name !== 'NotFoundError' && !silent) { toast(T('Нет доступа к порту: ', 'No port access: ') + (e.message || e.name), 'err'); mlog('er', String(e.message || e)) } renderMachineDock() }
}
async function serialDisconnect() {
  MC.job.run = false; await closePort(); setState('offline'); mlog('rx', T('Отключено', 'Disconnected')); refresh();
}
/* automatic connection: a port this app was allowed to use before, matched by its USB id */
async function autoConnect(reason) {
  if (!MCOPT.auto || MC.connected || MC.connecting || !('serial' in navigator)) return;
  let ports = []; try { ports = await navigator.serial.getPorts() } catch (e) { }
  let want = null; try { want = JSON.parse(store.get('mcPort') || 'null') } catch (e) { }
  if (!ports.length && want && DESK && DESK.preferSerial) { // desktop: the shell picks the remembered port without a dialog
    try { await DESK.preferSerial(Object.assign({ auto: true }, want)); const p = await navigator.serial.requestPort(); if (p) ports = [p] } catch (e) { }
  }
  if (!ports.length) return;
  const id = p => { const i = p.getInfo ? p.getInfo() : {}; return i.usbVendorId != null ? i.usbVendorId.toString(16).padStart(4, '0') + ':' + i.usbProductId.toString(16).padStart(4, '0') : '' };
  const port = (want && ports.find(p => id(p) === want.vid + ':' + want.pid)) || (ports.length === 1 ? ports[0] : null);
  if (!port) return;
  mlog('rx', T('Автоподключение к станку…', 'Auto-connecting to the machine…') + (reason ? ` (${reason})` : ''));
  await serialConnect(port, true);
}
if (typeof navigator !== 'undefined' && navigator.serial) {
  navigator.serial.addEventListener('connect', () => setTimeout(() => autoConnect(T('кабель подключён', 'cable plugged in')), 800));
  navigator.serial.addEventListener('disconnect', e => { if (MC.port && e.target === MC.port) { mlog('er', T('Кабель станка отключён.', 'The machine cable was unplugged.')); closePort().then(() => { setState('lost'); refresh() }) } });
}
async function readLoop() {
  const dec = new TextDecoder(); let buf = '';
  const port = MC.port;
  try {
    MC.reader = port.readable.getReader();
    while (true) {
      const { value, done } = await MC.reader.read(); if (done) break; buf += dec.decode(value); let i;
      while ((i = buf.search(/\r?\n/)) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + (buf[i] === '\r' ? 2 : 1)); if (!l) continue; handleLine(l); if ((/^ok/i.test(l) || /^error/i.test(l)) && okWait) { const f = okWait; okWait = null; f(l) } }
    }
  } catch (e) { if (MC.port === port) { mlog('er', String(e.message || e)); logError('serial', e) } }
  finally {
    try { MC.reader && MC.reader.releaseLock() } catch (e) { }
    if (MC.connected && MC.port === port) { setState('lost'); toast(T('Связь со станком потеряна. Проверьте кабель — программа переподключится сама, когда станок появится.', 'Lost the machine connection. Check the cable — the app reconnects when the machine is back.'), 'err'); MC.connected = false; clearInterval(MC.poll); refresh(); setTimeout(() => autoConnect(T('восстановление связи', 'restoring the link')), 2500) }
  }
}

/* ---------------- detection → draft profile (read-only commands) ---------------- */
async function detectDevice(quiet) {
  MC.info = null; mlog('rx', T('Чтение сведений о контроллере ($I, $$)…', 'Reading controller information ($I, $$)…'));
  if (live()) { await serialWrite('$I', true); await serialWrite('$$', true) } else { await sendCmd('$I'); await sendCmd('$$'); await sleep(200) }
  const I = info(); if (I.settings['32'] != null) MC.laserMode = I.settings['32'] === 1;
  if (quiet) { renderMachineDock(); if (MCOPT.auto && I.ver) mlog('rx', `GRBL ${I.ver} · ${T('режим лазера', 'laser mode')} ${MC.laserMode ? T('вкл', 'on') : T('выкл', 'off')}`); return }
  openDetected();
}
function draftFromInfo(I) {
  const s = I.settings || {}, m = S.machine, rd = {}, need = [];
  const field = (k, v, ok) => { rd[k] = v; if (!ok) need.push(k) };
  const laser = s['32'] === 1;
  field('type', laser ? 'laser' : (s['32'] === 0 ? 'cnc' : m.type), s['32'] != null);
  field('w', s['130'] > 0 ? s['130'] : m.w, s['130'] > 0); field('h', s['131'] > 0 ? s['131'] : m.h, s['131'] > 0);
  field('smax', s['30'] > 0 ? s['30'] : m.smax, s['30'] > 0);
  field('rapid', s['110'] > 0 ? Math.min(s['110'], s['111'] || s['110']) : m.rapid, s['110'] > 0);
  field('accel', s['120'] > 0 ? Math.min(s['120'], s['121'] || s['120']) : m.accel, s['120'] > 0);
  if (!laser) { field('zTravel', s['132'] > 0 ? s['132'] : m.zTravel, s['132'] > 0); field('rpmMax', s['30'] || m.rpmMax, s['30'] > 0) }
  else { field('watts', null, false); field('laserSource', m.laserSource || 'diode', false) }
  return { rd, need, ver: I.ver, opt: I.opt, homing: s['22'] === 1, laserMode: laser };
}
function openDetected() {
  const I = info(), d = draftFromInfo(I), demo = MC.mode === 'demo', rows = [
    ['type', T('Тип станка', 'Machine type'), d.rd.type === 'laser' ? T('лазер', 'laser') : T('фрезер', 'router'), 'select'],
    ['w', T('Рабочее поле X ($130)', 'Work area X ($130)'), d.rd.w, MM()], ['h', T('Рабочее поле Y ($131)', 'Work area Y ($131)'), d.rd.h, MM()],
    ['smax', T('Максимум S ($30)', 'Max S ($30)'), d.rd.smax, ''], ['rapid', T('Макс. скорость ($110/$111)', 'Max rate ($110/$111)'), d.rd.rapid, MMIN()], ['accel', T('Ускорение ($120/$121)', 'Acceleration ($120/$121)'), d.rd.accel, T('мм/с²', 'mm/s²')],
  ].concat(d.rd.type === 'laser' ? [['watts', T('Мощность лазера (оптическая)', 'Laser power (optical)'), '', T('Вт', 'W')], ['laserSource', T('Источник', 'Source'), d.rd.laserSource, 'select']] : [['zTravel', T('Ход Z ($132)', 'Z travel ($132)'), d.rd.zTravel, MM()]]);
  openModal(`${ic('device', 18)} ${T('Сведения о контроллере', 'Controller information')}`, `
   <div class="kv"><span>${T('Прошивка', 'Firmware')}</span><b>${esc(I.ver ? 'GRBL ' + I.ver : T('не определена', 'not detected'))}</b><span>${T('Опции', 'Options')}</span><b>${esc(I.opt || '—')}</b><span>${T('Порт', 'Port')}</span><b>${MC.portInfo ? `USB ${MC.portInfo.vid}:${MC.portInfo.pid}${MC.portInfo.chip ? ' · ' + MC.portInfo.chip : ''} · ${MC.baud}` : (demo ? T('демо-станок', 'demo machine') : '—')}</b><span>${T('Поиск нуля', 'Homing')}</span><b>${d.homing ? T('включён ($22=1)', 'enabled ($22=1)') : T('выключен', 'disabled')}</b></div>
   ${demo ? `<div class="postcard warn">${ic('warn', 14)}<div><b>${T('Это ответы демо-станка', 'These are demo-machine answers')}</b><small>${T('Подключите реальный станок по USB, чтобы считать его настройки.', 'Connect a real machine over USB to read its settings.')}</small></div></div>` : ''}
   <table class="tbl"><thead><tr><th>${T('Параметр', 'Field')}</th><th>${T('Значение', 'Value')}</th><th>${T('Источник', 'Source')}</th></tr></thead><tbody>
   ${rows.map(([k, n, v, u]) => `<tr><td>${n}</td><td>${k === 'type' ? `<select class="plain" data-dt="type"><option value="laser" ${d.rd.type === 'laser' ? 'selected' : ''}>${T('лазер', 'laser')}</option><option value="cnc" ${d.rd.type === 'cnc' ? 'selected' : ''}>${T('фрезер', 'router')}</option></select>` : k === 'laserSource' ? `<select class="plain" data-dt="laserSource">${['diode', 'co2', 'fiber'].map(x => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('')}</select>` : `<div class="inp"><input type="number" data-dt="${k}" value="${v ?? ''}" placeholder="?">${u ? `<em>${u}</em>` : ''}</div>`}</td><td>${d.need.includes(k) ? `<span class="pill warn">${T('подтвердите', 'confirm')}</span>` : `<span class="pill ok">${T('считано', 'read')}</span>`}</td></tr>`).join('')}</tbody></table>
   <p class="note">${T('Мощность источника, фокус и реальные размеры поля по протоколу GRBL не считываются — их нужно ввести и подтвердить. Ничего не будет записано в контроллер.', 'Source power, focus and the physical work area cannot be read over GRBL — enter and confirm them. Nothing is written to the controller.')}</p>`,
    `<button class="btn" data-act="closeModal">${T('Не применять', 'Do not apply')}</button><button class="primary" id="dtApply">${T('Создать профиль станка', 'Create machine profile')}</button>`);
  $('#dtApply').onclick = () => {
    const v = k => { const el = $(`[data-dt="${k}"]`); return el ? (el.tagName === 'SELECT' ? el.value : (el.value === '' ? null : +el.value)) : null };
    const base = MACHINES.find(x => x.type === v('type')) || MACHINES[0];
    const m = Object.assign(deepCopy(base), { id: uid('dev'), name: `${I.ver ? 'GRBL ' + I.ver : 'GRBL'} · ${fx(v('w') || base.w, 0)}×${fx(v('h') || base.h, 0)}${demo ? ' (demo)' : ''}`, type: v('type'), w: v('w') || base.w, h: v('h') || base.h, smax: v('smax') || base.smax, rapid: v('rapid') || base.rapid, maxFeed: v('rapid') || base.maxFeed, accel: v('accel') || base.accel, fw: 'grbl', fwVersion: I.ver || null, confirmed: !demo, readFields: Object.keys(d.rd).filter(k => !d.need.includes(k)), confirmedAt: new Date().toISOString() });
    if (m.type === 'laser') { m.watts = v('watts'); m.laserSource = v('laserSource') || 'diode'; m.post = 'grbl_laser' } else { m.zTravel = v('zTravel') || base.zTravel; m.rpmMax = v('smax') || base.rpmMax; m.post = 'grbl_cnc' }
    closeModal(); applyMachine(m, true);
    saveUserMachines(userMachines().concat([m]).slice(-30));
    toast(T('Профиль станка создан. Параметры, которые нельзя считать, отмечены как подтверждённые вами.', 'Machine profile created. Fields that cannot be read are marked as confirmed by you.'));
  };
}
function userMachines() { try { return JSON.parse(store.get('machines') || '[]') } catch (e) { return [] } }
function saveUserMachines(list) { store.set('machines', JSON.stringify(list)) }
async function deleteUserMachine(id) {
  const list = userMachines(), m = list.find(x => x.id === id); if (!m) return false;
  const ok = await confirmBox(T('Удалить профиль станка?', 'Delete the machine profile?'), T(`Профиль «${m.name}» будет удалён из списка. Проекты, где он использовался, сохраняют свою копию настроек.`, `“${m.name}” will be removed from the list. Projects that used it keep their own copy.`), [{ label: T('Удалить', 'Delete'), value: true, primary: true }, { label: T('Отмена', 'Cancel'), value: false }]);
  if (!ok) return false;
  saveUserMachines(list.filter(x => x.id !== id)); toast(T('Профиль удалён.', 'Profile deleted.')); return true;
}

/* ---------------- streaming ---------------- */
async function streamSerial() {
  const j = MC.job, lines = P.lines.map(l => l.replace(/;.*/, '').replace(/\(.*?\)/g, '').trim()).map((l, i) => [l, i]).filter(x => x[0]);
  for (const [l, i] of lines) {
    if (!j.run) break; while (j.pause && j.run) await sleep(150); if (!j.run) break;
    const r = await serialWrite(l, true); if (!j.run) break; j.line = i; const mv = P.moves.find(m => m.l >= i); if (mv) j.t = mv.t0; updateMachineLive();
    if (/^error/i.test(r)) { j.run = false; const p = explainLine(r); toast(T(`Строка ${i + 1}: «${l}». `, `Line ${i + 1}: “${l}”. `) + (p ? p.what + ' ' + p.fix : '') + T(' Задание остановлено.', ' Job stopped.'), 'err'); await softStop(true) }
  }
  if (j.run) { mlog('rx', T('Задание отправлено полностью', 'Job fully sent')); }
  j.run = false; renderMachineDock(); renderChrome();
}
/* «Before you start» as a small window when Run is pressed (not a card lost in the panel) */
function openStartChecks(opts) {
  const L = isLaser(), items = [['a', L ? T('Защитные очки под длину волны лазера', 'Laser-rated safety glasses on') : T('Заготовка надёжно закреплена', 'Stock is clamped')], ['b', L ? T('Вытяжка и обдув включены, огнетушитель рядом', 'Extraction and air assist on, extinguisher at hand') : T('Фреза затянута, ноль Z выставлен', 'Bit is tight, Z zero is set')], ['c', L ? T('Я остаюсь у станка до конца работы', 'I stay with the machine until it finishes') : T('Очки надеты, руки вне рабочей зоны', 'Glasses on, hands out of the work area')]];
  MC.pendingStart = opts || {};
  openModal(`${ic('warn', 18)} ${T('Перед запуском', 'Before you start')}`, `<div class="startchk">${items.map(([k, t]) => `<label class="chk big"><input type="checkbox" data-sck="${k}"> ${t}</label>`).join('')}</div><label class="chk sm"><input type="checkbox" id="sckNever"> ${T('Больше не спрашивать (вернуть можно в настройках станка)', 'Do not ask again (can be turned back on in machine settings)')}</label>`,
    `<button class="btn" data-act="closeModal">${T('Отмена', 'Cancel')}</button><button class="primary" data-act="sckGo">${ic('play', 15)} ${T('Запустить', 'Run')}</button>`, 'narrow');
}
function checksOk() { return !MCOPT.checks || (MC.checks.a && MC.checks.b && MC.checks.c) }
function jobStart(opts) {
  opts = opts || {};
  if (opts.only) { const r = jobForTypes(opts.only); if (!r) return }
  if (!P.moves.length) { toast(T('Нет задания: подготовьте G-code на вкладке CAD или CAM.', 'No job: prepare G-code on the CAD or CAM tab.')); return }
  const j = MC.job; if (j.run && (j.pause || MC.state === 'hold')) { j.pause = false; rt(0x7e); mlog('rx', T('Продолжение', 'Resumed')); refresh(); return }
  if (!checksOk()) { openStartChecks(opts); return } // a short checklist window, every job
  MC.checks = { a: false, b: false, c: false }; // used up: the next job asks again
  if (MC.mode === 'serial' && !MC.connected) { toast(T('Сначала подключите станок.', 'Connect the machine first.')); return }
  if (MC.state === 'alarm') { toast(T('Контроллер в состоянии ALARM. Нажмите «Разблокировать» ($X) или выполните поиск нуля, проверив станок.', 'The controller is in ALARM. Press Unlock ($X) or home after checking the machine.'), 'err'); return }
  const rep = P.report; if (rep && rep.errors && rep.errors.length) toast(T(`В коде ${rep.errors.length} ошибок проверки — убедитесь, что это допустимо.`, `The code has ${rep.errors.length} check errors — make sure this is acceptable.`), 'warn');
  j.run = true; j.pause = false; j.t = 0; j.line = 0; j.label = opts.label || ''; mlog('rx', T('Старт задания', 'Job started') + (j.label ? ` — ${j.label}` : '') + ` (${P.lines.length} ${T('строк', 'lines')})`); if (live()) streamSerial(); refresh();
}
/* build a job with only some layer types (gamepad “cut” / “engrave” buttons) */
function jobForTypes(types) {
  const r = buildForPlate(curPlate, { only: types });
  if (!r.job.ops.some(o => o.moves.length)) { toast(T('На этом листе нет слоёв такого типа.', 'There are no layers of this type on this sheet.')); return null }
  P.post = r.post; P.report = r.report; P.job = r.job; P.est = r.est; loadGcode(r.text, T('лист ', 'sheet ') + (curPlate + 1) + ' · ' + types.map(ltypeName).join(', '), false); P.rev = -1;
  return r;
}
function jobPause() { if (!MC.job.run) return; MC.job.pause = true; rt(0x21); mlog('rx', T('Пауза (feed hold)', 'Paused (feed hold)')); refresh() }
/* Stop: first a feed hold so the machine decelerates and keeps its position,
   then a reset that clears the queue. This does not cause ALARM 3 and keeps the connection. */
async function softStop(fromError) {
  const j = MC.job, wasRun = j.run; j.run = false; j.pause = false; if (okWait) { const f = okWait; okWait = null; f('stopped') }
  if (live()) {
    MC.resetting = true;
    await rt(0x21); // feed hold
    // reset only after the machine has fully stopped (Hold:0): a reset while still moving gives ALARM 3 and loses the position
    const t0 = Date.now(); let stopped = false, told = false;
    while (Date.now() - t0 < 30000 && live()) { await rt(0x3f); await sleep(120); if (MC.state === 'hold' && MC.sub === 0 || MC.state === 'idle' || MC.state === 'alarm') { stopped = true; break } if (!told && Date.now() - t0 > 1500) { told = true; toast(T('Станок плавно тормозит… Сброс будет после полной остановки.', 'The machine is decelerating… It will be reset once fully stopped.')) } }
    if (!stopped) { MC.resetting = false; mlog('er', T('Станок не остановился за 30 с. Если он ещё движется — нажмите аварийную остановку.', 'The machine did not stop within 30 s. If it is still moving, press the emergency stop.')); toast(T('Станок не подтвердил остановку. Если он движется — аварийная остановка!', 'The machine did not confirm the stop. If it is moving — emergency stop!'), 'err'); refresh(); return }
    await rt(0x18); await sleep(400); MC.resetting = false;
    await rt(0x3f);
  }
  mlog('rx', fromError ? T('Задание остановлено из-за ошибки. Станок подключён, позиция сохранена.', 'Job stopped because of an error. Still connected, position kept.') : T('Задание остановлено. Станок подключён, позиция сохранена.', 'Job stopped. Still connected, position kept.'));
  if (wasRun && !fromError) toast(T('Остановлено. Станок остаётся подключённым.', 'Stopped. The machine stays connected.'));
  refresh();
}
function jobStop() { softStop(false) }
/* Emergency stop: immediate reset of the controller — everything stops at once.
   Afterwards GRBL may report ALARM 3 and need an unlock. Use the hardware E-stop when in doubt. */
async function emergencyStop() {
  const j = MC.job; j.run = false; j.pause = false; if (okWait) { const f = okWait; okWait = null; f('stopped') }
  if (live()) { await rt(0x85); await rt(0x21); await rt(0x18) }
  MC.spindle = false; gpJogStop();
  mlog('er', T('АВАРИЙНАЯ ОСТАНОВКА. Проверьте станок; затем «Разблокировать» и при необходимости поиск нуля.', 'EMERGENCY STOP. Check the machine; then Unlock and home if needed.'));
  toast(T('Аварийная остановка выполнена. После проверки станка нажмите «Разблокировать».', 'Emergency stop done. After checking the machine press Unlock.'), 'err');
  refresh();
}
async function setFeedOverride(v) {
  const prev = MC.feedOv; MC.feedOv = v; if (!live()) return;
  await rt(0x90); let d = Math.round((v - 100) / 10); while (d > 0) { await rt(0x91); d-- } while (d < 0) { await rt(0x92); d++ } mlog('tx', `> feed override ${prev}% → ${v}%`);
}

/* ---------------- test fire, spindle, probe ---------------- */
async function confirmIf(title, text, label) { if (!MCOPT.confirm) return true; return confirmBox(title, text, [{ label, value: true, primary: true }, { label: T('Отмена', 'Cancel'), value: false }]) }
function machineBusy() { if (MC.job.run && !MC.job.pause) { toast(T('Во время задания это недоступно.', 'Not available while a job runs.')); return true } if (MC.state === 'alarm') { toast(T('Контроллер в состоянии ALARM — сначала «Разблокировать» ($X).', 'The controller is in ALARM — press Unlock ($X) first.'), 'warn'); return true } if (MC.mode === 'serial' && !MC.connected) { toast(T('Станок не подключён.', 'The machine is not connected.')); return true } return false }
/* In GRBL laser mode ($32=1) a plain M3 does not light the beam — it only fires during G1 motion.
   “Stroke” fires while the head moves 0.2 mm back and forth (works everywhere);
   “Dot” switches laser mode off for the test and back on ($32 is written to the controller). */
async function testFire() {
  if (machineBusy()) return;
  const f = MC.fire, pct = clamp(+f.power || 1, .1, 100), t = clamp(+f.time || .5, .05, 10), S_ = Math.max(1, Math.round(S.machine.smax * pct / 100));
  if (pct > 20) { const ok = await confirmBox(T('Высокая мощность теста', 'High test power'), T(`Тест на ${pct}% может прожечь материал или отразиться от металла. Продолжить?`, `A ${pct}% test may burn through or reflect off metal. Continue?`), [{ label: T('Продолжить', 'Continue'), value: true, primary: true }, { label: T('Отмена', 'Cancel'), value: false }]); if (!ok) return }
  else if (!(await confirmIf(T('Тест луча', 'Test fire'), T(`Лазер включится на ${pct}% примерно на ${t} с. Наденьте защитные очки под длину волны лазера.`, `The laser fires at ${pct}% for about ${t} s. Wear laser safety glasses.`), T('Включить', 'Fire')))) return;
  const laserMode = MC.laserMode !== false && (info().settings['32'] == null ? true : info().settings['32'] === 1);
  mlog('rx', T(`Тест луча: ${pct}% (S${S_}), ${t} с, способ «${f.method === 'dot' ? 'точка' : 'штрих'}»`, `Test fire: ${pct}% (S${S_}), ${t} s, “${f.method}” method`));
  try {
    if (f.method === 'dot' && laserMode) {
      await sendWait('$32=0'); await sendWait(`M3 S${S_}`); await sendWait(`G4 P${fx(t, 2)}`); await sendWait('M5'); await sendWait('$32=1');
    } else if (f.method === 'dot') { await sendWait(`M3 S${S_}`); await sendWait(`G4 P${fx(t, 2)}`); await sendWait('M5') }
    else {
      const d = .2, feed = Math.max(1, Math.round(d * 2 / t * 60));
      await sendWait('G91 G21'); await sendWait(`M3 S${S_}`); await sendWait(`G1 X${d} F${feed}`); await sendWait(`G1 X-${d} F${feed}`); await sendWait('M5 S0'); await sendWait('G90');
    }
  } catch (e) { await rt(0x18); logError('fire', e) }
}
async function toggleSpindle() {
  if (machineBusy()) return;
  if (MC.spindle) { await sendCmd('M5'); MC.spindle = false; renderMachineDock(); return }
  if (!(await confirmIf(T('Шпиндель', 'Spindle'), T('Шпиндель запустится. Остановить — этой же кнопкой, «Стоп» или аварийной остановкой.', 'The spindle will start. Stop it with this button, Stop or Emergency stop.'), T('Запустить', 'Start')))) return;
  await sendCmd(`M3 S${S.machine.rpm || 10000}`); MC.spindle = true; renderMachineDock();
}
/* Z probe with a touch plate: G38.2 down until contact, set Z to the plate thickness, lift */
async function probeZ() {
  if (machineBusy()) return;
  const p = MC.probe;
  if (!(await confirmIf(T('Щуп Z', 'Z probe'), T(`Положите пластину щупа (${p.plate} мм) под фрезу и подключите зажим. Фреза опустится максимум на ${p.travel} мм со скоростью ${p.feed} мм/мин.`, `Place the touch plate (${p.plate} mm) under the bit and attach the clip. The bit lowers up to ${p.travel} mm at ${p.feed} mm/min.`), T('Начать', 'Start')))) return;
  mlog('rx', T('Щуп Z…', 'Z probe…'));
  const r = await sendWait(`G38.2 Z-${fx(p.travel, 2)} F${fx(p.feed, 0)}`);
  if (/^error/i.test(String(r))) return;
  await sendWait(`G10 L20 P1 Z${fx(p.plate, 3)}`); MC.zero[2] = MC.pos[2] - p.plate; await sendWait('G91 G0 Z5'); await sendWait('G90');
  toast(T('Ноль Z выставлен по пластине щупа. Уберите пластину.', 'Z zero set from the touch plate. Remove the plate.'));
}
async function frameJob() {
  if (!P.stats) return; if (machineBusy()) return; const b = P.stats.b, pts = [[b[0], b[1]], [b[3], b[1]], [b[3], b[4]], [b[0], b[4]], [b[0], b[1]]];
  if (!(await confirmIf(T('Обвести рамку задания', 'Trace the job frame'), T('Головка обойдёт габарит задания на холостом ходу (луч/шпиндель выключены). Убедитесь, что путь свободен.', 'The head traces the job outline with the beam/spindle off. Make sure the path is clear.'), T('Обвести', 'Trace')))) return;
  mlog('rx', T('Обвод рамки задания', 'Tracing the job frame')); await sendCmd('G90 G21'); for (const p of pts) await sendCmd(`G0 X${fx(p[0], 2)} Y${fx(p[1], 2)}`);
}
function jog(ax, dist, feed) {
  if (MC.job.run && !MC.job.pause) { toast(T('Во время задания перемещение недоступно.', 'Jogging is disabled while a job runs.')); return }
  if (MC.state === 'alarm') { toast(T('Контроллер в состоянии ALARM — сначала «Разблокировать» ($X) или поиск нуля ($H).', 'The controller is in ALARM — Unlock ($X) or home ($H) first.'), 'warn'); return }
  sendCmd(`$J=G91 G21 ${ax}${fx(dist, 3)} F${feed || (ax === 'Z' ? 600 : 3000)}`);
}

/* ============================== MACHINE TAB ==============================
   A large view of the bed (pan with the mouse, zoom with the wheel) and a bottom
   dock with every control. The dock can be resized and collapsed. */
const MV = { s: 1, ox: 0, oy: 0, fitted: false, follow: false, drag: null };
function renderMachineView() {
  const el = $('#mach'); if (!el) return;
  if (!$('#mcv')) {
    el.innerHTML = `<div class="mview"><canvas id="mcv"></canvas>
      <div class="float mvbar"><button class="icon-btn" data-act="mvFit" title="${T('Весь стол', 'Fit the bed')}">${ic('fit')}</button><button class="icon-btn" data-act="mvZoom" data-v="-1" title="${T('Отдалить', 'Zoom out')}">${ic('zout')}</button><button class="icon-btn" data-act="mvZoom" data-v="1" title="${T('Приблизить', 'Zoom in')}">${ic('zin')}</button><button class="icon-btn" data-act="mvFollow" id="mvFollow" title="${T('Следить за головкой', 'Follow the head')}">${ic('framing')}</button></div>
      <div class="float mvinfo" id="mvInfo"></div>
      <button class="estop" data-act="estop" title="${T('Аварийная остановка: мгновенный сброс контроллера (Ctrl+Пробел)', 'Emergency stop: instant controller reset (Ctrl+Space)')}"><b>${T('СТОП', 'STOP')}</b><small>${T('аварийная', 'emergency')}</small></button>
      <div class="float gpind" id="gpInd" hidden></div></div>
     <div class="dock" id="mdock"></div>`;
    bindMachineCanvas();
  }
  renderMachineDock(); requestAnimationFrame(drawMachineCanvas);
}
function dockCard(id, title, body, extra = '', cls = '') { return `<section class="dcard ${cls}" data-card="${id}"><h4>${title}<span class="sp"></span>${extra}</h4>${body}</section>` }
function renderMachineDock() {
  const d = $('#mdock'); if (!d) return;
  const L = isLaser(), m = S.machine, dev = MC.mode === 'serial', j = MC.job, w = MC.pos.map((v, i) => v - MC.zero[i]), st = !dev ? 'demo' : MC.state, prog = P.total ? j.t / P.total : 0, collapsed = store.get('mcDock') === 'min';
  d.classList.toggle('min', collapsed);
  const err = MC.lastErr && Date.now() - MC.lastErr.at < 10 * 60e3 ? MC.lastErr : null;
  const conn = dockCard('conn', T('Связь', 'Connection'), `<div class="seg full"><button data-act="mcMode" data-v="demo" aria-pressed="${!dev}">${T('Пробный', 'Demo')}</button><button data-act="mcMode" data-v="serial" aria-pressed="${dev}">USB</button></div>
     ${dev ? `<button class="btn block ${MC.connected ? '' : 'acc'}" data-act="mcConnect" ${MC.connecting ? 'disabled' : ''}>${ic('link', 15)} ${MC.connected ? T('Отключить', 'Disconnect') : MC.connecting ? T('Подключение…', 'Connecting…') : T('Подключить', 'Connect')}</button>
     <div class="kv sm"><span>${T('Порт', 'Port')}</span><b>${MC.portInfo ? `${esc(MC.portInfo.chip || 'USB')} · ${MC.baud}` : '—'}</b><span>GRBL</span><b>${esc((MC.info && MC.info.ver) || '—')}</b></div>` : `<button class="primary block" data-act="mcPlug">${ic('link', 15)} ${T('Подключить станок (USB)', 'Connect the machine (USB)')}</button><p class="note">${T('Сейчас пробный режим: станок не нужен, движения только на экране.', 'Practice mode now: no machine needed, the moves are shown on screen only.')}</p>`}
     <label class="chk sm"><input type="checkbox" data-mcopt="auto" ${MCOPT.auto ? 'checked' : ''}> ${T('Подключаться автоматически', 'Connect automatically')}</label>
     <div class="row2"><button class="btn sm" data-act="mDetect" ${dev && !MC.connected ? 'disabled' : ''}>${ic('device', 14)} ${T('Сведения', 'Info')}</button><button class="btn sm" data-act="settings">${ic('cog', 14)} ${T('Станок', 'Machine')}</button></div>`, `<span class="pill mcStatePill ${stateClass(st)}">${STATE_NAME(st)}</span>`);
  const errCard = err ? dockCard('err', `${ic('warn', 14)} ${err.kind === 'alarm' ? T('Авария', 'Alarm') : T('Ошибка', 'Error')} ${err.code || ''}`, `<p class="errwhat">${esc(err.what)}</p><p class="note">${esc(err.fix)}</p><div class="row2"><button class="btn sm acc" data-act="mUnlock">${T('Разблокировать', 'Unlock')}</button><button class="btn sm" data-act="mHome">${ic('home', 13)} ${T('Ноль ($H)', 'Home ($H)')}</button></div><button class="mini" data-act="mcErrHide" title="${T('Скрыть', 'Hide')}">✕</button>`, '', 'bad') : '';
  const pos = dockCard('pos', T('Положение', 'Position'), `<div class="dro">${['X', 'Y', 'Z'].map((a, i) => `<div class="ax"><b>${a}</b><span id="dro${a}">${w[i].toFixed(3)}</span><button class="mini" data-act="zeroAx" data-v="${i}" title="${T('Ноль', 'Zero')} ${a}">0</button></div>`).join('')}</div>
     <div class="row2"><button class="btn sm" data-act="mZeroXY">${T('Ноль XY', 'Zero XY')}</button><button class="btn sm" data-act="mGoZero">${T('В ноль', 'Go to 0')}</button></div>`);
  const jogc = dockCard('jog', T('Перемещение', 'Jog'), `<div class="jogwrap"><div class="jog"><span></span><button data-act="jog" data-v="Y+">Y+</button><span></span><span></span><button data-act="jog" data-v="Z+">Z+</button>
     <button data-act="jog" data-v="X-">X−</button><button class="home" data-act="mHome" title="${T('Поиск нуля', 'Home')} ($H)">${ic('home', 18)}</button><button data-act="jog" data-v="X+">X+</button><span></span><span></span>
     <span></span><button data-act="jog" data-v="Y-">Y−</button><span></span><span></span><button data-act="jog" data-v="Z-">Z−</button></div>
     <div class="seg vert">${[.1, 1, 10, 50].map(s => `<button data-act="jogStep" data-v="${s}" aria-pressed="${MC.step === s}">${s}</button>`).join('')}</div></div>
     <button class="btn sm block" data-act="mUnlock">${T('Разблокировать ($X)', 'Unlock ($X)')}</button>`);
  const job = dockCard('job', T('Задание', 'Job'), `<div class="kv sm"><span>${T('Файл', 'File')}</span><b>${esc(P.file || T('лист ', 'sheet ') + (curPlate + 1))}</b><span>${T('Время', 'Time')}</span><b><span id="jobEl">${fmtTime(j.t)}</span> / ${P.stats ? fmtTime(P.stats.time) : '—'}</b><span>${T('Строка', 'Line')}</span><b id="jobLn">${j.line + 1} / ${P.lines.length}</b></div>
     <div class="prog"><i id="jobBar" style="width:${(prog * 100).toFixed(1)}%"></i></div>
     <div class="grid3"><button class="btn acc" data-act="jobStart" ${P.moves.length ? '' : 'disabled'}>${ic('play', 13)} ${j.run && (j.pause || MC.state === 'hold') ? T('Дальше', 'Resume') : T('Старт', 'Start')}</button><button class="btn" data-act="jobPause" ${j.run && !j.pause ? '' : 'disabled'}>${ic('pause', 13)} ${T('Пауза', 'Pause')}</button><button class="btn" data-act="jobStop" ${j.run ? '' : 'disabled'}>${ic('stop', 13)} ${T('Стоп', 'Stop')}</button></div>
     ${j.run && !j.pause && MC.state === 'hold' ? `<div class="warnline">${ic('info', 13)} ${T('Программа ждёт (M0): смените головку или выполните указание из кода, затем «Дальше».', 'The program waits (M0): change the head or do what the code says, then Resume.')}</div>` : ''}
     <label class="fld sm"><span>${T('Подача', 'Feed')}: <b id="fovV">${MC.feedOv}%</b></span><input type="range" id="fovR" min="10" max="200" step="10" value="${MC.feedOv}"></label>
     ${MC.mode === 'demo' ? `<div class="seg full">${[1, 5, 20, 60].map(r => `<button data-act="demoRate" data-v="${r}" aria-pressed="${MC.demoRate === r}">${r}×</button>`).join('')}</div>` : ''}
     <button class="btn sm block" data-act="mFrame" ${P.moves.length ? '' : 'disabled'}>${ic('framing', 14)} ${T('Обвести рамку', 'Trace frame')}</button>`, `<span class="pill ${j.run ? (j.pause ? 'warn' : 'ok') : 'mut'}">${j.run ? (j.pause ? T('пауза', 'paused') : T('идёт', 'running')) : T('готово', 'ready')}</span>`);
  const checks = MCOPT.checks ? dockCard('checks', T('Перед запуском', 'Before you start'), [['a', L ? T('Защитные очки под длину волны', 'Laser-rated glasses on') : T('Заготовка закреплена', 'Stock clamped')], ['b', L ? T('Вытяжка и обдув, огнетушитель рядом', 'Extraction, air assist, extinguisher') : T('Фреза затянута, ноль Z выставлен', 'Bit tight, Z zero set')], ['c', L ? T('Не отхожу от станка', 'I stay with the machine') : T('Очки надеты, руки вне зоны', 'Glasses on, hands clear')]].map(([k, t]) => `<label class="chk sm"><input type="checkbox" data-chk="${k}" ${MC.checks[k] ? 'checked' : ''}> ${t}</label>`).join('') + `<button class="mini txt" data-act="mcChecksOff">${T('Не показывать этот список', 'Do not show this list')}</button>`) : '';
  const laserCard = dockCard('laser', T('Лазер', 'Laser'), `<div class="grid2"><label class="fld sm"><span>${T('Мощность', 'Power')}</span><div class="inp"><input type="number" data-mcf="power" min="0.1" max="100" step="0.5" value="${MC.fire.power}"><em>%</em></div></label><label class="fld sm"><span>${T('Время', 'Time')}</span><div class="inp"><input type="number" data-mcf="time" min="0.05" max="10" step="0.1" value="${MC.fire.time}"><em>${T('с', 's')}</em></div></label></div>
     <div class="seg full"><button data-act="mcFireM" data-v="stroke" aria-pressed="${MC.fire.method !== 'dot'}" title="${T('Луч горит, пока головка сдвигается на 0,2 мм туда и обратно — работает в режиме лазера GRBL', 'The beam fires while the head moves 0.2 mm back and forth — works in GRBL laser mode')}">${T('Штрих', 'Stroke')}</button><button data-act="mcFireM" data-v="dot" aria-pressed="${MC.fire.method === 'dot'}" title="${T('Неподвижная точка: на время теста режим лазера ($32) выключается и включается обратно', 'Stationary dot: laser mode ($32) is switched off for the test and back on')}">${T('Точка', 'Dot')}</button></div>
     <button class="btn block acc" data-act="mFire">${ic('laser', 14)} ${T('Тест луча', 'Test fire')}</button>
     <p class="note">${T('Начните с 3–5% и повышайте, пока не увидите точку.', 'Start at 3–5% and raise until you see a mark.')}${infoBtn('fireTest')}</p>`);
  const spinCard = dockCard('spindle', T('Шпиндель и Z', 'Spindle & Z'), `<button class="btn block ${MC.spindle ? 'bad' : 'acc'}" data-act="mSpin">${ic('cnc', 14)} ${MC.spindle ? T('Остановить шпиндель', 'Stop spindle') : T('Запустить шпиндель', 'Start spindle')}</button>
     <div class="grid3"><label class="fld sm"><span>${T('Пластина', 'Plate')}</span><div class="inp"><input type="number" data-mcp="plate" step="0.1" value="${MC.probe.plate}"><em>${MM()}</em></div></label><label class="fld sm"><span>${T('Ход', 'Travel')}</span><div class="inp"><input type="number" data-mcp="travel" step="1" value="${MC.probe.travel}"><em>${MM()}</em></div></label><label class="fld sm"><span>F</span><div class="inp"><input type="number" data-mcp="feed" step="10" value="${MC.probe.feed}"></div></label></div>
     <button class="btn block" data-act="mProbe">${T('Щуп Z: найти поверхность', 'Z probe: find the surface')}</button>`);
  const head = L ? laserCard : m.combo ? spinCard + laserCard : spinCard;
  const con = dockCard('log', T('Журнал', 'Log'), `<div class="console" id="mcCon">${MC.log.map(([k, t]) => `<div class="${k}">${esc(t)}</div>`).join('')}</div>
     <form class="row" id="mcForm" autocomplete="off"><div class="inp" style="flex:1"><input id="mcCmd" placeholder="${T('Команда: $$, G0 X10…', 'Command: $$, G0 X10…')}"></div><button class="btn sm" type="submit">${T('Отправить', 'Send')}</button></form>`, `<button class="mini" data-act="mcClearLog" title="${T('Очистить', 'Clear')}">${ic('trash', 14)}</button>`, 'wide');
  const macros = dockCard('macros', T('Макросы', 'Macros'), `<div class="macros">${(S.macros || []).map((mm, i) => `<button class="btn sm" data-act="macro" data-v="${i}" title="${esc(mm.g)}">${esc(({ Home: T('Поиск нуля', 'Home'), Unlock: T('Разблокировать', 'Unlock') })[mm.n] || mm.n)}</button>`).join('') || `<p class="note">${T('Нет макросов', 'No macros')}</p>`}</div>`, `<button class="mini" data-act="editMacros" title="${T('Изменить', 'Edit')}">${ic('edit', 14)}</button>`, 'pro');
  const pad = typeof gpCardHtml === 'function' ? dockCard('pad', T('Геймпад', 'Gamepad'), gpCardHtml(), `<button class="mini" data-act="gpSettings" title="${T('Назначение кнопок', 'Button mapping')}">${ic('cog', 14)}</button>`) : '';
  d.innerHTML = `<div class="dockbar"><span class="grip" id="dockGrip" title="${T('Потяните, чтобы изменить высоту', 'Drag to resize')}"></span><b>${T('Управление станком', 'Machine control')}</b><span class="pill mcStatePill ${stateClass(st)}">${STATE_NAME(st)}</span><span class="sp"></span><span class="note">${esc(machName(m))} · ${m.w}×${m.h}</span><button class="mini" data-act="mcDock" title="${collapsed ? T('Развернуть', 'Expand') : T('Свернуть', 'Collapse')}">${ic(collapsed ? 'up' : 'down', 14)}</button></div>
    <div class="dcards">${errCard}${conn}${job}${pos}${jogc}${head}${pad}${con}${macros}</div>`;
  const h = +store.get('mcDockH') || 0; if (h) d.style.setProperty('--dock-h', h + 'px');
  const c = $('#mcCon'); if (c) c.scrollTop = c.scrollHeight;
  const f = $('#mcForm'); if (f) f.onsubmit = e => { e.preventDefault(); const v = $('#mcCmd').value.trim(); if (v) { sendCmd(v); $('#mcCmd').value = '' } };
  bindDockGrip();
}
function bindDockGrip() {
  const g = $('#dockGrip'), d = $('#mdock'); if (!g || !d) return;
  g.onpointerdown = e => { e.preventDefault(); const y0 = e.clientY, h0 = d.getBoundingClientRect().height; g.setPointerCapture(e.pointerId);
    g.onpointermove = ev => { const h = clamp(h0 - (ev.clientY - y0), 120, window.innerHeight * .75); d.style.setProperty('--dock-h', h + 'px') };
    g.onpointerup = ev => { g.onpointermove = null; store.set('mcDockH', Math.round(d.getBoundingClientRect().height)); requestAnimationFrame(drawMachineCanvas) } };
}
function bindMachineCanvas() {
  const c = $('#mcv'); if (!c) return;
  c.addEventListener('wheel', e => { e.preventDefault(); const r = c.getBoundingClientRect(); mvZoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * .0015)) }, { passive: false });
  c.addEventListener('pointerdown', e => { MV.drag = { x: e.clientX, y: e.clientY, ox: MV.ox, oy: MV.oy }; c.setPointerCapture(e.pointerId); c.style.cursor = 'grabbing' });
  c.addEventListener('pointermove', e => { if (!MV.drag) { const r = c.getBoundingClientRect(), wx = (e.clientX - r.left - MV.ox) / MV.s, wy = (MV.oy - (e.clientY - r.top)) / MV.s; const i = $('#mvInfo'); if (i) i.textContent = `X ${fx(wx, 1)}  Y ${fx(wy, 1)}`; return } MV.ox = MV.drag.ox + e.clientX - MV.drag.x; MV.oy = MV.drag.oy + e.clientY - MV.drag.y; MV.follow = false; drawMachineCanvas() });
  c.addEventListener('pointerup', () => { MV.drag = null; c.style.cursor = '' });
  c.addEventListener('dblclick', () => { mvFit(); drawMachineCanvas() });
}
function mvFit() { const c = $('#mcv'); if (!c) return; const r = c.getBoundingClientRect(), m = S.machine; MV.s = Math.min((r.width - 60) / m.w, (r.height - 50) / m.h); MV.ox = (r.width - m.w * MV.s) / 2; MV.oy = (r.height + m.h * MV.s) / 2; MV.fitted = true }
function mvZoomAt(px, py, k) { const s2 = clamp(MV.s * k, .05, 80); MV.ox = px - (px - MV.ox) * s2 / MV.s; MV.oy = py - (py - MV.oy) * s2 / MV.s; MV.s = s2; drawMachineCanvas() }
function updateMachineLive() {
  const w = MC.pos.map((v, i) => v - MC.zero[i]); ['X', 'Y', 'Z'].forEach((a, i) => { const e = $('#dro' + a); if (e) e.textContent = w[i].toFixed(3) });
  const j = MC.job, pr = P.total ? (j.t / P.total * 100).toFixed(1) + '%' : '0%'; for (const id of ['jobBar', 'jobBar2']) { const e = $('#' + id); if (e) e.style.width = pr }
  const el = $('#jobEl'); if (el) el.textContent = fmtTime(j.t); const ln = $('#jobLn'); if (ln) ln.textContent = `${j.line + 1} / ${P.lines.length}`;
  drawMachineCanvas();
}
let mcRq = 0;
function drawMachineCanvas() { if (mcRq) return; mcRq = requestAnimationFrame(() => { mcRq = 0; try { drawMachineNow() } catch (e) { logError('mdraw', e) } }) }
function drawMachineNow() {
  const c = $('#mcv'); if (!c || tab !== 'machine') return; const r = c.getBoundingClientRect(); if (!r.width) return; const d = window.devicePixelRatio || 1; c.width = Math.round(r.width * d); c.height = Math.round(r.height * d);
  if (!MV.fitted) mvFit();
  if (MV.follow) { const [hx, hy] = [MV.ox + MC.pos[0] * MV.s, MV.oy - MC.pos[1] * MV.s]; MV.ox += r.width / 2 - hx; MV.oy += r.height / 2 - hy }
  const x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); const v = { s: MV.s, ox: MV.ox, oy: MV.oy };
  drawBed(x, v, r.width, r.height, 0, true); const pj = p => w2s(p[0], p[1], v); const keep = P.ghost; P.ghost = true; drawMoves(x, pj, MC.job.t, false); P.ghost = keep;
  const [zx, zy] = pj(MC.zero); x.strokeStyle = css('--info'); x.lineWidth = 1; x.beginPath(); x.moveTo(zx - 7, zy); x.lineTo(zx + 7, zy); x.moveTo(zx, zy - 7); x.lineTo(zx, zy + 7); x.stroke();
  const [hx, hy] = pj(MC.pos); x.strokeStyle = css('--accent'); x.lineWidth = 2; x.beginPath(); x.arc(hx, hy, 7, 0, Math.PI * 2); x.moveTo(hx - 13, hy); x.lineTo(hx + 13, hy); x.moveTo(hx, hy - 13); x.lineTo(hx, hy + 13); x.stroke();
  const fb = $('#mvFollow'); if (fb) fb.setAttribute('aria-pressed', MV.follow);
}
