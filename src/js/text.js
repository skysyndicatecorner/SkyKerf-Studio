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
let systemFonts = null; // [{family, styles:[...]}] once the user allowed access
const fontFamily = f => (BUNDLED_FONTS[f] ? BUNDLED_FONTS[f].family : f) || 'IBM Plex Sans';
const fontLabel = f => BUNDLED_FONTS[f] ? BUNDLED_FONTS[f].n : f;
function defaultWeight(f) { return BUNDLED_FONTS[f] ? BUNDLED_FONTS[f].w : 400 }
async function loadSystemFonts() {
  if (systemFonts) return systemFonts;
  if (typeof window.queryLocalFonts !== 'function') throw new Error(T('Эта версия браузера не даёт доступ к системным шрифтам. В настольной версии SkyKerf_Studio они доступны.', 'This browser does not expose system fonts. They are available in the SkyKerf_Studio desktop app.'));
  const list = await window.queryLocalFonts(), map = new Map();
  for (const f of list) { const e = map.get(f.family) || { family: f.family, styles: [] }; e.styles.push(f.style); map.set(f.family, e) }
  systemFonts = [...map.values()].sort((a, b) => a.family.localeCompare(b.family));
  return systemFonts;
}
/* A font is present if text measures differently from two fallbacks. */
const fontProbe = { c: null };
function fontAvailable(f) {
  const fam = fontFamily(f); if (BUNDLED_FAMILIES.has(fam)) return true;
  if (systemFonts) return systemFonts.some(x => x.family === fam);
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
