'use strict';
/* ============================================================================
   SkyKerf_Studio · postprocessors, G-code validation and export (spec 5)
   G-code is a family of dialects. A postprocessor turns the dialect-free job
   (cam.js) into commands for one controller family. No profile is marked
   "verified" until it has been tested on real hardware (see docs/POSTPROCESSORS.md).
   Custom profiles are data templates only — no code from files is executed.
   ============================================================================ */
const BUILTIN_POSTS = [
  {
    id: 'generic_laser', kind: 'laser', version: 1, verified: false, conservative: true,
    name: { ru: 'Общий (только экспорт) — лазер', en: 'Generic (export only) — laser' },
    note: { ru: 'Консервативный код: явные единицы, M3/M5 вокруг каждого контура, S 0–1000. Не предназначен для конкретного контроллера без проверки.', en: 'Conservative code: explicit units, M3/M5 around every path, S 0–1000. Not meant for a specific controller without testing.' },
    ext: 'gcode', decimals: 3, lineNumbers: false, comment: ';', laserOn: 'M3', dynamic: false, offBetween: true, sMax: 1000, air: { on: 'M8', off: 'M9' }, end: 'M2', park: true,
    header: ['G90', 'G94'], footer: [],
    allowed: ['G0', 'G1', 'G4', 'G20', 'G21', 'G90', 'G94', 'M2', 'M3', 'M5', 'M8', 'M9', 'M30'],
  },
  {
    id: 'grbl_laser', kind: 'laser', version: 1, verified: false,
    name: { ru: 'GRBL 1.1 — лазер (режим $32=1)', en: 'GRBL 1.1 — laser (mode $32=1)' },
    note: { ru: 'Динамическая мощность M4, S в каждой строке G1, G0 выполняется с выключенным лучом только при $32=1 на контроллере. Шкала S берётся из профиля станка ($30).', en: 'Dynamic power M4, S on every G1; G0 runs with the beam off only when $32=1 is set on the controller. S range comes from the machine profile ($30).' },
    ext: 'gcode', decimals: 3, lineNumbers: false, comment: ';', laserOn: 'M4', dynamic: true, offBetween: false, sMax: null, air: { on: 'M8', off: 'M9' }, end: 'M2', park: true,
    header: ['G90'], footer: [],
    allowed: ['G0', 'G1', 'G4', 'G20', 'G21', 'G90', 'G94', 'M2', 'M3', 'M4', 'M5', 'M7', 'M8', 'M9', 'M30'],
  },
  {
    id: 'generic_cnc', kind: 'cnc', version: 1, verified: false, conservative: true,
    name: { ru: 'Общий (только экспорт) — фрезер', en: 'Generic (export only) — router' },
    note: { ru: 'Консервативный код: G21/G90/G17/G94, безопасная высота, M3/M5, смена инструмента через паузу M0.', en: 'Conservative code: G21/G90/G17/G94, safe height, M3/M5, tool change via M0 pause.' },
    ext: 'nc', decimals: 3, lineNumbers: false, comment: '(', dwell: 2, toolChange: 'M0', coolant: null, end: 'M30', park: true,
    header: ['G90', 'G17', 'G94'], footer: [],
    allowed: ['G0', 'G1', 'G2', 'G3', 'G4', 'G17', 'G20', 'G21', 'G90', 'G94', 'M0', 'M2', 'M3', 'M5', 'M8', 'M9', 'M30'],
  },
  {
    id: 'grbl_cnc', kind: 'cnc', version: 1, verified: false,
    name: { ru: 'GRBL 1.1 — фрезер', en: 'GRBL 1.1 — router' },
    note: { ru: 'GRBL не поддерживает M6: смена фрезы — пауза M0 с подсказкой. Обороты ограничены $30.', en: 'GRBL has no M6: tool changes pause with M0 and a prompt. Spindle speed is capped by $30.' },
    ext: 'nc', decimals: 3, lineNumbers: false, comment: ';', dwell: 2, toolChange: 'M0', coolant: null, end: 'M30', park: true,
    header: ['G90', 'G17', 'G94'], footer: [],
    allowed: ['G0', 'G1', 'G2', 'G3', 'G4', 'G17', 'G20', 'G21', 'G90', 'G94', 'M0', 'M2', 'M3', 'M5', 'M7', 'M8', 'M9', 'M30'],
  },
].map(p => Object.assign({ builtin: true }, p));
let userPosts = []; try { userPosts = JSON.parse(store.get('posts') || '[]') } catch (e) { userPosts = [] }
const saveUserPosts = () => store.set('posts', JSON.stringify(userPosts));
const allPosts = () => BUILTIN_POSTS.concat(userPosts.filter(p => !p.archived), S && S.postDef && !userPosts.some(u => u.id === S.postDef.id) ? [S.postDef] : []);
const postById = id => allPosts().find(p => p.id === id) || null;
const postsFor = kind => allPosts().filter(p => p.kind === kind);
function currentPost() { let p = postById(S.post); if (!p || p.kind !== S.machine.type) p = postById(S.machine.type === 'laser' ? 'grbl_laser' : 'grbl_cnc'); return p }
const postLabel = p => `${L10(p.name)}${p.builtin ? '' : ' v' + p.version}`;
const postStatus = p => p.verified ? T('проверено', 'verified') : T('не проверено на станке', 'not tested on hardware');
/* Placeholders allowed in header/footer templates — nothing else is substituted. */
const TPL_KEYS = ['units', 'sMax', 'safeZ', 'machine', 'sheet', 'material'];
function fillTpl(line, ctx) { return String(line).replace(/\{(\w+)\}/g, (m, k) => TPL_KEYS.includes(k) && ctx[k] != null ? String(ctx[k]) : m) }

const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
const toAscii = s => String(s).replace(/[а-яё]/gi, ch => { const l = ch.toLowerCase(), t = TRANSLIT[l] ?? ''; return ch === l ? t : t.charAt(0).toUpperCase() + t.slice(1) }).replace(/[^\x20-\x7e]/g, '?');

