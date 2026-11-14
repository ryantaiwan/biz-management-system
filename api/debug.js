const { USE_TURSO } = require('../lib/db');
const { send, handleOptions } = require('../lib/helper');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;

  const debug = {
    USE_TURSO,
    TURSO_DATABASE_URL_set: !!process.env.TURSO_DATABASE_URL,
    TURSO_DATABASE_URL_value: process.env.TURSO_DATABASE_URL ? process.env.TURSO_DATABASE_URL.replace(/^libsql:\/\/(.+)$/,'libsql://$1') : '(not set)',
    TURSO_AUTH_TOKEN_set: !!process.env.TURSO_AUTH_TOKEN,
    node_version: process.version,
    env_keys: Object.keys(process.env).filter(k => k.startsWith('TURSO') || k.startsWith('VERCEL')),
  };

  // Try a simple Turso HTTP call
  if (USE_TURSO) {
    try {
      const url = process.env.TURSO_DATABASE_URL.replace('libsql://', 'https://');
      debug.http_url = url;
      const res2 = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TURSO_AUTH_TOKEN}`
        },
        body: JSON.stringify({
          statements: [{ q: 'SELECT 1 as test' }]
        })
      });
      debug.http_status = res2.status;
      debug.http_ok = res2.ok;
      const text = await res2.text();
      debug.http_response = text.substring(0, 500);
    } catch (e) {
      debug.http_error = e.message;
    }
  }

  return send(res, 200, debug);
};
