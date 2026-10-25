'use strict';
/* ============================================================================
   SkyKerf_Studio · parametric generators (spec 9, 11)
   Every generator returns real, manufacturable parts that go through the shared
   nesting subsystem. Parameters are stored with the product so it can be
   regenerated later ("Edit product parameters").
   Kerf is NOT applied here — it is applied once, in CAM, from the material or
   layer settings. Generators only apply the joint fit clearance.
   ============================================================================ */
const LT = () => S.machine.type === 'laser';
const CUT = 0, ENG = 1, MARK = 2;
const markLayer = () => { const i = S.layers.findIndex(l => l.type === 'mark'); return i >= 0 ? i : MARK };
const FIT_PROFILES = { loose: .15, standard: .05, tight: -.02 };
const fitName = f => ({ loose: T('свободная', 'loose'), standard: T('стандартная', 'standard'), tight: T('тугая', 'tight'), custom: T('своё значение', 'custom') })[f];
function fitValue(o) { if (o.fit === 'custom') return +o.fitC || 0; const m = matById(sheetAt(curPlate).mat); return (FIT_PROFILES[o.fit] ?? .05) + (m && m.fit ? m.fit - .05 : 0) }
const curThick = () => sheetAt(curPlate).thick;
const curReq = t => ({ thick: t, mat: sheetAt(curPlate).mat });

/* ---------- finger-joint panel (edges: 0 bottom, 1 right, 2 top, 3 left; 'A'/'B' complementary, 'F' flat) ---------- */
function fingerGaps(w, h, types, t, fw, clr) {
  const gaps = [];
  types.forEach((ty, e) => {
    if (ty === 'F') return; const L = e % 2 ? h : w; let n = Math.max(3, Math.round(L / fw)); if (n % 2 === 0) n++; const seg = L / n;
    for (let i = 0; i < n; i++) {
      const tab = ty === 'A' ? i % 2 === 0 : i % 2 === 1; if (tab) continue; const a = i * seg - (i ? clr / 2 : .01), b = (i + 1) * seg + (i < n - 1 ? clr / 2 : .01), ex = .01;
      if (e === 0) gaps.push(rectPts(a, -ex, b - a, t + ex)); else if (e === 1) gaps.push(rectPts(w - t, a, t + ex, b - a)); else if (e === 2) gaps.push(rectPts(a, h - t, b - a, t + ex)); else gaps.push(rectPts(-ex, a, t + ex, b - a))
    }
  });
  return gaps;
}
function fingerPanel(w, h, types, t, fw, clr, extraSolid) {
  let base = [rectPts(0, 0, w, h)]; if (extraSolid) base = boolOp(base, extraSolid, 'union');
  const gaps = fingerGaps(w, h, types, t, fw, clr); return gaps.length ? boolOp(base, gaps, 'diff') : base;
}
const arched = (x, y, w, h) => { const r = w / 2; return [[x, y], [x + w, y], ...arcPts(x + r, Math.max(y + r * .2, y + h - r), r, 0, Math.PI)] };
function sampleLandscape() {
  const c = document.createElement('canvas'); c.width = 480; c.height = 320; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 320); g.addColorStop(0, '#f4f6fa'); g.addColorStop(1, '#c9d2de'); x.fillStyle = g; x.fillRect(0, 0, 480, 320);
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(340, 95, 38, 0, Math.PI * 2); x.fill();
  const ridge = (base, amp, f, ph, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, 320); for (let i = 0; i <= 480; i += 4) { x.lineTo(i, base - amp * (Math.sin(i * f + ph) * .6 + Math.sin(i * f * 2.3 + ph * 1.7) * .3 + Math.sin(i * f * 5.1 + ph) * .1)) } x.lineTo(480, 320); x.fill() };
  ridge(170, 55, .012, 1.2, '#a7b2c1'); ridge(205, 45, .016, 2.6, '#7f8b9c'); ridge(240, 40, .021, .4, '#58636f'); ridge(275, 30, .03, 3.3, '#333b44');
  x.fillStyle = '#1a1f24'; x.beginPath(); for (const [tx, ty, s] of [[60, 285, 26], [90, 295, 34], [400, 290, 30], [430, 300, 22]]) { x.moveTo(tx, ty - s * 2); x.lineTo(tx + s * .55, ty); x.lineTo(tx - s * .55, ty); x.closePath() } x.fill();
  return c.toDataURL('image/png');
}
async function imgFromAsset(id) { const url = assetURL(id); if (!url) throw new Error(T('Изображение не найдено в проекте.', 'Image not found in the project.')); const im = new Image(); im.src = url; await im.decode(); return im }
const jointFields = (defFw) => [
  { k: 't', t: 'num', l: () => T('Толщина материала', 'Material thickness'), def: () => curThick(), min: .3, u: MM, step: .1, help: 'thick' },
  { k: 'fw', t: 'num', l: () => T('Ширина шипа', 'Finger width'), def: () => defFw || Math.max(6, Math.round(curThick() * 3)), min: 2, u: MM, step: .5 },
  { k: 'fit', t: 'sel', l: () => T('Посадка', 'Fit'), def: () => 'standard', opts: () => ['loose', 'standard', 'tight', 'custom'].map(f => [f, `${fitName(f)}${f !== 'custom' ? ` (${FIT_PROFILES[f] > 0 ? '+' : ''}${FIT_PROFILES[f]} ${MM()})` : ''}`]), help: 'fit' },
  { k: 'fitC', t: 'num', l: () => T('Зазор посадки', 'Fit clearance'), def: () => .05, min: -.3, max: .5, u: MM, step: .01, show: o => o.fit === 'custom' },
];

