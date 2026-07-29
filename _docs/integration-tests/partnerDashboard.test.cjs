const { http, mode, need, run } = require('./_runner.cjs');
const { summaryUrl } = require('../../backend/src/services/integrations/partnerDashboard');

async function test() {
    mode('PARTNER_DASHBOARD_MODE');
    need('PARTNER_DASHBOARD_BASE_URL', 'PARTNER_DASHBOARD_API_KEY');

    const url = summaryUrl(process.env.PARTNER_DASHBOARD_BASE_URL);
    const data = await http(url, {
        headers: { 'X-Ops-Hub-Key': process.env.PARTNER_DASHBOARD_API_KEY, Accept: 'application/json' },
    });

    if (!data.kpis || !Array.isArray(data.leaderboard)) {
        const err = new Error('Response is missing "kpis" or "leaderboard".');
        err.detail = { request: 'GET ' + url, body: JSON.stringify(data).slice(0, 500) };
        throw err;
    }

    return `reached partner app (${data.kpis.approved_partners} approved partners, ${data.leaderboard.length} on leaderboard)`;
}

module.exports = { name: 'Evolvée Partners', test };
if (require.main === module) run([module.exports]);
