'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./harness');
const G = load(); G.__eval('S = blankState()');
const run = code => G.__eval(`(async () => { ${code} })()`);
const parts = `const parts = []; for (let i = 0; i < 24; i++) parts.push({ name: 'p' + i, items: [{ paths: [rectPts(0, 0, 60, 40)], closed: true }] });
  parts.push({ name: 'huge', items: [{ paths: [rectPts(0, 0, 900, 40)], closed: true }] });
  const sheets = [newSheet({ w: 300, h: 200, x: 10, y: 10, margin: 3 })];`;
const overlap = `const ov = (a, b) => a[0] < b[2] - 1e-6 && a[2] > b[0] + 1e-6 && a[1] < b[3] - 1e-6 && a[3] > b[1] + 1e-6;
  const boxOf = (p, pl) => bboxOf(mapPaths(rotPaths(pl.mirror ? mirrorPaths(p.items[0].paths, 0) : p.items[0].paths, pl.ang), (x, y) => [x + pl.tx, y + pl.ty]));`;

test('one sheet: never creates sheets, reports what did not fit', async () => {
  const r = await run(`${parts} const r = await nestCompute(parts, { mode: 'one', target: 0, sheets, spacing: 3 }); return { created: r.created, sheets: r.sheets.length, un: r.unplaced.map(u => [parts[u.i].name, u.reason]), placed: r.place.filter(Boolean).length }`);
  assert.equal(r.created, 0); assert.equal(r.sheets, 1);
  assert.ok(r.placed >= 15 && r.placed < 24, 'placed ' + r.placed);
  assert.deepEqual(r.un.find(u => u[0] === 'huge'), ['huge', 'too-big']);
  assert.ok(r.un.filter(u => u[0] !== 'huge').every(u => u[1] === 'no-space'));
});
test('several sheets: adds sheets, places everything that can fit', async () => {
  const r = await run(`${parts} const r = await nestCompute(parts, { mode: 'multi', target: 0, sheets, spacing: 3 }); return { created: r.created, un: r.unplaced.map(u => parts[u.i].name) }`);
  assert.ok(r.created >= 1); assert.deepEqual(r.un, ['huge']);
});
test('current sheet only: no new sheets, other sheets untouched', async () => {
  const r = await run(`${parts} sheets.push(newSheet({ w: 300, h: 200 })); const r = await nestCompute(parts, { mode: 'current', target: 1, sheets, spacing: 3 }); return { created: r.created, plates: [...new Set(r.place.filter(Boolean).map(p => p.plate))] }`);
  assert.equal(r.created, 0); assert.deepEqual(r.plates, [1]);
});
test('parts stay inside the sheet margins, avoid no-go zones, obstacles and each other', async () => {
  const r = await run(`${parts} ${overlap}
    sheets[0].zones = [{ x: 10, y: 10, w: 120, h: 80 }];
    const obstacles = { 0: [{ paths: [rectPts(200, 120, 60, 60)], closed: true }] };
    const r = await nestCompute(parts.slice(0, 10), { mode: 'one', target: 0, sheets, spacing: 2, obstacles, rot: 90 });
    const sh = sheets[0], z = [sh.zones[0].x, sh.zones[0].y, sh.zones[0].x + sh.zones[0].w, sh.zones[0].y + sh.zones[0].h], ob = [200, 120, 260, 180], bad = [], boxes = [];
    r.place.forEach((pl, i) => { if (!pl) return; const b = boxOf(parts[i], pl); boxes.push(b);
      if (b[0] < sh.x + sh.margin - .01 || b[1] < sh.y + sh.margin - .01 || b[2] > sh.x + sh.w - sh.margin + .01 || b[3] > sh.y + sh.h - sh.margin + .01) bad.push('margin ' + i);
      if (ov(b, z)) bad.push('zone ' + i); if (ov(b, ob)) bad.push('obstacle ' + i) });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (ov(boxes[i], boxes[j])) bad.push('overlap ' + i + '/' + j);
    return { bad, placed: boxes.length }`);
  assert.deepEqual(r.bad, []); assert.ok(r.placed >= 3, 'placed ' + r.placed);
});
test('material/thickness: incompatible sheets are not used; multi creates a matching sheet', async () => {
  const r = await run(`const parts = [{ name: 'thick', req: { thick: 6 }, items: [{ paths: [rectPts(0, 0, 50, 50)], closed: true }] }];
    const sheets = [newSheet({ w: 300, h: 200, thick: 3 })];
    const a = await nestCompute(parts, { mode: 'one', target: 0, sheets }); const b = await nestCompute(parts, { mode: 'multi', target: 0, sheets });
    return { one: a.unplaced.map(u => u.reason), multiThick: b.sheets[b.place[0].plate].thick, changed: b.matChanged }`);
  assert.deepEqual(r.one, ['material']); assert.equal(r.multiThick, 6); assert.equal(r.changed, true);
});
test('deterministic: same input → same layout', async () => {
  const r = await run(`${parts} const a = await nestCompute(parts, { mode: 'multi', sheets, rot: 90 }), b = await nestCompute(parts, { mode: 'multi', sheets, rot: 90 }); return JSON.stringify(a.place) === JSON.stringify(b.place)`);
  assert.equal(r, true);
});
test('part-in-part: a small part goes into the hole of a frame', async () => {
  const r = await run(`const frame = { name: 'frame', items: [{ paths: [rectPts(0, 0, 100, 100), rectPts(10, 10, 80, 80).reverse()], closed: true }] }, small = { name: 'small', items: [{ paths: [rectPts(0, 0, 50, 50)], closed: true }] };
    const sheets = [newSheet({ w: 110, h: 110, x: 0, y: 0, margin: 2 })];
    const r = await nestCompute([frame, small], { mode: 'one', sheets, spacing: 2, rot: 0 }); return r.unplaced.length`);
  assert.equal(r, 0);
});
