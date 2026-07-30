const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const env = require('../config/env');
const { authenticate, ROLE_PERMISSIONS, WRITE_PERMISSIONS, ALERT_DELETE_ROLES } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const { rateLimit } = require('../middleware/rateLimit');
const { passwordProblem } = require('../middleware/passwordPolicy');
const { issueSession, clearSession } = require('../middleware/session');
const { recordAudit } = require('../services/audit');

const router = express.Router();

// Only admin/developer get the full permission map exposed to the client.
function permissionMapFor(role) {
    return role === 'admin' || role === 'developer' ? ROLE_PERMISSIONS : undefined;
}

function writeMapFor(role) {
    return role === 'admin' || role === 'developer' ? WRITE_PERMISSIONS : undefined;
}

// What the client needs to render the UI. The server re-checks all of it on every
// request; this only decides which controls are worth showing.
function sessionUser(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: ROLE_PERMISSIONS[user.role] || [],
        writable: WRITE_PERMISSIONS[user.role] || [],
        role_permissions: permissionMapFor(user.role),
        role_writable: writeMapFor(user.role),
        // Sent rather than hardcoded client-side so the policy lives in one place.
        alert_delete_roles: ALERT_DELETE_ROLES,
    };
}

// Used to keep compare timing consistent when the user isn't found, to avoid leaking existence via timing.
const DUMMY_HASH = bcrypt.hashSync('unused-timing-equaliser', 10);

const WINDOW_MS = 15 * 60 * 1000;

function bodyEmail(req) {
    return req.body && req.body.email ? String(req.body.email).toLowerCase().trim() : null;
}

// The per-account rule is the one that matters: without it, an attacker rotating
// source IPs gets an unlimited number of guesses against a single account.
const loginRateLimit = rateLimit(
    [
        { name: 'login-ip-email', key: (req) => req.ip + '|' + bodyEmail(req), windowMs: WINDOW_MS, max: 10 },
        { name: 'login-email', key: bodyEmail, windowMs: WINDOW_MS, max: 20 },
        { name: 'login-ip', key: (req) => req.ip, windowMs: WINDOW_MS, max: 50 },
    ],
    'Too many attempts. Please wait and try again.'
);

const passwordRateLimit = rateLimit(
    [
        { name: 'pw-ip', key: (req) => req.ip, windowMs: WINDOW_MS, max: 20 },
    ],
    'Too many attempts. Please wait and try again.'
);

router.post('/login', loginRateLimit, asyncRoute(async (req, res) => {
    const body = req.body || {};
    const email = body.email;
    const password = body.password;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalisedEmail = email.toLowerCase().trim();
    const result = await query(
        'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
        [normalisedEmail]
    );

    // Same message for unknown email and wrong password.
    const user = result.rows[0];

    if (!user) {
        await bcrypt.compare(String(password), DUMMY_HASH);
        await recordAudit(req, {
            action: 'login_failed', entity: 'user', entityId: null,
            details: { email: normalisedEmail, reason: 'unknown_or_inactive' },
        });
        return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const passwordMatches = await bcrypt.compare(String(password), user.password_hash);

    if (!passwordMatches) {
        await recordAudit(req, {
            action: 'login_failed', entity: 'user', entityId: user.id,
            details: { email: normalisedEmail, reason: 'bad_password' },
        });
        return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.full_name,
        token_version: user.token_version
    };
    const tokenOptions = { expiresIn: env.jwtExpiresIn };
    const token = jwt.sign(tokenPayload, env.jwtSecret, tokenOptions);

    await recordAudit(
        { user: { id: user.id, name: user.full_name } },
        { action: 'login', entity: 'user', entityId: user.id, details: { email: user.email } }
    );

    // The JWT goes back as an httpOnly cookie, never in the body, so page scripts
    // cannot read it. The client gets the CSRF token and an expiry hint instead.
    const session = issueSession(res, token);

    res.json({
        csrf_token: session.csrf,
        expires_at: session.expiresAt,
        user: sessionUser({
            id: user.id,
            email: user.email,
            name: user.full_name,
            role: user.role,
        })
    });
}));

router.get('/me', authenticate, (req, res) => {
    const user = sessionUser(req.user);

    res.json({ user: user, expires_at: req.tokenExp });
});

// Clearing localStorage alone leaves a stolen token valid for the rest of its
// lifetime, so signing out has to invalidate it server-side too.
router.post('/logout', authenticate, asyncRoute(async (req, res) => {
    await query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [req.user.id]);
    clearSession(res);
    res.json({ ok: true });
}));

router.post('/password', passwordRateLimit, authenticate, asyncRoute(async (req, res) => {
    const body = req.body || {};
    const currentPassword = body.current_password;
    const newPassword = body.new_password;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password are required.' });
    }

    const problem = passwordProblem(newPassword, req.user.email);

    if (problem) {
        return res.status(400).json({ error: problem });
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    if (!(await bcrypt.compare(String(currentPassword), user.password_hash))) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    // Bumping token_version invalidates any previously issued tokens.
    const newHash = await bcrypt.hash(String(newPassword), 10);
    const updated = await query(
        'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2 ' +
        'RETURNING id, email, role, full_name, token_version',
        [newHash, req.user.id]
    );
    const u = updated.rows[0];

    await recordAudit(req, {
        action: 'password_change', entity: 'user', entityId: u.id, details: { email: u.email },
    });

    const token = jwt.sign(
        { id: u.id, email: u.email, role: u.role, name: u.full_name, token_version: u.token_version },
        env.jwtSecret,
        { expiresIn: env.jwtExpiresIn }
    );

    // The old token was just invalidated, so replace the cookie in place rather than
    // signing the user out of the session they are actively using.
    const session = issueSession(res, token);

    res.json({ ok: true, csrf_token: session.csrf, expires_at: session.expiresAt });
}));

module.exports = router;
