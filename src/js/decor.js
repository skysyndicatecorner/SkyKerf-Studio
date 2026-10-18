'use strict';
/* ============================================================================
   SkyKerf_Studio · decoration library for generators
   Outline shapes, surface patterns, border motifs and ornaments. Everything is
   built from geometry here (no third-party artwork). Coordinates are mm, y up.
   ============================================================================ */
const TAU = Math.PI * 2;
const circlePts = (cx, cy, r, n) => ellipsePts(cx, cy, r, r, n || Math.max(16, Math.min(96, Math.round(r * 3))));
const bezPts = (p0, p1, p2, p3, n = 14) => cubic(p0, p1, p2, p3, n);
const union = list => list.length ? (list.length === 1 ? list[0] : boolOp(list[0], list.slice(1).flat(), 'union')) : [];
const polyArea = p => Math.abs(area(p));
/* orientation helpers: outer outlines counter-clockwise */
const ccw = p => area(p) < 0 ? p.slice().reverse() : p;

/* ---------------- outline shapes (one closed loop, or several for unions) ---------------- */
const OUTLINES = () => [
  ['rect', T('прямоугольник', 'rectangle')], ['round', T('скруглённый', 'rounded')], ['oval', T('овал', 'oval')], ['circle', T('круг', 'circle')],
  ['arch', T('арка', 'arch')], ['gothic', T('стрельчатая арка', 'pointed arch')], ['onion', T('луковица (восточная арка)', 'onion (ogee) arch')], ['trefoil', T('трилистник', 'trefoil arch')],
  ['chamfer', T('со срезанными углами', 'chamfered')], ['notched', T('с вогнутыми углами', 'concave corners')], ['cartouche', T('картуш', 'cartouche')],
  ['scallop', T('фестоны (волны по краю)', 'scalloped edge')], ['stamp', T('марка (зубчики)', 'postage stamp')], ['wave', T('волнистый', 'wavy')],
  ['cloud', T('облако', 'cloud')], ['heart', T('сердце', 'heart')], ['shield', T('щит', 'shield')], ['house', T('домик', 'house')], ['ribbon', T('лента', 'ribbon banner')], ['hexagon', T('шестиугольник', 'hexagon')], ['star', T('звезда', 'star')]];