/* ============================ emitter ============================ */
function emitGcode(job, post, opts) {
  opts = Object.assign({ units: 'mm', ascii: false, stamp: true, project: '', sheetLabel: '', noHeader: false, noEnd: false }, opts);
  const m = job.machine, laser = post.kind === 'laser', inch = opts.units === 'inch', k = inch ? 1 / 25.4 : 1, dec = clamp(post.decimals ?? 3, 0, 6) + (inch ? 1 : 0);
  const sMax = post.sMax || m.smax || 1000, out = []; let ln = 0;
  const PW = Math.pow(10, dec), num = v => { const r = Math.round(v * k * PW) / PW; return r === 0 ? '0' : String(r) };
  const emit = s => { if (post.lineNumbers) { ln += 10; out.push('N' + ln + ' ' + s) } else out.push(s) };
  const C = t => { let s = opts.ascii ? toAscii(t) : String(t); s = s.replace(/[()]/g, post.comment === '(' ? '' : '$&'); out.push(post.comment === '(' ? `(${s.replace(/\)/g, '')})` : `; ${s}`) };
  const ctx = { units: inch ? 'G20' : 'G21', sMax, safeZ: m.safeZ, machine: m.name, sheet: opts.sheetLabel, material: opts.matLabel || '' };
  if (!opts.noHeader) {
    C(`${APP_NAME} ${APP_VERSION} | ${opts.project || ''} | ${opts.sheetLabel}`);
    C(`machine: ${m.name} | post: ${L10(post.name)} v${post.version} | ${post.verified ? 'verified profile' : 'post profile NOT tested on hardware'}`);
    if (opts.matLabel) C(`material: ${opts.matLabel}`);
    if (opts.stamp) C(`generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`);
    C(`units: ${inch ? 'inch' : 'mm'}`);
  } else C(`post: ${L10(post.name)} v${post.version}`);
  emit(inch ? 'G20' : 'G21');
  for (const l of post.header || []) if (String(l).trim()) emit(fillTpl(l, ctx));
  if (!opts.noHeader) for (const l of String(S.job.header || '').split('\n')) if (l.trim()) emit(fillTpl(l.trim(), ctx));
  let x = null, y = null, z = null, f = null, s = null, laserOn = false, cutting = false, tool = null, spindle = false, curRpm = null, coolant = null;
  const moveStr = (g, mv) => {
    let str = 'G' + g, any = false;
    if (mv.x != null && (x === null || Math.abs(mv.x - x) > 1e-7)) { str += ' X' + num(mv.x); x = mv.x; any = true }
    if (mv.y != null && (y === null || Math.abs(mv.y - y) > 1e-7)) { str += ' Y' + num(mv.y); y = mv.y; any = true }
    if (mv.z != null && (z === null || Math.abs(mv.z - z) > 1e-7)) { str += ' Z' + num(mv.z); z = mv.z; any = true }
    return any ? str : null;
  };
  if (laser) { if (post.dynamic) { emit(`${post.laserOn} S0`); laserOn = true; s = 0 } }
  else { const sz = moveStr(0, { z: m.safeZ }); if (sz) emit(sz) }
  for (const op of job.ops) {
    C(`LAYER ${String(op.name).replace(/\s+/g, '_')} ${op.color}`);
    if (laser) {
      if (op.focus && m.hasZ) { const fz = moveStr(0, { z: op.focus }); if (fz) emit(fz) }
      if (op.air && post.air && post.air.on) emit(post.air.on);
      for (const mv of op.moves) {
        if (mv.g === 0) {
          if (!post.dynamic && cutting) { emit('M5'); cutting = false; laserOn = false; s = null }
          const str = moveStr(0, mv); if (str) emit(str);
        } else {
          const sv = Math.round(clamp(mv.p ?? 0, 0, 1) * sMax);
          if (!post.dynamic && !cutting) { emit(`${post.laserOn} S${sv}`); cutting = true; laserOn = true; s = sv }
          let str = moveStr(1, mv); if (!str) continue;
          if (sv !== s) { str += ' S' + sv; s = sv }
          if (mv.f != null && mv.f !== f) { str += ' F' + num(mv.f).replace(/\.0+$/, ''); f = mv.f }
          emit(str);
        }
      }
      if (!post.dynamic && cutting) { emit('M5'); cutting = false; laserOn = false; s = null }
      if (op.air && post.air && post.air.off) emit(post.air.off);
    } else {
      if (tool !== op.tool.id) {
        if (tool !== null) { const r = moveStr(0, { z: m.safeZ }); if (r) emit(r); emit('M5'); spindle = false; curRpm = null; C(`tool change: ${toolName(op.tool)} d=${op.tool.d}`); emit(post.toolChange === 'M6' ? 'M6 T' + (allTools().indexOf(op.tool) + 1) : 'M0') }
        else C(`tool: ${toolName(op.tool)} d=${op.tool.d}`);
        tool = op.tool.id;
      }
      const rpm = Math.round(Math.min(op.rpm || 0, m.rpmMax || 1e9));
      if (!spindle || rpm !== curRpm) { emit(`M3 S${rpm}`); const dw = Math.max(post.dwell || 0, op.spinWait || 0); if (dw) emit(`G4 P${dw}`); spindle = true; curRpm = rpm }
      if (op.coolant === 'M7' || op.coolant === 'M8') { if (coolant !== op.coolant) { emit(op.coolant); coolant = op.coolant } } else if (coolant) { emit('M9'); coolant = null }
      for (const mv of op.moves) {
        let str = moveStr(mv.g, mv); if (!str) continue;
        if (mv.g === 1 && mv.f != null && mv.f !== f) { str += ' F' + num(mv.f).replace(/\.0+$/, ''); f = mv.f }
        emit(str);
      }
    }
  }
  if (laser) { if (laserOn || cutting) emit('M5'); if (post.dynamic) emit('S0'); if (post.park) { const r = moveStr(0, { x: 0, y: 0 }); if (r) emit(r) } }
  else { const r = moveStr(0, { z: m.safeZ }); if (r) emit(r); emit('M5'); if (post.coolant || coolant) emit('M9'); if (post.park && !opts.noEnd) { const r2 = moveStr(0, { x: 0, y: 0 }); if (r2) emit(r2) } }
  if (opts.noEnd) return out.join('\n') + '\n';
  for (const l of post.footer || []) if (String(l).trim()) emit(fillTpl(l, ctx));
  for (const l of String(S.job.footer || '').split('\n')) if (l.trim()) emit(fillTpl(l.trim(), ctx));
  emit(post.end || 'M2');
  return out.join('\n') + '\n';
}

