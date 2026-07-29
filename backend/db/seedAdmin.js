const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// envVars param lets the --check self-test below pass in fake env without touching process.env.
function adminCreds(envVars) {
    const env = envVars || process.env;
    const provided = Boolean(env.ADMIN_PASSWORD);
    return {
        email: env.ADMIN_EMAIL || 'admin@evolveeradiance.com',
        fullName: env.ADMIN_NAME || 'Administrator',
        password: env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url'),
        generated: !provided,
    };
}

async function seedAdmin() {
    const { query } = require('../src/config/db');

    const existing = await query('SELECT COUNT(*)::int AS n FROM users');
    if (existing.rows[0].n > 0) {
        console.log('Database already has users - skipping admin seed. (Delete and recreate the database to re-seed.)');
        return;
    }

    const { email, fullName, password, generated } = adminCreds();
    await query(
        'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
        [email, bcrypt.hashSync(password, 10), fullName, 'admin']
    );

    console.log('O: Admin seed complete.');
    console.log('  Login: ' + email + '  (role: admin - sees everything)');
    if (generated) {
        console.log('  Generated password (shown ONCE): ' + password);
        console.log('  >>> Copy it now, then change it after first login.');
    } else {
        console.log('  Password: set from ADMIN_PASSWORD. Change it after first login.');
    }
}

if (require.main === module) {
    // --check runs a self-test of adminCreds() instead of actually seeding.
    if (process.argv.includes('--check')) {
        const assert = require('assert');
        const a = adminCreds({});
        assert.strictEqual(a.email, 'admin@evolveeradiance.com');
        assert.strictEqual(a.generated, true);
        assert.ok(a.password.length >= 12 && a.password !== 'radiance123', 'must generate a non-default password');
        const b = adminCreds({ ADMIN_EMAIL: 'me@x.com', ADMIN_PASSWORD: 'hunter2' });
        assert.strictEqual(b.email, 'me@x.com');
        assert.strictEqual(b.password, 'hunter2');
        assert.strictEqual(b.generated, false);
        console.log('seedAdmin self-check passed.');
    } else {
        const { pool } = require('../src/config/db');
        seedAdmin()
            .catch((err) => {
                console.error('✗ Admin seed failed:', err.message);
                process.exitCode = 1;
            })
            .finally(() => {
                pool.end();
            });
    }
}

module.exports = { seedAdmin, adminCreds };
