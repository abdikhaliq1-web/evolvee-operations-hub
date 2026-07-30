const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');
const { sessionToken, csrfOk } = require('./session');

// Permission model:
//   admin        - everything, including user management
//   developer    - everything except user management
//   ops_manager  - operations modules + manufacturer tool (revenue visibility is included by default)
//   marketing    - sales, customers, partner module
//   partner      - partner module only
//
// Access has two axes. ROLE_PERMISSIONS says which modules a role can SEE;
// WRITE_PERMISSIONS says which of those it can CHANGE. Being able to open a module
// no longer implies being able to modify it, so a read-only role is a matter of
// listing the module in the first map and not the second.

const ROLE_PERMISSIONS = {
    admin:       ['inventory', 'sales', 'customers', 'revenue', 'shipping', 'alerts', 'partners', 'manufacturers', 'users', 'sync'],
    developer:   ['inventory', 'sales', 'customers', 'revenue', 'shipping', 'alerts', 'partners', 'manufacturers', 'sync'],
    ops_manager: ['inventory', 'sales', 'customers', 'revenue', 'shipping', 'alerts', 'manufacturers', 'sync'],
    marketing:   ['sales', 'customers', 'partners'],
    partner:     ['partners'],
};

// Must be a subset of the same role's ROLE_PERMISSIONS entry — checked at startup below.
// The current values preserve existing behaviour: every role that could already write
// still can. Removing a module here is all it takes to make that role read-only.
const WRITE_PERMISSIONS = {
    admin:       ['alerts', 'manufacturers', 'users', 'sync'],
    developer:   ['alerts', 'manufacturers', 'sync'],
    ops_manager: ['alerts', 'manufacturers', 'sync'],
    marketing:   [],
    partner:     [],
};

// A role granted write on a module it cannot even read is a misconfiguration that would
// silently produce a confusing 403 later, so fail loudly at boot instead.
for (const role of Object.keys(WRITE_PERMISSIONS)) {
    const readable = ROLE_PERMISSIONS[role] || [];
    const stray = WRITE_PERMISSIONS[role].filter((mod) => !readable.includes(mod));

    if (stray.length > 0) {
        throw new Error(`Role "${role}" has write access without read access to: ${stray.join(', ')}`);
    }
}

// Deleting an alert destroys the record that a stock problem ever happened, which is a
// different kind of act from acknowledging or resolving one. Kept narrower than the
// alerts write grant on purpose.
const ALERT_DELETE_ROLES = ['admin', 'developer'];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

