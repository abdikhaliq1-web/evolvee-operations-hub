const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { query } = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');
const { scheduleStockCheck, runStockCheck } = require('./jobs/stockCheck');
const { ensureSchema } = require('../db/applySchema');
const { seed } = require('../db/seed');
const { seedAdmin } = require('../db/seedAdmin');

const app = express();
app.set('trust proxy', 1);

// Checks incoming Origin header against the configured allowlist.
function isAllowedOrigin(origin, callback) {
    // No Origin header (same-origin or server-to-server): allow.
    if (!origin) {
        return callback(null, true);
    }
    const normalised = origin.replace(/\/+$/, '');
    const allowed = env.corsOrigins.includes(normalised);
    return callback(null, allowed);
}

app.use(cors({ origin: isAllowedOrigin }));
app.use(express.json());

// Basic security headers on every response.
app.use(function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (env.isProduction) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

app.get('/api/health', async function (req, res) {
    const health = { ok: true, time: new Date().toISOString() };

    try {
        const result = await query('SELECT ok FROM sync_status');
        health.degraded = result.rows.some(function (r) { return r.ok === false; });
    } catch (err) {
        health.ok = false;
        health.db_ok = false;
    }

    res.status(health.ok ? 200 : 503).json(health);
});

// Route mounts
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/manufacturers', require('./routes/manufacturers'));
app.use('/api/products', require('./routes/products'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/production-runs', require('./routes/productionRuns'));
app.use('/api/sync', require('./routes/sync'));
app.use('/api/audit', require('./routes/audit'));

app.use(function (req, res) {
    res.status(404).json({ error: 'No route: ' + req.method + ' ' + req.originalUrl });
});
app.use(errorHandler);

// Runs after listen() so a slow or failing DB doesn't block the server binding.
async function startBackgroundTasks() {
    try {
        await ensureSchema();
        console.log('Database schema ensured (tables present).');
    } catch (err) {
        console.error('Schema check failed on startup:', err.message);
    }

    if (env.autoSeed) {
        try {
            await (env.seedMode === 'admin' ? seedAdmin() : seed());
        } catch (err) {
            console.error('Auto-seed failed on startup:', err.message);
        }
    }

    scheduleStockCheck();

    runStockCheck().catch(function (err) {
        console.error('[stock-check] startup run failed:', err.message);
    });
}

// Last-resort logging so unexpected errors don't crash silently.
process.on('unhandledRejection', function (reason) {
    console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', function (err) {
    console.error('Uncaught exception:', err);
});

app.listen(env.port, function () {
    console.log('Operations Hub backend running on port ' + env.port);
    startBackgroundTasks();
});