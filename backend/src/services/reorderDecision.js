// Pure reorder-alert decision

// Index stock by item id AND SKU so a threshold row can match on either.
function indexStockByKey(stockLevels) {
    const stockByKey = {};
    for (const stockItem of stockLevels) {
        if (stockItem.inventory_item_id != null) {
            stockByKey[stockItem.inventory_item_id] = stockItem.stock_on_hand;
        }
        if (stockItem.sku) {
            stockByKey[stockItem.sku] = stockItem.stock_on_hand;
        }
    }
    return stockByKey;
}

// Find this product's current stock: item id first, then fall back to SKU.
// Returns undefined only when neither key is in the feed (stock genuinely
// unknown.) A real stock of 0 must NOT read as undefined, or a stockout
// would be silently skipped.
function lookupStock(stockByKey, row) {
    let currentStock = row.shopify_inventory_item_id != null
        ? stockByKey[row.shopify_inventory_item_id]
        : undefined;
    if (currentStock === undefined) {
        currentStock = stockByKey[row.sku];
    }
    return currentStock;
}

// Given the Shopify stock feed and threshold rows, return the rows that should
// raise an alert (stock at OR below threshold). Rows with no stock data in the
// feed are skipped; we can't decide on missing data.
function selectLowStock(stockLevels, thresholds) {
    const stockByKey = indexStockByKey(stockLevels);
    const toAlert = [];

    for (const row of thresholds) {
        const currentStock = lookupStock(stockByKey, row);
        
        if (currentStock === undefined) {
            continue;
        }
        if (currentStock <= row.threshold) {
            toAlert.push({ product_id: row.product_id, stock_level: currentStock, threshold: row.threshold });
        }
    }

    return toAlert;
}

module.exports = { selectLowStock };
