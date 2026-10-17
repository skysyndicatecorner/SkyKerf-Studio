'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./harness');

test('every built-in material profile is marked unverified', () => {
  const G = load(); assert.equal(G.__eval(`BUILTIN_MATS.every(m => m.status === 'unverified')`), true);
});
test('auto layer takes values from the sheet material and reports the source', () => {
  const G = load(); G.__eval('S = blankState()');
  const r = G.__eval(`(() => { const L = S.layers[0]; L.auto = true; const a = resolveLaser(L, S.sheets[0]); L.auto = false; L.laser.power = 42; const m = resolveLaser(L, S.sheets[0]); return { a: [a.src, a.power, a.unverified], m: [m.src, m.power] } })()`);
  assert.deepEqual(r.a, ['material', 100, true]); assert.deepEqual(r.m, ['manual', 42]);
});
test('no silent substitution: unsupported operation is reported', () => {
  const G = load(); G.__eval(`S = blankState(); S.sheets[0].mat = 'anod-al'`);
  const r = G.__eval(`(() => { const L = S.layers[0]; L.auto = true; L.type = 'cut'; const x = resolveLaser(L, S.sheets[0]); return { unsupported: !!x.unsupported, warn: x.warn.length } })()`);
  assert.deepEqual(r, { unsupported: true, warn: 1 });
});
test('per-machine values override the generic profile', () => {
  const G = load(); G.__eval(`S = blankState(); userMats.push(Object.assign(deepCopy(matById('plywood-3')), { builtin: false, status: 'user', byMachine: { diode10: { cut: { power: 77, speed: 222, passes: 3 }, kerf: .11 } } }))`);
  const r = G.__eval(`(() => { const L = S.layers[0]; L.auto = true; const x = resolveLaser(L, S.sheets[0]); return [x.power, x.speed, x.passes, x.kerf] })()`);
  assert.deepEqual(r, [77, 222, 3, .11]);
});
test('importing a library never marks untested profiles verified and drops laser data for hazardous materials', () => {
  const G = load();
  const lib = JSON.stringify({ format: 'skykerf-materials', v: 1, materials: [{ id: 'x1', name: { ru: 'ПВХ', en: 'PVC' }, laser: { cut: { power: 10, speed: 10 } }, status: 'verified' }, { id: 'x2', name: { ru: 'Бук', en: 'Beech' }, status: 'verified', test: { machine: 'M', date: '2026-10-01', note: 'ok' }, laser: { cut: { power: 90, speed: 200 } } }] });
  const n = G.__eval(`importMaterials(${JSON.stringify(lib)})`);
  assert.equal(n, 2);
  assert.deepEqual(G.__eval(`[matById('x1').status, !!matById('x1').laser, matById('x2').status]`), ['unverified', false, 'verified']);
});
