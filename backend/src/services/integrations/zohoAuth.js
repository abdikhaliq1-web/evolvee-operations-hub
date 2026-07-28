const env = require('../../config/env');
const { callExternal } = require('../apiClient');

let cached = { token: null, expiresAt: 0 };

// NOTE: this calls callExternal directly, without a withSync() wrapper — so a
// failed token refresh (Zoho 401 bad refresh_token, 429 rate limit) is NOT
// status-normalised to 502 here. It's currently safe only because the sole
// caller, zohoCrm.getCrmCustomers, invokes this inside its own withSync() block,
// which catches and normalises. If you call getZohoAccessToken from anywhere
// outside a withSync() run(), wrap that call — otherwise the raw upstream 401
// leaks to the client and trips the frontend logout interceptor.
async function getZohoAccessToken() {
    // Reuse the cached token until it is within a minute of expiry.
    const safetyWindowMs = 60000;

    if (cached.token && Date.now() < cached.expiresAt - safetyWindowMs) {
        return cached.token;
    }

    const params = new URLSearchParams({
        refresh_token: env.zoho.refreshToken,
        client_id: env.zoho.clientId,
        client_secret: env.zoho.clientSecret,
        grant_type: 'refresh_token'
    });

    const url = env.zoho.accountsBase + '/oauth/v2/token';

    const data = await callExternal(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
    });

    if (!data.access_token) {
        throw new Error('Zoho token refresh failed — check ZOHO_* values in .env');
    }

    const expiresInSeconds = data.expires_in || 3600;

    cached = {
        token: data.access_token,
        expiresAt: Date.now() + (expiresInSeconds * 1000)
    };

    return cached.token;
}

// Invalidate the cache so the next getZohoAccessToken() forces a refresh. Call this
// when the CRM API rejects the cached token with a 401 (revoked/rotated early), so a
// dead token isn't reused for the rest of its nominal lifetime.
function clearZohoToken() {
    cached = { token: null, expiresAt: 0 };
}

module.exports = { getZohoAccessToken, clearZohoToken };