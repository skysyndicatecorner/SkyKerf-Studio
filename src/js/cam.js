'use strict';
/* ============================================================================
   SkyKerf_Studio · toolpath planning (laser & CNC) and G-code preview
   planJob() turns the project into a dialect-free job description:
     job.ops[] = { layer, type, params, moves:[{g:0|1, x, y, z, f, p}] }
   p = laser power as a fraction 0..1. Postprocessors (post.js) translate it.
   ============================================================================ */
const usedLayers = plate => { const u = new Set(S.shapes.filter(s => !s.parked && (plate == null || plateOf(s) === plate)).map(s => s.layer)); return S.order.filter(i => u.has(i)).map(i => S.layers[i]) };
const LASER_AUTO_ORDER = { raster: 0, fill: 1, vector: 2, mark: 3, cut: 4 };
const CNC_AUTO_ORDER = { drill: 0, engrave: 1, vcarve: 2, chamfer: 3, pocket: 4, relief: 5, in: 6, on: 7, out: 8 };
function orderedLayers(plate) {
  const ls = usedLayers(plate).filter(L => layerOut(L));
  if (S.orderMode !== 'auto') return ls;
  // combined machine: all laser work first (one head change), then the router
  const key = L => layerHead(L) === 'laser' ? (S.job.engraveFirst || S.machine.combo ? LASER_AUTO_ORDER[L.type] ?? 9 : 0) : (CNC_AUTO_ORDER[L.cnc.op] ?? 9) + (S.machine.combo ? 100 : 0);
  return ls.slice().sort((a, b) => key(a) - key(b) || S.order.indexOf(a.id) - S.order.indexOf(b.id));
}
function hatch(paths, step, angDeg) {
  if (!paths.length) return [];
  const a = -angDeg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a); const R = paths.map(p => p.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]));
  const b = bboxOf(R); step = Math.max(step, (b[3] - b[1]) / 20000); const segs = []; let dir = 0;
  for (let y = b[1] + step / 2; y < b[3]; y += step) {
    const xs = []; for (const p of R) { const n = p.length; for (let i = 0; i < n; i++) { const A = p[i], B = p[(i + 1) % n]; if ((A[1] <= y && B[1] > y) || (B[1] <= y && A[1] > y)) xs.push(A[0] + (y - A[1]) / (B[1] - A[1]) * (B[0] - A[0])) } }
    if (xs.length < 2) continue; xs.sort((u, v) => u - v); let row = []; for (let k = 0; k + 1 < xs.length; k += 2) if (xs[k + 1] - xs[k] > 1e-4) row.push([xs[k], xs[k + 1]]); if (!row.length) continue;
    if (dir) { row = row.reverse().map(([u, v]) => [v, u]) } dir ^= 1; for (const [u, v] of row) segs.push([[u, y], [v, y]])
  }
  const back = ([x, y]) => [x * ca + y * sa, -x * sa + y * ca]; return segs.map(([p, q]) => [back(p), back(q)]);
}
function orderPaths(items, start, innerFirst) {
  const it = items.map(o => ({ ...o, b: bboxOf([o.p]) }));
  for (const o of it) { o.depth = 0; if (innerFirst && o.closed) for (const q of it) if (q !== o && q.closed && q.b[0] <= o.b[0] && q.b[1] <= o.b[1] && q.b[2] >= o.b[2] && q.b[3] >= o.b[3] && (q.b[2] - q.b[0]) * (q.b[3] - q.b[1]) > (o.b[2] - o.b[0]) * (o.b[3] - o.b[1])) o.depth++ }
  const groups = [...new Set(it.map(o => o.depth))].sort((a, b) => b - a), res = []; let cur = start;
  for (const g of groups) {
    const pool = it.filter(o => o.depth === g);
    while (pool.length) {
      let best = 0, bi = 0, bd = Infinity, rev = false;
      for (let i = 0; i < pool.length; i++) {
        const o = pool[i]; if (o.closed) { const st = Math.max(1, Math.floor(o.p.length / 64)); for (let k = 0; k < o.p.length; k += st) { const d = Math.hypot(o.p[k][0] - cur[0], o.p[k][1] - cur[1]); if (d < bd) { bd = d; best = i; bi = k; rev = false } } }
        else { const d0 = Math.hypot(o.p[0][0] - cur[0], o.p[0][1] - cur[1]), d1 = Math.hypot(o.p[o.p.length - 1][0] - cur[0], o.p[o.p.length - 1][1] - cur[1]); if (d0 < bd) { bd = d0; best = i; rev = false; bi = 0 } if (d1 < bd) { bd = d1; best = i; rev = true; bi = 0 } }
      }
      const o = pool.splice(best, 1)[0]; let p = o.p; if (o.closed && bi) p = p.slice(bi).concat(p.slice(0, bi)); if (rev) p = [...p].reverse(); res.push({ ...o, p }); cur = o.closed ? p[0] : p[p.length - 1]
    }
  }
  return res;
}
/* walk a polyline, splitting at tab/bridge boundaries; emit(x, y, inTab) */
function walkTabs(pts, count, width, emit) {
  const tot = pathLen(pts, false); if (!count || tot <= 0) { for (let i = 1; i < pts.length; i++)emit(pts[i][0], pts[i][1], false); return }
  const sp = tot / count, half = width / 2, bps = []; for (let k = 0; k < count; k++) { const c = sp * (k + .5); bps.push(c - half, c + half) }
  const inTab = s => Math.abs(((s % sp) + sp) % sp - sp / 2) < half; let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1e-9) continue;
    const cuts = bps.filter(q => q > s + 1e-9 && q < s + len - 1e-9).sort((u, v) => u - v); cuts.push(s + len); let prev = s;
    for (const c of cuts) { const t = (c - s) / len; emit(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, inTab((prev + c) / 2)); prev = c } s += len
  }
}
/* Kerf compensation by side (spec 6.1). */
function kerfPaths(paths, kerf, side) {
  if (!(kerf > 0) || side === 'none') return paths;
  const h = kerf / 2;
  if (side === 'out') return offsetEach(paths, h, 'miter');
  if (side === 'in') return offsetEach(paths, -h, 'miter');
  return offsetPaths(paths, h, 'miter'); // auto: outer grows, holes shrink — the part keeps its size
}

