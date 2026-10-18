'use strict';
/* ============================================================================
   SkyKerf_Studio · text and fonts (spec 8)
   Bundled fonts (OFL, shipped with the app) + installed system fonts via the
   Local Font Access API. Text stays editable in the project; the outlines are
   regenerated from the stored spec. Missing fonts are reported on open.
   ============================================================================ */
const BUNDLED_FONTS = {
  plex: { family: 'IBM Plex Sans', n: 'IBM Plex Sans', w: 600 },
  unb: { family: 'Unbounded', n: 'Unbounded', w: 700 },
  mono: { family: 'JetBrains Mono', n: 'JetBrains Mono', w: 700 },
  serif: { family: 'PT Serif', n: 'PT Serif', w: 700 },
  hand: { family: 'Caveat', n: 'Caveat', w: 600 },
};
const BUNDLED_FAMILIES = new Set(Object.values(BUNDLED_FONTS).map(f => f.family));
/* Computer fonts (spec 8). Desktop: every font file in the system and user font folders
   plus folders the user added, read by the shell and loaded with FontFace on demand.
   Browser: Local Font Access when allowed. Both: fonts loaded from a file are kept in the
   user's font library (IndexedDB) on this computer. */
let systemFonts = null; // [{family, faces:[{weight, italic, style, path|blob|local}], src:'file'|'local'|'user'}]
const FONT_LOADED = new Set(), FONT_LOADING = new Map();
const fontFamily = f => (BUNDLED_FONTS[f] ? BUNDLED_FONTS[f].family : f) || 'IBM Plex Sans';
const fontLabel = f => BUNDLED_FONTS[f] ? BUNDLED_FONTS[f].n : f;
function defaultWeight(f) { if (BUNDLED_FONTS[f]) return BUNDLED_FONTS[f].w; const e = fontEntry(f); if (e) { const ws = e.faces.filter(x => !x.italic).map(x => x.weight); if (ws.length) return ws.includes(400) ? 400 : ws.sort((a, b) => Math.abs(a - 400) - Math.abs(b - 400))[0] } return 400 }
const fontEntry = f => systemFonts && systemFonts.find(x => x.family === f) || null;
function groupFaces(list, src) {
  const map = new Map();
  for (const f of list) { if (!f.family) continue; const e = map.get(f.family) || { family: f.family, faces: [], src }; e.faces.push(f); map.set(f.family, e) }
  return [...map.values()];
}
/* ---- user font library (fonts loaded from files), IndexedDB ---- */
function fontDb() { return new Promise((res, rej) => { try { const r = indexedDB.open('skykerf-fonts', 1); r.onupgradeneeded = () => r.result.createObjectStore('fonts', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) } catch (e) { rej(e) } }) }
async function userFontList() { try { const db = await fontDb(); return await new Promise((res, rej) => { const q = db.transaction('fonts').objectStore('fonts').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error) }) } catch (e) { return [] } }
async function addUserFont(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let faces = []; try { faces = parseFontNames(buf) } catch (e) { }
  if (!faces.length) faces = [{ family: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), style: 'Regular', weight: 400, italic: false }];
  const f = faces[0], rec = { id: f.family + '|' + f.weight + '|' + (f.italic ? 'i' : 'n'), family: f.family, style: f.style, weight: f.weight, italic: f.italic, name: file.name, data: buf.buffer };
  // check the browser can actually use it before keeping it
  const ff = new FontFace(f.family, buf.buffer, { weight: String(f.weight), style: f.italic ? 'italic' : 'normal' }); await ff.load(); document.fonts.add(ff); FONT_LOADED.add(f.family);
  try { const db = await fontDb(); await new Promise((res, rej) => { const t = db.transaction('fonts', 'readwrite'); t.objectStore('fonts').put(rec); t.oncomplete = res; t.onerror = () => rej(t.error) }) } catch (e) { logError('font-db', e) }
  systemFonts = null; await loadSystemFonts(true); return f.family;
}
async function loadSystemFonts(silent) {
  if (systemFonts) return systemFonts;
  const out = [], seen = new Set(), push = e => { if (seen.has(e.family) || BUNDLED_FAMILIES.has(e.family)) return; seen.add(e.family); out.push(e) };
  for (const e of groupFaces((await userFontList()).map(r => ({ family: r.family, style: r.style, weight: r.weight, italic: r.italic, rec: r.id })), 'user')) push(e);
  let err = null;
  if (window.skykerfDesktop && window.skykerfDesktop.listFonts) { try { for (const e of groupFaces(await window.skykerfDesktop.listFonts(), 'file')) push(e) } catch (e) { err = e } }
  else if (typeof window.queryLocalFonts === 'function') { try { const list = await window.queryLocalFonts(); for (const e of groupFaces(list.map(f => ({ family: f.family, style: f.style, weight: /bold|black|heavy/i.test(f.style) ? 700 : /light|thin/i.test(f.style) ? 300 : 400, italic: /italic|oblique/i.test(f.style), local: true })), 'local')) push(e) } catch (e) { err = e } }
  else err = new Error(T('Браузер не даёт доступ к шрифтам компьютера. Загрузите нужный шрифт из файла (.ttf, .otf, .woff) или используйте настольную версию — она видит все шрифты на компьютере.', 'The browser does not expose your computer’s fonts. Load a font from a file (.ttf, .otf, .woff) or use the desktop app, which sees every font on the computer.'));
  out.sort((a, b) => a.family.localeCompare(b.family));
  systemFonts = out;
  if (err && !silent && !out.length) throw err;
  return systemFonts;
}
/* Make a family usable by canvas text. Bundled fonts are always there; computer fonts are
   loaded from their files (all faces of the family) the first time they are needed. */
