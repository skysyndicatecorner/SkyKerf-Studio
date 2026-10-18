'use strict';
/* global module */
/* ============================================================================
   SkyKerf_Studio · more vector formats: PDF and PDF-based AI, HPGL/PLT,
   LightBurn (.lbrn/.lbrn2). Outlines only; text, images and fills are skipped.
   Pure functions: bytes in → {pages:[{shapes:[{paths, closed}]}], warnings}.
   Coordinates are millimetres with Y up.
   ============================================================================ */

/* ---------------- PDF / AI (PDF-compatible) ---------------- */
async function parsePDF(bytes, inflate) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), N = u8.length, warn = new Set();
  const isWS = c => c === 32 || c === 10 || c === 13 || c === 9 || c === 12 || c === 0, isDelim = c => c === 40 || c === 41 || c === 60 || c === 62 || c === 91 || c === 93 || c === 123 || c === 125 || c === 47 || c === 37;
  const latin = (b, s, e) => { let t = ''; for (let i = s; i < e; i += 8192) t += String.fromCharCode.apply(null, b.subarray(i, Math.min(e, i + 8192))); return t };
  const text = latin(u8, 0, N);
  if (!text.startsWith('%PDF') && text.indexOf('%PDF') < 0 || text.indexOf('%PDF') > 1024) {
    if (/^%!PS/.test(text)) throw new Error('PostScript');
    throw new Error('not a PDF');
  }
  /* --- tokenizer over a byte array --- */
  function lexer(b, pos = 0, end = b.length) {
    const L = {
      pos,
      skip() { for (;;) { while (L.pos < end && isWS(b[L.pos])) L.pos++; if (b[L.pos] === 37) { while (L.pos < end && b[L.pos] !== 10 && b[L.pos] !== 13) L.pos++ } else break } },
      next() { // returns {t:'num'|'name'|'str'|'hex'|'op'|'['|']'|'<<'|'>>'|'eof', v}
        L.skip(); if (L.pos >= end) return { t: 'eof' };
        const c = b[L.pos];
        if (c === 47) { let s = ''; L.pos++; while (L.pos < end && !isWS(b[L.pos]) && !isDelim(b[L.pos])) { if (b[L.pos] === 35) { s += String.fromCharCode(parseInt(String.fromCharCode(b[L.pos + 1], b[L.pos + 2]), 16)); L.pos += 3 } else s += String.fromCharCode(b[L.pos++]) } return { t: 'name', v: s } }
        if (c === 40) { let d = 1; L.pos++; const s = L.pos; while (L.pos < end && d) { const x = b[L.pos]; if (x === 92) L.pos++; else if (x === 40) d++; else if (x === 41) d--; L.pos++ } return { t: 'str', v: null, s, e: L.pos - 1 } }
        if (c === 60 && b[L.pos + 1] === 60) { L.pos += 2; return { t: '<<' } }
        if (c === 62 && b[L.pos + 1] === 62) { L.pos += 2; return { t: '>>' } }
        if (c === 60) { L.pos++; while (L.pos < end && b[L.pos] !== 62) L.pos++; L.pos++; return { t: 'hex' } }
        if (c === 91 || c === 93 || c === 123 || c === 125) { L.pos++; return { t: c === 91 || c === 123 ? '[' : ']' } }
        if ((c >= 48 && c <= 57) || c === 45 || c === 43 || c === 46) { const s = L.pos; L.pos++; while (L.pos < end && ((b[L.pos] >= 48 && b[L.pos] <= 57) || b[L.pos] === 46 || b[L.pos] === 45)) L.pos++; return { t: 'num', v: parseFloat(latin(b, s, L.pos)) || 0 } }
        const s = L.pos; while (L.pos < end && !isWS(b[L.pos]) && !isDelim(b[L.pos])) L.pos++; if (L.pos === s) L.pos++; return { t: 'op', v: latin(b, s, L.pos) };
      },
    };
    return L;
  }
  /* --- objects: dict = Map-like plain object, ref = {ref:n} --- */
  function parseValue(L, tok) {
    tok = tok || L.next();
    if (tok.t === 'num') { // maybe "n g R"
      const save = L.pos, t2 = L.next(); if (t2.t === 'num') { const save2 = L.pos, t3 = L.next(); if (t3.t === 'op' && t3.v === 'R') return { ref: tok.v | 0 }; L.pos = save2 } L.pos = save; return tok.v;
    }
    if (tok.t === 'name') return { name: tok.v };
    if (tok.t === '[') { const a = []; for (;;) { const t = L.next(); if (t.t === ']' || t.t === 'eof') break; a.push(parseValue(L, t)) } return a }
    if (tok.t === '<<') { const d = {}; for (;;) { const t = L.next(); if (t.t === '>>' || t.t === 'eof') break; if (t.t !== 'name') continue; d[t.v] = parseValue(L) } return d }
    if (tok.t === 'op') return tok.v === 'true' ? true : tok.v === 'false' ? false : tok.v === 'null' ? null : { op: tok.v };
    return tok;
  }
  const objs = new Map();
  const re = /(\d+)\s+(\d+)\s+obj\b/g; let m;
  while ((m = re.exec(text))) {
    const num = +m[1], L = lexer(u8, m.index + m[0].length); let val;
    try { val = parseValue(L) } catch (e) { continue }
    const after = L.pos; L.skip(); let stream = null;
    if (text.startsWith('stream', L.pos)) {
      let s = L.pos + 6; if (u8[s] === 13) s++; if (u8[s] === 10) s++;
      let len = val && typeof val.Length === 'number' ? val.Length : -1;
      if (!(len >= 0 && text.startsWith('endstream', skipWS(s + len)))) { const e = text.indexOf('endstream', s); len = e < 0 ? 0 : e - s; while (len > 0 && (u8[s + len - 1] === 10 || u8[s + len - 1] === 13)) len-- }
      stream = { s, e: s + len }; re.lastIndex = s + len;
    } else re.lastIndex = Math.max(re.lastIndex, after);
    objs.set(num, { val, stream });
  }
  function skipWS(p) { while (p < N && isWS(u8[p])) p++; return p }
  const get = v => { let k = 0; while (v && typeof v === 'object' && 'ref' in v && k++ < 32) { const o = objs.get(v.ref); v = o ? o.val : null } return v };
  async function streamData(o) {
    if (!o || !o.stream) return new Uint8Array(0);
    let data = u8.subarray(o.stream.s, o.stream.e);
    let filters = get(o.val.Filter), parms = get(o.val.DecodeParms);
    if (!filters) return data; if (!Array.isArray(filters)) { filters = [filters]; parms = [parms] } else if (!Array.isArray(parms)) parms = filters.map(() => parms);
    for (let i = 0; i < filters.length; i++) {
      const f = get(filters[i]); const fname = f && f.name;
      if (fname === 'FlateDecode' || fname === 'Fl') { data = new Uint8Array(await inflate(data)); const p = get(parms[i]); if (p && get(p.Predictor) >= 10) data = unpredict(data, get(p.Columns) || 1, get(p.Colors) || 1, get(p.BitsPerComponent) || 8) }
      else if (fname === 'ASCIIHexDecode' || fname === 'AHx') data = ahx(data);
      else if (fname === 'ASCII85Decode' || fname === 'A85') data = a85(data);
      else if (fname === 'LZWDecode' || fname === 'LZW') data = lzw(data);
      else { warn.add('filter:' + fname); return new Uint8Array(0) }
    }
    return data;
  }
  // object streams (PDF 1.5+)
  for (const [, o] of [...objs]) {
    const v = o.val; if (!v || typeof v !== 'object' || !v.Type || v.Type.name !== 'ObjStm') continue;
    try {
      const d = await streamData(o), n = get(v.N) | 0, first = get(v.First) | 0, L = lexer(d), idx = [];
      for (let i = 0; i < n; i++) { const a = L.next(), b2 = L.next(); idx.push([a.v | 0, b2.v | 0]) }
      for (const [num, off] of idx) { if (objs.has(num) && objs.get(num).fromStm === false) continue; const L2 = lexer(d, first + off); objs.set(num, { val: parseValue(L2), stream: null, fromStm: true }) }
    } catch (e) { warn.add('objstm') }
  }
  if (/\/Encrypt\s/.test(text.slice(Math.max(0, N - 65536))) || [...objs.values()].some(o => o.val && o.val.Type && o.val.Type.name === 'XRef' && o.val.Encrypt)) throw new Error('encrypted');
  // page list
  let catalog = null; for (const [, o] of objs) if (o.val && o.val.Type && o.val.Type.name === 'Catalog') catalog = o.val;
  const pages = [];
  const walkPages = (node, inh, depth) => {
    node = get(node); if (!node || depth > 32) return;
    const I = Object.assign({}, inh); for (const k of ['Resources', 'MediaBox', 'CropBox', 'Rotate', 'UserUnit']) if (node[k] != null) I[k] = node[k];
    if (node.Type && node.Type.name === 'Page' || (!node.Kids && node.Contents)) pages.push({ node, inh: I });
    else for (const k of get(node.Kids) || []) walkPages(k, I, depth + 1);
  };
  if (catalog) walkPages(catalog.Pages, {}, 0);
  if (!pages.length) for (const [, o] of objs) if (o.val && o.val.Type && o.val.Type.name === 'Page') pages.push({ node: o.val, inh: o.val });
  const out = [];
  for (const pg of pages) {
    const res = get(pg.inh.Resources) || {}, unit = (get(pg.inh.UserUnit) || 1) * 25.4 / 72, shapes = [];
    let contents = get(pg.node.Contents); if (!Array.isArray(contents)) contents = [pg.node.Contents];
    const parts = []; for (const c of contents) { const ref = c && c.ref; const o = ref != null ? objs.get(ref) : null; if (o) parts.push(await streamData(o)) }
    const total = parts.reduce((a, p) => a + p.length + 1, 0), buf = new Uint8Array(total); let off = 0; for (const p of parts) { buf.set(p, off); off += p.length; buf[off++] = 10 }
    await runContent(buf, res, [unit, 0, 0, unit, 0, 0], shapes, 0);
    const mb = (get(pg.inh.CropBox) || get(pg.inh.MediaBox) || [0, 0, 595, 842]).map(get);
    out.push({ shapes, box: [mb[0] * unit, mb[1] * unit, mb[2] * unit, mb[3] * unit] });
  }
  return { pages: out, warnings: [...warn] };

  async function runContent(b, res, ctm0, shapes, depth) {
    if (depth > 12) return;
    const L = lexer(b), st = []; let ctm = ctm0.slice(), path = [], cur = null, start = null, ops = [];
    const T = (x, y) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];
    const flushPath = (paint) => {
      if (paint && path.length) {
        const closed = [], open = [];
        for (const sp of path) { if (sp.pts.length < 2) continue; (sp.closed ? closed : open).push(sp.pts) }
        if (closed.length) shapes.push({ paths: closed, closed: true }); for (const p of open) shapes.push({ paths: [p], closed: false });
      }
      path = []; cur = null; start = null;
    };
    const bezTo = (p1, p2, p3) => { const p0 = cur, Ln = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]), n = Math.max(3, Math.min(64, Math.ceil(Ln / .4))), sp = path[path.length - 1];
      for (let i = 1; i <= n; i++) { const s = i / n, u = 1 - s; sp.pts.push([u * u * u * p0[0] + 3 * u * u * s * p1[0] + 3 * u * s * s * p2[0] + s * s * s * p3[0], u * u * u * p0[1] + 3 * u * u * s * p1[1] + 3 * u * s * s * p2[1] + s * s * s * p3[1]]) } cur = p3 };
    for (;;) {
      const tok = L.next(); if (tok.t === 'eof') break;
      if (tok.t !== 'op') { if (tok.t === '[' ) { L.pos--; ops.push(parseValue(L)) } else if (tok.t === '<<') { L.pos -= 2; ops.push(parseValue(L)) } else ops.push(tok.t === 'num' ? tok.v : tok.t === 'name' ? { name: tok.v } : tok); continue }
      const o = tok.v, a = ops; ops = [];
      const n = i => typeof a[i] === 'number' ? a[i] : 0;
      switch (o) {
        case 'q': st.push(ctm.slice()); break;
        case 'Q': if (st.length) ctm = st.pop(); break;
        case 'cm': { const m2 = [n(0), n(1), n(2), n(3), n(4), n(5)]; ctm = [m2[0] * ctm[0] + m2[1] * ctm[2], m2[0] * ctm[1] + m2[1] * ctm[3], m2[2] * ctm[0] + m2[3] * ctm[2], m2[2] * ctm[1] + m2[3] * ctm[3], m2[4] * ctm[0] + m2[5] * ctm[2] + ctm[4], m2[4] * ctm[1] + m2[5] * ctm[3] + ctm[5]]; break }
        case 'm': cur = T(n(0), n(1)); start = cur; path.push({ pts: [cur], closed: false }); break;
        case 'l': if (!cur) { cur = T(n(0), n(1)); start = cur; path.push({ pts: [cur], closed: false }) } else { cur = T(n(0), n(1)); path[path.length - 1].pts.push(cur) } break;
        case 'c': if (cur) bezTo(T(n(0), n(1)), T(n(2), n(3)), T(n(4), n(5))); break;
        case 'v': if (cur) bezTo(cur, T(n(0), n(1)), T(n(2), n(3))); break;
        case 'y': if (cur) { const p3 = T(n(2), n(3)); bezTo(T(n(0), n(1)), p3, p3) } break;
        case 'h': if (path.length) { const sp = path[path.length - 1]; sp.closed = true; const f = sp.pts[0], l = sp.pts[sp.pts.length - 1]; if (sp.pts.length > 2 && Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-6) sp.pts.pop(); cur = start } break;
        case 're': { const x = n(0), y = n(1), w = n(2), h = n(3); path.push({ pts: [T(x, y), T(x + w, y), T(x + w, y + h), T(x, y + h)], closed: true }); cur = T(x, y); start = cur; break }
        case 'S': case 'f': case 'F': case 'f*': case 'B': case 'B*': flushPath(true); break;
        case 's': case 'b': case 'b*': if (path.length) path[path.length - 1].closed = true; flushPath(true); break;
        case 'n': flushPath(false); break;
        case 'BT': warn.add('text'); break;
        case 'BI': { // inline image: skip to EI
          const s = L.pos, e = latin(b, s, Math.min(b.length, s + (1 << 22))).search(/\sEI[\s]/); L.pos = e < 0 ? b.length : s + e + 3; warn.add('image'); break }
        case 'Do': {
          const nm = a[0] && a[0].name, xo = get((get(res.XObject) || {})[nm]); const ref = (get(res.XObject) || {})[nm];
          if (!xo) break;
          if (xo.Subtype && xo.Subtype.name === 'Form') {
            const o2 = ref && ref.ref != null ? objs.get(ref.ref) : null; const d = await streamData(o2); const mx = (get(xo.Matrix) || [1, 0, 0, 1, 0, 0]).map(get);
            const c2 = [mx[0] * ctm[0] + mx[1] * ctm[2], mx[0] * ctm[1] + mx[1] * ctm[3], mx[2] * ctm[0] + mx[3] * ctm[2], mx[2] * ctm[1] + mx[3] * ctm[3], mx[4] * ctm[0] + mx[5] * ctm[2] + ctm[4], mx[4] * ctm[1] + mx[5] * ctm[3] + ctm[5]];
            await runContent(d, get(xo.Resources) || res, c2, shapes, depth + 1);
          } else warn.add('image');
          break;
        }
        case 'sh': warn.add('shading'); break;
      }
    }
  }
  function unpredict(d, cols, colors, bpc) {
    const bpp = Math.max(1, colors * bpc / 8 | 0), row = Math.ceil(cols * colors * bpc / 8), out = new Uint8Array(Math.floor(d.length / (row + 1)) * row); let prev = new Uint8Array(row);
    for (let r = 0, o = 0; (r + 1) * (row + 1) <= d.length; r++) {
      const t = d[r * (row + 1)], line = d.subarray(r * (row + 1) + 1, (r + 1) * (row + 1)), cur = new Uint8Array(row);
      for (let i = 0; i < row; i++) { const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = line[i]; if (t === 1) v += a; else if (t === 2) v += b; else if (t === 3) v += (a + b) >> 1; else if (t === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c } cur[i] = v & 255 }
      out.set(cur, o); o += row; prev = cur;
    }
    return out;
  }
  function ahx(d) { const s = latin(d, 0, d.length).replace(/[^0-9a-f]/gi, ''), o = new Uint8Array(Math.ceil(s.length / 2)); for (let i = 0; i < o.length; i++) o[i] = parseInt((s.substr(i * 2, 2) + '0').slice(0, 2), 16); return o }
  function a85(d) { const s = latin(d, 0, d.length).replace(/\s/g, '').replace(/^<~/, '').replace(/~>.*$/, ''), o = []; for (let i = 0; i < s.length;) { if (s[i] === 'z') { o.push(0, 0, 0, 0); i++; continue } const g = s.substr(i, 5); i += 5; let v = 0; for (let k = 0; k < 5; k++) v = v * 85 + ((k < g.length ? g.charCodeAt(k) : 117) - 33); const bytes = [v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255]; o.push(...bytes.slice(0, g.length - 1)) } return new Uint8Array(o) }
  function lzw(d) { const out = []; let dict = [], code = 0, bits = 9, buf = 0, nb = 0, prev = null; const reset = () => { dict = []; for (let i = 0; i < 256; i++) dict.push([i]); dict.push(null, null); bits = 9 }; reset();
    for (let i = 0; i < d.length; i++) { buf = buf << 8 | d[i]; nb += 8; while (nb >= bits) { code = buf >> (nb - bits) & ((1 << bits) - 1); nb -= bits; if (code === 256) { reset(); prev = null; continue } if (code === 257) return new Uint8Array(out); let e = dict[code]; if (!e && prev) e = prev.concat([prev[0]]); if (!e) continue; out.push(...e); if (prev) dict.push(prev.concat([e[0]])); prev = e; if (dict.length + 1 >= 1 << bits && bits < 12) bits++ } }
    return new Uint8Array(out) }
}