/* ============================ job planning ============================ */
/* which head a layer uses: the machine type, or the layer's own choice on a combined laser + router machine */
const layerHead = (L, m) => (m || S.machine).combo && (L.head === 'laser' || L.head === 'cnc') ? L.head : (m || S.machine).type;
/* Z behaviour of router layers */
const CNC_Z_DEF = { zMode: 'std', entry: 'plunge', rampAng: 5, retract: 'safe', clearH: 1, lift: 'none', liftEvery: 50, spring: false, coolant: 'none', spinWait: 0 };
const Z_PRESETS = {
  std: { entry: 'plunge', retract: 'safe', lift: 'none', spring: false, coolant: 'none', spinWait: 0 },
  acrylic: { entry: 'ramp', rampAng: 3, retract: 'low', clearH: 1, lift: 'pass', spring: true, coolant: 'M8', spinWait: 2 },
  deep: { entry: 'ramp', rampAng: 5, retract: 'safe', lift: 'dist', liftEvery: 40, spring: false, coolant: 'none', spinWait: 1 },
  soft: { entry: 'ramp', rampAng: 10, retract: 'low', clearH: 2, lift: 'none', spring: false, coolant: 'none', spinWait: 0 },
  custom: {},
};
const Z_MODES = () => [['std', T('Обычный (врезание сверху)', 'Standard (straight plunge)')], ['acrylic', T('Оргстекло / акрил (без плавления)', 'Acrylic (no melting)')], ['deep', T('Глубокий рез (подъёмы для стружки)', 'Deep cut (chip-clearing lifts)')], ['soft', T('Мягкий материал (быстро)', 'Soft material (fast)')], ['custom', T('Свои настройки', 'Custom')]];
function planJob(plate, opts) {
  opts = opts || {};
  const m = S.machine, sheet = sheetAt(plate), OX = plateX(plate), warn = [], ops = [];
  const shapes = S.shapes.filter(s => !s.parked && plateOf(s) === plate).map(s => Object.assign({}, s, { paths: mapPaths(s.paths, (x, y) => [x - OX, y]) }));
  let cx = 0, cy = 0;
  for (const L of orderedLayers(plate)) {
    if (!L.on) continue;
    if (opts.only && !opts.only.includes(L.type)) continue;
    const ls = shapes.filter(s => s.layer === L.id); if (!ls.length) continue;
    const mv = [], add = o => { mv.push(o); if (o.x != null) cx = o.x; if (o.y != null) cy = o.y };
    const laser = layerHead(L, m) === 'laser';
    if (laser) {
      const r = resolveLaser(L, sheet, m), l = L.laser;
      for (const w of r.warn) warn.push(`${layerName(L)}: ${w}`);
      if (r.unsupported) continue;
      const pwMax = clamp(r.power, 0, 100) / 100, spd = Math.max(1, r.speed), groups = new Map();
      for (const s of ls) { const k = s.ov ? `${s.ov.power}|${s.ov.speed}|${s.ov.passes || ''}|${s.ov.interval || ''}` : '_'; (groups.get(k) || groups.set(k, []).get(k)).push(s) }
      for (const [k, list] of groups) {
        const ov = k === '_' ? null : list[0].ov, P = !ov ? pwMax : clamp(ov.power, 0, 100) / 100, F = !ov ? spd : Math.max(1, ov.speed);
        const NP = Math.max(1, (ov && ov.passes) | 0 || r.passes | 0), IV = ov && ov.interval > 0 ? ov.interval : r.interval;
        const vec = list.filter(s => s.kind !== 'image'), imgs = list.filter(s => s.kind === 'image');
        for (let pass = 0; pass < NP; pass++) {
          for (const s of imgs) planRaster(s, Object.assign({}, l, r, { interval: IV }), P, F, add, warn);
          if (L.type === 'fill' || L.type === 'raster') {
            const closed = vec.filter(s => s.closed).flatMap(s => s.paths);
            if (!closed.length && vec.length && !pass) warn.push(T(`Слой «${layerName(L)}»: заливка возможна только для замкнутых фигур.`, `Layer “${layerName(L)}”: fill needs closed shapes.`));
            const os = l.overscan || 0;
            for (const [a, b] of hatch(closed, Math.max(.02, IV), l.angle)) {
              const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, ux = dx / len * os, uy = dy / len * os;
              add({ g: 0, x: a[0] - ux, y: a[1] - uy }); if (os) add({ g: 1, x: a[0], y: a[1], f: F, p: 0 }); add({ g: 1, x: b[0], y: b[1], f: F, p: P }); if (os) add({ g: 1, x: b[0] + ux, y: b[1] + uy, f: F, p: 0 });
            }
          }
          if (L.type === 'cut' || L.type === 'vector' || L.type === 'mark') {
            const items = [], tol = S.job.joinTol || 0;
            const open = [];
            for (const s of vec) {
              let ps = s.paths;
              if (s.closed && L.type === 'cut') ps = kerfPaths(ps, r.kerf, l.kerfSide);
              for (const p of ps) { const q = simplifyPath(p, s.closed, tol); if (s.closed) items.push({ p: q, closed: true }); else open.push(q) }
            }
            for (const p of joinOpenPaths(open, Math.max(tol, .01))) items.push({ p, closed: Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 1e-6 });
            for (const o of orderPaths(items, [cx, cy], S.job.innerFirst)) {
              add({ g: 0, x: o.p[0][0], y: o.p[0][1] }); const pts = o.closed ? o.p.concat([o.p[0]]) : o.p;
              walkTabs(pts, o.closed && L.type === 'cut' ? (l.bridges | 0) : 0, l.bridgeW, (x, y, tb) => add({ g: 1, x, y, f: F, p: tb ? 0 : P }));
            }
          }
        }
      }
      if (m.combo && m.laserOff && (m.laserOff[0] || m.laserOff[1])) for (const o of mv) { if (o.x != null) o.x -= m.laserOff[0]; if (o.y != null) o.y -= m.laserOff[1] } // laser module offset from the spindle
      ops.push({ head: 'laser', layer: L.id, name: layerName(L), type: L.type, color: L.color, params: r, air: !!l.air, focus: m.hasZ ? (l.focus || 0) : 0, moves: mv });
    } else {
      const c = resolveCnc(L, sheet), tool = c.tool, r = Math.max(.01, tool.d) / 2, safe = m.safeZ, levels = [];
      for (const w of c.warn) warn.push(`${layerName(L)}: ${w}`);
      let z = 0; const dep = Math.max(.01, c.depth), stp = Math.max(.01, c.step); while (z > -dep + 1e-6) { z = Math.max(z - stp, -dep); levels.push(z) }
      if (dep > sheet.thick + .5 && c.op !== 'relief') warn.push(T(`Слой «${layerName(L)}»: глубина ${dep} мм больше толщины заготовки ${sheet.thick} мм.`, `Layer “${layerName(L)}”: depth ${dep} mm exceeds stock ${sheet.thick} mm.`));
      let cz = safe; const G0 = (x, y, zz) => { add({ g: 0, x, y, z: zz }); if (zz != null) cz = zz }, G1 = (x, y, zz, f) => { add({ g: 1, x, y, z: zz, f }); if (zz != null) cz = zz };
      const Z = Object.assign({}, CNC_Z_DEF, Z_PRESETS[c.zMode] || {}, c.zMode === 'custom' ? c : {}), clearH = Math.max(.3, Z.clearH);
      const retract = () => G0(null, null, safe), vec = ls.filter(s => s.kind !== 'image' && s.kind !== 'relief');
      const hop = () => G0(null, null, Z.retract === 'low' ? Math.min(safe, clearH) : safe); // between paths of one layer
      let sinceLift = 0;
      /* chip clearing: lift out of the cut every N mm, come back down at plunge speed */
      const liftNow = (zz, x, y) => { G0(null, null, clearH); G0(null, null, Math.min(clearH, zz + .3)); G1(null, null, zz, c.plunge); sinceLift = 0 };
      /* entry into the cut: straight plunge, or a ramp along the path itself (closed paths can spiral down) */
      const enter = (p, zz, closed) => {
        const from = Math.min(cz, .5); if (cz > .5) G0(null, null, .5);
        if (Z.entry === 'plunge' || from <= zz + 1e-6) { G1(null, null, zz, c.plunge); return }
        const ang = clamp(Z.rampAng || 5, 1, 45) * Math.PI / 180, need = (from - zz) / Math.tan(ang);
        const pts = closed ? p.concat([p[0]]) : p; let cur = pts[0], zc = from, done = 0, i = 1, dir = 1, guard = 0;
        if (pts.length < 2) { G1(null, null, zz, c.plunge); return }
        while (done < need - 1e-6 && guard++ < 20000) {
          const nx = pts[i], seg = Math.hypot(nx[0] - cur[0], nx[1] - cur[1]); if (seg < 1e-9) { i += dir; if (closed && i >= pts.length) i = 1; continue }
          const take = Math.min(seg, need - done), k = take / seg, px = cur[0] + (nx[0] - cur[0]) * k, py = cur[1] + (nx[1] - cur[1]) * k;
          done += take; zc = from - (from - zz) * done / need; G1(px, py, zc, c.plunge); cur = [px, py];
          if (take >= seg - 1e-9) { if (closed) { i++; if (i >= pts.length) i = 1 } else { i += dir; if (i >= pts.length || i < 0) { dir = -dir; i += 2 * dir } } }
        }
        // back to the start point at full depth so the loop is cut completely
        if (closed) { let j = i; for (let g = 0; g < pts.length && Math.hypot(cur[0] - pts[0][0], cur[1] - pts[0][1]) > 1e-6; g++) { const q = pts[j]; G1(q[0], q[1], zz, c.feed); cur = q; j++; if (j >= pts.length) break } }
        else { G1(pts[0][0], pts[0][1], zz, c.feed) }
      };
      if (ls.some(s => s.kind === 'image')) warn.push(T('Фото пропущены: для фрезера используйте трассировку, многослойную картину или 3D-рельеф.', 'Photos skipped: for a router use tracing, a layered picture or a 3D relief.'));
      const cutLoop = (p, zz, closed, tabZ, feed) => {
        const pts = closed ? p.concat([p[0]]) : p;
        if (tabZ == null) { for (let i = 1; i < pts.length; i++) { G1(pts[i][0], pts[i][1], zz, feed); if (Z.lift === 'dist') { sinceLift += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (sinceLift > Math.max(5, Z.liftEvery) && i < pts.length - 1) liftNow(zz) } } return }
        let curZ = zz; walkTabs(pts, c.tabs, c.tabW + tool.d, (x, y, tb) => { const want = tb ? Math.max(zz, tabZ) : zz; if (want !== curZ) { G1(null, null, want, c.plunge); curZ = want } G1(x, y, want, feed) }); if (curZ !== zz) G1(null, null, zz, c.plunge)
      };
      const op = c.op;
      if (op === 'relief') {
        const rs = ls.filter(s => s.kind === 'relief'); if (!rs.length) { warn.push(T(`Слой «${layerName(L)}»: операция «3D-рельеф» применяется только к объектам рельефа.`, `Layer “${layerName(L)}”: “3D relief” only applies to relief objects.`)); continue }
        for (const s of rs) planRelief(s, c, add, warn, m, 'rough');
        ops.push({ layer: L.id, name: layerName(L) + T(' — черновая', ' — roughing'), type: 'relief', color: L.color, params: c, tool, rpm: c.rpm, moves: mv });
        const ft = toolById(rs[0].relief.finishTool || c.toolId), mv2 = [];
        for (const s of rs) planRelief(s, Object.assign({}, c, { tool: ft }), o => { mv2.push(o); if (o.x != null) cx = o.x; if (o.y != null) cy = o.y }, warn, m, 'finish');
        ops.push({ layer: L.id, name: layerName(L) + T(' — чистовая', ' — finishing'), type: 'relief', color: L.color, params: Object.assign({}, c, { toolId: ft.id }), tool: ft, rpm: c.rpm, moves: mv2 });
        continue;
      }
      else if (op === 'drill') { for (const s of vec) { const b = bboxOf(s.paths), x = (b[0] + b[2]) / 2, y = (b[1] + b[3]) / 2; retract(); G0(x, y); for (const zz of levels) { G1(null, null, zz, c.plunge); G0(null, null, .5) } retract() } }
      else if (op === 'pocket') {
        const so = clamp(c.stepover, 5, 95) / 100, fin = Math.max(0, c.finish || 0);
        for (const s of vec.filter(s => s.closed)) {
          checkToolFit(s, r, L, warn);
          const rings = []; let d = -(r + fin); for (let g = 0; g < 800; g++) { const o = offsetPaths(s.paths, d); if (!o.length) break; rings.push(o); d -= tool.d * so } rings.reverse();
          if (!rings.length) { warn.push(T(`Слой «${layerName(L)}»: фреза ⌀${tool.d} не помещается в карман.`, `Layer “${layerName(L)}”: the ⌀${tool.d} tool does not fit the pocket.`)); continue }
          let prev = 0; for (const zz of levels) {
            const clear = Math.min(safe, prev + .5); let first = true;
            for (const ring of rings) for (const p of ring) {
              // inside the already-cleared pocket move at feed (never rapid below the surface)
              if (first || clear >= 0) { G0(null, null, Math.max(clear, .5)); G0(p[0][0], p[0][1]) } else { G1(null, null, clear, c.plunge); G1(p[0][0], p[0][1], clear, c.feed) }
              if (first) enter(p, zz, true); else G1(null, null, zz, c.plunge); first = false; cutLoop(p, zz, true, null, c.feed)
            }
            prev = zz; if (Z.lift === 'pass') { G0(null, null, clearH); G0(null, null, zz + .3) }
          }
          if (fin > 0) for (const p of offsetPaths(s.paths, -r)) { retract(); G0(p[0][0], p[0][1]); G1(null, null, levels[levels.length - 1], c.plunge); cutLoop(p, levels[levels.length - 1], true, null, Math.round(c.feed * .8)) }
          retract()
        }
      }
      else if (op === 'vcarve' || op === 'chamfer') {
        const ang = clamp(c.vangle || 90, 20, 150) * Math.PI / 180, tn = Math.tan(ang / 2), st = Math.max(.05, c.vstep || .25);
        if (op === 'chamfer') {
          const depth = Math.min((c.chamferW || 1) / tn, dep);
          for (const s of vec.filter(s => s.closed)) for (const p of s.paths) { G0(null, null, 1); G0(p[0][0], p[0][1]); let zz = 0; while (zz > -depth + 1e-6) { zz = Math.max(zz - stp, -depth); G1(null, null, zz, c.plunge); cutLoop(p, zz, true, null, c.feed) } }
        } else for (const s of vec.filter(s => s.closed)) {
          let d = st / 2; const rings = []; for (let g = 0; g < 1000; g++) { const o = offsetPaths(s.paths, -d); if (!o.length) break; rings.push({ d, o }); d += st }
          for (const rg of rings) { const zt = -Math.min(rg.d / tn, dep); for (const p of rg.o) { G0(null, null, 1); G0(p[0][0], p[0][1]); let zz = 0; while (zz > zt + 1e-6) { zz = Math.max(zz - stp, zt); G1(null, null, zz, c.plunge); cutLoop(p, zz, true, null, c.feed) } } }
        }
        retract()
      }
      else {
        const items = [], fin = (op === 'out' || op === 'in') ? Math.max(0, c.finish || 0) : 0;
        for (const s of vec) {
          if (!s.closed || op === 'on' || op === 'engrave') { for (const p of s.paths) items.push({ p, closed: s.closed }); continue }
          if (op === 'in') checkToolFit(s, r, L, warn);
          const off = offsetPaths(s.paths, op === 'out' ? r + fin : -(r + fin));
          if (!off.length) { warn.push(T(`Слой «${layerName(L)}»: фреза больше внутреннего контура #${s.id}.`, `Layer “${layerName(L)}”: tool is larger than inner contour #${s.id}.`)); continue }
          for (const p of off) items.push({ p, closed: true, tabs: true, fin: fin > 0 ? offsetPaths([p], op === 'out' ? -fin : fin) : null })
        }
        const tabZ = -(dep - Math.min(c.tabH, dep));
        for (const o of orderPaths(items, [cx, cy], S.job.innerFirst)) {
          hop(); G0(o.p[0][0], o.p[0][1]);
          for (const zz of levels) {
            if (!o.closed && zz !== levels[0]) { G0(null, null, Math.min(safe, clearH)); G0(o.p[0][0], o.p[0][1]) }
            enter(o.p, zz, o.closed); const tz = (o.tabs && c.tabs > 0 && zz < tabZ - 1e-6) ? tabZ : null; cutLoop(o.p, zz, o.closed, tz, c.feed);
            if (Z.lift === 'pass' && zz !== levels[levels.length - 1]) { G0(null, null, clearH); G0(null, null, zz + .3) }
          }
          if (Z.spring && levels.length) { const zz = levels[levels.length - 1]; if (!o.closed) { G0(null, null, clearH); G0(o.p[0][0], o.p[0][1]); G1(null, null, zz, c.plunge) } cutLoop(o.p, zz, o.closed, (o.tabs && c.tabs > 0) ? tabZ : null, c.feed) }
          if (o.fin) for (const p of o.fin) { hop(); G0(p[0][0], p[0][1]); const zz = levels[levels.length - 1]; enter(p, zz, true); cutLoop(p, zz, true, c.tabs > 0 ? tabZ : null, Math.round(c.feed * .8)) }
          hop()
        }
        retract()
      }
      ops.push({ head: 'cnc', layer: L.id, name: layerName(L), type: c.op, color: L.color, params: c, tool, rpm: c.rpm, coolant: Z.coolant, spinWait: Z.spinWait, moves: mv });
    }
  }
  const parked = S.shapes.filter(s => s.parked).length; if (parked) warn.push(T(`Неразмещённые объекты (${parked}) в задание не входят.`, `${parked} unplaced objects are not part of the job.`));
  return { plate, machine: m, sheet, ops, warn, combo: !!m.combo };
}
/* Warn when a tool is too big for narrow features of a pocket / inside profile. */
function checkToolFit(s, r, L, warn) {
  if (!hasClip() || s.paths.length > 200) return;
  const a0 = areaOf(s.paths); if (a0 < .5) return;
  const opened = offsetPaths(offsetPaths(s.paths, -r), r), a1 = opened.length ? areaOf(opened) : 0;
  if (a0 - a1 > Math.max(.5, a0 * .03)) warn.push(T(`Слой «${layerName(L)}»: фреза ⌀${fx(2 * r, 2)} не пройдёт в узкие места «${kindNameOf(s)}» (останется ~${fx(a0 - a1, 1)} мм² материала).`, `Layer “${layerName(L)}”: the ⌀${fx(2 * r, 2)} tool cannot reach narrow areas of “${kindNameOf(s)}” (~${fx(a0 - a1, 1)} mm² left).`));
}
/* Raster engraving of a photo (spec 6.3). */
function planRaster(s, l, Pmax, F, add, warn) {
  const b = bboxOf(s.paths), wmm = b[2] - b[0], hmm = b[3] - b[1], iv = Math.max(.02, l.interval);
  const vert = l.scan === 'v'; let pw = Math.max(1, Math.round(wmm / iv)), ph = Math.max(1, Math.round(hmm / iv));
  if (pw * ph > 6e6) { const k = Math.sqrt(6e6 / (pw * ph)); pw = Math.floor(pw * k); ph = Math.floor(ph * k); warn.push(T('Фото уменьшено до 6 Мпикс — увеличьте шаг строк.', 'Photo reduced to 6 Mpx — increase the line interval.')) }
  const data = typeof processImage === 'function' ? processImage(s, pw, ph) : null;
  if (!data) { warn.push(T('Фото ещё загружается — нажмите «Рассчитать» ещё раз.', 'The photo is still loading — press Generate again.')); return }
  const px = wmm / pw, ry = hmm / ph, gray = s.img.mode === 'gray', minP = Math.min(Pmax, clamp(l.minPower || 0, 0, 100) / 100), os = l.overscan || 0;
  const LUT = new Float64Array(256); for (let v = 0; v < 256; v++) LUT[v] = gray ? (v < 4 ? 0 : fx(minP + (Pmax - minP) * v / 255, 4)) : (v > 127 ? Pmax : 0);
  const pv = v => LUT[v]; // per-pixel power from a lookup table (was recomputed for every pixel)
  let dir = 1;
  if (!vert) {
    for (let r = 0; r < ph; r++) {
      const y = b[3] - (r + .5) * ry, row = r * pw; let f = -1, la = -1; for (let x = 0; x < pw; x++)if (pv(data[row + x]) > 0) { if (f < 0) f = x; la = x } if (f < 0) continue;
      const runs = []; let x = f; while (x <= la) { const v = pv(data[row + x]); let e = x; while (e + 1 <= la && pv(data[row + e + 1]) === v) e++; runs.push([x, e, v]); x = e + 1 }
      if (dir > 0) { add({ g: 0, x: b[0] + f * px - os, y }); add({ g: 1, x: b[0] + f * px, y, f: F, p: 0 }); for (const [, x1, v] of runs) add({ g: 1, x: b[0] + (x1 + 1) * px, y, f: F, p: v }); add({ g: 1, x: b[0] + (la + 1) * px + os, y, f: F, p: 0 }) }
      else { add({ g: 0, x: b[0] + (la + 1) * px + os, y }); add({ g: 1, x: b[0] + (la + 1) * px, y, f: F, p: 0 }); for (let i = runs.length - 1; i >= 0; i--) { const [x0, , v] = runs[i]; add({ g: 1, x: b[0] + x0 * px, y, f: F, p: v }) } add({ g: 1, x: b[0] + f * px - os, y, f: F, p: 0 }) }
      if (l.bidir !== false) dir = -dir
    }
  } else {
    for (let c = 0; c < pw; c++) {
      const x = b[0] + (c + .5) * px; let f = -1, la = -1; for (let r = 0; r < ph; r++)if (pv(data[r * pw + c]) > 0) { if (f < 0) f = r; la = r } if (f < 0) continue;
      const Y = r => b[3] - r * ry, runs = []; let r = f; while (r <= la) { const v = pv(data[r * pw + c]); let e = r; while (e + 1 <= la && pv(data[(e + 1) * pw + c]) === v) e++; runs.push([r, e, v]); r = e + 1 }
      if (dir > 0) { add({ g: 0, x, y: Y(f) + os }); add({ g: 1, x, y: Y(f), f: F, p: 0 }); for (const [, r1, v] of runs) add({ g: 1, x, y: Y(r1 + 1), f: F, p: v }); add({ g: 1, x, y: Y(la + 1) - os, f: F, p: 0 }) }
      else { add({ g: 0, x, y: Y(la + 1) - os }); add({ g: 1, x, y: Y(la + 1), f: F, p: 0 }); for (let i = runs.length - 1; i >= 0; i--) { const [r0, , v] = runs[i]; add({ g: 1, x, y: Y(r0), f: F, p: v }) } add({ g: 1, x, y: Y(f) + os, f: F, p: 0 }) }
      if (l.bidir !== false) dir = -dir
    }
  }
}
/* Time estimate with optional acceleration (spec 6.2). */
function estimateTime(job) {
  const m = job.machine, acc = m.accel > 0 ? m.accel : null; let t = 0, x = 0, y = 0, z = m.type === 'cnc' ? m.safeZ : 0, pdx = 0, pdy = 0, cut = 0, travel = 0;
  for (const op of job.ops) for (const mv of op.moves) {
    const nx = mv.x ?? x, ny = mv.y ?? y, nz = mv.z ?? z, d = Math.hypot(nx - x, ny - y, nz - z); if (d < 1e-9) continue;
    const v = (mv.g === 0 ? m.rapid : Math.min(mv.f || 1000, m.maxFeed || 1e9)) / 60, dx = (nx - x) / d, dy = (ny - y) / d;
    let dt = d / v;
    if (acc) { const turn = 1 - (dx * pdx + dy * pdy); const vEff = Math.min(v, Math.sqrt(acc * d)); dt = d / vEff + (vEff / acc) * clamp(turn, 0, 1) * .5 }
    t += dt; if (mv.g === 1 && (mv.p == null ? mv.z == null || nz < 0 : mv.p > 0)) cut += d; else travel += d;
    pdx = dx; pdy = dy; x = nx; y = ny; z = nz;
  }
  return { time: t, cut, travel, withAccel: !!acc };
}

