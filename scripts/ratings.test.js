const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ratingPresentation, ratingHeading } = require('./rating-source');
const { parseCsv } = require('../assets/table-import');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('public rating renderers preserve numeric zero', () => {
  for (const file of ['rezultati.html', 'rezultati-single.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const start = html.indexOf('  function esc(text)');
    const finish = html.indexOf('  (async function', start);
    assert.ok(start > 0 && finish > start);
    const context = vm.createContext({});
    vm.runInContext(html.slice(start, finish), context);
    const output = vm.runInContext("buildDetail({layout_type:'rating_two_tables',structured_data:{system_rows:[{punkti:0}],rating_rows:[{punktu_kopsumma:0}]}})", context);
    assert.equal((output.match(/<td>0<\/td>/g) || []).length, 2);
  }
});

test('recover only an explicitly identified seasonal rating, without mutating data', () => {
  const row = { name: '', content: '<table><tr><td><strong>Sporta kluba &quot;IPPON.LV&quot; sportistu reitings. Sezona 2023-2024</strong></td></tr></table>' };
  const override = { record_type: 'sacensibas', layout_type: 'competition_default', custom_html: row.content };
  const before = JSON.stringify({ row, override });
  assert.deepEqual(ratingPresentation(row, override, 'reitings', { rows: [] }), {
    title: 'Sporta kluba "IPPON.LV" sportistu reitings. Sezona 2023-2024',
    recovered: true, recordType: 'reitings', layoutType: 'custom_html'
  });
  assert.equal(JSON.stringify({ row, override }), before);
  assert.equal(ratingPresentation(row, override, 'sacensibas', {}).recovered, false);
  assert.equal(ratingPresentation(row, override, 'reitings', { rows: [{ sportists: 'A' }] }).recovered, false);
  assert.equal(ratingPresentation({ ...row, name: 'Existing title' }, null, 'reitings', {}).title, 'Existing title');
  assert.equal(ratingHeading('<p>No rating heading</p>'), '');
  assert.equal(ratingPresentation({ name: '', content: '' }, override, 'reitings', {}).recovered, false);
});

test('CSV preserves decimals, quoted separators, multiline text, zeros and blank cells', () => {
  assert.deepEqual(parseCsv('\uFEFFSportists;Punkti;Info\r\nAnna;0;"a,b"\r\nJānis;12,5;"line 1\nline 2"'), [
    ['Sportists', 'Punkti', 'Info'], ['Anna', '0', 'a,b'], ['Jānis', '12,5', 'line 1\nline 2']
  ]);
  assert.deepEqual(parseCsv('Name,Points,Info\n"A, B",0,"quote ""yes""; text"\nC,,'), [
    ['Name', 'Points', 'Info'], ['A, B', '0', 'quote "yes"; text'], ['C', '', '']
  ]);
  assert.deepEqual(parseCsv('A\tB\n1\t0'), [['A', 'B'], ['1', '0']]);
  assert.throws(() => parseCsv('Name;Points\n"unclosed;1'), /CSV/);
});
