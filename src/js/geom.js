'use strict';
/* ============================================================================
   SkyKerf_Studio · geometry
   primitives, bounding boxes, components, Clipper wrappers (offset/boolean),
   marching-squares tracer, polygon rasterizer, path clean-up and checks.
   Pure functions: no DOM access, unit-tested in /tests.
   ============================================================================ */
function rectPts(x, y, w, h, r) {
  r = Math.min(r || 0, w / 2, h / 2); if (r <= 0.01) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; const p = [], n = 10;
  for (const [cx, cy, a0] of [[x + w - r, y + r, -90], [x + w - r, y + h - r, 0], [x + r, y + h - r, 90], [x + r, y + r, 180]]) for (let i = 0; i <= n; i++) { const a = (a0 + 90 * i / n) * Math.PI / 180; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]) } return p
}
function ellipsePts(cx, cy, rx, ry, n) { n = n || Math.max(28, Math.min(220, Math.round((rx + ry) * 2.2))); const p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]) } return p }
function polyPts(cx, cy, r, n) { const p = []; for (let i = 0; i < n; i++) { const a = Math.PI / 2 + i / n * Math.PI * 2; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]) } return p }
function starPts(cx, cy, R, ri, n) { const p = []; for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + i / (n * 2) * Math.PI * 2, r = i % 2 ? ri : R; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]) } return p }
function arcPts(cx, cy, r, a0, a1, step = .5) { const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) * r / step)), p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]) } return p }
function cubic(p0, p1, p2, p3, n = 12) { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]) } return o }
function bboxOf(paths) { const b = [Infinity, Infinity, -Infinity, -Infinity]; for (const p of paths) for (const q of p) { if (q[0] < b[0]) b[0] = q[0]; if (q[1] < b[1]) b[1] = q[1]; if (q[0] > b[2]) b[2] = q[0]; if (q[1] > b[3]) b[3] = q[1] } return b }
function unionBox(a, b) { return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] }
const boxOverlap = (a, b, tol = 0) => a[0] < b[2] - tol && b[0] < a[2] - tol && a[1] < b[3] - tol && b[1] < a[3] - tol;
function distSeg(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy; let t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy) }
function inPolys(pt, paths) { let c = false; for (const p of paths) { for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c } } return c }
function area(p) { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++)s += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]); return s / 2 }
function areaOf(paths) { let s = 0; for (const c of components(paths)) { s += Math.abs(area(c[0])); for (const h of c.slice(1)) s -= Math.abs(area(h)) } return s }
function pathLen(p, closed) { let s = 0; for (let i = 1; i < p.length; i++)s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (closed && p.length > 1) s += Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]); return s }
function rdp(pts, eps) {
  if (pts.length < 3) return pts; let dm = 0, ix = 0; const a = pts[0], b = pts[pts.length - 1]; for (let i = 1; i < pts.length - 1; i++) { const d = distSeg(pts[i], a, b); if (d > dm) { dm = d; ix = i } }
  if (dm > eps) { const l = rdp(pts.slice(0, ix + 1), eps), r = rdp(pts.slice(ix), eps); return l.slice(0, -1).concat(r) } return [a, b]
}
function rdpClosed(p, eps) {
  if (p.length < 8) return p; let far = 0, fi = 0; for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]); if (d > far) { far = d; fi = i } }
  const a = rdp(p.slice(0, fi + 1), eps), b = rdp(p.slice(fi).concat([p[0]]), eps); return a.slice(0, -1).concat(b.slice(0, -1))
}
/* Chaikin corner cutting for smoother traced outlines. */
function chaikin(p, iter = 1) { for (let k = 0; k < iter; k++) { const o = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; o.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]) } p = o } return p }
const mapPaths = (paths, f) => paths.map(p => p.map(q => f(q[0], q[1])));
function rotPaths(paths, deg, cx = 0, cy = 0) { if (!deg) return paths; const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return mapPaths(paths, (x, y) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]) }
const mirrorPaths = (paths, cx) => mapPaths(paths, (x, y) => [2 * cx - x, y]).map(p => p.slice().reverse());

