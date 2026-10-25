'use strict';
/* ============================================================================
   SkyKerf_Studio · core
   helpers, i18n, icons, machine profiles, project model (format v3),
   named undo/redo history, serialization + migration, assets, dialogs
   ============================================================================ */
const APP_NAME = 'SkyKerf_Studio';
const APP_VERSION = '0.4.1';
const FORMAT_VERSION = 3;

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
/* Storage: new keys use the "skykerf." prefix. Values written by the old
   "Kerf Studio" builds ("kerf.*") are copied once and never deleted. */
const store = {
  get(k) { try { return localStorage.getItem('skykerf.' + k) } catch (e) { return null } },
  set(k, v) { try { localStorage.setItem('skykerf.' + k, v); return true } catch (e) { return false } },
  del(k) { try { localStorage.removeItem('skykerf.' + k) } catch (e) { } },
  migrateLegacy() {
    let moved = 0;
    try {
      for (const k of ['project', 'lang', 'mode', 'tab', 'theme']) {
        const old = localStorage.getItem('kerf.' + k);
        if (old != null && localStorage.getItem('skykerf.' + k) == null) { localStorage.setItem('skykerf.' + k, old); moved++ }
      }
    } catch (e) { }
    return moved;
  }
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fx = (n, d = 2) => { const v = +(+n).toFixed(d); return Object.is(v, -0) ? 0 : v };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
store.migrateLegacy();
let lang = store.get('lang') || (/^en/i.test((typeof navigator !== 'undefined' && navigator.language) || '') ? 'en' : 'ru');
const T = (ru, en) => lang === 'ru' ? ru : en;
const L10 = o => o == null ? '' : typeof o === 'string' ? o : (lang === 'ru' ? (o.ru ?? o.en) : (o.en ?? o.ru)) ?? '';
const MM = () => T('мм', 'mm'), MMIN = () => T('мм/мин', 'mm/min');
function fmtTime(sec) { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}` }
function fmtLen(mm) { return mm >= 1000 ? fx(mm / 1000, 2) + ' ' + T('м', 'm') : fx(mm, 0) + ' ' + MM() }
function fmtArea(mm2) { return mm2 >= 1e6 ? fx(mm2 / 1e6, 3) + ' ' + T('м²', 'm²') : fx(mm2 / 100, 1) + ' ' + T('см²', 'cm²') }
function hslRgb(h, s, l) { const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))) }; return [f(0), f(8), f(4)] }
const hslHex = (h, s, l) => '#' + hslRgb(((h % 360) + 360) % 360 / 360, clamp(s, 0, 100) / 100, clamp(l, 0, 100) / 100).map(v => v.toString(16).padStart(2, '0')).join('');
let seedRnd = 1; function rnd() { seedRnd = (seedRnd * 16807) % 2147483647; return (seedRnd - 1) / 2147483646 }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 } return h.toString(36) + s.length.toString(36) }
const uid = p => (p || 'id') + '-' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const deepCopy = o => JSON.parse(JSON.stringify(o));

/* ============================== icons ============================== */
const ICON = {
  gamepad: '<path d="M6 6h8c2.5 0 3.6 2.4 4 5s-.4 4.5-2 4.5c-1.3 0-2-1.3-3-2.3H7c-1 1-1.7 2.3-3 2.3-1.6 0-2.4-1.9-2-4.5S3.5 6 6 6z"/><path d="M6 9v3M4.5 10.5h3"/><circle cx="13" cy="9.5" r=".6"/><circle cx="14.6" cy="11.2" r=".6"/>',
  fire: '<path d="M10 2.5c.5 3-3.5 4.5-3.5 8.5a3.5 3.5 0 007 0c0-1.8-1-3-1.8-3.8.2 1.6-.6 2.6-1.4 2.8.6-2.6-.3-5.4-.3-7.5z"/>',
  estop: '<circle cx="10" cy="10" r="7.5"/><path d="M7 7l6 6M13 7l-6 6"/>',
  toy: '<rect x="3" y="9" width="14" height="5" rx="1.5"/><path d="M6 9l2-4h4l2 4"/><circle cx="6.5" cy="15" r="1.8"/><circle cx="13.5" cy="15" r="1.8"/>',
  figure: '<circle cx="10" cy="4.5" r="2"/><path d="M10 6.5v6M6.5 9h7M10 12.5l-3 4M10 12.5l3 4"/><path d="M5 18h10"/>',
  medal: '<circle cx="10" cy="12" r="5"/><path d="M7 7.5L5 2h3l2 4 2-4h3l-2 5.5"/><path d="M10 9.5l.8 1.7 1.8.2-1.3 1.2.4 1.8-1.7-.9-1.7.9.4-1.8-1.3-1.2 1.8-.2z"/>',
  book: '<path d="M3 4.5c2-1 5-1 7 .5v11c-2-1.5-5-1.5-7-.5zM17 4.5c-2-1-5-1-7 .5v11c2-1.5 5-1.5 7-.5z"/>',
  chair: '<path d="M6 3v8h8V3M5 11h10v2H5zM6 13v5M14 13v5"/>',
  shapes: '<rect x="2.5" y="10" width="7" height="7"/><path d="M13.5 2.5l4 7h-8z"/><circle cx="14" cy="14" r="3.3"/>',
  select: '<path d="M5 3l11 7-5 1.2 3 5.3-2 1.1-3-5.3L5 16z"/>',
  rect: '<rect x="3.5" y="5.5" width="13" height="9" rx="1.2"/>',
  ellipse: '<ellipse cx="10" cy="10" rx="7" ry="5.5"/>',
  polygon: '<path d="M10 3l6.5 3.8v6.4L10 17l-6.5-3.8V6.8z"/>',
  star: '<path d="M10 2.8l2.1 4.6 5 .5-3.8 3.4 1.1 4.9L10 13.7l-4.4 2.5 1.1-4.9L2.9 7.9l5-.5z"/>',
  line: '<path d="M4.5 15.5l11-11"/><circle cx="4.5" cy="15.5" r="1.5"/><circle cx="15.5" cy="4.5" r="1.5"/>',
  pen: '<path d="M3.5 16.5l3-1 9-9-2-2-9 9z"/><path d="M11.5 6.5l2 2"/>',
  text: '<path d="M4 5h12M10 5v11M7.5 16h5"/>',
  hand: '<path d="M7 10.5V5.2a1.3 1.3 0 012.6 0V9.5M9.6 9V4a1.3 1.3 0 012.6 0v5M12.2 9.2V5.6a1.3 1.3 0 012.6 0v6.2a5.2 5.2 0 01-5.2 5.2H9.1a4 4 0 01-3.2-1.6l-2.4-3.3a1.3 1.3 0 012-1.6L7 12"/>',
  measure: '<path d="M2.5 13.5l11-11 4 4-11 11z"/><path d="M6 10l1.5 1.5M8.5 7.5L10 9M11 5l1.5 1.5"/>',
  zone: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M3 9l6-6M3 15L15 3M7 17l10-10M13 17l4-4"/>',
  fit: '<path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/><rect x="7" y="7" width="6" height="6" rx="1"/>',
  zin: '<circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4M9 6.5v5M6.5 9h5"/>',
  zout: '<circle cx="9" cy="9" r="5.5"/><path d="M13 13l4 4M6.5 9h5"/>',
  undo: '<path d="M7 5L3.5 8.5 7 12"/><path d="M4 8.5h8a4.5 4.5 0 010 9H9"/>',
  redo: '<path d="M13 5l3.5 3.5L13 12"/><path d="M16 8.5H8a4.5 4.5 0 000 9h3"/>',
  play: '<path d="M6 4l10 6-10 6z" fill="currentColor"/>',
  pause: '<path d="M6 4h3v12H6zM11 4h3v12h-3z" fill="currentColor"/>',
  stop: '<rect x="5" y="5" width="10" height="10" rx="1" fill="currentColor"/>',
  eye: '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.3"/>',
  eyeoff: '<path d="M3 3l14 14M8.3 5A7 7 0 0110 4.5c5 0 8 5.5 8 5.5a14 14 0 01-2.4 3M12 15.2a7 7 0 01-2 .3c-5 0-8-5.5-8-5.5a14 14 0 013-3.6"/>',
  up: '<path d="M5 12l5-5 5 5"/>', down: '<path d="M5 8l5 5 5-5"/>',
  copy: '<rect x="6.5" y="6.5" width="10" height="10" rx="1.5"/><path d="M13.5 6.5v-2a1 1 0 00-1-1h-8a1 1 0 00-1 1v8a1 1 0 001 1h2"/>',
  trash: '<path d="M4 6h12M8 6V4h4v2M5.5 6l.8 10.5h7.4L14.5 6"/>',
  svg: '<path d="M4 3.5h8l4 4v9H4z"/><path d="M12 3.5v4h4M10 9.5v5M7.5 12l2.5 2.5 2.5-2.5"/>',
  image: '<rect x="3" y="4" width="14" height="12" rx="1.5"/><circle cx="7.5" cy="8" r="1.5"/><path d="M3.5 14l4-4 3 3 2.5-2.5 3.5 3.5"/>',
  file: '<path d="M5 3h7l3 3v11H5z"/><path d="M12 3v3h3"/>',
  gear: '<path d="M10 2.5l1.3 2.2 2.5-.7.6 2.5 2.4 1-1 2.4 1.6 2-2 1.6.3 2.6-2.6.2-1.1 2.4-2-1.6-2 1.6-1.1-2.4-2.6-.2.3-2.6-2-1.6 1.6-2-1-2.4 2.4-1 .6-2.5 2.5.7z"/><circle cx="10" cy="10" r="2.6"/>',
  cog: '<circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',
  theme: '<circle cx="10" cy="10" r="6.5"/><path d="M10 3.5a6.5 6.5 0 000 13z" fill="currentColor"/>',
  laser: '<path d="M7 3h6v5H7z"/><path d="M10 8v5" stroke-dasharray="1.6 1.4"/><path d="M6 17h8M8.5 14.5L10 13l1.5 1.5"/>',
  cnc: '<path d="M8 3h4v4H8zM9 7h2v4l-1 2-1-2z"/><path d="M4 16h12"/><path d="M6 14v2M14 14v2"/>',
  chev: '<path d="M6 8l4 4 4-4"/>',
  grid: '<path d="M3 7h14M3 13h14M7 3v14M13 3v14"/>',
  cube: '<path d="M10 2.5l7 4v7l-7 4-7-4v-7z"/><path d="M3 6.5l7 4 7-4M10 10.5v7"/>',
  slices: '<path d="M3 14.5l7 3 7-3M3 11.5l7 3 7-3M3 8.5l7 3 7-3M10 2.5l7 3-7 3-7-3z"/>',
  layers: '<rect x="2.5" y="3" width="11" height="9" rx="1"/><rect x="6.5" y="8" width="11" height="9" rx="1"/><path d="M9 14c1.5-2 3-2.5 6-1"/>',
  box: '<path d="M3 7l7-3.5L17 7v7l-7 3.5L3 14z"/><path d="M3 7l7 3.5L17 7M10 10.5v7"/><path d="M5.5 8.2v1.6M7.5 9.2v1.6M12.5 9.2v1.6M14.5 8.2v1.6"/>',
  house: '<path d="M3 9l7-6 7 6"/><path d="M5 7.5V17h10V7.5"/><rect x="8.5" y="11.5" width="3" height="5.5"/><rect x="11.8" y="9" width="2" height="2"/><rect x="6.2" y="9" width="2" height="2"/>',
  castle: '<path d="M3 17V6h2v2h2V6h2v2h2V6h2v2h2V6h2v11z"/><path d="M8.5 17v-3.5a1.5 1.5 0 013 0V17"/>',
  frame: '<rect x="3" y="3" width="14" height="14" rx="1"/><rect x="6" y="6" width="8" height="8"/>',
  puzzle: '<path d="M4 4h4.5a1.8 1.8 0 113 0H16v4.5a1.8 1.8 0 110 3V16h-4.5a1.8 1.8 0 10-3 0H4v-4.5a1.8 1.8 0 100-3z"/>',
  hinge: '<rect x="3" y="4" width="14" height="12" rx="1"/><path d="M6.5 4v5M6.5 11v5M10 4v2M10 8v4M10 14v2M13.5 4v5M13.5 11v5"/>',
  qr: '<path d="M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3z"/><path d="M12 12h2v2h-2zM15 15h2v2h-2zM15 12h2M12 16v1"/>',
  test: '<rect x="3" y="3" width="4" height="4"/><rect x="8" y="3" width="4" height="4"/><rect x="13" y="3" width="4" height="4"/><rect x="3" y="8" width="4" height="4"/><rect x="8" y="8" width="4" height="4"/><rect x="13" y="8" width="4" height="4"/><rect x="3" y="13" width="4" height="4"/><rect x="8" y="13" width="4" height="4"/><rect x="13" y="13" width="4" height="4"/>',
  kerf: '<path d="M3 4h14M3 16h14"/><path d="M8 4v12M12 4v12" stroke-dasharray="2 1.5"/><path d="M8.5 10h3"/>',
  joint: '<path d="M3 6h3v3h3V6h3v3h3V6h2"/><path d="M3 14h3v-3h3v3h3v-3h3v3h2"/>',
  sign: '<rect x="2.5" y="5" width="15" height="10" rx="2"/><circle cx="5" cy="7.5" r=".8"/><circle cx="15" cy="7.5" r=".8"/><path d="M6.5 11.5h7"/>',
  relief: '<path d="M2.5 15.5c2-5 3.5-7 5-7s2 4 3.5 4 2.5-6 4-6 2 3 2.5 9z"/><path d="M2.5 15.5h15"/>',
  nest: '<rect x="2.5" y="2.5" width="15" height="15" rx="1"/><path d="M2.5 9h7v8.5M9.5 5.5h8M13 5.5v12"/>',
  sheet: '<rect x="3.5" y="5" width="13" height="10" rx="1"/><path d="M5 3h12v10"/>',
  group: '<rect x="2.5" y="2.5" width="15" height="15" rx="1.5" stroke-dasharray="2 2"/><rect x="5.5" y="5.5" width="5" height="5"/><circle cx="12.5" cy="12.5" r="2.5"/>',
  ungroup: '<rect x="3" y="3" width="6" height="6"/><circle cx="14" cy="14" r="3"/>',
  lock: '<rect x="4.5" y="9" width="11" height="8" rx="1.2"/><path d="M7 9V6.5a3 3 0 016 0V9"/>',
  unlock: '<rect x="4.5" y="9" width="11" height="8" rx="1.2"/><path d="M7 9V6.5a3 3 0 015.8-1"/>',
  wand: '<path d="M3 17L13 7M11 5l4 4"/><path d="M15 2v3M13.5 3.5h3M17 9v2M16 10h2"/>',
  plus: '<path d="M10 4v12M4 10h12"/>',
  home: '<path d="M3.5 9.5L10 4l6.5 5.5M5.5 8v8h9V8"/>',
  framing: '<path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/>',
  link: '<path d="M8.5 11.5l3-3M7 9l-2 2a2.8 2.8 0 004 4l2-2M13 11l2-2a2.8 2.8 0 00-4-4L9 7"/>',
  open: '<path d="M3 6.5V15h14V8H9.5L8 6.5z"/>',
  save: '<path d="M4 4h9.5L16 6.5V16H4z"/><path d="M7 4v4h6V4M7 16v-5h6v5"/>',
  export: '<path d="M10 13V3M6.5 6.5L10 3l3.5 3.5"/><path d="M4 11v5.5h12V11"/>',
  newp: '<path d="M5 3h7l3 3v11H5z"/><path d="M10 8.5v5M7.5 11h5"/>',
  edit: '<path d="M4 16l1-4 8-8 3 3-8 8z"/>',
  circle: '<circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="3.5" r="1.3" fill="currentColor"/><circle cx="16.5" cy="10" r="1.3" fill="currentColor"/><circle cx="10" cy="16.5" r="1.3" fill="currentColor"/><circle cx="3.5" cy="10" r="1.3" fill="currentColor"/>',
  split: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M10 3v5l-1.5 1.5L10 11v6" stroke-dasharray="2 1.4"/>',
  smooth: '<path d="M3 14c3-8 5 4 8-4s4-2 6-4"/>',
  search: '<circle cx="8.5" cy="8.5" r="5"/><path d="M12.3 12.3L17 17"/>',
  info: '<circle cx="10" cy="10" r="7"/><path d="M10 9v5M10 6.2v.3"/>',
  warn: '<path d="M10 3l7.5 13h-15z"/><path d="M10 8v4M10 14.2v.3"/>',
  check: '<path d="M4 10.5l4 4 8-9"/>',
  clock: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2"/>',
  device: '<rect x="3" y="5" width="14" height="9" rx="1.5"/><path d="M7 17h6M10 14v3"/><circle cx="6" cy="9.5" r="1"/>',
  menu: '<path d="M4 6h12M4 10h12M4 14h12"/>',
  rotl: '<path d="M6 4L3 7l3 3"/><path d="M3.5 7H11a5 5 0 010 10H8"/>',
  rotr: '<path d="M14 4l3 3-3 3"/><path d="M16.5 7H9a5 5 0 000 10h3"/>',
  flip: '<path d="M10 3v14" stroke-dasharray="1.6 1.6"/><path d="M8 6L3 14h5zM12 6l5 8h-5z"/>',
  order: '<path d="M4 5h9M4 10h7M4 15h5"/><path d="M15 4v12M12.5 13.5L15 16l2.5-2.5"/>',
  folder: '<path d="M3 6.5V15h14V8H9.5L8 6.5z"/><path d="M10 13.5v-4M8 11.5l2-2 2 2"/>',
  help: '<circle cx="10" cy="10" r="7"/><path d="M7.8 8a2.3 2.3 0 114 1.5c-.9.7-1.8 1.1-1.8 2.3M10 14.3v.3"/>',
  arc: '<path d="M3 14a8 8 0 0114 0"/><path d="M6 10.5l1 1M10 8v1.4M14 10.5l-1 1"/>',
};
const ic = (k, s = 18) => `<svg viewBox="0 0 20 20" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ICON[k] || ''}</svg>`;

/* ============================== machine profiles ==============================
   Fields follow appendix A of the spec. Values that cannot be known for a generic
   preset (laser wattage, real travel, accelerations) stay null = "unknown". */
/* built-in profile names shown in Russian (the stored name stays as it is, so old projects still match) */
const MACH_RU = { 'Diode laser 10 W (generic)': 'Диодный лазер 10 Вт (типовой)', 'Diode laser 20 W (generic)': 'Диодный лазер 20 Вт (типовой)', 'CO2 laser 50 W (generic)': 'CO2-лазер 50 Вт (типовой)', 'CNC 3018 (generic)': 'Фрезер 3018 (типовой)', 'CNC router 6060 (generic)': 'Фрезер 6060 (типовой)' };
const machName = m => (lang === 'ru' && m && MACH_RU[m.name]) || (m && m.name) || '';
const MACHINES = [
  { id: 'diode10', type: 'laser', name: 'Diode laser 10 W (generic)', maker: null, w: 400, h: 400, origin: 'bl', laserSource: 'diode', watts: 10, smax: 1000, dynamic: true, air: true, hasZ: false, pwm: false, rapid: 6000, maxFeed: 6000, accel: 1000, safeZ: 0, rpm: 0, fw: 'grbl', post: 'grbl_laser' },
  { id: 'diode20', type: 'laser', name: 'Diode laser 20 W (generic)', maker: null, w: 400, h: 400, origin: 'bl', laserSource: 'diode', watts: 20, smax: 1000, dynamic: true, air: true, hasZ: false, pwm: false, rapid: 9000, maxFeed: 9000, accel: 1500, safeZ: 0, rpm: 0, fw: 'grbl', post: 'grbl_laser' },
  { id: 'co2-50', type: 'laser', name: 'CO2 laser 50 W (generic)', maker: null, w: 500, h: 300, origin: 'bl', laserSource: 'co2', watts: 50, smax: 1000, dynamic: true, air: true, hasZ: true, pwm: false, rapid: 12000, maxFeed: 24000, accel: 3000, safeZ: 0, rpm: 0, fw: 'grbl', post: 'grbl_laser' },
  { id: 'cnc3018', type: 'cnc', name: 'CNC 3018 (generic)', maker: null, w: 300, h: 180, zTravel: 45, origin: 'bl', smax: 1000, rapid: 1500, maxFeed: 2000, accel: 100, safeZ: 5, rpm: 10000, rpmMax: 10000, fw: 'grbl', post: 'grbl_cnc' },
  { id: 'cnc6060', type: 'cnc', name: 'CNC router 6060 (generic)', maker: null, w: 600, h: 600, zTravel: 80, origin: 'bl', smax: 24000, rapid: 5000, maxFeed: 5000, accel: 200, safeZ: 5, rpm: 18000, rpmMax: 24000, fw: 'grbl', post: 'grbl_cnc' },
];
const isLaser = () => S && S.machine.type === 'laser';

/* ============================== layers ============================== */
const COLORS = ['#e5484d', '#3e8ef7', '#30a46c', '#a46ef0', '#f5a524', '#12a5b8', '#e5679f', '#8b95a3', '#d9653b', '#5c6bc0', '#9aa3af'];
const NL = 11, TOOL_L = 10;
/* Explicit process types (spec 6.1): colour is never the only signal of a process. */
const LTYPES = ['cut', 'vector', 'fill', 'raster', 'mark', 'guide'];
const ltypeName = t => ({ cut: T('Резка', 'Cut'), vector: T('Векторная гравировка', 'Vector engrave'), fill: T('Заливка', 'Fill engrave'), raster: T('Растр (фото)', 'Raster (photo)'), mark: T('Разметка', 'Mark / score'), guide: T('Направляющие', 'Guides') })[t] || t;
const CNC_OPS = ['out', 'in', 'on', 'pocket', 'engrave', 'vcarve', 'chamfer', 'drill', 'relief'];
const cncOpName = o => ({ out: T('Контур снаружи', 'Profile outside'), in: T('Контур внутри', 'Profile inside'), on: T('По линии', 'On line'), pocket: T('Карман', 'Pocket'), engrave: T('Гравировка', 'Engrave'), vcarve: T('V-резьба', 'V-carve'), chamfer: T('Фаска', 'Chamfer'), drill: T('Сверление', 'Drill'), relief: T('3D-рельеф', '3D relief') })[o] || o;
function defLayer(i) {
  const type = i === 0 ? 'cut' : i === 1 ? 'fill' : i === 2 ? 'mark' : i === 3 ? 'raster' : i === 4 ? 'vector' : i === TOOL_L ? 'guide' : 'cut';
  return {
    id: i, color: COLORS[i], name: '', type, on: true, show: true, auto: true,
    laser: { power: type === 'cut' ? 100 : 30, minPower: 0, speed: type === 'cut' ? 300 : type === 'fill' || type === 'raster' ? 3000 : 1500, passes: type === 'cut' ? 2 : 1, interval: .1, angle: 0, scan: 'h', bidir: true, overscan: 2.5, air: type === 'cut', kerf: 0, kerfSide: 'auto', bridges: 0, bridgeW: .6, focus: 0, pwmFreq: null, joinTol: .05 },
    cnc: { op: i === 0 ? 'out' : i === 1 ? 'pocket' : i === 2 ? 'engrave' : 'out', toolId: i === 2 ? 'em1' : 'em3', depth: i === 2 ? .4 : 3, step: 1, feed: 800, plunge: 250, rpm: 12000, stepover: 45, tabs: i === 0 ? 4 : 0, tabH: 1.5, tabW: 5, finish: 0, vangle: 90, vstep: .25, chamferW: 1 },
  };
}
const layerOut = L => L.type !== 'guide';
function defaultLayerName(L) {
  if (L.id === TOOL_L) return T('Направляющие', 'Guides');
  if (L.id <= 4) return typeof S !== 'undefined' && S && S.machine.type === 'cnc' ? cncOpName(L.cnc.op) : ltypeName(L.type);
  return T('Слой ', 'Layer ') + String(L.id + 1).padStart(2, '0');
}
const layerName = L => L.name || defaultLayerName(L);

/* ============================== project ============================== */
function newSheet(o) {
  return Object.assign({ id: uid('sh'), name: '', w: 300, h: 200, x: 10, y: 10, mat: 'plywood-3', thick: 3, margin: 3, zones: [] }, o || {});
}
function blankState(machine, sheetOpts) {
  const m = deepCopy(machine || MACHINES[0]);
  const sh = newSheet(Object.assign({ w: Math.min(300, m.w - 20), h: Math.min(200, m.h - 20) }, sheetOpts || {}));
  if (m.type === 'cnc' && !sheetOpts) { sh.mat = 'c-plywood-6'; sh.thick = 6 }
  return {
    v: FORMAT_VERSION, app: APP_NAME, rev: 1, created: new Date().toISOString(),
    machine: m, post: m.post || (m.type === 'laser' ? 'grbl_laser' : 'grbl_cnc'),
    layers: Array.from({ length: NL }, (_, i) => defLayer(i)), order: Array.from({ length: NL }, (_, i) => i), orderMode: 'auto',
    shapes: [], groups: {}, sheets: [sh], mats: {}, assets: {}, layouts: [],
    nest: { mode: 'multi', spacing: 3, rot: 90, mirror: false, goal: 'sheets', res: 0, kerf: true },
    job: { innerFirst: true, engraveFirst: true, header: '', footer: '', joinTol: .05, stamp: true },
    nextId: 1, nextG: 1, snap: 1, snapOn: true,
    macros: [{ n: T('Поиск нуля', 'Home'), g: '$H' }, { n: T('Разблокировать', 'Unlock'), g: '$X' }, { n: T('Настройки', 'Settings'), g: '$$' }, { n: T('Парковка', 'Park'), g: 'G90 G0 X0 Y0' }],
  };
}

/* ---- editor state ---- */
let S, mode = store.get('mode') || 'pro', tab = store.get('tab') || 'cad', tool = 'select', sel = new Set(), curPlate = 0, curDrawLayer = 0;
const plateGap = () => Math.max(20, Math.round(S.machine.w * .08));
const plateX = i => i * (S.machine.w + plateGap());
function plateOfBox(b) { const pw = S.machine.w + plateGap(), cx = (b[0] + b[2]) / 2; return clamp(Math.floor((cx + plateGap() / 2) / pw), 0, S.sheets.length - 1) }
const plateOf = s => plateOfBox(bboxOf(s.paths));
const sheetAt = i => S.sheets[clamp(i, 0, S.sheets.length - 1)];
const sheetName = (sh, i) => sh.name || T('Лист ', 'Sheet ') + (i + 1);
const shapeById = id => S.shapes.find(s => s.id === id);
function addShape(st, layer, kind, paths, closed, extra) { const s = { id: st.nextId++, layer, kind, paths, closed, ...(extra || {}) }; st.shapes.push(s); return s }
function sheetRectWorld(i) { const sh = sheetAt(i), X = plateX(i); return [X + sh.x, sh.y, X + sh.x + sh.w, sh.y + sh.h] }

/* ---- assets: original images kept once per project, referenced by id ---- */
function addAsset(dataURL) { const id = 'a' + hashStr(dataURL); if (!S.assets[id]) S.assets[id] = dataURL; return id }
const assetURL = id => (S.assets && S.assets[id]) || null;
function pruneAssets(st) {
  const used = new Set();
  const walk = o => { if (!o || typeof o !== 'object') return; for (const k in o) { const v = o[k]; if (typeof v === 'string' && /^a[0-9a-z]+$/.test(v) && st.assets[v]) used.add(v); else if (typeof v === 'object') walk(v) } };
  walk(st.shapes); walk(st.groups); walk(st.layouts);
  for (const k of Object.keys(st.assets)) if (!used.has(k)) delete st.assets[k];
}

/* ============================== history ==============================
   Snapshots exclude assets (append-only). Each entry has a readable label.
   Consecutive edits with the same coalescing key within 1.2 s become one step. */
let undoS = [], redoS = [], lastPush = { key: null, t: 0 };
const snap = () => JSON.stringify(S, (k, v) => k === 'assets' ? undefined : v);
function restore(json) { const a = S.assets; S = JSON.parse(json); S.assets = a }
function pushUndo(label, key) {
  const now = Date.now();
  if (key && key === lastPush.key && now - lastPush.t < 1200 && undoS.length) { lastPush.t = now; return false }
  undoS.push({ label: label || T('Изменение', 'Edit'), state: snap() }); if (undoS.length > 100) undoS.shift();
  redoS = []; lastPush = { key: key || null, t: now }; return true;
}
function dropLastUndo() { undoS.pop(); lastPush = { key: null, t: 0 } }
function undo() { if (!undoS.length) return; const e = undoS.pop(); redoS.push({ label: e.label, state: snap() }); restore(e.state); lastPush = { key: null, t: 0 }; afterHist(T('Отменено: ', 'Undone: ') + e.label) }
function redo() { if (!redoS.length) return; const e = redoS.pop(); undoS.push({ label: e.label, state: snap() }); restore(e.state); lastPush = { key: null, t: 0 }; afterHist(T('Повторено: ', 'Redone: ') + e.label) }
const undoLabel = () => undoS.length ? undoS[undoS.length - 1].label : null;
const redoLabel = () => redoS.length ? redoS[redoS.length - 1].label : null;
function afterHist(msg) { const ids = new Set(S.shapes.map(s => s.id)); for (const i of [...sel]) if (!ids.has(i)) sel.delete(i); curPlate = Math.min(curPlate, S.sheets.length - 1); if (typeof changed === 'function') changed(); if (msg && typeof toast === 'function') toast(msg) }

/* ============================== serialization ============================== */
function serialize(st) { const o = Object.assign({}, st, { v: FORMAT_VERSION, app: APP_NAME, saved: new Date().toISOString() }); return JSON.stringify(o) }
class ProjectError extends Error { }
/* Parse + migrate + validate. Throws ProjectError with a user-facing message. */
function parseProject(text) {
  let j;
  try { j = typeof text === 'string' ? JSON.parse(text) : text } catch (e) { throw new ProjectError(T('Файл повреждён: это не JSON.', 'The file is damaged: not valid JSON.')) }
  if (!j || typeof j !== 'object' || !Array.isArray(j.shapes)) throw new ProjectError(T('Это не файл проекта SkyKerf_Studio.', 'This is not a SkyKerf_Studio project file.'))
  if (j.v > FORMAT_VERSION) throw new ProjectError(T(`Проект создан более новой версией (формат ${j.v}). Обновите программу.`, `The project was made by a newer version (format ${j.v}). Please update the app.`))
  const from = j.v || 1;
  if (from < 2) j = migrateV1(j);
  if (j.v < 3) j = migrateV2(j);
  normalizeProject(j);
  return { state: j, migratedFrom: from < FORMAT_VERSION ? from : null };
}
function migrateV1(j) {
  while (j.layers.length < NL) j.layers.push(defLayer(j.layers.length));
  j.order = (j.order || []).concat([8, 9, 10]).filter((v, i, a) => a.indexOf(v) === i);
  for (const L of j.layers) { Object.assign(L.laser, Object.assign({ minPower: 0, kerf: 0, bridges: 0, bridgeW: .6, overscan: 2.5, bidir: true }, L.laser)); Object.assign(L.cnc, Object.assign({ vangle: 90, vstep: .25 }, L.cnc)) }
  j.plates = 1; j.nextG = 1;
  j.sheet = { on: true, mat: 0, thick: (j.job && j.job.stock) || 3, w: Math.min(300, j.machine.w - 20), h: Math.min(200, j.machine.h - 20), x: 10, y: 10, margin: 3 };
  j.v = 2; return j;
}
const V2_LASER_MATS = ['plywood-3', 'plywood-4', 'plywood-6', 'mdf-3', 'acrylic-3-co2', 'leather-2', 'cardboard-2', 'paper-04', 'felt-2', 'cork-3', 'anod-al', 'slate-5'];
const V2_CNC_MATS = ['c-plywood-6', 'c-mdf-6', 'c-hardwood-10', 'c-acrylic-3', 'c-pvc-4', 'c-alu-3'];
function migrateV2(j) {
  const old = j.sheet || { w: 300, h: 200, x: 10, y: 10, thick: 3, margin: 3, mat: 0, on: true };
  const laser = j.machine.type === 'laser', ml = laser ? V2_LASER_MATS : V2_CNC_MATS;
  const n = Math.max(1, j.plates | 0);
  j.sheets = Array.from({ length: n }, () => newSheet({ w: old.on === false ? j.machine.w : old.w, h: old.on === false ? j.machine.h : old.h, x: old.on === false ? 0 : old.x, y: old.on === false ? 0 : old.y, mat: ml[old.mat | 0] || ml[0], thick: old.thick || 3, margin: old.margin ?? 3 }));
  delete j.sheet; delete j.plates;
  for (const L of j.layers) {
    if (L.type) continue;
    const md = L.laser && L.laser.mode;
    L.type = L.id === TOOL_L || L.out === false ? 'guide' : md === 'fill' || md === 'both' ? 'fill' : L.id === 2 ? 'mark' : (L.laser && L.laser.power >= 70) ? 'cut' : 'vector';
    if (md === 'both') L.type = 'fill';
    L.auto = false; // keep the exact values the old project was made with
    delete L.out; delete L.laser.mode;
    Object.assign(L.laser, Object.assign({ scan: 'h', kerfSide: 'auto', focus: 0, pwmFreq: null, joinTol: .05 }, L.laser));
    const toolMap = { 1: 'em1', 2: 'em2', 3.175: 'em3', 6: 'em6' };
    L.cnc.toolId = L.cnc.op === 'vcarve' ? (L.cnc.vangle === 60 ? 'v60' : 'v90') : (toolMap[L.cnc.tool] || 'em3');
    Object.assign(L.cnc, Object.assign({ finish: 0, chamferW: 1 }, L.cnc));
  }
  j.assets = j.assets || {};
  for (const s of j.shapes) if (s.kind === 'image' && s.img && s.img.src) { const id = 'a' + hashStr(s.img.src); j.assets[id] = s.img.src; s.img.asset = id; delete s.img.src }
  j.groups = j.groups || {}; j.mats = j.mats || {}; j.layouts = []; j.post = laser ? 'grbl_laser' : 'grbl_cnc';
  j.orderMode = 'manual'; j.nest = { mode: 'multi', spacing: 3, rot: 90, mirror: false, goal: 'sheets', res: 0, kerf: true };
  j.job = Object.assign({ innerFirst: true, engraveFirst: false, header: '', footer: '', joinTol: .05, stamp: true }, j.job || {});
  delete j.job.stock;
  j.v = 3; j.rev = 1; j.app = APP_NAME; return j;
}
/* Fill in missing fields so that hand-edited or partial files do not crash the editor. */
function normalizeProject(j) {
  const base = blankState(MACHINES.find(m => m.id === (j.machine && j.machine.id)) || MACHINES[0]);
  j.machine = Object.assign({}, base.machine, j.machine || {});
  for (const k of ['groups', 'mats', 'assets', 'nest', 'job']) j[k] = Object.assign({}, base[k], j[k] || {});
  for (const k of ['layouts', 'macros']) if (!Array.isArray(j[k])) j[k] = base[k];
  if (!Array.isArray(j.sheets) || !j.sheets.length) j.sheets = base.sheets;
  j.sheets = j.sheets.map(s => newSheet(s));
  if (!Array.isArray(j.layers)) j.layers = base.layers;
  while (j.layers.length < NL) j.layers.push(defLayer(j.layers.length));
  j.layers = j.layers.map((L, i) => { const d = defLayer(i); return Object.assign(d, L, { laser: Object.assign(d.laser, L.laser || {}), cnc: Object.assign(d.cnc, L.cnc || {}) }) });
  if (!Array.isArray(j.order) || j.order.length !== NL) j.order = Array.from({ length: NL }, (_, i) => i);
  j.shapes = j.shapes.filter(s => s && Array.isArray(s.paths) && s.paths.every(p => Array.isArray(p)));
  let maxId = 0, maxG = 0; for (const s of j.shapes) { maxId = Math.max(maxId, s.id | 0); maxG = Math.max(maxG, s.g | 0); s.layer = clamp(s.layer | 0, 0, NL - 1) }
  j.nextId = Math.max(j.nextId | 0, maxId + 1); j.nextG = Math.max(j.nextG | 0, maxG + 1);
  if (!j.post) j.post = j.machine.type === 'laser' ? 'grbl_laser' : 'grbl_cnc';
  j.v = FORMAT_VERSION; j.rev = j.rev | 0 || 1;
  return j;
}

/* ============================== UI primitives ============================== */
let toastT = 0;
function toast(t, kind, acts) { const e = $('#toast'); if (!e) return; e.textContent = t; if (acts && acts.length) { const w = document.createElement('span'); w.className = 'tacts'; for (const a of acts) { const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = a.label; b.dataset.act = a.act; if (a.v != null) b.dataset.v = a.v; w.appendChild(b) } e.appendChild(w) } e.className = 'toast' + (kind ? ' ' + kind : ''); e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => e.hidden = true, acts && acts.length ? 9000 : kind === 'err' ? 6000 : 3800) }
/* Russian plural: plural(5, 'лист', 'листа', 'листов') → 'листов' */
function plural(n, one, few, many) { n = Math.abs(n) % 100; const d = n % 10; return n > 10 && n < 20 ? many : d === 1 ? one : d >= 2 && d <= 4 ? few : many }
let onModalClose = null;
function openModal(title, body, foot, cls) { const d = $('#dialog'); d.className = 'dialog' + (cls ? ' ' + cls : ''); d.innerHTML = `<header><h2>${title}</h2><button class="icon-btn" data-act="closeModal" aria-label="${T('Закрыть', 'Close')}">✕</button></header><div class="body">${body}</div>${foot != null ? `<footer>${foot}</footer>` : ''}`; $('#modal').hidden = false; const f = d.querySelector('[autofocus]'); if (f) setTimeout(() => f.focus(), 30) }
function closeModal() { $('#modal').hidden = true; if (onModalClose) { const f = onModalClose; onModalClose = null; f() } }
/* In-page confirmation (the artifact viewer and our CSP do not allow window.confirm). */
function confirmBox(title, text, buttons) {
  return new Promise(res => {
    const prev = onModalClose; onModalClose = () => res(null);
    openModal(title, `<p class="note big">${text}</p>`, buttons.map((b, i) => `<button class="${b.primary ? 'primary' : 'btn' + (b.danger ? ' bad' : '')}" data-confirm="${i}">${b.label}</button>`).join(''));
    $('#dialog').querySelectorAll('[data-confirm]').forEach(el => el.addEventListener('click', () => { onModalClose = null; closeModal(); onModalClose = prev; res(buttons[+el.dataset.confirm].value) }));
  });
}
function busy(t) { const b = $('#busy'); if (!b) return; if (t == null) { b.hidden = true; return } $('#busyT').textContent = t; b.hidden = false }
const infoBtn = k => `<button type="button" class="info" data-help="${k}" aria-label="${T('Справка', 'Help')}">i</button>`;
const numF = (label, attrs, val, unit, step = .1, cls = '', help) => `<label class="fld ${cls}"><span>${label}${help ? infoBtn(help) : ''}</span><div class="inp"><input type="number" ${attrs} value="${val}" step="${step}">${unit ? `<em>${unit}</em>` : ''}</div></label>`;
const selF = (label, attrs, opts, val, cls = '', help) => `<label class="fld ${cls}"><span>${label}${help ? infoBtn(help) : ''}</span><div class="inp"><select ${attrs}>${opts.map(([v, n]) => `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div></label>`;
const chkF = (label, attrs, on, cls = '', help) => `<label class="chk ${cls}"><input type="checkbox" ${attrs} ${on ? 'checked' : ''}> <span>${label}</span>${help ? infoBtn(help) : ''}</label>`;

/* ---- error journal (spec 13.4): kept locally, never sent anywhere ---- */
const ERRLOG = [];
function logError(where, err) {
  const line = `${new Date().toISOString()} [${where}] ${err && (err.stack || err.message) || err}`;
  ERRLOG.push(line); if (ERRLOG.length > 200) ERRLOG.shift();
  try { if (window.skykerfDesktop && window.skykerfDesktop.log) window.skykerfDesktop.log(line) } catch (e) { }
}
