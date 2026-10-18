'use strict';
/* global module */
/* ============================================================================
   SkyKerf_Studio · font file names (TrueType / OpenType / collections / WOFF)
   Reads the family, style, weight and italic flag from the 'name' and 'OS/2'
   tables. Shared by the desktop shell (folder scan) and the page (fonts the
   user loads from a file). No font data is changed or sent anywhere.
   ============================================================================ */
function parseFontNames(bytes, opts) {
  opts = opts || {};
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const tag = o => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  const u16 = o => dv.getUint16(o), u32 = o => dv.getUint32(o);
  const sig = tag(0), faces = [];
  if (sig === 'ttcf') { const n = Math.min(u32(8), 64); for (let i = 0; i < n; i++) { const f = sfnt(u32(12 + i * 4), i); if (f) faces.push(f) } }
  else if (sig === 'wOFF') { const f = woff(); if (f) faces.push(f) }
  else { const f = sfnt(0, 0); if (f) faces.push(f) }
  return faces;

  function decodeName(off, len, platform) {
    if (platform === 0 || platform === 3) { let s = ''; for (let i = 0; i + 1 < len; i += 2) s += String.fromCharCode(u16(off + i)); return s }
    let s = ''; for (let i = 0; i < len; i++) s += String.fromCharCode(u8[off + i]); return s;
  }
  function readNames(nameOff, getBytes) {
    const t = getBytes ? getBytes : null, base = nameOff, count = u16(base + 2), strOff = base + u16(base + 4), best = {};
    for (let i = 0; i < count; i++) {
      const r = base + 6 + i * 12, platform = u16(r), langId = u16(r + 4), nameId = u16(r + 6), len = u16(r + 8), off = strOff + u16(r + 10);
      if (![1, 2, 4, 16, 17].includes(nameId) || off + len > u8.length) continue;
      const score = (platform === 3 ? 4 : platform === 0 ? 3 : 1) * 10 + (langId === 0x409 || (platform === 1 && langId === 0) ? 5 : 0);
      if (!best[nameId] || best[nameId].score < score) best[nameId] = { score, v: decodeName(off, len, platform).replace(/\u0000/g, '').trim() };
    }
    return best;
  }
  function fromTables(get) {
    const name = get('name'); if (name == null) return null;
    const nm = readNames(name), os2 = get('OS/2');
    let weight = 400, italic = false;
    if (os2 != null) { weight = u16(os2 + 4) || 400; italic = !!(u16(os2 + 62) & 1) }
    const family = (nm[16] && nm[16].v) || (nm[1] && nm[1].v), style = (nm[17] && nm[17].v) || (nm[2] && nm[2].v) || 'Regular';
    if (!family) return null;
    if (/italic|oblique|курсив/i.test(style)) italic = true;
    if (weight < 100 || weight > 1000) weight = 400;
    return { family, style, full: (nm[4] && nm[4].v) || family + ' ' + style, weight: Math.round(weight / 100) * 100 || 400, italic };
  }
  function sfnt(off, index) {
    if (off + 12 > u8.length) return null;
    const n = u16(off + 4), dir = {};
    for (let i = 0; i < n; i++) { const r = off + 12 + i * 16; if (r + 16 > u8.length) break; dir[tag(r)] = { o: u32(r + 8), l: u32(r + 12) } }
    const f = fromTables(t => dir[t] && dir[t].o + dir[t].l <= u8.length ? dir[t].o : null); if (f) f.index = index; return f;
  }
  function woff() {
    // WOFF 1.0: tables may be zlib-compressed; the desktop shell passes opts.inflate
    const n = u16(12), dir = {};
    for (let i = 0; i < n; i++) { const r = 44 + i * 20; dir[tag(r)] = { o: u32(r + 4), cl: u32(r + 8), l: u32(r + 12) } }
    const want = ['name', 'OS/2'], plain = {};
    for (const t of want) { const e = dir[t]; if (!e) continue; let b = u8.subarray(e.o, e.o + e.cl); if (e.cl < e.l) { if (!opts.inflate) return null; b = new Uint8Array(opts.inflate(b)) } plain[t] = b }
    if (!plain.name) return null;
    // rebuild a tiny sfnt with just these tables and parse it
    const tables = Object.keys(plain), hdr = 12 + tables.length * 16; let size = hdr; const offs = {};
    for (const t of tables) { offs[t] = size; size += plain[t].length + ((4 - plain[t].length % 4) % 4) }
    const out = new Uint8Array(size), odv = new DataView(out.buffer);
    odv.setUint32(0, 0x00010000); odv.setUint16(4, tables.length);
    tables.forEach((t, i) => { const r = 12 + i * 16; for (let k = 0; k < 4; k++) out[r + k] = t.charCodeAt(k); odv.setUint32(r + 8, offs[t]); odv.setUint32(r + 12, plain[t].length); out.set(plain[t], offs[t]) });
    return parseFontNames(out)[0] || null;
  }
}
const FONT_FILE_RE = /\.(ttf|otf|ttc|otc|woff|woff2)$/i;
if (typeof module !== 'undefined' && module.exports) module.exports = { parseFontNames, FONT_FILE_RE };
