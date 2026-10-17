'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { load } = require('./harness');
const FIX = path.join(__dirname, 'fixtures');

for (const f of ['kerf-studio-v1.kerf', 'kerf-studio-v2.kerf']) {
  test(`opens ${f} and converts it to format 3`, () => {
    const G = load(); const text = fs.readFileSync(path.join(FIX, f), 'utf8'), src = JSON.parse(text);
    const r = G.__eval(`(() => { const r = parseProject(${JSON.stringify(text)}); S = r.state; return { v: S.v, from: r.migratedFrom, shapes: S.shapes.length, sheets: S.sheets.length, layers: S.layers.length, types: S.layers.map(l => l.type), auto: S.layers.filter(l => S.shapes.some(s => s.layer === l.id)).some(l => l.auto), app: S.app } })()`);
    assert.equal(r.v, 3); assert.equal(r.from, src.v); assert.equal(r.shapes, src.shapes.length);
    assert.equal(r.layers, 11); assert.ok(r.types.every(Boolean)); assert.equal(r.auto, false, 'migrated layers keep their exact values');
    assert.equal(r.app, 'SkyKerf_Studio');
    if (src.plates) assert.equal(r.sheets, src.plates);
    // the migrated project still produces valid G-code
    const g = G.__eval(`(() => { GC.clear(); const b = buildForPlate(0, { stamp: false }); return b.report.errors.length })()`);
    assert.equal(g, 0);
  });
}
test('v2 images move into project assets', () => {
  const G = load(); const text = fs.readFileSync(path.join(FIX, 'kerf-studio-v2.kerf'), 'utf8');
  const r = G.__eval(`(() => { const S2 = parseProject(${JSON.stringify(text)}).state; const im = S2.shapes.find(s => s.kind === 'image'); return { asset: im && im.img.asset, has: !!(im && S2.assets[im.img.asset]), src: im && im.img.src } })()`);
  assert.ok(r.asset); assert.equal(r.has, true); assert.equal(r.src, undefined);
});
test('damaged, foreign and newer files give clear errors', () => {
  const G = load();
  const msg = code => G.__eval(`(() => { try { parseProject(${JSON.stringify(code)}); return 'ok' } catch (e) { return (e instanceof ProjectError) + ':' + e.message } })()`);
  assert.match(msg('{oops'), /^true:/); assert.match(msg('{"a":1}'), /^true:/); assert.match(msg(JSON.stringify({ v: 99, shapes: [] })), /^true:.*(99)/);
});
test('partial / hand-edited project is normalized instead of crashing', () => {
  const G = load();
  const r = G.__eval(`(() => { const S2 = parseProject(JSON.stringify({ v: 3, shapes: [{ id: 5, layer: 99, kind: 'rect', paths: [[[0,0],[1,0],[1,1]]], closed: true }, { bad: true }] })).state; return { n: S2.shapes.length, layer: S2.shapes[0].layer, nextId: S2.nextId, sheets: S2.sheets.length } })()`);
  assert.deepEqual(r, { n: 1, layer: 10, nextId: 6, sheets: 1 });
});
test('legacy settings (Kerf Studio) are copied to the new keys and never deleted', () => {
  const mem = new Map([['kerf.lang', 'en'], ['kerf.mode', 'simple']]);
  const G = load(); // fresh context, then simulate legacy storage
  G.localStorage.getItem = k => mem.has(k) ? mem.get(k) : null; G.localStorage.setItem = (k, v) => mem.set(k, String(v));
  const moved = G.__eval('store.migrateLegacy()');
  assert.equal(moved, 2); assert.equal(mem.get('skykerf.lang'), 'en'); assert.equal(mem.get('kerf.lang'), 'en');
  assert.equal(G.__eval('store.migrateLegacy()'), 0, 'second run copies nothing');
});
test('undo history keeps readable labels and a 100-step limit', () => {
  const G = load(); G.__eval('S = blankState(); for (let i = 0; i < 130; i++) pushUndo("Шаг " + i)');
  assert.equal(G.__eval('undoS.length'), 100); assert.equal(G.__eval('undoLabel()'), 'Шаг 129');
  G.__eval('pushUndo("Сдвиг", "nudge"); pushUndo("Сдвиг", "nudge")'); assert.equal(G.__eval('undoS.length'), 100);
});
