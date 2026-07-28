const env = require('../../config/env');
const { callExternal, withSync, cached } = require('../apiClient');
const { getZohoAccessToken, clearZohoToken } = require('./zohoAuth');
const sample = require('../sampleData/zohoCrm.json');

const MAX_CONTACT_PAGES = 100; // 100 * 200 = 20000 contacts; a safety ceiling, not a real limit.

// Page through all contacts. Zoho signals continuation via info.more_records; we also
// stop on an empty page and cap total pages so a malformed response can't loop forever.
async function fetchAllContacts(token) {
    const options = { headers: { Authorization: 'Zoho-oauthtoken ' + token } };
    const contacts = [];
    let complete = false;

    for (let page = 1; page <= MAX_CONTACT_PAGES; page++) {
        const url =
            env.zoho.apiBase + '/crm/v6/Contacts' +
            '?fields=Email,Lead_Source,Description' +
            '&per_page=200&page=' + page;
        const data = await callExternal(url, options);

        const batch = data.data || [];

        for (const c of batch) {
            contacts.push(c);
        }

        if (batch.length === 0 || !(data.info && data.info.more_records)) {
            complete = true;
            break;
        }
    }

    if (!complete) {
        console.warn('[zoho] contact pagination hit the %d-page cap; results may be truncated.', MAX_CONTACT_PAGES);
    }

    return contacts;
}

async function getCrmCustomers() {
    const mode = env.modes.zohoCrm;

    return withSync('zoho_crm', mode, async () => {
        if (mode === 'sample') {
            return sample.customers;
        }

        let contacts;
        try {
            contacts = await fetchAllContacts(await getZohoAccessToken());
        } catch (err) {
            // The cached token was revoked/rotated before its nominal expiry — refresh
            // once and retry, rather than failing for the token's remaining lifetime.
            if (err.status === 401) {
                clearZohoToken();
                contacts = await fetchAllContacts(await getZohoAccessToken());
            } else {
                throw err;
            }
        }

        const customers = [];

        for (const c of contacts) {
            customers.push({
                crm_id: c.id,
                email: c.Email,
                segment: c.Lead_Source || 'Unknown',
                lifetime_notes: c.Description || ''
            });
        }

        return customers;
    });
}

module.exports = { getCrmCustomers: () => cached('zoho_crm:getCrmCustomers', getCrmCustomers) };