/* Split closed loops into components: [outer, ...holes] (even-odd nesting). */
function components(paths) {
  const ps = paths.filter(p => p.length > 2).map(p => ({ p, a: Math.abs(area(p)), b: bboxOf([p]) })); ps.sort((a, b) => b.a - a.a);
  for (const o of ps) { o.d = 0; o.par = null; for (const q of ps) { if (q === o || q.a <= o.a) continue; if (o.b[0] >= q.b[0] - 1e-9 && o.b[2] <= q.b[2] + 1e-9 && o.b[1] >= q.b[1] - 1e-9 && o.b[3] <= q.b[3] + 1e-9 && inPolys(o.p[0], [q.p])) { o.d++; if (!o.par || q.a < o.par.a) o.par = q } } }
  const comps = []; for (const o of ps) if (o.d % 2 === 0) { o.comp = [o.p]; comps.push(o.comp) }
  for (const o of ps) if (o.d % 2 === 1 && o.par && o.par.comp) o.par.comp.push(o.p);
  return comps;
}
/* Interior point far from edges (labels, dowels). */
function deepPoint(paths, avoid = [], minClear = 0) {
  const b = bboxOf(paths), step = Math.max((b[2] - b[0]) / 36, (b[3] - b[1]) / 36, .4); let best = null, bd = -1;
  for (let y = b[1] + step / 2; y < b[3]; y += step)for (let x = b[0] + step / 2; x < b[2]; x += step) {
    const p = [x, y]; if (!inPolys(p, paths)) continue;
    let d = Infinity; for (const q of paths) for (let i = 0; i < q.length; i++) { const e = distSeg(p, q[i], q[(i + 1) % q.length]); if (e < d) d = e }
    for (const a of avoid) d = Math.min(d, Math.hypot(a[0] - x, a[1] - y) - (a[2] || 0));
    if (d > bd) { bd = d; best = p }
  }
  return best && bd >= minClear ? { p: best, d: bd } : null;
}

/* ---------- marching squares tracer ---------- */
function traceMask(mask, w, h) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : mask[y * w + x];
  const ax = [], ay = [], bx = [], by = [];
  const E = (x, y, e) => e === 0 ? [2 * x + 1, 2 * y] : e === 1 ? [2 * x + 2, 2 * y + 1] : e === 2 ? [2 * x + 1, 2 * y + 2] : [2 * x, 2 * y + 1];
  const TAB = { 1: [3, 2], 2: [2, 1], 3: [3, 1], 4: [0, 1], 5: [3, 2, 0, 1], 6: [0, 2], 7: [3, 0], 8: [3, 0], 9: [0, 2], 10: [3, 0, 2, 1], 11: [0, 1], 12: [3, 1], 13: [2, 1], 14: [3, 2] };
  for (let y = -1; y < h; y++)for (let x = -1; x < w; x++) {
    const c = at(x, y) * 8 + at(x + 1, y) * 4 + at(x + 1, y + 1) * 2 + at(x, y + 1); if (c === 0 || c === 15) continue; const t = TAB[c];
    for (let k = 0; k < t.length; k += 2) { const p = E(x, y, t[k]), q = E(x, y, t[k + 1]); ax.push(p[0]); ay.push(p[1]); bx.push(q[0]); by.push(q[1]) }
  }
  const n = ax.length, map = new Map(), key = (x, y) => x * 100003 + y;
  for (let i = 0; i < n; i++) { for (const k of [key(ax[i], ay[i]), key(bx[i], by[i])]) { const l = map.get(k); l ? l.push(i) : map.set(k, [i]) } }
  const used = new Uint8Array(n), loops = [];
  for (let i = 0; i < n; i++) {
    if (used[i]) continue; used[i] = 1; const loop = [[ax[i] / 2, ay[i] / 2]]; const sk = key(ax[i], ay[i]); let cx = bx[i], cy = by[i], guard = 0;
    while (key(cx, cy) !== sk && guard++ < 4e6) {
      loop.push([cx / 2, cy / 2]); const c = map.get(key(cx, cy)); let nx = -1; if (c) for (const j of c) if (!used[j]) { nx = j; break } if (nx < 0) break; used[nx] = 1;
      if (ax[nx] === cx && ay[nx] === cy) { cx = bx[nx]; cy = by[nx] } else { cx = ax[nx]; cy = ay[nx] }
    }
    if (loop.length >= 4) loops.push(loop)
  }
  return loops;
}

