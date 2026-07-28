const express = require('express');
const { query } = require('../config/db');
const { authenticate, requirePermission } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const { validateId } = require('../middleware/validateId');
const { recordAudit } = require('../services/audit');

const router = express.Router();

router.use(authenticate, requirePermission('manufacturers'));
router.param('id', validateId);

router.get('/', asyncRoute(async (req, res) => {
    const sql =
        'SELECT m.*, ' +
        '    (SELECT COUNT(*)::int FROM products p ' +
        '     WHERE p.manufacturer_id = m.id) AS product_count, ' +
        '    (SELECT COUNT(*)::int FROM production_runs pr ' +
        '     WHERE pr.manufacturer_id = m.id ' +
        "       AND pr.status IN ('ordered', 'in_production', 'shipped')) AS active_runs, " +
        '    (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (pr.updated_at - pr.created_at)) / 86400.0)::numeric, 1) ' +
        '     FROM production_runs pr ' +
        "     WHERE pr.manufacturer_id = m.id AND pr.status = 'received') AS avg_production_days, " +
        '    (SELECT MAX(c.logged_at) FROM communications c ' +
        '     WHERE c.manufacturer_id = m.id) AS last_contacted ' +
        'FROM manufacturers m ' +
        'ORDER BY m.name';

    const result = await query(sql);

    res.json({ manufacturers: result.rows });
}));

router.get('/:id', asyncRoute(async (req, res) => {
    const id = Number(req.params.id);

    const mfr = await query(
        'SELECT m.*, ' +
        '    (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (pr.updated_at - pr.created_at)) / 86400.0)::numeric, 1) ' +
        '     FROM production_runs pr ' +
        "     WHERE pr.manufacturer_id = m.id AND pr.status = 'received') AS avg_production_days " +
        'FROM manufacturers m WHERE m.id = $1',
        [id]
    );

    if (!mfr.rows[0]) {
        return res.status(404).json({ error: 'Manufacturer not found.' });
    }

    // Load everything related to this manufacturer in parallel.
    const contactsSql =
        'SELECT * FROM manufacturer_contacts WHERE manufacturer_id = $1 ORDER BY name';

    const productsSql =
        'SELECT p.*, rt.threshold ' +
        'FROM products p ' +
        'LEFT JOIN reorder_thresholds rt ON rt.product_id = p.id ' +
        'WHERE p.manufacturer_id = $1 ' +
        'ORDER BY p.sku';

    const commsSql =
        'SELECT c.*, u.full_name AS logged_by_name, mc.name AS contact_name ' +
        'FROM communications c ' +
        'LEFT JOIN users u ON u.id = c.logged_by ' +
        'LEFT JOIN manufacturer_contacts mc ON mc.id = c.contact_id ' +
        'WHERE c.manufacturer_id = $1 ' +
        'ORDER BY c.logged_at DESC';

    const runsSql =
        'SELECT pr.*, p.sku, p.name AS product_name ' +
        'FROM production_runs pr ' +
        'LEFT JOIN products p ON p.id = pr.product_id ' +
        'WHERE pr.manufacturer_id = $1 ' +
        'ORDER BY pr.created_at DESC';

    const historySql =
        'SELECT rh.*, p.sku, p.name AS product_name ' +
        'FROM reorder_history rh ' +
        'JOIN products p ON p.id = rh.product_id ' +
        'WHERE rh.manufacturer_id = $1 ' +
        'ORDER BY rh.ordered_at DESC';

    const [contacts, products, comms, runs, history] = await Promise.all([
        query(contactsSql, [id]),
        query(productsSql, [id]),
        query(commsSql, [id]),
        query(runsSql, [id]),
        query(historySql, [id])
    ]);

    res.json({
        manufacturer: mfr.rows[0],
        contacts: contacts.rows,
        products: products.rows,
        communications: comms.rows,
        production_runs: runs.rows,
        reorder_history: history.rows
    });
}));

router.post('/', asyncRoute(async (req, res) => {
    const body = req.body || {};
    const name = body.name;
    const country = body.country;
    const notes = body.notes;

    if (!name) {
        return res.status(400).json({ error: 'Manufacturer name is required.' });
    }

    const countryValue = country || null;
    const notesValue = notes || null;
    const leadTimeValue = body.lead_time_days === '' || body.lead_time_days == null ? null : Number(body.lead_time_days);
    const moqValue = body.min_order_quantity === '' || body.min_order_quantity == null ? null : Number(body.min_order_quantity);
    const paymentTermsValue = body.payment_terms || null;
    const qualityValue = body.quality_rating === '' || body.quality_rating == null ? null : Number(body.quality_rating);

    const result = await query(
        'INSERT INTO manufacturers (name, country, notes, lead_time_days, min_order_quantity, payment_terms, quality_rating) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [name, countryValue, notesValue, leadTimeValue, moqValue, paymentTermsValue, qualityValue]
    );

    await recordAudit(req, {
        action: 'create', entity: 'manufacturer', entityId: result.rows[0].id,
        details: { name },
    });

    res.status(201).json({ manufacturer: result.rows[0] });
}));

