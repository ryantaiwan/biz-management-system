const { USE_TURSO } = require('../lib/db');
const { send, handleOptions } = require('../lib/helper');

module.exports = (req, res) => {
  if (handleOptions(req, res)) return;
  send(res, 200, {
    status: 'ok',
    db: USE_TURSO ? 'turso (HTTP API)' : 'better-sqlite3 (local)',
    tables: ['inventory', 'customers', 'transactions']
  });
};
