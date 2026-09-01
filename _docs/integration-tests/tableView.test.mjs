import assert from 'node:assert/strict';
import { compareValues, nextSort, selectRows, toCsv } from '../../frontend/src/tableView.js';

assert.ok(compareValues(2, 10) < 0, 'numbers compare numerically');
assert.ok(compareValues('ER-2', 'ER-10') < 0, 'numeric strings sort naturally');
assert.ok(compareValues(null, 5) > 0 && compareValues(5, null) < 0, 'nulls sort last');

const rows = [
    { sku: 'B-2', name: 'Beta', stock: 10 },
    { sku: 'A-10', name: 'Alpha', stock: 2 },
    { sku: 'C-1', name: 'Gamma', stock: null },
];

assert.deepEqual(nextSort({key: null, dir: 1}, 'stock'), {key: 'stock', dir: 1}, 'first click sorts ascending',);
assert.deepEqual(nextSort({key: 'stock', dir: 1}, 'stock'), {key: 'stock', dir: -1}, 'second click sorts descending',);
assert.deepEqual(nextSort({key: 'stock', dir: -1}, 'stock'), {key: null, dir: 1}, 'third click clears sorting',);
assert.deepEqual(nextSort({key: 'stock', dir: 1}, 'sku'), {key: 'sku', dir: 1}, 'after 1st click, different column begins ascending',);
assert.deepEqual(nextSort({key: 'stock', dir: -1}, 'sku'), {key: 'sku', dir: 1}, 'after 2nd click, different column begins ascending',);

const previousSort = { key: 'stock', dir: 1 };
const updatedSort = nextSort(previousSort, 'stock');

assert.deepEqual(previousSort, { key: 'stock', dir: 1 }, 'previous state remains unchanged',);
assert.notStrictEqual(updatedSort, previousSort, 'helper returns a new state object',);

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

console.log('tableView self-check passed.');
