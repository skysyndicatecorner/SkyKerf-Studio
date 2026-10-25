'use strict';
/* ============================================================================
   SkyKerf_Studio · figure library (silhouettes built from simple shapes)
   Used by "Statuettes, medals & ornaments" and "Toys". Every figure is
   returned in a 100-unit tall frame (feet at y = 0) as { cut, lines, fills }.
   ============================================================================ */
const FG = {
  rr: (x, y, w, h, r) => rectPts(x, y, w, h, Math.min(r || 0, w / 2 - .01, h / 2 - .01)),
  rot: (pts, cx, cy, a) => pts.map(([x, y]) => { const dx = x - cx, dy = y - cy; return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)] }),
  limb: (x0, y0, x1, y1, w) => { const L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0); return FG.rot(FG.rr(x0 - w / 2, y0 - w / 2, L + w, w, w / 2), x0, y0, a) },
  ell: (cx, cy, rx, ry, n) => ellipsePts(cx, cy, rx, ry, n || 40),
  tri: (a, b, c) => [a, b, c],
  U: list => union(list.filter(p => p && p.length > 2).map(p => [p])),
  mirror: (pts, cx) => pts.map(([x, y]) => [2 * cx - x, y]).reverse(),
};
const PERSONS = () => [['human', T('Человечек', 'Little person')], ['knight', T('Рыцарь', 'Knight')], ['pirate', T('Пират', 'Pirate')], ['soldier', T('Солдат (современный)', 'Soldier (modern)')], ['archer', T('Лучник', 'Archer')], ['viking', T('Викинг', 'Viking')], ['king', T('Король', 'King')], ['princess', T('Принцесса', 'Princess')], ['astronaut', T('Космонавт', 'Astronaut')], ['ninja', T('Ниндзя', 'Ninja')]];
/* a standing person, 100 units tall, centred at x = 0; pose: arms slightly out */
function personFigure(kind) {
  const P = [], L = [], F = [], add = p => P.push(p);
  const dress = kind === 'princess', hr = 9, hy = 86;
  add(FG.ell(0, hy, hr, hr * 1.05)); add(FG.rr(-3, 74, 6, 6, 1)); // head, neck
  if (dress) add([[-8, 76], [8, 76], [22, 8], [-22, 8]]); else add(FG.rr(-11, 44, 22, 32, 5)); // torso / dress
  if (!dress) { add(FG.limb(-6, 44, -8, 4, 8)); add(FG.limb(6, 44, 8, 4, 8)); add(FG.rr(-14, 0, 12, 5, 2)); add(FG.rr(2, 0, 12, 5, 2)) } else { add(FG.rr(-10, 0, 8, 9, 2)); add(FG.rr(2, 0, 8, 9, 2)) }
  const armL = [-10, 72, -22, 46], armR = [10, 72, 22, 46];
  add(FG.limb(...armL, 7)); add(FG.limb(...armR, 7)); add(FG.ell(-22, 45, 4, 4)); add(FG.ell(22, 45, 4, 4));
  // face
  L.push(FG.ell(-3.2, hy + 1.5, 1.1, 1.1, 10).concat([[-2.1, hy + 1.5]]), FG.ell(3.2, hy + 1.5, 1.1, 1.1, 10).concat([[4.3, hy + 1.5]]), arcPts(0, hy - 2, 3.5, Math.PI * 1.15, Math.PI * 1.85, .4));
  if (!dress) L.push([[-11, 47], [11, 47]]); // belt
  switch (kind) {
    case 'knight': add([[-hr - 1, hy - 2], [hr + 1, hy - 2], [hr + 1, hy + 6], [0, hy + 15], [-hr - 1, hy + 6]]); L.push([[-hr + 1, hy + 1], [hr - 1, hy + 1]], [[0, hy + 1], [0, hy - 5]]); add([[-30, 66], [-16, 66], [-16, 48], [-23, 38], [-30, 48]]); L.push([[-23, 64], [-23, 42]], [[-29, 57], [-17, 57]]); add(FG.rr(23, 40, 3, 46, 1)); add(FG.rr(18, 46, 13, 3, 1)); break;
    case 'pirate': add([[-15, hy + 6], [15, hy + 6], [9, hy + 15], [0, hy + 12], [-9, hy + 15]]); F.push(FG.ell(3.2, hy + 1.5, 2.6, 2.2)); L.push([[-hr, hy + 4], [hr, hy - 2]]); add(arcPts(30, 52, 14, Math.PI * .55, Math.PI * 1.1, .6).concat(arcPts(30, 52, 10, Math.PI * 1.1, Math.PI * .55, .6))); add(FG.rr(19, 42, 6, 6, 2)); break;
    case 'soldier': add(arcPts(0, hy + 1, hr + 2.5, 0, Math.PI, .5).concat([[-hr - 2.5, hy - 1], [hr + 2.5, hy - 1]].reverse())); add(FG.rr(-4, 40, 40, 4, 1)); add(FG.rr(20, 36, 5, 7, 1)); add(FG.rr(-8, 37, 7, 6, 1)); L.push([[-11, 60], [11, 60]], [[-6, 66], [-6, 52]], [[6, 66], [6, 52]]); break;
    case 'archer': add(arcPts(-26, 60, 26, -1.05, 1.05, .5).concat(arcPts(-26, 60, 23.5, 1.05, -1.05, .5))); L.push([[-26 + 26 * Math.cos(-1.05), 60 + 26 * Math.sin(-1.05)], [-26 + 26 * Math.cos(1.05), 60 + 26 * Math.sin(1.05)]]); add([[-hr - 1, hy + 2], [hr + 1, hy + 2], [0, hy + 16]]); add(FG.rr(8, 62, 5, 20, 1)); break;
    case 'viking': add(arcPts(0, hy + 1, hr + 2, 0, Math.PI, .5).concat([[-hr - 2, hy - 1], [hr + 2, hy - 1]].reverse())); for (const s of [-1, 1]) add([[s * (hr), hy + 4], [s * (hr + 9), hy + 14], [s * (hr + 4), hy + 3]]); add([[-6, hy - 4], [6, hy - 4], [0, hy - 14]]); add(FG.ell(-27, 56, 11, 11)); L.push(FG.ell(-27, 56, 3, 3, 12).concat([[-24, 56]])); add([[24, 74], [32, 70], [24, 62], [26, 68]]); add(FG.rr(23, 40, 3, 32, 1)); break;
    case 'king': add([[-hr, hy + 6], [hr, hy + 6], [hr + 1, hy + 15], [hr * .5, hy + 10], [0, hy + 16], [-hr * .5, hy + 10], [-hr - 1, hy + 15]]); add([[-14, 74], [14, 74], [19, 4], [-19, 4]]); add(FG.rr(24, 40, 3, 44, 1)); add(FG.ell(25.5, 86, 4, 4)); L.push([[-2, 70], [-2, 10]], [[2, 70], [2, 10]]); break;
    case 'princess': add([[-hr + 1, hy + 7], [hr - 1, hy + 7], [hr, hy + 14], [hr * .4, hy + 10], [0, hy + 15], [-hr * .4, hy + 10], [-hr, hy + 14]]); add(FG.ell(-hr - 1, hy - 4, 4, 9)); add(FG.ell(hr + 1, hy - 4, 4, 9)); L.push([[-10, 56], [10, 56]], arcPts(0, 30, 16, Math.PI * 1.15, Math.PI * 1.85, .6)); break;
    case 'astronaut': P.length = 0; add(FG.ell(0, hy, 13, 13)); add(FG.rr(-14, 40, 28, 38, 7)); add(FG.limb(-7, 42, -9, 4, 10)); add(FG.limb(7, 42, 9, 4, 10)); add(FG.limb(-12, 72, -24, 46, 9)); add(FG.limb(12, 72, 24, 46, 9)); add(FG.rr(-20, 46, 6, 26, 2)); F.push(FG.ell(0, hy + 1, 9, 7)); L.push(FG.rr(-7, 55, 14, 9, 2).concat([[-5, 55]])); break;
    case 'ninja': F.push(FG.rr(-hr, hy - 1, hr * 2, 4, 1.5)); add([[hr - 1, hy + 2], [hr + 10, hy + 6], [hr + 8, hy - 1]]); add(FG.limb(-18, 28, 20, 92, 2.6)); add(FG.ell(-17, 27, 2.6, 2.6)); break;
  }
  return { cut: FG.U(P), lines: L, fills: F };
}
const SILHOUETTES = () => [['star', T('Звезда', 'Star')], ['heart', T('Сердце', 'Heart')], ['trophy', T('Кубок', 'Trophy cup')], ['cat', T('Кошка', 'Cat')], ['owl', T('Сова', 'Owl')], ['tree', T('Ёлка', 'Fir tree')], ['angel', T('Ангел', 'Angel')], ['horse', T('Конь', 'Horse')], ['rooster', T('Петушок', 'Rooster')], ['bird', T('Птичка', 'Bird')], ['bear', T('Мишка', 'Teddy bear')], ['person', T('Человечек', 'Little person')]];
function silhouette(kind) {
  const P = [], L = [], F = [], add = p => P.push(p);
  switch (kind) {
    case 'star': { const p = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 21 : 50, a = Math.PI / 2 + Math.PI * i / 5; p.push([r * Math.cos(a), 50 + r * Math.sin(a) * .98]) } add(p); L.push(p.map(([x, y]) => [x * .78, 50 + (y - 50) * .78]).concat([[p[0][0] * .78, 50 + (p[0][1] - 50) * .78]])); break }
    case 'heart': { const h = heartPoly(3.1).map(([x, y]) => [x, y + 52]); add(h); L.push(h.map(([x, y]) => [x * .8, 52 + (y - 52) * .8]).concat([[h[0][0] * .8, 52 + (h[0][1] - 52) * .8]])); break }
    case 'trophy': { const prof = [[0, 0], [22, 0], [22, 5], [9, 9], [6, 26], [4, 34], [26, 52], [28, 92], [0, 92]]; const cup = prof.concat(FG.mirror(prof, 0).slice(1)); add(cup.map(([x, y]) => [x, y])); for (const s of [-1, 1]) add(arcPts(s * 27, 74, 11, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI / 2 : Math.PI * 1.5, .5).concat(arcPts(s * 27, 74, 6, s > 0 ? Math.PI / 2 : Math.PI * 1.5, s > 0 ? -Math.PI / 2 : Math.PI / 2, .5))); L.push([[-24, 84], [24, 84]], [[-10, 5], [10, 5]]); break }
    case 'cat': add(FG.ell(0, 28, 22, 28)); add(FG.ell(0, 66, 16, 15)); add([[-13, 71], [-4, 77], [-13, 92]]); add([[13, 71], [4, 77], [13, 92]]); // ears overlap the head: one piece add(arcPts(26, 22, 14, Math.PI, Math.PI * 1.9, .5).concat(arcPts(26, 22, 9, Math.PI * 1.9, Math.PI, .5))); L.push(FG.ell(-6, 68, 2, 3, 12).concat([[-4, 68]]), FG.ell(6, 68, 2, 3, 12).concat([[8, 68]]), [[-2, 62], [0, 60], [2, 62]], [[-16, 60], [-5, 61]], [[16, 60], [5, 61]]); break;
    case 'owl': add(FG.ell(0, 42, 28, 40)); add([[-24, 70], [-18, 92], [-8, 76]]); add([[24, 70], [18, 92], [8, 76]]); add(FG.rr(-14, 0, 10, 6, 2)); add(FG.rr(4, 0, 10, 6, 2)); L.push(FG.ell(-10, 62, 8, 8, 24).concat([[-2, 62]]), FG.ell(10, 62, 8, 8, 24).concat([[18, 62]]), [[-3, 54], [0, 49], [3, 54]]); F.push(FG.ell(-10, 62, 3, 3), FG.ell(10, 62, 3, 3)); for (let y = 16; y < 44; y += 7) for (let x = -14 + (y % 14 ? 4 : 0); x < 16; x += 8) L.push(arcPts(x, y, 3.5, Math.PI * 1.1, Math.PI * 1.9, .5)); break;
    case 'tree': add(FG.rr(-5, 0, 10, 12, 1)); for (let i = 0; i < 4; i++) { const y = 10 + i * 20, w = 44 - i * 9; add([[-w, y], [w, y], [0, y + 34 - i * 2]]) } { const p = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 3 : 7, a = Math.PI / 2 + Math.PI * i / 5; p.push([r * Math.cos(a), 95 + r * Math.sin(a)]) } add(p) } break;
    case 'angel': add([[-16, 0], [16, 0], [6, 62], [-6, 62]]); add(FG.ell(0, 70, 8, 8)); for (const s of [-1, 1]) add(FG.rot(FG.ell(s * 20, 54, 9, 22), s * 20, 54, s * -.6)); L.push(FG.ell(0, 84, 9, 2.5, 24).concat([[9, 84]])); break;
    case 'horse': { const h = horseHead(0, 0, 100, false)[0]; add(h.map(([x, y]) => [x, y])); break }
    case 'rooster': { const h = rooster(0, 0, 100)[0]; add(h); break }
    case 'bird': add(FG.ell(0, 40, 26, 18)); add(FG.ell(22, 56, 11, 11)); add([[31, 58], [42, 55], [31, 52]]); add([[-22, 44], [-44, 60], [-36, 38]]); add(FG.rr(-6, 10, 3, 14, 1)); add(FG.rr(4, 10, 3, 14, 1)); add(FG.rr(-12, 8, 26, 3, 1)); L.push(FG.ell(24, 58, 1.6, 1.6, 10).concat([[25.6, 58]]), arcPts(-2, 44, 14, Math.PI * 1.05, Math.PI * 1.7, .5)); break;
    case 'bear': add(FG.ell(0, 32, 24, 28)); add(FG.ell(0, 72, 18, 17)); add(FG.ell(-15, 86, 7, 7)); add(FG.ell(15, 86, 7, 7)); add(FG.ell(-26, 44, 8, 13)); add(FG.ell(26, 44, 8, 13)); add(FG.ell(-14, 8, 10, 9)); add(FG.ell(14, 8, 10, 9)); L.push(FG.ell(0, 66, 7, 5, 20).concat([[7, 66]]), FG.ell(-6, 76, 1.8, 1.8, 10).concat([[-4.2, 76]]), FG.ell(6, 76, 1.8, 1.8, 10).concat([[7.8, 76]]), FG.ell(0, 30, 12, 14, 24).concat([[12, 30]])); F.push(FG.ell(0, 68, 2.4, 1.8)); break;
    default: return personFigure('human');
  }
  return { cut: FG.U(P), lines: L, fills: F };
}
/* place a 100-unit figure at real height h with feet centred at (cx, y0) */
function placeFigure(fig, h, cx, y0) {
  const b = bboxOf(fig.cut), k = h / (b[3] - b[1] || 1), m = (x, y) => [cx + (x - (b[0] + b[2]) / 2) * k, y0 + (y - b[1]) * k];
  return { cut: mapPaths(fig.cut, m), lines: mapPaths(fig.lines || [], m), fills: mapPaths(fig.fills || [], m), w: (b[2] - b[0]) * k, k };
}
