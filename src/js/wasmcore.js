'use strict';
/* ============================================================================
   SkyKerf_Studio · fast kernels (Rust → WebAssembly) with JavaScript twins
   The module (wasm/src/lib.rs, embedded in wasm-bin.js) is compiled once at
   start-up. Until it is ready, or where WebAssembly is unavailable, every call
   runs the equivalent JavaScript, so results never depend on it — only speed.
   ============================================================================ */
const WK = { ready: false, ex: null, err: null, used: 0, fallback: 0 };
WK.whenReady = (async () => {
  try {
    if (typeof WebAssembly === 'undefined' || typeof WASM_B64 === 'undefined') throw new Error('WebAssembly unavailable');
    if (typeof localStorage !== 'undefined') { try { if (localStorage.getItem('skykerf.noWasm') === '1') throw new Error('disabled in settings') } catch (e) { if (/disabled/.test(e.message)) throw e } }
    const bin = Uint8Array.from(atob(WASM_B64), c => c.charCodeAt(0));
    const { instance } = await WebAssembly.instantiate(bin, {});
    if (instance.exports.version() !== 4) throw new Error('kernel version mismatch');
    WK.ex = instance.exports; WK.ready = true;
  } catch (e) { WK.err = e.message || String(e) }
  return WK.ready;
})();
/* reserve `bytes` of linear memory after the module's own data; returns the base pointer (16-aligned) */
function wkArena(bytes, keepMesh) {
  if (!keepMesh) WK.meshIn = null;
  const ex = WK.ex, base = (ex.heap_base() + 15) & ~15, need = base + bytes, have = ex.memory.buffer.byteLength;
  if (need > have) ex.memory.grow(Math.ceil((need - have) / 65536));
  return base;
}
const DITHER_KIND = { fs: 0, atkinson: 1, jarvis: 2, stucki: 3 };
const DITHER_K = { fs: [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1], 16], atkinson: [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1], 8], jarvis: [[1, 0, 7], [2, 0, 5], [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3], [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1], 48], stucki: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2], [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1], 42] };
/* error diffusion of a darkness map g (Float32Array, modified) into 0/255 */
function ditherJS(g, w, h, kind) {
  const K = DITHER_K[kind] || DITHER_K.fs, div = K[K.length - 1], ks = K.slice(0, -1), out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, v = g[i], nv = v > 127 ? 255 : 0, e = (v - nv) / div; out[i] = nv; for (const [dx, dy, wt] of ks) { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < w && yy < h) g[yy * w + xx] += e * wt } }
  return out;
}
function ditherK(g, w, h, kind) {
  if (!WK.ready || !(kind in DITHER_KIND)) { WK.fallback++; return ditherJS(g instanceof Float32Array ? g : Float32Array.from(g), w, h, kind) }
  const n = w * h, base = wkArena(n * 5), mem = WK.ex.memory.buffer;
  new Float32Array(mem, base, n).set(g);
  WK.ex.dither(base, base + n * 4, w, h, DITHER_KIND[kind]); WK.used++;
  return new Uint8ClampedArray(WK.ex.memory.buffer, base + n * 4, n).slice();
}
/* box blur of radius r applied twice; returns a new Float32Array */
function boxBlurJS(L, w, h, r) {
  let a = Float32Array.from(L); const b = new Float32Array(L.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) { let s = 0, n = 0; for (let xx = -r; xx <= r; xx++) if (xx >= 0 && xx < w) { s += a[y * w + xx]; n++ } for (let xx = 0; xx < w; xx++) { b[y * w + xx] = s / n; const p = xx - r, q = xx + r + 1; if (p >= 0) { s -= a[y * w + p]; n-- } if (q < w) { s += a[y * w + q]; n++ } } }
    for (let xx = 0; xx < w; xx++) { let s = 0, n = 0; for (let yy = -r; yy <= r; yy++) if (yy >= 0 && yy < h) { s += b[yy * w + xx]; n++ } for (let yy = 0; yy < h; yy++) { a[yy * w + xx] = s / n; const p = yy - r, q = yy + r + 1; if (p >= 0) { s -= b[p * w + xx]; n-- } if (q < h) { s += b[q * w + xx]; n++ } } }
  }
  return a;
}
function boxBlurK(L, w, h, r) {
  if (!WK.ready || r <= 0) { if (r > 0) WK.fallback++; return r > 0 ? boxBlurJS(L, w, h, r) : Float32Array.from(L) }
  const n = w * h, base = wkArena(n * 8); new Float32Array(WK.ex.memory.buffer, base, n).set(L);
  WK.ex.box_blur(base, base + n * 4, w, h, r); WK.used++;
  return new Float32Array(WK.ex.memory.buffer, base, n).slice();
}
/* plane ∩ mesh → segments {seg: [u0,v0,u1,v1]*, key: [a0,b0,a1,b1]*, n} or null (then the caller uses its JS path) */
function sliceSegK(mesh, n, d, u, v) {
  if (!WK.ready) { WK.fallback++; return null }
  const P = mesh.pos, I = mesh.idx, nv = P.length / 3, ni = I.length;
  let cap = Math.max(1024, (ni / 3) >> 3);
  for (let attempt = 0; attempt < 2; attempt++) {
    const off = { pos: 0, idx: nv * 12, sd: nv * 12 + ni * 4 }; off.out = off.sd + nv * 4; off.key = off.out + cap * 16;
    const base = wkArena(off.key + cap * 16, true), mem = WK.ex.memory.buffer;
    if (WK.meshIn !== mesh || WK.meshCap !== cap) { new Float32Array(mem, base + off.pos, nv * 3).set(P); new Uint32Array(mem, base + off.idx, ni).set(I); WK.meshIn = mesh; WK.meshCap = cap } // the mesh stays in memory between slices
    const r = WK.ex.slice_mesh(base + off.pos, nv, base + off.idx, ni, base + off.sd, n[0], n[1], n[2], d, u[0], u[1], u[2], v[0], v[1], v[2], base + off.out, base + off.key, cap);
    if (r >= 0) { WK.used++; const m2 = WK.ex.memory.buffer; return { seg: new Float32Array(m2, base + off.out, r * 4).slice(), key: new Uint32Array(m2, base + off.key, r * 4).slice(), n: r } }
    cap = -r + 16;
  }
  return null;
}
function wasmStatus() { return WK.ready ? T('ускорение WebAssembly включено', 'WebAssembly acceleration on') : WK.err ? T('WebAssembly недоступен: ', 'WebAssembly unavailable: ') + WK.err : T('WebAssembly загружается…', 'WebAssembly loading…') }
if (typeof module !== 'undefined' && module.exports) module.exports = { WK, ditherK, ditherJS, boxBlurK, boxBlurJS, sliceSegK };