const outlineName = k => (OUTLINES().find(x => x[0] === k) || [k, k])[1];
/* Returns an array of closed paths (outer first). r = corner/feature size. */
function outline(kind, x, y, w, h, r) {
  r = r == null ? Math.min(w, h) * .08 : r;
  const cx = x + w / 2, cy = y + h / 2, m = Math.min(w, h);
  switch (kind) {
    case 'rect': return [rectPts(x, y, w, h)];
    case 'round': return [rectPts(x, y, w, h, Math.min(Math.max(r, 1), m / 2 - .01))];
    case 'oval': return [ellipsePts(cx, cy, w / 2, h / 2, 96)];
    case 'circle': return [circlePts(cx, cy, m / 2)];
    case 'arch': { const rr = w / 2, ys = Math.max(y, y + h - rr); return [[[x, y], [x + w, y], [x + w, ys], ...arcPts(cx, ys, rr, 0, Math.PI).slice(1, -1), [x, ys]]] }
    case 'gothic': {
      const ah = Math.min(h * .55, w * .866), ys = y + h - ah, sx = ah / (w * .866), pts = [[x, y], [x + w, y], [x + w, ys]];
      for (let i = 1; i <= 16; i++) { const a = Math.PI * i / 48; pts.push([x + w - w * (1 - Math.cos(a)), ys + w * Math.sin(a) * sx]) }
      pts.push([cx, y + h]);
      for (let i = 15; i >= 1; i--) { const a = Math.PI * i / 48; pts.push([x + w * (1 - Math.cos(a)), ys + w * Math.sin(a) * sx]) }
      pts.push([x, ys]); return [pts];
    }
    case 'onion': {
      const ah = Math.min(h * .55, w * 1.05), ys = y + h - ah, b = w * .12, pts = [[x, y], [x + w, y], [x + w, ys]];
      const R = bezPts([x + w, ys], [x + w + b, ys + ah * .35], [cx + w * .05, ys + ah * .55], [cx, y + h], 18), Lp = bezPts([cx, y + h], [cx - w * .05, ys + ah * .55], [x - b, ys + ah * .35], [x, ys], 18);
      return [pts.concat(R.slice(1), Lp.slice(1, -1))];
    }
    case 'trefoil': {
      const rr = w / 4, ys = y + h - w * .5 - rr * .3;
      return union([[rectPts(x, y, w, Math.max(1, ys - y + rr * .5))], [circlePts(x + rr, ys, rr)], [circlePts(x + w - rr, ys, rr)], [circlePts(cx, ys + rr * .9, rr * 1.05)], [rectPts(x + rr, y, w - 2 * rr, ys - y + rr * .9)]]);
    }
    case 'chamfer': { const c = Math.min(Math.max(r, 2), m * .3); return [[[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]]] }
    case 'notched': { const c = Math.min(Math.max(r, 2), m * .3); return boolOp([rectPts(x, y, w, h)], [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([qx, qy]) => circlePts(qx, qy, c)), 'diff') }
    case 'cartouche': {
      const c = Math.min(Math.max(r, 3), m * .22), base = boolOp([rectPts(x, y, w, h)], [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([qx, qy]) => circlePts(qx, qy, c)), 'diff');
      return boolOp(base, [circlePts(cx, y + h, c * .7), circlePts(cx, y, c * .7), circlePts(x, cy, c * .7), circlePts(x + w, cy, c * .7)], 'union');
    }
    case 'scallop': {
      const s = Math.max(r * 1.6, 4), inner = rectPts(x + s / 2, y + s / 2, w - s, h - s), bumps = [];
      const along = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / s)); for (let i = 0; i <= n; i++) bumps.push(circlePts(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, s / 2)) };
      along(x + s / 2, y + s / 2, x + w - s / 2, y + s / 2); along(x + w - s / 2, y + s / 2, x + w - s / 2, y + h - s / 2); along(x + w - s / 2, y + h - s / 2, x + s / 2, y + h - s / 2); along(x + s / 2, y + h - s / 2, x + s / 2, y + s / 2);
      return boolOp([inner], bumps, 'union');
    }
    case 'stamp': {
      const s = Math.max(r, 3), bites = [], along = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(L / (s * 2.2))); for (let i = 0; i <= n; i++) bites.push(circlePts(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, s * .55)) };
      along(x, y, x + w, y); along(x + w, y, x + w, y + h); along(x + w, y + h, x, y + h); along(x, y + h, x, y);
      return boolOp([rectPts(x, y, w, h)], bites, 'diff');
    }
    case 'wave': {
      const a = Math.max(r * .5, 1.5), pts = [], N = 160;
      const P = (t) => { const per = 2 * (w + h), d = t * per; let px, py, nx, ny; if (d < w) { px = x + d; py = y; nx = 0; ny = -1 } else if (d < w + h) { px = x + w; py = y + d - w; nx = 1; ny = 0 } else if (d < 2 * w + h) { px = x + w - (d - w - h); py = y + h; nx = 0; ny = 1 } else { px = x; py = y + h - (d - 2 * w - h); nx = -1; ny = 0 } const k = Math.sin(d / (a * 6) * TAU) * a; return [px + nx * (k - a), py + ny * (k - a)] };
      for (let i = 0; i < N * 4; i++) pts.push(P(i / (N * 4))); return [pts];
    }
    case 'cloud': {
      const bumps = [ellipsePts(cx, cy, w * .36, h * .3, 64)], n = 9;
      for (let i = 0; i < n; i++) { const a = TAU * i / n, rr = m * (.17 + .05 * ((i * 7) % 3) / 2); bumps.push(circlePts(cx + Math.cos(a) * (w / 2 - rr), cy + Math.sin(a) * (h / 2 - rr), rr)) }
      return union(bumps.map(b => [b]));
    }
    case 'heart': { const pts = []; for (let i = 0; i < 120; i++) { const t = TAU * i / 120, hx = 16 * Math.sin(t) ** 3, hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); pts.push([cx + hx / 32 * w, y + (hy + 17) / 29.5 * h]) } return [ccw(pts)] }
    case 'shield': { const sh = h * .42; return [[[x, y + h], [x, y + sh + h * .1], ...bezPts([x, y + sh], [x, y + sh * .4], [cx - w * .25, y + h * .05], [cx, y], 12), ...bezPts([cx, y], [cx + w * .25, y + h * .05], [x + w, y + sh * .4], [x + w, y + sh], 12).slice(1), [x + w, y + sh + h * .1], [x + w, y + h]].reverse()] }
    case 'house': { const wh = h * .62; return [[[x, y], [x + w, y], [x + w, y + wh], [cx, y + h], [x, y + wh]]] }
    case 'ribbon': { const n = Math.min(w * .12, h * .6); return [[[x, y], [x + w, y], [x + w - n, y + h / 2], [x + w, y + h], [x, y + h], [x + n, y + h / 2]]] }
    case 'hexagon': return [polyPts(cx, cy, m / 2, 6).map(([px, py]) => [cx + (px - cx) * w / m, cy + (py - cy) * h / m])];
    case 'star': return [starPts(cx, cy, m / 2, m * .22, 5)];
  }
  return [rectPts(x, y, w, h)];
}