/* ============================ validation (spec 5.3) ============================ */
const GW = new Uint8Array(256), GV = new Float64Array(256);
function validateGcode(text, post, machine, opts) {
  opts = Object.assign({ units: 'mm', stock: null }, opts);
  const errors = [], warns = [], infos = [], unknown = new Map(), lines = text.split(/\r?\n/);
  const laser = post.kind === 'laser', sMax = post.sMax || machine.smax || 1000, W = machine.w, H = machine.h, tol = .01;
  let x = 0, y = 0, z = laser ? 0 : null, abs = true, inch = null, mode = null, f = null, s = 0, laserOn = false, spindle = false, sawCut = false, anyPower = false, outOfBounds = 0, rapidInMat = 0, g0laser = 0, overFeed = 0, deep = 0;
  const allowed = new Set(post.allowed || []);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], fc = raw.trimStart().charCodeAt(0);
    if (fc === 36) { const ln = raw.replace(/;.*/, '').trim(); if (!post.allowSys) warns.push({ line: i + 1, msg: T(`Системная команда «${ln}» в коде задания.`, `System command “${ln}” inside the job.`) }); continue } // $
    const nt = gcScan(raw, GW, GV); if (nt === 0) continue;
    if (nt < 0) { errors.push({ line: i + 1, msg: T(`Не удалось разобрать строку: «${raw.trim().slice(0, 40)}».`, `Cannot parse line: “${raw.trim().slice(0, 40)}”.`) }); continue }
    let nx = null, ny = null, nz = null, motion = false;
    for (let q = 0; q < nt; q++) {
      const w = String.fromCharCode(GW[q]), v = GV[q]; if (w === 'N') continue;
      if (w === 'G' || w === 'M') { const code = w + (+v); if (!allowed.has(code)) unknown.set(code, (unknown.get(code) || i + 1)) }
      if (w === 'G') { if (v === 0 || v === 1 || v === 2 || v === 3) { mode = v; motion = true } else if (v === 90) abs = true; else if (v === 91) { abs = false; warns.push({ line: i + 1, msg: T('Относительные координаты G91 — проверьте, что контроллер их ожидает.', 'Relative mode G91 — make sure the controller expects it.') }) } else if (v === 20) { inch = true; if (opts.units === 'mm') errors.push({ line: i + 1, msg: T('В коде дюймы (G20), а экспорт настроен в миллиметрах.', 'The code uses inches (G20) but the export is set to millimetres.') }) } else if (v === 21) { inch = false; if (opts.units === 'inch') errors.push({ line: i + 1, msg: T('В коде миллиметры (G21), а экспорт в дюймах.', 'The code uses millimetres (G21) but the export is in inches.') }) } }
      else if (w === 'M') { if (v === 3 || v === 4) { if (laser) laserOn = true; else spindle = true } else if (v === 5) { laserOn = false; spindle = false } }
      else if (w === 'X') nx = v; else if (w === 'Y') ny = v; else if (w === 'Z') nz = v;
      else if (w === 'F') { f = v; if (machine.maxFeed && v * (inch ? 25.4 : 1) > machine.maxFeed * 1.001) overFeed++ }
      else if (w === 'S') { s = v; if (v > sMax + 1e-9 && laser) errors.push({ line: i + 1, msg: T(`Мощность S${v} больше максимума профиля (${sMax}).`, `Power S${v} exceeds the profile maximum (${sMax}).`) }); if (v < 0) errors.push({ line: i + 1, msg: T('Отрицательное значение S.', 'Negative S value.') }) }
    }
    if (nx == null && ny == null && nz == null) continue;
    if (mode == null) { errors.push({ line: i + 1, msg: T('Перемещение без G0/G1.', 'Motion without G0/G1.') }); continue }
    const k = inch ? 25.4 : 1;
    const tx = nx == null ? x : abs ? nx * k : x + nx * k, ty = ny == null ? y : abs ? ny * k : y + ny * k, tz = nz == null ? z : abs ? nz * k : (z || 0) + nz * k;
    if ((tx < -tol || ty < -tol || tx > W + tol || ty > H + tol) && outOfBounds < 50) { outOfBounds++; errors.push({ line: i + 1, msg: T(`Выход за рабочую область: X${fx(tx, 2)} Y${fx(ty, 2)} (поле ${W}×${H} мм).`, `Outside the work area: X${fx(tx, 2)} Y${fx(ty, 2)} (area ${W}×${H} mm).`) }) }
    if (mode >= 1) {
      if (f == null && !sawCut) errors.push({ line: i + 1, msg: T('Рабочее перемещение без заданной скорости F.', 'Cutting move without a feed rate F.') });
      sawCut = true;
      if (laser && laserOn && s > 0) anyPower = true;
      if (!laser) { if (!spindle && tz != null && tz < 0) errors.push({ line: i + 1, msg: T('Резание при выключенном шпинделе.', 'Cutting with the spindle off.') }); if (opts.stock && tz < -(opts.stock + 1)) deep++ }
    } else {
      if (laser && laserOn && s > 0 && !post.dynamic) g0laser++;
      if (!laser && tz != null && tz < -1e-6 && (nx != null || ny != null)) { rapidInMat++; if (rapidInMat < 5) errors.push({ line: i + 1, msg: T('Быстрое перемещение G0 ниже поверхности заготовки.', 'Rapid G0 move below the stock surface.') }) }
    }
    x = tx; y = ty; z = tz;
  }
  if (inch === null) warns.push({ line: 0, msg: T('Единицы измерения (G20/G21) не заданы явно.', 'Units (G20/G21) are not set explicitly.') });
  if (laser && laserOn) errors.push({ line: lines.length, msg: T('В конце нет команды выключения лазера M5.', 'No M5 laser-off command at the end.') });
  if (!laser && spindle) errors.push({ line: lines.length, msg: T('В конце нет команды остановки шпинделя M5.', 'No M5 spindle-stop command at the end.') });
  if (laser && sawCut && !anyPower) warns.push({ line: 0, msg: T('Все рабочие перемещения с нулевой мощностью — лазер ничего не сделает.', 'Every cutting move has zero power — the laser will do nothing.') });
  if (g0laser) warns.push({ line: 0, msg: T(`${g0laser} холостых ходов при включённом M3 с S>0 — безопасно только если на контроллере включён режим лазера.`, `${g0laser} rapid moves with M3 on and S>0 — safe only if the controller runs in laser mode.`) });
  if (overFeed) warns.push({ line: 0, msg: T(`${overFeed} значений F выше максимальной скорости станка (${machine.maxFeed} мм/мин).`, `${overFeed} feed values above the machine maximum (${machine.maxFeed} mm/min).`) });
  if (deep) warns.push({ line: 0, msg: T(`${deep} перемещений глубже заготовки — проверьте жертвенный стол.`, `${deep} moves deeper than the stock — check the spoilboard.`) });
  if (!laser && z != null && z < (machine.safeZ || 0) - .01) warns.push({ line: lines.length, msg: T('Программа заканчивается ниже безопасной высоты.', 'The program ends below the safe height.') });
  for (const [code, line] of unknown) warns.push({ line, msg: T(`Команда ${code} не входит в список профиля «${L10(post.name)}».`, `Command ${code} is not in the “${L10(post.name)}” profile.`) });
  if (!post.verified) infos.push({ line: 0, msg: T('Профиль постпроцессора не проверен на реальном станке. Сделайте холостой прогон.', 'The postprocessor profile has not been tested on hardware. Do a dry run first.') });
  return { errors, warns, infos, ok: !errors.length, lines: lines.length };
}

