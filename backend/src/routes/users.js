const express = require('express');
const bcrypt = require('bcryptjs');
const { query, pool } = require('../config/db');
const { authenticate, requirePermission, requireWrite, ROLE_PERMISSIONS } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const { validateId } = require('../middleware/validateId');
const { passwordProblem } = require('../middleware/passwordPolicy');
const { recordAudit } = require('../services/audit');

const router = express.Router();

router.use(authenticate, requirePermission('users'), requireWrite('users'));
router.param('id', validateId);

const ROLES = Object.keys(ROLE_PERMISSIONS);

// Changing someone's role, password, or active state is a full account takeover in one
// request, so a stolen admin token alone must not be enough — re-prompt for the acting
// admin's own password.
async function reauthenticated(req) {
    const supplied = req.body ? req.body.admin_password : undefined;

    if (!supplied) {
        return false;
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const actor = result.rows[0];

    if (!actor) {
        return false;
    }

    return bcrypt.compare(String(supplied), actor.password_hash);
}

router.get('/', asyncRoute(async (req, res) => {
    const sql = 'SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY id';
    const result = await query(sql);

    res.json({ users: result.rows });
}));

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

    const normalisedEmail = email.toLowerCase().trim();
    const problem = passwordProblem(password, normalisedEmail);

    if (problem) {
        return res.status(400).json({ error: problem });
    }

    const hash = await bcrypt.hash(String(password), 10);

    const sql =
        'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) ' +
        'ON CONFLICT (email) DO NOTHING ' +
        'RETURNING id, email, full_name, role';

    const result = await query(sql, [normalisedEmail, hash, fullName, role]);

    if (!result.rows[0]) {
        return res.status(409).json({ error: 'A user with that email already exists.' });
    }

    await recordAudit(req, {
        action: 'create', entity: 'user', entityId: result.rows[0].id,
        details: { email: normalisedEmail, role: role },
    });

    res.status(201).json({ user: result.rows[0] });
}));

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

    if (password !== undefined) {
        const problem = passwordProblem(password, email === undefined ? current.email : email);
        if (problem) {
            return res.status(400).json({ error: problem });
        }
    }

    const sensitive = password !== undefined || role !== undefined || isActive !== undefined;

    if (sensitive && !(await reauthenticated(req))) {
        return res.status(403).json({
            error: 'Confirm your own password to change a role, password, or account status.'
        });
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
        set.push(`password_hash = $${i++}`); values.push(await bcrypt.hash(String(password), 10));
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

    if (set.length > 0) {
        const changed = {};
        if (fullName !== undefined) changed.full_name = fullName;
        if (email !== undefined) changed.email = updated.rows[0].email;
        if (role !== undefined) changed.role = { from: current.role, to: role };
        if (isActive !== undefined) changed.is_active = { from: current.is_active, to: Boolean(isActive) };
        if (password !== undefined) changed.password_reset = true;

        await recordAudit(req, { action: 'update', entity: 'user', entityId: id, details: changed });
    }

    res.json({ user: updated.rows[0] });
}));

module.exports = router;