/* ---------------- small motifs (closed loops in a unit box, centred at 0,0, size 1) ---------------- */
const MOTIFS = () => [['heart', T('сердечки', 'hearts')], ['star', T('звёзды', 'stars')], ['snow', T('снежинки', 'snowflakes')], ['leaf', T('листья', 'leaves')], ['flower', T('цветы', 'flowers')], ['dot', T('точки', 'dots')], ['diamond', T('ромбы', 'diamonds')], ['moon', T('месяц', 'crescents')], ['fir', T('ёлочки', 'fir trees')], ['drop', T('капли', 'drops')]];
function motif(kind, cx, cy, s, ang = 0) {
  let P;
  switch (kind) {
    case 'heart': P = outline('heart', -.5, -.45, 1, .9); break;
    case 'star': P = [starPts(0, 0, .5, .21, 5)]; break;
    case 'dot': P = [circlePts(0, 0, .35, 24)]; break;
    case 'diamond': P = [[[0, -.5], [.32, 0], [0, .5], [-.32, 0]]]; break;
    case 'drop': P = [[...bezPts([0, -.45], [.42, -.45], [.3, .05], [0, .5], 10), ...bezPts([0, .5], [-.3, .05], [-.42, -.45], [0, -.45], 10).slice(1, -1)]]; break;
    case 'leaf': P = [[...bezPts([0, -.5], [.38, -.2], [.3, .25], [0, .5], 10), ...bezPts([0, .5], [-.3, .25], [-.38, -.2], [0, -.5], 10).slice(1, -1)]]; break;
    case 'moon': P = boolOp([circlePts(0, 0, .45, 32)], [circlePts(.18, .1, .38, 32)], 'diff'); break;
    case 'fir': P = [[[0, .5], [.22, .2], [.12, .2], [.32, -.12], [.18, -.12], [.4, -.38], [.06, -.38], [.06, -.5], [-.06, -.5], [-.06, -.38], [-.4, -.38], [-.18, -.12], [-.32, -.12], [-.12, .2], [-.22, .2]]]; break;
    case 'flower': { const pet = []; for (let i = 0; i < 5; i++) { const a = TAU * i / 5; pet.push([ellipsePts(Math.cos(a) * .25, Math.sin(a) * .25, .2, .2, 20)]) } pet.push([circlePts(0, 0, .14, 16)]); P = union(pet); break }
    case 'snow': { const arms = []; for (let i = 0; i < 6; i++) { const a = TAU * i / 6, c = Math.cos(a), sn = Math.sin(a); arms.push([[0, 0], [c * .5, sn * .5]], [[c * .3, sn * .3], [c * .3 + Math.cos(a + .7) * .14, sn * .3 + Math.sin(a + .7) * .14]], [[c * .3, sn * .3], [c * .3 + Math.cos(a - .7) * .14, sn * .3 + Math.sin(a - .7) * .14]]) } P = offsetOpen(arms, .05); break }
    default: P = [circlePts(0, 0, .35, 24)];
  }
  const ca = Math.cos(ang), sa = Math.sin(ang);
  return P.map(p => p.map(([px, py]) => [cx + (px * ca - py * sa) * s, cy + (px * sa + py * ca) * s]));
}

