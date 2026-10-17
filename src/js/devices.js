'use strict';
/* ============================================================================
   SkyKerf_Studio · devices (spec 12)
   Web Serial connection to GRBL-family controllers, read-only detection
   ($I, $$, ?) → draft machine profile with "read" vs "needs confirmation"
   fields, status polling, journal, safe streaming. Nothing moves and no job
   starts without an explicit user action. A software stop never replaces the
   hardware emergency stop.
   ============================================================================ */
const MC = { mode: 'demo', connected: false, port: null, writer: null, reader: null, pos: [0, 0, 0], wco: [0, 0, 0], zero: [0, 0, 0], log: [], job: { run: false, pause: false, t: 0, line: 0 }, step: 10, feedOv: 100, demoRate: 20, checks: { a: false, b: false, c: false }, baud: 115200, state: 'offline', info: null, poll: 0, lastRx: 0, portInfo: null };
const USB_CHIPS = { '1a86:7523': 'CH340', '1a86:55d4': 'CH9102', '10c4:ea60': 'CP210x', '0403:6001': 'FTDI FT232', '2341:0043': 'Arduino Uno', '2341:0001': 'Arduino Uno', '303a:1001': 'ESP32-S3', '0483:5740': 'STM32 VCP' };
const STATE_NAME = s => ({ offline: T('нет связи', 'offline'), connecting: T('подключение…', 'connecting…'), idle: T('готов', 'ready'), run: T('работает', 'running'), hold: T('пауза', 'hold'), jog: T('перемещение', 'jogging'), alarm: T('авария (ALARM)', 'alarm'), door: T('открыта дверь', 'door open'), home: T('поиск нуля', 'homing'), check: T('проверка', 'check mode'), sleep: T('сон', 'sleep'), lost: T('связь потеряна', 'connection lost'), demo: T('демо', 'demo') })[s] || s;
const stateClass = s => ({ idle: 'ok', run: 'ok', demo: 'warn', hold: 'warn', jog: 'ok', alarm: 'bad', door: 'bad', lost: 'bad', offline: 'mut', connecting: 'warn', home: 'warn', check: 'warn', sleep: 'mut' })[s] || 'mut';
function mlog(k, t) { MC.log.push([k, t]); if (MC.log.length > 400) MC.log.shift(); const c = $('#mcCon'); if (c) { c.insertAdjacentHTML('beforeend', `<div class="${k}">${esc(t)}</div>`); c.scrollTop = c.scrollHeight } }
function setState(s) { if (MC.state === s) return; MC.state = s; const el = $('#mcState'); if (el) { el.className = 'pill ' + stateClass(s); el.textContent = STATE_NAME(s) } }

/* ---------------- GRBL parsing ---------------- */
function parseStatus(l) {
  const m = /^<([A-Za-z]+)(?::\d)?\|(.*)>$/.exec(l); if (!m) return null;
  const st = m[1].toLowerCase(), out = { state: st };
  for (const part of m[2].split('|')) { const [k, v] = part.split(':'); if (!v) continue; const nums = v.split(',').map(Number); if (k === 'MPos') out.mpos = nums; else if (k === 'WPos') out.wpos = nums; else if (k === 'WCO') out.wco = nums; else if (k === 'FS' || k === 'F') out.fs = nums; else if (k === 'Ov') out.ov = nums }
  return out;
}
function handleStatus(p) {
  setState(p.state === 'idle' ? 'idle' : p.state);
  if (p.wco) MC.wco = p.wco;
  if (p.mpos) MC.pos = p.mpos.slice(0, 3).concat([0, 0, 0]).slice(0, 3); else if (p.wpos) MC.pos = p.wpos.map((v, i) => v + (MC.wco[i] || 0)).slice(0, 3);
  updateMachineLive();
}
const info = () => MC.info || (MC.info = { ver: null, opt: null, settings: {}, raw: [] });
function handleLine(l) {
  MC.lastRx = Date.now();
  if (l.startsWith('<')) { const p = parseStatus(l); if (p) { handleStatus(p); return } }
  mlog(/^error|ALARM/i.test(l) ? 'er' : 'rx', l);
  const I = info();
  let m;
  if ((m = /^\[VER:([^:\]]+)/.exec(l))) I.ver = m[1];
  else if ((m = /^\[OPT:([^\]]+)\]/.exec(l))) I.opt = m[1];
  else if ((m = /^\$(\d+)=([-\d.]+)/.exec(l))) I.settings[m[1]] = +m[2];
  else if (/^Grbl\s+([\d.a-z]+)/i.test(l)) I.ver = I.ver || /^Grbl\s+([\d.a-z]+)/i.exec(l)[1];
  if (/^ALARM/i.test(l)) setState('alarm');
}

