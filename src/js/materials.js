'use strict';
/* ============================================================================
   SkyKerf_Studio · materials, process profiles and CNC tool library (spec 11)
   Built-in values are STARTING POINTS measured on nothing: every built-in
   profile has status "unverified". Users calibrate and save their own.
   ============================================================================ */
const MAT_STATUS = ['unverified', 'user', 'verified'];
const matStatusName = s => ({ unverified: T('не проверено', 'unverified'), user: T('пользовательский', 'user'), verified: T('проверено', 'verified') })[s] || s;
const MAT_CATS = { wood: ['Дерево', 'Wood'], board: ['Плиты', 'Boards'], plastic: ['Пластик', 'Plastic'], leather: ['Кожа', 'Leather'], paper: ['Бумага и картон', 'Paper & card'], textile: ['Текстиль', 'Textile'], metal: ['Металл', 'Metal'], stone: ['Камень', 'Stone'], other: ['Другое', 'Other'] };
const matCatName = c => T(...(MAT_CATS[c] || MAT_CATS.other));
/* laser params are per process type; `ref` names the machine profile they were written for */
const L_ = (cut, vector, fill, raster, mark, kerf, extra) => Object.assign({ ref: 'diode10', cut, vector, fill, raster, mark, kerf }, extra || {});
const BUILTIN_MATS = [
  { id: 'plywood-3', name: { ru: 'Фанера', en: 'Plywood' }, cat: 'wood', thick: 3, grain: 'x', color: '#d6b382', laser: L_({ power: 100, speed: 300, passes: 2 }, { power: 30, speed: 1500 }, { power: 35, speed: 3000, interval: .1 }, { power: 45, minPower: 8, speed: 3000, interval: .1 }, { power: 25, speed: 1500 }, .15), fit: .05 },
  { id: 'plywood-4', name: { ru: 'Фанера', en: 'Plywood' }, cat: 'wood', thick: 4, grain: 'x', color: '#d1ac78', laser: L_({ power: 100, speed: 250, passes: 3 }, { power: 30, speed: 1500 }, { power: 35, speed: 3000, interval: .1 }, { power: 45, minPower: 8, speed: 3000, interval: .1 }, { power: 25, speed: 1500 }, .16), fit: .05 },
  { id: 'plywood-6', name: { ru: 'Фанера', en: 'Plywood' }, cat: 'wood', thick: 6, grain: 'x', color: '#c9a26d', laser: L_({ power: 100, speed: 180, passes: 4 }, { power: 30, speed: 1500 }, { power: 35, speed: 3000, interval: .1 }, { power: 45, minPower: 8, speed: 3000, interval: .1 }, { power: 25, speed: 1500 }, .18), fit: .05 },
  { id: 'mdf-3', name: { ru: 'МДФ', en: 'MDF' }, cat: 'board', thick: 3, grain: 'none', color: '#b9925f', laser: L_({ power: 100, speed: 250, passes: 2 }, { power: 28, speed: 1500 }, { power: 30, speed: 3000, interval: .1 }, { power: 40, minPower: 6, speed: 3000, interval: .1 }, { power: 22, speed: 1500 }, .16), fit: .05 },
  { id: 'acrylic-3-co2', name: { ru: 'Акрил (только CO2)', en: 'Acrylic (CO2 only)' }, cat: 'plastic', thick: 3, grain: 'none', color: '#cfe4f2', laser: L_({ power: 65, speed: 600, passes: 1 }, { power: 15, speed: 6000 }, { power: 20, speed: 12000, interval: .08 }, { power: 22, minPower: 5, speed: 12000, interval: .08 }, { power: 12, speed: 6000 }, .12, { ref: 'co2-50' }), fit: 0, notes: { ru: 'Прозрачный и синий акрил диодным лазером не режется.', en: 'Clear and blue acrylic cannot be cut with a diode laser.' } },
  { id: 'leather-2', name: { ru: 'Кожа (растительного дубления)', en: 'Leather (veg-tanned)' }, cat: 'leather', thick: 2, grain: 'none', color: '#a0673d', laser: L_({ power: 90, speed: 500, passes: 2 }, { power: 22, speed: 2500 }, { power: 25, speed: 4000, interval: .1 }, { power: 30, minPower: 5, speed: 4000, interval: .1 }, { power: 18, speed: 2500 }, .15), notes: { ru: 'Хромовая и искусственная кожа при резке выделяет опасные газы.', en: 'Chrome-tanned and faux leather release hazardous fumes.' } },
  { id: 'cardboard-2', name: { ru: 'Картон', en: 'Cardboard' }, cat: 'paper', thick: 2, grain: 'none', color: '#c8a874', laser: L_({ power: 70, speed: 900, passes: 1 }, { power: 15, speed: 3000 }, { power: 15, speed: 5000, interval: .12 }, { power: 20, minPower: 3, speed: 5000, interval: .12 }, { power: 12, speed: 3000 }, .2) },
  { id: 'paper-04', name: { ru: 'Бумага 300 г/м²', en: 'Card stock 300 gsm' }, cat: 'paper', thick: .4, grain: 'none', color: '#f1ece2', laser: L_({ power: 30, speed: 1500, passes: 1 }, { power: 8, speed: 4000 }, { power: 8, speed: 6000, interval: .12 }, { power: 10, minPower: 2, speed: 6000, interval: .12 }, { power: 6, speed: 4000 }, .1) },
  { id: 'felt-2', name: { ru: 'Фетр (шерсть)', en: 'Felt (wool)' }, cat: 'textile', thick: 2, grain: 'none', color: '#7c8a9e', laser: L_({ power: 60, speed: 800, passes: 1 }, { power: 12, speed: 3000 }, { power: 15, speed: 4000, interval: .12 }, { power: 18, minPower: 3, speed: 4000, interval: .12 }, { power: 12, speed: 3000 }, .2) },
  { id: 'cork-3', name: { ru: 'Пробка', en: 'Cork' }, cat: 'wood', thick: 3, grain: 'none', color: '#b98a5a', laser: L_({ power: 80, speed: 600, passes: 2 }, { power: 15, speed: 3000 }, { power: 20, speed: 4000, interval: .12 }, { power: 25, minPower: 4, speed: 4000, interval: .12 }, { power: 15, speed: 3000 }, .2) },
  { id: 'anod-al', name: { ru: 'Анодированный алюминий', en: 'Anodized aluminium' }, cat: 'metal', thick: 1, grain: 'none', color: '#4a5f7a', laser: L_(null, { power: 80, speed: 1000 }, { power: 80, speed: 1500, interval: .06 }, { power: 85, minPower: 20, speed: 1500, interval: .06 }, { power: 80, speed: 1000 }, 0), notes: { ru: 'Только маркировка: лазер снимает анодный слой.', en: 'Marking only: the laser removes the anodized layer.' } },
  { id: 'slate-5', name: { ru: 'Сланец', en: 'Slate' }, cat: 'stone', thick: 5, grain: 'none', color: '#3d4148', laser: L_(null, { power: 60, speed: 1500 }, { power: 60, speed: 2000, interval: .1 }, { power: 65, minPower: 10, speed: 2000, interval: .1 }, { power: 60, speed: 1500 }, 0), notes: { ru: 'Только гравировка. Обычно используют инверсию фото.', en: 'Engraving only. Photos are usually inverted.' } },
  // CNC materials
  { id: 'c-plywood-6', name: { ru: 'Фанера', en: 'Plywood' }, cat: 'wood', thick: 6, grain: 'x', color: '#d6b382', cnc: { chip: .05, doc: .5, rpm: 12000 }, fit: .1 },
  { id: 'c-mdf-6', name: { ru: 'МДФ', en: 'MDF' }, cat: 'board', thick: 6, grain: 'none', color: '#b9925f', cnc: { chip: .06, doc: .6, rpm: 12000 }, fit: .1 },
  { id: 'c-hardwood-10', name: { ru: 'Твёрдое дерево', en: 'Hardwood' }, cat: 'wood', thick: 10, grain: 'x', color: '#9c6b42', cnc: { chip: .04, doc: .4, rpm: 14000 }, fit: .1 },
  { id: 'c-acrylic-3', name: { ru: 'Акрил', en: 'Acrylic' }, cat: 'plastic', thick: 3, grain: 'none', color: '#cfe4f2', cnc: { chip: .04, doc: .3, rpm: 15000 }, fit: .05 },
  { id: 'c-pvc-4', name: { ru: 'ПВХ (только фрезер)', en: 'PVC (router only)' }, cat: 'plastic', thick: 4, grain: 'none', color: '#e8e8e8', cnc: { chip: .05, doc: .4, rpm: 12000 }, fit: .05, notes: { ru: 'Никогда не режьте ПВХ лазером: выделяется хлор.', en: 'Never laser-cut PVC: it releases chlorine.' } },
  { id: 'c-alu-3', name: { ru: 'Алюминий', en: 'Aluminium' }, cat: 'metal', thick: 3, grain: 'none', color: '#b8bec6', cnc: { chip: .015, doc: .15, rpm: 18000 }, fit: .05 },
].map(m => Object.assign({ status: 'unverified', builtin: true, byMachine: {}, notes: null, test: null, fit: 0 }, m));
/* Materials that must never be offered for laser processing (spec 6.4). */
const LASER_HAZARD = /пвх|pvc|винил|vinyl|поликарбонат|polycarbonate|abs|тефлон|teflon|ptfe|стеклотекстолит|fiberglass/i;

