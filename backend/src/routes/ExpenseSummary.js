const express = require("express");
const { authenticate, requirePermission } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const zohoBooks = require("../services/integrations/zohoBooks");

const router = express.Router();

router.use(authenticate);
// creating a route to get the summary of the companies financials.
router.get('/summary', requirePermission('revenue'), asyncRoute(async (req, res) => {
    const data = await zohoBooks.getExpenseProfitSummary();
    res.json({ summary: data.summary });
}));

module.exports = router;