async function ensureFont(f) {
  const fam = fontFamily(f); if (BUNDLED_FAMILIES.has(fam) || FONT_LOADED.has(fam)) return true;
  if (FONT_LOADING.has(fam)) return FONT_LOADING.get(fam);
  const job = (async () => {
    if (!systemFonts) { try { await loadSystemFonts(true) } catch (e) { } }
    const e = fontEntry(fam); if (!e) return false; let n = 0;
    for (const face of e.faces.slice(0, 24)) {
      try {
        let data = null;
        if (face.path && window.skykerfDesktop) data = await window.skykerfDesktop.fontData(face.path);
        else if (face.rec) { const rec = (await userFontList()).find(r => r.id === face.rec); data = rec && rec.data }
        else if (face.local) { n++; continue } // installed font: the browser draws it by name
        if (!data) continue;
        const buf = data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        const ff = new FontFace(fam, buf, { weight: String(face.weight || 400), style: face.italic ? 'italic' : 'normal' }); await ff.load(); document.fonts.add(ff); n++;
      } catch (err) { logError('font ' + fam, err) }
    }
    if (n) FONT_LOADED.add(fam); return n > 0;
  })();
  FONT_LOADING.set(fam, job); const ok = await job; FONT_LOADING.delete(fam); return ok;
}
/* A font is present if it is bundled, loaded, known on this computer, or text measures differently from fallbacks. */
const fontProbe = { c: null };
function fontAvailable(f) {
  const fam = fontFamily(f); if (BUNDLED_FAMILIES.has(fam) || FONT_LOADED.has(fam)) return true;
  if (systemFonts && systemFonts.some(x => x.family === fam)) return true;
  try {
    const c = fontProbe.c || (fontProbe.c = document.createElement('canvas').getContext('2d')), s = 'mmmmmmmmmlliWWQ@#ЖЩя';
    for (const fb of ['monospace', 'serif']) { c.font = `40px ${fb}`; const a = c.measureText(s).width; c.font = `40px "${fam}", ${fb}`; if (Math.abs(c.measureText(s).width - a) > .5) return true }
  } catch (e) { return true }
  return false;
}
function missingFonts(st) { const fams = new Set(); for (const s of (st || S).shapes) if (s.kind === 'text' && s.font && !fontAvailable(s.font)) fams.add(fontFamily(s.font)); return [...fams] }