/* ============================ job cache (spec 14.1) ============================ */
const GC = new Map();
function jobKey(plate, post, opts) { return [S.rev, plate, post.id, post.version, opts.units, opts.ascii ? 1 : 0, opts.stamp ? 1 : 0, (opts.only || []).join(',')].join('|') }
function buildForPlate(plate, opts) {
  opts = Object.assign({ units: 'mm', ascii: false, stamp: S.job.stamp !== false }, opts || {});
  const post = opts.post || currentPost(), key = jobKey(plate, post, opts);
  if (GC.has(key)) return GC.get(key);
  const job = planJob(plate, { only: opts.only }), sh = sheetAt(plate), mat = matById(sh.mat);
  const eo = Object.assign({}, opts, { project: S.name || '', sheetLabel: `${sheetName(sh, plate)} ${fx(sh.w, 0)}x${fx(sh.h, 0)}`, matLabel: matLabel(mat, sh.thick) + (mat ? ` (${matStatusName(mat.status)})` : '') });
  let text, report;
  if (job.combo && new Set(job.ops.map(o => o.head)).size > 1) ({ text, report } = emitCombo(job, post, eo, sh));
  else { const p2 = job.combo && job.ops.length && job.ops[0].head !== post.kind ? postFor(job.ops[0].head) : post; text = emitGcode(job, p2, eo); report = validateGcode(text, p2, S.machine, { units: opts.units, stock: job.ops.some(o => o.head === 'cnc') ? sh.thick : null }) }
  const est = estimateTime(job);
  const r = { plate, post, job, text, report, est, key, rev: S.rev, hash: hashStr(text.replace(/^; generated:.*$/m, '')) };
  if (GC.size > 12) GC.delete(GC.keys().next().value);
  GC.set(key, r); return r;
}
const isStale = r => !r || r.rev !== S.rev;
/* combined laser + router machine: each head's operations are written with its own postprocessor;
   between them the program stops (M0) so the head can be changed; GRBL laser mode ($32) is switched if asked */
function postFor(kind) { const cur = currentPost(); if (cur.kind === kind) return cur; const m = S.machine; return postById(kind === 'laser' ? (m.laserPost || 'grbl_laser') : (m.cncPost || 'grbl_cnc')) }
function emitCombo(job, post, eo, sh) {
  const segs = []; for (const op of job.ops) { const last = segs[segs.length - 1]; if (last && last.head === op.head) last.ops.push(op); else segs.push({ head: op.head, ops: [op] }) }
  const m = job.machine, parts = [], reports = []; let lineOff = 0;
  segs.forEach((sg, i) => {
    const p = postFor(sg.head), txt = emitGcode(Object.assign({}, job, { ops: sg.ops }), p, Object.assign({}, eo, { noHeader: i > 0, noEnd: i < segs.length - 1 }));
    if (i > 0) {
      const to = sg.head === 'laser' ? T('ЛАЗЕР', 'LASER') : T('ФРЕЗЕР', 'ROUTER'), blk = [`; ===== ${T('СМЕНА ГОЛОВКИ', 'HEAD CHANGE')} → ${to} =====`, 'M5', 'M9'];
      if (sg.head === 'laser') blk.push(`G0 Z${fx(m.safeZ || 5, 3)}`);
      if (m.comboSwitch32 !== false) blk.push('G4 P0.1', sg.head === 'laser' ? '$32=1' : '$32=0'); // dwell = wait until motion ends: GRBL accepts $ only when idle
      blk.push(`; ${T('Установите', 'Mount the')} ${sg.head === 'laser' ? T('лазерный модуль, выставьте фокус', 'laser module, set the focus') : T('шпиндель с фрезой, выставьте ноль Z', 'spindle with the bit, set Z zero')}; ${T('затем «Продолжить»', 'then Resume')}`, 'M0');
      parts.push(blk.join('\n') + '\n'); lineOff += blk.length;
    }
    const rep = validateGcode(txt, p, S.machine, { units: eo.units, stock: sg.head === 'cnc' ? sh.thick : null });
    for (const k of ['errors', 'warns', 'infos']) for (const e of rep[k] || []) reports.push([k, Object.assign({}, e, { line: e.line ? e.line + lineOff : e.line })]);
    parts.push(txt); lineOff += txt.split('\n').length - 1;
  });
  if (m.comboSwitch32 !== false) {
    if (segs[0].head === 'laser') parts[0] = parts[0].replace(/\n(G21|G20)\n/, `\n; ${T('режим лазера', 'laser mode')}\n$32=1\n$1\n`);
    if (segs[segs.length - 1].head === 'laser') { const k = parts.length - 1; parts[k] = parts[k].replace(/\n(M2|M30)\s*\n?$/, `\n; ${T('обратно в режим шпинделя', 'back to spindle mode')}\nG4 P0.1\n$32=0\n$1\n`) }
  }
  const report = { errors: [], warns: [], infos: [], lines: lineOff }; for (const [k, e] of reports) report[k].push(e); report.ok = !report.errors.length;
  report.infos.push({ line: 0, msg: T(`Комбинированное задание: ${segs.length} участков, смена головки — пауза M0.`, `Combined job: ${segs.length} segments, head change pauses with M0.`) });
  return { text: parts.join(''), report };
}

