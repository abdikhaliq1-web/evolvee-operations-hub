const express = require('express');
const bcrypt = require('bcryptjs');
const { query, pool } = require('../config/db');
const { authenticate, requirePermission, ROLE_PERMISSIONS } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const { validateId } = require('../middleware/validateId');

const router = express.Router();

router.use(authenticate, requirePermission('users'));
router.param('id', validateId);

const ROLES = Object.keys(ROLE_PERMISSIONS);

// lists all users
router.get('/', asyncRoute(async (req, res) => {
    const sql = 'SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY id';
    const result = await query(sql);

    res.json({ users: result.rows });
}));

// creates a new user account
router.post('/', asyncRoute(async (req, res) => {
    let body = req.body;
    if (!body) {
        body = {};
    }
    const email = body.email;
    const password = body.password;
    const fullName = body.full_name;
    const role = body.role;

    if (!email || !password || !fullName || !ROLES.includes(role)) {
        const allowed = ROLES.join(', ');
        return res.status(400).json({
            error: 'email, password, full_name required; role must be one of: ' + allowed
        });
    }

    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const normalisedEmail = email.toLowerCase().trim();

    const sql =
        'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) ' +
        'ON CONFLICT (email) DO NOTHING ' +
        'RETURNING id, email, full_name, role';

    const result = await query(sql, [normalisedEmail, hash, fullName, role]);

    if (!result.rows[0]) {
        return res.status(409).json({ error: 'A user with that email already exists.' });
    }

    res.status(201).json({ user: result.rows[0] });
}));

// updates a user, blocks removing/deactivating the last active admin
router.patch('/:id', asyncRoute(async (req, res) => {
    const id = Number(req.params.id);

    const existingResult = await query(
        'SELECT id, email, full_name, role, is_active FROM users WHERE id = $1',
        [id]
    );
    const current = existingResult.rows[0];

    if (!current) {
        return res.status(404).json({ error: 'User not found.' });
    }

    let body = req.body;
    if (!body) {
        body = {};
    }
    const email = body.email;
    const fullName = body.full_name;
    const role = body.role;
    const isActive = body.is_active;
    const password = body.password;

    if (role !== undefined && !ROLES.includes(role)) {
        const allowed = ROLES.join(', ');
        return res.status(400).json({ error: 'role must be one of: ' + allowed });
    }

    if (password !== undefined && String(password).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    // Don't let the last active admin lose admin access.
    const removingAdminRole = role !== undefined && role !== 'admin' && current.role === 'admin';
    const deactivatingAdmin = isActive === false && current.role === 'admin' && current.is_active;
    const needsAdminGuard = removingAdminRole || deactivatingAdmin;

    if (isActive === false && id === req.user.id) {
        return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }

    // One atomic UPDATE for whichever fields were sent (no partial writes on mid-failure).
    const set = [];
    const values = [];
    let i = 1;

    if (fullName !== undefined) { set.push(`full_name = $${i++}`); values.push(fullName); }

    if (email !== undefined) {
        const normalisedEmail = String(email).toLowerCase().trim();
        const clash = await query(
            'SELECT 1 FROM users WHERE email = $1 AND id <> $2',
            [normalisedEmail, id]
        );
        if (clash.rows[0]) {
            return res.status(409).json({ error: 'Another user already has that email.' });
        }
        set.push(`email = $${i++}`); values.push(normalisedEmail);
    }

    if (role !== undefined) { set.push(`role = $${i++}`); values.push(role); }
    if (isActive !== undefined) { set.push(`is_active = $${i++}`); values.push(Boolean(isActive)); }
    if (password !== undefined) {
        set.push(`password_hash = $${i++}`); values.push(bcrypt.hashSync(password, 10));
        // Invalidate the target user's existing sessions when their password is reset.
        set.push('token_version = token_version + 1');
    }

    if (set.length > 0) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            if (needsAdminGuard) {
                await client.query("SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE FOR UPDATE");
                const admins = await client.query(
                    "SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND is_active = TRUE"
                );
                if (admins.rows[0].n <= 1) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'This is the last active admin — promote another admin first.' });
                }
            }

            values.push(id);
            await client.query(`UPDATE users SET ${set.join(', ')} WHERE id = $${i}`, values);
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    const updated = await query(
        'SELECT id, email, full_name, role, is_active FROM users WHERE id = $1',
        [id]
    );
    res.json({ user: updated.rows[0] });
}));

module.exports = router;