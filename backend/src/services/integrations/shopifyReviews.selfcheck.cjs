const assert = require('assert');
const { mapReview } = require('./shopifyReviews');

function test() {
    const r = mapReview({
        id: 'gid://shopify/Metaobject/9',
        fields: [
            { key: 'rating', value: '4' },
            { key: 'body', value: 'Great' },
            { key: 'author', value: 'Sam' },
            { key: 'created_at', value: '2026-06-01' },
            { key: 'state', value: 'published' },
            { key: 'sku', value: 'ER-SER-001' }
        ]
    });
    assert.strictEqual(r.rating, 4, 'rating parsed to number');
    assert.strictEqual(r.body, 'Great');
    assert.strictEqual(r.sku, 'ER-SER-001');

    const empty = mapReview({ id: 'x', fields: [] });
    assert.strictEqual(empty.rating, null, 'missing rating -> null');
    assert.strictEqual(empty.author, 'Anonymous');
    assert.strictEqual(empty.state, 'published');

    const alt = mapReview({ id: 'y', fields: [{ key: 'content', value: 'ok' }, { key: 'reviewer', value: 'Lee' }] });
    assert.strictEqual(alt.body, 'ok');
    assert.strictEqual(alt.author, 'Lee');

    const ref = mapReview({
        id: 'z',
        fields: [{ key: 'rating', value: '5' }],
        product: { reference: { variants: { edges: [{ node: { sku: 'ER-OIL-002' } }] } } }
    });
    assert.strictEqual(ref.sku, 'ER-OIL-002', 'sku from product reference');

    return 'mapReview: 4 cases checked';
}

module.exports = { name: 'shopifyReviews mapReview', test };
if (require.main === module) {
    test();
    console.log('shopifyReviews mapReview: ok');
}