/* ---------------- demo controller (answers like GRBL, marked as demo) ---------------- */
function demoAnswer(cmd) {
  const m = S.machine, u = cmd.toUpperCase(), out = [];
  if (u === '$I') out.push('[VER:1.1h.20190825:DEMO]', '[OPT:VZL,15,128]', 'ok');
  else if (u === '$$') { const lines = { 0: 10, 1: 25, 3: 0, 22: 1, 23: 3, 30: m.type === 'laser' ? m.smax : (m.rpmMax || m.rpm), 31: 0, 32: m.type === 'laser' ? 1 : 0, 110: m.rapid, 111: m.rapid, 112: 600, 120: m.accel || 500, 121: m.accel || 500, 122: 50, 130: m.w, 131: m.h, 132: m.type === 'laser' ? 0 : (m.zTravel || 50) }; for (const k in lines) out.push(`$${k}=${lines[k]}`); out.push('ok') }
  else if (u === '?') out.push(`<Idle|MPos:${MC.pos.map(v => v.toFixed(3)).join(',')}|FS:0,0>`);
  else if (/^\$H/.test(u)) { MC.pos = [0, 0, m.type === 'laser' ? 0 : m.safeZ]; out.push('ok') }
  else if (/^G0?[01]\b|^\$J=/.test(u)) { const rel = /G91/.test(u), p = [...MC.pos]; ['X', 'Y', 'Z'].forEach((a, i) => { const r = new RegExp(a + '\\s*(-?[\\d.]+)').exec(u); if (r) p[i] = rel ? p[i] + (+r[1]) : (+r[1]) + MC.zero[i] }); p[0] = clamp(p[0], 0, m.w); p[1] = clamp(p[1], 0, m.h); MC.pos = p; out.push('ok') }
  else out.push('ok');
  return out;
}

/* ---------------- sending ---------------- */
let okWait = null;
async function sendCmd(cmd) {
  if (MC.mode === 'serial' && MC.connected) { await serialWrite(cmd); return }
  mlog('tx', '> ' + cmd); const ans = demoAnswer(cmd);
  setTimeout(() => { for (const l of ans) handleLine(l); updateMachineLive() }, 40);
}
async function serialWrite(line, wait) { mlog('tx', '> ' + line); await MC.writer.write(new TextEncoder().encode(line + '\n')); if (wait) return new Promise(r => { okWait = r }) }
async function rt(byte) { if (MC.mode === 'serial' && MC.connected) { try { await MC.writer.write(new Uint8Array([byte])) } catch (e) { logError('serial-rt', e) } } }

