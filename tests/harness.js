'use strict';
// Loads the browser scripts of SkyKerf_Studio into one Node "vm" context so that
// pure subsystems (geometry, materials, nesting, toolpaths, postprocessors,
// project migration) can be unit-tested without a browser.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const PURE = ['core.js', 'geom.js', 'materials.js', 'nest.js', 'cam.js', 'post.js'];

function load(extra = []) {
  const mem = new Map();
  const ctx = {
    console, setTimeout, clearTimeout, Math, JSON, Date, Promise,
    navigator: { language: 'ru-RU', userAgent: 'node', appName: 'Netscape' },
    localStorage: { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) },
    document: undefined,
    requestAnimationFrame: f => setTimeout(f, 0),
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  const run = file => vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  run(path.join(SRC, 'vendor', 'clipper.js'));
  for (const f of PURE.concat(extra)) run(path.join(SRC, 'js', f));
  // Values cross from the vm realm into the test realm as plain JSON data, so that
  // deepStrictEqual compares content rather than realm-specific prototypes.
  const plain = v => (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v;
  ctx.__eval = code => { const v = vm.runInContext(code, ctx); return v && typeof v.then === 'function' ? Promise.resolve(v).then(plain) : plain(v) };
  return ctx;
}
module.exports = { load };
