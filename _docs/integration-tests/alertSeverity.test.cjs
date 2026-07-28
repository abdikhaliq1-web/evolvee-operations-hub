const assert = require('assert');
const { alertSeverity, sortBySeverity } = require('../../backend/src/services/alertSeverity');

function test() {
    let r = alertSeverity(0, 10);
    assert.strictEqual(r.severity, 'critical');
    assert.strictEqual(r.deficit, 10);
    assert.strictEqual(r.pct_below, 1);

    r = alertSeverity(-3, 10);
    assert.strictEqual(r.severity, 'critical');
    assert.strictEqual(r.deficit, 13);

    r = alertSeverity(5, 10);
    assert.strictEqual(r.severity, 'critical');
    assert.strictEqual(r.pct_below, 0.5);

    r = alertSeverity(9, 10);
    assert.strictEqual(r.severity, 'warning');
    assert.strictEqual(r.deficit, 1);

    r = alertSeverity(0, 0);
    assert.strictEqual(r.pct_below, 1);
    assert.strictEqual(r.severity, 'critical');

    const ranked = sortBySeverity([
        { sku: 'A', stock_level: 9, threshold: 10, triggered_at: '2026-07-20T00:00:00Z' },
        { sku: 'B', stock_level: 0, threshold: 10, triggered_at: '2026-07-19T00:00:00Z' },
        { sku: 'C', stock_level: 5, threshold: 10, triggered_at: '2026-07-18T00:00:00Z' },
    ]);
    assert.deepStrictEqual(ranked.map((a) => a.sku), ['B', 'C', 'A']);

    const tie = sortBySeverity([
        { sku: 'old', stock_level: 5, threshold: 10, triggered_at: '2026-07-01T00:00:00Z' },
        { sku: 'new', stock_level: 5, threshold: 10, triggered_at: '2026-07-10T00:00:00Z' },
    ]);
    assert.deepStrictEqual(tie.map((a) => a.sku), ['new', 'old']);

    return 'alertSeverity: 8 cases checked';
}

module.exports = { name: 'alertSeverity', test };
if (require.main === module) {
    console.log(test());
}
