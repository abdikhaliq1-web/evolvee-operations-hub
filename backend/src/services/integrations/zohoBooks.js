const env = require('../../config/env');
const { callExternal, withSync, cached } = require('../apiClient');
const { getZohoAccessToken, clearZohoToken } = require('./zohoAuth');
const sample = require('../sampleData/zohoBooks.json');
const {getSalesOverview} = require('./shopify.js');

// Fetching the expense and product details from Zoho Books.
async function fetchExpenses(token) {
    const options = { headers: { Authorization: 'Zoho-oauthtoken ' + token } };
    const url = env.zoho.apiBase + '/books/v3/expenses?organization_id=' + env.zoho.organizationId;

    const data = await callExternal(url, options);
    return data.expenses || [];
}

async function fetchItems(token) {
    const options = { headers: { Authorization: 'Zoho-oauthtoken ' + token } };
    const url = env.zoho.apiBase + '/books/v3/items?organization_id=' + env.zoho.organizationId;

    const data = await callExternal(url, options);
    return data.items || [];
}

async function getExpenseProfitSummary() {
    const mode = env.modes.zohoBooks;

    return withSync('zoho_books', mode, async () => {
        if (mode === 'sample') {
            return sample;
        }

        let sales = [];
        let expenses = [];
        let items = [];

        try {
            const token = await getZohoAccessToken();
            [sales, expenses, items] = await Promise.all([
                getSalesOverview(),
                fetchExpenses(token),
                fetchItems(token)
            ]);
        } catch (err) {
            if (err.status === 404) {
                clearZohoToken();

                try {
                    const token = await getZohoAccessToken();
                    [sales, expenses, items] = await Promise.all([
                        getSalesOverview(),
                        fetchExpenses(token),
                        fetchItems(token)
                    ]);
                } catch (retryErr) {
                    console.warn('Zoho Books retry failed, using Shopify sales-only fallback:', retryErr.message);
                    expenses = [];
                    items = [];
                    sales = await getSalesOverview().catch(() => []);
                }
            } else {
                console.warn('Zoho Books data unavailable, using Shopify sales-only fallback:', err.message);
                expenses = [];
                items = [];
                sales = await getSalesOverview().catch(() => []);
            }
        }

        // Build a sales summary per SKU using Shopify's 30-day sales overview.
        const salesBySku = {};

        for (const entry of sales || []) {
            const sku = entry.sku;
            if (!sku) continue;

            salesBySku[sku] = {
                sku,
                productName: entry.title || entry.productName || sku,
                unitsSold: Number(entry.units_sold_30d || 0),
                revenue: Number(entry.revenue_30d || 0),
                costOfGoodsSold: 0
            };
        }

        // Merge Zoho item data so each SKU also gets a product name and cost basis.
        for (const item of items || []) {
            const sku = item.sku || item.item_id || item.code || item.name;
            if (!sku) continue;

            const productName = item.name || item.description || sku;
            const acquisitionCost = Number(item.purchase_rate || item.cost_rate || item.cost || 0);
            const existing = salesBySku[sku];

            if (existing) {
                existing.productName = existing.productName || productName;
                existing.costOfGoodsSold = acquisitionCost * existing.unitsSold;
            } else {
                salesBySku[sku] = {
                    sku,
                    productName,
                    unitsSold: 0,
                    revenue: 0,
                    costOfGoodsSold: acquisitionCost * 0
                };
            }
        }

        // Convert the grouped SKU data into the product rows expected by the dashboard.
        const products = Object.values(salesBySku).map((product) => {
            const profit = product.revenue - product.costOfGoodsSold;
            const profitMargin = product.revenue > 0 ? (profit / product.revenue) * 100 : 0;

            return {
                sku: product.sku,
                productName: product.productName,
                unitsSold: product.unitsSold,
                revenue: product.revenue,
                costOfGoodsSold: product.costOfGoodsSold,
                profit,
                profitMargin
            };
        });

        // Calculate the company-level summary from the merged product rows and expenses.
        const totalRevenue = products.reduce((sum, product) => sum + product.revenue, 0);
        const totalCostOfGoodsSold = products.reduce((sum, product) => sum + product.costOfGoodsSold, 0);
        const totalExpenses = (expenses || []).reduce((sum, expense) => sum + Number(expense.amount || expense.total || expense.expense_amount || 0), 0);
        const netProfit = totalRevenue - totalCostOfGoodsSold - totalExpenses;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        return {
            summary: {
                totalRevenue,
                costOfGoodsSold: totalCostOfGoodsSold,
                totalExpenses,
                netProfit,
                profitMargin
            },
            products
        };
    });
}

async function getSummary() {
    const data = await getExpenseProfitSummary();
    return data.summary;
}

async function getProducts() {
    const data = await getExpenseProfitSummary();
    return data.products;
}

module.exports = {
    getExpenseProfitSummary: () => cached('zoho_books:getExpenseProfitSummary', getExpenseProfitSummary),
    getSummary,
    getProducts
};
