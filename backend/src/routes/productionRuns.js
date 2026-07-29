const express = require('express');
const { query } = require('../config/db');
const { authenticate, requirePermission } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const { validateId } = require('../middleware/validateId');

const router = express.Router();

router.use(authenticate, requirePermission('manufacturers'));
router.param('id', validateId);

const STATUSES = ['ordered', 'in_production', 'shipped', 'received', 'cancelled'];

// null/'' means "not set" (allowed); any provided value must be a positive number.
function invalidQuantity(quantity) {
    if (quantity == null || quantity === '') {
        return false;
    }
    return !(Number(quantity) > 0);
}

router.get('/', asyncRoute(async (req, res) => {
    const sql =
        'SELECT pr.*, m.name AS manufacturer_name, p.sku, p.name AS product_name ' +
        'FROM production_runs pr ' +
        'JOIN manufacturers m ON m.id = pr.manufacturer_id ' +
        'LEFT JOIN products p ON p.id = pr.product_id ' +
        'ORDER BY pr.created_at DESC ' +
        'LIMIT 1000';

    const result = await query(sql);

    res.json({ runs: result.rows });
}));

router.post('/', asyncRoute(async (req, res) => {
    const body = req.body || {};
    const manufacturerId = body.manufacturer_id;
    const productId = body.product_id;
    const quantity = body.quantity;
    const status = body.status;
    const expectedDate = body.expected_date;
    const notes = body.notes;

    if (!manufacturerId) {
        return res.status(400).json({ error: 'manufacturer_id is required.' });
    }

    if (status && !STATUSES.includes(status)) {
        const allowed = STATUSES.join(', ');
        return res.status(400).json({ error: 'status must be one of: ' + allowed });
    }

    if (invalidQuantity(quantity)) {
        return res.status(400).json({ error: 'quantity must be greater than 0.' });
    }

    // Defaults to 'ordered' in SQL via COALESCE when statusValue is null.
    const productIdValue = productId || null;
    const quantityValue = quantity || null;
    const statusValue = status || null;
    const expectedDateValue = expectedDate || null;
    const notesValue = notes || null;

    const sql =
        'INSERT INTO production_runs ' +
        '    (manufacturer_id, product_id, quantity, status, expected_date, notes) ' +
        "VALUES ($1, $2, $3, COALESCE($4, 'ordered'), $5, $6) RETURNING *";

    const result = await query(sql, [
        manufacturerId,
        productIdValue,
        quantityValue,
        statusValue,
        expectedDateValue,
        notesValue
    ]);
    res.status(201).json({ run: result.rows[0] });
}));

router.patch('/:id', asyncRoute(async (req, res) => {
    const body = req.body || {};
    const status = body.status;
    const expectedDate = body.expected_date;
    const notes = body.notes;
    const quantity = body.quantity;

    if (status && !STATUSES.includes(status)) {
        const allowed = STATUSES.join(', ');
        return res.status(400).json({ error: 'status must be one of: ' + allowed });
    }

    if (invalidQuantity(quantity)) {
        return res.status(400).json({ error: 'quantity must be greater than 0.' });
    }

    // Only update columns whose key is present; '' clears expected_date/quantity.
    const id = Number(req.params.id);
    const set = [];
    const values = [];
    let i = 1;
    const put = (col, val) => { set.push(`${col} = $${i++}`); values.push(val); };
    const orNull = (v) => (v === '' || v == null ? null : v);

    if ('status' in body) put('status', status);
    if ('expected_date' in body) put('expected_date', orNull(expectedDate));
    if ('notes' in body) put('notes', notes || null);
    if ('quantity' in body) put('quantity', orNull(quantity));

    if (set.length === 0) {
        return res.status(400).json({ error: 'No fields to update.' });
    }

    set.push('updated_at = NOW()');
    values.push(id);
    const sql = `UPDATE production_runs SET ${set.join(', ')} WHERE id = $${i} RETURNING *`;

    const result = await query(sql, values);

    if (!result.rows[0]) {
        return res.status(404).json({ error: 'Production run not found.' });
    }
    res.json({ run: result.rows[0] });
}));

module.exports = router;