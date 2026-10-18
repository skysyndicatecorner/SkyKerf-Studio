'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./harness');

const G0 = () => { const G = load(['decor.js', 'gen.js', 'houses.js']); G.__eval('S = blankState()'); return G };
const base = `(g => { const o = {}; for (const f of g.fields) if (f.def) o[f.k] = f.def(); return o })`;

test('every house style builds with every use, without broken coordinates', async () => {
  const G = G0();
  const r = await G.__eval(`(async () => { const g = GENS.building, out = []; for (const st of Object.keys(H_PRESETS)) for (const fn of Object.keys(FN_PRESETS)) {
    const o = Object.assign(${base}(g), H_PRESETS[st], FN_PRESETS[fn], { style: st, fn }); const res = await g.make(o);
    const bad = res.parts.some(p => !p.items[0].paths.length || p.items.some(it => it.paths.some(q => q.some(v => !isFinite(v[0]) || !isFinite(v[1])))));
    const badAsm = res.asm.some(a => [a.origin, a.u, a.v, a.n].some(v => !v || v.some(x => !isFinite(x))));
    out.push([st, fn, res.parts.length, bad, badAsm]) } return out })()`);
  assert.equal(r.length, 14 * 8);
  for (const [st, fn, n, bad, badAsm] of r) { assert.ok(n >= 5, `${st}/${fn}: ${n} parts`); assert.equal(bad, false, `${st}/${fn}`); assert.equal(badAsm, false, `${st}/${fn} assembly`) }
});
test('two uses combine: tea house + organizer gets a lid, dividers and the tea-bag opening', async () => {
  const G = G0();
  const names = await G.__eval(`(async () => { const g = GENS.building, o = Object.assign(${base}(g), H_PRESETS.japanese, { style: 'japanese', fn: 'tea', fn2: 'organizer', div: 2 }); return (await g.make(o)).parts.map(p => p.name) })()`);
  assert.ok(names.filter(n => /Перегородка|Divider/.test(n)).length === 2);
  assert.ok(names.some(n => /потолок|ceiling/.test(n)) && names.some(n => /фиксатор|locating/.test(n)));
});
test('piggy bank has a coin slot and a removable bottom plug', async () => {
  const G = G0();
  const r = await G.__eval(`(async () => { const g = GENS.building, o = Object.assign(${base}(g), H_PRESETS.cottage, { style: 'cottage', fn: 'piggy' }); const res = await g.make(o); return { names: res.parts.map(p => p.name), roofHoles: res.parts.filter(p => /Скат|slope/i.test(p.name)).map(p => p.items[0].paths.length) } })()`);
  assert.ok(r.names.some(n => /пробка|plug/.test(n)));
  assert.ok(r.roofHoles.some(n => n >= 2), 'one roof slope carries the coin slot');
});
test('projects from 0.3 keep opening: old tea / fortress styles are mapped', () => {
  const G = G0();
  assert.deepEqual(G.__eval(`(() => { const a = { style: 'tea' }, b = { style: 'fortress' }; GENS.building.migrate(a); GENS.building.migrate(b); return [a.style, a.fn, b.style] })()`), ['japanese', 'tea', 'castle']);
});
test('decor helpers: every outline is closed and non-empty, borders follow the loop', () => {
  const G = G0();
  const r = G.__eval(`(() => { const bad = []; for (const [k] of OUTLINES()) { const o = outline(k, 0, 0, 80, 50, 6); if (!o.length || o.some(p => p.length < 3) || areaOf(o) < 100) bad.push(k) }
    const loop = rectPts(0, 0, 100, 60), n = BORDERS().filter(([k]) => k !== 'none').map(([k]) => { const d = borderDeco(k, loop, 6); return d.lines.length + d.shapes.length }); return { bad, minItems: Math.min(...n) } })()`);
  assert.deepEqual(r.bad, []); assert.ok(r.minItems > 0);
});
