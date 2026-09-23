const path = require('path');

// DB_MODE: 'local' (default) | 'turso' — decide DÓNDE ESCRIBE EL CRUD.
// TURSO_URL/TURSO_AUTH_TOKEN NO deciden el destino del CRUD; los usa cloudClient para el sync.
const LOCAL_DB_PATH = process.env.LOCAL_DB_PATH || process.env.DB_PATH || path.join(__dirname, '..', 'clinica.db');

let _client = null;
let _clientMode = null;
let _isTurso = false;

function resolveMode() {
  const raw = (process.env.DB_MODE || 'local').trim().toLowerCase();
  return raw === 'turso' ? 'turso' : 'local';
}

function getClient() {
  const mode = resolveMode();
  if (_client && _clientMode === mode) return _client;

  _clientMode = mode;
  if (mode === 'turso') {
    _client = require('./cloudClient');
    _isTurso = true;
    console.log('[DB] Modo: Turso (DB_MODE=turso) via cloudClient');
  } else {
    _client = require('./database');
    _isTurso = false;
    console.log('[DB] Modo: SQLite local (DB_MODE=local) via database.js');
  }

  return _client;
}

function prepare(sql) {
  return {
    get(...args) {
      const client = getClient();
      if (_isTurso) {
        return client.execute({ sql, args }).then(r => r.rows[0] || null);
      }
      return Promise.resolve(client.prepare(sql).get(...args));
    },
    all(...args) {
      const client = getClient();
      if (_isTurso) {
        return client.execute({ sql, args }).then(r => r.rows);
      }
      return Promise.resolve(client.prepare(sql).all(...args));
    },
    run(...args) {
      const client = getClient();
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

function isTurso() {
  return resolveMode() === 'turso';
}

module.exports = { prepare, exec, getClient, isTurso, execute, resolveMode };