/* ---------------- HPGL / PLT ---------------- */
function parseHPGL(text) {
  const shapes = [], warn = new Set(); let x = 0, y = 0, down = false, rel = false, cur = null, scale = 1 / 40; // 40 plotter units per mm
  const flush = () => { if (cur && cur.length > 1) { const f = cur[0], l = cur[cur.length - 1], cl = cur.length > 2 && Math.hypot(f[0] - l[0], f[1] - l[1]) < .01; shapes.push({ paths: [cl ? cur.slice(0, -1) : cur], closed: cl }) } cur = null };
  const cmds = text.replace(/\x1b[^A-Za-z]*[A-Za-z]/g, '').split(/;|\n|\r/).map(s => s.trim()).filter(Boolean);
  for (const c of cmds) {
    let i = 0; while (i < c.length) {
      const op = c.substr(i, 2).toUpperCase(); let j = i + 2; while (j < c.length && !/[A-Za-z]/.test(c[j])) j++;
      const args = c.slice(i + 2, j).split(/[\s,]+/).filter(s => s !== '').map(Number).filter(v => isFinite(v)); i = j;
      const move = (pd) => { if (!args.length) { if (pd !== null) { if (!pd) flush(); down = pd } return } for (let k = 0; k + 1 < args.length; k += 2) { const nx = rel ? x + args[k] : args[k], ny = rel ? y + args[k + 1] : args[k + 1]; if (down) { if (!cur) cur = [[x * scale, y * scale]]; cur.push([nx * scale, ny * scale]) } x = nx; y = ny } };
      switch (op) {
        case 'IN': case 'DF': flush(); x = y = 0; down = false; rel = false; break;
        case 'PU': flush(); down = false; move(null); break;
        case 'PD': down = true; move(null); break;
        case 'PA': rel = false; move(null); break;
        case 'PR': rel = true; move(null); break;
        case 'CI': { const r = (args[0] || 0) * scale, pts = []; for (let k = 0; k < 72; k++) { const a = k / 72 * Math.PI * 2; pts.push([x * scale + r * Math.cos(a), y * scale + r * Math.sin(a)]) } shapes.push({ paths: [pts], closed: true }); break }
        case 'AA': case 'AR': { const cx = op === 'AR' ? x + args[0] : args[0], cy = op === 'AR' ? y + args[1] : args[1], sw = (args[2] || 0) * Math.PI / 180, r = Math.hypot(x - cx, y - cy), a0 = Math.atan2(y - cy, x - cx), n = Math.max(4, Math.ceil(Math.abs(sw) * r * scale / .5)); if (down && !cur) cur = [[x * scale, y * scale]]; for (let k = 1; k <= n; k++) { const a = a0 + sw * k / n; x = cx + r * Math.cos(a); y = cy + r * Math.sin(a); if (down) cur.push([x * scale, y * scale]) } break }
        case 'SP': case 'VS': case 'LT': case 'SC': case 'IP': case 'PW': case 'WU': case 'SI': case 'DT': case 'FS': case 'PG': case 'RO': case 'NP': case 'PS': case 'IW': case 'BP': case 'PM': case 'FP': case 'EP': case 'CT': break;
        case 'LB': warn.add('text'); i = c.length; break;
        default: if (/^[A-Z]{2}$/.test(op)) warn.add('cmd:' + op);
      }
    }
  }
  flush();
  return { pages: [{ shapes }], warnings: [...warn] };
}