/* ============================ report & side files ============================ */
function jobReportText(r, fileName, opts) {
  const sh = sheetAt(r.plate), mat = matById(sh.mat), m = S.machine, L = [];
  L.push(`${APP_NAME} ${APP_VERSION} — ${T('отчёт о производственном задании', 'production job report')}`);
  L.push(`${T('Файл', 'File')}: ${fileName}`);
  if (opts && opts.stamp !== false) L.push(`${T('Создан', 'Created')}: ${new Date().toISOString()}`);
  L.push(`${T('Проект', 'Project')}: ${S.name || '—'} · ${T('ревизия', 'revision')} ${S.rev} · ${T('контрольная сумма кода', 'code checksum')} ${r.hash}`);
  L.push(`${T('Станок', 'Machine')}: ${m.name} (${m.id}) · ${T('поле', 'area')} ${m.w}×${m.h} ${MM()}${m.confirmed ? '' : ' · ' + T('параметры профиля не подтверждены считыванием', 'profile values not confirmed by a device read')}`);
  L.push(`${T('Постпроцессор', 'Postprocessor')}: ${L10(r.post.name)} v${r.post.version} — ${postStatus(r.post)}`);
  L.push(`${T('Единицы', 'Units')}: ${opts.units === 'inch' ? T('дюймы', 'inches') : T('миллиметры', 'millimetres')} · ${T('кодировка', 'encoding')}: ${opts.ascii ? 'ASCII' : 'UTF-8'}`);
  L.push(`${T('Лист', 'Sheet')}: ${sheetName(sh, r.plate)} ${fx(sh.w, 1)}×${fx(sh.h, 1)} ${MM()} · ${T('материал', 'material')}: ${matLabel(mat, sh.thick)}${mat ? ' (' + matStatusName(mat.status) + ')' : ''}`);
  L.push(''); L.push(T('Операции:', 'Operations:'));
  r.job.ops.forEach((op, i) => {
    if (isLaser()) { const p = op.params; L.push(`  ${i + 1}. ${op.name} — ${ltypeName(op.type)} · ${p.power}% · ${p.speed} ${MMIN()} · ×${p.passes}${op.type === 'fill' || op.type === 'raster' ? ` · ${T('шаг', 'interval')} ${p.interval} ${MM()}` : ''}${p.kerf ? ` · ${T('керф', 'kerf')} ${p.kerf} ${MM()}` : ''} · ${p.src === 'material' ? T('из материала', 'from material') : T('вручную', 'manual')}`) }
    else { const p = op.params; L.push(`  ${i + 1}. ${op.name} — ${cncOpName(op.type)} · ${toolName(op.tool)} · ${T('глубина', 'depth')} ${p.depth} ${MM()} · ${T('шаг', 'step')} ${p.step} · F${p.feed} · S${op.rpm}`) }
  });
  L.push(''); L.push(`${T('Оценка времени', 'Time estimate')}: ${fmtTime(r.est.time)} (${r.est.withAccel ? T('с учётом ускорений профиля', 'using profile accelerations') : T('без учёта ускорений', 'without accelerations')}) · ${T('рабочий путь', 'cut path')} ${fmtLen(r.est.cut)} · ${T('холостые', 'travel')} ${fmtLen(r.est.travel)}`);
  L.push(''); L.push(`${T('Проверка кода', 'Code check')}: ${T('ошибок', 'errors')} ${r.report.errors.length}, ${T('предупреждений', 'warnings')} ${r.report.warns.length}`);
  for (const e of r.report.errors) L.push(`  [${T('ошибка', 'error')}] ${e.line ? T('строка ', 'line ') + e.line + ': ' : ''}${e.msg}`);
  for (const e of r.report.warns) L.push(`  [${T('внимание', 'warning')}] ${e.line ? T('строка ', 'line ') + e.line + ': ' : ''}${e.msg}`);
  for (const w of r.job.warn) L.push(`  [${T('подготовка', 'planning')}] ${w}`);
  L.push(''); L.push(T('Ограничения: проверка программой не заменяет проверку станка, крепления материала, фокуса, инструмента и аварийной остановки. Выполните холостой прогон и не оставляйте станок без присмотра.', 'Limits: the software check does not replace checking the machine, workholding, focus, tool and emergency stop. Do a dry run and never leave the machine unattended.'));
  return L.join('\n') + '\n';
}
function svgExport(plate) {
  const m = S.machine, sh = sheetAt(plate), OX = plateX(plate), shapes = S.shapes.filter(s => !s.parked && plateOf(s) === plate && s.kind !== 'image'); let body = '';
  for (const L of S.layers) { const ls = shapes.filter(s => s.layer === L.id); if (!ls.length) continue; body += `<g id="${esc(layerName(L))}" data-process="${L.type}" stroke="${L.color}" fill="none" stroke-width="0.1">`; for (const s of ls) { const d = s.paths.map(p => 'M' + p.map(q => `${fx(q[0] - OX, 3)},${fx(m.h - q[1], 3)}`).join('L') + (s.closed ? 'Z' : '')).join(''); body += `<path d="${d}"/>` } body += '</g>' }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${m.w}mm" height="${m.h}mm" viewBox="0 0 ${m.w} ${m.h}"><!-- ${APP_NAME} ${APP_VERSION}: ${esc(sheetName(sh, plate))}, origin bottom-left of the machine bed --><rect x="${fx(sh.x, 3)}" y="${fx(m.h - sh.y - sh.h, 3)}" width="${fx(sh.w, 3)}" height="${fx(sh.h, 3)}" fill="none" stroke="#999" stroke-dasharray="2 2" stroke-width="0.1" id="sheet"/>${body}</svg>\n`;
}
/* DXF R12 (POLYLINE/VERTEX) for broad compatibility. */
function dxfExport(plate) {
  const OX = plateX(plate), shapes = S.shapes.filter(s => !s.parked && plateOf(s) === plate && s.kind !== 'image'), o = [], P2 = (c, v) => o.push(String(c), String(v));
  const lname = L => toAscii(layerName(L)).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 31) || 'L' + L.id;
  P2(0, 'SECTION'); P2(2, 'HEADER'); P2(9, '$ACADVER'); P2(1, 'AC1009'); P2(9, '$INSUNITS'); P2(70, 4); P2(0, 'ENDSEC');
  P2(0, 'SECTION'); P2(2, 'TABLES'); P2(0, 'TABLE'); P2(2, 'LAYER'); P2(70, S.layers.length);
  for (const L of S.layers) { P2(0, 'LAYER'); P2(2, lname(L)); P2(70, 0); P2(62, (L.id % 7) + 1); P2(6, 'CONTINUOUS') }
  P2(0, 'ENDTAB'); P2(0, 'ENDSEC'); P2(0, 'SECTION'); P2(2, 'ENTITIES');
  for (const s of shapes) for (const p of s.paths) { P2(0, 'POLYLINE'); P2(8, lname(S.layers[s.layer])); P2(66, 1); P2(70, s.closed ? 1 : 0); for (const q of p) { P2(0, 'VERTEX'); P2(8, lname(S.layers[s.layer])); P2(10, fx(q[0] - OX, 4)); P2(20, fx(q[1], 4)); P2(30, 0) } P2(0, 'SEQEND') }
  P2(0, 'ENDSEC'); P2(0, 'EOF'); return o.join('\n') + '\n';
}
function jobJson(r, opts) {
  const sh = sheetAt(r.plate);
  return JSON.stringify({ format: 'skykerf-job', app: APP_NAME, version: APP_VERSION, project: S.name || null, rev: S.rev, codeHash: r.hash, machine: S.machine, post: { id: r.post.id, version: r.post.version, verified: r.post.verified }, units: opts.units, sheet: sh, material: matById(sh.mat), ops: r.job.ops.map(op => ({ layer: op.layer, name: op.name, type: op.type, params: Object.assign({}, op.params, { mat: undefined, tool: undefined, warn: undefined }), tool: op.tool ? op.tool.id : undefined })), estimate: r.est }, null, 1);
}
const safeFileName = s => String(s || 'job').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 80) || 'job';

