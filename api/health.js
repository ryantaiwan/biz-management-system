const { USE_TURSO } = require('../lib/db');

module.exports = (req, res) => {
  res.status(200).json({
    status: 'ok',
    db: USE_TURSO ? 'turso (libsql)' : 'better-sqlite3 (local)',
    tables: ['inventory', 'customers', 'transactions']
  });
};
