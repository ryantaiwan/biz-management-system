const { query, queryOne, getMonthStart } = require('../lib/db');

function send(res, code, data) {
  res.status(code).json(data);
}

module.exports = async (req, res) => {
  const method = req.method;
  const id = req.query.id;

  try {
    // GET /api/inventory — list with search + pagination
    if (method === 'GET' && !id) {
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

    // GET /api/inventory/:id — single record
    if (method === 'GET' && id) {
      const row = await queryOne('SELECT * FROM inventory WHERE id = ?', [id]);
      if (!row) return send(res, 404, { error: 'Not found' });
      return send(res, 200, row);
    }

    // POST /api/inventory — create
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

    // PUT /api/inventory/:id — update
    if (method === 'PUT' && id) {
      const { name, category, stock, unit, min_stock, unit_price } = req.body;
      const existing = await queryOne('SELECT * FROM inventory WHERE id = ?', [id]);
      if (!existing) return send(res, 404, { error: 'Not found' });
      await query(
        `UPDATE inventory SET name=?, category=?, stock=?, unit=?, min_stock=?, unit_price=?, updated_at=datetime('now','localtime') WHERE id=?`,
        [
          name ?? existing.name,
          category ?? existing.category,
          stock !== undefined ? Number(stock) : existing.stock,
          unit ?? existing.unit,
          min_stock !== undefined ? Number(min_stock) : existing.min_stock,
          unit_price !== undefined ? Number(unit_price) : existing.unit_price,
          id
        ]
      );
      const row = await queryOne('SELECT * FROM inventory WHERE id = ?', [id]);
      return send(res, 200, row);
    }

    // DELETE /api/inventory/:id
    if (method === 'DELETE' && id) {
      const result = await query('DELETE FROM inventory WHERE id = ?', [id]);
      if (result.changes === 0) return send(res, 404, { error: 'Not found' });
      return send(res, 200, { success: true });
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
};
