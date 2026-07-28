const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');

// who can access what: admin sees all, others get a limited set below

const ROLE_PERMISSIONS = {
    admin:       ['inventory', 'sales', 'customers', 'revenue', 'shipping', 'alerts', 'partners', 'manufacturers', 'users', 'sync'],
    developer:   ['inventory', 'sales', 'customers', 'revenue', 'shipping', 'alerts', 'partners', 'manufacturers', 'sync'],
    ops_manager: ['inventory', 'sales', 'customers', 'revenue', 'shipping', 'alerts', 'manufacturers', 'sync'],
    marketing:   ['sales', 'customers', 'partners'],
    partner:     ['partners'],
};

// pulls the token string out of an "Authorization: Bearer xxx" header
function extractBearerToken(authorizationHeader) {
    const match = /^Bearer +(.+)$/i.exec(authorizationHeader);
    return match ? match[1] : null;
}

// checks the jwt token, loads the user, and attaches req.user
async function authenticate(req, res, next) {
    const authorizationHeader = req.headers.authorization || '';
    const token = extractBearerToken(authorizationHeader);

    if (token === null) {
        return res.status(401).json({ error: 'Not logged in. Please sign in.' });
    }

    let payload;
    try {
        payload = jwt.verify(token, env.jwtSecret);
    } catch {
        return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    }

    try {
        const result = await query(
            'SELECT id, email, full_name, role, is_active, token_version FROM users WHERE id = $1',
            [payload.id]
        );
        const user = result.rows[0];

        // token_version mismatch means the token was issued before a password reset/deactivation.
        if (!user || !user.is_active || (payload.token_version || 0) !== user.token_version) {
            return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
        }

        req.user = { id: user.id, email: user.email, role: user.role, name: user.full_name };
        next();
    } catch (err) {
        next(err);
    }
}

// Usage: router.get('/route', authenticate, requirePermission('inventory'), handler)
function requirePermission(moduleKey) {
    function checkPermission(req, res, next) {
        const userRole = req.user ? req.user.role : null;
        const allowedModules = ROLE_PERMISSIONS[userRole] || [];

        if (!allowedModules.includes(moduleKey)) {
            return res.status(403).json({ error: `Your role (${userRole}) does not have access to this module.` });
        }

        next();
    }

    return checkPermission;
}

module.exports = { authenticate, requirePermission, ROLE_PERMISSIONS };