const { Pool, types } = require('pg');
const env = require('./env');

// keep DATE columns as plain strings, avoids timezone shifting
types.setTypeParser(1082, (value) => value);

// checks if a db connection string points at localhost
function isLocalhost(connectionString) {
  try {
    const host = new URL(connectionString).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

// works out the ssl settings for the db connection
function databaseSsl() {
  const override = (env.databaseSsl || '').trim().toLowerCase();

  if (override === 'false') {
    return false;
  }

  // Default to no SSL for local dev unless explicitly overridden.
  if (override !== 'true' && override !== 'no-verify' && isLocalhost(env.databaseUrl)) {
    return false;
  }

  const ca = (env.databaseCaCert || '').replace(/\\n/g, '\n').trim();

  if (ca) {
    return {
      rejectUnauthorized: true,
      ca,
    };
  }

  if (override === 'no-verify') {
    return { rejectUnauthorized: false };
  }

  // No CA and no explicit override: refuse an unverified connection in production.
  if (env.isProduction) {
    throw new Error(
      'Refusing an unverified database TLS connection in production. ' +
      'Set DATABASE_CA_CERT to the server CA to verify it, or DATABASE_SSL=no-verify to explicitly allow an unverified connection.'
    );
  }

  return {
    rejectUnauthorized: false,
  };
}

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: databaseSsl(),
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};