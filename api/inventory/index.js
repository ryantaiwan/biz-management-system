const { query, queryOne } = require('../../lib/db');

function send(res, code, data) {
  res.status(code).json(data);
}

module.exports = async (req, res) => {
  const method = req.method;

  try {
    if (method === 'GET') {
      const { search, page = 1, limit = 15 } = req.query;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      let where = '';
      let params = [];
      if (search) {
        where = 'WHERE name LIKE ? OR category LIKE ?';
        const kw = '%' + search + '%';
        params = [kw, kw];
      }

      const countResult = await query(`SELECT COUNT(*) as total FROM inventory ${where}`, params);
      const rowsResult = await query(
        `SELECT * FROM inventory ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      );

      return send(res, 200, { data: rowsResult.rows, total: countResult.rows[0].total, page: pageNum, limit: limitNum });
    }

    if (method === 'POST') {
      const { name, category, stock, unit, min_stock, unit_price } = req.body;
      if (!name) return send(res, 400, { error: 'name is required' });
      const result = await query(
        `INSERT INTO inventory (name, category, stock, unit, min_stock, unit_price) VALUES (?,?,?,?,?,?)`,
        [name, category || '其他', Number(stock) || 0, unit || '個', Number(min_stock) || 0, Number(unit_price) || 0]
      );
      const row = await queryOne('SELECT * FROM inventory WHERE id = ?', [result.lastInsertRowid]);
      return send(res, 201, row);
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
};
