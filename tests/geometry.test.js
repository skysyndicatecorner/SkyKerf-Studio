'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./harness');
const G = load();
const near = (a, b, tol = 0.02) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);

test('offset grows and shrinks a square', () => {
  const out = G.__eval('bboxOf(offsetPaths([rectPts(0,0,10,10)], 1, "miter"))');
  [-1, -1, 11, 11].forEach((v, i) => near(out[i], v));
  const inn = G.__eval('bboxOf(offsetPaths([rectPts(0,0,10,10)], -2, "miter"))');
  [2, 2, 8, 8].forEach((v, i) => near(inn[i], v));
});
test('boolean difference keeps the hole', () => {
  const a = G.__eval('areaOf(boolOp([rectPts(0,0,20,20)], [rectPts(5,5,10,10)], "diff"))');
  near(a, 400 - 100, 0.5);
});
test('kerf compensation: outer outline grows, hole shrinks (auto side)', () => {
  const r = G.__eval(`(() => { const outer = rectPts(0,0,40,40), hole = rectPts(10,10,20,20).reverse(); const k = kerfPaths([outer, hole], 0.2, 'auto'); return k.map(p => { const b = bboxOf([p]); return b[2]-b[0] }).sort((a,b)=>a-b) })()`);
  near(r[0], 19.8, 0.03); near(r[1], 40.2, 0.03);
});
test('duplicate outlines are detected', () => {
  const d = G.__eval(`findDuplicatePaths([{id:1,paths:[rectPts(0,0,10,10)],closed:true},{id:2,paths:[rectPts(0,0,10,10)],closed:true},{id:3,paths:[rectPts(30,0,10,10)],closed:true}])`);
  assert.equal(d.length, 1); assert.equal(d[0].b.id, 2);
});
test('open segments are joined end to end', () => {
  const j = G.__eval('joinOpenPaths([[[0,0],[10,0]],[[10,0],[10,10]],[[30,30],[40,30]]])');
  assert.equal(j.length, 2);
});
test('self-intersection check', () => {
  assert.equal(G.__eval('selfIntersects([[0,0],[10,10],[10,0],[0,10]], true)'), true);
  assert.equal(G.__eval('selfIntersects(rectPts(0,0,10,10), true)'), false);
});
