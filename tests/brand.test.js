'use strict';
// Rename check (spec 2): the old product name may only appear where we explicitly
// talk about the previous version (migration notes, changelog, rename guide).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ALLOW = /(formerly|no leftover|старое название|migrat|legacy|previous|old|ранее|прошл|старой|старых|старого|старые|переименов|renamed|used to be called|раньше|Kerf Studio 0\.[12]|from Kerf Studio|из Kerf Studio|LEGACY_NAMES|kerf-studio-v[12]|copied once|"Kerf Studio" builds|Kerf-Studio\b|org\.kerfstudio\.app)/i;
function files(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', 'fixtures', 'vendor', 'fonts', 'licenses'].includes(e.name)) continue;
    const p = path.join(dir, e.name); if (e.isDirectory()) files(p, out); else if (/\.(js|json|html|css|md|yml|yaml|txt)$/i.test(e.name)) out.push(p);
  }
  return out;
}
test('no leftover "Kerf Studio" branding outside migration notes', () => {
  const bad = [];
  for (const f of files(ROOT)) {
    if (/CHANGELOG|RENAME|AUDIT|brand\.test/.test(f)) continue;
    fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => { const s = l.replace(/SkyKerf[ _-]?Studio|SkyKerf/gi, ''); if (/Kerf[ _-]?Studio|kerfDesktop/i.test(s) && !ALLOW.test(l)) bad.push(`${path.relative(ROOT, f)}:${i + 1}: ${l.trim().slice(0, 120)}`) });
  }
  assert.deepEqual(bad, []);
});
test('package metadata uses the new name', () => {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(p.productName, 'SkyKerf_Studio'); assert.equal(p.name, 'skykerf-studio');
  assert.match(p.build.nsis.artifactName, /^SkyKerf_Studio/); assert.match(p.build.linux.artifactName, /^SkyKerf_Studio/);
  assert.match(p.homepage, /skysyndicatecorner\/SkyKerf_Studio/);
});
test('app version matches package.json', () => {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const m = /const APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'src', 'js', 'core.js'), 'utf8'));
  assert.equal(m && m[1], p.version);
});
test('index.html loads every module and nothing from the network', () => {
  const html = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');
  for (const f of fs.readdirSync(path.join(ROOT, 'src', 'js'))) assert.ok(html.includes(`js/${f}`), 'missing script ' + f);
  assert.ok(!/(src|href)="https?:/i.test(html), 'remote resource in index.html');
});
