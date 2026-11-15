const { USE_TURSO, tursoHttp } = require('../lib/db');
const { send, handleOptions } = require('../lib/helper');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;

  const debug = {
    USE_TURSO,
    TURSO_URL_set: !!process.env.TURSO_DATABASE_URL,
    TURSO_TOKEN_set: !!process.env.TURSO_AUTH_TOKEN,
    TURSO_URL: process.env.TURSO_DATABASE_URL || '(not set)',
    node_version: process.version,
    has_fetch: typeof fetch !== 'undefined',
  };

  if (USE_TURSO) {
    // Test actual query using v2 pipeline API
    try {
      const result = await tursoHttp('SELECT 1 as test_val');
      debug.query_ok = true;
      debug.query_result = JSON.stringify(result);
      debug.rows_count = result.rows ? result.rows.length : 0;
    } catch (e) {
      debug.query_ok = false;
      debug.query_error = e.message;
    }
  }

  return send(res, 200, debug);
};