/* ---------------- walking along a closed path ---------------- */
function pathLength(p) { let L = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; L += Math.hypot(b[0] - a[0], b[1] - a[1]) } return L }
/* Calls fn(x, y, angle) at evenly spaced points along a closed path. */
function alongClosed(p, spacing, fn, phase = .5) {
  const L = pathLength(p), n = Math.max(3, Math.round(L / spacing)), step = L / n; let i = 0, acc = 0, target = step * phase;
  for (let k = 0; k < n; k++, target += step) {
    while (i < p.length) { const a = p[i], b = p[(i + 1) % p.length], sl = Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc + sl >= target) { const t = sl ? (target - acc) / sl : 0; fn(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])); break } acc += sl; i++ }
  }
}

/* ---------------- border decoration along an outline ----------------
   Returns {lines:[open paths], shapes:[closed paths]} for engraving or cutting. */
const BORDERS = () => [['none', T('нет', 'none')], ['line', T('линия', 'line')], ['double', T('двойная линия', 'double line')], ['dash', T('пунктир', 'dashed')], ['dots', T('точки', 'dots')], ['beads', T('бусины', 'beads')], ['rope', T('верёвка', 'rope')], ['waves', T('волны', 'waves')], ['zigzag', T('зигзаг', 'zigzag')], ['greek', T('меандр (греческий)', 'Greek key')], ['vine', T('лоза с листьями', 'vine with leaves')], ['hearts', T('сердечки', 'hearts')], ['stars', T('звёзды', 'stars')], ['snow', T('снежинки', 'snowflakes')], ['flowers', T('цветы', 'flowers')], ['lace', T('кружево (прорези)', 'lace (cut-outs)')]];
function borderDeco(kind, loop, band) {
  const lines = [], shapes = [], b = Math.max(2, band);
  const path = loop;
  const motifAlong = (mk, sz, gap) => alongClosed(path, sz + gap, (px, py, a) => { for (const q of motif(mk, px, py, sz, mk === 'leaf' ? a + Math.PI / 2 : 0)) shapes.push(q) });
  switch (kind) {
    case 'line': lines.push(path.concat([path[0]])); break;
    case 'double': for (const d of [-b * .18, b * .18]) for (const q of offsetPaths([path], d)) lines.push(q.concat([q[0]])); break;
    case 'dash': { let on = true; alongClosed(path, Math.max(1.5, b * .35), (px, py, a) => { if (on) lines.push([[px - Math.cos(a) * b * .14, py - Math.sin(a) * b * .14], [px + Math.cos(a) * b * .14, py + Math.sin(a) * b * .14]]); on = !on }); break }
    case 'dots': alongClosed(path, Math.max(2, b * .45), (px, py) => shapes.push(circlePts(px, py, Math.max(.35, b * .09), 14))); break;
    case 'beads': alongClosed(path, Math.max(2.5, b * .5), (px, py) => shapes.push(circlePts(px, py, Math.max(.6, b * .2), 18))); break;
    case 'rope': alongClosed(path, Math.max(1.5, b * .3), (px, py, a) => { const d = b * .22, c = Math.cos(a + .9), s = Math.sin(a + .9); lines.push([[px - c * d, py - s * d], [px + c * d, py + s * d]]) }); break;
    case 'waves': case 'zigzag': {
      const pts = [], amp = b * .22, per = Math.max(3, b * .9); let k = 0;
      alongClosed(path, per / 8, (px, py, a) => { const ph = k++ / 8 * TAU, v = kind === 'waves' ? Math.sin(ph) : (((k % 8) < 4 ? (k % 8) / 2 - 1 : 3 - (k % 8) / 2)), nx = -Math.sin(a), ny = Math.cos(a); pts.push([px + nx * v * amp, py + ny * v * amp]) });
      if (pts.length) lines.push(pts.concat([pts[0]])); break;
    }
    case 'greek': {
      const u = Math.max(1, b * .16); alongClosed(path, u * 6, (px, py, a) => {
        const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c, P = (ax, ay) => [px + c * ax * u + nx * ay * u, py + s * ax * u + ny * ay * u];
        lines.push([P(-3, -2), P(-3, 2), P(1, 2), P(1, -1), P(-1, -1), P(-1, 1)].concat([]), [P(1, -2), P(3, -2)]); lines.push([P(-3, -2), P(1, -2)]);
      }); break;
    }
    case 'vine': {
      const pts = [], amp = b * .18, per = Math.max(6, b * 1.6); let k = 0;
      alongClosed(path, per / 10, (px, py, a) => { const v = Math.sin(k / 10 * TAU), nx = -Math.sin(a), ny = Math.cos(a); pts.push([px + nx * v * amp, py + ny * v * amp]); if (k % 5 === 2) for (const q of motif('leaf', px + nx * v * amp + nx * b * .22 * Math.sign(v || 1), py + ny * v * amp + ny * b * .22 * Math.sign(v || 1), b * .38, a + (v > 0 ? .6 : -.6) + Math.PI / 2)) shapes.push(q); k++ });
      if (pts.length) lines.push(pts.concat([pts[0]])); break;
    }
    case 'hearts': motifAlong('heart', b * .45, b * .35); break;
    case 'stars': motifAlong('star', b * .5, b * .3); break;
    case 'snow': motifAlong('snow', b * .55, b * .3); break;
    case 'flowers': motifAlong('flower', b * .5, b * .35); break;
    case 'lace': alongClosed(path, Math.max(3, b * .55), (px, py, a) => { shapes.push(circlePts(px, py, Math.max(.6, b * .14), 16)); for (const q of motif('drop', px - Math.sin(a) * b * .3, py + Math.cos(a) * b * .3, b * .22, a)) shapes.push(q) }); break;
  }
  return { lines, shapes };
}
/* corner ornaments: scrolls placed in the four corners of a box */
const CORNERS = () => [['none', T('нет', 'none')], ['scroll', T('завиток', 'scroll')], ['leafy', T('ветка с листьями', 'leafy branch')], ['fan', T('веер', 'fan')], ['dots', T('уголок из точек', 'dot corner')]];
function cornerDeco(kind, box, size) {
  const [x0, y0, x1, y1] = box, lines = [], shapes = [], s = size;
  const put = (fn) => { for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x1, y1, -1, -1], [x0, y1, 1, -1]]) fn((px, py) => [cx + px * sx, cy + py * sy]) };
  if (kind === 'scroll') put(F => { const pts = []; for (let i = 0; i <= 60; i++) { const t = i / 60 * TAU * 1.25, r = s * (.55 - .4 * i / 60); pts.push(F(s * .5 + Math.cos(t) * r * .8, s * .5 + Math.sin(t) * r * .8)) } lines.push(pts); lines.push([F(0, s * .05), F(s * 1.1, s * .05)], [F(s * .05, 0), F(s * .05, s * 1.1)]) });
  if (kind === 'leafy') put(F => { lines.push([F(0, 0), F(s * .3, s * .3), F(s * .8, s * .55), F(s * 1.2, s * .6)]); lines.push([F(s * .3, s * .3), F(s * .55, s * .8), F(s * .6, s * 1.2)]); for (const [px, py, a] of [[s * .62, s * .45, .5], [s * .45, s * .62, 1.1], [s * 1, s * .52, .2], [s * .52, s * 1, 1.4]]) { const p = F(px, py); for (const q of motif('leaf', p[0], p[1], s * .32, a)) shapes.push(q) } });
  if (kind === 'fan') put(F => { for (let i = 0; i <= 4; i++) { const a = Math.PI / 2 * i / 4; lines.push([F(0, 0), F(Math.cos(a) * s, Math.sin(a) * s)]) } const arc = []; for (let i = 0; i <= 16; i++) { const a = Math.PI / 2 * i / 16; arc.push(F(Math.cos(a) * s, Math.sin(a) * s)) } lines.push(arc) });
  if (kind === 'dots') put(F => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) { const p = F(s * .2 + i * s * .25, s * .2 + j * s * .25); shapes.push(circlePts(p[0], p[1], s * .07, 12)) } });
  return { lines, shapes };
}

