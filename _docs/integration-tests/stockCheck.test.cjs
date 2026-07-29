const assert = require('assert');
const { selectLowStock } = require('../../backend/src/services/reorderDecision');

// Edge-case coverage for the alert DECISION — the "missed alert = stockout"
// path (P0, highest business risk). Pure, DB-free: locks in exactly which
// products raise an alert given a Shopify stock feed and threshold rows.

// Returns the set of product_ids that would be alerted, for terse asserting.
function alertedIds(stockLevels, thresholds) {
    return selectLowStock(stockLevels, thresholds).map((a) => a.product_id).sort();
}

function test() {
    // --- threshold boundary (off-by-one is the classic stockout bug) ---
    // stock exactly AT threshold -> alert (comparison is <=, not <)
    assert.deepStrictEqual(
        alertedIds([{ sku: 'A', stock_on_hand: 10 }], [{ product_id: 1, sku: 'A', threshold: 10 }]),
        [1],
        'stock == threshold must alert'
    );
    // one above threshold -> no alert
    assert.deepStrictEqual(
        alertedIds([{ sku: 'A', stock_on_hand: 11 }], [{ product_id: 1, sku: 'A', threshold: 10 }]),
        [],
        'stock == threshold + 1 must NOT alert'
    );
    // one below threshold -> alert
    assert.deepStrictEqual(
        alertedIds([{ sku: 'A', stock_on_hand: 9 }], [{ product_id: 1, sku: 'A', threshold: 10 }]),
        [1],
        'stock == threshold - 1 must alert'
    );

    // --- zero / negative stock must never be treated as "missing" ---
    // stock 0 with a matched key -> alert (0 !== undefined)
    assert.deepStrictEqual(
        alertedIds([{ sku: 'A', stock_on_hand: 0 }], [{ product_id: 1, sku: 'A', threshold: 5 }]),
        [1],
        'zero stock must alert, not be skipped as unknown'
    );
    // negative stock (oversold) -> alert
    assert.deepStrictEqual(
        alertedIds([{ sku: 'A', stock_on_hand: -3 }], [{ product_id: 1, sku: 'A', threshold: 5 }]),
        [1],
        'negative stock must alert'
    );

    // --- threshold of 0 (alert only at true stockout) ---
    assert.deepStrictEqual(
        alertedIds([{ sku: 'A', stock_on_hand: 0 }], [{ product_id: 1, sku: 'A', threshold: 0 }]),
        [1],
        'threshold 0: stock 0 must alert'
    );
    assert.deepStrictEqual(
        alertedIds([{ sku: 'A', stock_on_hand: 1 }], [{ product_id: 1, sku: 'A', threshold: 0 }]),
        [],
        'threshold 0: stock 1 must NOT alert'
    );

    // --- missing stock data: cannot decide, must be skipped (no false alert) ---
    assert.deepStrictEqual(
        alertedIds([{ sku: 'OTHER', stock_on_hand: 0 }], [{ product_id: 1, sku: 'A', threshold: 5 }]),
        [],
        'product absent from feed must be skipped, not alerted'
    );

    // --- key matching: inventory_item_id first, SKU fallback ---
    // matches on inventory_item_id even when SKU differs
    assert.deepStrictEqual(
        alertedIds(
            [{ inventory_item_id: 555, sku: 'FEED-SKU', stock_on_hand: 2 }],
            [{ product_id: 1, sku: 'DB-SKU', shopify_inventory_item_id: 555, threshold: 5 }]
        ),
        [1],
        'must match on inventory_item_id'
    );
    // item id set on product but absent from feed -> falls back to SKU
    assert.deepStrictEqual(
        alertedIds(
            [{ sku: 'A', stock_on_hand: 2 }],
            [{ product_id: 1, sku: 'A', shopify_inventory_item_id: 999, threshold: 5 }]
        ),
        [1],
        'unmatched item id must fall back to SKU'
    );
    // no item id on product -> matches by SKU
    assert.deepStrictEqual(
        alertedIds(
            [{ sku: 'A', stock_on_hand: 2 }],
            [{ product_id: 1, sku: 'A', shopify_inventory_item_id: null, threshold: 5 }]
        ),
        [1],
        'null item id must match by SKU'
    );

    // --- carries the matched stock level through, not the threshold ---
    const [alert] = selectLowStock(
        [{ sku: 'A', stock_on_hand: 3 }],
        [{ product_id: 1, sku: 'A', threshold: 10 }]
    );
    assert.strictEqual(alert.stock_level, 3, 'alert must carry actual stock level');
    assert.strictEqual(alert.threshold, 10, 'alert must carry the threshold');

    // --- multiple products, mixed outcomes ---
    assert.deepStrictEqual(
        alertedIds(
            [
                { sku: 'LOW', stock_on_hand: 1 },
                { sku: 'OK', stock_on_hand: 100 },
                { sku: 'EDGE', stock_on_hand: 5 },
            ],
            [
                { product_id: 1, sku: 'LOW', threshold: 5 },
                { product_id: 2, sku: 'OK', threshold: 5 },
                { product_id: 3, sku: 'EDGE', threshold: 5 },
            ]
        ),
        [1, 3],
        'only at/below-threshold products alert'
    );

    return 'stockCheck: 14 cases checked';
}

module.exports = { name: 'stockCheck', test };
if (require.main === module) {
    console.log(test());
}
