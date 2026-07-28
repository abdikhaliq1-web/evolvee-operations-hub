const env = require('../../config/env');
const { callExternal, withSync } = require('../apiClient');
const sample = require('../sampleData/partnerDashboard.json');

// Build the summary endpoint URL, tolerating a trailing slash on the base.
function buildSummaryUrl(baseUrl) {
    return baseUrl.replace(/\/$/, '') + '/api/ops-summary/';
}

// zero-value shape returned when the module is off, matches other integrations' off behavior.
const EMPTY_SUMMARY = {
    generated_at: null,
    kpis: {
        approved_partners: 0,
        pending_partners: 0,
        total_clicks: 0,
        recent_clicks: 0,
        total_conversions: 0,
        conversion_rate: 0,
        total_revenue: 0,
        total_commission: 0,
        pending_commission: 0,
        total_sales_count: 0
    },
    top_partners: []
};

// off:   no data, tile shows zeros — matches shopify/zoho off behavior.
// sample: bundled demo data.
// live:  call the Evolvée Partners Django API with the shared key.
async function getPartnerSummary() {
    const mode = env.modes.partnerDashboard;

    return withSync('partnerDashboard', mode, async () => {
        if (mode === 'sample') {
            return sample;
        }
        const url = buildSummaryUrl(env.partnerDashboard.baseUrl);
        return callExternal(url, {
            headers: { 'X-API-Key': env.partnerDashboard.apiKey }
        });
    }, EMPTY_SUMMARY);
}

module.exports = { getPartnerSummary, buildSummaryUrl };