router.patch('/:id', asyncRoute(async (req, res) => {
    const body = req.body || {};
    const id = Number(req.params.id);

    // Only update columns whose key is present; '' clears numeric fields.
    // (COALESCE couldn't tell "omitted" from "cleared", so clearing never worked.)
    const set = [];
    const values = [];
    const changed = {};
    let i = 1;
    const put = (col, val) => { set.push(`${col} = $${i++}`); values.push(val); changed[col] = val; };
    const numOrNull = (v) => (v === '' || v == null ? null : v);

    // Build the SET clause dynamically from whichever fields were sent.
    if ('name' in body) put('name', body.name);
    if ('country' in body) put('country', body.country || null);
    if ('notes' in body) put('notes', body.notes || null);
    if ('lead_time_days' in body) put('lead_time_days', numOrNull(body.lead_time_days));
    if ('min_order_quantity' in body) put('min_order_quantity', numOrNull(body.min_order_quantity));
    if ('payment_terms' in body) put('payment_terms', body.payment_terms || null);
    if ('quality_rating' in body) put('quality_rating', numOrNull(body.quality_rating));

    if (set.length === 0) {
        return res.status(400).json({ error: 'No fields to update.' });
    }

    set.push('updated_at = NOW()');
    values.push(id);
    const sql = `UPDATE manufacturers SET ${set.join(', ')} WHERE id = $${i} RETURNING *`;

    const result = await query(sql, values);

    if (!result.rows[0]) {
        return res.status(404).json({ error: 'Manufacturer not found.' });
    }

    await recordAudit(req, {
        action: 'update', entity: 'manufacturer', entityId: id, details: changed,
    });

    res.json({ manufacturer: result.rows[0] });
}));

router.post('/:id/contacts', asyncRoute(async (req, res) => {
    const body = req.body || {};
    const name = body.name;
    const role = body.role;
    const email = body.email;
    const phone = body.phone;
    const notes = body.notes;

    if (!name) {
        return res.status(400).json({ error: 'Contact name is required.' });
    }

    const roleValue = role || null;
    const emailValue = email || null;
    const phoneValue = phone || null;
    const notesValue = notes || null;

    const manufacturerId = Number(req.params.id);
    const sql =
        'INSERT INTO manufacturer_contacts ' +
        '    (manufacturer_id, name, role, email, phone, notes) ' +
        'VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';

    const result = await query(sql, [manufacturerId, name, roleValue, emailValue, phoneValue, notesValue]);
    res.status(201).json({ contact: result.rows[0] });
}));

router.post('/:id/communications', asyncRoute(async (req, res) => {
    const body = req.body || {};
    const channel = body.channel;
    const summary = body.summary;
    const contactId = body.contact_id;

    if (!summary) {
        return res.status(400).json({ error: 'A summary of the communication is required.' });
    }

    const channelValue = channel || 'email';
    const contactIdValue = contactId || null;

    const manufacturerId = Number(req.params.id);
    const sql =
        'INSERT INTO communications ' +
        '    (manufacturer_id, contact_id, channel, summary, logged_by) ' +
        'VALUES ($1, $2, $3, $4, $5) RETURNING *';

    const result = await query(sql, [manufacturerId, contactIdValue, channelValue, summary, req.user.id]);
    res.status(201).json({ communication: result.rows[0] });
}));

router.post('/:id/reorders', asyncRoute(async (req, res) => {
    const body = req.body || {};
    const productId = body.product_id;
    const quantityOrdered = body.quantity_ordered;
    const orderedAt = body.ordered_at;
    const notes = body.notes;

    if (!productId || !quantityOrdered) {
        return res.status(400).json({ error: 'product_id and quantity_ordered are required.' });
    }

    const orderedAtValue = orderedAt || null;
    const notesValue = notes || null;

    const manufacturerId = Number(req.params.id);
    const sql =
        'INSERT INTO reorder_history ' +
        '    (product_id, manufacturer_id, quantity_ordered, ordered_at, notes, created_by) ' +
        'VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6) RETURNING *';

    const result = await query(sql, [productId, manufacturerId, quantityOrdered, orderedAtValue, notesValue, req.user.id]);
    res.status(201).json({ reorder: result.rows[0] });
}));

module.exports = router;