const GENS = {
  /* building: see houses.js (style × function house generator) */
  box: {
    icon: 'box', name: () => T('Коробка / органайзер', 'Box / organiser'), desc: () => T('Шипы, крышка, перегородки', 'Finger joints, lid, dividers'),
    fields: [
      { k: 'W', t: 'num', l: () => T('Ширина', 'Width'), def: () => 120, min: 10, u: MM, step: 1 }, { k: 'D', t: 'num', l: () => T('Глубина', 'Depth'), def: () => 80, min: 10, u: MM, step: 1 }, { k: 'H', t: 'num', l: () => T('Высота', 'Height'), def: () => 60, min: 10, u: MM, step: 1 },
      { k: 'dims', t: 'sel', l: () => T('Размеры', 'Dimensions'), def: () => 'outer', opts: () => [['outer', T('внешние', 'outside')], ['inner', T('внутренние', 'inside')]] },
      { k: 'top', t: 'sel', l: () => T('Крышка', 'Lid'), def: () => 'closed', opts: () => [['closed', T('закрытая на шипах', 'closed, finger-jointed')], ['lift', T('съёмная накладная', 'lift-off lid')], ['open', T('без крышки', 'open top')]] },
      { k: 'dx', t: 'num', l: () => T('Перегородок по ширине', 'Dividers across width'), def: () => 0, min: 0, max: 10, step: 1 }, { k: 'dy', t: 'num', l: () => T('Перегородок по глубине', 'Dividers across depth'), def: () => 0, min: 0, max: 10, step: 1 },
      ...jointFields(),
      { k: 'labels', t: 'chk', l: () => T('Подписать стенки', 'Label the panels'), def: () => true },
    ],
    async make(o) {
      if (!hasClip()) throw new Error(T('Нужна библиотека Clipper — она не загрузилась.', 'The Clipper library did not load.'));
      let W = o.W, D = o.D, H = o.H; const t = o.t, closed = o.top === 'closed', clr = fitValue(o); if (o.dims === 'inner') { W += 2 * t; D += 2 * t; H += (closed ? 2 : 1) * t }
      if (o.fw < t) throw new Error(T('Шип должен быть шире толщины материала.', 'Fingers must be wider than the material.'));
      const tp = closed ? 'A' : 'F', defs = [
        { n: T('Дно', 'Bottom'), w: W, h: D, ty: ['B', 'B', 'B', 'B'], o: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], nn: [0, 0, 1] },
        { n: T('Перед', 'Front'), w: W, h: H, ty: ['A', 'A', tp, 'A'], o: [0, t, 0], u: [1, 0, 0], v: [0, 0, 1], nn: [0, -1, 0] },
        { n: T('Зад', 'Back'), w: W, h: H, ty: ['A', 'A', tp, 'A'], o: [0, D, 0], u: [1, 0, 0], v: [0, 0, 1], nn: [0, -1, 0] },
        { n: T('Лево', 'Left'), w: D, h: H, ty: ['A', 'B', tp, 'B'], o: [0, 0, 0], u: [0, 1, 0], v: [0, 0, 1], nn: [1, 0, 0] },
        { n: T('Право', 'Right'), w: D, h: H, ty: ['A', 'B', tp, 'B'], o: [W - t, 0, 0], u: [0, 1, 0], v: [0, 0, 1], nn: [1, 0, 0] }];
      if (closed) defs.push({ n: T('Крышка', 'Lid'), w: W, h: D, ty: ['B', 'B', 'B', 'B'], o: [0, 0, H - t], u: [1, 0, 0], v: [0, 1, 0], nn: [0, 0, 1] });
      const parts = [], asm = [];
      for (const d of defs) {
        const paths = fingerPanel(d.w, d.h, d.ty, t, o.fw, clr), items = [{ layer: CUT, kind: 'part', paths, closed: true }];
        if (o.labels) { const sz = clamp(Math.min(d.w, d.h) / 8, 3, 8), tp2 = await textAt(d.n, 'plex', sz, d.w / 2, d.h / 2); if (tp2.length) items.push({ layer: markLayer(), kind: 'text', paths: tp2, closed: true, extra: { text: d.n, font: 'plex', size: sz, rot: 0 } }) }
        parts.push({ name: d.n, items, req: curReq(t) }); asm.push({ paths, origin: d.o, u: d.u, v: d.v, n: d.nn, t, color: hslHex(32, 40 + parts.length * 4, 58 + parts.length * 3) });
      }
      if (o.top === 'lift') {
        const lip = rectPts(t + clr, t + clr, W - 2 * t - 2 * clr, D - 2 * t - 2 * clr), cap = rectPts(0, 0, W, D);
        parts.push({ name: T('Крышка', 'Lid'), items: [{ layer: CUT, kind: 'part', paths: [cap], closed: true }], req: curReq(t) }, { name: T('Вкладыш крышки', 'Lid insert'), items: [{ layer: CUT, kind: 'part', paths: [lip], closed: true }], req: curReq(t) });
        asm.push({ paths: [cap], origin: [0, 0, H + 1], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], t, color: hslHex(28, 45, 62) }, { paths: [lip], origin: [0, 0, H - t + 1], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], t, color: hslHex(28, 35, 52) });
      }
      // egg-crate dividers
      const iw = W - 2 * t, id = D - 2 * t, ih = H - (closed ? 2 : 1) * t - .5, nx = o.dx | 0, ny = o.dy | 0, sw = t + clr;
      const xs = Array.from({ length: nx }, (_, i) => iw * (i + 1) / (nx + 1)), ys = Array.from({ length: ny }, (_, i) => id * (i + 1) / (ny + 1));
      for (let i = 0; i < nx; i++) { let p = [rectPts(0, 0, id, ih)]; if (ys.length) p = boolOp(p, ys.map(y => rectPts(y - sw / 2, ih / 2, sw, ih / 2 + 1)), 'diff'); parts.push({ name: T('Перегородка A', 'Divider A') + (i + 1), items: [{ layer: CUT, kind: 'part', paths: p, closed: true }], req: curReq(t) }); asm.push({ paths: p, origin: [t + xs[i] - t / 2, t, t], u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0], t, color: hslHex(40, 35, 70) }) }
      for (let j = 0; j < ny; j++) { let p = [rectPts(0, 0, iw, ih)]; if (xs.length) p = boolOp(p, xs.map(x => rectPts(x - sw / 2, -1, sw, ih / 2 + 1)), 'diff'); parts.push({ name: T('Перегородка B', 'Divider B') + (j + 1), items: [{ layer: CUT, kind: 'part', paths: p, closed: true }], req: curReq(t) }); asm.push({ paths: p, origin: [t, t + ys[j] + t / 2, t], u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0], t, color: hslHex(45, 35, 66) }) }
      return {
        parts, asm, steps: [T('Соберите стенки на дне шипами вниз.', 'Assemble the walls on the bottom, fingers down.')].concat(nx + ny ? [T('Сложите перегородки крест-накрест пазами навстречу и опустите в коробку.', 'Slot the dividers together (slots facing each other) and drop them in.')] : [], closed ? [T('Наденьте крышку.', 'Fit the lid.')] : []),
        info: T(`${parts.length} деталей · ${fx(W, 1)}×${fx(D, 1)}×${fx(H, 1)} мм снаружи`, `${parts.length} parts · ${fx(W, 1)}×${fx(D, 1)}×${fx(H, 1)} mm outside`),
        bom: [T(`Внутри: ${fx(iw, 1)}×${fx(id, 1)}×${fx(H - (closed ? 2 : 1) * t, 1)} мм`, `Inside: ${fx(iw, 1)}×${fx(id, 1)}×${fx(H - (closed ? 2 : 1) * t, 1)} mm`), T(`Посадка: ${fitName(o.fit)} (${clr > 0 ? '+' : ''}${fx(clr, 2)} мм). Сначала вырежьте тест посадки («Тест соединения»).`, `Fit: ${fitName(o.fit)} (${clr > 0 ? '+' : ''}${fx(clr, 2)} mm). Cut a joint fit test first (“Joint test”).`)]
      };
    }
  },
  layered: {
    icon: 'layers', name: () => T('Многослойная картина', 'Layered picture'), desc: () => T('Картинка → 1–10 слоёв по яркости', 'Picture → 1–10 depth layers'),
    fields: [
      { k: 'imgAsset', t: 'img', l: () => T('Изображение', 'Image') },
      { k: 'N', t: 'num', l: () => T('Слоёв', 'Layers'), def: () => 5, min: 1, max: 10, step: 1 },
      { k: 'W', t: 'num', l: () => T('Ширина картины', 'Picture width'), def: () => Math.min(180, Math.round(sheetAt(curPlate).w * .8)), min: 20, u: MM, step: 1 },
      { k: 'frame', t: 'num', l: () => T('Рамка', 'Frame'), def: () => 10, min: 0, u: MM, step: 1 },
      { k: 'near', t: 'sel', l: () => T('Ближе к зрителю', 'Closer to viewer'), def: () => 'dark', opts: () => [['dark', T('тёмные области', 'dark areas')], ['light', T('светлые области', 'light areas')]] },
      { k: 'dist', t: 'sel', l: () => T('Деление яркости', 'Level split'), def: () => 'hist', opts: () => [['hist', T('по гистограмме', 'by histogram')], ['equal', T('равными шагами', 'equal steps')]] },
      { k: 'smooth', t: 'num', l: () => T('Сглаживание', 'Smoothing'), def: () => 2, min: 0, max: 12, step: 1, u: () => 'px' },
      { k: 'minA', t: 'num', l: () => T('Мин. деталь', 'Min detail'), def: () => 8, min: 0, u: () => MM() + '²', step: 1, pro: true },
      { k: 'holes', t: 'chk', l: () => T('Отверстия для штифтов в углах', 'Corner alignment holes'), def: () => true },
      { k: 'hd', t: 'num', l: () => T('Диаметр отверстий', 'Hole diameter'), def: () => 3, min: 1, u: MM, step: .5, show: o => o.holes },
      { k: 'nums', t: 'chk', l: () => T('Гравировать номер слоя', 'Engrave layer numbers'), def: () => true },
    ],
    async make(o) {
      if (!o.imgAsset) o.imgAsset = addAsset(sampleLandscape());
      const img = await imgFromAsset(o.imgAsset), iw = img.naturalWidth, ih = img.naturalHeight;
      const N = clamp(o.N | 0, 1, 10), Wmm = o.W, Hmm = Wmm * ih / iw, pw = Math.round(clamp(Wmm * 4, 200, 720)), ph = Math.max(2, Math.round(pw * ih / iw)), k = Wmm / pw;
      const c = document.createElement('canvas'); c.width = pw; c.height = ph; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, pw, ph); x.drawImage(img, 0, 0, pw, ph);
      const d = x.getImageData(0, 0, pw, ph).data; let Lm = new Float32Array(pw * ph); for (let i = 0; i < Lm.length; i++)Lm[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2];
      const r = o.smooth | 0; if (r > 0) for (let pass = 0; pass < 2; pass++) {
        const tt = new Float32Array(Lm.length);
        for (let y = 0; y < ph; y++) { let s = 0, n = 0; for (let xx = -r; xx <= r; xx++) { if (xx >= 0 && xx < pw) { s += Lm[y * pw + xx]; n++ } } for (let xx = 0; xx < pw; xx++) { tt[y * pw + xx] = s / n; const a = xx - r, b = xx + r + 1; if (a >= 0) { s -= Lm[y * pw + a]; n-- } if (b < pw) { s += Lm[y * pw + b]; n++ } } }
        for (let xx = 0; xx < pw; xx++) { let s = 0, n = 0; for (let yy = -r; yy <= r; yy++) { if (yy >= 0 && yy < ph) { s += tt[yy * pw + xx]; n++ } } for (let yy = 0; yy < ph; yy++) { Lm[yy * pw + xx] = s / n; const a = yy - r, b = yy + r + 1; if (a >= 0) { s -= tt[a * pw + xx]; n-- } if (b < ph) { s += tt[b * pw + xx]; n++ } } }
      }
      let th = []; if (o.dist === 'equal') for (let q = 1; q < N; q++)th.push(255 * q / N); else { const srt = Float32Array.from(Lm).sort(); for (let q = 1; q < N; q++)th.push(srt[Math.floor(srt.length * q / N)]) }
      const fpx = o.frame / k, Dm = new Uint8Array(pw * ph);
      for (let y = 0; y < ph; y++)for (let xx = 0; xx < pw; xx++) { const i = y * pw + xx; let lv = 0; for (const tq of th) if (Lm[i] >= tq) lv++; let dd = o.near === 'dark' ? N - 1 - lv : lv; if (xx < fpx || y < fpx || xx >= pw - fpx || y >= ph - fpx) dd = N - 1; Dm[i] = dd }
      const parts = [], minPx = (o.minA || 0) / (k * k), hr = o.hd / 2, holeC = o.holes && o.frame >= o.hd + 2 ? [[o.frame / 2, o.frame / 2], [Wmm - o.frame / 2, o.frame / 2], [Wmm - o.frame / 2, Hmm - o.frame / 2], [o.frame / 2, Hmm - o.frame / 2]] : [];
      const t = curThick();
      for (let j = 0; j < N; j++) {
        const m = new Uint8Array(pw * ph); for (let i = 0; i < m.length; i++)m[i] = Dm[i] >= j ? 1 : 0;
        let loops = traceMask(m, pw, ph).map(l => rdpClosed(l, .7)).filter(l => l.length > 2 && Math.abs(area(l)) > Math.max(4, minPx));
        loops = cleanPaths(loops.map(l => l.map(([X, Y]) => [X * k, (ph - Y) * k])));
        for (const [hx, hy] of holeC) loops.push(ellipsePts(hx, hy, hr, hr, 32));
        const items = [{ layer: CUT, kind: 'part', paths: loops, closed: true }];
        if (o.nums && o.frame >= 4) { const tp = await textAt(String(j + 1), 'mono', Math.min(o.frame * .55, 5), Wmm / 2, o.frame / 2); if (tp.length) items.push({ layer: markLayer(), kind: 'text', paths: tp, closed: true, extra: { text: String(j + 1), font: 'mono', size: Math.min(o.frame * .55, 5), rot: 0 } }) }
        parts.push({ name: T(`Слой ${j + 1} из ${N}`, `Layer ${j + 1} of ${N}`), items, req: curReq(t), z: j })
      }
      return {
        parts, depth: { D: Dm, pw, ph, N }, info: T(`${N} слоёв · ${fx(Wmm, 0)}×${fx(Hmm, 0)} мм · высота стопки ${fx(N * t, 1)} мм`, `${N} layers · ${fx(Wmm, 0)}×${fx(Hmm, 0)} mm · stack height ${fx(N * t, 1)} mm`),
        steps: [T('Слой 1 — задний (сплошной), далее по номерам к зрителю.', 'Layer 1 is the solid back; stack the rest in order towards the viewer.'), holeC.length ? T(`Совместите слои штифтами ⌀${o.hd} мм × ${fx(N * t, 1)} мм (4 шт.) и склейте.`, `Align layers with ⌀${o.hd} × ${fx(N * t, 1)} mm pins (4 pcs) and glue.`) : T('Совместите слои по рамке и склейте.', 'Align layers by the frame and glue.')],
        bom: [T('Для объёма можно добавить проставки 2–3 мм между слоями.', 'For extra depth add 2–3 mm spacers between layers.')],
        asm: parts.map((p, j) => ({ paths: p.items[0].paths, origin: [0, 0, j * t], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], t, color: hslHex(30 + j * (180 / Math.max(1, N - 1)), 45, 70 - j * (35 / Math.max(1, N))) }))
      };
    },
    preview(c, W, H, res) {
      const { D, pw, ph, N } = res.depth, s = Math.min((W - 40) / pw, (H - 40) / ph), ox = (W - pw * s) / 2, oy = (H - ph * s) / 2, cc = document.createElement('canvas'); cc.width = pw; cc.height = ph; const x = cc.getContext('2d'), id = x.createImageData(pw, ph);
      for (let i = 0; i < D.length; i++) { const t = N > 1 ? D[i] / (N - 1) : 1; const [r, g, b] = hslRgb((30 + t * 180) / 360, .45, (70 - t * 35) / 100); id.data[i * 4] = r; id.data[i * 4 + 1] = g; id.data[i * 4 + 2] = b; id.data[i * 4 + 3] = 255 }
      x.putImageData(id, 0, 0); c.imageSmoothingEnabled = false; c.drawImage(cc, ox, oy, pw * s, ph * s); c.strokeStyle = css('--line-2'); c.strokeRect(ox + .5, oy + .5, pw * s, ph * s)
    }
  },
  frame: {
    icon: 'frame', name: () => T('Рамка для фото', 'Photo frame'), desc: () => T('Окно, задник, подставка', 'Window, back, stand'),
    fields: [
      { k: 'pw', t: 'num', l: () => T('Ширина фото', 'Photo width'), def: () => 100, min: 10, u: MM, step: 1 }, { k: 'ph', t: 'num', l: () => T('Высота фото', 'Photo height'), def: () => 150, min: 10, u: MM, step: 1 },
      { k: 'b', t: 'num', l: () => T('Ширина рамки', 'Border width'), def: () => 20, min: 5, u: MM, step: 1 }, { k: 'lip', t: 'num', l: () => T('Нахлёст на фото', 'Overlap on photo'), def: () => 4, min: 0, u: MM, step: .5 },
      { k: 'r', t: 'num', l: () => T('Скругление углов', 'Corner radius'), def: () => 6, min: 0, u: MM, step: 1 },
      { k: 'back', t: 'chk', l: () => T('Задник с подставкой', 'Back with a stand'), def: () => true },
      { k: 'text', t: 'area', l: () => T('Надпись на рамке', 'Text on the frame'), def: () => '' },
    ],
    async make(o) {
      const W = o.pw + 2 * (o.b - o.lip), H = o.ph + 2 * (o.b - o.lip), win = rectPts(o.b, o.b, W - 2 * o.b, H - 2 * o.b, 2), t = curThick(), parts = [];
      const front = [{ layer: CUT, kind: 'part', paths: [rectPts(0, 0, W, H, o.r), win], closed: true }];
      if (String(o.text).trim()) { const tp = await textAt(o.text, 'serif', Math.min(o.b * .5, 9), W / 2, o.b / 2); if (tp.length) front.push({ layer: ENG, kind: 'text', paths: tp, closed: true, extra: { text: o.text, font: 'serif', size: Math.min(o.b * .5, 9), rot: 0 } }) }
      parts.push({ name: T('Лицевая рамка', 'Front frame'), items: front, req: curReq(t) });
      parts.push({ name: T('Средняя рамка (карман)', 'Spacer (pocket)'), items: [{ layer: CUT, kind: 'part', paths: [rectPts(0, 0, W, H, o.r), rectPts(o.b - o.lip - .5, o.b - o.lip - .5, o.pw + 1, o.ph + 1)], closed: true }], req: curReq(t) });
      if (o.back) {
        const slot = rectPts(W / 2 - 10, H * .55, 20, t + .1);
        parts.push({ name: T('Задник', 'Back'), items: [{ layer: CUT, kind: 'part', paths: [rectPts(0, 0, W, H, o.r), slot], closed: true }], req: curReq(t) });
        const sh = H * .55, stand = [[0, 0], [30, 0], [30, 6], [10 + t, sh - 4], [10 + t, sh + 6], [10, sh + 6], [10, sh - 4], [0, 6]];
        parts.push({ name: T('Подставка', 'Stand'), items: [{ layer: CUT, kind: 'part', paths: [stand], closed: true }], req: curReq(t) });
      }
      return { parts, info: `${fx(W, 0)}×${fx(H, 0)} ${MM()}`, steps: [T('Сложите: лицевая рамка, средняя рамка (в её карман вставляется фото), задник. Склейте или стяните винтами.', 'Stack: front frame, spacer (the photo sits in its pocket), back. Glue or screw.'), o.back ? T('Вставьте подставку в паз задника.', 'Insert the stand into the slot in the back.') : null].filter(Boolean), bom: [] };
    }
  },
  puzzle: {
    icon: 'puzzle', name: () => T('Пазл', 'Jigsaw puzzle'), desc: () => T('Классические замки', 'Classic tabs'),
    fields: [{ k: 'W', t: 'num', l: () => T('Ширина', 'Width'), def: () => 200, min: 20, u: MM, step: 1 }, { k: 'H', t: 'num', l: () => T('Высота', 'Height'), def: () => 150, min: 20, u: MM, step: 1 },
    { k: 'cols', t: 'num', l: () => T('Столбцов', 'Columns'), def: () => 6, min: 2, max: 40, step: 1 }, { k: 'rows', t: 'num', l: () => T('Рядов', 'Rows'), def: () => 4, min: 2, max: 40, step: 1 },
    { k: 'tab', t: 'num', l: () => T('Размер замка', 'Tab size'), def: () => 20, min: 10, max: 30, u: () => '%', step: 1 }, { k: 'jit', t: 'num', l: () => T('Неровность', 'Jitter'), def: () => 4, min: 0, max: 13, u: () => '%', step: 1 },
    { k: 'seed', t: 'num', l: () => T('Вариант', 'Seed'), def: () => 7, min: 1, step: 1 }, { k: 'rad', t: 'num', l: () => T('Скругление углов', 'Corner radius'), def: () => 4, min: 0, u: MM, step: 1 }],
    // Edge-shape formulas ported from Draradech/jigsaw (CC0 1.0): https://github.com/Draradech/jigsaw
    async make(o) {
      const t = o.tab / 200, j = o.jit / 100; seedRnd = (o.seed | 0) * 7919 + 1; let a, b, c, d, e, flip = false;
      const uni = (lo, hi) => lo + rnd() * (hi - lo), first = () => { e = uni(-j, j); next() }, next = () => { const fo = flip; flip = rnd() > .5; a = (flip === fo ? -e : e); b = uni(-j, j); c = uni(-j, j); d = uni(-j, j); e = uni(-j, j) };
      const lines = [], xn = o.cols | 0, yn = o.rows | 0;
      for (const vertical of [false, true]) {
        const nO = vertical ? xn : yn, nI = vertical ? yn : xn;
        for (let oi = 1; oi < nO; oi++) {
          first(); const pts = [];
          for (let ii = 0; ii < nI; ii++) {
            const sl = vertical ? o.H / yn : o.W / xn, sw = vertical ? o.W / xn : o.H / yn, ol = sl * ii, ow = sw * oi, Lf = v => ol + sl * v, Wf = v => ow + sw * v * (flip ? -1 : 1), Pp = (l, w) => vertical ? [Wf(w), Lf(l)] : [Lf(l), Wf(w)];
            const cp = [Pp(0, 0), Pp(.2, a), Pp(.5 + b + d, -t + c), Pp(.5 - t + b, t + c), Pp(.5 - 2 * t + b - d, 3 * t + c), Pp(.5 + 2 * t + b - d, 3 * t + c), Pp(.5 + t + b, t + c), Pp(.5 + b + d, -t + c), Pp(.8, e), Pp(1, 0)];
            for (const sg of [cubic(cp[0], cp[1], cp[2], cp[3]), cubic(cp[3], cp[4], cp[5], cp[6]), cubic(cp[6], cp[7], cp[8], cp[9])]) for (let q = pts.length ? 1 : 0; q < sg.length; q++)pts.push(sg[q]); next()
          }
          lines.push(pts)
        }
      }
      const items = [{ layer: CUT, kind: 'part', paths: [rectPts(0, 0, o.W, o.H, o.rad)], closed: true }, ...lines.map(p => ({ layer: CUT, kind: 'part', paths: [p], closed: false }))];
      return { parts: [{ name: T('Пазл', 'Puzzle'), items }], info: T(`${xn * yn} деталей · ${o.W}×${o.H} мм`, `${xn * yn} pieces · ${o.W}×${o.H} mm`), bom: [T('Внутренние линии режутся раньше рамки — детали не сдвинутся.', 'Inner lines are cut before the frame, so pieces stay put.')] };
    }
  },
  sign: {
    icon: 'sign', name: () => T('Табличка / подставка', 'Sign / coaster'), desc: () => T('Форма, текст, отверстия', 'Shape, text, holes'),
    fields: [{ k: 'shape', t: 'sel', l: () => T('Форма', 'Shape'), def: () => 'rect', opts: () => [['rect', T('прямоугольник', 'rectangle')], ['ellipse', T('овал / круг', 'oval / circle')]] },
    { k: 'W', t: 'num', l: () => T('Ширина', 'Width'), def: () => 200, min: 10, u: MM, step: 1 }, { k: 'H', t: 'num', l: () => T('Высота', 'Height'), def: () => 80, min: 10, u: MM, step: 1 },
    { k: 'R', t: 'num', l: () => T('Скругление', 'Corner radius'), def: () => 10, min: 0, u: MM, step: 1, show: o => o.shape === 'rect' },
    { k: 'text', t: 'area', l: () => T('Текст', 'Text'), def: () => T('Мастерская', 'Workshop') },
    { k: 'font', t: 'font', l: () => T('Шрифт', 'Font'), def: () => 'unb' },
    { k: 'ts', t: 'num', l: () => T('Размер текста', 'Text size'), def: () => 22, min: 2, u: MM, step: 1 },
    { k: 'tm', t: 'sel', l: () => T('Текст', 'Text as'), def: () => 'fill', opts: () => [['fill', T('гравировка заливкой', 'filled engraving')], ['line', T('гравировка по контуру', 'outline engraving')], ['cut', T('прорезь (трафарет)', 'cut-through (stencil)')]] },
    { k: 'holes', t: 'chk', l: () => T('Отверстия для крепления', 'Mounting holes'), def: () => true }, { k: 'hd', t: 'num', l: () => T('Диаметр', 'Diameter'), def: () => 5, min: 1, u: MM, step: .5, show: o => o.holes },
    { k: 'border', t: 'chk', l: () => T('Декоративная рамка', 'Decorative border'), def: () => true }],
    async make(o) {
      const items = [], W = o.W, H = o.H;
      items.push({ layer: CUT, kind: 'part', paths: [o.shape === 'rect' ? rectPts(0, 0, W, H, o.R) : ellipsePts(W / 2, H / 2, W / 2, H / 2)], closed: true });
      if (o.border) { const ins = Math.min(6, Math.min(W, H) * .06); items.push({ layer: markLayer(), kind: 'part', paths: [o.shape === 'rect' ? rectPts(ins, ins, W - 2 * ins, H - 2 * ins, Math.max(0, o.R - ins)) : ellipsePts(W / 2, H / 2, W / 2 - ins, H / 2 - ins)], closed: true }) }
      if (o.holes) { const r = o.hd / 2, m = Math.max(r + 6, o.R * .6); const hs = o.shape === 'rect' ? [[m, H - m], [W - m, H - m]] : [[W / 2, H - r - 8]]; for (const [x, y] of hs) items.push({ layer: CUT, kind: 'part', paths: [ellipsePts(x, y, r, r)], closed: true }) }
      if (String(o.text).trim()) {
        let tp = await makeTextPaths({ text: o.text, font: o.font, size: o.ts, align: 'center' }); if (tp.length) {
          let b = bboxOf(tp), sc = Math.min(1, (W * .82) / (b[2] - b[0]), (H * .62) / (b[3] - b[1])); tp = mapPaths(tp, (x, y) => [x * sc, y * sc]); b = bboxOf(tp);
          tp = mapPaths(tp, (x, y) => [x - (b[2] - b[0]) / 2 + W / 2, y - (b[3] - b[1]) / 2 + H / 2]); items.push({ layer: o.tm === 'cut' ? CUT : o.tm === 'line' ? (S.layers.findIndex(l => l.type === 'vector') >= 0 ? S.layers.findIndex(l => l.type === 'vector') : 4) : ENG, kind: 'text', paths: tp, closed: true, extra: { text: o.text, font: o.font, size: fx(o.ts * sc, 2), rot: 0, align: 'center' } })
        }
      }
      return { parts: [{ name: T('Табличка', 'Sign'), items }], info: `${W}×${H} ${MM()}`, bom: o.tm === 'cut' ? [T('В режиме трафарета замкнутые части букв (О, А, Р) выпадут.', 'In stencil mode the islands of letters (O, A, R) will fall out.')] : [] }
    }
  },
  gear: {
    icon: 'gear', name: () => T('Шестерня', 'Gear'), desc: () => T('Эвольвентный профиль', 'Involute profile'),
    fields: [{ k: 'z', t: 'num', l: () => T('Зубьев', 'Teeth'), def: () => 24, min: 6, max: 200, step: 1 }, { k: 'm', t: 'num', l: () => T('Модуль', 'Module'), def: () => 2, min: .3, u: MM, step: .1 },
    { k: 'pa', t: 'num', l: () => T('Угол зацепления', 'Pressure angle'), def: () => 20, min: 14.5, max: 30, u: () => '°', step: .5, pro: true }, { k: 'bore', t: 'num', l: () => T('Отверстие под вал', 'Bore'), def: () => 6, min: 0, u: MM, step: .5 },
    { k: 'cnt', t: 'num', l: () => T('Количество', 'Quantity'), def: () => 1, min: 1, max: 50, step: 1 }],
    async make(o) {
      const z = o.z | 0, m = o.m, pa = o.pa * Math.PI / 180, r = m * z / 2, rb = r * Math.cos(pa), ra = r + m, rf = Math.max(r - 1.25 * m, .5), inv = a => Math.tan(a) - a, tMax = Math.sqrt(Math.max(0, (ra / rb) ** 2 - 1)), half = Math.PI / (2 * z) + inv(pa), pts = [], N = 10, pol = (rr, a) => [rr * Math.cos(a), rr * Math.sin(a)];
      for (let k = 0; k < z; k++) {
        const c = k * 2 * Math.PI / z; if (rf < rb) pts.push(pol(rf, c - half)); for (let i = 0; i <= N; i++) { const tt = tMax * i / N; pts.push(pol(rb * Math.sqrt(1 + tt * tt), c - half + (tt - Math.atan(tt)))) }
        const tipA = c - half + (tMax - Math.atan(tMax)), tipB = c + half - (tMax - Math.atan(tMax)); for (let i = 1; i < 4; i++)pts.push(pol(ra, tipA + (tipB - tipA) * i / 4));
        for (let i = N; i >= 0; i--) { const tt = tMax * i / N; pts.push(pol(rb * Math.sqrt(1 + tt * tt), c + half - (tt - Math.atan(tt)))) } if (rf < rb) pts.push(pol(rf, c + half));
        const nx = c + 2 * Math.PI / z - half; for (let i = 1; i < 4; i++)pts.push(pol(rf, c + half + (nx - c - half) * i / 4))
      }
      const paths = [pts.map(([x, y]) => [x + ra, y + ra])]; if (o.bore > 0) paths.push(ellipsePts(ra, ra, o.bore / 2, o.bore / 2));
      const parts = []; for (let i = 0; i < (o.cnt | 0); i++)parts.push({ name: T('Шестерня', 'Gear') + ` z${z}`, items: [{ layer: CUT, kind: 'part', paths: JSON.parse(JSON.stringify(paths)), closed: true }] });
      return { parts, info: T(`Делит. ⌀${fx(2 * r, 2)} · наружный ⌀${fx(2 * ra, 2)} · межосевое с такой же: ${fx(2 * r, 2)} мм`, `Pitch ⌀${fx(2 * r, 2)} · outside ⌀${fx(2 * ra, 2)} · centre distance to a twin: ${fx(2 * r, 2)} mm`), bom: [T('Межосевое расстояние пары = модуль × (z1 + z2) / 2.', 'Centre distance = module × (z1 + z2) / 2.')] };
    }
  },
  qr: {
    icon: 'qr', name: () => T('QR-код / бейдж', 'QR code / tag'), desc: () => T('Ссылка → гравировка', 'Link → engraving'),
    fields: [{ k: 'text', t: 'area', l: () => T('Текст или ссылка', 'Text or link'), def: () => 'https://example.com' }, { k: 'size', t: 'num', l: () => T('Размер кода', 'Code size'), def: () => 40, min: 10, u: MM, step: 1 },
    { k: 'ecc', t: 'sel', l: () => T('Коррекция ошибок', 'Error correction'), def: () => 'M', opts: () => [['L', 'L 7%'], ['M', 'M 15%'], ['Q', 'Q 25%'], ['H', 'H 30%']], pro: true },
    { k: 'tag', t: 'chk', l: () => T('Вырезать бейдж вокруг', 'Cut a tag around it'), def: () => true }, { k: 'hole', t: 'chk', l: () => T('Отверстие для кольца', 'Key-ring hole'), def: () => true, show: o => o.tag }],
    async make(o) {
      if (typeof qrcode === 'undefined') throw new Error(T('Библиотека QR не загрузилась.', 'The QR library did not load.'));
      const q = qrcode(0, o.ecc || 'M'); q.addData(String(o.text || ' ')); q.make(); const n = q.getModuleCount(), cell = o.size / n, rects = [];
      for (let r = 0; r < n; r++) { let c = 0; while (c < n) { while (c < n && !q.isDark(r, c)) c++; const s = c; while (c < n && q.isDark(r, c)) c++; if (c > s) rects.push(rectPts(s * cell, (n - 1 - r) * cell, (c - s) * cell, cell)) } }
      const qp = hasClip() ? unionPaths(rects) : rects, items = [{ layer: ENG, kind: 'part', paths: qp, closed: true }]; const pad = cell * 2.5;
      if (o.tag) { const hh = o.hole ? 8 : 0; items.unshift({ layer: CUT, kind: 'part', paths: [rectPts(-pad, -pad, o.size + 2 * pad, o.size + 2 * pad + hh, pad)], closed: true }); if (o.hole) items.push({ layer: CUT, kind: 'part', paths: [ellipsePts(o.size / 2, o.size + pad + hh / 2, 2.5, 2.5)], closed: true }) }
      return { parts: [{ name: 'QR', items, noMirror: true }], info: T(`${n}×${n} модулей · модуль ${fx(cell, 2)} мм`, `${n}×${n} modules · module ${fx(cell, 2)} mm`), bom: cell < .4 ? [T('Модуль меньше 0,4 мм — увеличьте размер кода.', 'Modules under 0.4 mm — make the code larger.')] : [] }
    }
  },
  hinge: {
    icon: 'hinge', name: () => T('Гибкий шарнир', 'Living hinge'), desc: () => T('Изгиб фанеры прорезями', 'Bendable plywood cuts'),
    fields: [{ k: 'W', t: 'num', l: () => T('Ширина зоны', 'Zone width'), def: () => 60, min: 5, u: MM, step: 1 }, { k: 'H', t: 'num', l: () => T('Высота зоны', 'Zone height'), def: () => 80, min: 5, u: MM, step: 1 },
    { k: 'len', t: 'num', l: () => T('Длина прорези', 'Cut length'), def: () => 18, min: 2, u: MM, step: 1 }, { k: 'gap', t: 'num', l: () => T('Перемычка', 'Bridge'), def: () => 3, min: .5, u: MM, step: .5 },
    { k: 'sp', t: 'num', l: () => T('Шаг рядов', 'Row spacing'), def: () => 1.6, min: .4, u: MM, step: .1 }, { k: 'frame', t: 'chk', l: () => T('Добавить контур панели', 'Add panel outline'), def: () => true }, { k: 'margin', t: 'num', l: () => T('Поля панели', 'Panel margin'), def: () => 15, min: 0, u: MM, step: 1, show: o => o.frame }],
    async make(o) {
      const items = [], mx = o.frame ? o.margin : 0, P2 = o.len + o.gap; let k = 0;
      for (let x = o.sp; x < o.W - o.sp / 2; x += o.sp, k++) { const off = k % 2 ? P2 / 2 : 0; for (let s = off - P2; s < o.H + P2; s += P2) { const a = clamp(Math.max(s + o.gap / 2, k % 2 ? -1e9 : o.gap / 2), 0, o.H), b = clamp(Math.min(s + o.gap / 2 + o.len, o.H - (k % 2 ? -1e9 : o.gap / 2)), 0, o.H); if (b - a > 1) items.push({ layer: CUT, kind: 'part', paths: [[[x + mx, a], [x + mx, b]]], closed: false }) } }
      if (o.frame) items.push({ layer: CUT, kind: 'part', paths: [rectPts(0, 0, o.W + 2 * mx, o.H)], closed: true });
      return { parts: [{ name: T('Шарнир', 'Hinge'), items, req: curReq(curThick()) }], info: T(`${k} рядов прорезей`, `${k} cut rows`), bom: [T('Шарнир гнётся поперёк прорезей. Тоньше шаг — мягче изгиб.', 'The hinge bends across the cuts. Smaller spacing gives a softer bend.')] }
    }
  },
  test: {
    icon: 'test', name: () => T('Тест мощности', 'Power test'), desc: () => T('Мощность × скорость или проходы', 'Power × speed or passes'), laserOnly: true,
    fields: [{ k: 'md', t: 'sel', l: () => T('Режим', 'Mode'), def: () => 'fill', opts: () => [['fill', T('заливка (гравировка)', 'fill (engrave)')], ['line', T('контур (резка)', 'outline (cut)')]] },
    { k: 'rowVar', t: 'sel', l: () => T('По рядам меняется', 'Rows vary'), def: () => 'speed', opts: () => [['speed', T('скорость', 'speed')], ['passes', T('число проходов', 'number of passes')]] },
    { k: 'p0', t: 'num', l: () => T('Мощность от', 'Power from'), def: () => 20, min: 1, max: 100, u: () => '%', step: 5 }, { k: 'p1', t: 'num', l: () => T('до', 'to'), def: () => 100, min: 1, max: 100, u: () => '%', step: 5 }, { k: 'cols', t: 'num', l: () => T('Столбцов', 'Columns'), def: () => 5, min: 2, max: 12, step: 1 },
    { k: 'v0', t: 'num', l: () => T('Скорость от', 'Speed from'), def: () => 500, min: 10, u: MMIN, step: 50, show: o => o.rowVar !== 'passes' }, { k: 'v1', t: 'num', l: () => T('до', 'to'), def: () => 3000, min: 10, u: MMIN, step: 50, show: o => o.rowVar !== 'passes' },
    { k: 'vfix', t: 'num', l: () => T('Скорость', 'Speed'), def: () => 300, min: 10, u: MMIN, step: 50, show: o => o.rowVar === 'passes' },
    { k: 'n0', t: 'num', l: () => T('Проходов от', 'Passes from'), def: () => 1, min: 1, max: 30, step: 1, show: o => o.rowVar === 'passes' }, { k: 'n1', t: 'num', l: () => T('до', 'to'), def: () => 5, min: 1, max: 30, step: 1, show: o => o.rowVar === 'passes' },
    { k: 'np', t: 'num', l: () => T('Проходов в каждой ячейке', 'Passes per cell'), def: () => 1, min: 1, max: 30, step: 1, show: o => o.rowVar !== 'passes', help: 'passes' },
    { k: 'rows', t: 'num', l: () => T('Рядов', 'Rows'), def: () => 5, min: 2, max: 12, step: 1 },
    { k: 'iv', t: 'num', l: () => T('Шаг строк заливки', 'Fill line interval'), def: () => .1, min: .02, max: 1, u: MM, step: .01, show: o => o.md === 'fill', help: 'interval' },
    { k: 'cell', t: 'num', l: () => T('Размер ячейки', 'Cell size'), def: () => 8, min: 3, u: MM, step: 1 }, { k: 'gap', t: 'num', l: () => T('Зазор', 'Gap'), def: () => 3, min: 1, u: MM, step: .5 },
    { k: 'frame', t: 'chk', l: () => T('Вырезать пластину вокруг теста', 'Cut a plate around the test'), def: () => false }],
    async make(o) {
      const items = [], C = clamp(o.cols | 0, 2, 12), R = clamp(o.rows | 0, 2, 12), st = o.cell + o.gap, lm = 16, bm = 10, byPass = o.rowVar === 'passes';
      const pw = i => Math.round(o.p0 + (o.p1 - o.p0) * i / (C - 1));
      const rowVal = j => byPass ? Math.round(o.n0 + (o.n1 - o.n0) * j / (R - 1)) : Math.round(o.v0 + (o.v1 - o.v0) * j / (R - 1));
      for (let i = 0; i < C; i++)for (let j = 0; j < R; j++) {
        const ov = byPass ? { power: pw(i), speed: o.vfix, passes: rowVal(j) } : { power: pw(i), speed: rowVal(j), passes: o.np | 0 || 1 }; if (o.md === 'fill') ov.interval = o.iv;
        items.push({ layer: o.md === 'fill' ? ENG : CUT, kind: 'part', paths: [rectPts(lm + i * st, bm + j * st, o.cell, o.cell)], closed: true, extra: { ov } });
      }
      const lab = async (t, x, y, sz = 2.6) => { const p = await textAt(t, 'mono', sz, x, y); if (p.length) items.push({ layer: markLayer(), kind: 'text', paths: p, closed: true, extra: { text: t, font: 'mono', size: sz, rot: 0, ov: { power: Math.max(10, o.p0), speed: 1500, passes: 1 } } }) };
      for (let i = 0; i < C; i++) await lab(String(pw(i)), lm + i * st + o.cell / 2, bm + R * st + 2);
      for (let j = 0; j < R; j++) await lab((byPass ? '×' : '') + rowVal(j), lm / 2, bm + j * st + o.cell / 2, 2.2);
      await lab(T('мощность, %', 'power, %'), lm + C * st / 2, bm + R * st + 7, 2.8);
      await lab(byPass ? T(`проходы · ${o.vfix} мм/мин`, `passes · ${o.vfix} mm/min`) : T('мм/мин', 'mm/min'), lm + C * st / 2, bm - 5, 2.4);
      if (o.frame) { const b = bboxOf(items.flatMap(i => i.paths)); items.push({ layer: CUT, kind: 'part', paths: [rectPts(b[0] - 3, b[1] - 3, b[2] - b[0] + 6, b[3] - b[1] + 6, 2)], closed: true }) }
      return { parts: [{ name: T('Тест мощности', 'Power test'), items, noRotate: true }], info: T(`${C * R} ячеек: столбцы — мощность, ряды — ${byPass ? 'проходы' : 'скорость'}`, `${C * R} cells: columns are power, rows are ${byPass ? 'passes' : 'speed'}`), steps: [T('После теста выберите лучшую клетку и введите её мощность, скорость и проходы в слой (CAM) или в материал.', 'After the test pick the best cell and enter its power, speed and passes in the layer (CAM) or the material.')], bom: [T('У каждой ячейки свои мощность, скорость и проходы — параметры слоя для неё не используются.', 'Each cell carries its own power, speed and passes — layer settings are ignored for it.')] };
    }
  },
  kerf: {
    icon: 'kerf', name: () => T('Тест керфа', 'Kerf test'), desc: () => T('Ширина реза для материала', 'Cut width for the material'),
    fields: [{ k: 'L', t: 'num', l: () => T('Длина полосы', 'Strip length'), def: () => 50, min: 20, u: MM, step: 1 }, { k: 'n', t: 'num', l: () => T('Частей', 'Pieces'), def: () => 10, min: 4, max: 20, step: 1 }, { k: 'h', t: 'num', l: () => T('Высота', 'Height'), def: () => 20, min: 8, u: MM, step: 1 }],
    async make(o) {
      const items = [{ layer: CUT, kind: 'part', paths: [rectPts(0, 0, o.L, o.h)], closed: true }]; for (let i = 1; i < o.n; i++)items.push({ layer: CUT, kind: 'part', paths: [[[o.L * i / o.n, 0], [o.L * i / o.n, o.h]]], closed: false });
      const tp = await textAt(`${o.L}/${o.n}`, 'mono', 2.5, o.L / 2, o.h + 3); if (tp.length) items.push({ layer: markLayer(), kind: 'text', paths: tp, closed: true, extra: { text: `${o.L}/${o.n}`, font: 'mono', size: 2.5, rot: 0 } });
      return { parts: [{ name: T('Тест керфа', 'Kerf test'), items, req: curReq(curThick()), noRotate: true }], info: T(`${o.n} полосок из ${o.L} мм`, `${o.n} strips from ${o.L} mm`), steps: [T(`Вырежьте с выключенной компенсацией реза. Сдвиньте все ${o.n} полосок вплотную, измерьте общую длину L и посчитайте керф = (${o.L} − L) / ${o.n}. Введите его в поле «Ширина реза» материала (кнопка «Материалы…»).`, `Cut with kerf compensation off. Push all ${o.n} strips together, measure the total length L and compute kerf = (${o.L} − L) / ${o.n}. Enter it in the material’s “Kerf” field (Materials… button).`)], bom: [] };
    }
  },
  joint: {
    icon: 'joint', name: () => T('Тест соединения', 'Joint fit test'), desc: () => T('Пазы с разным зазором', 'Slots with different clearance'),
    fields: [{ k: 't', t: 'num', l: () => T('Толщина материала', 'Material thickness'), def: () => curThick(), min: .3, u: MM, step: .1 }, { k: 'from', t: 'num', l: () => T('Зазор от', 'Clearance from'), def: () => -.1, min: -.5, max: .5, u: MM, step: .01 }, { k: 'to', t: 'num', l: () => T('Зазор до', 'Clearance to'), def: () => .2, min: -.5, max: .8, u: MM, step: .01 }, { k: 'n', t: 'num', l: () => T('Пазов', 'Slots'), def: () => 7, min: 3, max: 12, step: 1 }],
    async make(o) {
      const n = o.n | 0, sw = 14, gap = 8, W = n * (sw + gap) + gap, H = 34, items = [], slots = [];
      for (let i = 0; i < n; i++) { const c = o.from + (o.to - o.from) * i / (n - 1), x = gap + i * (sw + gap); slots.push(rectPts(x, H - 14, sw, o.t + c)); const tp = await textAt((c > 0 ? '+' : '') + fx(c, 2), 'mono', 2.4, x + sw / 2, H - 20); if (tp.length) items.push({ layer: markLayer(), kind: 'text', paths: tp, closed: true, extra: { text: fx(c, 2) + '', font: 'mono', size: 2.4, rot: 0 } }) }
      items.unshift({ layer: CUT, kind: 'part', paths: boolOp([rectPts(0, 0, W, H, 2)], slots, 'diff'), closed: true });
      const key = { name: T('Ключ-образец', 'Test key'), items: [{ layer: CUT, kind: 'part', paths: [rectPts(0, 0, sw - 1, 30, 1)], closed: true }], req: curReq(o.t) };
      return { parts: [{ name: T('Тест соединения', 'Joint test'), items, req: curReq(o.t), noRotate: true }, key], info: T(`${n} пазов, зазор ${fx(o.from, 2)}…${fx(o.to, 2)} мм`, `${n} slots, clearance ${fx(o.from, 2)}…${fx(o.to, 2)} mm`), steps: [T('Вставьте ключ-образец (из того же листа) в пазы и выберите лучшую посадку. Введите зазор этого паза в поле «Посадка соединений» материала (кнопка «Материалы…»).', 'Insert the test key (from the same sheet) into the slots and pick the best fit. Enter that slot’s clearance in the material’s “Joint fit clearance” field (Materials… button).')], bom: [] };
    }
  },
};