/* spec: {text, font, weight, italic, size, ls, lh, align, arc} → closed loops in mm, bbox min at (0,0) */
const textCache = new Map();
function textSpec(o) { return { text: String(o.text ?? ''), font: o.font || 'plex', weight: o.weight || defaultWeight(o.font || 'plex'), italic: !!o.italic, size: Math.max(.5, +o.size || 10), ls: +o.ls || 0, lh: +o.lh || 1.2, align: o.align || 'left', arc: +o.arc || 0 } }
async function makeTextPaths(specOrText, font, size) {
  const sp = typeof specOrText === 'object' ? textSpec(specOrText) : textSpec({ text: specOrText, font, size });
  const key = JSON.stringify(sp); if (textCache.has(key)) return textCache.get(key);
  const fam = fontFamily(sp.font), k = clamp(240 / sp.size, 4, 24), px = sp.size * k;
  const css = `${sp.italic ? 'italic ' : ''}${sp.weight} ${px}px "${fam}", "IBM Plex Sans", sans-serif`;
  try { await ensureFont(sp.font) } catch (e) { }
  try { await document.fonts.load(css, sp.text || 'A') } catch (e) { }
  const lines = sp.text.split('\n'), c = document.createElement('canvas'), x = c.getContext('2d');
  const setup = () => { x.font = css; x.fillStyle = '#000'; x.textBaseline = 'alphabetic'; try { x.letterSpacing = (sp.ls * k) + 'px' } catch (e) { } };
  setup();
  let W, H;
  if (sp.arc && lines.length === 1) {
    const R = Math.abs(sp.arc) * k, txt = lines[0], adv = [...txt].map(ch => x.measureText(ch).width + sp.ls * k), tot = adv.reduce((a, b) => a + b, 0);
    const span = tot / R; if (span > Math.PI * 1.95) { const r = []; textCache.set(key, r); return r }
    W = H = Math.ceil(2 * (R + px * 1.4)); c.width = W; c.height = H; setup();
    const cx = W / 2, cy = H / 2, up = sp.arc > 0; let a = -span / 2;
    [...txt].forEach((ch, i) => {
      const mid = a + adv[i] / 2 / R; x.save(); x.translate(cx, cy); x.rotate(up ? mid : -mid); x.textAlign = 'center';
      if (up) x.fillText(ch, 0, -R); else { x.rotate(Math.PI); x.fillText(ch, 0, -R + px * .72) } x.restore(); a += adv[i] / R;
    });
  } else {
    const lh = px * sp.lh, widths = lines.map(l => x.measureText(l).width), lw = Math.max(1, ...widths);
    W = Math.ceil(lw + px * .5); H = Math.ceil(lh * (lines.length - 1) + px * 1.4); c.width = W; c.height = H; setup();
    lines.forEach((l, i) => { const off = sp.align === 'center' ? (lw - widths[i]) / 2 : sp.align === 'right' ? lw - widths[i] : 0; x.fillText(l, px * .25 + off, px * .1 + px * .95 + i * lh) });
  }
  const d = x.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H); for (let i = 0; i < m.length; i++)m[i] = d[i * 4 + 3] > 110 ? 1 : 0;
  let loops = traceMask(m, W, H).map(l => rdpClosed(l, .45)).filter(l => l.length > 2 && Math.abs(area(l)) > 2);
  loops = loops.map(l => l.map(([X, Y]) => [X / k, (H - Y) / k]));
  let res = []; if (loops.length) { const b = bboxOf(loops); res = mapPaths(loops, (X, Y) => [X - b[0], Y - b[1]]) }
  if (textCache.size > 300) textCache.clear();
  textCache.set(key, res); return res;
}
async function textAt(text, font, size, cx, cy) { const p = await makeTextPaths({ text, font, size }); if (!p.length) return []; const b = bboxOf(p); return mapPaths(p, (x, y) => [x - (b[2] - b[0]) / 2 + cx, y - (b[3] - b[1]) / 2 + cy]) }
/* Rebuild a text shape's outlines from its spec, keeping its centre and rotation. */
async function rebuildText(s, spec) {
  const sp = textSpec(Object.assign({}, s, spec || {})), paths = await makeTextPaths(sp); if (!paths.length) return false;
  const b = bboxOf(s.paths), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, nb = bboxOf(paths);
  let np = mapPaths(paths, (x, y) => [x - (nb[2] - nb[0]) / 2 + cx, y - (nb[3] - nb[1]) / 2 + cy]); if (s.rot) np = rotPaths(np, s.rot, cx, cy);
  Object.assign(s, sp, { paths: np }); return true;
}