let userMats = []; // user library (app storage + desktop), merged with built-ins and project copies
function loadUserMats() { try { userMats = JSON.parse(store.get('materials') || '[]') } catch (e) { userMats = [] } }
function saveUserMats() { store.set('materials', JSON.stringify(userMats)) }
loadUserMats();
function allMats() {
  const map = new Map();
  for (const m of BUILTIN_MATS) map.set(m.id, m);
  for (const m of userMats) if (!m.archived) map.set(m.id, m);
  if (typeof S !== 'undefined' && S && S.mats) for (const id in S.mats) if (!map.has(id)) map.set(id, S.mats[id]);
  return [...map.values()];
}
function matById(id) { return (typeof S !== 'undefined' && S && S.mats && S.mats[id]) || userMats.find(m => m.id === id && !m.archived) || BUILTIN_MATS.find(m => m.id === id) || null }
const matsForMachine = type => allMats().filter(m => type === 'laser' ? !!m.laser : !!m.cnc);
const matLabel = (m, thick) => m ? `${L10(m.name)} ${fx(thick ?? m.thick, 2)} ${MM()}` : T('материал не задан', 'no material');
/* Keep a copy of every material a project uses so the project opens anywhere. */
function rememberMat(id) { const m = matById(id); if (m && !m.builtin && S) S.mats[id] = deepCopy(m) }

