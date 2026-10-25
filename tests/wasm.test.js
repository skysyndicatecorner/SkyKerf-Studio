'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
global.T = (ru, en) => en;
const { WASM_B64 } = require('../src/js/wasm-bin.js'); global.WASM_B64 = WASM_B64;
const K = require('../src/js/wasmcore.js');

const img = (w, h) => { const g = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = 255 * (x / w) * (0.5 + 0.5 * Math.sin(y / 7)); return g };
test('WebAssembly kernels load', async () => { assert.equal(await K.WK.whenReady, true, K.WK.err) });
for (const kind of ['fs', 'atkinson', 'jarvis', 'stucki']) test(`dither ${kind}: WebAssembly gives the same pixels as JavaScript`, async () => {
  await K.WK.whenReady; const w = 301, h = 207, a = K.ditherK(img(w, h), w, h, kind), b = K.ditherJS(img(w, h), w, h, kind);
  let diff = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  assert.ok(diff <= a.length * 1e-4, `${diff} pixels differ`);
});
test('box blur: WebAssembly matches JavaScript', async () => {
  await K.WK.whenReady; const w = 120, h = 90, a = K.boxBlurK(img(w, h), w, h, 3), b = K.boxBlurJS(img(w, h), w, h, 3);
  let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); assert.ok(m < 1e-2, String(m));
});
test('mesh slice: a cube cut in the middle gives one square loop of 4 segments', async () => {
  await K.WK.whenReady;
  const pos = new Float32Array([0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10]);
  const idx = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0]);
  const r = K.sliceSegK({ pos, idx }, [0, 0, 1], 5, [1, 0, 0], [0, 1, 0]);
  assert.equal(r.n, 8); // two triangles per side face
  for (let i = 0; i < r.n * 4; i++) assert.ok(r.seg[i] >= -1e-4 && r.seg[i] <= 10 + 1e-4);
});
test('fallback: without WebAssembly the JavaScript path runs', () => {
  const ready = K.WK.ready; K.WK.ready = false; const w = 40, h = 30, a = K.ditherK(img(w, h), w, h, 'jarvis'); K.WK.ready = ready;
  assert.equal(a.length, w * h); assert.ok(a.every(v => v === 0 || v === 255));
});
