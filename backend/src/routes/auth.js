const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const env = require('../config/env');
const { authenticate, ROLE_PERMISSIONS } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');

const router = express.Router();

// Only admin/developer get the full permission map exposed to the client.
function permissionMapFor(role) {
    return role === 'admin' || role === 'developer' ? ROLE_PERMISSIONS : undefined;
}

// Used to keep compare timing consistent when the user isn't found, to avoid leaking existence via timing.
const DUMMY_HASH = bcrypt.hashSync('unused-timing-equaliser', 10);

// In-memory login attempt tracker, keyed by ip/email combos.
const loginAttempts = new Map();

function overLimit(key, now, windowMs, max) {
    const rec = loginAttempts.get(key);

    if (!rec || now - rec.start > windowMs) {
        loginAttempts.set(key, { start: now, count: 1 });
        return false;
    }

    rec.count += 1;
    return rec.count > max;
}

function rateLimit(req, res, next) {
    const windowMs = 15 * 60 * 1000;
    const now = Date.now();

    // Prevent unbounded growth of the map by sweeping stale entries.
    if (loginAttempts.size > 5000) {
        for (const [k, v] of loginAttempts) {
            if (now - v.start > windowMs) {
                loginAttempts.delete(k);
            }
        }
    }

    const email = req.body && req.body.email ? String(req.body.email).toLowerCase().trim() : '';
    const perEmail = overLimit(req.ip + '|' + email, now, windowMs, 10);
    const perIp = overLimit('ip|' + req.ip, now, windowMs, 50);

    if (perEmail || perIp) {
        return res.status(429).json({ error: 'Too many attempts. Please wait and try again.' });
    }

    next();
}

router.post('/login', rateLimit, asyncRoute(async (req, res) => {
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
        bcrypt.compareSync(password, DUMMY_HASH);
        return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const passwordMatches = bcrypt.compareSync(password, user.password_hash);

    if (!passwordMatches) {
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
    const permissions = ROLE_PERMISSIONS[user.role] || [];

    res.json({
        token: token,
        user: {
            id: user.id,
            email: user.email,
            name: user.full_name,
            role: user.role,
            permissions: permissions,
            role_permissions: permissionMapFor(user.role)
        }
    });
}));

router.get('/me', authenticate, (req, res) => {
    const permissions = ROLE_PERMISSIONS[req.user.role] || [];

    const user = {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        permissions: permissions,
        role_permissions: permissionMapFor(req.user.role)
    };

    res.json({ user: user });
});

router.post('/password', rateLimit, authenticate, asyncRoute(async (req, res) => {
    const body = req.body || {};
    const currentPassword = body.current_password;
    const newPassword = body.new_password;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (String(newPassword).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    if (!user) {
        return res.status(404).json({ error: 'User not found.' });
    }

    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    // Bumping token_version invalidates any previously issued tokens.
    const newHash = bcrypt.hashSync(newPassword, 10);
    const updated = await query(
        'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2 ' +
        'RETURNING id, email, role, full_name, token_version',
        [newHash, req.user.id]
    );
    const u = updated.rows[0];

    const token = jwt.sign(
        { id: u.id, email: u.email, role: u.role, name: u.full_name, token_version: u.token_version },
        env.jwtSecret,
        { expiresIn: env.jwtExpiresIn }
    );

    res.json({ ok: true, token: token });
}));

// Quick self-check for the rate limiter logic, run only when this file is executed directly.
if (require.main === module) {
    const assert = require('assert');
    const now = Date.now();
    const w = 1000;
    for (let i = 0; i < 50; i++) {
        assert.strictEqual(overLimit('ip|x', now, w, 50), false);
    }
    assert.strictEqual(overLimit('ip|x', now, w, 50), true);
    console.log('rateLimit self-check passed.');
}

module.exports = router;