const fs = require('fs');
const path = require('path');
const { pool, query } = require('../src/config/db');

// Runs schema.sql, which is written with IF NOT EXISTS / IF NOT EXISTS ADD COLUMN
// so it's safe to re-apply against an already-initialized database.
async function ensureSchema() {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await query(sql);
}

async function runAsScript() {
    try {
        await ensureSchema();
        console.log('O: Schema applied successfully.');
    } catch (err) {
        console.error('X: Failed to apply schema:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

// Only run automatically when invoked directly (e.g. `node applySchema.js`), not on require.
if (require.main === module) {
    runAsScript();
}

module.exports = { ensureSchema };