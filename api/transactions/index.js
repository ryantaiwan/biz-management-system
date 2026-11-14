const { query, queryOne } = require('../lib/db');
const { send, handleOptions } = require('../lib/helper');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  const method = req.method;

  try {
    if (method === 'GET') {
      const { type, page = 1, limit = 15 } = req.query;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      let where = '';
      let params = [];
      if (type) { where = 'WHERE type = ?'; params = [type]; }

      const countResult = await query(`SELECT COUNT(*) as total FROM transactions ${where}`, params);
      const rowsResult = await query(
        `SELECT * FROM transactions ${where} ORDER BY tx_date DESC, created_at DESC LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      );

      return send(res, 200, { data: rowsResult.rows, total: countResult.rows[0].total, page: pageNum, limit: limitNum });
    }

    if (method === 'POST') {
      const { type, amount, category, description, tx_date } = req.body;
      if (!type || !['income','expense'].includes(type)) return send(res, 400, { error: 'type must be income or expense' });
      if (!amount || amount <= 0) return send(res, 400, { error: 'amount must be positive' });
      const result = await query(
        `INSERT INTO transactions (type, amount, category, description, tx_date) VALUES (?,?,?,?,COALESCE(?, datetime('now','localtime')))`,
        [type, Number(amount), category || '其他', description || '', tx_date || null]
      );
      const row = await queryOne('SELECT * FROM transactions WHERE id = ?', [result.lastInsertRowid]);
      return send(res, 201, row);
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
};