/* ---------------- connection ---------------- */
async function serialConnect() {
  if (MC.connected) { await serialDisconnect(); return }
  if (!('serial' in navigator)) { toast(T('Этот браузер не поддерживает Web Serial. Используйте настольную версию SkyKerf_Studio или Chrome/Edge.', 'This browser has no Web Serial. Use the SkyKerf_Studio desktop app or Chrome/Edge.'), 'err'); return }
  try {
    setState('connecting'); const port = await navigator.serial.requestPort(); await port.open({ baudRate: MC.baud });
    MC.port = port; MC.writer = port.writable.getWriter(); MC.connected = true; MC.info = null;
    const pi = port.getInfo ? port.getInfo() : {}; const vid = pi.usbVendorId != null ? pi.usbVendorId.toString(16).padStart(4, '0') : null, pid = pi.usbProductId != null ? pi.usbProductId.toString(16).padStart(4, '0') : null;
    MC.portInfo = vid ? { vid, pid, chip: USB_CHIPS[vid + ':' + pid] || null } : null;
    mlog('rx', T('Порт открыт', 'Port open') + ` @${MC.baud}` + (MC.portInfo ? ` · USB ${vid}:${pid}${MC.portInfo.chip ? ' (' + MC.portInfo.chip + ')' : ''}` : ''));
    readLoop(); refresh();
    MC.poll = setInterval(() => { if (MC.connected) { rt(0x3f); if (MC.lastRx && Date.now() - MC.lastRx > 4000 && MC.state !== 'lost') { setState('lost'); mlog('er', T('Контроллер не отвечает больше 4 с.', 'The controller has not answered for over 4 s.')) } } }, 350);
    setTimeout(() => detectDevice(), 1500);
  } catch (e) { setState('offline'); if (e && e.name !== 'NotFoundError') { toast(T('Нет доступа к порту: ', 'No port access: ') + (e.message || e.name), 'err'); mlog('er', String(e.message || e)) } }
}
async function serialDisconnect() {
  clearInterval(MC.poll); MC.job.run = false;
  try { MC.reader && await MC.reader.cancel(); MC.writer && MC.writer.releaseLock(); await MC.port.close() } catch (e) { }
  MC.connected = false; setState('offline'); mlog('rx', T('Отключено', 'Disconnected')); refresh();
}
async function readLoop() {
  const dec = new TextDecoder(); let buf = '';
  try {
    MC.reader = MC.port.readable.getReader();
    while (true) {
      const { value, done } = await MC.reader.read(); if (done) break; buf += dec.decode(value); let i;
      while ((i = buf.search(/\r?\n/)) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + (buf[i] === '\r' ? 2 : 1)); if (!l) continue; handleLine(l); if ((/^ok/i.test(l) || /^error/i.test(l)) && okWait) { const f = okWait; okWait = null; f(l) } }
    }
  } catch (e) { mlog('er', String(e.message || e)); setState('lost'); logError('serial', e) }
  finally { try { MC.reader.releaseLock() } catch (e) { } if (MC.connected) { setState('lost'); toast(T('Связь со станком потеряна. Проверьте кабель и нажмите «Переподключить».', 'Lost the machine connection. Check the cable and press “Reconnect”.'), 'err'); MC.connected = false; clearInterval(MC.poll); refresh() } }
}

/* ---------------- detection → draft profile (read-only commands) ---------------- */
async function detectDevice() {
  MC.info = null; mlog('rx', T('Чтение сведений о контроллере ($I, $$)…', 'Reading controller information ($I, $$)…'));
  if (MC.mode === 'serial' && MC.connected) { await serialWrite('$I', true); await serialWrite('$$', true) } else { await sendCmd('$I'); await sendCmd('$$'); await sleep(200) }
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
   <div class="kv"><span>${T('Прошивка', 'Firmware')}</span><b>${esc(I.ver ? 'GRBL ' + I.ver : T('не определена', 'not detected'))}</b><span>${T('Опции', 'Options')}</span><b>${esc(I.opt || '—')}</b><span>${T('Порт', 'Port')}</span><b>${MC.portInfo ? `USB ${MC.portInfo.vid}:${MC.portInfo.pid}${MC.portInfo.chip ? ' · ' + MC.portInfo.chip : ''}` : (demo ? T('демо-станок', 'demo machine') : '—')}</b><span>${T('Поиск нуля', 'Homing')}</span><b>${d.homing ? T('включён ($22=1)', 'enabled ($22=1)') : T('выключен', 'disabled')}</b></div>
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
    try { const list = JSON.parse(store.get('machines') || '[]'); list.push(m); store.set('machines', JSON.stringify(list.slice(-20))) } catch (e) { }
    toast(T('Профиль станка создан. Параметры, которые нельзя считать, отмечены как подтверждённые вами.', 'Machine profile created. Fields that cannot be read are marked as confirmed by you.'));
  };
}
function userMachines() { try { return JSON.parse(store.get('machines') || '[]') } catch (e) { return [] } }

