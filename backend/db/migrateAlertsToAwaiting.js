const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function migrateAlertsToAwaiting() {
    const sql = fs.readFileSync(
        path.join(__dirname, 'migrate-alerts-to-awaiting.sql'),
        'utf8'
    );

    const client = await pool.connect();

    try {
        await client.query(sql);
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('X: Rollback failed:', rollbackError.message);
        }
        throw err;
    } finally {
        client.release();
    }
}

async function runAsScript() {
    try {
        await migrateAlertsToAwaiting();
        console.log('O: Alert migration completed successfully.');
    } catch (err) {
        console.error('X: Alert migration failed:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    runAsScript();
}