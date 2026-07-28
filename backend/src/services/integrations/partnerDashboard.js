const env = require('../../config/env');
const { callExternal, withSync } = require('../apiClient');
const sample = require('../sampleData/partnerDashboard.json');

function summaryUrl(baseUrl) {
    return String(baseUrl).replace(/\/+$/, '') + '/api/ops-hub/summary/';
}

async function getPartnerProgram() {
    const mode = env.modes.partnerDashboard;

    return withSync('partner_dashboard', mode, async () => {
        if (mode !== 'live') {
            return sample;
        }

        const { baseUrl, apiKey } = env.partnerDashboard;
        if (!baseUrl || !apiKey) {
            throw new Error(
                'PARTNER_DASHBOARD_MODE=live needs PARTNER_DASHBOARD_BASE_URL and PARTNER_DASHBOARD_API_KEY in backend/.env.'
            );
        }

        const data = await callExternal(summaryUrl(baseUrl), {
            headers: { 'X-Ops-Hub-Key': apiKey, Accept: 'application/json' }
        });

        return {
            kpis: data.kpis || {},
            leaderboard: data.leaderboard || []
        };
    }, sample);
}

if (require.main === module) {
    const assert = require('assert');
    assert.strictEqual(summaryUrl('https://p.example.com'), 'https://p.example.com/api/ops-hub/summary/');
    assert.strictEqual(summaryUrl('https://p.example.com///'), 'https://p.example.com/api/ops-hub/summary/');
    assert.ok(Array.isArray(sample.leaderboard) && sample.kpis.approved_partners >= 0);
    console.log('partnerDashboard self-check passed.');
}

module.exports = { getPartnerProgram, summaryUrl };