/* ---------------- streaming ---------------- */
async function streamSerial() {
  const j = MC.job, lines = P.lines.map(l => l.replace(/;.*/, '').replace(/\(.*?\)/g, '').trim()).map((l, i) => [l, i]).filter(x => x[0]);
  for (const [l, i] of lines) {
    if (!j.run) break; while (j.pause && j.run) await sleep(150); if (!j.run) break;
    const r = await serialWrite(l, true); j.line = i; const mv = P.moves.find(m => m.l >= i); if (mv) j.t = mv.t0; updateMachineLive();
    if (/^error/i.test(r)) { j.run = false; toast(T('Станок вернул ошибку — задание остановлено.', 'The machine reported an error — job stopped.'), 'err') }
  }
  j.run = false; renderRight(); renderChrome();
}
function jobStart() {
  if (!P.moves.length) return; const ch = MC.checks; if (!(ch.a && ch.b && ch.c)) { toast(T('Отметьте все пункты «Перед запуском» слева.', 'Tick every “Before you start” item on the left.')); return }
  const j = MC.job; if (j.run && j.pause) { j.pause = false; rt(0x7e); refresh(); return }
  if (MC.mode === 'serial' && !MC.connected) { toast(T('Сначала подключите станок.', 'Connect the machine first.')); return }
  if (MC.mode === 'serial' && MC.state === 'alarm') { toast(T('Контроллер в состоянии ALARM. Выполните поиск нуля ($H) или разблокировку ($X), проверив станок.', 'The controller is in ALARM. Home ($H) or unlock ($X) after checking the machine.'), 'err'); return }
  const rep = P.report; if (rep && rep.errors && rep.errors.length) toast(T(`В коде ${rep.errors.length} ошибок проверки — убедитесь, что это допустимо.`, `The code has ${rep.errors.length} check errors — make sure this is acceptable.`), 'warn');
  j.run = true; j.pause = false; j.t = 0; j.line = 0; mlog('rx', T('Старт задания', 'Job started') + ` (${P.lines.length} ${T('строк', 'lines')})`); if (MC.mode === 'serial') streamSerial(); refresh()
}
function jobPause() { MC.job.pause = true; rt(0x21); mlog('rx', T('Пауза (feed hold)', 'Paused (feed hold)')); refresh() }
function jobStop() { const j = MC.job; j.run = false; j.pause = false; rt(0x18); mlog('er', T('Остановлено пользователем (программный сброс). Аппаратная аварийная кнопка остаётся главной.', 'Stopped by user (soft reset). The hardware E-stop remains the primary stop.')); refresh() }
async function setFeedOverride(v) {
  const prev = MC.feedOv; MC.feedOv = v; if (!(MC.mode === 'serial' && MC.connected)) return;
  await rt(0x90); let d = Math.round((v - 100) / 10); while (d > 0) { await rt(0x91); d-- } while (d < 0) { await rt(0x92); d++ } mlog('tx', `> feed override ${prev}% → ${v}%`);
}

