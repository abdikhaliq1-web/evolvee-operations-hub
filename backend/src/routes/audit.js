const express = require('express');
const { query } = require('../config/db');
const { authenticate, requirePermission } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');

const router = express.Router();

router.use(authenticate, requirePermission('users'));

// returns the most recent audit log entries
router.get('/', asyncRoute(async (req, res) => {
    const result = await query(
        'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200'
    );

    res.json({ entries: result.rows });
}));

module.exports = router;