/* Resolve the laser parameters a layer will use on a given sheet.
   Returns values + where they came from + warnings (spec 11: no silent substitution). */
function resolveLaser(L, sheet, machine) {
  machine = machine || S.machine;
  const man = L.laser, out = { power: man.power, minPower: man.minPower, speed: man.speed, passes: man.passes, interval: man.interval, kerf: man.kerf, src: 'manual', warn: [] };
  if (!L.auto) return out;
  const m = matById(sheet && sheet.mat), key = L.type === 'guide' ? null : L.type;
  if (!m || !m.laser) { out.warn.push(T('У материала листа нет лазерного профиля — использованы параметры слоя.', 'The sheet material has no laser profile — layer values are used.')); return out }
  const own = m.byMachine && m.byMachine[machine.id], src = (own && own[key]) || m.laser[key];
  if (!src) { out.warn.push(T(`Материал «${L10(m.name)}» не поддерживает операцию «${ltypeName(L.type)}».`, `Material “${L10(m.name)}” does not support “${ltypeName(L.type)}”.`)); out.unsupported = true; return out }
  Object.assign(out, { power: src.power, minPower: src.minPower ?? 0, speed: src.speed, passes: src.passes ?? 1, interval: src.interval ?? man.interval, kerf: (own && own.kerf != null ? own.kerf : m.laser.kerf) || 0, src: 'material', mat: m });
  if (!own && m.laser.ref && m.laser.ref !== machine.id) out.warn.push(T(`Параметры «${L10(m.name)}» записаны для профиля «${m.laser.ref}», а не для «${machine.name}». Проверьте тестом материала.`, `“${L10(m.name)}” values were written for profile “${m.laser.ref}”, not “${machine.name}”. Verify with a material test.`));
  if (sheet && Math.abs((sheet.thick || m.thick) - m.thick) > .01 && L.type === 'cut') out.warn.push(T(`Толщина листа ${sheet.thick} мм отличается от профиля (${m.thick} мм) — число проходов не пересчитывается автоматически.`, `Sheet thickness ${sheet.thick} mm differs from the profile (${m.thick} mm) — passes are not adjusted automatically.`));
  if (m.status !== 'verified') out.unverified = true;
  return out;
}

