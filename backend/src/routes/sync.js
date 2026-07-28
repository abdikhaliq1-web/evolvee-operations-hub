const express = require('express');
const { query } = require('../config/db');
const { authenticate, requirePermission } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const env = require('../config/env');

const router = express.Router();

router.use(authenticate, requirePermission('sync'));

// returns integration sync status and which modes are configured
router.get('/status', asyncRoute(async (req, res) => {
    const result = await query('SELECT * FROM sync_status ORDER BY source');

    res.json({
        sources: result.rows,
        configured_modes: env.modes
    });
}));

module.exports = router;