/* ============================ export dialog ============================ */
let EX = null;
function openExport() {
  if (!S.shapes.some(s => !s.parked)) { toast(T('В проекте нет объектов для экспорта.', 'There is nothing to export.')); return }
  const post = currentPost();
  EX = { plates: 'current', post: post.id, units: 'mm', ext: post.ext || 'gcode', customExt: '', ascii: false, report: true, pkg: false, stamp: S.job.stamp !== false, name: safeFileName(S.name || APP_NAME), results: null, saved: null };
  openModal(`${ic('export', 18)} ${T('Экспорт G-code', 'Export G-code')}`, `<div class="ex-grid"><div id="exForm"></div><div id="exSum"></div></div>`, `<p class="note" id="exNote"></p><button class="btn" data-act="closeModal">${T('Закрыть', 'Close')}</button><button class="btn" data-act="exCopy" id="exCopyBtn">${ic('copy', 15)} ${T('Скопировать код', 'Copy code')}</button><button class="btn" data-act="exOpenFolder" id="exFolderBtn" hidden>${ic('folder', 15)} ${T('Открыть папку', 'Open folder')}</button><button class="primary" data-act="exSave" id="exSaveBtn">${ic('save', 15)} ${T('Сохранить…', 'Save…')}</button>`, 'wide');
  onModalClose = () => { EX = null };
  renderExport();
}
function exPlates() { if (EX.plates === 'all') return S.sheets.map((_, i) => i).filter(i => S.shapes.some(s => !s.parked && plateOf(s) === i)); return [curPlate] }
function exExt() { return (EX.ext === 'custom' ? EX.customExt : EX.ext).replace(/[^a-z0-9]/gi, '').toLowerCase() || 'gcode' }
function renderExport() {
  if (!EX) return; const post = postById(EX.post) || currentPost(), desk = !!window.skykerfDesktop;
  const posts = postsFor(S.machine.type);
  $('#exForm').innerHTML = `<div class="sec"><h3>${T('Что экспортировать', 'What to export')}</h3>
   <div class="seg full"><button data-act="exPl" data-v="current" aria-pressed="${EX.plates === 'current'}">${T('Текущий лист', 'Current sheet')} (${curPlate + 1})</button><button data-act="exPl" data-v="all" aria-pressed="${EX.plates === 'all'}">${T('Все листы', 'All sheets')} (${S.sheets.length})</button></div>
   <label class="fld"><span>${T('Имя файла', 'File name')}</span><input class="plain" id="exName" value="${esc(EX.name)}"></label></div>
   <div class="sec"><h3>${T('Постпроцессор', 'Postprocessor')}${infoBtn('post')}</h3>${selF('', 'id="exPost"', posts.map(p => [p.id, postLabel(p)]), post.id)}
   <div class="postcard ${post.verified ? 'ok' : 'warn'}">${ic(post.verified ? 'check' : 'warn', 14)}<div><b>${postStatus(post)}</b><small>${esc(L10(post.note) || '')}</small></div></div>
   <button class="btn pro" data-act="postEdit">${ic('edit', 14)} ${T('Свой профиль на основе этого…', 'Custom profile based on this…')}</button></div>
   <div class="sec"><h3>${T('Формат', 'Format')}</h3><div class="grid2">
   ${selF(T('Единицы', 'Units'), 'id="exUnits"', [['mm', T('миллиметры (G21)', 'millimetres (G21)')], ['inch', T('дюймы (G20)', 'inches (G20)')]], EX.units)}
   ${selF(T('Расширение', 'Extension'), 'id="exExt"', [['gcode', '.gcode'], ['nc', '.nc'], ['ngc', '.ngc'], ['tap', '.tap'], ['custom', T('своё…', 'custom…')]], EX.ext, '', 'ext')}
   ${EX.ext === 'custom' ? `<label class="fld"><span>${T('Своё расширение', 'Custom extension')}</span><input class="plain" id="exCustomExt" value="${esc(EX.customExt)}" placeholder="cnc"></label>` : ''}
   ${selF(T('Кодировка', 'Encoding'), 'id="exEnc"', [['utf8', 'UTF-8'], ['ascii', T('ASCII (комментарии транслитом)', 'ASCII (transliterated comments)')]], EX.ascii ? 'ascii' : 'utf8')}</div>
   ${chkF(T('Метка времени в заголовке', 'Timestamp in the header'), 'id="exStamp"', EX.stamp, '', 'stamp')}
   ${chkF(T('Отчёт рядом с файлом (.txt)', 'Report next to the file (.txt)'), 'id="exReport"', EX.report)}
   ${chkF(T('Производственный пакет: G-code + SVG + DXF + отчёт + настройки задания', 'Production package: G-code + SVG + DXF + report + job settings'), 'id="exPkg"', EX.pkg)}
   ${desk ? '' : `<p class="note">${T('В веб-версии файлы скачиваются браузером. Настольная версия сохраняет их в выбранную папку.', 'In the web version the browser downloads the files. The desktop app saves them to a folder you choose.')}</p>`}</div>`;
  computeExport();
}
function computeExport() {
  if (!EX) return; const post = postById(EX.post) || currentPost(), plates = exPlates();
  busy(T('Готовлю G-code…', 'Preparing G-code…'));
  setTimeout(() => {
    try { EX.results = plates.map(p => buildForPlate(p, { post, units: EX.units, ascii: EX.ascii, stamp: EX.stamp })) } catch (e) { logError('export', e); busy(null); toast(T('Не удалось подготовить G-code: ', 'Could not prepare G-code: ') + e.message, 'err'); return }
    busy(null); if (!EX) return;
    const ext = exExt(), many = EX.results.length > 1;
    $('#exSum').innerHTML = EX.results.map(r => {
      const sh = sheetAt(r.plate), fn = `${EX.name}${many ? '_' + (r.plate + 1) : ''}.${ext}`, rep = r.report;
      const items = rep.errors.map(e => `<li class="e">${ic('warn', 12)} ${e.line ? `<b>${T('стр.', 'ln')} ${e.line}</b> ` : ''}${esc(e.msg)}</li>`).concat(rep.warns.map(e => `<li class="w">${ic('warn', 12)} ${e.line ? `<b>${T('стр.', 'ln')} ${e.line}</b> ` : ''}${esc(e.msg)}</li>`), r.job.warn.map(w => `<li class="w">${ic('info', 12)} ${esc(w)}</li>`), rep.infos.map(e => `<li class="i">${ic('info', 12)} ${esc(e.msg)}</li>`));
      return `<div class="sec"><h3>${esc(sheetName(sh, r.plate))}<span class="sp"></span><span class="pill ${rep.errors.length ? 'bad' : rep.warns.length || r.job.warn.length ? 'warn' : 'ok'}">${rep.errors.length ? T('ошибки', 'errors') + ': ' + rep.errors.length : rep.warns.length || r.job.warn.length ? T('есть предупреждения', 'warnings') : T('проверка пройдена', 'check passed')}</span></h3>
       <div class="kv"><span>${T('Файл', 'File')}</span><b>${esc(fn)}</b><span>${T('Строк', 'Lines')}</span><b>${rep.lines.toLocaleString(lang)}</b><span>${T('Размер', 'Size')}</span><b>${fx(r.text.length / 1024, 1)} ${T('КБ', 'KB')}</b><span>${T('Время (оценка)', 'Time (estimate)')}</span><b>${fmtTime(r.est.time)}${r.est.withAccel ? '' : '*'}</b><span>${T('Материал', 'Material')}</span><b>${esc(matLabel(matById(sh.mat), sh.thick))}</b></div>
       ${items.length ? `<ul class="issues">${items.join('')}</ul>` : ''}</div>`;
    }).join('') + `<p class="note">${T('Экспорт возможен и с предупреждениями — вы сами решаете, использовать ли файл. Проверка программы не заменяет холостой прогон.', 'You can export with warnings — you decide whether to use the file. The software check does not replace a dry run.')}</p>`;
    const anyErr = EX.results.some(r => r.report.errors.length);
    $('#exSaveBtn').innerHTML = `${ic('save', 15)} ${anyErr ? T('Сохранить с ошибками…', 'Save despite errors…') : T('Сохранить…', 'Save…')}`;
    $('#exSaveBtn').disabled = false; $('#exCopyBtn').disabled = EX.results.length !== 1 || EX.results[0].text.length > 4e6;
    $('#exNote').textContent = window.skykerfDesktop ? (EX.results.length > 1 || EX.pkg ? T('Будет предложено выбрать папку.', 'You will be asked for a folder.') : '') : T('Файлы можно скачать или скопировать.', 'You can download or copy the files.');
  }, 30);
}
async function exportSave() {
  if (!EX || !EX.results) return; const D = window.skykerfDesktop;
  const ext = exExt(), many = EX.results.length > 1, files = [];
  for (const r of EX.results) {
    const base = `${EX.name}${many ? '_' + (r.plate + 1) : ''}`, gname = `${base}.${ext}`, opts = { units: EX.units, ascii: EX.ascii, stamp: EX.stamp };
    files.push({ name: gname, data: EX.ascii ? toAscii(r.text) : r.text });
    if (EX.report || EX.pkg) files.push({ name: `${base}.report.txt`, data: jobReportText(r, gname, opts) });
    if (EX.pkg) { files.push({ name: `${base}.svg`, data: svgExport(r.plate) }); files.push({ name: `${base}.dxf`, data: dxfExport(r.plate) }); files.push({ name: `${base}.job.json`, data: jobJson(r, opts) }) }
  }
  if (!D) { // web: offer every file with Download and Copy
    offerFiles(files.map(f => Object.assign({ mime: /\.svg$/.test(f.name) ? 'image/svg+xml' : 'text/plain' }, f)), T('Экспорт G-code', 'Export G-code')); return;
  }
  try {
    let res;
    if (files.length === 1) res = await D.saveFile({ name: files[0].name, data: files[0].data, filters: [{ name: 'G-code', extensions: [ext] }] });
    else if (!many && !EX.pkg && files.length === 2) { res = await D.saveFile({ name: files[0].name, data: files[0].data, filters: [{ name: 'G-code', extensions: [ext] }], sidecars: [{ suffix: '.report.txt', data: files[1].data, stripExt: true }] }) }
    else res = await D.saveFiles({ suggested: EX.name, files });
    if (res && res.ok) { EX.saved = res.path || res.dir; $('#exFolderBtn').hidden = false; toast(T('Сохранено: ', 'Saved: ') + (res.path || res.dir)) }
  } catch (e) { logError('export-save', e); toast(T('Не удалось сохранить: ', 'Could not save: ') + (e.message || e), 'err') }
}
async function exportCopy() {
  if (!EX || !EX.results || EX.results.length !== 1) return; const r = EX.results[0], t = EX.ascii ? toAscii(r.text) : r.text;
  try { await navigator.clipboard.writeText(t); toast(T('G-code скопирован в буфер обмена.', 'G-code copied to the clipboard.')) } catch (e) { toast(T('Буфер обмена недоступен в этом окне.', 'The clipboard is unavailable here.')) }
}