/* ---------------- machine view ---------------- */
function renderMachineView() {
  const L = isLaser(), w = MC.pos.map((v, i) => v - MC.zero[i]);
  $('#mach').innerHTML = `<div class="card"><h4>${T('Положение', 'Position')}<span style="flex:1"></span><span class="pill ${stateClass(MC.mode === 'demo' && !MC.connected ? 'demo' : MC.state)}" id="mcState">${STATE_NAME(MC.mode === 'demo' && !MC.connected ? 'demo' : MC.state)}</span></h4>
  <div class="dro">${['X', 'Y', 'Z'].map((a, i) => `<div class="ax"><b>${a}</b><span id="dro${a}">${w[i].toFixed(3)}</span><button class="btn" data-act="zeroAx" data-v="${i}">${T('Ноль', 'Zero')}</button></div>`).join('')}</div>
  <h4>${T('Перемещение', 'Jog')}<span style="flex:1"></span><div class="seg">${[.1, 1, 10, 50].map(s => `<button data-act="jogStep" data-v="${s}" aria-pressed="${MC.step === s}">${s}</button>`).join('')}</div></h4>
  <div class="jog"><span></span><button data-act="jog" data-v="Y+">Y+</button><span></span><span></span><button data-act="jog" data-v="Z+">Z+</button>
   <button data-act="jog" data-v="X-">X−</button><button class="home" data-act="mHome" title="${T('Поиск нуля', 'Home')} ($H)">${ic('home', 18)}</button><button data-act="jog" data-v="X+">X+</button><span></span><span></span>
   <span></span><button data-act="jog" data-v="Y-">Y−</button><span></span><span></span><button data-act="jog" data-v="Z-">Z−</button></div>
  <div class="grid3"><button class="btn" data-act="mZeroXY">${T('Ноль XY здесь', 'Set XY zero')}</button><button class="btn" data-act="mGoZero">${T('В ноль', 'Go to zero')}</button><button class="btn" data-act="mFrame" ${P.moves.length ? '' : 'disabled'}>${ic('framing', 14)} ${T('Рамка', 'Frame')}</button>
   <button class="btn" data-act="mUnlock">${T('Разблок. $X', 'Unlock $X')}</button>${L ? `<button class="btn" data-act="mFire">${T('Тест луча 1%', 'Test fire 1%')}</button>` : `<button class="btn" data-act="mSpin">${T('Шпиндель', 'Spindle')}</button>`}<button class="btn" data-act="mDetect">${ic('device', 14)} ${T('Сведения', 'Info')}</button></div>
  <p class="note">${T('Все перемещения — только по вашей команде. Программный «Стоп» не заменяет аварийную кнопку станка.', 'Moves happen only on your command. The software Stop does not replace the machine’s E-stop.')}</p></div>
 <div class="card"><h4>${T('Задание на столе', 'Job on the bed')}</h4><canvas id="mcv"></canvas><div class="prog"><i id="jobBar2" style="width:${P.total ? (MC.job.t / P.total * 100).toFixed(1) : 0}%"></i></div>
  <h4>${T('Журнал обмена', 'Communication log')}<span style="flex:1"></span><button class="mini" data-act="mcClearLog" title="${T('Очистить', 'Clear')}">${ic('trash', 14)}</button></h4><div class="console" id="mcCon">${MC.log.map(([k, t]) => `<div class="${k}">${esc(t)}</div>`).join('')}</div>
  <form class="row pro" id="mcForm" autocomplete="off"><div class="inp" style="flex:1"><input id="mcCmd" placeholder="${T('Команда, например $$ или G0 X10', 'Command, e.g. $$ or G0 X10')}"></div><button class="btn" type="submit">${T('Отправить', 'Send')}</button></form></div>`;
  const con = $('#mcCon'); con.scrollTop = con.scrollHeight;
  $('#mcForm').onsubmit = e => { e.preventDefault(); const v = $('#mcCmd').value.trim(); if (v) { sendCmd(v); $('#mcCmd').value = '' } };
  drawMachineCanvas();
}
function updateMachineLive() {
  const w = MC.pos.map((v, i) => v - MC.zero[i]); ['X', 'Y', 'Z'].forEach((a, i) => { const e = $('#dro' + a); if (e) e.textContent = w[i].toFixed(3) });
  const j = MC.job, pr = P.total ? (j.t / P.total * 100).toFixed(1) + '%' : '0%'; for (const id of ['jobBar', 'jobBar2']) { const e = $('#' + id); if (e) e.style.width = pr }
  const el = $('#jobEl'); if (el) { el.textContent = fmtTime(j.t); $('#jobRem').textContent = fmtTime(P.total - j.t); $('#jobLn').textContent = `${j.line + 1} / ${P.lines.length}` } drawMachineCanvas()
}
function drawMachineCanvas() {
  const c = $('#mcv'); if (!c) return; const r = c.getBoundingClientRect(); if (!r.width) return; const d = window.devicePixelRatio || 1; c.width = Math.round(r.width * d); c.height = Math.round(r.height * d);
  const x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); const m = S.machine, s = Math.min((r.width - 40) / m.w, (r.height - 36) / m.h), v = { s, ox: (r.width - m.w * s) / 2 + 8, oy: (r.height + m.h * s) / 2 - 6 };
  drawBed(x, v, r.width, r.height, 0, true); const pj = p => w2s(p[0], p[1], v); const keep = P.ghost; P.ghost = true; drawMoves(x, pj, MC.job.t, false); P.ghost = keep;
  const [hx, hy] = pj(MC.pos); x.strokeStyle = css('--accent'); x.lineWidth = 2; x.beginPath(); x.arc(hx, hy, 6, 0, Math.PI * 2); x.moveTo(hx - 11, hy); x.lineTo(hx + 11, hy); x.moveTo(hx, hy - 11); x.lineTo(hx, hy + 11); x.stroke()
}
