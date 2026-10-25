'use strict';
/* global module */
/* ============================================================================
   SkyKerf_Studio · CorelDRAW (.cdr) reader — outlines only
   Supports CorelDRAW 6…X8+ files: plain RIFF (CDR6–X3), zipped riffData.cdr
   (X4–X5) and zipped root.dat with data streams (X6 and newer). Reads
   rectangles, ellipses and arcs, curves, polygons and stars with their
   transforms, plus the outline colour/width and solid fill colour of every
   object, so cut and engrave lines keep the meaning they had in CorelDRAW.
   Text, bitmaps, effects and gradient fills are skipped (reported).
   Written from the public description of the format (libcdr, MPL 2.0) —
   no code copied. Untested versions are reported as such.
   ============================================================================ */
async function parseCDR(bytes, inflate, inflateRaw) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const str = (b, o, n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(b[o + i]); return s };
  const warn = new Set(), pages = [], OUTL = new Map(), FILD = new Map();
  let version = 0;
  if (str(u8, 0, 4) === 'RIFF') { version = riffVersion(u8); await walkRiff(u8, null) }
  else if (u8[0] === 0x50 && u8[1] === 0x4b) {
    const zip = readZip(u8), get = async n => { const e = zip.get(n) || [...zip.entries()].find(([k]) => k.toLowerCase() === n.toLowerCase())?.[1]; if (!e) return null; return e.method === 8 ? new Uint8Array(await inflateRaw(e.data)) : e.data };
    const riff = await get('content/riffData.cdr');
    if (riff) { version = riffVersion(riff); await walkRiff(riff, null) }
    else {
      const root = await get('content/root.dat'); if (!root) throw new Error('not a CorelDRAW file');
      const list = await get('content/dataFileList.dat'), names = list ? new TextDecoder().decode(list).split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];
      const streams = []; for (const n of names) streams.push(await get('content/data/' + n));
      version = 1600; await walkRiff(root, streams);
    }
  } else if (str(u8, 0, 4) === 'WL\u0000\u0000' || str(u8, 0, 2) === 'WL') throw new Error('CorelDRAW 1–5 files are not supported');
  else throw new Error('not a CorelDRAW file');
  return { pages, version, warnings: [...warn] };

  /* ---------------- containers ---------------- */
  function riffVersion(b) { const c = b[11]; if (c >= 0x41 && c <= 0x5a) return (c - 0x41 + 10) * 100; if (c >= 0x30 && c <= 0x39) return (c - 0x30) * 100; return 1300 }
  function readZip(b) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); let e = b.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error('broken ZIP');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = new Map();
    for (let i = 0; i < n; i++) {
      const m = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), fl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + fl)), lfl = dv.getUint16(lo + 26, true), lxl = dv.getUint16(lo + 28, true), d0 = lo + 30 + lfl + lxl;
      out.set(name, { method: m, data: b.subarray(d0, d0 + cs) }); p += 46 + fl + xl + cl;
    }
    return out;
  }
  async function walkRiff(b, streams) {
    const ctx = { page: null, stack: [], obj: null, version };
    await walk(b, 12, b.length, null, streams, ctx);
  }
  async function unpackCmpr(b, p, end) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), cs = dv.getUint32(p, true), bl = dv.getUint32(p + 8, true);
    const z = async (o, n) => { let s = o; if (str(b, s, 4) === 'CPng') s += 8; return new Uint8Array(await inflate(b.subarray(s, Math.min(end, o + n)))) };
    const data = await z(p + 16, cs), bd = await z(p + 16 + cs, bl), bdv = new DataView(bd.buffer, bd.byteOffset, bd.byteLength), blocks = [];
    for (let i = 0; i + 4 <= bd.length; i += 4) blocks.push(bdv.getUint32(i, true));
    return { data, blocks };
  }
  async function walk(b, off, end, blocks, streams, ctx) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    while (off + 8 <= end) {
      const id = str(b, off, 4); let len = dv.getUint32(off + 4, true);
      if (blocks) len = blocks[len] ?? 0;
      if (id === 'LIST' || id === 'RIFF') {
        const t = str(b, off + 8, 4);
        if (t === 'cmpr') { const { data, blocks: bl } = await unpackCmpr(b, off + 12, off + 8 + len); await walk(data, 0, data.length, bl, streams, ctx) }
        else { enter(t, ctx); await walk(b, off + 12, off + 8 + len, blocks, streams, ctx); leave(t, ctx) }
      } else {
        let data = b.subarray(off + 8, Math.min(end, off + 8 + len));
        if (streams && len === 16) { // X6+: the record lives in an external stream (or inline)
          const sid = dv.getInt32(off + 8, true), l = dv.getUint32(off + 12, true), o = dv.getUint32(off + 16, true);
          if (sid < 0) data = b.subarray(off + 16, off + 16 + Math.min(8, l));
          else if (streams[sid]) data = streams[sid].subarray(o, o + l);
        }
        record(id, data, ctx);
      }
      off += 8 + len + (len & 1);
    }
  }
  /* ---------------- structure ---------------- */
  function enter(t, ctx) {
    if (t === 'page') { ctx.page = { shapes: [], master: pages.length === 0 && ctx.version >= 600 }; pages.push(ctx.page) }
    if (t === 'obj ') { ctx.obj = { geom: null, trafos: [], poly: null }; }
    if (t === 'layr') { ctx.inLayer = true; ctx.layerFlags = 0 }
    ctx.last = t;
    if (t === 'grp ') ctx.stack.push({ group: true, trafos: [] });
  }
  function leave(t, ctx) {
    if (t === 'layr') ctx.inLayer = false;
    if (t === 'obj ' && ctx.obj) { flush(ctx); ctx.obj = null }
    if (t === 'grp ') ctx.stack.pop();
  }
  function record(id, d, ctx) {
    if (id === 'vrsn' && d.length >= 2) { const v = d[0] | d[1] << 8; if (v >= 100 && v < 5000) { version = v; ctx.version = v } }
    else if (id === 'flgs' && ctx.last === 'layr' && d.length >= 4) ctx.layerFlags = d[0] | d[1] << 8 | d[2] << 16 | d[3] << 24 >>> 0;
    else if (id === 'loda' && ctx.obj) readLoda(d, ctx);
    else if (id === 'bbox' && ctx.obj && parseCDR.debug && d.length >= 16) { const dv = new DataView(d.buffer, d.byteOffset, d.byteLength); ctx.obj.bbox = [0, 4, 8, 12].map(o => dv.getInt32(o, true) / 10000) }
    else if (id === 'outl' && d.length >= 24) { try { const o = readOutl(d, ctx.version); OUTL.set(o.id, o) } catch (e) { } }
    else if (id === 'fild' && d.length >= 8) { try { const f = readFild(d, ctx.version); FILD.set(f.id, f) } catch (e) { } }
    if (parseCDR.probe) parseCDR.probe(id, d, ctx);
    if (id === 'trfd') { const tr = readTrfd(d, ctx.version); if (ctx.obj) ctx.obj.trafos = tr; else if (ctx.stack.length) ctx.stack[ctx.stack.length - 1].trafos = tr }
  }
  function flush(ctx) {
    const o = ctx.obj; if (!o.geom || !ctx.page) return;
    let subs = o.geom;
    if (o.poly) subs = polygonize(subs, o.poly);
    const all = o.trafos.slice(); // object transform; groups usually bake theirs into children
    const tf = (x, y) => { for (const m of all) { const nx = m[0] * x + m[1] * y + m[2], ny = m[3] * x + m[4] * y + m[5]; x = nx; y = ny } return [x, y] };
    const paths = [], open = [];
    for (const s of subs) { const p = s.pts.map(q => tf(q[0], q[1])); if (p.length < 2) continue; (s.closed ? paths : open).push(p) }
    const ol = OUTL.get(o.outl), fl = FILD.get(o.fild), style = { stroke: ol && !ol.none ? ol.color : null, sw: ol && !ol.none ? ol.w : 0, fill: fl && fl.color || null };
    if (fl && fl.type > 1) warn.add('shading');
    const lf = ctx.layerFlags >>> 0, dbg = parseCDR.debug ? { oid: (parseCDR.oid = (parseCDR.oid || 0) + 1), bbox: o.bbox, type: o.type, trafos: o.trafos, poly: o.poly, raw: subs.map(s => s.pts.length) } : undefined;
    if (paths.length) ctx.page.shapes.push({ paths, closed: true, lf, style, dbg });
    for (const p of open) ctx.page.shapes.push({ paths: [p], closed: false, lf, style, dbg });
  }
  /* ---------------- records ---------------- */
  function coordReader(d, ctx) {
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength), old = ctx.version < 600;
    return { dv, coord: o => old ? dv.getInt16(o, true) / 1000 * 25.4 : dv.getInt32(o, true) / 10000, csz: old ? 2 : 4, angle: o => old ? dv.getInt16(o, true) / 10 * Math.PI / 180 : dv.getInt32(o, true) / 1e6 * Math.PI / 180 };
  }
  function readLoda(d, ctx) {
    if (d.length < 20) return;
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength), n = dv.getUint32(4, true), sArgs = dv.getUint32(8, true), sTypes = dv.getUint32(12, true), type = dv.getUint32(16, true);
    if (n > 64 || sArgs + 4 * n > d.length || sTypes + 4 * n > d.length) return;
    const offs = [], types = []; for (let i = 0; i < n; i++) { offs.push(dv.getUint32(sArgs + 4 * i, true)); types.unshift(dv.getUint32(sTypes + 4 * i, true)) }
    const argAt = k => { const i = types.indexOf(k); if (i < 0) return null; const s = offs[i], e = offs.filter(x => x > s).sort((a, b) => a - b)[0] || d.length; return d.subarray(s, Math.max(s, e)) };
    const C = argAt(0x1e); ctx.obj.type = type; if (parseCDR.probeLoda) parseCDR.probeLoda(types, argAt, ctx);
    const u32a = k => { const a = argAt(k); return a && a.length >= 4 ? (a[0] | a[1] << 8 | a[2] << 16 | a[3] << 24) >>> 0 : null };
    ctx.obj.outl = u32a(0x0a); ctx.obj.fild = u32a(0x14);
    try {
      if (type === 0x01 && C) ctx.obj.geom = readRect(C, ctx);
      else if (type === 0x02 && C) ctx.obj.geom = readEllipse(C, ctx);
      else if ((type === 0x03 || type === 0x14) && C) { ctx.obj.geom = readCurve(C, ctx, 0); if (type === 0x14) { const P = argAt(0x2af8); if (P) ctx.obj.poly = readPolyArgs(P, ctx) } }
      else if (type === 0x25 && C) ctx.obj.geom = readPath(C, ctx);
      else if (type === 0x04) warn.add('text');
      else if (type === 0x05) warn.add('bitmap');
      else if (type === 0x06 || type === 0x26) warn.add('effect');
    } catch (e) { warn.add('damaged') }
    if (ctx.obj.geom && !ctx.obj.geom.length) ctx.obj.geom = null;
  }
  function readRect(d, ctx) {
    const { dv, coord, csz } = coordReader(d, ctx), v = ctx.version, dbl = v >= 1500;
    const f64 = o => o + 8 <= d.length ? dv.getFloat64(o, true) : 0, u8at = o => o < d.length ? d[o] : 0;
    const x = dbl ? f64(0) / 10000 : coord(0), y = dbl ? f64(8) / 10000 : coord(csz);
    let r = [0, 0, 0, 0], kind = 0, sx = 1, sy = 1;
    try {
      if (v < 900) { const a = Math.abs(coord(2 * csz)); r = v < 800 ? [a, a, a, a] : [a, Math.abs(coord(3 * csz)), Math.abs(coord(4 * csz)), Math.abs(coord(5 * csz))] }
      else {
        const b = dbl ? 16 : 8; sx = f64(b) || 1; sy = f64(b + 8) || 1; const sw = u8at(b + 16), o = b + 24;
        if (sw === 0) { const m = Math.min(Math.abs(x * sx), Math.abs(y * sy)) / 2; r = [f64(o), f64(o + 24), f64(o + 48), f64(o + 72)].map(q => q * m); kind = u8at(o + 8) }
        else { const rc = q => dbl ? f64(q) / 10000 : coord(q); r = [rc(o), rc(o + 24), rc(o + 48), rc(o + 72)].map(Math.abs); kind = u8at(o + 8) }
      }
    } catch (e) { r = [0, 0, 0, 0] }
    const w = Math.abs(x), h = Math.abs(y), x0 = Math.min(0, x), y0 = Math.min(0, y), lim = Math.min(w * Math.abs(sx), h * Math.abs(sy)) / 2 + 1e-6;
    r = r.map(q => q > 0 && isFinite(q) && q <= lim ? q : 0);
    const pts = [], corners = [[x0, y0, Math.PI], [x0 + w, y0, -Math.PI / 2], [x0 + w, y0 + h, 0], [x0, y0 + h, Math.PI / 2]];
    corners.forEach(([cx, cy, a0], i) => {
      const R = r[3 - i], rx = R / Math.abs(sx || 1), ry = R / Math.abs(sy || 1), dx = cx > x0 ? -1 : 1, dy = cy > y0 ? -1 : 1;
      if (!R) { pts.push([cx, cy]); return }
      const ccx = cx + dx * rx, ccy = cy + dy * ry;
      if (kind === 2) { pts.push([ccx + Math.cos(a0) * rx, ccy + Math.sin(a0) * ry], [ccx + Math.cos(a0 + Math.PI / 2) * rx, ccy + Math.sin(a0 + Math.PI / 2) * ry]); return }
      for (let k = 0; k <= 10; k++) {
        const t = k / 10 * Math.PI / 2;
        if (kind === 1) pts.push([cx + Math.cos(a0 - Math.PI / 2 - t) * rx, cy + Math.sin(a0 - Math.PI / 2 - t) * ry]); // scalloped: concave arc around the corner
        else pts.push([ccx + Math.cos(a0 + t) * rx, ccy + Math.sin(a0 + t) * ry]);
      }
    });
    return [{ pts, closed: true }];
  }
  function readEllipse(d, ctx) {
    const { dv, coord, csz, angle } = coordReader(d, ctx), x = coord(0), y = coord(csz), cx = x / 2, cy = y / 2, rx = Math.abs(cx), ry = Math.abs(cy);
    let a1 = 0, a2 = 0, pie = false; try { a1 = angle(2 * csz); a2 = angle(3 * csz); pie = dv.getUint32(4 * csz, true) !== 0 } catch (e) { }
    const pts = [], full = Math.abs(a1 - a2) < 1e-6; let b = a2; if (!full && b < a1) b += Math.PI * 2;
    const A0 = full ? 0 : a1, A1 = full ? Math.PI * 2 : b, n = Math.max(24, Math.ceil((A1 - A0) * Math.max(rx, ry) / .4));
    for (let i = 0; i <= n; i++) { if (full && i === n) break; const a = A0 + (A1 - A0) * i / n; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]) }
    if (!full && pie) pts.push([cx, cy]);
    return [{ pts, closed: full || pie }];
  }
  function validTypes(d, o, n) { return n >= 1 && o + n <= d.length && !(d[o] & 0xc0) }
  function readCurve(d, ctx, skip) {
    const { dv, coord, csz } = coordReader(d, ctx);
    const tryAt = (o, n, ptsAt) => { const ps = ptsAt, ts = ps + n * 2 * csz; if (!validTypes(d, ts, n)) return null; const P = [], Ty = []; for (let i = 0; i < n; i++) { P.push([coord(ps + i * 2 * csz), coord(ps + i * 2 * csz + csz)]); Ty.push(d[ts + i]) } return bez(P, Ty) };
    let n = dv.getUint16(skip, true), r = tryAt(skip, n, skip + 4);
    if (!r) for (let o = 0; o + 4 < Math.min(d.length, 48) && !r; o += 2) { n = dv.getUint16(o, true); if (n > 0 && n < 200000) r = tryAt(o, n, o + 4) }
    return r || [];
  }
  function readPath(d, ctx) {
    const { dv, csz, coord } = coordReader(d, ctx);
    for (const [o, hdr] of [[4, 16], [4, 20], [0, 16], [4, 12], [8, 16]]) {
      if (o + 4 > d.length) continue;
      const n = dv.getUint16(o, true) + dv.getUint16(o + 2, true), ps = o + 4 + hdr, ts = ps + n * 2 * csz;
      if (n > 0 && validTypes(d, ts, n)) { const P = [], Ty = []; for (let i = 0; i < n; i++) { P.push([coord(ps + i * 2 * csz), coord(ps + i * 2 * csz + csz)]); Ty.push(d[ts + i]) } return bez(P, Ty) }
    }
    return readCurve(d, ctx, 0);
  }
  function readPolyArgs(d, ctx) {
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    let o = 0; const nA = dv.getUint32(o, true); let np = dv.getUint32(o + 4, true); o += 8;
    if (np <= 1) { np = dv.getUint32(o, true); o += 4 } else o += 4;
    if (np <= 1 && o + 4 <= d.length) { np = dv.getUint32(o, true) }
    o += 4;
    const rx = dv.getFloat64(o, true), ry = dv.getFloat64(o + 8, true), { coord } = coordReader(d, ctx), cx = coord(o + 16), cy = coord(o + 20);
    if (!(nA >= 3 && nA < 500) || !isFinite(rx) || !isFinite(ry)) return null;
    return { nA, np: Math.max(1, np), rx, ry, cx, cy };
  }
  function polygonize(subs, P) {
    const step = Math.PI * 2 / P.nA, rot = (pts, a) => pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
    const base = subs.flatMap(s => s.pts), out = [];
    if (P.nA % P.np) { let cur = base, all = base.slice(); for (let i = 1; i < P.nA; i++) { cur = rot(cur, P.np * step); all = all.concat(cur) } out.push({ pts: all, closed: true }) }
    else { let shift = base; for (let i = 0; i < P.np; i++) { if (i) shift = rot(shift, step); let cur = shift, all = shift.slice(); for (let j = 1; j < P.nA / P.np; j++) { cur = rot(cur, P.np * step); all = all.concat(cur) } out.push({ pts: all, closed: true }) } }
    return out.map(s => ({ closed: true, pts: s.pts.map(([x, y]) => [x * P.rx + P.cx, y * P.ry + P.cy]) }));
  }
  /* ---------------- styles ---------------- */
  /* colour record: model, palette, (4 bytes), value. Models: 2 CMYK %, 3/17 CMYK 0-255, 4 CMY, 5 RGB (stored B,G,R),
     6 HSB, 7 HLS, 8 black/white, 9 grey. Others (spot palettes) are shown grey. */
  function readColor(dv, o, ver) {
    const model = dv.getUint16(o, true); o += 4; if (ver >= 1200) o += 4;
    const c = [0, 1, 2, 3].map(k => dv.getUint8(o + k));
    return cdrColor(model, c);
  }
  function readOutl(d, ver) {
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength), id = dv.getUint32(0, true); let o = 4;
    if (ver >= 1300) { let bid = 0, len = 0, guard = 0; while (bid !== 1) { o += len; if (o + 8 > d.length || guard++ > 64) throw new Error('outl'); bid = dv.getUint32(o, true); len = dv.getUint32(o + 4, true); o += 8 } }
    const type = dv.getUint16(o, true); o += 6; if (ver < 1300 && ver >= 600) o += 2;
    const w = Math.abs(dv.getInt32(o, true)) / 10000; o += 6; if (ver >= 600) o += 2; o += 4; o += ver >= 1300 ? 46 : ver >= 600 ? 52 : 32;
    return { id, none: !!(type & 1), w, color: readColor(dv, o, ver) };
  }
  function readFild(d, ver) {
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength), id = dv.getUint32(0, true); let o = 4; if (ver >= 1300) o += 8;
    const type = dv.getUint16(o, true); o += 2; let color = null;
    if (type === 1) { o += ver >= 1300 ? 13 : 2; color = readColor(dv, o, ver) }
    return { id, type, color };
  }
  /* point types: bit 0x40/0x80 = segment kind, 0x08 = closes the sub-path */
  function bez(P, Ty) {
    const subs = []; let cur = null, ctl = [];
    const start = q => { cur = { pts: [q], closed: false }; subs.push(cur) };
    for (let k = 0; k < P.length; k++) {
      const t = Ty[k], q = P[k], a = t & 0x40, c = t & 0x80;
      if (!a && !c) { ctl = []; start(q); continue }
      if (!cur) start(q);
      if (a && c) { ctl.push(q); continue }
      if (c && ctl.length >= 2) { const p0 = cur.pts[cur.pts.length - 1], [p1, p2] = ctl, L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(q[0] - p2[0], q[1] - p2[1]), n = Math.max(4, Math.min(64, Math.ceil(L / .5)));
        for (let i = 1; i <= n; i++) { const s = i / n, u = 1 - s; cur.pts.push([u * u * u * p0[0] + 3 * u * u * s * p1[0] + 3 * u * s * s * p2[0] + s * s * s * q[0], u * u * u * p0[1] + 3 * u * u * s * p1[1] + 3 * u * s * s * p2[1] + s * s * s * q[1]]) } }
      else cur.pts.push(q);
      ctl = [];
      if (t & 0x08) { cur.closed = true; const f = cur.pts[0], l = cur.pts[cur.pts.length - 1]; if (cur.pts.length > 2 && Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-6) cur.pts.pop(); cur = null }
    }
    return subs.filter(s => s.pts.length > 1);
  }
  function readTrfd(d, ver) {
    if (d.length < 16) return [];
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength), n = dv.getUint32(4, true), sArgs = dv.getUint32(8, true), out = [];
    if (n > 16 || sArgs + 4 * n > d.length) return [];
    for (let i = 0; i < n; i++) {
      let o = dv.getUint32(sArgs + 4 * i, true); if (ver >= 1300) o += 8;
      if (o + 2 > d.length) continue;
      const ty = dv.getUint16(o, true);
      if (ty === 0x08) { o += 2; if (ver >= 600) o += 6; if (o + 48 > d.length) continue; const v = k => dv.getFloat64(o + 8 * k, true), U = ver < 600 ? 1000 / 25.4 : 10000; out.push([v(0), v(1), v(2) / U, v(3), v(4), v(5) / U]) }
    }
    return out;
  }
}
function cdrColor(model, c) {
  const hx = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const cmyk = (C, M, Y, K) => hx(255 * (1 - C) * (1 - K), 255 * (1 - M) * (1 - K), 255 * (1 - Y) * (1 - K));
  const hsv = (h, s, v) => { const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)) }; return hx(f(5) * 255, f(3) * 255, f(1) * 255) };
  switch (model) {
    case 2: return cmyk(c[0] / 100, c[1] / 100, c[2] / 100, c[3] / 100);
    case 3: case 17: return cmyk(c[0] / 255, c[1] / 255, c[2] / 255, c[3] / 255);
    case 4: return hx(255 - c[0], 255 - c[1], 255 - c[2]);
    case 5: return hx(c[2], c[1], c[0]);
    case 6: return hsv((c[0] | c[1] << 8) % 360, c[2] / 255, c[3] / 255);
    case 7: { const h = (c[0] | c[1] << 8) % 360, l = c[2] / 255, s = c[3] / 255, v = l + s * Math.min(l, 1 - l); return hsv(h, v ? 2 * (1 - l / v) : 0, v) }
    case 8: return c[0] ? '#ffffff' : '#000000';
    case 9: return hx(c[0], c[0], c[0]);
    default: return '#808080';
  }
}
const CDR_EXT = /\.cdr$/i;
if (typeof module !== 'undefined' && module.exports) module.exports = { parseCDR, CDR_EXT, cdrColor };
