// Seeds the database with demo users, manufacturers, products, thresholds,
// and sample activity so the app is usable immediately after setup.
// Run with:  npm run db:seed   (from the backend folder)
// Safe to re-run: it skips seeding if users already exist.

const bcrypt = require('bcryptjs');
const { pool, query } = require('../src/config/db');

function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}

function targetIsLocal() {
    try {
        const host = new URL(process.env.DATABASE_URL || '').hostname;
        return host === 'localhost' || host === '127.0.0.1' || host === '::1';
    } catch {
        return false;
    }
}

async function seed() {
    // Demo accounts share a known password, so refuse anything but local dev.
    if (process.env.NODE_ENV === 'production' || !targetIsLocal()) {
        throw new Error(
            'Refusing to seed demo accounts (shared password) against a remote/production database. ' +
            'Use "npm run db:seed:admin" (AUTO_SEED=admin) instead — it creates a single admin with a random password.'
        );
    }

    const existing = await query('SELECT COUNT(*)::int AS n FROM users');
    if (existing.rows[0].n > 0) {
        console.log('Database already has users - skipping seed. (Delete and recreate the database to re-seed.)');
        return;
    }

    await query(
        `INSERT INTO users (email, password_hash, full_name, role) VALUES
         ('owner@evolveeradiance.com',     $1, 'Shontayvia (Owner)',    'admin'),
         ('dev@evolveeradiance.com',       $1, 'Mason (Developer)',     'developer'),
         ('ops@evolveeradiance.com',       $1, 'Operations Manager',    'ops_manager'),
         ('marketing@evolveeradiance.com', $1, 'Hill (Social Media)',   'marketing'),
         ('partner@evolveeradiance.com',   $1, 'Demo Partner',          'partner')`,
        [hashPassword('radiance123')]
    );

    const manufacturerResult = await query(
        `INSERT INTO manufacturers (name, country, notes, lead_time_days, min_order_quantity, payment_terms, quality_rating) VALUES
         ('Lumina Labs Ltd',    'United Kingdom', 'Primary serum and oil manufacturer. 4-6 week lead time.', 35,  250, 'Net 30',      5),
         ('PureForm Cosmetics', 'France',         'Creams and balms. Minimum order 500 units per SKU.',       42,  500, 'Net 45',      4),
         ('GlowPack Packaging', 'China',          'Bottles, jars, and outer packaging. 8 week lead time by sea.', 56, 1000, '50% deposit', 3)
         RETURNING id`
    );

    const [luminaId, pureformId, glowpackId] = manufacturerResult.rows.map((row) => row.id);

    const contacts = [
        [luminaId,   'Priya Shah',      'Account Manager',    'priya@luminalabs.example',  '+44 20 7946 0001'],
        [luminaId,   'Tom Reilly',      'Production Lead',    'tom@luminalabs.example',     '+44 20 7946 0002'],
        [pureformId, 'Camille Durand',  'Sales Director',     'camille@pureform.example',   '+33 1 7000 0003'],
        [glowpackId, 'Wei Chen',        'Export Coordinator', 'wei@glowpack.example',       '+86 21 0000 0004'],
    ];

    for (const contact of contacts) {
        await query(
            'INSERT INTO manufacturer_contacts (manufacturer_id, name, role, email, phone) VALUES ($1,$2,$3,$4,$5)',
            contact
        );
    }

    // ── Products (SKUs match the bundled Shopify sample data) ──
    // For the LIVE store (no SKUs), set products.shopify_inventory_item_id per
    // product so stock levels and reorder alerts match. The demo rows below leave
    // it NULL because sample mode joins by SKU.
    const productRows = [
        ['ER-SER-001', 'Radiance Renewal Serum 30ml', luminaId,   12.00],
        ['ER-OIL-002', 'Golden Glow Face Oil 25ml',   luminaId,   10.00],
        ['ER-CRM-003', 'Hydra-Silk Day Cream 50ml',   pureformId, 11.00],
        ['ER-CRM-004', 'Night Repair Cream 50ml',      pureformId, 14.00],
        ['ER-BLM-005', 'Soothing Lip Balm 10ml',       pureformId, 3.00],
        ['ER-MSK-006', 'Clay Detox Mask 75ml',         luminaId,   9.00],
        ['ER-TNR-007', 'Rosewater Toner 100ml',        luminaId,   6.00],
        ['ER-KIT-008', 'Starter Ritual Kit',           glowpackId, 32.00],
    ];

    const productIds = {};

    for (const [sku, name, manufacturerId, unitCost] of productRows) {
        const result = await query(
            'INSERT INTO products (sku, name, manufacturer_id, unit_cost) VALUES ($1,$2,$3,$4) RETURNING id',
            [sku, name, manufacturerId, unitCost]
        );
        productIds[sku] = result.rows[0].id;
    }

    // ── Reorder thresholds ──
    const thresholds = {
        'ER-SER-001': 50,
        'ER-OIL-002': 40,
        'ER-CRM-003': 60,
        'ER-CRM-004': 40,
        'ER-BLM-005': 100,
        'ER-MSK-006': 30,
        'ER-TNR-007': 50,
        'ER-KIT-008': 20,
    };

    for (const [sku, threshold] of Object.entries(thresholds)) {
        await query(
            'INSERT INTO reorder_thresholds (product_id, threshold) VALUES ($1,$2)',
            [productIds[sku], threshold]
        );
    }

    // ── Sample reorder history, communications, production runs ──
    await query(
        `INSERT INTO reorder_history (product_id, manufacturer_id, quantity_ordered, ordered_at, notes) VALUES
         ($1, $2, 1000, CURRENT_DATE - 45, 'Spring restock'),
         ($3, $4, 500,  CURRENT_DATE - 30, 'Initial PO for new cream line')`,
        [productIds['ER-SER-001'], luminaId, productIds['ER-CRM-003'], pureformId]
    );

    await query(
        `INSERT INTO communications (manufacturer_id, channel, summary) VALUES
         ($1, 'email', 'Confirmed June production slot for serum batch #14.'),
         ($2, 'phone', 'Discussed MOQ reduction for lip balm — awaiting written confirmation.')`,
        [luminaId, pureformId]
    );

    await query(
        `INSERT INTO production_runs (manufacturer_id, product_id, quantity, status, expected_date, notes) VALUES
         ($1, $2, 1000, 'in_production', CURRENT_DATE + 21, 'Batch #14'),
         ($3, $4, 800,  'ordered',       CURRENT_DATE + 40, 'Awaiting deposit confirmation')`,
        [luminaId, productIds['ER-SER-001'], pureformId, productIds['ER-BLM-005']]
    );

    console.log('O: Seed complete.');
    console.log('  Logins (password for all: radiance123):');
    console.log('    owner@evolveeradiance.com      (admin — sees everything)');
    console.log('    dev@evolveeradiance.com        (developer)');
    console.log('    ops@evolveeradiance.com        (ops manager)');
    console.log('    marketing@evolveeradiance.com  (marketing)');
    console.log('    partner@evolveeradiance.com    (partner)');
    console.log('  !!! Change these passwords before giving anyone real access.');
}

if (require.main === module) {
    seed()
        .catch((err) => {
            console.error('✗ Seed failed:', err.message);
            process.exitCode = 1;
        })
        .finally(() => {
            pool.end();
        });
}

module.exports = { seed };