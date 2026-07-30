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

// Only trust X-Forwarded-For when something is actually in front of us. Trusting it
// unconditionally lets any client spoof req.ip and walk straight past the rate limits.
if (env.trustProxy > 0) {
    app.set('trust proxy', env.trustProxy);
}

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

// credentials:true is required for the session cookie to travel cross-site. It only
// applies to origins isAllowedOrigin approves — a rejected origin gets no CORS headers
// at all, so the browser blocks the response before any cookie is read.
app.use(cors({ origin: isAllowedOrigin, credentials: true, allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'] }));
app.use(express.json({ limit: '100kb' }));

// Basic security headers on every response.
app.use(function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    // This API only ever returns JSON, so nothing it serves should load or run anything.
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    if (env.isProduction) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

// Unauthenticated: reports liveness only. Which integrations are failing is in
// /api/sync/status, behind auth.
app.get('/api/health', async function (req, res) {
    const health = { ok: true, time: new Date().toISOString() };

    try {
        await query('SELECT 1');
    } catch (err) {
        health.ok = false;
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

// After an uncaught exception the process state is unknown — serving further requests
// from it risks acting on corrupt state. Log, then let the platform restart us.
process.on('uncaughtException', function (err) {
    console.error('Uncaught exception:', err);
    server.close(function () { process.exit(1); });
    setTimeout(function () { process.exit(1); }, 5000).unref();
});

const server = app.listen(env.port, function () {
    console.log('Operations Hub backend running on port ' + env.port);
    startBackgroundTasks();
});