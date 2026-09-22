const express = require('express');
const { query } = require('../config/db');
const { authenticate, requirePermission, requireWrite, requireRole, ALERT_DELETE_ROLES } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const { validateId } = require('../middleware/validateId');
const { runStockCheck } = require('../jobs/stockCheck');
const { rateLimit } = require('../middleware/rateLimit');
const { recordAudit } = require('../services/audit');

const router = express.Router();

router.use(authenticate, requirePermission('alerts'), requireWrite('alerts'));
router.param('id', validateId);

// Each run calls Shopify. Unthrottled, this is a free way to exhaust the store's
// API quota from any logged-in account.
const checkRateLimit = rateLimit(
    [
        { name: 'check-user', key: (req) => req.user.id, windowMs: 60 * 1000, max: 5 },
        { name: 'check-all', key: () => 'global', windowMs: 60 * 1000, max: 20 },
    ],
    'Stock check was run too recently. Please wait a minute and try again.'
);

router.get('/', asyncRoute(async (req, res) => {
    const status = req.query.status;

    let whereClause = '';
    let params = [];

    if (status) {
        whereClause = 'WHERE ra.status = $1';
        params = [status];
    }

    const sql =
        'SELECT ra.*, p.sku, p.name AS product_name, p.manufacturer_id, m.name AS manufacturer ' +
        'FROM reorder_alerts ra ' +
        'JOIN products p ON p.id = ra.product_id ' +
        'LEFT JOIN manufacturers m ON m.id = p.manufacturer_id ' +
        whereClause + ' ' +
        'ORDER BY ra.triggered_at DESC LIMIT 200';

    const result = await query(sql, params);

    res.json({ alerts: result.rows });
}));

router.patch('/:id', asyncRoute(async (req, res) => {
    const body = req.body || {};
    const status = body.status;

    const allowed = ['open', 'acknowledged', 'resolved'];
    if (!allowed.includes(status)) {
        return res.status(400).json({ error: "status must be 'open', 'acknowledged', or 'resolved'." });
    }

    const id = Number(req.params.id);
    const sql =
        'UPDATE reorder_alerts ' +
        'SET status = $1, ' +
        "    resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE NULL END " +
        'WHERE id = $2 RETURNING *';

    const result = await query(sql, [status, id]);

    const alert = result.rows[0];

    if (!alert) {
        return res.status(404).json({ error: 'Alert not found.' });
    }

    res.json({ alert: alert });
}));

router.delete('/:id', requireRole(...ALERT_DELETE_ROLES), asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const result = await query(
        'DELETE FROM reorder_alerts WHERE id = $1 RETURNING id, product_id, stock_level, threshold, status',
        [id]
    );
    const deleted = result.rows[0];

    if (!deleted) {
        return res.status(404).json({ error: 'Alert not found.' });
    }

    // The row is gone, so the audit entry is the only remaining record that it existed.
    await recordAudit(req, {
        action: 'delete', entity: 'reorder_alert', entityId: id,
        details: {
            product_id: deleted.product_id,
            stock_level: deleted.stock_level,
            threshold: deleted.threshold,
            status: deleted.status,
        },
    });

    res.json({ deleted: id });
}));

router.post('/check-now', checkRateLimit, asyncRoute(async (req, res) => {
    const result = await runStockCheck();
    res.json(result);
}));

module.exports = router;