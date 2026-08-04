const express = require("express");
const { authenticate, requirePermission } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const zohoBooks = require("../services/integrations/zohoBooks");

const router = express.Router();

router.get('/summary', requirePermission('revenue'), asyncRoute(async (req, res) => {
    const summary = await zohoBooks.getSummary();
    res.json({ summary });
}));

router.get('/products', requirePermission('revenue'), asyncRoute(async (req, res) => {
    const products = await zohoBooks.getProducts();
    res.json({ products });
}
));

module.exports = router;