async function authenticate(req, res, next) {
    // The httpOnly session cookie is the normal path; Bearer is kept for scripts and
    // server-to-server callers, which browsers never send automatically.
    const { token, via } = sessionToken(req);

    if (!token) {
        return res.status(401).json({ error: 'Not logged in. Please sign in.' });
    }

    req.authVia = via;

    if (!csrfOk(req)) {
        return res.status(403).json({ error: 'Request could not be verified. Refresh the page and try again.' });
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
        req.tokenExp = payload.exp;
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

// Mounted once per router next to requirePermission, so it covers every current and
// future mutating route on that router rather than relying on each one to opt in.
// Usage: router.use(authenticate, requirePermission('alerts'), requireWrite('alerts'))
function requireWrite(moduleKey) {
    function checkWrite(req, res, next) {
        if (SAFE_METHODS.has(req.method)) {
            return next();
        }

        const userRole = req.user ? req.user.role : null;
        const writable = WRITE_PERMISSIONS[userRole] || [];

        if (!writable.includes(moduleKey)) {
            return res.status(403).json({ error: `Your role (${userRole}) has read-only access to this module.` });
        }

        next();
    }

    return checkWrite;
}

// For the few actions that destroy history rather than change state, where module-level
// write access is too blunt a grant.
// Usage: router.delete('/:id', requireRole('admin', 'developer'), handler)
function requireRole() {
    const allowed = new Set(Array.from(arguments));

    function checkRole(req, res, next) {
        const userRole = req.user ? req.user.role : null;

        if (!allowed.has(userRole)) {
            return res.status(403).json({
                error: `Your role (${userRole}) cannot perform this action. It is restricted to: ${Array.from(allowed).join(', ')}.`
            });
        }

        next();
    }

    return checkRole;
}

if (require.main === module) {
    const assert = require('assert');

    const run = (middleware, req) => {
        let status = 0;
        let body = null;
        const res = { status(s) { status = s; return this; }, json(b) { body = b; return this; } };
        middleware(req, res, () => { status = 200; });
        return { status, body };
    };

    const write = requireWrite('manufacturers');

    assert.strictEqual(run(write, { method: 'POST', user: { role: 'admin' } }).status, 200);
    assert.strictEqual(run(write, { method: 'POST', user: { role: 'ops_manager' } }).status, 200);
    assert.strictEqual(run(write, { method: 'DELETE', user: { role: 'developer' } }).status, 200);

    assert.strictEqual(run(write, { method: 'POST', user: { role: 'marketing' } }).status, 403);
    assert.strictEqual(run(write, { method: 'PATCH', user: { role: 'partner' } }).status, 403);
    assert.strictEqual(run(write, { method: 'PUT', user: { role: 'marketing' } }).status, 403);
    assert.strictEqual(run(write, { method: 'POST', user: null }).status, 403);
    assert.match(run(write, { method: 'POST', user: { role: 'marketing' } }).body.error, /read-only/);

    // Reads must stay open to anyone requirePermission already let through.
    assert.strictEqual(run(write, { method: 'GET', user: { role: 'marketing' } }).status, 200);
    assert.strictEqual(run(write, { method: 'HEAD', user: { role: 'partner' } }).status, 200);

    // A role holding the module for reading but not writing is genuinely read-only.
    const readOnlyRole = 'auditor';
    ROLE_PERMISSIONS[readOnlyRole] = ['manufacturers', 'alerts'];
    WRITE_PERMISSIONS[readOnlyRole] = [];
    assert.strictEqual(run(requirePermission('manufacturers'), { method: 'GET', user: { role: readOnlyRole } }).status, 200);
    assert.strictEqual(run(write, { method: 'GET', user: { role: readOnlyRole } }).status, 200);
    assert.strictEqual(run(write, { method: 'POST', user: { role: readOnlyRole } }).status, 403);
    delete ROLE_PERMISSIONS[readOnlyRole];
    delete WRITE_PERMISSIONS[readOnlyRole];

    // Every write grant must be backed by a read grant.
    for (const role of Object.keys(WRITE_PERMISSIONS)) {
        for (const mod of WRITE_PERMISSIONS[role]) {
            assert.ok(ROLE_PERMISSIONS[role].includes(mod), `${role} writes ${mod} without reading it`);
        }
    }

    // Destructive actions are narrower than module write access: ops_manager can change
    // alerts but must not be able to destroy them.
    const destructive = requireRole('admin', 'developer');

    assert.strictEqual(run(destructive, { method: 'DELETE', user: { role: 'admin' } }).status, 200);
    assert.strictEqual(run(destructive, { method: 'DELETE', user: { role: 'developer' } }).status, 200);
    assert.strictEqual(run(destructive, { method: 'DELETE', user: { role: 'ops_manager' } }).status, 403);
    assert.strictEqual(run(destructive, { method: 'DELETE', user: { role: 'marketing' } }).status, 403);
    assert.strictEqual(run(destructive, { method: 'DELETE', user: null }).status, 403);
    assert.match(run(destructive, { method: 'DELETE', user: { role: 'ops_manager' } }).body.error, /admin, developer/);

    // ops_manager keeps ordinary alert write access — only the delete is withheld.
    assert.strictEqual(run(requireWrite('alerts'), { method: 'PATCH', user: { role: 'ops_manager' } }).status, 200);

    console.log('permission split self-check passed.');
}

module.exports = {
    authenticate,
    requirePermission,
    requireWrite,
    requireRole,
    ROLE_PERMISSIONS,
    WRITE_PERMISSIONS,
    ALERT_DELETE_ROLES,
};