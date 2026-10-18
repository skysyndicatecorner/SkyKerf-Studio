'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const { parseCDR } = require('../src/js/cdr.js');
const { parsePDF, parseHPGL } = require('../src/js/vecformats.js');

/* ---- a tiny synthetic CorelDRAW file (no third-party drawings in the repo) ---- */
const u32 = v => { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b };
const chunk = (id, data) => Buffer.concat([Buffer.from(id, 'latin1'), u32(data.length), data, data.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)]);
const list = (type, ...kids) => chunk('LIST', Buffer.concat([Buffer.from(type, 'latin1'), ...kids]));
function loda(type, coords) { // header, one argument (0x1e = coordinates)
  const head = 20, offs = head, types = offs + 8, data = types + 8;
  return Buffer.concat([u32(data + coords.length), u32(1), u32(offs), u32(types), u32(type), u32(data), u32(data + coords.length), u32(0x1e), u32(0), coords]);
}
function curve(points, types) { const b = [Buffer.from([points.length & 255, points.length >> 8, 0, 0])]; for (const [x, y] of points) { const q = Buffer.alloc(8); q.writeInt32LE(Math.round(x * 10000)); q.writeInt32LE(Math.round(y * 10000), 4); b.push(q) } b.push(Buffer.from(types)); return Buffer.concat(b) }
function trfd(m, ver) { const t = Buffer.alloc(16 + 8 + 2 + 6 + 48); t.writeUInt32LE(t.length, 0); t.writeUInt32LE(1, 4); t.writeUInt32LE(12, 8); t.writeUInt32LE(16, 12); const o = 16 + (ver >= 1300 ? 8 : 0); t.writeUInt16LE(8, o); [m[0], m[1], m[2] * 10000, m[3], m[4], m[5] * 10000].forEach((v, i) => t.writeDoubleLE(v, o + 8 + 8 * i)); return t }
function cdrFile(ver, objs) {
  const vr = Buffer.alloc(2); vr.writeUInt16LE(ver);
  const body = Buffer.concat([chunk('vrsn', vr), list('page', chunk('flgs', u32(0))), list('page', chunk('flgs', u32(0)), list('gobj', list('layr', chunk('flgs', u32(0x98000000)), ...objs)))]);
  return Buffer.concat([Buffer.from('RIFF'), u32(body.length + 4), Buffer.from('CDR' + String.fromCharCode(0x41 + ver / 100 - 10)), body]);
}
const bbox = shapes => { const b = [Infinity, Infinity, -Infinity, -Infinity]; for (const s of shapes) for (const p of s.paths) for (const [x, y] of p) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y) } return b.map(v => Math.round(v * 1000) / 1000) };
const inflate = b => zlib.inflateSync(b), inflateRaw = b => zlib.inflateRawSync(b);

test('CDR: closed curve with a transform lands at the right place and size', async () => {
  for (const ver of [1300, 1700]) {
    const square = curve([[0, 0], [10, 0], [10, 10], [0, 10]], [0x00, 0x40, 0x40, 0x48]);
    const obj = list('obj ', chunk('flgs', u32(0)), list('lgob', chunk('loda', loda(3, square)), list('trfl', chunk('trfd', trfd([2, 0, 5, 0, 1, -3], ver)))));
    const r = await parseCDR(cdrFile(ver, [obj]), inflate, inflateRaw);
    const shapes = r.pages.flatMap(p => p.shapes);
    assert.equal(r.version, ver); assert.equal(shapes.length, 1); assert.equal(shapes[0].closed, true);
    assert.deepEqual(bbox(shapes), [5, -3, 25, 7]);
  }
});
test('CDR: Bezier segments are flattened through their control points', async () => {
  const pts = [[0, 0], [0, 10], [10, 10], [10, 0]], arc = curve(pts, [0x00, 0xc0, 0xc0, 0x80]);
  const obj = list('obj ', list('lgob', chunk('loda', loda(3, arc))));
  const r = await parseCDR(cdrFile(1500, [obj]), inflate, inflateRaw), p = r.pages.flatMap(x => x.shapes)[0].paths[0];
  assert.ok(p.length > 8); const top = Math.max(...p.map(q => q[1])); assert.ok(Math.abs(top - 7.5) < .05, 'cubic peak at 3/4 of the control height');
});
test('CDR: ellipse record becomes a closed outline of the right size', async () => {
  const e = Buffer.alloc(20); e.writeInt32LE(400000, 0); e.writeInt32LE(200000, 4);
  const r = await parseCDR(cdrFile(1400, [list('obj ', list('lgob', chunk('loda', loda(2, e))))]), inflate, inflateRaw);
  bbox(r.pages.flatMap(x => x.shapes)).forEach((v, i) => assert.ok(Math.abs(v - [0, 0, 40, 20][i]) < .01, `bbox ${v}`));
});
test('CDR: not a CorelDRAW file is rejected clearly', async () => {
  await assert.rejects(parseCDR(Buffer.from('hello world, not riff'), inflate, inflateRaw), /not a CorelDRAW file/);
});

/* ---- PDF ---- */
function pdf(content, compress) {
  const stream = compress ? zlib.deflateSync(Buffer.from(content)) : Buffer.from(content);
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 /MediaBox [0 0 283.4646 283.4646] >>', '<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>'];
  let s = '%PDF-1.4\n'; const parts = [Buffer.from(s)]; objs.forEach((o, i) => parts.push(Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`)));
  parts.push(Buffer.from(`4 0 obj\n<< /Length ${stream.length}${compress ? ' /Filter /FlateDecode' : ''} >>\nstream\n`), stream, Buffer.from('\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'));
  return Buffer.concat(parts);
}
test('PDF: rectangle and curve in points come out in millimetres, transforms applied', async () => {
  for (const comp of [false, true]) {
    const r = await parsePDF(pdf('q 2 0 0 2 0 0 cm 0 0 m 28.3465 0 l 28.3465 28.3465 l h S Q 100 100 56.693 28.3465 re f 10 10 m 10 50 50 50 50 10 c S', comp), inflate);
    const sh = r.pages[0].shapes; assert.equal(sh.length, 3);
    assert.deepEqual(bbox([sh[0]]), [0, 0, 20, 20]); // 10 mm triangle scaled ×2
    assert.deepEqual(bbox([sh[1]]).map(v => Math.round(v * 10) / 10), [35.3, 35.3, 55.3, 45.3]);
    assert.equal(sh[0].closed, true); assert.equal(sh[2].closed, false);
  }
});
test('PDF: clipping paths (n) are not imported, text is reported', async () => {
  const r = await parsePDF(pdf('0 0 100 100 re W n BT /F1 12 Tf (Hi) Tj ET 10 10 m 20 20 l S'), inflate);
  assert.equal(r.pages[0].shapes.length, 1); assert.ok(r.warnings.includes('text'));
});

/* ---- HPGL ---- */
test('HPGL: 40 units per millimetre, absolute and relative moves, circles', () => {
  const r = parseHPGL('IN;SP1;PU0,0;PD400,0,400,400,0,400,0,0;PU800,0;PR;PD400,0;PU;PA2000,2000;CI400;');
  const sh = r.pages[0].shapes; assert.equal(sh.length, 3);
  assert.equal(sh[0].closed, true); assert.deepEqual(bbox([sh[0]]), [0, 0, 10, 10]);
  assert.deepEqual(bbox([sh[1]]), [20, 0, 30, 0]);
  assert.deepEqual(bbox([sh[2]]), [40, 40, 60, 60]);
});
