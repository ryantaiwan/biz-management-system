const path = require('path');

const USE_TURSO = !!process.env.TURSO_DATABASE_URL;
let _db = null;
let _tursoReady = false;

function getMonthStart(monthsBack) {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  d.setDate(1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

// === Turso v2 Pipeline HTTP API (pure JS, no native binary) ===
// POST /v2/pipeline
// Request: { "requests": [ {"type":"execute","stmt":{"sql":"...","args":[{"type":"text","value":"..."}]}}, {"type":"close"} ] }
// Response: { "results": [ {"cols":[...],"rows":[[...],...],"affected_row_count":N,"last_insert_rowid":N} ] }

function getTursoUrl() {
  let url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error('TURSO_DATABASE_URL not set');
  if (url.startsWith('libsql://')) url = 'https://' + url.substring(9);
  if (url.startsWith('http://')) url = 'https://' + url.substring(7);
  // Ensure trailing path for v2 pipeline
  if (!url.endsWith('/v2/pipeline')) {
    // Remove any trailing slash then add path
    url = url.replace(/\/$/, '') + '/v2/pipeline';
  }
  return url;
}

// Convert JS value to Turso typed arg
function toTursoArg(val) {
  if (val === null || val === undefined) {
    return { type: 'null' };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { type: 'integer', value: String(val) };
    }
    return { type: 'float', value: String(val) };
  }
  // string, or anything else -> text
  return { type: 'text', value: String(val) };
}

async function tursoHttp(sql, params = []) {
  const url = getTursoUrl();
  const requestBody = {
    requests: [
      {
        type: 'execute',
        stmt: {
          sql: sql,
          args: params.map(toTursoArg)
        }
      },
      { type: 'close' }
    ]
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TURSO_AUTH_TOKEN}`
      },
      body: JSON.stringify(requestBody)
    });
  } catch (fetchErr) {
    throw new Error(`Turso fetch failed: ${fetchErr.message} (url=${url})`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Turso HTTP ${res.status}: ${text.substring(0, 300)}`);
  }

  const data = await res.json();
  const results = data.results || [];
  const result = Array.isArray(results) ? results[0] : results;

  if (!result) {
    throw new Error('Turso: empty response');
  }

  // Check for error in result
  if (result.error) {
    throw new Error(`Turso SQL error: ${JSON.stringify(result.error)}`);
  }

  // SELECT: has cols and rows
  if (result.cols && Array.isArray(result.cols)) {
    const cols = result.cols;
    const rawRows = result.rows || [];
    const rows = rawRows.map(row => {
      const obj = {};
      cols.forEach((col, i) => {
        const val = row[i];
        // Turso v2 returns typed values {type:"text", value:"..."} or plain values
        if (val && typeof val === 'object' && 'value' in val) {
          if (val.type === 'null') obj[col] = null;
          else if (val.type === 'integer') obj[col] = parseInt(val.value, 10);
          else if (val.type === 'float') obj[col] = parseFloat(val.value);
          else obj[col] = val.value;
        } else {
          obj[col] = val;
        }
      });
      return obj;
    });
    return { rows, lastInsertRowid: 0, changes: rows.length };
  }

  // INSERT/UPDATE/DELETE
  return {
    rows: [],
    lastInsertRowid: result.last_insert_rowid ?? 0,
    changes: result.affected_row_count ?? 0
  };
}

// === Turso init — create tables ===
async function initTurso() {
  if (_tursoReady) return;
  _tursoReady = true;

  const ddl = [
    `CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT DEFAULT '其他', stock REAL DEFAULT 0, unit TEXT DEFAULT '個', min_stock REAL DEFAULT 0, unit_price REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT DEFAULT (datetime('now','localtime'))`,
    `CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT DEFAULT '', email TEXT DEFAULT '', address TEXT DEFAULT '', notes TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT DEFAULT (datetime('now','localtime'))`,
    `CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL CHECK(type IN ('income','expense')), amount REAL NOT NULL DEFAULT 0, category TEXT DEFAULT '其他', description TEXT DEFAULT '', tx_date TEXT DEFAULT (datetime('now','localtime')), created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT DEFAULT (datetime('now','localtime')))`,
    `CREATE INDEX IF NOT EXISTS idx_inv_name ON inventory(name)`,
    `CREATE INDEX IF NOT EXISTS idx_inv_cat ON inventory(category)`,
    `CREATE INDEX IF NOT EXISTS idx_cust_name ON customers(name)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(tx_date)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_cat ON transactions(category)`
  ];

  // Execute each DDL statement separately
  for (const stmt of ddl) {
    try {
      await tursoHttp(stmt);
    } catch (e) {
      // Table/index already exists — ignore
    }
  }
}

// === better-sqlite3 sync wrapper (local dev only) ===
function initLocal() {
  if (_db) return _db;
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    throw new Error('better-sqlite3 not available. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for cloud deployment.');
  }
  _db = new Database(path.join(__dirname, '..', 'data.db'));
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT DEFAULT '其他',
      stock REAL DEFAULT 0, unit TEXT DEFAULT '個', min_stock REAL DEFAULT 0, unit_price REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT DEFAULT '', email TEXT DEFAULT '',
      address TEXT DEFAULT '', notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL CHECK(type IN ('income','expense')),
      amount REAL NOT NULL DEFAULT 0, category TEXT DEFAULT '其他', description TEXT DEFAULT '',
      tx_date TEXT DEFAULT (datetime('now','localtime')),
      created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_inv_name ON inventory(name);
    CREATE INDEX IF NOT EXISTS idx_inv_cat ON inventory(category);
    CREATE INDEX IF NOT EXISTS idx_cust_name ON customers(name);
    CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(tx_date);
    CREATE INDEX IF NOT EXISTS idx_tx_cat ON transactions(category);
  `);
  return _db;
}

// === Unified query interface ===
async function query(sql, params = []) {
  if (USE_TURSO) {
    await initTurso();
    return await tursoHttp(sql, params);
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

module.exports = { query, queryOne, getMonthStart, USE_TURSO, initLocal, initTurso, tursoHttp };
