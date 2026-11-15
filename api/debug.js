const { USE_TURSO } = require('../lib/db');
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
    let url = process.env.TURSO_DATABASE_URL;
    if (url.startsWith('libsql://')) url = 'https://' + url.substring(9);
    url = url.replace(/\/$/, '') + '/v2/pipeline';

    // Test 1: raw fetch to see exact response
    try {
      const rawRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TURSO_AUTH_TOKEN}`
        },
        body: JSON.stringify({
          requests: [
            { type: 'execute', stmt: { sql: 'SELECT COUNT(*) as total FROM inventory' } },
            { type: 'close' }
          ]
        })
      });

      debug.http_status = rawRes.status;
      debug.http_ok = rawRes.ok;
      const rawText = await rawRes.text();
      debug.raw_response = rawText.substring(0, 1000);
      
      // Try to parse and show structure
      try {
        const parsed = JSON.parse(rawText);
        debug.parsed_keys = Object.keys(parsed);
        if (parsed.results) {
          debug.results_count = parsed.results.length;
          if (parsed.results[0]) {
            debug.result0_keys = Object.keys(parsed.results[0]);
            debug.result0_cols = parsed.results[0].cols;
            debug.result0_rows = JSON.stringify(parsed.results[0].rows).substring(0, 500);
          }
        }
      } catch(e) {
        debug.parse_error = e.message;
      }
    } catch (e) {
      debug.fetch_error = e.message;
    }
  }

  return send(res, 200, debug);
};
