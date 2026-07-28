const env = require('../../config/env');
const { callExternal } = require('../apiClient');

let cached = { token: null, expiresAt: 0 };

// note: caller must wrap this in withSync so errors get normalized
// gets a valid zoho access token, refreshing it if expired or missing
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

// clears the cached token so the next call forces a fresh one
function clearZohoToken() {
    cached = { token: null, expiresAt: 0 };
}

module.exports = { getZohoAccessToken, clearZohoToken };