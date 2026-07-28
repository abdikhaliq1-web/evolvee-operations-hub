const express = require('express');
const { query } = require('../config/db');
const { authenticate, requirePermission } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const { validateId } = require('../middleware/validateId');
const { runStockCheck } = require('../jobs/stockCheck');

const router = express.Router();

router.use(authenticate, requirePermission('alerts'));
router.param('id', validateId);

// lists reorder alerts, optionally filtered by status
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

// updates an alert's status, sets resolved_at when marked resolved
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

router.delete('/:id', asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const result = await query('DELETE FROM reorder_alerts WHERE id = $1 RETURNING id', [id]);

    if (!result.rows[0]) {
        return res.status(404).json({ error: 'Alert not found.' });
    }

    res.json({ deleted: id });
}));

// runs the stock check job immediately instead of waiting for cron
router.post('/check-now', asyncRoute(async (req, res) => {
    const result = await runStockCheck();
    res.json(result);
}));

module.exports = router;