/* ---------- Clipper wrappers ---------- */
const CS = 1000, hasClip = () => typeof ClipperLib !== 'undefined';
/* offsets with round joins add arc points to every arc vertex; without cleaning, repeated offsets grow the point count
   (and the time) without bound. 0.01 mm is far below any laser or router tolerance. */
const CLEAN = .01 * CS;
const toC = paths => paths.filter(p => p.length > 2).map(p => p.map(q => ({ X: Math.round(q[0] * CS), Y: Math.round(q[1] * CS) })));
const toCopen = paths => paths.filter(p => p.length > 1).map(p => p.map(q => ({ X: Math.round(q[0] * CS), Y: Math.round(q[1] * CS) })));
const fromC = cp => cp.map(p => p.map(q => [q.X / CS, q.Y / CS])).filter(p => p.length > 2);
const normC = (paths, ft) => ClipperLib.Clipper.SimplifyPolygons(toC(paths), ft == null ? ClipperLib.PolyFillType.pftEvenOdd : ft);
function offsetPaths(paths, d, join) {
  if (!hasClip()) return paths.map(p => missOffset(p, d)).filter(Boolean);
  const co = new ClipperLib.ClipperOffset(2, .02 * CS); co.AddPaths(normC(paths), join === 'miter' ? ClipperLib.JoinType.jtMiter : ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const sol = new ClipperLib.Paths(); co.Execute(sol, d * CS); return fromC(ClipperLib.Clipper.CleanPolygons(sol, CLEAN));
}
/* Offset each loop on its own (kerf "outside"/"inside" regardless of nesting). */
function offsetEach(paths, d, join) { const out = []; for (const p of paths) for (const q of offsetPaths([p], d, join)) out.push(q); return out }
/* Thicken open polylines into closed outlines (footprints of open cuts). */
function offsetOpen(paths, d) {
  if (!hasClip() || d <= 0) return [];
  const co = new ClipperLib.ClipperOffset(2, .02 * CS); co.AddPaths(toCopen(paths), ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound);
  const sol = new ClipperLib.Paths(); co.Execute(sol, d * CS); return fromC(ClipperLib.Clipper.CleanPolygons(sol, CLEAN));
}
function missOffset(p, d) {
  const n = p.length, s = area(p) > 0 ? 1 : -1, o = [];
  for (let i = 0; i < n; i++) {
    const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
    const n1 = norm2([(b[1] - a[1]), -(b[0] - a[0])]), n2 = norm2([(c[1] - b[1]), -(c[0] - b[0])]); let m = [n1[0] + n2[0], n1[1] + n2[1]]; const ml = Math.hypot(m[0], m[1]) || 1; m = [m[0] / ml, m[1] / ml];
    const cos = Math.max(.3, m[0] * n1[0] + m[1] * n1[1]); o.push([b[0] - s * m[0] * d / cos, b[1] - s * m[1] * d / cos])
  }
  if (d < 0 && (Math.sign(area(o)) !== Math.sign(area(p)) || Math.abs(area(o)) < .01)) return null; return o;
}
function norm2(v) { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l] }
function boolOp(subj, clip, kind, subjFill) {
  if (!hasClip()) return kind === 'diff' || kind === 'union' ? subj.concat(kind === 'union' ? clip : []) : subj;
  const c = new ClipperLib.Clipper(), CT = ClipperLib.ClipType; c.AddPaths(normC(subj, subjFill), ClipperLib.PolyType.ptSubject, true); c.AddPaths(normC(clip, ClipperLib.PolyFillType.pftNonZero), ClipperLib.PolyType.ptClip, true);
  const sol = new ClipperLib.Paths(); c.Execute(kind === 'union' ? CT.ctUnion : kind === 'diff' ? CT.ctDifference : kind === 'xor' ? CT.ctXor : CT.ctIntersection, sol, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero); return fromC(sol);
}
/* Clip open polylines by a closed region (keeps the parts inside). */
function clipOpen(lines, region, keepInside = true) {
  if (!hasClip()) return lines;
  const c = new ClipperLib.Clipper(); c.AddPaths(toCopen(lines), ClipperLib.PolyType.ptSubject, false); c.AddPaths(normC(region), ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree(); c.Execute(keepInside ? ClipperLib.ClipType.ctIntersection : ClipperLib.ClipType.ctDifference, tree, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
  return ClipperLib.Clipper.OpenPathsFromPolyTree(tree).map(p => p.map(q => [q.X / CS, q.Y / CS])).filter(p => p.length > 1);
}
const unionPaths = paths => hasClip() ? fromC(normC(paths, ClipperLib.PolyFillType.pftNonZero)) : paths;
const cleanPaths = paths => hasClip() ? fromC(normC(paths)) : paths;

/* ---------- polygon rasterizer (even-odd, cell-centre sampling) ----------
   Used by nesting. Pure JS so it runs in tests and workers. Callers dilate the
   polygons by at least one cell so thin parts are never lost. */
function rasterPolys(polys, ox, oy, res, w, h, out) {
  const m = out || new Uint8Array(w * h), edges = [];
  for (const p of polys) for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[j], b = p[i]; if (a[1] !== b[1]) edges.push(a[1] < b[1] ? [a[0], a[1], b[0], b[1]] : [b[0], b[1], a[0], a[1]]) }
  if (!edges.length) return m;
  edges.sort((e1, e2) => e1[1] - e2[1]);
  const xs = []; let ei = 0, active = [];
  for (let r = 0; r < h; r++) {
    const y = oy + (r + .5) * res;
    while (ei < edges.length && edges[ei][1] <= y) active.push(edges[ei++]);
    active = active.filter(e => e[3] > y);
    if (!active.length) continue;
    xs.length = 0; for (const e of active) if (e[1] <= y && e[3] > y) xs.push(e[0] + (y - e[1]) / (e[3] - e[1]) * (e[2] - e[0]));
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      let c0 = Math.ceil((xs[k] - ox) / res - .5), c1 = Math.floor((xs[k + 1] - ox) / res - .5);
      if (c1 < 0 || c0 >= w) continue; c0 = Math.max(0, c0); c1 = Math.min(w - 1, c1);
      m.fill(1, r * w + c0, r * w + c1 + 1);
    }
  }
  return m;
}

