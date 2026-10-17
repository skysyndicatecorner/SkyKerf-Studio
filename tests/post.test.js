'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./harness');

function project(G, machineId) {
  G.__eval(`S = blankState(MACHINES.find(m => m.id === '${machineId}'));
    { const sh = S.sheets[0], X = sh.x + 10, Y = sh.y + 10;
      addShape(S, 0, 'rect', [rectPts(X, Y, 80, 50, 4)], true);
      addShape(S, 0, 'ellipse', [ellipsePts(X + 20, Y + 25, 6, 6)], true);
      addShape(S, 1, 'rect', [rectPts(X + 100, Y, 40, 30)], true);
      addShape(S, 2, 'line', [[[X, Y + 70], [X + 60, Y + 70]]], false); }
    GC.clear();`);
}
for (const [mid, posts] of [['diode10', ['grbl_laser', 'generic_laser']], ['cnc3018', ['grbl_cnc', 'generic_cnc']]]) {
  for (const pid of posts) {
    test(`${mid} → ${pid}: G-code passes its own validation`, () => {
      const G = load(); project(G, mid);
      const r = G.__eval(`(() => { const r = buildForPlate(0, { post: postById('${pid}'), stamp: false }); return { errors: r.report.errors, lines: r.report.lines, text: r.text } })()`);
      assert.deepEqual(r.errors, [], JSON.stringify(r.errors));
      assert.ok(r.lines > 20);
      assert.match(r.text, /G21/); assert.match(r.text, /G90/);
      assert.match(r.text.trim().split('\n').slice(-3).join('\n'), /M2|M30/);
    });
  }
}
test('repeated export is byte-identical without a timestamp', () => {
  const G = load(); project(G, 'diode10');
  const a = G.__eval(`buildForPlate(0, { stamp: false }).text`); G.__eval('GC.clear()');
  const b = G.__eval(`buildForPlate(0, { stamp: false }).text`);
  assert.equal(a, b);
});
test('inch export converts coordinates and validates', () => {
  const G = load(); project(G, 'cnc3018');
  const r = G.__eval(`(() => { const r = buildForPlate(0, { units: 'inch', stamp: false }); return { errors: r.report.errors, text: r.text } })()`);
  assert.deepEqual(r.errors, []); assert.match(r.text, /G20/);
  const xs = [...r.text.matchAll(/X(-?\d+\.?\d*)/g)].map(m => +m[1]); assert.ok(Math.max(...xs) < 12, 'inches expected');
});
test('ASCII export transliterates comments', () => {
  const G = load(); project(G, 'diode10');
  const t = G.__eval(`toAscii(buildForPlate(0, { stamp: false }).text)`);
  assert.ok(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(t));
});
test('validator catches unsafe code', () => {
  const G = load(); G.__eval(`S = blankState(MACHINES[0])`);
  const bad = 'G21\nG90\nM3 S500\nG0 X10 Y10\nG1 X900 Y10 F1000\nG1 X10 S5000\n';
  const r = G.__eval(`validateGcode(${JSON.stringify(bad)}, postById('grbl_laser'), S.machine, {})`);
  const all = r.errors.concat(r.warns).map(e => e.msg).join(' | ');
  assert.ok(r.errors.length >= 2, all);
});
test('preview shows the same number of cutting contours as the plan', () => {
  const G = load(['imports.js'].filter(() => false)); project(G, 'diode10');
  const r = G.__eval(`(() => {
    const b = buildForPlate(0, { stamp: false }); loadGcode(b.text, null);
    const planned = b.job.ops.filter(o => o.type === 'cut').reduce((n, o) => { let k = 0, prev = 0; for (const m of o.moves) { if (m.g === 1 && prev === 0) k++; prev = m.g } return n + k }, 0);
    let seen = 0, prevC = false; const cutCol = b.job.ops.find(o => o.type === 'cut').color;
    for (const mv of P.moves) { const c = mv.c && mv.col === cutCol; if (c && !prevC) seen++; prevC = c }
    return { planned, seen } })()`);
  assert.ok(r.planned > 0); assert.equal(r.seen, r.planned);
});
test('custom postprocessor templates only accept whitelisted placeholders', () => {
  const G = load();
  const out = G.__eval(`fillTpl('; {sheet} {evil}', { sheet: 'S1', evil: 'M3 S1000' })`);
  assert.equal(out, '; S1 {evil}', 'unknown placeholders are left as text, never filled');
});
