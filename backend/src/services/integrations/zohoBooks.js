const env = require('../../config/env');
const { callExternal, withSync, cached } = require('../apiClient');
const { getZohoAccessToken, clearZohoToken } = require('./zohoAuth');
const sample = require('../sampleData/zohoBooks.json');
const {getSalesOverview} = require('./shopify.js');

// Fetching the expense and product details from Zoho Books.
async function fetchExpenses(token) {
    const options = { headers: { Authorization: 'Zoho-oauthtoken ' + token } };
    
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const sinceDate = since.toISOString().slice(0, 10);
    
    const url = env.zoho.apiBase + '/books/v3/expenses?organization_id=' + env.zoho.organizationId + '&date_start=' +
        sinceDate;

    const data = await callExternal(url, options);
    return data.expenses || [];
}


// Get the summary of expenses and profit from Zoho Books and Shopify.
async function getExpenseProfitSummary() {
    const mode = env.modes.zohoBooks;

    return withSync('zoho_books', mode, async () => {
        if (mode === 'sample') {
            return sample;
        }

        let sales = [];
        let expenses = [];

        sales = await getSalesOverview().catch((err) => {
            console.warn('Shopify sales unavailable:', err.message);
            return [];
        });

        try {
            const token = await getZohoAccessToken();
            expenses = await fetchExpenses(token);
        } catch (err) {
            if (err.status === 401) {
                clearZohoToken();
                try {
                    const token = await getZohoAccessToken();
                     expenses = await fetchExpenses(token)                   
                } catch (retryErr) {
                    console.warn('Zoho Books retry failed, using Shopify sales-only fallback:', retryErr.message);
                    expenses = null;
                }
            } else {
                console.warn('Zoho Books data unavailable, using Shopify sales-only fallback:', err.message);
                expenses = null;
            }
        }

        // Calculate the company-level revenue.
         const totalRevenue = (sales || []).reduce(
            (sum, sale) => sum + Number(sale.revenue_30d || sale.revenue || 0),
            0
        );

        // Calculate total Zoho Books expenses
        const expensesAvailable = expenses !== null;
       
        const totalExpenses = expensesAvailable ? expenses.reduce(
            (sum, expense) =>
                sum + Number(
                    expense.amount ||
                    expense.total ||
                    expense.expense_amount ||
                    0
                ),
            0
        )
        : null;

        // Profit = revenue - expenses
        const netProfit = expensesAvailable ? totalRevenue - totalExpenses: null;

        // Profit margin = profit / revenue * 100
        const profitMargin =
            expensesAvailable && totalRevenue > 0
                ? (netProfit / totalRevenue) * 100
                : null;

        return {
            summary: {
                totalRevenue,
                totalExpenses,
                netProfit,
                profitMargin
            },
        };
    });
}

async function getSummary() {
    const data = await getExpenseProfitSummary();
    return data.summary;
}


module.exports = {
    getExpenseProfitSummary: () => cached('zoho_books:getExpenseProfitSummary', getExpenseProfitSummary),
    getSummary
};
