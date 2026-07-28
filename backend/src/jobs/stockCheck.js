const cron = require('node-cron');
const { query } = require('../config/db');
const env = require('../config/env');
const shopify = require('../services/integrations/shopify');
const { selectLowStock } = require('../services/reorderDecision');

// Inserts a new alert unless one is already open/acknowledged for this product.
async function alertIfLowStock(productId, currentStock, threshold) {
    const result = await query(
        `INSERT INTO reorder_alerts (product_id, stock_level, threshold)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_id) WHERE status IN ('open', 'acknowledged')
         DO NOTHING
         RETURNING id`,
        [productId, currentStock, threshold]
    );

    return result.rows.length > 0;
}

let lastRun = null;
const getLastStockCheck = () => lastRun;

// runs the check and saves failure state so /health can see it
async function runStockCheck() {
    try {
        return await runStockCheckInner();
    } catch (err) {
        lastRun = { ran_at: new Date().toISOString(), ok: false, error: err.message };
        throw err;
    }
}

// pulls live stock from shopify, compares to thresholds, makes alerts
async function runStockCheckInner() {
    const stockLevels = await shopify.getStockLevels();

    const thresholdsResult = await query(
        `SELECT p.id AS product_id, p.sku, p.shopify_inventory_item_id, rt.threshold
         FROM reorder_thresholds rt JOIN products p ON p.id = rt.product_id`
    );

    const thresholds = thresholdsResult.rows;
    const toAlert = selectLowStock(stockLevels, thresholds);
    let alertsCreated = 0;

    for (const item of toAlert) {
        const wasCreated = await alertIfLowStock(item.product_id, item.stock_level, item.threshold);
        if (wasCreated) {
            alertsCreated++;
        }
    }

    const summary = {
        checked: thresholds.length,
        alerts_created: alertsCreated,
        ran_at: new Date().toISOString()
    };

    console.log(`[stock-check] checked ${summary.checked} SKUs, created ${alertsCreated} new alert(s)`);
    lastRun = { ...summary, ok: true };
    return summary;
}

// Registers the recurring cron job; does not run a check immediately.
function scheduleStockCheck() {
    cron.schedule(env.stockCheckCron, function runScheduledStockCheck() {
        runStockCheck().catch(function handleStockCheckError(err) {
            console.error('[stock-check] failed:', err.message);
        });
    });

    console.log(`Stock check scheduled with cron pattern "${env.stockCheckCron}"`);
}

module.exports = { runStockCheck, scheduleStockCheck, getLastStockCheck };