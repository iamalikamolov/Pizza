// PostgreSQL ulanishi (Neon)
const { Pool } = require('pg');
const config = require('../config/default');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000, // Neon bepul tarifda baza uyg'onishi 10–20 soniya olishi mumkin
});

pool.on('error', (err) => {
  logger.error('PostgreSQL pool xatosi', err);
});

async function query(text, params) {
  const started = Date.now();
  try {
    const result = await pool.query(text, params);
    logger.debug(`SQL ${Date.now() - started}ms: ${text.split('\n')[0].trim()}`);
    return result;
  } catch (err) {
    logger.error(`SQL xatosi: ${text.split('\n')[0].trim()}`, err);
    throw err;
  }
}

async function checkConnection() {
  const { rows } = await pool.query('SELECT NOW() AS now');
  return rows[0].now;
}

async function close() {
  await pool.end();
}

module.exports = { pool, query, checkConnection, close };
