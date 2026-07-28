require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// Reads an env var, or throws if it's missing and there's no fallback.
function required(name, fallback) {
    const value = process.env[name] ?? fallback;

    if (value === undefined || value === '') {
        throw new Error('Missing required environment variable: ' + name + '. Check your backend/.env file.');
    }
    return value;
}

// checks if a db connection string points at localhost
function hostIsLocal(connectionString) {
    try {
        const host = new URL(connectionString).hostname;
        return host === 'localhost' || host === '127.0.0.1' || host === '::1';
    } catch {
        return false;
    }
}

// Require a strong JWT secret whenever this isn't a purely local/dev setup.
const anyLiveMode = ['SHOPIFY_MODE', 'ZOHO_CRM_MODE'].some((key) => (process.env[key] || '').toLowerCase() === 'live');
const remoteDatabase = !hostIsLocal(process.env.DATABASE_URL || '');
const enforceStrongSecret = isProduction || anyLiveMode || remoteDatabase;

function requiredJwtSecret() {
    const value = required('JWT_SECRET');
    const placeholders = [
        'changeme',
        'change-me',
        'secret',
        'your-secret',
        'change-me-to-a-long-random-string'
    ];

    if (enforceStrongSecret) {
        const tooShort = value.length < 32;
        const isPlaceholder = placeholders.includes(value.toLowerCase());
        if (tooShort || isPlaceholder) {
            throw new Error(
                'JWT_SECRET is too weak for a live/remote deployment. Use a long random string of 32+ characters. ' +
                'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
            );
        }
    }
    return value;
}

// splits CORS_ORIGIN env var into a clean list of allowed origins
function parseCorsOrigins() {
    let raw = process.env.CORS_ORIGIN;
    if (!raw) {
        raw = 'http://localhost:5173';
    }

    return raw
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter((origin) => origin.length > 0);
}

function envOr(name, fallback) {
    return process.env[name] || fallback;
}

const port = parseInt(process.env.PORT || '4000', 10);

// AUTO_SEED=true means 'demo'; 'admin' seeds a single admin instead.
const seedModeRaw = (process.env.AUTO_SEED || 'false').toLowerCase();
const seedMode = seedModeRaw === 'true' ? 'demo' : seedModeRaw;
const autoSeed = seedMode === 'demo' || seedMode === 'admin';

const env = {
    port: port,
    isProduction: isProduction,
    databaseUrl: required('DATABASE_URL'),
    databaseSsl: envOr('DATABASE_SSL', ''),
    databaseCaCert: envOr('DATABASE_CA_CERT', ''),
    jwtSecret: requiredJwtSecret(),
    jwtExpiresIn: envOr('JWT_EXPIRES_IN', '8h'),
    corsOrigins: parseCorsOrigins(),
    autoSeed: autoSeed,
    seedMode: seedMode,
    stockCheckCron: envOr('STOCK_CHECK_CRON', '0 * * * *'),

    modes: {
        shopify: envOr('SHOPIFY_MODE', 'off'),
        zohoCrm: envOr('ZOHO_CRM_MODE', 'off'),
        partnerDashboard: envOr('PARTNER_DASHBOARD_MODE', 'off')
    },

    shopify: {
        storeDomain: envOr('SHOPIFY_STORE_DOMAIN', ''),
        adminToken: envOr('SHOPIFY_ADMIN_TOKEN', ''),
        apiVersion: envOr('SHOPIFY_API_VERSION', '2025-04')
    },

    zoho: {
        clientId: envOr('ZOHO_CLIENT_ID', ''),
        clientSecret: envOr('ZOHO_CLIENT_SECRET', ''),
        refreshToken: envOr('ZOHO_REFRESH_TOKEN', ''),
        accountsBase: envOr('ZOHO_ACCOUNTS_BASE', 'https://accounts.zoho.com'),
        apiBase: envOr('ZOHO_API_BASE', 'https://www.zohoapis.com')
    },

    partnerDashboard: {
        baseUrl: envOr('PARTNER_DASHBOARD_BASE_URL', ''),
        apiKey: envOr('PARTNER_DASHBOARD_API_KEY', '')
    }
};

module.exports = env;