/* ============================ G-code preview ============================ */
const P = { text: '', lines: [], moves: [], total: 0, t: 0, playing: false, rate: 20, mode: '2d', colorBy: 'layer', rapids: true, ghost: true, dirs: false, yaw: -.65, pitch: .95, sc: 1.2, panX: 0, panY: 0, laser: true, stats: null, file: null, follow: true, curLine: -1, layers: [], _acc: '#f0a43a', search: '', hits: [], rev: -1, plate: 0, post: null, report: null };
const LW = new Uint8Array(256), LV = new Float64Array(256);
function loadGcode(text, file, keepT) {
  P.text = text; P.file = file; P.lines = text.split(/\r?\n/); P.laser = file ? !/\bZ\s*-\s*\.?\d/i.test(text) : S.machine.type === 'laser';
  // combined laser + router programs switch heads; the first post comment tells which one starts
  const mixed = /=====\s*(СМЕНА ГОЛОВКИ|HEAD CHANGE)/.test(text); let lz = P.laser; if (mixed) { const pc = /;\s*(machine:.*?\|\s*)?post:([^\n]*)/.exec(text); lz = !!(pc && /лазер|laser/i.test(pc[2])); P.laser = false }
  const mv = [], layers = []; let x = 0, y = 0, z = P.laser ? 0 : S.machine.safeZ, f = 1000, s = 0, abs = true, inch = false, on = false, col = null, mode = 0, t = 0, cut = 0, rap = 0;
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], rapid = S.machine.rapid || 3000; let minF = Infinity, maxF = 0; let lastB = null;
  const push = (nx, ny, nz, i) => {
    const d = Math.hypot(nx - x, ny - y, nz - z); if (d < 1e-9) { x = nx; y = ny; z = nz; return } const r = mode === 0, feed = r ? rapid : Math.max(1, f);
    const c = !r && (lz ? (on && s > 0) : (Math.min(z, nz) < -1e-4)); const dt = d / feed * 60;
    const B = [nx, ny, nz], A = lastB && lastB[0] === x && lastB[1] === y && lastB[2] === z ? lastB : [x, y, z]; lastB = B; // consecutive moves share their joint point (fewer allocations)
    mv.push({ a: A, b: B, r, c, f: feed, s, l: i, col, t0: t, t1: t + dt }); t += dt; if (c) { cut += d; if (feed < minF) minF = feed; if (feed > maxF) maxF = feed; if (x < b[0]) b[0] = x; if (nx < b[0]) b[0] = nx; if (y < b[1]) b[1] = y; if (ny < b[1]) b[1] = ny; if (z < b[2]) b[2] = z; if (nz < b[2]) b[2] = nz; if (x > b[3]) b[3] = x; if (nx > b[3]) b[3] = nx; if (y > b[4]) b[4] = y; if (ny > b[4]) b[4] = ny; if (z > b[5]) b[5] = z; if (nz > b[5]) b[5] = nz } else rap += d; x = nx; y = ny; z = nz
  };
  for (let i = 0; i < P.lines.length; i++) {
    const raw = P.lines[i];
    const lm = /^\s*[;(]\s*LAYER\s+(\S+)\s+(#[0-9a-fA-F]{6})/.exec(raw); if (lm) { col = lm[2]; layers.push({ name: lm[1].replace(/_/g, ' ').replace(/\)$/, ''), color: col }); continue }
    if (mixed && /=====/.test(raw)) { lz = /ЛАЗЕР|LASER/.test(raw); continue }
    const nt = gcScan(raw, LW, LV); if (nt <= 0) continue;
    let nx = null, ny = null, nz = null, I = 0, J = 0, Rr = null;
    for (let q = 0; q < nt; q++) {
      const w = String.fromCharCode(LW[q]), v = LV[q];
      if (w === 'G') { if (v === 0 || v === 1 || v === 2 || v === 3) mode = v; else if (v === 90) abs = true; else if (v === 91) abs = false; else if (v === 20) inch = true; else if (v === 21) inch = false }
      else if (w === 'M') { if (v === 3 || v === 4) on = true; else if (v === 5) on = false }
      else if (w === 'X') nx = v; else if (w === 'Y') ny = v; else if (w === 'Z') nz = v; else if (w === 'F') f = v * (inch ? 25.4 : 1); else if (w === 'S') s = v; else if (w === 'I') I = v; else if (w === 'J') J = v; else if (w === 'R') Rr = v
    }
    if (nx == null && ny == null && nz == null) continue; const k = inch ? 25.4 : 1;
    const tx = nx == null ? x : abs ? nx * k : x + nx * k, ty = ny == null ? y : abs ? ny * k : y + ny * k, tz = nz == null ? z : abs ? nz * k : z + nz * k;
    if ((mode === 2 || mode === 3) && (I || J || Rr)) {
      let ccx = x + I * k, ccy = y + J * k;
      if (Rr != null && !I && !J) { const r = Rr * k, dx = tx - x, dy = ty - y, dd = Math.hypot(dx, dy) || 1, h = Math.sqrt(Math.max(0, r * r - dd * dd / 4)) * ((mode === 2) === (r > 0) ? 1 : -1); ccx = x + dx / 2 - h * dy / dd; ccy = y + dy / 2 + h * dx / dd }
      const r = Math.hypot(x - ccx, y - ccy), a0 = Math.atan2(y - ccy, x - ccx); let da = Math.atan2(ty - ccy, tx - ccx) - a0;
      if (mode === 2) { if (da >= -1e-9) da -= Math.PI * 2 } else { if (da <= 1e-9) da += Math.PI * 2 }
      const n = Math.max(4, Math.ceil(Math.abs(da) * r / .4)), z0 = z; for (let q = 1; q <= n; q++) { const a = a0 + da * q / n; push(q === n ? tx : ccx + r * Math.cos(a), q === n ? ty : ccy + r * Math.sin(a), z0 + (tz - z0) * q / n, i) }
    }
    else push(tx, ty, tz, i)
  }
  P.moves = mv; P.total = t; P.layers = layers; P.minF = minF; P.maxF = maxF; P.minZ = b[2];
  P.stats = { time: t, cut, rapid: rap, n: mv.length, b: isFinite(b[0]) ? b : [0, 0, 0, 0, 0, 0] };
  if (!keepT || !P.playing || P.t > t) P.t = t;
  if (typeof MC !== 'undefined') { MC.job.t = 0; MC.job.line = 0 }
}
function moveColor(mv) {
  if (P.colorBy === 'feed') { const k = P.maxF > P.minF ? (mv.f - P.minF) / (P.maxF - P.minF) : 1; return `hsl(${205 - 170 * k} 85% 55%)` }
  if (P.colorBy === 'z') { const k = P.minZ < 0 ? clamp(Math.min(mv.a[2], mv.b[2]) / P.minZ, 0, 1) : 1; return `hsl(${205 - 170 * k} 85% 55%)` }
  if (P.colorBy === 'power') { const k = clamp(mv.s / ((P.post && P.post.sMax) || S.machine.smax || 1000), 0, 1); return `hsl(${205 - 170 * k} 85% 55%)` }
  return mv.col || P._acc;
}
function idxAt(t) { const m = P.moves; let lo = 0, hi = m.length - 1; if (hi < 0) return -1; if (t >= m[hi].t1) return hi; while (lo < hi) { const mid = (lo + hi) >> 1; if (m[mid].t1 < t) lo = mid + 1; else hi = mid } return lo }
function posAt(t) { const i = idxAt(t); if (i < 0) return [0, 0, P.laser ? 0 : S.machine.safeZ]; const m = P.moves[i], k = m.t1 > m.t0 ? clamp((t - m.t0) / (m.t1 - m.t0), 0, 1) : 1; return [m.a[0] + (m.b[0] - m.a[0]) * k, m.a[1] + (m.b[1] - m.a[1]) * k, m.a[2] + (m.b[2] - m.a[2]) * k] }
function drawMoves(c, proj, upto, camView) {
  const mv = P.moves; if (!mv.length) return; const rc = css('--rapid'); P._acc = css('--accent');
  if (P.ghost && !camView && upto < P.total) { c.beginPath(); for (let i = Math.max(0, idxAt(upto)); i < mv.length; i++) { const m = mv[i]; if (!m.c) continue; const a = proj(m.a), b = proj(m.b); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]) } c.strokeStyle = css('--faint'); c.globalAlpha = .35; c.lineWidth = 1; c.stroke(); c.globalAlpha = 1 }
  if (!P.laser && camView) {
    const byL = {}; for (const m of mv) { if (!m.c) continue; const k = m.col || 'x'; (byL[k] = byL[k] || []).push(m) }
    for (const k in byL) { const L = S.layers.find(L => L.color === k); const tw = (L ? (L.cnc.op === 'vcarve' || L.cnc.op === 'chamfer' ? .4 : toolById(L.cnc.toolId).d) : 3) * V.s; c.beginPath(); for (const m of byL[k]) { const a = proj(m.a), b = proj(m.b); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]) } c.strokeStyle = hexA(k === 'x' ? '#f0a43a' : k, .13); c.lineWidth = Math.max(1, tw); c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke() } c.lineCap = 'butt'; c.lineJoin = 'miter'
  }
  const rap = []; let curCol = null; c.lineWidth = P.laser ? 1.2 : 1.5; c.beginPath();
  for (let i = 0; i < mv.length; i++) {
    const m = mv[i]; if (m.t0 >= upto) break; let b = m.b; if (m.t1 > upto) { const k = (upto - m.t0) / (m.t1 - m.t0); b = [m.a[0] + (m.b[0] - m.a[0]) * k, m.a[1] + (m.b[1] - m.a[1]) * k, m.a[2] + (m.b[2] - m.a[2]) * k] }
    if (!m.c) { if (P.rapids && m.r) rap.push(m.a, b); continue }
    const col = moveColor(m); if (col !== curCol) { if (curCol) c.stroke(); c.beginPath(); c.strokeStyle = curCol = col } const A = proj(m.a), B = proj(b); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1])
  }
  if (curCol) c.stroke();
  if (rap.length) { c.beginPath(); for (let i = 0; i < rap.length; i += 2) { const a = proj(rap[i]), b = proj(rap[i + 1]); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]) } c.setLineDash([4, 4]); c.strokeStyle = rc; c.globalAlpha = .7; c.lineWidth = 1; c.stroke(); c.setLineDash([]); c.globalAlpha = 1 }
  // direction arrows and laser on/off points (spec 6.2)
  if (P.dirs && mv.length < 60000) {
    c.fillStyle = css('--info'); let last = null, k = 0;
    for (let i = 0; i < mv.length; i++) {
      const m = mv[i]; if (m.t0 >= upto) break;
      if (m.c && (!last || !last.c)) { const A = proj(m.a); c.fillStyle = css('--ok'); c.beginPath(); c.arc(A[0], A[1], 2.6, 0, Math.PI * 2); c.fill() }
      if (!m.c && last && last.c) { const A = proj(m.a); c.fillStyle = css('--bad'); c.beginPath(); c.arc(A[0], A[1], 2.6, 0, Math.PI * 2); c.fill() }
      if (m.c && (k++ % 12 === 0)) { const A = proj(m.a), B = proj(m.b), dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy); if (l > 8) { const ux = dx / l, uy = dy / l, mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2; c.strokeStyle = css('--info'); c.lineWidth = 1.2; c.beginPath(); c.moveTo(mx - ux * 4 - uy * 3, my - uy * 4 + ux * 3); c.lineTo(mx, my); c.lineTo(mx - ux * 4 + uy * 3, my - uy * 4 - ux * 3); c.stroke() } }
      last = m;
    }
  }
}
function drawHead2D(c, proj, t) {
  if (!P.moves.length) return; const p = posAt(t), [x, y] = proj(p), i = idxAt(t), m = P.moves[i], burn = m && m.c && t < P.total;
  if (P.laser) { if (burn) { const g = c.createRadialGradient(x, y, 0, x, y, 14); g.addColorStop(0, 'rgba(255,90,40,.9)'); g.addColorStop(1, 'rgba(255,90,40,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.fill() } c.strokeStyle = css('--fg'); c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.moveTo(x - 10, y); c.lineTo(x - 3, y); c.moveTo(x + 3, y); c.lineTo(x + 10, y); c.moveTo(x, y - 10); c.lineTo(x, y - 3); c.moveTo(x, y + 3); c.lineTo(x, y + 10); c.stroke() }
  else { const L = S.layers.find(L => L.color === (m && m.col)), r = Math.max(4, (L ? toolById(L.cnc.toolId).d : 3) / 2 * V.s); c.fillStyle = burn ? 'rgba(240,164,58,.35)' : 'rgba(140,150,165,.3)'; c.strokeStyle = css('--fg'); c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke() }
}
function proj3(p, W, H) { const m = S.machine, X = p[0] - m.w / 2, Y = p[1] - m.h / 2, Z = p[2] * (P.laser ? 1 : 2); const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw); const x1 = X * cy - Y * sy, y1 = X * sy + Y * cy; const u = y1 * Math.cos(P.pitch) + Z * Math.sin(P.pitch); return [W / 2 + P.panX + x1 * P.sc, H / 2 + P.panY - u * P.sc] }
function draw3D(c, W, H) {
  const m = S.machine, pj = p => proj3(p, W, H), poly = pts => { c.beginPath(); pts.forEach((p, i) => { const q = pj(p); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]) }); c.closePath() };
  const sh = sheetAt(P.plate || 0), bedZ = P.laser ? 0 : -sh.thick;
  poly([[0, 0, bedZ], [m.w, 0, bedZ], [m.w, m.h, bedZ], [0, m.h, bedZ]]); c.fillStyle = css('--bed'); c.fill(); c.strokeStyle = css('--line-2'); c.lineWidth = 1; c.stroke();
  c.beginPath(); const st = m.w > 300 ? 50 : 25; for (let x = 0; x <= m.w; x += st) { const a = pj([x, 0, bedZ]), b = pj([x, m.h, bedZ]); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]) } for (let y = 0; y <= m.h; y += st) { const a = pj([0, y, bedZ]), b = pj([m.w, y, bedZ]); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]) } c.strokeStyle = css('--grid-2'); c.stroke();
  { const zt = 0, zb = P.laser ? -.01 : -sh.thick; poly([[sh.x, sh.y, zt], [sh.x + sh.w, sh.y, zt], [sh.x + sh.w, sh.y + sh.h, zt], [sh.x, sh.y + sh.h, zt]]); c.fillStyle = css('--sheet'); c.fill(); c.strokeStyle = css('--sheet-line'); c.stroke(); if (!P.laser) { c.beginPath(); for (const [x, y] of [[sh.x, sh.y], [sh.x + sh.w, sh.y], [sh.x + sh.w, sh.y + sh.h], [sh.x, sh.y + sh.h]]) { const a = pj([x, y, 0]), q = pj([x, y, zb]); c.moveTo(a[0], a[1]); c.lineTo(q[0], q[1]) } c.stroke() } }
  const o = pj([0, 0, bedZ]); for (const [d, col, l] of [[[20, 0, 0], '#e5484d', 'X'], [[0, 20, 0], '#30a46c', 'Y'], [[0, 0, 20], '#3e8ef7', 'Z']]) { const q = pj([d[0], d[1], bedZ + d[2]]); c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(o[0], o[1]); c.lineTo(q[0], q[1]); c.stroke(); c.fillStyle = col; c.font = `600 11px ${css('--f-mono')}`; c.fillText(l, q[0] + 3, q[1] - 3) }
  drawMoves(c, pj, P.t, false);
  if (P.moves.length) { const p = posAt(P.t), a = pj(p), top = pj([p[0], p[1], p[2] + (P.laser ? 25 : 30)]); c.strokeStyle = css('--fg'); c.lineWidth = P.laser ? 1.5 : 4; c.globalAlpha = .8; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(top[0], top[1]); c.stroke(); c.globalAlpha = 1; const i = idxAt(P.t), mm = P.moves[i]; if (mm && mm.c && P.t < P.total && P.laser) { c.fillStyle = 'rgba(255,90,40,.9)'; c.beginPath(); c.arc(a[0], a[1], 4, 0, Math.PI * 2); c.fill() } }
}
/* G-code listing with virtual scrolling, highlighting and search (spec 5.1) */
function hl(line) {
  const e = esc(line); if (/^\s*[;(]\s*LAYER/.test(line)) return `<span class="c-l">${e}</span>`;
  const i = e.search(/[;(]/), code = i < 0 ? e : e.slice(0, i), cm = i < 0 ? '' : `<span class="c-c">${e.slice(i)}</span>`;
  return code.replace(/\b([GM])(\d+)/g, (_, a, b) => `<span class="c-${a.toLowerCase()}">${a}${b}</span>`).replace(/\b([FS])(-?[\d.]+)/g, '<span class="c-f">$1$2</span>') + cm
}
function renderGcList() {
  const box = $('#gcList'), inn = $('#gcInner'); if (!box || !inn) return; const rh = 19, n = P.lines.length; inn.style.height = n * rh + 'px';
  const top = box.scrollTop, h = box.clientHeight || 400, i0 = Math.max(0, Math.floor(top / rh) - 6), i1 = Math.min(n, Math.ceil((top + h) / rh) + 6); let s = ''; const hits = new Set(P.hits);
  for (let i = i0; i < i1; i++)s += `<div class="gl${i === P.curLine ? ' on' : ''}${hits.has(i) ? ' hit' : ''}" style="top:${i * rh}px" data-line="${i}"><b>${i + 1}</b><code>${hl(P.lines[i])}</code></div>`; inn.innerHTML = s
}
function gcSearch(q) {
  P.search = q; P.hits = []; if (!q) { renderGcList(); return 0 }
  const qq = q.toUpperCase(); for (let i = 0; i < P.lines.length && P.hits.length < 5000; i++) if (P.lines[i].toUpperCase().includes(qq)) P.hits.push(i);
  if (P.hits.length) { const box = $('#gcList'); if (box) box.scrollTop = P.hits[0] * 19 - 60 } renderGcList(); return P.hits.length;
}
function syncLine() {
  if (!P.moves.length) return; const i = idxAt(P.t), ln = P.t >= P.total ? -1 : P.moves[i].l; if (ln === P.curLine) return; P.curLine = ln; const box = $('#gcList');
  if (box && P.follow && ln >= 0) { const y = ln * 19; if (y < box.scrollTop + 20 || y > box.scrollTop + box.clientHeight - 40) box.scrollTop = y - box.clientHeight / 2 } renderGcList()
}