/* ---------- path clean-up ---------- */
const ptKey = (p, tol) => Math.round(p[0] / tol) + ',' + Math.round(p[1] / tol);
/* Canonical signature of a path regardless of start point and direction. */
function pathSignature(p, closed, tol = .01) {
  const keys = p.map(q => ptKey(q, tol));
  if (!closed) { const a = keys.join(';'), b = keys.slice().reverse().join(';'); return 'o:' + (a < b ? a : b) }
  let best = null; const n = keys.length;
  for (const seq of [keys, keys.slice().reverse()]) for (let s = 0; s < n; s++) { const k = seq.slice(s).concat(seq.slice(0, s)).join(';'); if (best === null || k < best) best = k }
  return 'c:' + best;
}
/* Find duplicate paths (same geometry). Returns [{a:{shape,idx}, b:{shape,idx}}]. */
function findDuplicatePaths(items, tol = .01) {
  const seen = new Map(), dups = [];
  for (const it of items) it.paths.forEach((p, idx) => { if (p.length > 400) return; const sig = pathSignature(p, it.closed, tol); if (seen.has(sig)) dups.push({ a: seen.get(sig), b: { id: it.id, idx } }); else seen.set(sig, { id: it.id, idx }) });
  return dups;
}
/* Count collinear overlapping segments between different paths (overburn risk). */
function overlappingSegments(items, tol = .02) {
  const map = new Map(); let n = 0;
  items.forEach((it, pi) => { const p = it.p; for (let i = 0; i + 1 < p.length + (it.closed ? 1 : 0); i++) { const a = p[i], b = p[(i + 1) % p.length]; const k1 = ptKey(a, tol), k2 = ptKey(b, tol), k = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1; const o = map.get(k); if (o != null && o !== pi) n++; else map.set(k, pi) } });
  return n;
}
/* Join open polylines whose ends touch (fewer laser on/off cycles). */
function joinOpenPaths(lines, tol = .05) {
  const L = lines.filter(p => p.length > 1).map(p => p.slice()), used = new Array(L.length).fill(false), out = [];
  const near = (a, b) => Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol;
  for (let i = 0; i < L.length; i++) {
    if (used[i]) continue; used[i] = true; let ch = L[i], grew = true;
    while (grew) {
      grew = false; for (let j = 0; j < L.length; j++) {
        if (used[j]) continue; const q = L[j];
        if (near(ch[ch.length - 1], q[0])) { ch = ch.concat(q.slice(1)); used[j] = grew = true }
        else if (near(ch[ch.length - 1], q[q.length - 1])) { ch = ch.concat(q.slice(0, -1).reverse()); used[j] = grew = true }
        else if (near(ch[0], q[q.length - 1])) { ch = q.slice(0, -1).concat(ch); used[j] = grew = true }
        else if (near(ch[0], q[0])) { ch = q.slice(1).reverse().concat(ch); used[j] = grew = true }
      }
    }
    out.push(ch);
  }
  return out;
}
/* Merge consecutive nearly-collinear points within a tolerance (segment merging). */
const simplifyPath = (p, closed, tol) => tol > 0 && p.length > 2 ? (closed ? rdpClosed(p, tol) : rdp(p, tol)) : p;
/* Self-intersection test for one loop (O(n²), skipped for very long loops). */
function selfIntersects(p, closed = true) {
  const n = p.length; if (n < 4 || n > 1500) return false;
  const seg = i => [p[i], p[(i + 1) % n]], cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) for (let j = i + 2; j < m; j++) {
    if (closed && i === 0 && j === m - 1) continue;
    const [a, b] = seg(i), [c, d] = seg(j);
    const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
    if (((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9))) return true;
  }
  return false;
}
/* Minimum distance between two sets of loops (for spacing checks). */
function minDistPaths(A, B, cap = 1e9) {
  let d = cap;
  for (const p of A) for (const q of B) for (let i = 0; i < p.length; i += Math.max(1, p.length >> 7)) for (let j = 0; j < q.length; j++) { const e = distSeg(p[i], q[j], q[(j + 1) % q.length]); if (e < d) d = e }
  return d;
}

