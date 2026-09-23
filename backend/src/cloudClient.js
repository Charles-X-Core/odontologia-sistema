/**
 * Cloud Client — acceso remoto a Turso (exclusivo del sync)
 *
 * Separación C1:
 * - db.js + DB_MODE      → ¿dónde escribe el CRUD?
 * - cloudClient + TURSO_URL → ¿a qué nube se conecta el sync?
 *
 * No depende de db.js. isConfigured() es puro (solo lee env, no ejecuta queries).
 * execute() acepta string o { sql, args } (compat con el uso actual de db.execute
 * y con el cliente libsql subyacente).
 */

let _client = null;

function isConfigured() {
  return !!process.env.TURSO_URL;
}

function getClient() {
  if (_client) return _client;

  const TURSO_URL = process.env.TURSO_URL;
  if (!TURSO_URL) {
    const err = new Error('Cloud no configurado: falta TURSO_URL');
    err.code = 'CLOUD_NOT_CONFIGURED';
    throw err;
  }

  const { createClient } = require('@libsql/client');
  _client = createClient({
    url: TURSO_URL,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });
  return _client;
}

async function execute(stmt) {
  const client = getClient();
  const result = await client.execute(stmt);
  return {
    rows: result.rows,
    rowsAffected: result.rowsAffected,
    lastInsertRowid: Number(result.lastInsertRowid),
  };
}

module.exports = { isConfigured, execute, getClient };
