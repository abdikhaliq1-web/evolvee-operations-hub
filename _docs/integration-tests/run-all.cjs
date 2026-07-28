const { run, redact } = require('./_runner.cjs');

const mjsCheck = (label, file) => ({ name: label, test: () => import(file).then(() => undefined) });

const tests = [
    require('./shopify.test.cjs'),
    require('./zohoCrm.test.cjs'),
    require('../../backend/src/services/integrations/shopifyReviews.selfcheck.cjs'),
    require('../../backend/src/services/integrations/partnerDashboard.selfcheck.cjs'),
    require('./customerPurchases.test.cjs'),
    require('./alertSeverity.test.cjs'),
    require('./stockCheck.test.cjs'),
    mjsCheck('productMetrics', './productMetrics.test.mjs'),
    mjsCheck('dashboardOrder', './dashboardOrder.test.mjs'),
    mjsCheck('tableView', './tableView.test.mjs'),
];

if (process.argv.includes('--selfcheck')) {
    const assert = require('assert');
    const redacted = redact('https://accounts.zoho.com/oauth/v2/token?refresh_token=ABC&client_id=ID&client_secret=SECRET&grant_type=refresh_token');
    assert.ok(!redacted.includes('ABC') && !redacted.includes('SECRET') && !redacted.includes('=ID&'), 'redact must hide secrets');
    assert.ok(redacted.includes('grant_type=refresh_token'), 'redact must keep non-secret params');
    assert.strictEqual(tests.length, 10, 'all integrations and self-checks registered');
    console.log('run-all self-check passed.');
} else {
    run(tests);
}