/* ---------- CNC tool library (spec 10.2) ---------- */
const BUILTIN_TOOLS = [
  { id: 'em1', type: 'flat', d: 1, fl: 2, len: 4, maxDepth: 3, name: { ru: 'Концевая 1 мм, 2 зуба', en: '1 mm flat, 2 flute' } },
  { id: 'em2', type: 'flat', d: 2, fl: 2, len: 8, maxDepth: 6, name: { ru: 'Концевая 2 мм, 2 зуба', en: '2 mm flat, 2 flute' } },
  { id: 'em3', type: 'flat', d: 3.175, fl: 2, len: 12, maxDepth: 10, name: { ru: 'Концевая 3,175 мм, 2 зуба', en: '3.175 mm flat, 2 flute' } },
  { id: 'em3s', type: 'flat', d: 3.175, fl: 1, len: 12, maxDepth: 10, name: { ru: 'Однозаходная 3,175 мм', en: '3.175 mm single flute' } },
  { id: 'em6', type: 'flat', d: 6, fl: 2, len: 22, maxDepth: 18, name: { ru: 'Концевая 6 мм, 2 зуба', en: '6 mm flat, 2 flute' } },
  { id: 'ball3', type: 'ball', d: 3.175, fl: 2, len: 12, maxDepth: 10, name: { ru: 'Сферическая 3,175 мм', en: '3.175 mm ball nose' } },
  { id: 'ball1', type: 'ball', d: 1.5, fl: 2, len: 6, maxDepth: 5, name: { ru: 'Сферическая 1,5 мм', en: '1.5 mm ball nose' } },
  { id: 'v90', type: 'v', d: 6, angle: 90, fl: 2, len: 6, maxDepth: 3, name: { ru: 'V-фреза 90°', en: 'V-bit 90°' } },
  { id: 'v60', type: 'v', d: 6, angle: 60, fl: 2, len: 6, maxDepth: 5, name: { ru: 'V-фреза 60°', en: 'V-bit 60°' } },
  { id: 'drill3', type: 'drill', d: 3, fl: 2, len: 20, maxDepth: 18, name: { ru: 'Сверло 3 мм', en: '3 mm drill' } },
].map(t => Object.assign({ builtin: true }, t));
let userTools = [];
try { userTools = JSON.parse(store.get('tools') || '[]') } catch (e) { userTools = [] }
const saveUserTools = () => store.set('tools', JSON.stringify(userTools));
const allTools = () => BUILTIN_TOOLS.concat(userTools);
const toolById = id => allTools().find(t => t.id === id) || BUILTIN_TOOLS[2];
const toolName = t => L10(t.name) || `${t.type} ⌀${t.d}`;
/* Feed from chip load: rpm × flutes × chip. */
function cncFeed(tool, mat, rpm) { const c = mat && mat.cnc ? mat.cnc.chip : .04; return Math.round(rpm * (tool.fl || 2) * c * (tool.d < 2 ? .6 : 1)) }
function resolveCnc(L, sheet) {
  const c = L.cnc, tool = toolById(c.toolId), m = matById(sheet && sheet.mat), out = Object.assign({}, c, { tool, toolD: tool.d, src: 'manual', warn: [] });
  if (L.auto && m && m.cnc) {
    out.rpm = Math.min(m.cnc.rpm, S.machine.rpmMax || m.cnc.rpm); out.feed = Math.min(cncFeed(tool, m, out.rpm), S.machine.maxFeed || 1e9); out.plunge = Math.round(out.feed * .35);
    out.step = fx(Math.max(.1, tool.d * m.cnc.doc), 2); out.src = 'material';
    if (c.op === 'out' || c.op === 'in') out.depth = fx((sheet.thick || m.thick) + .2, 2);
  }
  if (out.depth > (tool.maxDepth || 99)) out.warn.push(T(`Глубина ${out.depth} мм больше рабочей длины фрезы (${tool.maxDepth} мм).`, `Depth ${out.depth} mm exceeds the tool's cutting length (${tool.maxDepth} mm).`));
  if (c.op === 'vcarve' || c.op === 'chamfer') { if (tool.type !== 'v') out.warn.push(T('Для V-резьбы и фаски нужна V-фреза.', 'V-carve and chamfer need a V-bit.')); out.vangle = tool.angle || c.vangle }
  return out;
}

/* ---------- material library I/O ---------- */
function exportMaterials(list) { return JSON.stringify({ format: 'skykerf-materials', v: 1, materials: list.map(m => Object.assign({}, m, { builtin: undefined })) }, null, 1) }
function importMaterials(text) {
  const j = JSON.parse(text); if (!j || j.format !== 'skykerf-materials' || !Array.isArray(j.materials)) throw new Error(T('Это не библиотека материалов SkyKerf_Studio.', 'Not a SkyKerf_Studio material library.'));
  let n = 0; for (const m of j.materials) {
    if (!m.id || !m.name) continue;
    const name = L10(m.name);
    if (m.laser && LASER_HAZARD.test(name)) { delete m.laser }
    const copy = Object.assign({ status: 'unverified', byMachine: {}, cat: 'other', thick: 3 }, m, { builtin: false, status: m.status === 'verified' && m.test ? 'verified' : (m.status === 'user' ? 'user' : 'unverified') });
    const i = userMats.findIndex(u => u.id === copy.id); if (i >= 0) userMats[i] = copy; else userMats.push(copy); n++;
  }
  saveUserMats(); return n;
}
