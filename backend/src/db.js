const path = require('path');

const TURSO_URL = process.env.TURSO_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
const LOCAL_DB_PATH = process.env.LOCAL_DB_PATH || process.env.DB_PATH || path.join(__dirname, '..', 'clinica.db');

let _client = null;
let _isTurso = false;

function getClient() {
  if (_client) return _client;

  if (TURSO_URL) {
    const { createClient } = require('@libsql/client');
    _client = createClient({
      url: TURSO_URL,
      authToken: TURSO_AUTH_TOKEN || undefined,
    });
    _isTurso = true;
    console.log('[DB] Modo: Turso (' + TURSO_URL + ')');
  } else {
    _client = require('./database');
    _isTurso = false;
    console.log('[DB] Modo: SQLite local (via database.js)');
  }

  return _client;
}

function prepare(sql) {
  const client = getClient();

  return {
    get(...args) {
      if (_isTurso) {
        return client.execute({ sql, args }).then(r => r.rows[0] || null);
      }
      return Promise.resolve(client.prepare(sql).get(...args));
    },
    all(...args) {
      if (_isTurso) {
        return client.execute({ sql, args }).then(r => r.rows);
      }
      return Promise.resolve(client.prepare(sql).all(...args));
    },
    run(...args) {
      if (_isTurso) {
        return client.execute({ sql, args }).then(r => ({
          changes: r.rowsAffected,
          lastInsertRowid: Number(r.lastInsertRowid),
        }));
      }
      return Promise.resolve(client.prepare(sql).run(...args));
    }
  };
}

function exec(sql) {
  const client = getClient();
  if (_isTurso) {
    return client.execute(sql);
  }
  return Promise.resolve(client.exec(sql));
}

async function execute({ sql, args = [] }) {
  const client = getClient();
  if (_isTurso) {
    const result = await client.execute({ sql, args });
    return {
      rows: result.rows,
      rowsAffected: result.rowsAffected,
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }
  const stmt = client.prepare(sql);
  const result = stmt.run(...args);
  return {
    rows: [],
    rowsAffected: result.changes,
    lastInsertRowid: Number(result.lastInsertRowid),
  };
}

module.exports = { prepare, exec, getClient, isTurso: () => _isTurso, execute };