/* ---------------- LightBurn (.lbrn / .lbrn2) ---------------- */
function parseLBRN(text, DOMParserImpl) {
  const doc = new (DOMParserImpl || DOMParser)().parseFromString(text, 'text/xml'), root = doc.documentElement, shapes = [], warn = new Set();
  if (!root || root.nodeName !== 'LightBurnProject') throw new Error('not a LightBurn project');
  const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  const xf = el => { const x = [...el.children].find(c => c.nodeName === 'XForm'); if (!x) return [1, 0, 0, 1, 0, 0]; const v = x.textContent.trim().split(/\s+/).map(Number); return v.length === 6 && v.every(isFinite) ? v : [1, 0, 0, 1, 0, 0] };
  const ap = (M, p) => [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
  const num = (el, k, d = 0) => { const v = parseFloat(el.getAttribute(k)); return isFinite(v) ? v : d };
  const cubic = (p0, p1, p2, p3, out) => { const n = Math.max(4, Math.min(48, Math.ceil((Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1])) / .4))); for (let i = 1; i <= n; i++) { const s = i / n, u = 1 - s; out.push([u * u * u * p0[0] + 3 * u * u * s * p1[0] + 3 * u * s * s * p2[0] + s * s * s * p3[0], u * u * u * p0[1] + 3 * u * u * s * p1[1] + 3 * u * s * s * p2[1] + s * s * s * p3[1]]) } };
  function pathShape(el, M) {
    const vl = [...el.children].find(c => c.nodeName === 'VertList'), pl = [...el.children].find(c => c.nodeName === 'PrimList');
    if (!vl) return;
    const V = [];
    if (vl.children.length) for (const v of vl.children) V.push({ p: [num(v, 'x'), num(v, 'y')], c0: v.hasAttribute('c0x') ? [num(v, 'c0x'), num(v, 'c0y')] : null, c1: v.hasAttribute('c1x') ? [num(v, 'c1x'), num(v, 'c1y')] : null });
    else { const t = vl.textContent; const re = /V\s*([-\d.eE+]+)\s+([-\d.eE+]+)((?:c[01][xy][-\d.eE+]+)*)/g; let m; while ((m = re.exec(t))) { const v = { p: [+m[1], +m[2]], c0: null, c1: null }, cs = m[3] || ''; const g = k => { const r = new RegExp(k + '([-\\d.eE+]+)').exec(cs); return r ? +r[1] : null }; if (g('c0x') != null && g('c0y') != null) v.c0 = [g('c0x'), g('c0y')]; if (g('c1x') != null && g('c1y') != null) v.c1 = [g('c1x'), g('c1y')]; V.push(v) } }
    const prims = [];
    if (pl && pl.children.length) for (const p of pl.children) prims.push([num(p, 'type') === 1 ? 'B' : 'L', num(p, 'p0') | 0, num(p, 'p1') | 0]);
    else if (pl) { const re = /([LB])\s*(\d+)\s+(\d+)/g; let m; while ((m = re.exec(pl.textContent))) prims.push([m[1], +m[2], +m[3]]) }
    else for (let i = 0; i + 1 < V.length; i++) prims.push(['L', i, i + 1]);
    let cur = null; const subs = [];
    for (const [k, a, b] of prims) {
      const A = V[a], B = V[b]; if (!A || !B) continue;
      if (!cur || cur.last !== a) { cur = { pts: [ap(M, A.p)], first: a, last: a }; subs.push(cur) }
      if (k === 'B' && A.c0 && B.c1) { const t = []; cubic(ap(M, A.p), ap(M, A.c0), ap(M, B.c1), ap(M, B.p), t); cur.pts.push(...t) } else cur.pts.push(ap(M, B.p));
      cur.last = b;
    }
    const closed = [], open = [];
    for (const s of subs) { if (s.last === s.first && s.pts.length > 2) { s.pts.pop(); closed.push(s.pts) } else if (s.pts.length > 1) open.push(s.pts) }
    if (closed.length) shapes.push({ paths: closed, closed: true }); for (const p of open) shapes.push({ paths: [p], closed: false });
  }
  function walk(el, M) {
    for (const c of el.children) {
      if (c.nodeName !== 'Shape') continue;
      const T = c.getAttribute('Type'), N = mul(M, xf(c));
      if (T === 'Group') { const ch = [...c.children].find(x => x.nodeName === 'Children'); if (ch) walk(ch, N) }
      else if (T === 'Rect') { const w = num(c, 'W'), h = num(c, 'H'), r = Math.min(num(c, 'Cr'), w / 2, h / 2), pts = []; if (r > 0) { for (const [cx, cy, a0] of [[w / 2 - r, -h / 2 + r, -Math.PI / 2], [w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI]]) for (let i = 0; i <= 8; i++) { const a = a0 + i / 8 * Math.PI / 2; pts.push(ap(N, [cx + r * Math.cos(a), cy + r * Math.sin(a)])) } } else for (const p of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) pts.push(ap(N, p)); shapes.push({ paths: [pts], closed: true }) }
      else if (T === 'Ellipse') { const rx = num(c, 'Rx'), ry = num(c, 'Ry'), n = Math.max(32, Math.ceil((rx + ry) * 2)), pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push(ap(N, [rx * Math.cos(a), ry * Math.sin(a)])) } shapes.push({ paths: [pts], closed: true }) }
      else if (T === 'Path' || T === 'Polygon' || T === 'Polyline') pathShape(c, N);
      else if (T === 'Text') { const bp = [...c.children].find(x => x.nodeName === 'BackupPath'); if (bp) pathShape(bp, mul(N, xf(bp))); else warn.add('text') }
      else if (T === 'Bitmap') warn.add('image');
      else warn.add('shape:' + T);
    }
  }
  walk(root, [1, 0, 0, 1, 0, 0]);
  return { pages: [{ shapes }], warnings: [...warn] };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { parsePDF, parseHPGL, parseLBRN };
