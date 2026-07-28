import assert from 'node:assert/strict';
import { compareValues, selectRows, toCsv, normalizeText, parseQuery } from '../../frontend/src/tableView.js';

assert.ok(compareValues(2, 10) < 0, 'numbers compare numerically');
assert.ok(compareValues('ER-2', 'ER-10') < 0, 'numeric strings sort naturally');
assert.ok(compareValues(null, 5) > 0 && compareValues(5, null) < 0, 'nulls sort last');

const rows = [
    { sku: 'B-2', name: 'Beta', stock: 10 },
    { sku: 'A-10', name: 'Alpha', stock: 2 },
    { sku: 'C-1', name: 'Gamma', stock: null },
];

assert.deepEqual(selectRows(rows, ['name'], 'alp', null).map((r) => r.sku), ['A-10']);
assert.equal(selectRows(rows, ['name', 'sku'], 'xyz', null).length, 0, 'no match -> empty');

assert.deepEqual(
    selectRows(rows, [], '', { key: 'stock', dir: 1 }).map((r) => r.sku),
    ['A-10', 'B-2', 'C-1'],
);
assert.deepEqual(
    selectRows(rows, [], '', { key: 'sku', dir: -1 }).map((r) => r.sku),
    ['C-1', 'B-2', 'A-10'],
);

assert.deepEqual(selectRows(rows, ['name'], '', { key: null, dir: 1 }), rows);

const csvCols = [
    { label: 'SKU', get: (r) => r.sku },
    { label: 'Note', get: (r) => r.note },
];
assert.equal(
    toCsv(csvCols, [{ sku: 'A-1', note: 'plain' }]),
    'SKU,Note\nA-1,plain',
);
assert.equal(
    toCsv(csvCols, [{ sku: 'B,2', note: 'has "quote"\nand newline' }]),
    'SKU,Note\n"B,2","has ""quote""\nand newline"',
);
assert.equal(toCsv(csvCols, []), 'SKU,Note');

assert.equal(
    toCsv(csvCols, [{ sku: '=1+1', note: '@cmd' }]),
    "SKU,Note\n'=1+1,'@cmd",
);

const searchRows = [
    { sku: 'ER-SER-001', name: 'Radiance Serum', maker: 'Acme', notes: 'Café blend' },
    { sku: 'ER-OIL-002', name: 'Glow Oil', maker: 'Acme', notes: 'discontinued' },
    { sku: 'ER-CRM-003', name: 'Night Cream', maker: 'Lumen', notes: 'red 40 free' },
];
const searchFields = ['sku', 'name', 'maker', 'notes'];
const ids = (q) => selectRows(searchRows, searchFields, q).map((r) => r.sku);

assert.deepEqual(ids('serum'), ['ER-SER-001']);
assert.deepEqual(ids('acme oil'), ['ER-OIL-002']);
assert.deepEqual(ids('acme -discontinued'), ['ER-SER-001']);
assert.deepEqual(ids('"red 40"'), ['ER-CRM-003']);
assert.deepEqual(ids('red40'), []);
assert.deepEqual(ids('cafe'), ['ER-SER-001']);
assert.deepEqual(ids('  '), searchRows.map((r) => r.sku));
assert.deepEqual(ids('zzz'), []);

assert.equal(normalizeText('CAFÉ'), 'cafe');
assert.equal(parseQuery('a -"b c"').length, 2);
assert.equal(parseQuery('-"b c"')[0].negate, true);

console.log('tableView self-check passed.');