/* ---------------- generator dialog ---------------- */
let GS = null;
function openGen(kind, preset, edit) {
  const g = GENS[kind]; if (!g) return; if (g.laserOnly && !LT()) { needMachine('laser', g.name()); return } if (g.cncOnly && LT()) { needMachine('cnc', g.name()); return }
  const o = {}; for (const f of g.fields) if (f.def) o[f.k] = f.def(); if (g.presets) Object.assign(o, g.presets[(preset && preset.style) || o.style] || {}); Object.assign(o, preset || {}); if (g.migrate) g.migrate(o);
  GS = { kind, g, o, res: null, view: g.editor ? 'plan' : '2d', viewer: null, err: null, edit: edit || null };
  openModal(`${ic(g.icon, 18)} ${g.name()}${edit ? ` <span class="pill mut">${T('изменение', 'editing')}</span>` : ''}`, `<div class="ws-view" id="genView"><canvas id="genCv"></canvas><canvas id="gen3d" hidden></canvas>
   <div class="float" id="genVb"></div><div class="badge" id="genInfo">…</div></div><div class="ws-side" id="genSide"></div>`,
    `<p class="note" id="genNote"></p><button class="btn" data-act="closeModal">${T('Отмена', 'Cancel')}</button><button class="primary" data-act="genPlace">${ic('nest', 15)} ${edit ? T('Заменить и разложить…', 'Replace and nest…') : T('Добавить и разложить…', 'Add and nest…')}</button>`, 'xl');
  onModalClose = () => { if (GS && GS.viewer) GS.viewer.dispose(); GS = null };
  renderGenSide(); genRegen(); bindGen2d();
}
/* 2D preview: wheel — zoom at the cursor, drag — move, double click — fit */
function bindGen2d() {
  const c = $('#genCv'); if (!c) return; let dr = null;
  c.addEventListener('wheel', e => { if (!GS) return; e.preventDefault(); const v = GS.v2 || (GS.v2 = { k: 1, dx: 0, dy: 0 }), r = c.getBoundingClientRect(), px = e.clientX - r.left - r.width / 2, py = e.clientY - r.top - r.height / 2, k2 = clamp(v.k * Math.exp(-e.deltaY * .0015), .2, 40); v.dx = px - (px - v.dx) * k2 / v.k; v.dy = py - (py - v.dy) * k2 / v.k; v.k = k2; genDraw() }, { passive: false });
  c.addEventListener('pointerdown', e => { if (!GS) return; if (GS.g.editor && GS.view === 'plan' && GS.g.editor.down(e)) { dr = { ed: true }; c.setPointerCapture(e.pointerId); return } const v = GS.v2 || (GS.v2 = { k: 1, dx: 0, dy: 0 }); dr = { x: e.clientX, y: e.clientY, dx: v.dx, dy: v.dy, moved: 0 }; c.setPointerCapture(e.pointerId) });
  c.addEventListener('pointermove', e => { if (!GS) return; if (dr && dr.ed) { GS.g.editor.move(e); return } if (!dr) { if (GS.g.editor && GS.view === 'plan' && GS.g.editor.hover) GS.g.editor.hover(e); return } dr.moved = Math.max(dr.moved, Math.hypot(e.clientX - dr.x, e.clientY - dr.y)); GS.v2.dx = dr.dx + e.clientX - dr.x; GS.v2.dy = dr.dy + e.clientY - dr.y; genDraw() });
  c.addEventListener('pointerup', e => { if (dr && dr.ed && GS) { GS.g.editor.up(e); dr = null; return } if (dr && GS && dr.moved < 4) { GS.v2.dx = dr.dx; GS.v2.dy = dr.dy; if (GS.jmode && GS.view === '2d') mjClick(e); else if (GS.g.editor && GS.view === 'plan' && GS.g.editor.click) GS.g.editor.click(e) } dr = null });
  c.addEventListener('dblclick', () => { if (GS) { GS.v2 = { k: 1, dx: 0, dy: 0 }; genDraw() } });
}
function genField(f, o) {
  if (f.show && !f.show(o)) return ''; const cls = f.pro ? 'pro' : '', lbl = f.l();
  if (f.t === 'head') return `<h4 class="gf-head">${esc(lbl)}</h4>`;
  if (f.t === 'num') return numF(lbl, `data-gf="${f.k}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''}`, o[f.k], f.u ? f.u() : '', f.step || 1, cls, f.help);
  if (f.t === 'sel') return selF(lbl, `data-gf="${f.k}"`, f.opts(), o[f.k], cls, f.help);
  if (f.t === 'font') return `<div class="fld ${cls}"><span>${lbl}</span><button type="button" class="btn fontbtn" data-act="fontPick" data-p="gf:${f.k}"><span style="font-family:'${esc(fontFamily(o[f.k])).replace(/'/g, '')}',var(--f-ui)">${esc(fontLabel(o[f.k]))}</span>${ic('chev', 14)}</button></div>`;
  if (f.t === 'chk') return chkF(lbl, `data-gf="${f.k}"`, o[f.k], cls);
  if (f.t === 'area') return `<label class="fld ${cls}"><span>${lbl}</span><textarea class="plain" rows="2" data-gf="${f.k}">${esc(o[f.k])}</textarea></label>`;
  if (f.t === 'img') return `<div class="fld"><span>${lbl}</span><div class="row"><button class="btn" data-act="genImg">${ic('image', 15)} ${T('Выбрать файл', 'Choose file')}</button><span class="note">${o[f.k] ? T('загружено', 'loaded') : T('пример: горный пейзаж', 'sample: mountain landscape')}</span></div></div>`;
  return '';
}
function renderGenSide() {
  if (!GS) return; const { g, o } = GS, sh = sheetAt(curPlate);
  $('#genSide').innerHTML = `${typeof testTabs === 'function' ? testTabs(GS.kind) : ''}${typeof houseTabs === 'function' ? houseTabs(GS.kind) : ''}${g.sidePre ? g.sidePre(o) : ''}<div class="sec"><h3>${T('Параметры', 'Parameters')}</h3>${g.fields.map(f => genField(f, o)).join('')}</div><div class="mjwrap">${typeof mjSideHtml === 'function' ? mjSideHtml() : ''}</div><div class="sec"><h3>${T('Результат', 'Result')}</h3><div id="genRes" class="bom"></div></div>
  <div class="sec"><h3>${T('Материал', 'Material')}</h3><p class="note">${esc(matLabel(matById(sh.mat), sh.thick))} · ${T('лист', 'sheet')} ${fx(sh.w, 0)}×${fx(sh.h, 0)} ${MM()}</p></div>`;
  renderGenVb();
}
function renderGenVb() { if (!GS) return; const has3d = GS.res && GS.res.asm && typeof THREE !== 'undefined'; $('#genVb').innerHTML = `<div class="seg">${GS.g.editor ? `<button data-act="genView" data-v="plan" aria-pressed="${GS.view === 'plan'}">${T('План', 'Plan')}</button>` : ''}<button data-act="genView" data-v="2d" aria-pressed="${GS.view === '2d'}">${GS.kind === 'layered' ? T('Карта глубины', 'Depth map') : T('Детали', 'Parts')}</button>${has3d ? `<button data-act="genView" data-v="3d" aria-pressed="${GS.view === '3d'}">${T('3D-сборка', '3D assembly')}</button>` : ''}</div>${GS.view !== '3d' ? `<span class="sep"></span><button class="icon-btn" data-act="gen2z" data-v="-1" title="${T('Отдалить', 'Zoom out')}">${ic('zout')}</button><button class="icon-btn" data-act="gen2z" data-v="1" title="${T('Приблизить', 'Zoom in')}">${ic('zin')}</button><button class="icon-btn" data-act="gen2z" data-v="0" title="${T('Показать всё', 'Fit')}">${ic('fit')}</button>` : ''}` }
let genT = 0;
function genRegen() {
  clearTimeout(genT); genT = setTimeout(async () => {
    if (!GS) return; const my = GS; try { busy(T('Строю…', 'Building…')); const r = await my.g.make(my.o); if (GS !== my) return; my.raw = r; if (my.g.manualJoints && (my.o.mj || []).length) { const r2 = cloneRes(r); my.mjWarn = applyManualJoints(r2, my.o); my.res = r2 } else { my.res = r; my.mjWarn = [] } my.err = null } catch (e) { logError('gen', e); my.res = null; my.err = e.message || String(e) } finally { busy(null) }
    if (GS !== my) return; const info = $('#genInfo'); info.textContent = my.err ? '⚠ ' + my.err : my.res.info;
    $('#genRes').innerHTML = my.res ? [`<b>${T('Деталей', 'Parts')}: ${my.res.parts.length}</b>`, ...(my.res.steps || []).map((s, i) => `${i + 1}. ${esc(s)}`), ...(my.res.bom || []).map(esc), ...(my.mjWarn || []).map(w => `<span class="warnline">${esc(w)}</span>`)].map(x => `<div>${x}</div>`).join('') : '';
    if (my.g.manualJoints && $('#genSide')) { const box = $('#genSide').querySelector('.mjwrap'); if (box) box.outerHTML = `<div class="mjwrap">${mjSideHtml()}</div>` }
    $('#genNote').textContent = T('Дальше откроется раскладка: один лист, несколько листов или только текущий.', 'Nesting opens next: one sheet, several sheets or the current one.');
    renderGenVb(); genDraw()
  }, 180)
}
function genDraw() {
  if (!GS) return; const c2 = $('#genCv'), c3 = $('#gen3d'); const v3 = GS.view === '3d' && GS.res && GS.res.asm; c2.hidden = !!v3; c3.hidden = !v3; if (GS.viewer) GS.viewer.showPad(!!v3);
  if (v3) { if (!GS.viewer) GS.viewer = createViewer(c3); if (GS.viewer) { GS.viewer.setPlates(GS.res.asm); GS.viewer.show(false, true); GS.viewer.fitPlates() } return }
  const r = c2.getBoundingClientRect(), d = window.devicePixelRatio || 1; if (!r.width) return; c2.width = Math.round(r.width * d); c2.height = Math.round(r.height * d); const c = c2.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, r.width, r.height);
  const vz = GS.v2 || (GS.v2 = { k: 1, dx: 0, dy: 0 }); c.translate(r.width / 2 + vz.dx, r.height / 2 + vz.dy); c.scale(vz.k, vz.k); c.translate(-r.width / 2, -r.height / 2);
  if (GS.g.editor && GS.view === 'plan') { GS.g.editor.draw(c, r.width, r.height, vz); return }
  if (!GS.res) return; if (GS.g.preview) { GS.g.preview(c, r.width, r.height, GS.res); return }
  const parts = GS.res.parts, gap = 6, boxes = parts.map(p => bboxOf(p.items.flatMap(i => i.paths))); let tot = 0; boxes.forEach(b => tot += (b[2] - b[0] + gap) * (b[3] - b[1] + gap)); const target = Math.sqrt(tot) * 1.4;
  let x = 0, y = 0, rh = 0, pos = [], mw = 0; boxes.forEach(b => { const w = b[2] - b[0], h = b[3] - b[1]; if (x > 0 && x + w > target) { x = 0; y += rh + gap; rh = 0 } pos.push([x - b[0], y - b[1]]); x += w + gap; rh = Math.max(rh, h); mw = Math.max(mw, x) }); const th = y + rh;
  const s = Math.min((r.width - 48) / mw, (r.height - 80) / th), ox = (r.width - mw * s) / 2, oy = (r.height - th * s) / 2 + th * s;
  GS.layout = { pos, s, ox, oy, boxes };
  parts.forEach((p, i) => {
    for (const it of p.items) {
      const L = S.layers[it.layer]; c.beginPath(); for (const q of it.paths) { q.forEach((pt, k) => { const X = ox + (pt[0] + pos[i][0]) * s, Y = oy - (pt[1] + pos[i][1]) * s; k ? c.lineTo(X, Y) : c.moveTo(X, Y) }); if (it.closed) c.closePath() }
      if (it.closed && it.layer === CUT) { c.fillStyle = css('--sheet'); c.fill('evenodd') } if (it.closed && L.type === 'fill') { c.fillStyle = hexA(L.color, .35); c.fill('evenodd') } c.strokeStyle = L.color; c.lineWidth = 1.1 / vz.k; c.stroke()
    }
  });
  if (GS.g.manualJoints && typeof mjDrawOverlay === 'function') mjDrawOverlay(c, GS.layout, vz);
}
function genPlace() {
  if (!GS || !GS.res) { toast(T('Сначала исправьте параметры.', 'Fix the parameters first.')); return }
  const parts = GS.res.parts, prod = GS.edit ? GS.edit.prod : uid('prod'), params = deepCopy(GS.o), kind = GS.kind, title = GS.g.name(), old = GS.edit ? GS.edit.prod : null;
  for (const p of parts) p.group = { gen: { kind, params, prod } };
  closeModal();
  const exclude = old ? S.shapes.filter(s => s.g && S.groups[s.g] && S.groups[s.g].gen && S.groups[s.g].gen.prod === old).map(s => s.id) : [];
  placeParts(parts, {
    title, exclude, onApply: ids => {
      if (!old) return; const drop = new Set();
      S.shapes = S.shapes.filter(s => { const isOld = s.g && S.groups[s.g] && S.groups[s.g].gen && S.groups[s.g].gen.prod === old && !ids.has(s.id); if (isOld) drop.add(s.g); return !isOld });
      for (const g of drop) delete S.groups[g];
    }
  });
}
function regenGroup(g) { const gr = S.groups[g]; if (!gr || !gr.gen) return; const { kind, params, prod } = gr.gen; openGen(kind, deepCopy(params), { prod }) }