/* ---------------- surface patterns inside a region (for walls, roofs, panels) ----------------
   region: closed paths (evenodd). Returns {lines, shapes} already clipped to the region. */
const SURFACES = () => [['none', T('нет', 'none')], ['planks', T('доски горизонтальные', 'horizontal planks')], ['boards', T('доски вертикальные', 'vertical boards')], ['logs', T('брёвна (сруб)', 'logs (log cabin)')], ['bricks', T('кирпич', 'bricks')], ['stones', T('камень', 'stone')], ['fachwerk', T('фахверк', 'half-timbering')], ['shoji', T('сёдзи (японская решётка)', 'shoji (Japanese lattice)')], ['asanoha', T('асаноха (японский узор)', 'asanoha (Japanese)')], ['seigaiha', T('сэйгайха (волны)', 'seigaiha (waves)')], ['siding', T('сайдинг (современный)', 'siding (modern)')], ['panels', T('панели (sci-fi)', 'panels (sci-fi)')], ['diamonds', T('ромбы', 'diamonds')], ['honeycomb', T('соты', 'honeycomb')], ['dots', T('точки', 'dots')]];
const ROOFINGS = () => [['none', T('нет', 'none')], ['shingles', T('черепица-чешуя', 'fish-scale shingles')], ['tiles', T('черепица прямоугольная', 'rectangular tiles')], ['slate', T('сланец (ромбы)', 'slate (diamonds)')], ['planks', T('доски', 'planks')], ['thatch', T('солома', 'thatch')], ['seam', T('фальц (металл)', 'standing seam')], ['kawara', T('кавара (японская)', 'kawara (Japanese)')]];
function surface(kind, region, s, seed) {
  if (!kind || kind === 'none' || !region.length) return { lines: [], shapes: [] };
  const b = bboxOf(region), [x0, y0, x1, y1] = b, L = [], C = [], st = Math.max(2, s || 6);
  seedRnd = 1 + (seed | 0) * 7919;
  switch (kind) {
    case 'planks': for (let y = y0 + st; y < y1; y += st) L.push([[x0, y], [x1, y]]); { let r = 0; for (let y = y0; y < y1; y += st, r++) for (let x = x0 + (r % 3) * st * 3 + st * 4; x < x1; x += st * 9) L.push([[x, y], [x, y + st]]) } break;
    case 'boards': for (let x = x0 + st; x < x1; x += st) L.push([[x, y0], [x, y1]]); break;
    case 'siding': for (let y = y0 + st * .6; y < y1; y += st * .6) L.push([[x0, y], [x1, y]]); break;
    case 'logs': for (let y = y0 + st * 1.2; y < y1; y += st * 1.2) L.push([[x0, y], [x1, y]]); for (let y = y0 + st * .6; y < y1; y += st * 1.2) { C.push(circlePts(x0 + st * .55, y, st * .5, 20)); C.push(circlePts(x1 - st * .55, y, st * .5, 20)); L.push(circlePts(x0 + st * .55, y, st * .25, 14).concat([[x0 + st * .55 + st * .25, y]])); L.push(circlePts(x1 - st * .55, y, st * .25, 14).concat([[x1 - st * .55 + st * .25, y]])) } break;
    case 'bricks': { let r = 0; for (let y = y0 + st; y < y1 + st; y += st, r++) { L.push([[x0, y], [x1, y]]); for (let x = x0 + (r % 2 ? st : 0); x < x1; x += st * 2) L.push([[x, y - st], [x, y]]) } break }
    case 'stones': { let r = 0; for (let y = y0; y < y1; y += st * 1.3, r++) { let x = x0 - rnd() * st; while (x < x1) { const w = st * (1.4 + rnd() * 1.4), h = st * 1.3 - .8; C.push(rectPts(x + .4, y + .4, w - .8, h, Math.min(2, st * .3))); x += w } } return { lines: [], shapes: clipShapes(C, region) } }
    case 'fachwerk': {
      const bw = Math.max(1.2, st * .35), Hh = y1 - y0, posts = Math.max(2, Math.round((x1 - x0) / (st * 6)));
      const beams = [rectPts(x0, y0, x1 - x0, bw), rectPts(x0, y1 - bw, x1 - x0, bw), rectPts(x0, y0 + Hh * .5 - bw / 2, x1 - x0, bw)];
      for (let i = 0; i <= posts; i++) { const x = x0 + (x1 - x0) * i / posts; beams.push(rectPts(x - bw / 2, y0, bw, Hh)) }
      for (let i = 0; i < posts; i++) { const xa = x0 + (x1 - x0) * i / posts, xb = x0 + (x1 - x0) * (i + 1) / posts, ya = y0 + Hh * (i % 2 ? .5 : 0), yb = ya + Hh * .5; beams.push(...offsetOpen([i % 2 ? [[xa, ya], [xb, yb]] : [[xa, yb], [xb, ya]]], bw / 2)) }
      return { lines: [], shapes: clipShapes(union(beams.map(q => [q])), region) };
    }
    case 'shoji': for (let y = y0 + st * 1.6; y < y1; y += st * 1.6) L.push([[x0, y], [x1, y]]); for (let x = x0 + st; x < x1; x += st) L.push([[x, y0], [x, y1]]); break;
    case 'asanoha': {
      const a = st * 1.6, h = a * Math.sqrt(3) / 2;
      for (let r = 0, y = y0; y < y1 + h; y += h, r++) for (let x = x0 - a + (r % 2) * a / 2; x < x1 + a; x += a) {
        const A = [x, y], B = [x + a, y], Cc = [x + a / 2, y + h], g = [x + a / 2, y + h / 3];
        L.push([A, B], [A, Cc], [B, Cc], [A, g], [B, g], [Cc, g]);
      }
      break;
    }
    case 'seigaiha': { const R = st * 1.2; for (let r = 0, y = y0; y < y1 + R; y += R * .5, r++) for (let x = x0 - R + (r % 2) * R; x < x1 + R; x += R * 2) for (const k of [1, .7, .4]) L.push(arcPts(x, y, R * k, 0, Math.PI, .4)) } break;
    case 'panels': for (let y = y0 + 3; y < y1 - 6; y += st * 2.4) for (let x = x0 + 3; x < x1 - 8; x += st * 3.2) { const w = st * (2 + rnd()), h = st * (1.5 + rnd() * .6); L.push(rectPts(x, y, Math.min(w, x1 - 3 - x), Math.min(h, y1 - 3 - y), 1.5).concat([[x + 1.5, y]])) } break;
    case 'diamonds': for (let d = x0 - (y1 - y0); d < x1 + (y1 - y0); d += st * 1.4) { L.push([[d, y0], [d + (y1 - y0), y1]]); L.push([[d, y1], [d + (y1 - y0), y0]]) } break;
    case 'honeycomb': { const r = st * .8, w = r * Math.sqrt(3); for (let j = 0, y = y0; y < y1 + r; y += r * 1.5, j++) for (let x = x0 + (j % 2) * w / 2; x < x1 + w; x += w) { const h = polyPts(x, y, r * .92, 6); L.push(h.concat([h[0]])) } break }
    case 'dots': for (let j = 0, y = y0 + st / 2; y < y1; y += st, j++) for (let x = x0 + st / 2 + (j % 2) * st / 2; x < x1; x += st) C.push(circlePts(x, y, st * .12, 10)); break;
  }
  return { lines: L.length ? clipOpen(L, region, true) : [], shapes: C.length ? clipShapes(C, region) : [] };
}
function roofing(kind, region, s) {
  if (!kind || kind === 'none') return { lines: [], shapes: [] };
  const b = bboxOf(region), [x0, y0, x1, y1] = b, L = [], st = Math.max(2.5, s || 6);
  switch (kind) {
    case 'shingles': { let r = 0; for (let y = y1 - st * .3; y > y0 - st; y -= st * .75, r++) { const row = []; for (let x = x0 - st + (r % 2) * st / 2; x < x1 + st; x += st) row.push(...arcPts(x + st / 2, y, st / 2, Math.PI, TAU, .6)); L.push(row) } break }
    case 'tiles': { let r = 0; for (let y = y1 - st; y > y0 - st; y -= st, r++) { L.push([[x0, y], [x1, y]]); for (let x = x0 + (r % 2) * st * .6; x < x1; x += st * 1.2) L.push([[x, y], [x, y + st]]) } break }
    case 'slate': for (let d = x0 - (y1 - y0); d < x1 + (y1 - y0); d += st) { L.push([[d, y0], [d + (y1 - y0), y1]]); L.push([[d, y1], [d + (y1 - y0), y0]]) } break;
    case 'planks': for (let x = x0 + st; x < x1; x += st) L.push([[x, y0], [x, y1]]); break;
    case 'thatch': seedRnd = 99; for (let y = y1 - st; y > y0 - st; y -= st * .9) { const row = []; for (let x = x0; x <= x1; x += st * .25) row.push([x, y + (rnd() - .5) * st * .3]); L.push(row); for (let x = x0; x < x1; x += st * .3) L.push([[x, y], [x + (rnd() - .5) * st * .2, y + st * .7]]) } break;
    case 'seam': for (let x = x0 + st * 1.6; x < x1; x += st * 1.6) { L.push([[x - .35, y0], [x - .35, y1]]); L.push([[x + .35, y0], [x + .35, y1]]) } break;
    case 'kawara': for (let x = x0 + st; x < x1; x += st) { L.push([[x, y0], [x, y1]]); for (let y = y0 + st * 1.4; y < y1; y += st * 1.4) L.push(arcPts(x - st / 2, y, st / 2, Math.PI, TAU, .6)) } break;
  }
  return { lines: clipOpen(L, region, true), shapes: [] };
}
/* keeps the parts of closed shapes inside a region: shapes fully inside are kept as they are, the rest are clipped in one pass */
function clipShapes(shapes, region) {
  if (!region || !region.length) return [];
  const rb = bboxOf(region), out = [], edge = [];
  for (const s of shapes) {
    const b = bboxOf([s]); if (b[2] < rb[0] || b[0] > rb[2] || b[3] < rb[1] || b[1] > rb[3]) continue;
    let inside = true; for (let i = 0; i < s.length; i += Math.max(1, s.length >> 4)) if (!inPolys(s[i], region)) { inside = false; break }
    if (inside) inside = s.every(q => inPolys(q, region));
    (inside ? out : edge).push(s);
  }
  if (edge.length) for (const q of boolOp(edge, region, 'inter')) out.push(q);
  return out;
}
