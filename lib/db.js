const path = require('path');

const USE_TURSO = !!process.env.TURSO_DATABASE_URL;
let _db = null;
let _client = null;

function getMonthStart(monthsBack) {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  d.setDate(1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

function nowLocal() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

// === Turso (libsql) async wrapper ===
async function initTurso() {
  if (_client) return _client;
  const { createClient } = require('@libsql/client');
  _client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  // Create tables
  await _client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT '其他',
      stock REAL DEFAULT 0,
      unit TEXT DEFAULT '個',
      min_stock REAL DEFAULT 0,
      unit_price REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      amount REAL NOT NULL DEFAULT 0,
      category TEXT DEFAULT '其他',
      description TEXT DEFAULT '',
      tx_date TEXT DEFAULT (datetime('now','localtime')),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_inv_name ON inventory(name);
    CREATE INDEX IF NOT EXISTS idx_inv_category ON inventory(category);
    CREATE INDEX IF NOT EXISTS idx_cust_name ON customers(name);
    CREATE INDEX IF NOT EXISTS idx_cust_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(tx_date);
    CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category);
  `);
  return _client;
}

// === better-sqlite3 sync wrapper ===
function initLocal() {
  if (_db) return _db;
  const Database = require('better-sqlite3');
  _db = new Database(path.join(__dirname, '..', 'data.db'));
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT '其他',
      stock REAL DEFAULT 0,
      unit TEXT DEFAULT '個',
      min_stock REAL DEFAULT 0,
      unit_price REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      amount REAL NOT NULL DEFAULT 0,
      category TEXT DEFAULT '其他',
      description TEXT DEFAULT '',
      tx_date TEXT DEFAULT (datetime('now','localtime')),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_inv_name ON inventory(name);
    CREATE INDEX IF NOT EXISTS idx_inv_category ON inventory(category);
    CREATE INDEX IF NOT EXISTS idx_cust_name ON customers(name);
    CREATE INDEX IF NOT EXISTS idx_cust_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(tx_date);
    CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category);
  `);
  return _db;
}

// === Unified query interface ===
// Returns: { rows, columns } for SELECT, { lastInsertRowid, changes } for INSERT/UPDATE/DELETE

async function query(sql, params = []) {
  if (USE_TURSO) {
    const client = await initTurso();
    const rs = await client.execute({ sql, args: params });
    return {
      rows: rs.rows.map(r => {
        const obj = {};
        rs.columns.forEach((col, i) => { obj[col] = r[i]; });
        return obj;
      }),
      lastInsertRowid: rs.lastInsertRowid,
      changes: rs.changes,
    };
  } else {
    const db = initLocal();
    const stmt = db.prepare(sql);
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('PRAGMA')) {
      const rows = stmt.all(...params);
      return { rows, lastInsertRowid: 0, changes: rows.length };
    } else {
      const info = stmt.run(...params);
      return { rows: [], lastInsertRowid: Number(info.lastInsertRowid), changes: info.changes };
    }
  }
}

async function queryOne(sql, params = []) {
  const result = await query(sql, params);
  return result.rows[0] || null;
}

module.exports = { query, queryOne, getMonthStart, nowLocal, USE_TURSO, initLocal, initTurso };