/* ---------- fast G-code line scanner (no regular expressions) ----------
   Fills W (letter char codes) and V (values); returns the word count, 0 for an empty/comment line, -1 for junk.
   Comments ";…" and "(…)" are skipped; the line-number word N is returned like any other word. */
function gcScan(s, W, V) {
  let n = 0, i = 0; const L = s.length;
  while (i < L) {
    let c = s.charCodeAt(i);
    if (c === 32 || c === 9 || c === 13) { i++; continue }
    if (c === 59) break; // ;
    if (c === 40) { const j = s.indexOf(')', i); if (j < 0) break; i = j + 1; continue } // ( … )
    if (c >= 97 && c <= 122) c -= 32;
    if (c < 65 || c > 90) return -1;
    i++; while (i < L && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++;
    let sign = 1, k = s.charCodeAt(i); if (k === 45) { sign = -1; i++ } else if (k === 43) i++;
    let v = 0, digits = 0; k = s.charCodeAt(i);
    while (k >= 48 && k <= 57) { v = v * 10 + (k - 48); digits++; i++; k = s.charCodeAt(i) }
    if (k === 46) { i++; k = s.charCodeAt(i); let f = .1; while (k >= 48 && k <= 57) { v += (k - 48) * f; f *= .1; digits++; i++; k = s.charCodeAt(i) } }
    if (!digits) return -1;
    if (n >= W.length) return -1; W[n] = c; V[n] = sign * v; n++;
  }
  return n;
}