/* ============================ custom postprocessor editor ============================ */
function openPostEditor(baseId) {
  const base = postById(baseId) || currentPost(), d = deepCopy(base);
  const isNew = base.builtin; if (isNew) { d.id = uid('post'); d.builtin = false; d.version = 1; d.name = { ru: L10(base.name) + ' (своё)', en: L10(base.name) + ' (custom)' }; d.verified = false; d.base = base.id }
  const laser = d.kind === 'laser';
  openModal(`${ic('edit', 18)} ${T('Профиль постпроцессора', 'Postprocessor profile')}`, `<p class="note">${T('Профиль — это набор правил, а не программа: подставляются только разрешённые значения. После правки сохраняется новая версия, прежняя остаётся в списке.', 'A profile is a set of rules, not a program: only allowed values are substituted. Every edit is saved as a new version; the old one stays in the list.')}</p>
   <div class="grid2"><label class="fld"><span>${T('Название', 'Name')}</span><input class="plain" id="ppName" value="${esc(L10(d.name))}"></label>${selF(T('Расширение по умолчанию', 'Default extension'), 'id="ppExt"', [['gcode', '.gcode'], ['nc', '.nc'], ['ngc', '.ngc'], ['tap', '.tap']], d.ext)}
   ${numF(T('Знаков после запятой', 'Decimal places'), 'id="ppDec" min="0" max="6"', d.decimals, '', 1)}${selF(T('Комментарии', 'Comments'), 'id="ppCom"', [[';', '; …'], ['(', '( … )']], d.comment)}
   ${laser ? selF(T('Включение лазера', 'Laser on'), 'id="ppOn"', [['M3', T('M3 — постоянная мощность', 'M3 — constant power')], ['M4', T('M4 — динамическая (GRBL)', 'M4 — dynamic (GRBL)')]], d.laserOn) + numF(T('Максимум S', 'Maximum S'), 'id="ppSmax" min="1"', d.sMax || S.machine.smax, '', 1) : selF(T('Смена инструмента', 'Tool change'), 'id="ppTc"', [['M0', T('пауза M0 (GRBL)', 'M0 pause (GRBL)')], ['M6', 'M6 Tn']], d.toolChange) + numF(T('Пауза разгона шпинделя', 'Spindle dwell'), 'id="ppDwell" min="0"', d.dwell || 0, T('с', 's'), .5)}
   ${selF(T('Конец программы', 'Program end'), 'id="ppEnd"', [['M2', 'M2'], ['M30', 'M30']], d.end)}</div>
   ${laser ? chkF(T('Выключать лазер (M5) перед каждым холостым ходом', 'Turn the laser off (M5) before every rapid'), 'id="ppOff"', !d.dynamic) : ''}
   ${chkF(T('Номера строк (N10, N20…)', 'Line numbers (N10, N20…)'), 'id="ppN"', d.lineNumbers)}${chkF(T('Возврат в X0 Y0 в конце', 'Return to X0 Y0 at the end'), 'id="ppPark"', d.park)}
   <div class="grid2"><label class="fld"><span>${T('Начальный блок', 'Start block')}</span><textarea class="plain" id="ppHead" rows="3">${esc((d.header || []).join('\n'))}</textarea></label><label class="fld"><span>${T('Конечный блок', 'End block')}</span><textarea class="plain" id="ppFoot" rows="3">${esc((d.footer || []).join('\n'))}</textarea></label></div>
   <p class="note">${T('Разрешённые подстановки', 'Allowed placeholders')}: ${TPL_KEYS.map(k => `<code>{${k}}</code>`).join(' ')}. ${T('Команды проверяются по списку профиля:', 'Commands are checked against the profile list:')} <code>${esc((d.allowed || []).join(' '))}</code></p>`,
    `<button class="btn" data-act="closeModal">${T('Отмена', 'Cancel')}</button><button class="primary" id="ppSave">${T('Сохранить версию', 'Save version')}</button>`);
  $('#ppSave').onclick = () => {
    const v = id => $('#' + id);
    const head = v('ppHead').value.split('\n').map(s => s.trim()).filter(Boolean), foot = v('ppFoot').value.split('\n').map(s => s.trim()).filter(Boolean);
    const allowed = new Set(d.allowed || []), bad = [];
    for (const l of head.concat(foot)) for (const m of l.toUpperCase().replace(/[;(].*/, '').matchAll(/\b([GM])(\d+)/g)) if (!allowed.has(m[1] + (+m[2]))) bad.push(m[1] + (+m[2]));
    if (bad.length) { toast(T('Команды вне списка профиля: ', 'Commands outside the profile list: ') + [...new Set(bad)].join(', '), 'err'); return }
    const nv = Object.assign(deepCopy(d), { name: { ru: v('ppName').value.trim() || L10(d.name), en: v('ppName').value.trim() || L10(d.name) }, ext: v('ppExt').value, decimals: clamp(+v('ppDec').value | 0, 0, 6), comment: v('ppCom').value, end: v('ppEnd').value, lineNumbers: v('ppN').checked, park: v('ppPark').checked, header: head, footer: foot, verified: false, builtin: false, created: new Date().toISOString() });
    if (laser) { nv.laserOn = v('ppOn').value; nv.sMax = Math.max(1, +v('ppSmax').value || 1000); nv.dynamic = !v('ppOff').checked; nv.offBetween = !nv.dynamic }
    else { nv.toolChange = v('ppTc').value; nv.dwell = Math.max(0, +v('ppDwell').value || 0) }
    if (!isNew) { const old = userPosts.find(p => p.id === d.id); if (old) old.archived = true; nv.id = uid('post'); nv.version = (d.version || 1) + 1; nv.prev = d.id }
    userPosts.push(nv); saveUserPosts(); pushUndo(T('Выбор постпроцессора', 'Choose postprocessor')); S.post = nv.id; S.postDef = deepCopy(nv); GC.clear(); closeModal(); changed();
    toast(T(`Сохранён профиль «${L10(nv.name)}» v${nv.version}. Он помечен как не проверенный.`, `Saved profile “${L10(nv.name)}” v${nv.version}. It is marked as unverified.`));
    if (typeof openExport === 'function' && tab === 'gcode') openExport();
  };
}
